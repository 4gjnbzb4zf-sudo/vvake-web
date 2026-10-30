/**
 * The two seasonWeek.ts types adaptiveProposals.ts imports (VVFit packages/game-core/src/seasonWeek.ts), as a subset:
 * the season session fields `loadEdits` reads and the two edits it makes ("change" minutes, "easier" week). The web
 * never applies season edits itself (the API does, POST /v1/season/edits); this only lets the copy type-check.
 * Hand-written (scripts/sync-adaptive-core.ts says why): widen it when a re-synced adaptiveProposals.ts needs more.
 */
export interface SeasonSession {
  id: string;
  date: string;
  sport: string;
  minutes: number;
  purpose: string;
  zone?: number;
  key?: boolean;
  locked?: boolean;
  skipped?: boolean;
}

export type SeasonEditDraft = { kind: "change"; session: string; minutes?: number } | { kind: "easier"; week: string };
