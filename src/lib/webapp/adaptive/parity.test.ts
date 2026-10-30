import { describe, expect, it } from "vitest";
import golden from "../fixtures/adaptive-session-golden.json";
import {
  adaptiveCueLine,
  adaptiveStep,
  adaptiveSummary,
  classifySaid,
  newAdaptiveState,
  SAID_WORDS,
  sessionStructure,
  targetStatus,
  type AdaptiveInput,
  type SessionTiming,
  type StructureInput,
} from "./adaptiveSession";

/**
 * The browser adapts a planned session exactly as the phone and the watches do: game-core's golden structures,
 * timelines (every cue with its EN/FR line, the final summary), words heard and target statuses (VVFit
 * packages/game-core/test/fixtures/adaptive-session-golden.json, copied by scripts/sync-adaptive-core.ts), replayed the
 * way game-core's export runs them.
 */
interface Timeline {
  name: string;
  structure: StructureInput;
  timing: SessionTiming;
  rpeChecks: boolean;
  inputs: AdaptiveInput[];
  cues: unknown[];
  summary: unknown;
  durS: number[];
  i: number;
  done: boolean;
}

describe("adaptive session parity with game-core", () => {
  it("builds the golden structures", () => {
    for (const s of golden.structures as unknown as { input: StructureInput; out: unknown }[])
      expect(sessionStructure(s.input), JSON.stringify(s.input)).toEqual(s.out);
  });

  it("replays the golden timelines (cues, lines, summary)", () => {
    const tls = golden.timelines as unknown as Timeline[];
    expect(tls.length).toBeGreaterThan(5);
    for (const tl of tls) {
      const st = sessionStructure(tl.structure)!;
      let s = newAdaptiveState(st);
      const cues: unknown[] = [];
      for (const x of tl.inputs) {
        const r = adaptiveStep(st, s, x, { timing: tl.timing, rpeChecks: tl.rpeChecks });
        s = r.state;
        for (const c of r.cues) cues.push({ ...c, en: adaptiveCueLine(c, "en"), fr: adaptiveCueLine(c, "fr") });
        if (s.done) break;
      }
      const last = tl.inputs[tl.inputs.length - 1]!.t;
      expect(cues, tl.name).toEqual(tl.cues);
      expect(adaptiveSummary(st, s, last, tl.timing), tl.name).toEqual(tl.summary);
      expect(s.durS, tl.name).toEqual(tl.durS);
      expect(s.i, tl.name).toBe(tl.i);
      expect(s.done, tl.name).toBe(tl.done);
    }
  });

  it("hears the same words", () => {
    for (const w of golden.said as { text: string; said: string | null }[]) expect(classifySaid(w.text), w.text).toBe(w.said);
    expect(SAID_WORDS).toEqual(golden.saidWords);
  });

  it("reads the target status the same way", () => {
    for (const c of golden.status as unknown as { seg: never; x: { zone?: number; paceSPerKm?: number }; rpe?: number; out: string }[])
      expect(targetStatus(c.seg, c.x, c.rpe ?? 0)).toBe(c.out);
  });
});
