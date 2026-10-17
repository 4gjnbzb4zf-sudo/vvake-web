/**
 * One coach voice in the browser, the phone's rules (monorepo apps/mobile/src/lib/speechQueue.ts, pure: tested in
 * speechQueue.test.ts):
 *
 * - one line at a time: conversation lines ("talk", a coach reply) first in first out and never cut by a cue; the
 *   newest workout cue replaces an older one waiting or speaking (its numbers moved on); the user talking or a screen
 *   closing (barge-in) silences everything at once;
 * - `cloudThenDevice`: each line in the coach's recorded voice, or, if it doesn't start in time (or fails), the
 *   browser's voice saying the same words, never both: once the browser voice has the line, cloud audio that starts
 *   late is stopped the moment it reports playing;
 * - `createConversationVoice`: inside a coach conversation the voice stays the same (the coach's, until a line can't
 *   come, then the browser's for the rest of it; audio in another voice is never played next to it).
 */
export type SpeechKind = "talk" | "cue";
/** Why a line was never spoken (or cut): the user talked (or the screen closed), a newer cue replaced it. */
export type DropReason = "barge" | "replaced";

export interface SpeechLine {
  kind: SpeechKind;
  /** Starts it; `done` once it is over (finished or failed). */
  start(done: () => void): void;
  /** Silences it now (it may still call `done`, which is then ignored). */
  stop(): void;
  /** Never spoken, or cut (`start` may not have run). */
  dropped?(why: DropReason): void;
  /** The longest it may take (ms): a line that never reports its end frees the queue after this. */
  maxMs: number;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** About how long a line takes to say (ms), with room for a slow start: the queue's guard. */
export const lineMaxMs = (text: string) => Math.max(8_000, Math.round(text.length * 90) + 12_000);

export function createSpeechQueue(timers: Timers = realTimers) {
  let active: { line: SpeechLine; id: number; guard: unknown } | null = null;
  let pending: SpeechLine[] = [];
  let seq = 0;

  const drop = (l: SpeechLine, why: DropReason) => {
    try {
      l.dropped?.(why);
    } catch {
      // a line's own cleanup failing never blocks the queue
    }
  };
  const finish = (id: number) => {
    if (!active || active.id !== id) return;
    timers.clear(active.guard);
    active = null;
    next();
  };
  const begin = (l: SpeechLine) => {
    const id = ++seq;
    const guard = timers.set(() => {
      if (active?.id !== id) return;
      l.stop();
      finish(id);
    }, l.maxMs);
    active = { line: l, id, guard };
    let ended = false;
    try {
      l.start(() => {
        if (ended) return;
        ended = true;
        finish(id);
      });
    } catch {
      finish(id);
    }
  };
  function next() {
    while (!active && pending.length) begin(pending.shift()!);
  }
  const cut = (why: DropReason) => {
    const a = active;
    if (!a) return;
    active = null;
    timers.clear(a.guard);
    try {
      a.line.stop();
    } finally {
      drop(a.line, why);
    }
  };

  return {
    /** Speaks `line` now or after the lines before it. */
    speak(line: SpeechLine): "started" | "queued" {
      if (line.kind === "cue") {
        // Newest cue wins: an older one waiting is stale, one speaking is cut; a conversation line is never cut by a
        // cue (the cue waits behind it).
        pending = pending.filter((p) => {
          if (p.kind !== "cue") return true;
          drop(p, "replaced");
          return false;
        });
        if (active?.line.kind === "cue" && !pending.length) cut("replaced");
      }
      if (!active && !pending.length) {
        begin(line);
        return "started";
      }
      pending.push(line);
      next();
      return active?.line === line ? "started" : "queued";
    },
    /** The user talks (or a screen closes): the line speaking stops and nothing waiting is said. */
    bargeIn(): void {
      const waiting = pending;
      pending = [];
      cut("barge");
      for (const l of waiting) drop(l, "barge");
    },
    get speaking(): boolean {
      return !!active;
    },
    get waiting(): number {
      return pending.length;
    },
  };
}

export type SpeechQueue = ReturnType<typeof createSpeechQueue>;

// ---- one line: the coach's voice, or the browser's, never both --------------------------------------------------

export interface CloudEvents {
  /** The audio is playing. */
  playing(): void;
  /** It played to its end. */
  ended(): void;
  /** It can't play (offline, no audio for this line, a load or autoplay error). */
  failed(): void;
}

/**
 * One line in the coach's voice (`playCloud`, which fetches and plays), or, if it doesn't start within `startMs` (or
 * fails first), the browser voice saying the same words: never both. Once the browser voice has the line, cloud audio
 * that starts late is stopped the moment it reports playing. `playCloud` null: straight to the browser voice.
 */
export function cloudThenDevice(
  o: {
    playCloud: ((ev: CloudEvents) => { stop(): void } | null) | null;
    speakDevice: (done: () => void) => { stop(): void };
    startMs: number;
    timers?: Timers;
    /** The browser voice took the line. */
    onFallback?: () => void;
  },
  done: () => void,
): { stop(): void } {
  const timers = o.timers ?? realTimers;
  let phase: "cloud" | "device" | "over" = "cloud";
  let started = false;
  let cloud: { stop(): void } | null = null;
  let device: { stop(): void } | null = null;
  let timer: unknown = null;
  const over = () => {
    if (phase === "over") return;
    phase = "over";
    timers.clear(timer);
    done();
  };
  const fallback = () => {
    if (phase !== "cloud") return;
    phase = "device";
    timers.clear(timer);
    cloud?.stop();
    o.onFallback?.();
    device = o.speakDevice(() => {
      if (phase === "device") over();
    });
  };
  if (!o.playCloud) {
    fallback();
  } else {
    timer = timers.set(() => {
      if (!started) fallback();
    }, o.startMs);
    cloud = o.playCloud({
      playing: () => {
        if (phase === "cloud") {
          started = true;
          timers.clear(timer);
        } else {
          // Late: the browser voice already has this line (or it was stopped). Never two voices.
          cloud?.stop();
        }
      },
      ended: () => {
        if (phase === "cloud") over();
      },
      failed: () => {
        if (phase !== "cloud") return;
        if (started) over();
        else fallback();
      },
    });
    if (!cloud) fallback();
  }
  return {
    stop() {
      phase = "over";
      timers.clear(timer);
      cloud?.stop();
      device?.stop();
    },
  };
}

// ---- one voice through a coach conversation --------------------------------------------------------------------

/**
 * The voice of the coach conversation on this page: the coach's (cloud) voice until a reply can't come, then the
 * browser voice for the rest of it (never back and forth). `tag` is the voice the audio is in (the API's voiceTag): the
 * first one heard becomes the conversation's, audio in another voice is never played in it.
 */
export function createConversationVoice() {
  let state: { cloud: boolean; tag?: string } | null = null;
  return {
    /** A conversation starts (`cloud`: the coach's voice is chosen). A second call keeps the one in progress. */
    begin(cloud: boolean): void {
      if (!state) state = { cloud };
    },
    end(): void {
      state = null;
    },
    /** The next reply tries the coach's voice. */
    get cloud(): boolean {
      return state ? state.cloud : true;
    },
    /** A reply didn't come in the coach's voice: the browser voice says the rest of this conversation. */
    fellBack(): void {
      if (state) state.cloud = false;
    },
    /** Audio in voice `tag` may play in this conversation (the first tag seen becomes its own). */
    accepts(tag: string | undefined | null): boolean {
      if (!state || !tag) return true;
      if (!state.tag) {
        state.tag = tag;
        return true;
      }
      return state.tag === tag;
    },
  };
}

export type ConversationVoice = ReturnType<typeof createConversationVoice>;

/** How long a coach reply may take to start in the coach's voice (it is synthesized on its first play). */
export const REPLY_START_MS = 9_000;
/** A recorded cue (cached, or a small download) and a cue line registered with the API. */
export const CUE_START_MS = 2_500;
export const LINE_START_MS = 3_000;
