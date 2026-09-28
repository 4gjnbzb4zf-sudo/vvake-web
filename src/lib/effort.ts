/**
 * Effort from heart-rate zones. Mirrors ZONE_WEIGHTS in `packages/game-core/src/hr.ts`:
 * zone 5 weighs the same as zone 4, so pushing to the limit is never rewarded more.
 */
export const ZONE_WEIGHTS: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };

export type Zone = keyof typeof ZONE_WEIGHTS;

export function sessionEffort(minutes: number, zone: Zone): number {
  return Math.max(0, minutes) * ZONE_WEIGHTS[zone];
}
