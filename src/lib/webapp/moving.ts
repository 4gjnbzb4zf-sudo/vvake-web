/**
 * Moving time (the repo's packages/game-core/src/moving.ts, the part the web needs; build 56). `activeS` is the
 * moving time (the clock stops while paused): the time shown big, the pace, the splits. The time in all
 * (`endedAt − startedAt`, pauses included) is shown apart, never used for a pace. Pure.
 */

export interface SessionTimes {
  movingS: number;
  elapsedS: number;
  pausedS: number;
}

/** Shorter pauses than this aren't worth a line on a summary. */
export const SHOW_PAUSED_FROM_S = 30;

export function sessionTimes(s: { startedAt: string | number; endedAt: string | number; activeS: number }): SessionTimes {
  const ms = (x: string | number) => (typeof x === "number" ? x : Date.parse(x));
  const len = (ms(s.endedAt) - ms(s.startedAt)) / 1000;
  const elapsedS = Math.max(0, Math.round(Number.isFinite(len) ? len : 0));
  const movingS = Math.max(0, Math.min(Math.round(s.activeS), elapsedS || Math.round(s.activeS)));
  const all = Math.max(elapsedS, movingS);
  return { movingS, elapsedS: all, pausedS: all - movingS };
}

export const showsPaused = (t: SessionTimes) => t.pausedS >= SHOW_PAUSED_FROM_S;
