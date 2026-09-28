/**
 * City unlock and early tiers.
 * Mirrors `packages/game-core/src/launch.ts` in the private monorepo (ADR-0007).
 * Keep both in sync; `unlock.test.ts` pins the shared reference values.
 */
export const UNLOCK_RATE = 0.0005;
export const UNLOCK_MIN = 300;
export const UNLOCK_MAX = 5_000;
export const UNLOCK_STEP = 50;

export function cityUnlockThreshold(metroPopulation: number): number {
  const raw = Math.max(0, metroPopulation) * UNLOCK_RATE;
  const stepped = Math.round(raw / UNLOCK_STEP) * UNLOCK_STEP;
  return Math.min(UNLOCK_MAX, Math.max(UNLOCK_MIN, stepped));
}

export interface UnlockProgress {
  fraction: number;
  remaining: number;
  unlocked: boolean;
}

export function unlockProgress(signups: number, threshold: number): UnlockProgress {
  const n = Math.max(0, signups);
  return { fraction: Math.min(1, n / threshold), remaining: Math.max(0, threshold - n), unlocked: n >= threshold };
}

export type EarlyTier = "founder" | "pioneer" | "early";

export const FOUNDERS_PER_CITY = 100;
export const PIONEERS_PER_CITY = 1_000;

export function earlyTier(joinRank: number): EarlyTier | null {
  if (!Number.isInteger(joinRank) || joinRank < 1) return null;
  if (joinRank <= FOUNDERS_PER_CITY) return "founder";
  if (joinRank <= PIONEERS_PER_CITY) return "pioneer";
  return "early";
}
