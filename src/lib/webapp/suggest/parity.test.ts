import { describe, expect, it } from "vitest";
import golden from "../fixtures/suggest-golden.json";
import {
  DEFAULT_SUGGEST_LEVEL,
  nextStepLimit,
  newerSuggestPrefs,
  suggestAllowed,
  suggestLevelOf,
  type SuggestionKind,
  type SuggestLevel,
} from "./suggest";
import { nextSuggestPrefs, parseSuggestPrefs } from "./prefs";

/**
 * The web holds back what the phone, the watches and the server hold back: the golden cases game-core writes for the
 * ports (VVFit packages/game-core/test/fixtures/suggest-golden.json, copied by scripts/sync-suggest-core.ts).
 */
describe("suggest parity with game-core", () => {
  it("allows the same kinds at every level", () => {
    const cases = golden.allowed as { kind: SuggestionKind; level: SuggestLevel; inWorkout: boolean; ok: boolean }[];
    expect(cases.length).toBeGreaterThan(20);
    for (const c of cases)
      expect(suggestAllowed(c.kind, c.level, { inWorkout: c.inWorkout }), `${c.kind} ${c.level} ${c.inWorkout}`).toBe(c.ok);
    for (const [level, n] of Object.entries(golden.limits)) expect(nextStepLimit(level as SuggestLevel)).toBe(n);
  });
});

describe("prefs.suggest on the web", () => {
  it("reads only a known level with a valid time", () => {
    expect(parseSuggestPrefs({ level: "quiet", at: "2026-10-28T10:00:00.000Z" })).toEqual({
      level: "quiet",
      at: "2026-10-28T10:00:00.000Z",
    });
    expect(parseSuggestPrefs({ level: "loud", at: "2026-10-28T10:00:00.000Z" })).toBeNull();
    expect(parseSuggestPrefs({ level: "quiet", at: "soon" })).toBeNull();
    expect(parseSuggestPrefs(undefined)).toBeNull();
    expect(suggestLevelOf(undefined)).toBe(DEFAULT_SUGGEST_LEVEL);
  });

  it("stamps a new choice after the previous one, so it wins", () => {
    const prev = { level: "guide" as const, at: "2026-10-28T10:00:00.000Z" };
    const next = nextSuggestPrefs(prev, "quiet", Date.parse("2026-10-28T09:00:00.000Z"));
    expect(next.level).toBe("quiet");
    expect(newerSuggestPrefs(prev, next)).toBe(next);
  });
});
