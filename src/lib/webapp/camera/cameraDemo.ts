// Copied from VVFit packages/game-core/src/cameraDemo.ts (200973e 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts, hands-free (ADR-0046 amendment 2026-10-21): the demo of each move, shown full screen before its
 * first set and played twice. A stick body (adult proportions, metres) posed per move and projected the way the phone
 * sees it, in the same 17-joint frames the overlay and the counters use: no video, no picture, just numbers the screen
 * draws (the VVaker puppet). The rep demos are real reps: the move's own counter counts them (cameraDemo.test.ts).
 */
import { JOINTS, type Joint, type PoseFrame, type Pt } from "./cameraPose";
import { cameraMove, type MoveDef } from "./cameraMoves";
import { cueLine } from "./cameraCues";

type V3 = [number, number, number]; // x: your left (+), y: up, z: forward
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

const BODY = {
  torso: 0.52,
  thigh: 0.43,
  shin: 0.43,
  upperArm: 0.3,
  forearm: 0.27,
  shoulderW: 0.38,
  hipW: 0.26,
  neck: 0.22,
  footY: 0.08,
} as const;
const STAND_Y = BODY.footY + BODY.thigh + BODY.shin - 0.01;

/** A direction: `pitch` from straight down toward forward (+z; 90 = forward, 180 = up), `roll` toward your left. */
function dir(pitchDeg: number, rollDeg = 0): V3 {
  const p = rad(pitchDeg);
  const r = rad(rollDeg);
  return norm([Math.sin(r) * Math.cos(p), -Math.cos(p) * Math.cos(r), Math.sin(p) * Math.cos(r)]);
}

/** The middle joint of a two-segment limb from its ends, bending toward `pole`. */
function ik(a: V3, c: V3, l1: number, l2: number, pole: V3): V3 {
  const ac = sub(c, a);
  const d = Math.max(1e-6, Math.min(len(ac), l1 + l2 - 1e-6));
  const u = norm(ac);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = norm(sub(pole, mul(u, dot(pole, u))));
  return add(add(a, mul(u, x)), mul(p, h));
}

type Body3 = Record<Joint, V3>;
type LegSpec = { ankle: V3 } | { thighPitch: number; thighRoll?: number; knee: number };
/** Arms: a wrist position (world), a wrist relative to the shoulder ([outward, up, forward]), or angles. */
type ArmSpec =
  { wrist: V3; pole?: V3 } | { rel: V3; pole?: V3 } | { pitch: number; roll?: number; elbow: number; elbowPlane?: "forward" | "side" };
interface Pose3 {
  pelvis: V3;
  /** Torso from vertical: forward (+), back (−); 90 = face down, −90 = on the back, head toward −z. */
  torsoPitch: number;
  torsoRoll?: number;
  legs: { l: LegSpec; r: LegSpec };
  arms: { l: ArmSpec; r: ArmSpec };
}

function pose(p: Pose3): Body3 {
  const P = rad(p.torsoPitch);
  const R = rad(p.torsoRoll ?? 0);
  const up: V3 = norm([Math.sin(R), Math.cos(P) * Math.cos(R), Math.sin(P) * Math.cos(R)]);
  const fwd: V3 = norm([0, -Math.sin(P), Math.cos(P)]);
  const left: V3 = norm([Math.cos(R), -Math.sin(R), 0]);
  const neckBase = add(p.pelvis, mul(up, BODY.torso));
  const b = {} as Body3;
  b.lShoulder = add(neckBase, mul(left, BODY.shoulderW / 2));
  b.rShoulder = add(neckBase, mul(left, -BODY.shoulderW / 2));
  b.lHip = add(p.pelvis, mul(left, BODY.hipW / 2));
  b.rHip = add(p.pelvis, mul(left, -BODY.hipW / 2));
  const head = add(neckBase, mul(up, BODY.neck));
  b.nose = add(head, mul(fwd, 0.09));
  b.lEye = add(add(head, mul(left, 0.035)), mul(fwd, 0.07));
  b.rEye = add(add(head, mul(left, -0.035)), mul(fwd, 0.07));
  b.lEar = add(head, mul(left, 0.075));
  b.rEar = add(head, mul(left, -0.075));
  for (const s of ["l", "r"] as const) {
    const sign = s === "l" ? 1 : -1;
    const hipJ = s === "l" ? b.lHip : b.rHip;
    const leg = p.legs[s];
    let knee: V3;
    let ankle: V3;
    if ("ankle" in leg) {
      ankle = leg.ankle;
      knee = ik(hipJ, ankle, BODY.thigh, BODY.shin, [sign * 0.15, 0, 1]);
    } else {
      const roll = sign * (leg.thighRoll ?? 0);
      knee = add(hipJ, mul(dir(leg.thighPitch, roll), BODY.thigh));
      ankle = add(knee, mul(dir(leg.thighPitch - leg.knee, roll), BODY.shin));
    }
    b[s === "l" ? "lKnee" : "rKnee"] = knee;
    b[s === "l" ? "lAnkle" : "rAnkle"] = ankle;
    const sh = s === "l" ? b.lShoulder : b.rShoulder;
    const arm = p.arms[s];
    let elbow: V3;
    let wrist: V3;
    if ("wrist" in arm || "rel" in arm) {
      wrist = "wrist" in arm ? arm.wrist : add(sh, [sign * arm.rel[0], arm.rel[1], arm.rel[2]]);
      elbow = ik(sh, wrist, BODY.upperArm, BODY.forearm, arm.pole ? [sign * arm.pole[0], arm.pole[1], arm.pole[2]] : [sign, -0.3, -0.5]);
    } else {
      elbow = add(sh, mul(dir(arm.pitch, sign * (arm.roll ?? 0)), BODY.upperArm));
      const bend = 180 - arm.elbow;
      const fd =
        arm.elbowPlane === "side" ? dir(arm.pitch, sign * ((arm.roll ?? 0) + bend)) : dir(arm.pitch + bend, sign * (arm.roll ?? 0));
      wrist = add(elbow, mul(fd, BODY.forearm));
    }
    b[s === "l" ? "lElbow" : "rElbow"] = elbow;
    b[s === "l" ? "lWrist" : "rWrist"] = wrist;
  }
  return b;
}

/** One arm reaching a point (world), the rest of the body unchanged. */
function armTo(b: Body3, s: "l" | "r", wrist: V3, pole: V3 = [s === "l" ? 1 : -1, -0.3, -0.5]): Body3 {
  const sh = s === "l" ? b.lShoulder : b.rShoulder;
  return {
    ...b,
    [s === "l" ? "lElbow" : "rElbow"]: ik(sh, wrist, BODY.upperArm, BODY.forearm, pole),
    [s === "l" ? "lWrist" : "rWrist"]: wrist,
  };
}

// ── Bodies ───────────────────────────────────────────────────────────────────────────────────────────────────────
const FEET: { l: V3; r: V3 } = { l: [0.14, BODY.footY, 0], r: [-0.14, BODY.footY, 0] };
const planted = () => ({ l: { ankle: FEET.l }, r: { ankle: FEET.r } });
const hang = (): { l: ArmSpec; r: ArmSpec } => ({ l: { pitch: 3, roll: 6, elbow: 170 }, r: { pitch: 3, roll: 6, elbow: 170 } });
const both = (a: ArmSpec) => ({ l: a, r: a });
const pelvisY = (reach: number, back: number) => BODY.footY + Math.sqrt(Math.max(0, reach * reach - back * back));
const standing = (arms: { l: ArmSpec; r: ArmSpec } = hang(), lift = 0): Body3 =>
  pose({
    pelvis: [0, STAND_Y + lift, 0],
    torsoPitch: 3,
    legs: lift ? { l: { ankle: [0.14, BODY.footY + lift, 0] }, r: { ankle: [-0.14, BODY.footY + lift, 0] } } : planted(),
    arms,
  });

type SquatArms = "front" | "back" | "rack" | "goblet";
const SQUAT_ARMS: Record<Exclude<SquatArms, "front">, V3> = {
  back: [0.3, 0.04, -0.1],
  rack: [0.1, 0.02, 0.17],
  goblet: [-0.08, -0.2, 0.22],
};
function squat(k: number, arms: SquatArms = "front", armsOverride?: { l: ArmSpec; r: ArmSpec }): Body3 {
  const back = lerp(0, 0.22, k);
  const reach = lerp(BODY.thigh + BODY.shin - 0.01, 0.42, k);
  return pose({
    pelvis: [0, pelvisY(reach, back), -back],
    torsoPitch: lerp(4, 35, k),
    legs: planted(),
    arms:
      armsOverride ?? (arms === "front" ? both({ pitch: lerp(5, 85, k), elbow: 160 }) : both({ rel: SQUAT_ARMS[arms], pole: [1, -1, 0] })),
  });
}

const L_PLANK = BODY.shin + BODY.thigh + BODY.torso;
function pushUp(k: number): Body3 {
  const toes: V3 = [0, 0.05, 0];
  const top = Math.asin((0.6 - 0.05) / L_PLANK);
  const ang = Math.asin((lerp(0.6, 0.3, k) - 0.05) / L_PLANK);
  const along = norm([0, Math.sin(ang), Math.cos(ang)]);
  const pelvis = add(toes, mul(along, BODY.shin + BODY.thigh));
  const wz = L_PLANK * Math.cos(top) - 0.02;
  const td = along;
  return pose({
    pelvis,
    torsoPitch: (Math.atan2(td[2], td[1]) * 180) / Math.PI,
    legs: { l: { ankle: [0.1, 0.06, 0] }, r: { ankle: [-0.1, 0.06, 0] } },
    arms: { l: { wrist: [0.25, 0.04, wz], pole: [0.6, 0, -1] }, r: { wrist: [-0.25, 0.04, wz], pole: [-0.6, 0, -1] } },
  });
}

/** A leg set from the hip (thigh angle, knee bend), the rest of the body unchanged. */
function legFrom(b: Body3, s: "l" | "r", thighPitch: number, kneeBend: number): Body3 {
  const hipJ = s === "l" ? b.lHip : b.rHip;
  const knee = add(hipJ, mul(dir(thighPitch), BODY.thigh));
  const ankle = add(knee, mul(dir(thighPitch - kneeBend), BODY.shin));
  return { ...b, [s === "l" ? "lKnee" : "rKnee"]: knee, [s === "l" ? "lAnkle" : "rAnkle"]: ankle };
}

function curl(k: number): Body3 {
  return pose({ pelvis: [0, STAND_Y, 0], torsoPitch: 3, legs: planted(), arms: both({ pitch: 3, roll: 4, elbow: lerp(170, 40, k) }) });
}
function press(k: number): Body3 {
  const shY = STAND_Y + BODY.torso;
  const w = (s: 1 | -1): V3 => [s * lerp(0.26, 0.22, k), shY + lerp(0.08, 0.565, k), lerp(0.1, 0, k)];
  return pose({
    pelvis: [0, STAND_Y, 0],
    torsoPitch: 2,
    legs: planted(),
    arms: { l: { wrist: w(1), pole: [1, -1, 0.3] }, r: { wrist: w(-1), pole: [-1, -1, 0.3] } },
  });
}
function lateralRaise(k: number): Body3 {
  return standing(both({ pitch: 0, roll: lerp(12, 88, k), elbow: 165 }));
}
function frontRaise(k: number): Body3 {
  return standing(both({ pitch: lerp(5, 92, k), elbow: 170 }));
}
function jack(k: number): Body3 {
  const feet = lerp(0.12, 0.45, k);
  return pose({
    pelvis: [0, STAND_Y - 0.04 * k, 0],
    torsoPitch: 2,
    legs: { l: { ankle: [feet, BODY.footY, 0] }, r: { ankle: [-feet, BODY.footY, 0] } },
    arms: both({ pitch: 0, roll: lerp(10, 165, k), elbow: 165, elbowPlane: "side" }),
  });
}
function hinge(k: number, o: { reach?: number; lean?: number } = {}, arms?: { l: ArmSpec; r: ArmSpec }): Body3 {
  const back = lerp(0, 0.2, k);
  const reach = lerp(BODY.thigh + BODY.shin - 0.01, o.reach ?? 0.72, k);
  return pose({
    pelvis: [0, pelvisY(reach, back), -back],
    torsoPitch: lerp(2, o.lean ?? 80, k),
    legs: planted(),
    arms: arms ?? both({ pitch: 2, elbow: 172 }),
  });
}
function row(k: number): Body3 {
  return pose({
    pelvis: [0, pelvisY(0.8, 0.15), -0.15],
    torsoPitch: 55,
    legs: planted(),
    arms: both({ pitch: lerp(0, -80, k), elbow: lerp(170, 88, k) }),
  });
}
function kickback(k: number): Body3 {
  return pose({
    pelvis: [0, pelvisY(0.8, 0.15), -0.15],
    torsoPitch: 60,
    legs: planted(),
    arms: both({ pitch: -70, elbow: lerp(85, 172, k) }),
  });
}
function uprightRow(k: number): Body3 {
  return standing(both({ rel: lerp3([0.02, -0.56, 0.1], [-0.04, -0.05, 0.12], k), pole: [1, 0.6, -0.2] }));
}
function tricepsExtension(k: number): Body3 {
  return standing(both({ pitch: 172, roll: 6, elbow: lerp(70, 172, k) }));
}
function bridge(k: number): Body3 {
  const pelvis: V3 = [0, lerp(0.12, 0.34, k), 0];
  const d = norm(sub([0, 0.1, -0.5], pelvis));
  return pose({
    pelvis,
    torsoPitch: (Math.atan2(d[2], d[1]) * 180) / Math.PI,
    legs: { l: { ankle: [0.12, BODY.footY, 0.42] }, r: { ankle: [-0.12, BODY.footY, 0.42] } },
    arms: { l: { wrist: [0.28, 0.04, -0.05] }, r: { wrist: [-0.28, 0.04, -0.05] } },
  });
}
function sitUp(k: number): Body3 {
  return pose({
    pelvis: [0, 0.1, 0],
    torsoPitch: -lerp(88, 25, k),
    legs: { l: { ankle: [0.12, BODY.footY, 0.5] }, r: { ankle: [-0.12, BODY.footY, 0.5] } },
    arms: both({ pitch: 90, elbow: 170 }),
  });
}
function legRaise(k: number): Body3 {
  const t = lerp(90, 165, k);
  return pose({
    pelvis: [0, 0.1, 0],
    torsoPitch: -90,
    legs: { l: { thighPitch: t, knee: 0 }, r: { thighPitch: t, knee: 0 } },
    arms: both({ pitch: 90, elbow: 175 }),
  });
}
function superman(k: number): Body3 {
  const leg = lerp(-90, -102, k);
  return pose({
    pelvis: [0, 0.1, 0],
    torsoPitch: lerp(90, 76, k),
    legs: { l: { thighPitch: leg, knee: 0 }, r: { thighPitch: leg, knee: 0 } },
    arms: both({ pitch: lerp(165, 175, k), elbow: 175 }),
  });
}
const allFours = (torsoPitch = 90, pelvisLift = 0): Body3 =>
  pose({
    pelvis: [0, 0.55 + pelvisLift, 0],
    torsoPitch,
    legs: { l: { thighPitch: 0, knee: 90 }, r: { thighPitch: 0, knee: 90 } },
    arms: both({ wrist: [0, 0, 0] }),
  });
function onAllFours(torsoPitch = 90, pelvisLift = 0): Body3 {
  const b = allFours(torsoPitch, pelvisLift);
  const w = (s: "l" | "r"): V3 => [b[s === "l" ? "lShoulder" : "rShoulder"][0], 0.03, b[s === "l" ? "lShoulder" : "rShoulder"][2]];
  return armTo(armTo(b, "l", w("l"), [0, 0, -1]), "r", w("r"), [0, 0, -1]);
}
function birdDog(k: number, side: "l" | "r"): Body3 {
  const other = side === "l" ? "r" : "l";
  let b = onAllFours();
  b = legFrom(b, side, lerp(0, -90, k), lerp(90, 0, k));
  const sh = b[other === "l" ? "lShoulder" : "rShoulder"];
  return armTo(b, other, add(sh, mul(dir(lerp(0, 92, k)), BODY.upperArm + BODY.forearm - 0.01)));
}
function catCow(k: number): Body3 {
  return onAllFours(lerp(84, 98, k), lerp(0.02, -0.03, k));
}
function lunge(k: number, lead: "l" | "r"): Body3 {
  const stride = lerp(0, 0.8, Math.min(1, k * 1.6));
  const front: V3 = [lead === "l" ? 0.13 : -0.13, BODY.footY, stride * 0.55];
  const backF: V3 = [lead === "l" ? -0.13 : 0.13, BODY.footY + lerp(0, 0.05, k), -stride * 0.45];
  const pelvis: V3 = [0, STAND_Y - lerp(0, 0.4, k), lerp(0, 0.05, k)];
  return pose({
    pelvis,
    torsoPitch: 4,
    legs: lead === "l" ? { l: { ankle: front }, r: { ankle: backF } } : { l: { ankle: backF }, r: { ankle: front } },
    arms: hang(),
  });
}
function sideLunge(k: number): Body3 {
  const wide = 0.42;
  return pose({
    pelvis: [lerp(0, 0.3, k), lerp(pelvisY(0.92, wide - 0.13), 0.42, k), lerp(0, -0.14, k)],
    torsoPitch: lerp(3, 30, k),
    legs: { l: { ankle: [wide, BODY.footY, 0] }, r: { ankle: [-wide, BODY.footY, 0] } },
    arms: both({ pitch: lerp(5, 70, k), elbow: 150 }),
  });
}
function highKnee(k: number, side: "l" | "r"): Body3 {
  const up = { thighPitch: lerp(0, 95, k), knee: lerp(0, 95, k) };
  const down = { thighPitch: 0, knee: 3 };
  return pose({
    pelvis: [0, STAND_Y, 0],
    torsoPitch: 3,
    legs: side === "l" ? { l: up, r: down } : { l: down, r: up },
    arms: { l: { pitch: side === "r" ? 40 : -10, elbow: 90 }, r: { pitch: side === "l" ? 40 : -10, elbow: 90 } },
  });
}
function mountainClimber(k: number, side: "l" | "r"): Body3 {
  const b = pushUp(0);
  const hipJ = side === "l" ? b.lHip : b.rHip;
  const toes = side === "l" ? b.lAnkle : b.rAnkle;
  const straight = (Math.atan2(toes[2] - hipJ[2], -(toes[1] - hipJ[1])) * 180) / Math.PI;
  return legFrom(b, side, lerp(straight, 25, k), lerp(0, 110, k));
}
function burpee(p: number): Body3 {
  if (p < 0.3) return squat(p / 0.3);
  if (p < 0.7) return pushUp(0);
  return squat(1 - (p - 0.7) / 0.3);
}
function pullUp(k: number): Body3 {
  const bar = 2.25;
  const shY = lerp(bar - 0.55, bar - 0.12, k);
  return pose({
    pelvis: [0, shY - BODY.torso, 0],
    torsoPitch: 3,
    legs: { l: { thighPitch: 5, knee: 20 }, r: { thighPitch: 5, knee: 20 } },
    arms: { l: { wrist: [0.3, bar, 0.02], pole: [1, -0.6, 0.1] }, r: { wrist: [-0.3, bar, 0.02], pole: [-1, -0.6, 0.1] } },
  });
}
function invertedRow(k: number): Body3 {
  const at = (x: number) =>
    pose({
      pelvis: [0, lerp(0.42, 0.62, x), 0],
      torsoPitch: lerp(-64, -46, x),
      legs: { l: { ankle: [0.12, BODY.footY, 0.8] }, r: { ankle: [-0.12, BODY.footY, 0.8] } },
      arms: hang(),
    });
  // The bar: an arm's length above the chest at the bottom (straight arms), where the hands stay.
  const b0 = at(0);
  const chest: V3 = [0, -Math.sin(rad(-64)), Math.cos(rad(-64))];
  const bar = (s: "l" | "r"): V3 =>
    add(add(b0[s === "l" ? "lShoulder" : "rShoulder"], mul(chest, BODY.upperArm + BODY.forearm - 0.01)), [0, 0, 0]);
  const b = at(k);
  return armTo(armTo(b, "l", bar("l"), [1, -1, 0]), "r", bar("r"), [-1, -1, 0]);
}
function dip(k: number): Body3 {
  return pose({
    pelvis: [0, lerp(0.56, 0.3, k), 0],
    torsoPitch: 4,
    legs: { l: { ankle: [0.12, BODY.footY, 0.75] }, r: { ankle: [-0.12, BODY.footY, 0.75] } },
    arms: { l: { wrist: [0.2, 0.55, -0.16], pole: [0, 0, -1] }, r: { wrist: [-0.2, 0.55, -0.16], pole: [0, 0, -1] } },
  });
}
function benchPress(k: number, floor = false): Body3 {
  return pose({
    pelvis: [0, floor ? 0.1 : 0.48, 0],
    torsoPitch: -90,
    legs: floor
      ? { l: { ankle: [0.14, BODY.footY, 0.42] }, r: { ankle: [-0.14, BODY.footY, 0.42] } }
      : { l: { thighPitch: 90, knee: 90 }, r: { thighPitch: 90, knee: 90 } },
    arms: both({ rel: lerp3([0.03, 0.56, 0], [0.1, 0.1, 0], k), pole: [1, -1, 0] }),
  });
}
function pikePushUp(k: number): Body3 {
  const b = pose({
    pelvis: [0, lerp(0.85, 0.8, k), lerp(0, 0.1, k)],
    torsoPitch: lerp(128, 150, k),
    legs: { l: { ankle: [0.12, BODY.footY, -0.38] }, r: { ankle: [-0.12, BODY.footY, -0.38] } },
    arms: hang(),
  });
  return armTo(armTo(b, "l", [0.22, 0.04, 0.7], [0, 0.3, -1]), "r", [-0.22, 0.04, 0.7], [0, 0.3, -1]);
}
function downwardDog(k: number): Body3 {
  const b = pose({
    pelvis: [0, lerp(0.55, 0.85, k), lerp(0, -0.05, k)],
    torsoPitch: lerp(92, 135, k),
    legs: { l: { ankle: [0.12, BODY.footY, -0.4] }, r: { ankle: [-0.12, BODY.footY, -0.4] } },
    arms: hang(),
  });
  return armTo(armTo(b, "l", [0.22, 0.04, 0.75], [0, 1, 0]), "r", [-0.22, 0.04, 0.75], [0, 1, 0]);
}
function cobra(k: number): Body3 {
  const b = pose({
    pelvis: [0, 0.1, 0],
    torsoPitch: lerp(88, 45, k),
    legs: { l: { thighPitch: -90, knee: 0 }, r: { thighPitch: -90, knee: 0 } },
    arms: hang(),
  });
  return armTo(armTo(b, "l", [0.25, 0.03, 0.38], [1, 0.5, -1]), "r", [-0.25, 0.03, 0.38], [-1, 0.5, -1]);
}
function childsPose(k: number): Body3 {
  const b = pose({
    pelvis: [0, lerp(0.5, 0.28, k), lerp(0.1, 0, k)],
    torsoPitch: lerp(5, 100, k),
    legs: { l: { thighPitch: lerp(10, 65, k), knee: lerp(100, 155, k) }, r: { thighPitch: lerp(10, 65, k), knee: lerp(100, 155, k) } },
    arms: both({ pitch: lerp(10, 100, k), elbow: 172 }),
  });
  return b;
}
function quadStretch(k: number): Body3 {
  const b = legFrom(standing(), "l", lerp(0, -8, k), lerp(0, 150, k));
  return armTo(b, "l", add(b.lAnkle, [0.02, 0.03, -0.03]), [1, 0, 0]);
}
function shoulderStretch(k: number): Body3 {
  const b = standing();
  return armTo(b, "l", lerp3(b.lWrist, add(b.rShoulder, [0.05, -0.04, 0.12]), k), [0, -0.5, 1]);
}
function butterfly(k: number): Body3 {
  const roll = lerp(35, 60, k);
  const b = pose({
    pelvis: [0, 0.12, 0],
    torsoPitch: lerp(5, 25, k),
    legs: { l: { thighPitch: 80, thighRoll: roll, knee: 120 }, r: { thighPitch: 80, thighRoll: roll, knee: 120 } },
    arms: hang(),
  });
  const mid: V3 = [0, (b.lAnkle[1] + b.rAnkle[1]) / 2, (b.lAnkle[2] + b.rAnkle[2]) / 2];
  return armTo(armTo(b, "l", add(mid, [0.04, 0.03, 0]), [1, 0, 0]), "r", add(mid, [-0.04, 0.03, 0]), [-1, 0, 0]);
}
function wallSit(k: number): Body3 {
  return pose({
    pelvis: [0, lerp(STAND_Y, BODY.footY + BODY.shin + 0.02, k), lerp(0, -0.42, k)],
    torsoPitch: 2,
    legs: planted(),
    arms: hang(),
  });
}
function farmerCarry(p: number): Body3 {
  const step = 15 * Math.sin(2 * Math.PI * 2 * p);
  return pose({
    pelvis: [0, STAND_Y - 0.01, 0],
    torsoPitch: 2,
    legs: { l: { thighPitch: step, knee: Math.max(0, step) * 0.8 }, r: { thighPitch: -step, knee: Math.max(0, -step) * 0.8 } },
    arms: both({ pitch: 0, roll: 10, elbow: 175 }),
  });
}
const HANG_REL: V3 = [0.04, -0.56, 0.03];
function clean(k: number, overhead = false): Body3 {
  const dipK = Math.sin(Math.PI * k) * 0.25;
  const rel = overhead ? lerp3(HANG_REL, [0.12, 0.56, 0], k) : lerp3(HANG_REL, [0.1, 0.02, 0.17], k);
  return squat(dipK, "front", both({ rel, pole: [1, -1, overhead ? 0 : -0.3] }));
}
function thruster(p: number): Body3 {
  const sq = p < 0.5 ? bell(p / 0.5) : 0;
  const pr = p >= 0.42 ? bell(Math.min(1, (p - 0.42) / 0.5)) : 0;
  return squat(sq, "front", both({ rel: lerp3([0.1, 0.02, 0.17], [0.05, 0.56, 0], pr), pole: [1, -1, 0] }));
}
function swing(k: number): Body3 {
  return hinge(k, { reach: 0.74, lean: 70 }, both({ pitch: lerp(85, 10, k), elbow: 172 }));
}

/** 0 → 1 → 0 smoothly over x in [0, 1]. */
const bell = (x: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * Math.max(0, Math.min(1, x)));
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

// ── Each move's demo ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * How a move's demo plays: `rep` (k: 0 rest → 1 worked → 0), `alt` (one rep each side per loop), `loop` (the
 * generator gets the loop's phase itself: burpee, thruster, carry), `hold` (into the position, held, back out).
 */
type Demo =
  | { kind: "rep"; at: (k: number) => Body3; view: "front" | "side"; ms?: number }
  | { kind: "alt"; at: (k: number, side: "l" | "r") => Body3; view: "front" | "side"; ms?: number }
  | { kind: "loop"; at: (p: number) => Body3; view: "front" | "side"; ms?: number }
  | { kind: "hold"; at: (k: number) => Body3; view: "front" | "side"; ms?: number };

const rep = (at: (k: number) => Body3, view: "front" | "side"): Demo => ({ kind: "rep", at, view });
const hold = (at: (k: number) => Body3, view: "front" | "side"): Demo => ({ kind: "hold", at, view });

const DEMOS: Readonly<Record<string, Demo>> = {
  squat: rep((k) => squat(k), "front"),
  "jump-squat": rep((k) => squat(k * 0.85), "front"),
  "back-squat": rep((k) => squat(k, "back"), "front"),
  "front-squat": rep((k) => squat(k, "rack"), "front"),
  "goblet-squat": rep((k) => squat(k, "goblet"), "front"),
  lunge: rep((k) => lunge(k, "r"), "side"),
  "reverse-lunge": rep((k) => lunge(k, "r"), "side"),
  "weighted-lunge": rep((k) => lunge(k, "r"), "side"),
  "weighted-reverse-lunge": rep((k) => lunge(k, "r"), "side"),
  "step-up": rep((k) => lunge(k, "r"), "side"),
  "side-lunge": rep(sideLunge, "front"),
  "push-up": rep(pushUp, "side"),
  "knee-push-up": rep(pushUp, "side"),
  "pike-push-up": rep(pikePushUp, "side"),
  dip: rep(dip, "side"),
  "bench-press": rep((k) => benchPress(k), "side"),
  "floor-press": rep((k) => benchPress(k, true), "side"),
  burpee: { kind: "loop", at: burpee, view: "side" },
  "jumping-jack": rep(jack, "front"),
  "high-knees": { kind: "alt", at: highKnee, view: "front" },
  "mountain-climber": { kind: "alt", at: mountainClimber, view: "side" },
  plank: hold(() => pushUp(0), "side"),
  "side-plank": hold(() => pushUp(0), "side"),
  "wall-sit": hold(wallSit, "side"),
  "glute-bridge": rep(bridge, "side"),
  "hip-thrust": rep(bridge, "side"),
  "sit-up": rep(sitUp, "side"),
  crunch: rep((k) => sitUp(k * 0.45), "side"),
  "leg-raise": rep(legRaise, "side"),
  superman: rep(superman, "side"),
  "bird-dog": { kind: "alt", at: birdDog, view: "side", ms: 4400 },
  "calf-raise": rep((k) => standing(hang(), 0.07 * k), "side"),
  "pull-up": rep(pullUp, "front"),
  "chin-up": rep(pullUp, "front"),
  "inverted-row": rep(invertedRow, "side"),
  deadlift: rep((k) => hinge(k), "side"),
  "romanian-deadlift": rep((k) => hinge(k, { reach: 0.82, lean: 82 }), "side"),
  "kettlebell-swing": rep(swing, "side"),
  "overhead-press": rep(press, "front"),
  "push-press": rep(press, "front"),
  thruster: { kind: "loop", at: thruster, view: "front" },
  "bent-over-row": rep(row, "side"),
  "upright-row": rep(uprightRow, "front"),
  "biceps-curl": rep(curl, "side"),
  "hammer-curl": rep(curl, "side"),
  "triceps-extension": rep(tricepsExtension, "front"),
  "triceps-kickback": rep(kickback, "side"),
  "lateral-raise": rep(lateralRaise, "front"),
  "front-raise": rep(frontRaise, "side"),
  shrug: rep((k) => standing(hang(), 0.0 * k), "front"),
  clean: rep((k) => clean(k), "front"),
  snatch: rep((k) => clean(k, true), "front"),
  "farmer-carry": { kind: "loop", at: farmerCarry, view: "front" },
  "deep-squat-hold": hold((k) => squat(k), "front"),
  "quad-stretch": hold(quadStretch, "side"),
  "hamstring-stretch": hold((k) => hinge(k, { reach: 0.85, lean: 108 }), "side"),
  "hip-flexor-stretch": hold((k) => lunge(k, "r"), "side"),
  "downward-dog": hold(downwardDog, "side"),
  cobra: hold(cobra, "side"),
  "childs-pose": hold(childsPose, "side"),
  "side-bend": hold(
    (k) =>
      pose({
        pelvis: [0, STAND_Y, 0],
        torsoPitch: 2,
        torsoRoll: lerp(0, 24, k),
        legs: planted(),
        arms: both({ pitch: 176, roll: 4, elbow: 172 }),
      }),
    "front",
  ),
  "overhead-reach": hold((k) => standing(both({ pitch: lerp(5, 178, k), roll: 4, elbow: 174 })), "front"),
  "cat-cow": rep(catCow, "side"),
  pigeon: hold(childsPose, "side"),
  butterfly: hold(butterfly, "front"),
  "shoulder-stretch": hold(shoulderStretch, "front"),
};

/** Moves with a demo of their own (the rest stand and breathe: never a blank screen). */
export const DEMO_MOVES: readonly string[] = Object.keys(DEMOS);

/** The demo plays this many times before the move's first set. */
export const DEMO_LOOPS = 2;
/** One loop (ms): a rep about 2.6 s, a side each 1.4 s, a hold 3.2 s. */
export const DEMO_LOOP_MS = { rep: 2600, alt: 2800, loop: 3000, hold: 3200 } as const;
/** Frames per second of the demo. */
export const DEMO_FPS = 20;

export interface DemoLoop {
  move: string;
  /** One loop's frames (normalised like a camera frame, the whole loop fitted to the same box: no zooming). */
  frames: PoseFrame[];
  loopMs: number;
  /** As the phone would see it: from the front (mirrored, like a mirror) or the side. */
  view: "front" | "side";
}

const W = 480;
const H = 640;

/** One loop of the move's demo (a standing body that breathes when the move has none). */
export function demoLoop(moveId: string, fps = DEMO_FPS): DemoLoop {
  const d: Demo = DEMOS[moveId] ?? {
    kind: "rep",
    at: (k: number) => standing(both({ pitch: 4 + 6 * k, roll: 6, elbow: 170 })),
    view: "front",
  };
  const loopMs = d.ms ?? DEMO_LOOP_MS[d.kind];
  const n = Math.max(2, Math.round((loopMs / 1000) * fps));
  const bodies: Body3[] = [];
  for (let i = 0; i < n; i++) {
    const p = i / n;
    bodies.push(bodyAt(d, p));
  }
  return { move: moveId, frames: projectAll(bodies, d.view, loopMs / n), loopMs, view: d.view };
}

/** The body at a loop phase p ∈ [0, 1). Reps start and end at rest, with a short pause each side. */
function bodyAt(d: Demo, p: number): Body3 {
  switch (d.kind) {
    case "rep":
      return d.at(bell((p - 0.1) / 0.8));
    case "alt":
      return p < 0.5 ? d.at(bell((p - 0.05) / 0.4), "l") : d.at(bell((p - 0.55) / 0.4), "r");
    case "loop":
      return d.at(Math.max(0, Math.min(1, (p - 0.05) / 0.9)));
    case "hold":
      return d.at(p < 0.3 ? ease(p / 0.3) : p < 0.85 ? 1 : ease((1 - p) / 0.15));
  }
}

/** Projects the loop like the phone 2–3 m away, fitted to one box for the whole loop (so the figure never zooms). */
function projectAll(bodies: Body3[], view: "front" | "side", stepMs: number): PoseFrame[] {
  // Front: mirrored like the front camera's preview (your left on the left); side: facing right.
  const across = (p: V3) => (view === "front" ? p[0] : p[2]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const b of bodies)
    for (const j of JOINTS) {
      const x = across(b[j]);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, b[j][1]);
      maxY = Math.max(maxY, b[j][1]);
    }
  // At most 82 % of the picture's height (a standing body), never wider than 86 % of it.
  const spanY = Math.max(maxY - minY, 1.6);
  const spanX = Math.max(maxX - minX, 0.4);
  const scalePx = Math.min((H * 0.82) / spanY, (W * 0.86) / spanX);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return bodies.map((b, i) => {
    const joints: Partial<Record<Joint, Pt>> = {};
    for (const j of JOINTS) {
      const x = (W / 2 + (across(b[j]) - cx) * scalePx) / W;
      const y = (H / 2 - (b[j][1] - cy) * scalePx) / H;
      joints[j] = { x: round4(x), y: round4(y), c: 0.95 };
    }
    return { t: Math.round(i * stepMs), w: W, h: H, joints };
  });
}
const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** The demo frame to draw `ms` into the demo (loops). */
export function demoFrameAt(loop: DemoLoop, ms: number): PoseFrame {
  const i = Math.floor((((ms % loop.loopMs) + loop.loopMs) % loop.loopMs) / (loop.loopMs / loop.frames.length));
  return loop.frames[Math.min(loop.frames.length - 1, Math.max(0, i))]!;
}

/** Reps one loop shows: one, or one each side (alternating moves). */
export const demoRepsPerLoop = (moveId: string) => (DEMOS[moveId]?.kind === "alt" ? 2 : 1);

/** How long the full demo plays (both loops), ms. */
export function demoMs(moveId: string): number {
  const d = DEMOS[moveId];
  return (d?.ms ?? DEMO_LOOP_MS[d?.kind ?? "rep"]) * DEMO_LOOPS;
}

/** The target said and shown with the demo: "15 reps", "40 s", "Until you stop" (free sets end when you rest). */
export function targetText(
  t: { reps?: number; holdS?: number } | null | undefined,
  m: Pick<MoveDef, "kind"> | null | undefined,
  lang: "en" | "fr",
): string {
  if (t?.reps) return lang === "fr" ? `${t.reps} répétitions` : `${t.reps} reps`;
  if (t?.holdS) return lang === "fr" ? `${t.holdS} s` : `${t.holdS} s`;
  if (m?.kind === "hold") return lang === "fr" ? "Tiens la position" : "Hold the position";
  return lang === "fr" ? "À ton rythme, jusqu’à ce que tu t’arrêtes" : "At your pace, until you stop";
}

/** Key tips for moves the form cues don't cover (or say it better before the set than during it). */
const TIPS: Readonly<Record<string, { en: string; fr: string }>> = {
  squat: {
    en: "Hips back and down, chest up, knees out.",
    fr: "Hanches en arrière et vers le bas, poitrine haute, genoux vers l’extérieur.",
  },
  "push-up": { en: "Body in one straight line, chest to the floor.", fr: "Corps bien aligné, la poitrine vers le sol." },
  plank: { en: "One straight line from shoulders to knees.", fr: "Une ligne droite des épaules aux genoux." },
  burpee: { en: "Squat, hands down, jump back to a plank, then up.", fr: "Squat, mains au sol, saute en planche, puis remonte." },
  "jumping-jack": { en: "Hands all the way up, feet wide.", fr: "Les mains bien en haut, les pieds écartés." },
  "high-knees": { en: "Knees up to hip height, one after the other.", fr: "Genoux à hauteur de hanches, l’un après l’autre." },
  "mountain-climber": {
    en: "In a plank, drive one knee to the chest, then the other.",
    fr: "En planche, ramène un genou vers la poitrine, puis l’autre.",
  },
  "glute-bridge": { en: "Feet flat, push the hips all the way up.", fr: "Pieds à plat, monte les hanches jusqu’en haut." },
  "reverse-lunge": {
    en: "Step back and lower the back knee, torso tall.",
    fr: "Recule d’un pas et descends le genou arrière, buste droit.",
  },
  "kettlebell-swing": { en: "Hinge at the hips and snap them forward.", fr: "Plie aux hanches puis ouvre-les d’un coup." },
  "farmer-carry": { en: "Weights at your sides, stand tall, walk slowly.", fr: "Charges le long du corps, grandis-toi, marche lentement." },
  "bird-dog": { en: "On all fours, reach one arm and the opposite leg.", fr: "À quatre pattes, tends un bras et la jambe opposée." },
};

/** The one-line key tip under the move's name: its own tip, else its first form cue, else where to stand. */
export function moveTip(m: MoveDef, lang: "en" | "fr"): string {
  const own = TIPS[m.id];
  if (own) return own[lang];
  const first = m.cues?.[0];
  if (first) return cueLine(first.id, m, lang);
  return lang === "fr" ? "Suis le mouvement à ton rythme." : "Follow the move at your own pace.";
}

/** The demo's move by id (for a screen that only has the id). */
export const demoMove = (id: string) => cameraMove(id) ?? null;
