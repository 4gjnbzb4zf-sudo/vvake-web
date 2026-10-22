// Copied from VVFit packages/game-core/src/voiceAudio.ts (e1b98fbe 2026-10-22) by scripts/sync-stitch-core.ts. Do not edit: re-sync.
/**
 * The stitched coach voice's audio (ADR-0054, docs/05-tech/voice-coach.md "Stitched lines"): small clips recorded once
 * in the coach's voice, packed per language, decoded and joined on the device into one line. Pure TypeScript, no
 * platform audio: the API encodes and packs (services/api src/voice/stitchRender.ts), the phone and the web decode and
 * join (apps/mobile src/lib/stitchVoice.ts, vvake-web src/lib/webapp/stitch*), the watches port the decoder and the
 * joiner (Swift StitchVoice.swift, Kotlin StitchVoice.kt).
 *
 * - Codec: IMA ADPCM, 4 bits a sample, mono, at the pack's rate (22,050 Hz): 4× smaller than 16-bit PCM and decoded
 *   in a few lines on every platform (no MP3/AAC decoder needed to join clips sample-accurately). Each clip starts with
 *   its own predictor and step index, so any clip decodes alone.
 * - Clean joins: the renderer trims each clip's leading and trailing silence (keeping a short margin), fades its edges
 *   and evens its loudness; the device joins clips with a short crossfade and puts the pause a comma or a full stop
 *   asks for (`STITCH_PAUSE_MS`) where the line has one.
 * - Pack file ("VVS1"): magic, header length (u32 LE), a JSON header (`PackHeader`), then the clips' bytes.
 */

// ---- IMA ADPCM ---------------------------------------------------------------------------------------------------

const STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173,
  190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
  2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818,
  18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const INDEX_ADJ = [-1, -1, -1, -1, 2, 4, 6, 8];

/** Bytes an encoded clip of `samples` takes: a 4-byte head (predictor i16, step index u8, 0) then 2 samples a byte. */
export const adpcmBytes = (samples: number) => 4 + Math.ceil(Math.max(0, samples - 1) / 2);

const clamp16 = (v: number) => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

/**
 * Encodes 16-bit samples. The first sample is stored as is (the head); the others as 4-bit codes, low nibble first.
 * The encoder tracks the decoder's state exactly, so encode → decode is deterministic on every platform.
 */
export function adpcmEncode(pcm: Int16Array): Uint8Array {
  const n = pcm.length;
  const out = new Uint8Array(adpcmBytes(n));
  if (!n) return out;
  let pred = pcm[0]!;
  // A starting step close to the first differences (a quiet start, after the trim's fade-in: small).
  let index = 0;
  out[0] = pred & 0xff;
  out[1] = (pred >> 8) & 0xff;
  out[2] = index;
  out[3] = 0;
  let at = 4;
  let half = -1;
  for (let i = 1; i < n; i++) {
    const step = STEPS[index]!;
    let diff = pcm[i]! - pred;
    let code = 0;
    if (diff < 0) {
      code = 8;
      diff = -diff;
    }
    let delta = step >> 3;
    if (diff >= step) {
      code |= 4;
      diff -= step;
      delta += step;
    }
    if (diff >= step >> 1) {
      code |= 2;
      diff -= step >> 1;
      delta += step >> 1;
    }
    if (diff >= step >> 2) {
      code |= 1;
      delta += step >> 2;
    }
    pred = clamp16(code & 8 ? pred - delta : pred + delta);
    index += INDEX_ADJ[code & 7]!;
    if (index < 0) index = 0;
    else if (index > 88) index = 88;
    if (half < 0) half = code;
    else {
      out[at++] = half | (code << 4);
      half = -1;
    }
  }
  if (half >= 0) out[at++] = half;
  return out;
}

/** Decodes `samples` samples of a clip (`bytes` from `adpcmEncode`). */
export function adpcmDecode(bytes: Uint8Array, samples: number): Int16Array {
  const out = new Int16Array(Math.max(0, samples));
  if (!samples || bytes.length < 4) return out;
  let pred = ((bytes[0]! | (bytes[1]! << 8)) << 16) >> 16;
  let index = Math.min(88, bytes[2]!);
  out[0] = pred;
  let at = 4;
  for (let i = 1; i < samples; i++) {
    const b = bytes[at] ?? 0;
    const code = i % 2 === 1 ? b & 0x0f : b >> 4;
    if (i % 2 === 0) at++;
    const step = STEPS[index]!;
    let delta = step >> 3;
    if (code & 4) delta += step;
    if (code & 2) delta += step >> 1;
    if (code & 1) delta += step >> 2;
    pred = clamp16(code & 8 ? pred - delta : pred + delta);
    index += INDEX_ADJ[code & 7]!;
    if (index < 0) index = 0;
    else if (index > 88) index = 88;
    out[i] = pred;
  }
  return out;
}

// ---- trim, fade, loudness (the renderer) ---------------------------------------------------------------------

/** How a rendered clip is cleaned (bump `TRIM_VERSION` when these change: every clip is rendered again). */
export const TRIM = {
  /** A 5 ms window counts as voice above this level (−42 dBFS). */
  threshold: 260,
  windowMs: 5,
  /** Kept before the first voiced window and after the last (breath, the tail of a vowel). */
  leadMs: 18,
  tailMs: 40,
  /** Fades at both edges. */
  fadeInMs: 6,
  fadeOutMs: 14,
  /** Loudness of the voiced part, RMS (−20 dBFS), within these gains; peaks kept under 0.97 of full scale. */
  targetRms: 3277,
  minGain: 0.7,
  maxGain: 1.6,
} as const;
export const TRIM_VERSION = 1;

/** The voiced part of a clip, its edges faded and its loudness evened: the clip as it goes into the pack. */
export function trimClip(pcm: Int16Array, rate: number): Int16Array {
  const win = Math.max(1, Math.round((TRIM.windowMs * rate) / 1000));
  const loud = (from: number) => {
    let sum = 0;
    const end = Math.min(pcm.length, from + win);
    for (let i = from; i < end; i++) sum += pcm[i]! * pcm[i]!;
    return Math.sqrt(sum / Math.max(1, end - from));
  };
  let first = -1;
  let last = -1;
  for (let w = 0; w < pcm.length; w += win) {
    if (loud(w) >= TRIM.threshold) {
      if (first < 0) first = w;
      last = Math.min(pcm.length, w + win);
    }
  }
  if (first < 0) return new Int16Array(0);
  const start = Math.max(0, first - Math.round((TRIM.leadMs * rate) / 1000));
  const end = Math.min(pcm.length, last + Math.round((TRIM.tailMs * rate) / 1000));
  const out = Float64Array.from(pcm.subarray(start, end));
  // Loudness over the voiced windows only.
  let sum = 0;
  let count = 0;
  let peak = 1;
  for (let w = 0; w < out.length; w += win) {
    let s = 0;
    const e = Math.min(out.length, w + win);
    for (let i = w; i < e; i++) s += out[i]! * out[i]!;
    if (Math.sqrt(s / Math.max(1, e - w)) >= TRIM.threshold) {
      sum += s;
      count += e - w;
    }
  }
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const rms = Math.sqrt(sum / Math.max(1, count));
  let gain = rms > 0 ? TRIM.targetRms / rms : 1;
  gain = Math.min(TRIM.maxGain, Math.max(TRIM.minGain, gain));
  gain = Math.min(gain, (0.97 * 32767) / peak);
  const fin = Math.round((TRIM.fadeInMs * rate) / 1000);
  const fout = Math.round((TRIM.fadeOutMs * rate) / 1000);
  const res = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fin) g *= i / fin;
    const fromEnd = out.length - 1 - i;
    if (fromEnd < fout) g *= fromEnd / fout;
    res[i] = clamp16(Math.round(out[i]! * g));
  }
  return res;
}

// ---- joining (the device) ----------------------------------------------------------------------------------------

/** The pause a stitched line takes at a full stop (also ! ?) and at a comma (also : ; —), and the crossfade between
 * two clips said in one breath. */
export const STITCH_PAUSE_MS = { ".": 260, ",": 140 } as const;
export const CROSSFADE_MS = 8;

/** A stitched line's parts: a clip's samples, or a pause marker ("." / ","). */
export type JoinPart = Int16Array | "." | ",";

/**
 * One line from its parts: clips one after the other with a short crossfade (equal-gain, `CROSSFADE_MS`), the pauses
 * as silence. Leading and trailing pauses are dropped.
 */
export function joinClips(parts: readonly JoinPart[], rate: number): Int16Array {
  const xf = Math.round((CROSSFADE_MS * rate) / 1000);
  const items = [...parts];
  while (items.length && typeof items[0] === "string") items.shift();
  while (items.length && typeof items[items.length - 1] === "string") items.pop();
  let total = 0;
  let prevClip = false;
  for (const p of items) {
    if (typeof p === "string") {
      total += Math.round((STITCH_PAUSE_MS[p] * rate) / 1000);
      prevClip = false;
    } else {
      total += p.length - (prevClip ? Math.min(xf, p.length) : 0);
      prevClip = true;
    }
  }
  const out = new Int16Array(Math.max(0, total));
  let at = 0;
  prevClip = false;
  for (const p of items) {
    if (typeof p === "string") {
      at += Math.round((STITCH_PAUSE_MS[p] * rate) / 1000);
      prevClip = false;
      continue;
    }
    const overlap = prevClip ? Math.min(xf, p.length, at) : 0;
    const start = at - overlap;
    for (let i = 0; i < p.length; i++) {
      const j = start + i;
      if (i < overlap) {
        const k = (i + 1) / (overlap + 1);
        out[j] = clamp16(Math.round(out[j]! * (1 - k) + p[i]! * k));
      } else out[j] = p[i]!;
    }
    at = start + p.length;
    prevClip = true;
  }
  return out.subarray(0, at);
}

/** A 16-bit mono WAV file of `pcm`. */
export function wavBytes(pcm: Int16Array, rate: number): Uint8Array {
  const data = pcm.length * 2;
  const buf = new Uint8Array(44 + data);
  const v = new DataView(buf.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) buf[at + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + data, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, data, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i]!, true);
  return buf;
}

/** Little-endian 16-bit PCM bytes (an ElevenLabs `pcm_22050` answer) as samples. */
export function pcmFromBytes(bytes: Uint8Array): Int16Array {
  const n = bytes.length >> 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = ((bytes[2 * i]! | (bytes[2 * i + 1]! << 8)) << 16) >> 16;
  return out;
}

// ---- the pack file -------------------------------------------------------------------------------------------------

export const PACK_MAGIC = "VVS1";

/** Where a clip is in the pack: byte offset (from the start of the data), byte length, samples. */
export type PackEntry = readonly [offset: number, bytes: number, samples: number];

export interface PackHeader {
  /** Format version of the file (1). */
  v: 1;
  lang: "en" | "fr";
  /** The manifest's hash (stitchVoice.ts `stitchManifest(lang).version`): a device keeps one pack per version. */
  version: string;
  /** "full" (phone, web) or "watch" (the workout subset). */
  kind: "full" | "watch";
  /** Sample rate (Hz). */
  rate: number;
  codec: "ima-adpcm";
  /** The API's voiceTag of the voice the clips are in (one coach voice: a pack in another voice isn't played). */
  voiceTag: string;
  clips: Record<string, PackEntry>;
  /** The vocabulary the watches' stitchers need (stitchVoice.ts `stitchTables`): phrase keys → clip ids, etc. */
  tables?: unknown;
}

/** Writes a pack: `clips` id → ADPCM bytes and sample count. */
export function writePack(head: Omit<PackHeader, "clips">, clips: ReadonlyMap<string, { bytes: Uint8Array; samples: number }>): Uint8Array {
  const index: Record<string, PackEntry> = {};
  let size = 0;
  for (const [id, c] of clips) {
    index[id] = [size, c.bytes.length, c.samples];
    size += c.bytes.length;
  }
  const json = utf8(JSON.stringify({ ...head, clips: index }));
  const out = new Uint8Array(8 + json.length + size);
  for (let i = 0; i < 4; i++) out[i] = PACK_MAGIC.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, json.length, true);
  out.set(json, 8);
  let at = 8 + json.length;
  for (const c of clips.values()) {
    out.set(c.bytes, at);
    at += c.bytes.length;
  }
  return out;
}

export interface Pack {
  header: PackHeader;
  /** The clips' bytes (the file after the header). */
  data: Uint8Array;
}

/** Reads a pack, or null when the bytes aren't one (wrong magic, cut short). */
export function readPack(bytes: Uint8Array): Pack | null {
  if (bytes.length < 8) return null;
  for (let i = 0; i < 4; i++) if (bytes[i] !== PACK_MAGIC.charCodeAt(i)) return null;
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
  if (8 + len > bytes.length) return null;
  try {
    const header = JSON.parse(fromUtf8(bytes.subarray(8, 8 + len))) as PackHeader;
    const data = bytes.subarray(8 + len);
    for (const [, [off, n]] of Object.entries(header.clips)) if (off + n > data.length) return null;
    return { header, data };
  } catch {
    return null;
  }
}

/** A clip's samples from a pack, or null when it isn't there. */
export function packClip(pack: Pack, id: string): Int16Array | null {
  const e = pack.header.clips[id];
  if (!e) return null;
  return adpcmDecode(pack.data.subarray(e[0], e[0] + e[1]), e[2]);
}

/**
 * A stitched line (clip ids and pause markers, stitchVoice.ts `stitch`) as one WAV file from `pack`, or null when a
 * clip is missing (the caller falls back to the device voice).
 */
export function stitchedWav(pack: Pack, ids: readonly string[]): Uint8Array | null {
  const parts: JoinPart[] = [];
  for (const id of ids) {
    if (id === "." || id === ",") {
      parts.push(id);
      continue;
    }
    const c = packClip(pack, id);
    if (!c) return null;
    parts.push(c);
  }
  return wavBytes(joinClips(parts, pack.header.rate), pack.header.rate);
}

// UTF-8 without TextEncoder (Hermes has it, but keep the core runtime-free).
function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}
function fromUtf8(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length;) {
    const c = b[i]!;
    let cp: number;
    if (c < 0x80) ((cp = c), (i += 1));
    else if (c < 0xe0) ((cp = ((c & 31) << 6) | (b[i + 1]! & 63)), (i += 2));
    else if (c < 0xf0) ((cp = ((c & 15) << 12) | ((b[i + 1]! & 63) << 6) | (b[i + 2]! & 63)), (i += 3));
    else ((cp = ((c & 7) << 18) | ((b[i + 1]! & 63) << 12) | ((b[i + 2]! & 63) << 6) | (b[i + 3]! & 63)), (i += 4));
    s += String.fromCodePoint(cp);
  }
  return s;
}
export const utf8Bytes = utf8;
export const utf8Text = fromUtf8;
