import { sports } from "@/lib/sports";

/**
 * game-core's `sportEntry` as tailor.ts uses it (a sport's GPS flag), read from this site's export of the same catalog
 * (src/data/sports.json, written by the monorepo). Custom sports aren't in it: no GPS, as in game-core.
 */
const byKey = new Map(sports.sports.map((s) => [s.key, s]));

export function sportEntry(key: string): { gps: boolean } | undefined {
  return byKey.get(key);
}
