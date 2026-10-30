// Cut from VVFit packages/game-core/src/feasibility.ts (8e89c1f3 2026-10-22) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.
import { EVENT_PRESETS, type EventKind } from "../living/seasonGoals";

/** The ladder down from an event (marathon → half → 10K → 5K). */
export function eventLadder(kind: EventKind): EventKind[] {
  const out: EventKind[] = [];
  let k: EventKind | undefined = EVENT_PRESETS[kind].shorter;
  while (k) {
    out.push(k);
    k = EVENT_PRESETS[k].shorter;
  }
  return out;
}
