import { realTimers, type CloudEvents, type Timers } from "./speechQueue";

/**
 * Where a coach line's audio comes from, in order (pure: lineRoute.test.ts), the cloud half of `cloudThenDevice`:
 *
 * 1. the recording (the voice pack, the cheer library, the app's fixed lines, a line registered with the API),
 * 2. the stitched line (VVFit ADR-0054: the coach's own clips joined on this device, no network),
 * 3. else `failed()`: the browser voice says it (`cloudThenDevice`).
 *
 * A source that has no audio, fails before it plays, or hasn't started within its `budgetMs` hands over to the next
 * one, so a slow network never keeps the stitched line from starting in time. One player: a source that loses is
 * stopped before the next one plays (never two voices).
 */
export interface VoiceSource {
  name: "recorded" | "stitched";
  /** The audio to play, in order (object URLs), or null when this source has none for the line. */
  resolve(): Promise<string[] | null>;
  /** The most this source may take to start playing (ms) before the next one plays instead. */
  budgetMs?: number;
}

export interface LinePlayer {
  play(urls: string[], ev: CloudEvents): { stop(): void };
}

export function playFirst(
  sources: readonly VoiceSource[],
  player: LinePlayer,
  o: { timers?: Timers; onSource?: (name: VoiceSource["name"]) => void } = {},
): ((ev: CloudEvents) => { stop(): void }) | null {
  if (!sources.length) return null;
  const timers = o.timers ?? realTimers;
  return (ev) => {
    let stopped = false;
    let step = -1;
    let current: { stop(): void } | null = null;
    let timer: unknown = null;
    let started = false;

    const next = () => {
      if (stopped || started) return;
      timers.clear(timer);
      current?.stop();
      current = null;
      step++;
      const src = sources[step];
      if (!src) return ev.failed();
      const mine = step;
      const live = () => !stopped && !started && step === mine;
      if (src.budgetMs !== undefined && step < sources.length - 1)
        timer = timers.set(() => {
          if (live()) next();
        }, src.budgetMs);
      void src
        .resolve()
        .catch(() => null)
        .then((urls) => {
          if (!live()) return;
          if (!urls?.length) return next();
          current = player.play(urls, {
            playing: () => {
              if (stopped || step !== mine) return;
              if (!started) {
                started = true;
                timers.clear(timer);
                o.onSource?.(src.name);
              }
              ev.playing();
            },
            ended: () => {
              if (!stopped && step === mine) ev.ended();
            },
            failed: () => {
              if (stopped || step !== mine) return;
              if (started) ev.failed();
              else next();
            },
          });
        });
    };
    next();
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        timers.clear(timer);
        current?.stop();
      },
    };
  };
}

/** How long the recording may take to start when a stitched line can play instead (it starts at once: it's local). */
export const recordedBudget = (startMs: number) => Math.max(300, startMs - 600);
