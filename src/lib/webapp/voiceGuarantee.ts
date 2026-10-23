import { ApiError } from "@/lib/rewardsApi";
import type { VoiceMode } from "./voicePick";

/**
 * The coach-voice guarantee (founder, 2026-10-23): for VVake Coach Plus and Premium accounts (early testers included),
 * every coach line in the web app is the coach's own ElevenLabs voice (the one they chose), never the browser's speech
 * synthesis, except when no coach audio can come: offline, or the API out of quota (429) or failing (5xx), and nothing
 * recorded, stitched or kept in this browser. Free accounts keep the old rule (the browser voice stands in whenever the
 * recording doesn't come in time). Pure (voiceGuarantee.test.ts); coachAudio.ts applies it.
 */

/** Where a line's audio came from (the source log). "skipped": no coach audio and the browser voice not allowed. */
export type LineSource = "recorded" | "synth" | "stitched" | "device" | "skipped";

/**
 * Why the coach's voice didn't say a line: "offline", "quota" (429, or Plus got no audio for a line it may record),
 * "server" (5xx), "no-audio" (nothing recorded for it, a free account), "slow" (it didn't start in time), "device"
 * (the account chose the device's voice), "unknown".
 */
export type VoiceReason = "offline" | "quota" | "server" | "no-audio" | "slow" | "device" | "unknown";

/** For Plus / Premium the browser voice stands in only for these. */
const PLUS_FALLBACK: ReadonlySet<VoiceReason> = new Set(["offline", "quota", "server"]);

/** May the browser voice say a line instead of the coach's voice? Always for free accounts; Plus only offline/quota/5xx. */
export function deviceAllowed(plus: boolean, reason: VoiceReason): boolean {
  return !plus || PLUS_FALLBACK.has(reason);
}

/** The voice this browser speaks in: Plus / Premium always the coach's (a "device voice" choice is ignored). */
export function guaranteedMode(voiceOn: boolean, accountVoice: string | null | undefined, plus: boolean): VoiceMode {
  if (!voiceOn) return "off";
  if (plus) return "coach";
  return accountVoice === "device" ? "device" : "coach";
}

/** What a failed voice request says about the network and the API. */
export function failureReason(e: unknown, online: boolean): VoiceReason {
  if (!online) return "offline";
  if (e instanceof ApiError) {
    if (e.status === 429) return "quota";
    if (e.status >= 500) return "server";
    if (e.status === 0) return "offline";
    return "unknown";
  }
  // fetch's TypeError: the network is down (or the API unreachable).
  if (e instanceof TypeError) return "offline";
  return "unknown";
}

/** How long an API failure counts as the reason for later lines (then the API is tried again as healthy). */
export const FAILURE_TTL_MS = 2 * 60_000;

/** The reason now: offline first, else the last API failure while it's recent, else `fallback`. */
export function currentReason(
  online: boolean,
  last: { reason: VoiceReason; at: number } | null,
  now: number,
  fallback: VoiceReason = "no-audio",
): VoiceReason {
  if (!online) return "offline";
  if (last && now - last.at < FAILURE_TTL_MS) return last.reason;
  return fallback;
}

/**
 * A long line (a coach reply) cut into parts of at most `max` characters at sentence ends (else at a space), so each
 * fits POST /v1/voice/lines. Empty parts are dropped.
 */
export function lineChunks(text: string, max = 200): string[] {
  const out: string[] = [];
  const sentences =
    text
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.!?…]+[.!?…]*\s*/g) ?? [];
  let cur = "";
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  for (const raw of sentences) {
    let s = raw;
    while (s.length > max) {
      const cut = s.lastIndexOf(" ", max);
      const at = cut > 0 ? cut : max;
      push();
      out.push(s.slice(0, at).trim());
      s = s.slice(at);
    }
    if ((cur + s).trim().length > max) push();
    cur += s;
  }
  push();
  return out.filter(Boolean);
}

// ── The source log: which voice said each line, and why the browser voice did ──────────────────────────────────

export interface SourceEntry {
  at: number;
  source: LineSource;
  reason?: VoiceReason;
}

export const SOURCE_LOG_KEY = "vvake-voice-sources-v1";
const LOG_MAX = 200;

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** The last lines' sources (memory, and this browser's storage when there is one: the counts survive a reload). */
export function createSourceLog(store: KeyValueStore | null = null, max = LOG_MAX) {
  let entries: SourceEntry[] = [];
  try {
    const raw = store?.getItem(SOURCE_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) entries = (parsed as SourceEntry[]).filter((e) => e && typeof e.source === "string").slice(-max);
  } catch {
    entries = [];
  }
  const listeners = new Set<() => void>();
  let snapshot: Record<LineSource, number> | null = null;
  return {
    note(source: LineSource, reason?: VoiceReason, at = Date.now()) {
      entries.push(reason ? { at, source, reason } : { at, source });
      if (entries.length > max) entries = entries.slice(-max);
      snapshot = null;
      try {
        store?.setItem(SOURCE_LOG_KEY, JSON.stringify(entries));
      } catch {
        // storage full or blocked: memory only
      }
      for (const l of listeners) l();
    },
    /** Lines by source over the log (the You tab's voice section). The same object until the log changes. */
    counts(): Record<LineSource, number> {
      if (snapshot) return snapshot;
      const c: Record<LineSource, number> = { recorded: 0, synth: 0, stitched: 0, device: 0, skipped: 0 };
      for (const e of entries) if (e.source in c) c[e.source]++;
      snapshot = c;
      return c;
    },
    /** The newest line the browser voice said (or that was skipped), with its reason. */
    lastFallback(): SourceEntry | null {
      for (let i = entries.length - 1; i >= 0; i--)
        if (entries[i]!.source === "device" || entries[i]!.source === "skipped") return entries[i]!;
      return null;
    },
    entries: () => entries.slice(),
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
export type SourceLog = ReturnType<typeof createSourceLog>;
