import { z } from "zod";

/** GET {liveEndpoint}/live: city-level totals only, already rounded and k-anonymized server-side. */
export const liveSnapshotSchema = z.object({
  updatedAt: z.string(),
  cities: z.array(z.object({ slug: z.string(), active: z.number().int().nonnegative() })),
});
export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;

/** Privacy floor (k-anonymity): a city appears only with at least this many movers, rounded down to 10s. */
export const MIN_VISIBLE_MOVERS = 10;

export function visibleCount(active: number): number {
  return active < MIN_VISIBLE_MOVERS ? 0 : Math.floor(active / 10) * 10;
}

/**
 * Demo activity for the showcase: scales with metro size and the city's local time of day
 * (quiet at night, peaks early morning and evening). Deterministic for a given minute and seed.
 */
export function demoActivity(metroPopulation: number, lon: number, nowMs: number, seed: number): number {
  const localHour = (((nowMs / 3_600_000 + lon / 15) % 24) + 24) % 24;
  const curve = Math.max(0.05, 0.55 * Math.exp(-((localHour - 7.5) ** 2) / 3) + 0.75 * Math.exp(-((localHour - 18.5) ** 2) / 4) + 0.15);
  const wobble = 0.8 + 0.4 * Math.abs(Math.sin(seed * 12.9898 + Math.floor(nowMs / 3000) * 0.37));
  return Math.round((metroPopulation / 2500) * curve * wobble);
}
