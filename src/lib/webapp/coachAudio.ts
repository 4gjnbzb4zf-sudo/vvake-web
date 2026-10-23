import type { Locale } from "@/i18n/config";
import type { RewardsSession } from "@/lib/rewardsApi";
import type { WebApi } from "./api";
import {
  CUE_START_MS,
  LINE_START_MS,
  REPLY_START_MS,
  cloudThenDevice,
  createSpeechQueue,
  lineMaxMs,
  type CloudEvents,
  type ConversationVoice,
  type SpeechKind,
} from "./speechQueue";
import { bestBrowserVoice, splitLines, type Spoken, type VoiceMode } from "./voicePick";
import { PREVIEW_LINE, type CoachSpeech } from "./appVoice";
import {
  COACH_VOICE_SLOTS,
  coachVoiceGender,
  coachVoiceProfile,
  coachVoiceSlot,
  type CoachVoiceGender,
  type CoachVoiceSlot,
} from "@/lib/coachVoices";
import { playFirst, recordedBudget, type LinePlayer, type VoiceSource } from "./lineRoute";
import { RETRY_MS, loadPack, sameVoice, stitchIds, type KeptPack, type PackDeps, type StitchInfo } from "./stitch/stitchPack";
import { stitchedWav, type Pack } from "./stitch/voiceAudio";

/**
 * The coach's voice in the browser (vvake.com/<lang>/app), the phone's voice (monorepo apps/mobile/src/lib/voice.ts):
 *
 * - workout cues: the recorded voice-pack and cheer-library lines (`GET /v1/voice/pack`, `/v1/voice/library`, the same
 *   recordings for every account), fetched with the session's token and kept in Cache Storage (`vvake-voice-v1`, the
 *   pack is fetched ahead when a workout screen opens) so a cue plays at once, offline included;
 * - the app's fixed lines (`GET /v1/voice/app`: the camera workout's counts, cues, set ends and rests, teach a move,
 *   the check-ins, the preview; recorded once for every account, free included), looked up by their exact words;
 * - any other line ("3 kilometres. Time 15:20."): `POST /v1/voice/lines`, for every account (Plus records it within
 *   its daily quota; anyone gets a line once it is recorded), else the browser voice, a whole line at a time;
 * - coach replies: the reply's own audio when the API gave one (Plus), kept in memory only, never on disk;
 * - one speech queue (speechQueue.ts): one line at a time, the newest cue wins, barge-in silences all; the browser
 *   voice (the best installed one for the language: voicePick.ts) only when the recording doesn't come in time, and
 *   then never both;
 * - the stitched coach voice (VVFit ADR-0054): when a line has no recording (offline, not registered, no quota), the
 *   coach's own clips from the full pack kept in this browser (`GET /v1/voice/stitch`, Cache Storage `vvake-stitch-v1`)
 *   joined into one line here, before the browser voice: recording → stitched → browser voice (lineRoute.ts);
 * - the coach voice the athlete chose (ADR-0056, woman or man; the language picks the voice of that pair): every
 *   fetch names it (`voice=`), what is kept in this browser is kept per voice (the recordings' keys, the lists, the
 *   stitched pack: one per slot "fr-man"), so a switch never mixes two voices; the browser voice standing in is of the
 *   same gender when the browser has one;
 * - Safari/iOS autoplay: one audio element, unlocked by `unlockAudio()` on the Start tap (and the other workout and
 *   coach taps), plays every later line; the browser voice is primed on the same tap.
 */

interface VoiceConfig {
  api: WebApi;
  session: RewardsSession;
  apiUrl: string;
  lang: Locale;
  imperial: boolean;
  mode: VoiceMode;
  /** The coach voice chosen (`/v1/me` coach.voiceGender; absent: woman). */
  gender?: CoachVoiceGender;
}

const genderOf = (c: VoiceConfig | null): CoachVoiceGender => coachVoiceGender(c?.gender);
const slotOf = (c: VoiceConfig): CoachVoiceSlot => coachVoiceSlot(c.lang, c.gender);

let cfg: VoiceConfig | null = null;
const queue = createSpeechQueue();

/** The account, language, units and voice this page speaks with (AppContext keeps it current). */
export function configureVoice(c: VoiceConfig) {
  const changed = !cfg || cfg.session !== c.session || cfg.lang !== c.lang || cfg.imperial !== c.imperial || genderOf(cfg) !== genderOf(c);
  cfg = c;
  if (changed) {
    sets.clear();
    lineUrls.clear();
    appIndex = null;
    warmed = false;
    coachTag = null;
  }
  if (!stitch || stitch.slot !== slotOf(c) || stitch.apiUrl !== c.apiUrl) resetStitch(c);
  if (c.mode === "off") hush();
}

const browser = () => typeof window !== "undefined";
const online = () => !browser() || navigator.onLine !== false;
const locale = (l: Locale) => (l === "fr" ? "fr-FR" : "en-US");

// ── Cache Storage: the recordings (and the lists of them) kept in this browser ─────────────────────────────────

/** Not "vvake-app-…": the app shell's service worker (public/app-sw.js) clears those on each new version. */
export const VOICE_CACHE = "vvake-voice-v1";
const CACHE_MAX = 400;

async function voiceCache(): Promise<Cache | null> {
  try {
    return browser() && "caches" in window ? await caches.open(VOICE_CACHE) : null;
  } catch {
    return null;
  }
}

/** Audio already in memory this visit: "<slot> <path>" → object URL. */
const mem = new Map<string, string>();
const MEM_MAX = 120;
function remember(path: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  mem.set(path, url);
  if (mem.size > MEM_MAX) {
    const [oldest, u] = mem.entries().next().value as [string, string];
    mem.delete(oldest);
    URL.revokeObjectURL(u);
  }
  return url;
}

/** A line's audio as an object URL: memory, then Cache Storage, then the API (kept when `keep`). */
async function clipUrl(path: string, keep: boolean): Promise<string | null> {
  const c = cfg;
  if (!c) return null;
  // Kept per voice: a path the API gives for one voice is never played as another's.
  const id = `${slotOf(c)} ${path}`;
  const hit = mem.get(id);
  if (hit) return hit;
  const key = clipKey(c.apiUrl, slotOf(c), path);
  const cache = keep ? await voiceCache() : null;
  try {
    const r = await cache?.match(key);
    if (r) return remember(id, await r.blob());
  } catch {
    // unreadable entry: fetched again
  }
  const blob = await c.session.voiceAudio(path);
  if (!blob) return null;
  if (cache) void cache.put(key, new Response(blob, { headers: { "content-type": blob.type || "audio/mpeg" } })).catch(() => undefined);
  return remember(id, blob);
}

/** A recording's Cache Storage key: under its voice's slot. */
export const clipKey = (apiUrl: string, slot: CoachVoiceSlot, path: string) => `${apiUrl}/v1/voice/__clip/${slot}${path}`;

async function pruneCache() {
  const cache = await voiceCache();
  if (!cache) return;
  try {
    const keys = await cache.keys();
    if (keys.length > CACHE_MAX) await Promise.all(keys.slice(0, keys.length - CACHE_MAX + 50).map((k) => cache.delete(k)));
  } catch {
    // best effort
  }
}

// ── The recorded sets: voice pack, cheer library (id → audio path) ────────────────────────────────────────────

type SetKind = "pack" | "lib" | "app";
const sets = new Map<string, Promise<Map<string, string> | null>>();

function voiceSet(kind: SetKind): Promise<Map<string, string> | null> {
  const c = cfg;
  if (!c) return Promise.resolve(null);
  const name = `${kind}-${slotOf(c)}-${kind === "lib" && c.imperial ? "imperial" : "metric"}`;
  let p = sets.get(name);
  if (!p) {
    p = loadSet(c, kind, name);
    sets.set(name, p);
    // A failed load (offline, nothing kept) is tried again next time.
    void p.then((m) => {
      if (!m) sets.delete(name);
    });
  }
  return p;
}

async function loadSet(c: VoiceConfig, kind: SetKind, name: string): Promise<Map<string, string> | null> {
  const key = `${c.apiUrl}/v1/voice/__set/${name}.json`;
  const cache = await voiceCache();
  // The app's fixed lines are looked up by their words (the phone's and the web's screens say the same).
  const toMap = (items: { id: string; url?: string | null }[]) => {
    const m = new Map(items.filter((i) => i.url).map((i) => [i.id, i.url!] as const));
    if (kind === "app") appIndex = m;
    return m;
  };
  try {
    const set =
      kind === "pack"
        ? await c.api.voicePack(c.lang, genderOf(c))
        : kind === "lib"
          ? await c.api.voiceLibrary(c.lang, c.imperial, genderOf(c))
          : await c.api.voiceApp(c.lang, genderOf(c));
    if (set.voice === "device") return null;
    if (set.voiceTag) coachTag = set.voiceTag;
    const items = set.items.map((i) => ({ id: kind === "app" ? i.text : i.id, url: i.url ?? null }));
    if (cache)
      void cache.put(key, new Response(JSON.stringify(items), { headers: { "content-type": "application/json" } })).catch(() => undefined);
    return toMap(items);
  } catch {
    try {
      const r = await cache?.match(key);
      return r ? toMap((await r.json()) as { id: string; url: string | null }[]) : null;
    } catch {
      return null;
    }
  }
}

/** The app's fixed lines once loaded (text → audio path): a rep count can play at once from it. */
let appIndex: Map<string, string> | null = null;
/** The voice the recorded sets are in (the API's voiceTag): the stitched pack must be in the same one. */
let coachTag: string | null = null;

/** A line's recording: the app's fixed lines first, else `POST /v1/voice/lines` (null: the browser voice says it). */
async function textPath(text: string): Promise<string | null> {
  const app = await voiceSet("app");
  return app?.get(text) ?? (await linePath(text));
}

/** Lines with numbers registered this visit: text → audio path (or null: the browser voice says it). */
const lineUrls = new Map<string, string | null>();

async function linePath(text: string): Promise<string | null> {
  const c = cfg;
  if (!c) return null;
  if (lineUrls.has(text)) return lineUrls.get(text)!;
  try {
    const r = await c.api.voiceLines([text.slice(0, 200)], c.lang, genderOf(c));
    const url = r.items[0]?.url ?? null;
    lineUrls.set(text, url);
    return url;
  } catch {
    return null;
  }
}

// ── The player: one audio element for every line, unlocked on a tap ───────────────────────────────────────────

let el: HTMLAudioElement | null = null;
let unlocked = false;
let synthPrimed = false;
let gen = 0;

function audioEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.setAttribute("playsinline", "");
  }
  return el;
}

/** 0.1 s of silence (8 kHz, 8-bit mono WAV): what the unlocking tap plays. */
let silent: string | null = null;
function silentUrl(): string {
  if (silent) return silent;
  const n = 800;
  const b = new DataView(new ArrayBuffer(44 + n));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => b.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  b.setUint32(4, 36 + n, true);
  text(8, "WAVEfmt ");
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true);
  b.setUint32(28, 8000, true);
  b.setUint16(32, 1, true);
  b.setUint16(34, 8, true);
  text(36, "data");
  b.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
  silent = URL.createObjectURL(new Blob([b.buffer], { type: "audio/wav" }));
  return silent;
}

/**
 * Call inside a tap (Start, pause, resume, end, the coach's send and mic): iOS Safari lets an audio element that played
 * on a user gesture play later lines on its own, and the browser voice speak after it was primed the same way.
 */
export function unlockAudio() {
  if (!browser()) return;
  try {
    const a = audioEl();
    if (!unlocked && a.paused) {
      a.src = silentUrl();
      void a
        .play()
        .then(() => {
          unlocked = true;
        })
        .catch(() => undefined);
    }
  } catch {
    // no audio element: the browser voice speaks
  }
  try {
    if (!synthPrimed && canSpeak()) {
      synthPrimed = true;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    // no speech synthesis
  }
}

/** The one element plays a line's audio (object URLs) in order: what every source of a line plays through. */
const elementPlayer: LinePlayer = {
  play(urls, ev) {
    const my = ++gen;
    let stopped = false;
    const mine = () => !stopped && gen === my;
    const a = audioEl();
    let told = false;
    const fail = () => {
      if (!mine()) return;
      if (told) ev.ended();
      else ev.failed();
    };
    const at = (i: number) => {
      if (!mine()) return;
      a.onplaying = () => {
        if (!mine() || told) return;
        told = true;
        ev.playing();
      };
      a.onended = () => {
        if (!mine()) return;
        if (i + 1 < urls.length) at(i + 1);
        else ev.ended();
      };
      a.onerror = fail;
      a.src = urls[i]!;
      a.play().catch(fail);
    };
    at(0);
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        if (gen === my && el) {
          el.onplaying = el.onended = el.onerror = null;
          try {
            el.pause();
          } catch {
            // already stopped
          }
        }
      },
    };
  },
};

/** The recording of a line: the paths `resolve` finds, fetched (or read from the cache) into object URLs. */
function recorded(resolve: () => Promise<string[] | null>, keep: boolean): VoiceSource {
  return {
    name: "recorded",
    async resolve() {
      const paths = await resolve().catch(() => null);
      if (!paths?.length) return null;
      const urls: string[] = [];
      for (const p of paths) {
        const u = await clipUrl(p, keep).catch(() => null);
        if (!u) return null;
        urls.push(u);
      }
      return urls;
    },
  };
}

/**
 * A line's audio in the coach's voice: `rec` (its recording, if it may have one), then the stitched line when the
 * pack kept in this browser has every clip for these words (the recording then gets until shortly before `startMs`,
 * so the stitched line still starts in time). Null: nothing in the coach's voice, the browser voice says it.
 */
function coachVoice(text: string, rec: VoiceSource | null, startMs: number) {
  const st = stitched(text);
  if (rec && st) rec.budgetMs = recordedBudget(startMs);
  return playFirst(
    [rec, st].filter((x): x is VoiceSource => !!x),
    elementPlayer,
  );
}

// ── The browser voice (the fallback) ──────────────────────────────────────────────────────────────────────────

export const canSpeak = () => browser() && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

function speakDevice(text: string, lang: Locale, gender: CoachVoiceGender, done: () => void): { stop(): void } {
  if (!canSpeak()) {
    const t = setTimeout(done, 0);
    return { stop: () => clearTimeout(t) };
  }
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    done();
  };
  if (text.trim()) for (const l of browserVoiceListeners) l();
  try {
    const synth = window.speechSynthesis;
    // The queue has one line at a time: anything still in the browser's own queue is stale.
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale(lang);
    const v = bestBrowserVoice(synth.getVoices(), locale(lang), online(), coachVoiceProfile(gender).gender);
    if (v) u.voice = v;
    u.rate = 1.02;
    u.onend = end;
    u.onerror = end;
    synth.speak(u);
  } catch {
    setTimeout(end, 0);
  }
  return {
    stop() {
      try {
        if (!ended) window.speechSynthesis.cancel();
      } catch {
        // nothing to stop
      }
      end();
    },
  };
}

/** Called each time the browser voice says a line (the "get a better voice" tip listens). */
const browserVoiceListeners = new Set<() => void>();
export function onBrowserVoice(fn: () => void): () => void {
  browserVoiceListeners.add(fn);
  return () => browserVoiceListeners.delete(fn);
}

// ── Speaking ──────────────────────────────────────────────────────────────────────────────────────────────────

function queueLine(o: {
  text: string;
  kind: SpeechKind;
  startMs: number;
  playCloud: ((ev: CloudEvents) => { stop(): void }) | null;
  onFallback?: () => void;
  /** The browser voice's gender when it stands in (a "Hear it" of the other voice); else the chosen one. */
  gender?: CoachVoiceGender;
}) {
  const c = cfg;
  if (!c || !o.text) return;
  let handle: { stop(): void } | null = null;
  queue.speak({
    kind: o.kind,
    maxMs: lineMaxMs(o.text) + o.startMs,
    start: (done) => {
      handle = cloudThenDevice(
        {
          playCloud: o.playCloud,
          speakDevice: (d) => speakDevice(o.text, c.lang, o.gender ?? genderOf(c), d),
          startMs: o.startMs,
          ...(o.onFallback ? { onFallback: o.onFallback } : {}),
        },
        done,
      );
    },
    stop: () => handle?.stop(),
  });
}

/** A workout cue: its recording (pack, library, a registered line) in the coach's voice, else the browser voice. */
export function playCue(s: Spoken) {
  const c = cfg;
  if (!c || c.mode === "off" || !s.text) return;
  if (c.mode === "device") return queueLine({ text: s.text, kind: "cue", startMs: 0, playCloud: null });
  if (s.pack || s.lib?.length) {
    const ids = s.pack ? [s.pack] : s.lib!;
    queueLine({
      text: s.text,
      kind: "cue",
      startMs: CUE_START_MS,
      playCloud: coachVoice(
        s.text,
        recorded(async () => {
          const m = await voiceSet(s.pack ? "pack" : "lib");
          const paths = ids.map((id) => m?.get(id));
          return paths.every(Boolean) ? (paths as string[]) : null;
        }, true),
        CUE_START_MS,
      ),
    });
    return;
  }
  queueLine({
    text: s.text,
    kind: "cue",
    startMs: LINE_START_MS,
    playCloud: coachVoice(
      s.text,
      recorded(async () => {
        const p = await textPath(s.text);
        return p ? [p] : null;
      }, true),
      LINE_START_MS,
    ),
  });
}

/**
 * Any coach line (the one way to speak besides cues and replies): its parts one after the other in the coach's voice
 * when every part has a recording, else the whole line stitched from the coach's clips, else its words by the browser
 * voice (a whole line in one voice, never mixed).
 * `onVoice` says which voice took it (the preview shows it).
 */
export function sayLine(sp: CoachSpeech, o: { kind?: SpeechKind; onVoice?: (v: "coach" | "device") => void } = {}) {
  const c = cfg;
  if (!c || c.mode === "off" || !sp.text) return;
  const parts = sp.parts?.length ? sp.parts : [sp.text];
  let told = false;
  const tell = (v: "coach" | "device") => {
    if (told) return;
    told = true;
    o.onVoice?.(v);
  };
  const cloud =
    c.mode === "device"
      ? null
      : coachVoice(
          sp.text,
          recorded(async () => {
            const paths = await Promise.all(parts.map((p) => textPath(p)));
            return paths.every(Boolean) ? (paths as string[]) : null;
          }, true),
          LINE_START_MS,
        );
  queueLine({
    text: sp.text,
    kind: o.kind ?? "cue",
    startMs: LINE_START_MS,
    playCloud: cloud ? (ev) => cloud({ ...ev, playing: () => (tell("coach"), ev.playing()) }) : null,
    onFallback: () => tell("device"),
  });
}

/** You → Coach voice: "Hear my coach" (the app's preview line in the voice this account hears). */
export function previewVoice(onVoice: (v: "coach" | "device") => void) {
  const c = cfg;
  if (!c) return;
  queue.bargeIn();
  sayLine({ text: PREVIEW_LINE[c.lang] }, { kind: "talk", onVoice });
}

/**
 * You → Coach voice and onboarding: "Hear it" for one of the two voices (woman, man), chosen or not yet. `path` is that
 * voice's recorded preview (GET /v1/voice/voices preview.url: free for everyone); through the one speech queue
 * (barge-in first), else the browser voice of that gender says the same words. Never kept on disk (only the chosen
 * voice's recordings are).
 */
export function previewVoiceOf(
  gender: CoachVoiceGender,
  path: string | null,
  onVoice: (v: "coach" | "device") => void,
  text?: string | null,
) {
  const c = cfg;
  if (!c) return;
  queue.bargeIn();
  const words = text?.trim() || PREVIEW_LINE[c.lang];
  let told = false;
  const tell = (v: "coach" | "device") => {
    if (told) return;
    told = true;
    onVoice(v);
  };
  const cloud = path
    ? playFirst(
        [
          {
            name: "recorded",
            async resolve() {
              const blob = await c.session.voiceAudio(path).catch(() => null);
              return blob ? [URL.createObjectURL(blob)] : null;
            },
          },
        ],
        elementPlayer,
      )
    : null;
  queueLine({
    text: words,
    kind: "talk",
    startMs: cloud ? LINE_START_MS : 0,
    playCloud: cloud ? (ev) => cloud({ ...ev, playing: () => (tell("coach"), ev.playing()) }) : null,
    onFallback: () => tell("device"),
    gender,
  });
}

/** How long a rep count waits for its recording (already fetched: it plays in a few ms) before the browser says it. */
export const QUICK_START_MS = 450;

/**
 * A short line that can't wait (a camera workout's rep count, the countdown), through the same queue (newest wins,
 * barge-in silences it): its recording when the app's fixed lines are loaded (prefetched by `warmCamera`), else the
 * stitched line, else the browser voice at once.
 */
export function playQuick(text: string) {
  const c = cfg;
  if (!c || c.mode === "off" || !text) return;
  const path = c.mode === "coach" ? appIndex?.get(text) : undefined;
  const cloud = c.mode === "coach" ? coachVoice(text, path ? recorded(async () => [path], true) : null, QUICK_START_MS) : null;
  queueLine({ text, kind: "cue", startMs: cloud ? QUICK_START_MS : 0, playCloud: cloud });
}

/** Ahead of a camera workout or teaching a move: the counts 1–30 and the countdown's recordings into Cache Storage. */
export async function warmCamera(): Promise<void> {
  const c = cfg;
  if (!c || c.mode !== "coach" || !online()) return;
  const app = await voiceSet("app");
  if (!app) return;
  for (let n = 1; n <= 30; n++) {
    const p = app.get(String(n));
    if (p) await clipUrl(p, true).catch(() => null);
  }
}

/**
 * A coach reply: its audio (Plus) when the API sent one and the conversation is still in the coach's voice, else the
 * browser voice for this reply and the rest of the conversation.
 */
export function speakReply(text: string, voice: { url: string; tag?: string | null } | null | undefined, conv: ConversationVoice) {
  const c = cfg;
  if (!c || c.mode === "off") return;
  const cloud = c.mode === "coach" && !!voice && conv.cloud && conv.accepts(voice.tag);
  queueLine({
    text,
    kind: "talk",
    startMs: cloud ? REPLY_START_MS : 0,
    playCloud: cloud ? playFirst([recorded(async () => [voice.url], false)], elementPlayer) : null,
    onFallback: () => conv.fellBack(),
  });
}

/** Stops the line speaking and everything waiting (a barge-in, the screen closing, the workout ending). */
export function hush() {
  queue.bargeIn();
  try {
    if (canSpeak()) window.speechSynthesis.cancel();
  } catch {
    // nothing to stop
  }
}

// ── Ahead of time ─────────────────────────────────────────────────────────────────────────────────────────────

let warmed = false;

/** Fetches the voice pack (and the first splits) into Cache Storage ahead of a workout, once per visit. */
export async function warmVoice(): Promise<void> {
  const c = cfg;
  if (!c || c.mode !== "coach") return;
  void warmStitch();
  if (warmed || !online()) return;
  warmed = true;
  const pack = await voiceSet("pack");
  for (const path of pack?.values() ?? []) await clipUrl(path, true);
  // The app's fixed lines: the list only (each recording is fetched the first time it's said, then kept).
  await voiceSet("app");
  await prefetchLines([...splitLines(1, null, c.imperial), ...splitLines(2, null, c.imperial)]);
  void pruneCache();
}

/** Fetches library lines about to be said (the next split) into Cache Storage. */
export async function prefetchLines(ids: readonly string[]): Promise<void> {
  const c = cfg;
  if (!c || c.mode !== "coach" || !online()) return;
  const lib = await voiceSet("lib");
  for (const id of ids) {
    const p = lib?.get(id);
    if (p) await clipUrl(p, true);
  }
}

// ── The stitched coach voice (ADR-0054): the full pack of clips for the app's language ──────────────────────────

/** Its own cache (the recordings' cache is pruned by count; this one holds one pack per language). */
export const STITCH_CACHE = "vvake-stitch-v1";

export type VoicePackState = "ready" | "loading" | "pending" | "off";

let stitch: {
  lang: Locale;
  gender: CoachVoiceGender;
  slot: CoachVoiceSlot;
  apiUrl: string;
  pack: Pack | null;
  loading: Promise<Pack | null> | null;
  triedAt: number;
} | null = null;
/** Stitched lines this visit: text → WAV object URL. */
const stitchedUrls = new Map<string, string>();
const STITCHED_MAX = 60;
const packListeners = new Set<() => void>();

function resetStitch(c: VoiceConfig) {
  stitch = { lang: c.lang, gender: genderOf(c), slot: slotOf(c), apiUrl: c.apiUrl, pack: null, loading: null, triedAt: 0 };
  for (const u of stitchedUrls.values()) URL.revokeObjectURL(u);
  stitchedUrls.clear();
  tellPack();
}

function tellPack() {
  for (const l of packListeners) l();
}

/** You → Voice coach: whether the coach's voice pack is in this browser (and listens for changes). */
export function voicePackState(): VoicePackState {
  if (!cfg || cfg.mode !== "coach" || !stitch) return "off";
  return stitch.pack ? "ready" : stitch.loading ? "loading" : "pending";
}
export function onVoicePack(fn: () => void): () => void {
  packListeners.add(fn);
  return () => packListeners.delete(fn);
}

const stitchLang = (l: Locale) => (l === "fr" ? "fr" : "en");
/** The kept pack's description: one per voice slot ("fr-man"); before ADR-0056 one per language ("fr"). */
export const metaKey = (apiUrl: string, slot: string) => `${apiUrl}/v1/voice/__stitch/${slot}.json`;

function packDeps(apiUrl: string, gender: CoachVoiceGender): PackDeps {
  const slot = (lang: string) => coachVoiceSlot(lang, gender);
  const open = async () => {
    try {
      return browser() && "caches" in window ? await caches.open(STITCH_CACHE) : null;
    } catch {
      return null;
    }
  };
  return {
    apiUrl,
    online,
    async info(lang) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8_000);
      try {
        const r = await fetch(`${apiUrl}/v1/voice/stitch?lang=${lang}&voice=${gender}`, { signal: ctl.signal });
        return r.ok ? ((await r.json()) as StitchInfo) : null;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    },
    async download(url) {
      try {
        const r = await fetch(url);
        return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
      } catch {
        return null;
      }
    },
    store: {
      async kept(lang) {
        const r = await (await open())?.match(metaKey(apiUrl, slot(lang)));
        return r ? ((await r.json()) as KeptPack) : null;
      },
      async bytes(url) {
        const r = await (await open())?.match(url);
        return r ? new Uint8Array(await r.arrayBuffer()) : null;
      },
      async keep(meta, bytes, old) {
        const cache = await open();
        if (!cache) return;
        await cache.put(meta.url, new Response(bytes as BlobPart, { headers: { "content-type": "application/octet-stream" } }));
        await cache.put(
          metaKey(apiUrl, slot(meta.lang)),
          new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }),
        );
        if (old && old.url !== meta.url) await cache.delete(old.url);
      },
      async forget(meta) {
        const cache = await open();
        await cache?.delete(meta.url);
        await cache?.delete(metaKey(apiUrl, slot(meta.lang)));
      },
    },
  };
}

/**
 * Loads the pack once per visit (Cache Storage first; the network only when the API has another version), ahead of a
 * workout and a few seconds after the app opens. A failed or not yet rendered pack is tried again after a while.
 */
export function warmStitch(): Promise<Pack | null> {
  const c = cfg;
  const s = stitch;
  if (!c || !s || c.mode !== "coach") return Promise.resolve(null);
  if (s.pack) return Promise.resolve(s.pack);
  if (s.loading) return s.loading;
  if (s.triedAt && Date.now() - s.triedAt < RETRY_MS) return Promise.resolve(null);
  s.triedAt = Date.now();
  const base = s.apiUrl.replace(/\/+$/, "");
  const p = loadPack(stitchLang(s.lang), packDeps(base, s.gender))
    .catch(() => null)
    .then((pack) => {
      // The new voice's pack is in: the other voice's packs (and the one kept before packs were per voice) go.
      if (pack) void dropOtherSlots(base, s.slot);
      if (stitch === s) {
        s.pack = pack;
        s.loading = null;
        tellPack();
      }
      return pack;
    });
  s.loading = p;
  tellPack();
  return p;
}

/** Forgets every kept pack but `keep`'s (another voice's, or a pack kept per language before ADR-0056). */
async function dropOtherSlots(apiUrl: string, keep: CoachVoiceSlot): Promise<void> {
  try {
    if (!browser() || !("caches" in window)) return;
    const cache = await caches.open(STITCH_CACHE);
    const keepGender = keep.split("-")[1];
    const others = [...COACH_VOICE_SLOTS.filter((x) => x.split("-")[1] !== keepGender), "en", "fr"];
    for (const slot of others) {
      const key = metaKey(apiUrl, slot);
      const r = await cache.match(key);
      if (!r) continue;
      const meta = (await r.json().catch(() => null)) as { url?: string } | null;
      if (meta?.url) await cache.delete(meta.url);
      await cache.delete(key);
    }
  } catch {
    // best effort: dropped next time
  }
}

/** The stitched source for a line, when the pack is loaded, in the recorded lines' voice and has every clip. */
function stitched(text: string): VoiceSource | null {
  const c = cfg;
  const s = stitch;
  if (!c || c.mode !== "coach" || !s) return null;
  const pack = s.pack;
  if (!pack) {
    void warmStitch();
    return null;
  }
  if (!sameVoice(pack, coachTag)) return null;
  const ids = stitchIds(pack, text);
  if (!ids) return null;
  return {
    name: "stitched",
    async resolve() {
      const hit = stitchedUrls.get(text);
      if (hit) return [hit];
      const wav = stitchedWav(pack, ids);
      if (!wav) return null;
      const url = URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" }));
      stitchedUrls.set(text, url);
      if (stitchedUrls.size > STITCHED_MAX) {
        const [oldest, u] = stitchedUrls.entries().next().value as [string, string];
        stitchedUrls.delete(oldest);
        URL.revokeObjectURL(u);
      }
      return [url];
    },
  };
}
