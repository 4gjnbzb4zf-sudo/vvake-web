import { describe, expect, it } from "vitest";
import fixtures from "../fixtures/camera-fixtures.json";
import { cameraMove } from "./cameraMoves";
import { framing, JOINTS, type Joint, type PoseFrame } from "./cameraPose";
import { HoldTimer, RepCounter } from "./cameraReps";
import { CameraWorkoutEngine } from "./cameraSession";
import { seededRandom } from "./cameraLiveness";
import { flatFromLandmarks, frameFromLandmarks, MP_INDEX, type Landmark } from "./webPose";

/**
 * Web and phone count the same reps on the same landmark sequences: these vectors were recorded by running the
 * monorepo's game-core (packages/game-core, the phone's rules) on its own synthetic skeletons, by
 * scripts/sync-camera-core.ts. The browser's copies must give exactly the same counts, cues, ranges, framing, hold
 * time and session engine events and summary. Each sequence is also replayed as MediaPipe's 33 landmarks through the
 * browser's mapping (webPose.ts), which must land on the same frames.
 */

type Flat = number[];
const frameOf = (a: Flat): PoseFrame => {
  const joints: PoseFrame["joints"] = {};
  JOINTS.forEach((j, i) => {
    const c = a[3 + i * 3 + 2]!;
    if (c > 0) joints[j as Joint] = { x: a[3 + i * 3]!, y: a[3 + i * 3 + 1]!, c };
  });
  return { t: a[0]!, w: a[1]!, h: a[2]!, joints };
};

/** The same frame as MediaPipe would give it: 33 landmarks, unmirrored (x flipped back for a mirrored preview). */
function asLandmarks(f: PoseFrame, mirror: boolean): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  JOINTS.forEach((j, i) => {
    const p = f.joints[j as Joint];
    if (p) lms[MP_INDEX[i]!] = { x: mirror ? 1 - p.x : p.x, y: p.y, z: 0, visibility: p.c };
  });
  return lms;
}

describe("camera parity with game-core", () => {
  it("records where the vectors come from", () => {
    expect(fixtures.source).toMatch(/^VVFit packages\/game-core /);
    expect(fixtures.reps.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of fixtures.reps) {
    it(`${c.name}: ${c.expect.reps} reps, as on the phone`, () => {
      const m = cameraMove(c.move)!;
      const rc = new RepCounter(m.sig!, m.rep!, m.guards ?? [], m.cues ?? []);
      let reps = 0;
      let partials = 0;
      const cues: string[][] = [];
      const roms: number[] = [];
      const frames = (c.frames as Flat[]).map(frameOf);
      for (const f of frames) {
        const r = rc.push(f);
        reps += r.reps.length;
        partials += r.partials.length;
        for (const x of r.reps) {
          cues.push(x.cues);
          roms.push(x.romPct);
        }
      }
      expect({ reps, partials, cues, roms }).toEqual({
        reps: c.expect.reps,
        partials: c.expect.partials,
        cues: c.expect.cues,
        roms: c.expect.roms,
      });
      expect(framing(frames[Math.floor(frames.length / 2)]!)).toBe(c.expect.framing);
    });

    it(`${c.name}: MediaPipe's landmarks map to the same frames (mirrored and not)`, () => {
      for (const a of (c.frames as Flat[]).slice(0, 60)) {
        const f = frameOf(a);
        for (const mirror of [false, true]) {
          const g = frameFromLandmarks(f.t, f.w, f.h, asLandmarks(f, mirror), mirror);
          if (!g) {
            expect(Object.keys(f.joints).length).toBeLessThan(4);
            continue;
          }
          expect(Object.keys(g.joints).sort()).toEqual(
            Object.keys(f.joints)
              .filter((k) => f.joints[k as Joint]!.c >= 0.3)
              .sort(),
          );
          for (const k of Object.keys(g.joints) as Joint[]) {
            expect(g.joints[k]!.x).toBeCloseTo(f.joints[k]!.x, 9);
            expect(g.joints[k]!.y).toBeCloseTo(f.joints[k]!.y, 9);
          }
        }
      }
    });
  }

  it(`plank: held ${fixtures.holds[0]!.expect.heldS} s, as on the phone`, () => {
    const h = fixtures.holds[0]!;
    const m = cameraMove(h.move)!;
    const ht = new HoldTimer(m.sig!, m.hold!, m.guards ?? [], m.cues ?? []);
    for (const a of h.frames as Flat[]) ht.push(frameOf(a));
    expect(Math.round(ht.heldS * 1000) / 1000).toBe(h.expect.heldS);
  });

  it("the session engine: the same events and the same summary", () => {
    const x = fixtures.engine;
    const e = new CameraWorkoutEngine(0, seededRandom(x.seed));
    const events: string[] = [];
    let clock = 0;
    const feed = (frames: Flat[], offset: number) => {
      for (const a of frames) {
        const f = frameOf(a);
        clock = offset + f.t;
        for (const ev of e.push({ ...f, t: clock }, clock))
          events.push(
            ev.type === "framing"
              ? `framing:${ev.framing}`
              : ev.type === "liveness"
                ? `liveness:${ev.kind}`
                : ev.type === "detected"
                  ? `detected:${ev.move}:${ev.reps}`
                  : ev.type === "rep"
                    ? `rep:${ev.n}`
                    : ev.type,
          );
      }
    };
    for (const s of x.steps) {
      if (s.kind === "startSet") e.startSet(0, null);
      else if (s.kind === "endSet") e.endSet(clock, (s as { restS: number }).restS);
      else {
        const st = s as { offset?: number; offsetAfter?: number; frames: Flat[] };
        feed(st.frames, st.offset ?? clock + (st.offsetAfter ?? 0));
      }
    }
    expect(events).toEqual(x.expect.events);
    expect(e.summary(clock)).toEqual(x.expect.summary);
    expect(e.sport()).toBe(x.expect.sport);
  });

  it("reads nobody from too few landmarks", () => {
    expect(flatFromLandmarks([], false)).toEqual([]);
    expect(frameFromLandmarks(0, 640, 480, null, true)).toBeNull();
  });
});
