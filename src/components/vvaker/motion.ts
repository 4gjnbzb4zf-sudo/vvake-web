import type { VVakerTraits } from "./traits";

/** Four key poses per cycle (0%, 25%, 50%, 75%); key 0 is also the still frame used for exports. */
export type Keys = readonly [number, number, number, number];
const k = (v: number): Keys => [v, v, v, v];

/**
 * Sport motion for a VVaker. Angles are degrees, clockwise on screen: for a hanging limb, positive
 * swings the hand/foot to the viewer's left. Shoulders/elbows (ls, le, rs, re), hips/knees (lh, lk,
 * rh, rk), leg lift in px (ly, ry, negative = up), whole-body bob (body), a held prop (prop).
 */
export interface Motion {
  /** Seconds per cycle. */
  period: number;
  ls?: Keys;
  le?: Keys;
  rs?: Keys;
  re?: Keys;
  lh?: Keys;
  lk?: Keys;
  rh?: Keys;
  rk?: Keys;
  ly?: Keys;
  ry?: Keys;
  body?: Keys;
  /** Whole-body side sway in px (skating) and lean in degrees around the hips. */
  sway?: Keys;
  tilt?: Keys;
  prop?: Keys;
  /** Scene element keys: punching-bag swing (deg), impact burst / splash / dust opacity (0–1). */
  bag?: Keys;
  burst?: Keys;
  splashL?: Keys;
  splashR?: Keys;
  /** Static placement of the figure inside its scene, e.g. "translate(-26 0)". */
  frame?: string;
  /** 0–1: how open the mouth is (breathing, kiai). */
  mouth?: Keys;
  /** 0–1: effort blush. */
  strain?: Keys;
  /** Seated poses sit lower. */
  drop?: number;
  sweat?: boolean;
  flutter?: boolean;
}

export const MOTIONS: Record<VVakerTraits["sport"], Motion> = {
  // Running on a scrolling track: high knees in turn, bent arms pumping against the legs, forward lean.
  runner: {
    period: 0.62,
    ls: [20, 12, 4, 12],
    le: [-40, -85, -125, -85],
    rs: [-4, -12, -20, -12],
    re: [125, 85, 40, 85],
    ly: [-18, -6, 0, -6],
    lk: [10, 4, 0, 4],
    ry: [0, -6, -18, -6],
    rk: [0, -4, -10, -4],
    body: [0, -6, 0, -6],
    tilt: k(5),
    burst: [0, 0, 1, 0],
    mouth: [0.2, 1, 0.2, 1],
    sweat: true,
    flutter: true,
  },
  walker: {
    period: 1.2,
    ls: [10, 4, -2, 4],
    le: [-8, -4, -12, -4],
    rs: [2, -4, -10, -4],
    re: [18, 8, 2, 8],
    ly: [-7, -2, 0, -2],
    ry: [0, -2, -7, -2],
    body: [0, -3, 0, -3],
    tilt: k(2),
  },
  // On a real bike: knees rise and fall with the cranks, hands on the bars, wheels spinning.
  cyclist: {
    period: 0.6,
    ls: k(-26),
    le: k(-50),
    rs: k(-4),
    re: k(-6),
    ly: [-14, -7, 0, -7],
    lk: [18, 9, 0, 9],
    ry: [0, -7, -14, -7],
    rk: [0, -9, -18, -9],
    body: [0, -2, 0, -2],
    tilt: k(6),
    mouth: [0.3, 0.8, 0.3, 0.8],
    sweat: true,
    flutter: true,
  },
  // Kettlebell curl on the right, left hand on the hip, a brace and a red face at the top.
  lifter: {
    period: 2.2,
    ls: k(32),
    le: k(-88),
    rs: k(-6),
    re: [0, 70, 140, 70],
    lk: k(4),
    rk: k(-4),
    body: [0, 1, 3, 1],
    strain: [0, 0.5, 1, 0.5],
    mouth: [0, 0.3, 0.9, 0.3],
    sweat: true,
  },
  // Heavy bag: guard, right jab lands (POW, the bag swings), guard, right hook.
  boxer: {
    period: 1.1,
    frame: "translate(-30 0)",
    ls: k(16),
    le: k(-140),
    rs: [-18, -92, -18, -70],
    re: [140, 0, 140, 45],
    ly: [0, -3, 0, -3],
    ry: [0, -3, 0, -3],
    body: [0, -3, 0, -3],
    tilt: [0, 6, 0, 3],
    bag: [0, 0, 14, 4],
    burst: [0, 1, 0, 0.5],
    mouth: [0, 1, 0, 0.6],
    sweat: true,
  },
  // A slow flow in tree pose: warrior arms, arms up, hands to heart, warrior again.
  yogi: {
    period: 8,
    ls: [95, 150, 20, 95],
    le: [0, 0, -120, 0],
    rs: [-95, -150, -20, -95],
    re: [0, 0, 120, 0],
    rh: k(-40),
    rk: k(100),
    body: [0, -2, 0, -2],
  },
  // Dribble: the hand pushes as the ball drops (synced with the 0.56 s bounce), athletic stance.
  baller: {
    period: 0.56,
    ls: k(30),
    le: k(-24),
    rs: k(-22),
    re: [-35, -18, 0, -18],
    lk: k(-8),
    rk: k(8),
    body: [2, 4, 6, 4],
    sweat: true,
  },
  // Typing: forearms on the keyboard, a quick alternating tap.
  coder: {
    period: 0.5,
    ls: k(-8),
    le: [-75, -68, -75, -82],
    rs: k(8),
    re: [75, 82, 75, 68],
  },
  // Kata: guard, right punch with a kiai, guard, high side kick leaning away.
  martial: {
    period: 2,
    frame: "translate(-18 0)",
    ls: k(12),
    le: k(-125),
    rs: [-12, -90, -12, -12],
    re: [125, 0, 125, 125],
    lh: [8, 8, 8, 14],
    rh: [-8, -8, -8, -92],
    rk: [0, 0, 0, 6],
    tilt: [0, 3, 0, -10],
    burst: [0, 1, 0, 1],
    mouth: [0, 1, 0, 1],
    flutter: true,
  },
  // In a canoe on moving water: the double paddle dips left then right, splashes, the boat rocks.
  paddler: {
    period: 2,
    drop: 36,
    prop: [-28, 0, 28, 0],
    ls: [-60, -40, -22, -40],
    le: k(-55),
    rs: [22, 40, 60, 40],
    re: k(55),
    tilt: [-3, 0, 3, 0],
    splashL: [1, 0.3, 0, 0],
    splashR: [0, 0, 1, 0.3],
    flutter: true,
  },
  // Seated cross-legged on a cushion, hands on knees, slow breathing.
  meditator: {
    period: 6,
    ls: k(28),
    le: k(-30),
    rs: k(-28),
    re: k(30),
    lh: k(88),
    lk: k(-170),
    rh: k(-88),
    rk: k(170),
    body: [0, -3, 0, -3],
    drop: 22,
  },
  // Roller skating: glide and push, the body sways over the pushing leg, arms swing across.
  roller: {
    period: 1.4,
    sway: [-12, 0, 12, 0],
    tilt: [-6, 0, 6, 0],
    lh: [0, 10, 28, 10],
    ly: [0, -2, -5, -2],
    rh: [-28, -10, 0, -10],
    ry: [-5, -2, 0, -2],
    ls: [42, 24, 8, 24],
    le: k(-24),
    rs: [-8, -24, -42, -24],
    re: k(24),
    flutter: true,
  },
  // Ice skating: longer glides, arms wide and graceful, a lift of the free leg.
  skater: {
    period: 2,
    sway: [-14, 0, 14, 0],
    tilt: [-7, 0, 7, 0],
    lh: [0, 12, 34, 12],
    ly: [0, -4, -10, -4],
    rh: [-34, -12, 0, -12],
    ry: [-10, -4, 0, -4],
    ls: [70, 55, 40, 55],
    le: k(0),
    rs: [-40, -55, -70, -55],
    re: k(0),
    burst: [0.3, 1, 0.3, 1],
    flutter: true,
  },
};
