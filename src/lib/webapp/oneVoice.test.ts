import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { flowSpeech, PREVIEW_LINE } from "./appVoice";

/**
 * One coach voice (voice-one): every line the web app says goes through coachAudio.ts (one speech queue, the coach's
 * recorded voice first, the browser voice only as its fallback). A new screen calling the browser voice itself would
 * be a second voice talking over the first.
 */
const ROOT = join(process.cwd(), "src");
/** The only files allowed to drive speechSynthesis: the web app's one queue, and the marketing page's demo (no account,
 * so no recorded voice: it never runs inside the web app). */
const ALLOWED = new Set(["lib/webapp/coachAudio.ts", "components/sections/Coach.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("one voice in the web app", () => {
  it("no file but the speech queue calls the browser voice directly", () => {
    const offenders = files(ROOT)
      .map((p) => relative(ROOT, p).split("\\").join("/"))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => /speechSynthesis\s*\.\s*speak\s*\(|new\s+SpeechSynthesisUtterance\b/.test(readFileSync(join(ROOT, rel), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the web app's screens never import the device voice helpers' internals", () => {
    const leaks = files(join(ROOT, "components", "webapp")).filter((p) => /speechSynthesis/.test(readFileSync(p, "utf8")));
    expect(leaks.map((p) => relative(ROOT, p))).toEqual([]);
  });

  it("camera lines split into the recorded parts (game-core flowSpeech's words)", () => {
    expect(flowSpeech({ type: "demo", move: "squat", loop: 1, target: { move: "squat", reps: 15, zone: 3 } } as never, "en")).toEqual({
      // The exact variation's setup, a fixed part of its own (camera v3, 2026-10-27).
      text: "Squat. Feet shoulder-width, toes slightly out, arms forward for balance. 15 reps. Zone 3.",
      parts: ["Squat.", "Feet shoulder-width, toes slightly out, arms forward for balance.", "15 reps.", "Zone 3."],
    });
    // "Round 2 of 2: same moves again." when a sequence repeats.
    expect(flowSpeech({ type: "round", n: 2, of: 2 }, "en")).toEqual({ text: "Round 2 of 2: same moves again." });
    expect(flowSpeech({ type: "askDone", move: "squat", done: 4 }, "fr")?.text).toBe("Série terminée ? Dis « série finie », ou continue.");
    expect(flowSpeech({ type: "demo", move: "squat", loop: 2, target: null } as never, "en")).toBeNull();
    expect(flowSpeech({ type: "rest", untilMs: 0, restS: 60, next: { move: "squat" } } as never, "fr")).toEqual({
      text: "Repos 60 secondes. Ensuite : Squat.",
      parts: ["Repos 60 secondes.", "Ensuite : Squat."],
    });
    // A new move counted from one angle: its camera angle said as a fixed part of its own (the plank at a diagonal, 2026-10-27).
    const plank = flowSpeech({ type: "rest", untilMs: 0, restS: 30, next: { move: "plank" }, newMove: true } as never, "en");
    expect(plank?.parts).toEqual(["Rest 30 seconds.", "Next: Plank.", "Turn diagonal or sideways to the phone so I can see you."]);
    expect(plank?.text).toBe("Rest 30 seconds. Next: Plank. Turn diagonal or sideways to the phone so I can see you.");
    expect(flowSpeech({ type: "done" }, "fr")).toEqual({ text: "Séance terminée. Bravo !" });
    expect(PREVIEW_LINE.fr).toMatch(/coach/);
  });
});
