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

/**
 * The coach's voice in the browser (vvake.com/<lang>/app), the phone's voice (monorepo apps/mobile/src/lib/voice.ts):
 *
 * - workout cues: the recorded voice-pack and cheer-library lines (`GET /v1/voice/pack`, `/v1/voice/library`, the same
 *   recordings for every account), fetched with the session's token and kept in Cache Storage (`vvake-voice-v1`, the
 *   pack is fetched ahead when a workout screen opens) so a cue plays at once, offline included;
 * - lines with exact numbers ("10 minutes in, zone 2"): registered with `POST /v1/voice/lines` (Plus records them
 *   within its daily quota; anyone gets a line once it is recorded), else the browser voice;
 * - coach replies: the reply's own audio when the API gave one (Plus), kept in memory only, never on disk;
 * - one speech queue (speechQueue.ts): one line at a time, the newest cue wins, barge-in silences all; the browser
 *   voice (the best installed one for the language: voicePick.ts) only when the recording doesn't come in time, and
 *   then never both;
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
}

let cfg: VoiceConfig | null = null;
const queue = createSpeechQueue();

/** The account, language, units and voice this page speaks with (AppContext keeps it current). */
export function configureVoice(c: VoiceConfig) {
  const changed = !cfg || cfg.session !== c.session || cfg.lang !== c.lang || cfg.imperial !== c.imperial;
  cfg = c;
  if (changed) {
    sets.clear();
    lineUrls.clear();
    warmed = false;
  }
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

/** Audio already in memory this visit: path → object URL. */
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
  const hit = mem.get(path);
  if (hit) return hit;
  const c = cfg;
  if (!c) return null;
  const key = `${c.apiUrl}${path}`;
  const cache = keep ? await voiceCache() : null;
  try {
    const r = await cache?.match(key);
    if (r) return remember(path, await r.blob());
  } catch {
    // unreadable entry: fetched again
  }
  const blob = await c.session.voiceAudio(path);
  if (!blob) return null;
  if (cache) void cache.put(key, new Response(blob, { headers: { "content-type": blob.type || "audio/mpeg" } })).catch(() => undefined);
  return remember(path, blob);
}

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

type SetKind = "pack" | "lib";
const sets = new Map<string, Promise<Map<string, string> | null>>();

function voiceSet(kind: SetKind): Promise<Map<string, string> | null> {
  const c = cfg;
  if (!c) return Promise.resolve(null);
  const name = `${kind}-${c.lang}-${kind === "lib" && c.imperial ? "imperial" : "metric"}`;
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
  const toMap = (items: { id: string; url?: string | null }[]) => new Map(items.filter((i) => i.url).map((i) => [i.id, i.url!] as const));
  try {
    const set = kind === "pack" ? await c.api.voicePack(c.lang) : await c.api.voiceLibrary(c.lang, c.imperial);
    if (set.voice === "device") return null;
    const items = set.items.map((i) => ({ id: i.id, url: i.url ?? null }));
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

/** Lines with numbers registered this visit: text → audio path (or null: the browser voice says it). */
const lineUrls = new Map<string, string | null>();

async function linePath(text: string): Promise<string | null> {
  const c = cfg;
  if (!c) return null;
  if (lineUrls.has(text)) return lineUrls.get(text)!;
  try {
    const r = await c.api.voiceLines([text.slice(0, 200)], c.lang);
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

/** Plays the paths `resolve` finds, in order, on the one element: the cloud half of `cloudThenDevice`. */
function playPaths(resolve: () => Promise<string[] | null>, keep: boolean) {
  return (ev: CloudEvents) => {
    const my = ++gen;
    let stopped = false;
    const mine = () => !stopped && gen === my;
    void (async () => {
      const paths = await resolve().catch(() => null);
      if (!mine()) return;
      if (!paths?.length) return ev.failed();
      const urls: string[] = [];
      for (const p of paths) {
        const u = await clipUrl(p, keep).catch(() => null);
        if (!mine()) return;
        if (!u) return ev.failed();
        urls.push(u);
      }
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
    })();
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
  };
}

// ── The browser voice (the fallback) ──────────────────────────────────────────────────────────────────────────

export const canSpeak = () => browser() && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

function speakDevice(text: string, lang: Locale, done: () => void): { stop(): void } {
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
  try {
    const synth = window.speechSynthesis;
    // The queue has one line at a time: anything still in the browser's own queue is stale.
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale(lang);
    const v = bestBrowserVoice(synth.getVoices(), locale(lang), online());
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

// ── Speaking ──────────────────────────────────────────────────────────────────────────────────────────────────

function queueLine(o: {
  text: string;
  kind: SpeechKind;
  startMs: number;
  playCloud: ((ev: CloudEvents) => { stop(): void }) | null;
  onFallback?: () => void;
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
          speakDevice: (d) => speakDevice(o.text, c.lang, d),
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
      playCloud: playPaths(async () => {
        const m = await voiceSet(s.pack ? "pack" : "lib");
        const paths = ids.map((id) => m?.get(id));
        return paths.every(Boolean) ? (paths as string[]) : null;
      }, true),
    });
    return;
  }
  queueLine({
    text: s.text,
    kind: "cue",
    startMs: LINE_START_MS,
    playCloud: playPaths(async () => {
      const p = await linePath(s.text);
      return p ? [p] : null;
    }, true),
  });
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
    playCloud: cloud ? playPaths(async () => [voice.url], false) : null,
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
  if (!c || c.mode !== "coach" || warmed || !online()) return;
  warmed = true;
  const pack = await voiceSet("pack");
  for (const path of pack?.values() ?? []) await clipUrl(path, true);
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
