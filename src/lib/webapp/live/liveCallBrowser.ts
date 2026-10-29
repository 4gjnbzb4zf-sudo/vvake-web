/**
 * The browser's parts of a live call (liveCallClient.ts): the switch (GET /v1/health), the WebSocket, the microphone
 * and the coach's streamed voice. The phone has its own (apps/mobile lib/liveCallNative.ts).
 *
 * - Hearing: "cloud" speech to text (monorepo live-call.md §6): getUserMedia with the browser's echo cancellation, the
 *   sound resampled to 16 kHz PCM16 and sent in quarter-second frames; the server recognises it (ElevenLabs, no
 *   recording kept) and stops the coach when the athlete talks over it. The browser's own Web Speech isn't used: in
 *   Chrome it sends the sound to the browser maker, which our privacy pages don't cover.
 * - Playing: the coach's mp3 chunks are joined into a stretch and played as a blob (the web app's media-src allows
 *   blob:); `stop()` silences at once and says how much of the turn was heard. Fixed lines come from the API with the
 *   token; device-voice lines go through the browser's speech synthesis.
 */
import type { RewardsSession } from "@/lib/rewardsApi";
import { sayLiveDevice } from "@/lib/webapp/coachAudio";
import type { LivePlayer, LiveSocket, LiveSocketEvents, LiveStt, LiveSttEvents } from "./liveCallClient";

export interface LiveFlags {
  /** Coach calls: the live conversation after the opener. */
  call: boolean;
  /** Day one: "Talk it through with your coach". */
  onboarding: boolean;
}
export const LIVE_OFF: LiveFlags = { call: false, onboarding: false };

/** The flags from GET /v1/health (absent on an older API = off). Pure. */
export function liveFlagsFrom(h: unknown): LiveFlags {
  const f = (h && typeof h === "object" ? (h as { features?: Record<string, unknown> }).features : undefined) ?? {};
  return { call: f.liveCall === true, onboarding: f.onboardingCall === true };
}

let cached: { at: number; base: string; flags: LiveFlags } | null = null;
/** Asked once, kept 10 minutes; any failure = off (the survey cards, as before). */
export async function liveFlags(base: string): Promise<LiveFlags> {
  if (cached && cached.base === base && Date.now() - cached.at < 10 * 60_000) return cached.flags;
  let flags = LIVE_OFF;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${base}/v1/health`, { signal: ctl.signal });
    clearTimeout(timer);
    if (res.ok) flags = liveFlagsFrom(await res.json());
  } catch {
    flags = LIVE_OFF;
  }
  cached = { at: Date.now(), base, flags };
  return flags;
}

export function openLiveSocket(url: string, ev: LiveSocketEvents): LiveSocket {
  const ws = new WebSocket(url);
  ws.onopen = () => ev.open();
  ws.onmessage = (m) => ev.message(m.data);
  ws.onclose = () => ev.close();
  ws.onerror = () => undefined; // close follows
  return { send: (d) => ws.send(d), close: () => ws.close() };
}

/** The microphone can be asked for here (a secure page in a browser that has getUserMedia and Web Audio). */
export const canHear = () =>
  typeof window !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof (window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) === "function";

// ── Hearing (cloud) ───────────────────────────────────────────────────────────────────────────────────────────

/** Float samples at `from` Hz → 16 kHz PCM16 (averaging each step). Pure. */
export function toPcm16k(input: Float32Array, from: number): Int16Array {
  const ratio = from / 16000;
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j]!;
    const v = Math.max(-1, Math.min(1, b > a ? sum / (b - a) : 0));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function cloudStt(): LiveStt {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  let paused = false;
  let buf: Int16Array[] = [];
  let len = 0;
  return {
    async start(ev: LiveSttEvents) {
      if (!canHear()) return false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        return false;
      }
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        node = ctx.createScriptProcessor(4096, 1, 1);
        const rate = ctx.sampleRate;
        node.onaudioprocess = (e) => {
          if (paused) return;
          const pcm = toPcm16k(e.inputBuffer.getChannelData(0), rate);
          buf.push(pcm);
          len += pcm.length;
          // A quarter of a second a frame (4,000 samples).
          if (len >= 4000) {
            const all = new Int16Array(len);
            let at = 0;
            for (const p of buf) {
              all.set(p, at);
              at += p.length;
            }
            buf = [];
            len = 0;
            ev.audio?.(b64(new Uint8Array(all.buffer)));
          }
        };
        src.connect(node);
        // Some browsers only run the processor when it is connected; it writes silence.
        node.connect(ctx.destination);
        stream.getAudioTracks()[0]?.addEventListener("ended", () => ev.failed("ended"));
        return true;
      } catch {
        this.stop();
        return false;
      }
    },
    reset() {
      // The server decides where a turn ends.
    },
    pause() {
      paused = true;
      buf = [];
      len = 0;
    },
    resume() {
      paused = false;
    },
    stop() {
      paused = true;
      try {
        node?.disconnect();
      } catch {
        // gone
      }
      for (const t of stream?.getTracks() ?? []) t.stop();
      void ctx?.close().catch(() => undefined);
      node = null;
      ctx = null;
      stream = null;
    },
  };
}

// ── Playing ───────────────────────────────────────────────────────────────────────────────────────────────

type Item =
  | { kind: "blob"; turn: number; parts: Uint8Array[]; durMs: number }
  | { kind: "url"; turn: number; url: string; text: string }
  | { kind: "say"; turn: number; text: string };

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function blobPlayer(session: RewardsSession, lang: "en" | "fr"): LivePlayer {
  const queue: Item[] = [];
  let filling: { turn: number; parts: Uint8Array[]; durMs: number } | null = null;
  let el: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let playing: Item | null = null;
  let speaking = false;
  const heard = new Map<number, number>();
  let idle: (() => void) | null = null;

  const release = () => {
    if (el) {
      el.onended = null;
      el.onerror = null;
      el.pause();
      el = null;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  const done = () => {
    const it = playing;
    if (it?.kind === "blob") heard.set(it.turn, (heard.get(it.turn) ?? 0) + it.durMs);
    playing = null;
    release();
    next();
  };
  const playBlob = (b: Blob) => {
    objectUrl = URL.createObjectURL(b);
    const a = new Audio(objectUrl);
    el = a;
    a.onended = () => el === a && done();
    a.onerror = () => el === a && done();
    void a.play().catch(() => el === a && done());
  };
  const next = () => {
    if (playing) return;
    if (!queue.length && filling) {
      queue.push({ kind: "blob", ...filling });
      filling = null;
    }
    const it = queue.shift();
    if (!it) {
      if (!speaking) idle?.();
      return;
    }
    playing = it;
    if (it.kind === "blob") playBlob(new Blob(it.parts as BlobPart[], { type: "audio/mpeg" }));
    else if (it.kind === "url")
      void session.voiceAudio(it.url).then((b) => {
        if (playing !== it) return;
        if (b) playBlob(b);
        else sayNow(it);
      });
    else sayNow(it);
  };
  let voice: { stop(): void } | null = null;
  const sayNow = (it: Item & { text: string }) => {
    speaking = true;
    voice = sayLiveDevice(it.text, lang, () => {
      speaking = false;
      voice = null;
      if (playing === it) done();
    });
  };

  return {
    push(turn, _seq, format, data, durMs) {
      if (format !== "mp3") return;
      if (!filling || filling.turn !== turn) {
        if (filling) queue.push({ kind: "blob", ...filling });
        filling = { turn, parts: [], durMs: 0 };
      }
      try {
        filling.parts.push(unb64(data));
        filling.durMs += durMs;
      } catch {
        return;
      }
      if (!playing) next();
    },
    line(turn, text, url) {
      queue.push(url ? { kind: "url", turn, url, text } : { kind: "say", turn, text });
      next();
    },
    say(turn, text) {
      queue.push({ kind: "say", turn, text });
      next();
    },
    stop(turn) {
      let ms = turn === null ? 0 : (heard.get(turn) ?? 0);
      if (el && playing && playing.turn === turn) ms += Math.round((el.currentTime || 0) * 1000);
      queue.length = 0;
      filling = null;
      playing = null;
      release();
      if (speaking) {
        speaking = false;
        const v = voice;
        voice = null;
        v?.stop();
      }
      return ms;
    },
    busy: () => !!playing || queue.length > 0 || !!filling || speaking,
    onIdle(cb) {
      idle = cb;
    },
  };
}
