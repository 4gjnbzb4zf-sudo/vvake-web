// Copied from VVFit packages/game-core/src/cameraSession.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): one session in front of the camera. Sets of a move (picked, planned, or detected), reps
 * or a hold counted from the pose, the load you typed, a rest timer between sets, liveness checks during rest, and
 * the summary the session uploads (cameraPoints.ts CameraSummary). Pure: the screen feeds it frames and taps and says
 * what it returns.
 */
import { CAMERA_POINTS, type CameraJudge, type CameraMoveLog, type CameraSet, type CameraSummary } from "./cameraPoints";
import { cameraMove, cameraSessionSport, moveNeeds, type MoveDef } from "./cameraMoves";
import { HoldTimer, type HoldStatus, type RepQuality, type CueId, type RepEvent, type SignalSpec } from "./cameraReps";
import { TemplateCounter, TemplateHold } from "./cameraTemplate";
import { countViews, moveCounter } from "./cameraReady";
import type { CustomMoveDef } from "./cameraCustom";
import {
  DETECT_AREAS,
  framingReport,
  type BodyArea,
  type Framing,
  type FramingReport,
  type FramingTip,
  type PoseFrame,
} from "./cameraPose";
import { LivenessChecker, type LivenessKind, type LivenessResult } from "./cameraLiveness";
import { detectMove, DETECT } from "./cameraDetect";

export type CameraEvent =
  /** `quality`: complete, limited (your own consistent range) or uncertain (seen unsurely: labelled, no cue). */
  | { type: "rep"; n: number; side?: "l" | "r"; cues: CueId[]; quality?: RepQuality }
  | { type: "partial" }
  | { type: "hold"; s: number }
  | { type: "holdCue"; cues: CueId[] }
  | { type: "detected"; move: string; reps: number }
  /** The framing guide changed (after it held a second: no flicker), with the parts not seen and the tips. */
  | { type: "framing"; framing: Framing; missing: BodyArea[]; tips: FramingTip[] }
  | { type: "restOver" }
  | { type: "liveness"; kind: LivenessKind }
  | { type: "livenessResult"; result: LivenessResult };

export interface CurrentSet {
  /** null: auto-detect is still looking. */
  move: MoveDef | null;
  startedMs: number;
  reps: number;
  holdS: number;
  loadKg?: number;
  side?: "l" | "r";
  /** Manual moves: reps typed / tapped. */
  manual: boolean;
  /** First and last rep (ms), for the work time. */
  firstRepMs: number;
  lastRepMs: number;
  roms: number[];
  tempos: number[];
  cues: Set<CueId>;
  /** Taps that corrected the count (+1 / −1): the set is logged as `count`, never `camera`, when used. */
  adjusted: boolean;
  /** Of the counted reps: in your own (limited) range, and seen unsurely (the summary can label them). */
  limited: number;
  uncertain: number;
}

/** A framing change shows once it held this long (ms). */
export const FRAMING_STEADY_MS = 1000;

/** Rest between sets (s): the routine's, else 60 s for bodyweight, 90 s with weights. */
export const defaultRestS = (m: MoveDef | null) => (m?.weighted ? 90 : 60);

export interface PlannedSet {
  move: string;
  reps?: number;
  holdS?: number;
  restS?: number;
  /** Custom trainings (ADR-0047): the target heart zone 1–5, and the effort out of 10 without a sensor. */
  zone?: number;
  rpe?: number;
  /** Done the easier way (cameraReady.ts easierOf: a chair behind you, hands on a wall): the screens say how. */
  easier?: boolean;
  /** "Your own workout" (ADR-0061): the words you wrote for a step the catalogue doesn't have (own-reps / own-timed). */
  label?: string;
}

export class CameraWorkoutEngine {
  readonly startedMs: number;
  state: "idle" | "set" | "rest" = "idle";
  set: CurrentSet | null = null;
  readonly log: CameraMoveLog[] = [];
  restUntilMs = 0;
  private counter: { push(f: PoseFrame): { reps: RepEvent[]; partials?: unknown[] }; sig?: SignalSpec } | null = null;
  private timer: { push(f: PoseFrame): CueId[] | []; heldS: number; status?: () => HoldStatus } | null = null;
  private trackedS = 0;
  private workS = 0;
  private lastFrameMs = 0;
  private frames: PoseFrame[] = [];
  private lastFraming: string | null = null;
  private lastDetectT = -Infinity;
  private pendingFraming: { key: string; since: number } | null = null;
  readonly liveness: LivenessChecker;
  /** Seconds paused (not counted as session time for liveness scheduling). */
  private pausedMs = 0;
  private pausedAt = 0;
  heart: "watch" | "strap" | undefined;
  /**
   * No new liveness check while true (the hands-free flow's demo and countdown: you're watching the screen, not
   * resting). A check already asked runs to its end.
   */
  noChecks = false;

  constructor(nowMs: number, rnd: () => number) {
    this.startedMs = nowMs;
    this.liveness = new LivenessChecker(rnd);
  }

  get paused() {
    return this.pausedAt > 0;
  }
  pause(nowMs: number) {
    if (!this.pausedAt) this.pausedAt = nowMs;
    this.liveness.cancel();
  }
  resume(nowMs: number) {
    if (this.pausedAt) this.pausedMs += nowMs - this.pausedAt;
    this.pausedAt = 0;
  }

  sessionS(nowMs: number) {
    return Math.max(0, (nowMs - this.startedMs - this.pausedMs - (this.pausedAt ? nowMs - this.pausedAt : 0)) / 1000);
  }

  /** Starts a set: of a move (by id), or `null` to detect it from the movement. */
  startSet(nowMs: number, moveId: string | null, o: { loadKg?: number; side?: "l" | "r" } = {}) {
    const move = moveId ? (cameraMove(moveId) ?? null) : null;
    this.liveness.cancel();
    this.set = {
      move,
      startedMs: nowMs,
      reps: 0,
      holdS: 0,
      ...(o.loadKg ? { loadKg: o.loadKg } : {}),
      ...(o.side ? { side: o.side } : {}),
      manual: !!move && move.judge === "manual",
      firstRepMs: 0,
      lastRepMs: 0,
      roms: [],
      tempos: [],
      cues: new Set(),
      adjusted: false,
      limited: 0,
      uncertain: 0,
    };
    this.frames = [];
    this.arm(move);
    this.state = "set";
  }

  /**
   * Starts a set of a move recognised from these frames (the hands-free flow's own detection, cameraFlow.ts): its
   * reps so far count, and the counter replays the frames so the next rep isn't missed. Like a set that started on
   * "just start moving" and named the move.
   */
  startDetected(nowMs: number, moveId: string, reps: number, frames: readonly PoseFrame[], o: { loadKg?: number } = {}) {
    this.startSet(nowMs, null, o);
    const m = cameraMove(moveId);
    if (m) this.adopt(m, reps, frames, nowMs);
  }

  private adopt(move: MoveDef, reps: number, frames: readonly PoseFrame[], _nowMs: number) {
    const s = this.set!;
    s.move = move;
    s.manual = move.judge === "manual";
    s.reps = reps;
    // The frames' clock (the reps' times are frame times too; the screen's clock may differ from it).
    // No frames (a hold recognised without a window): 0 = not known yet, the first rep sets it (never the screen's clock).
    const at = frames.length ? frames[frames.length - 1]!.t : 0;
    s.firstRepMs = at;
    s.lastRepMs = at;
    this.arm(move);
    // Bring the counter to the same place: replay the window so the next rep isn't missed.
    if (this.counter) for (const x of frames) this.counter.push(x);
    // A hold recognised from the window: the seconds already held count.
    if (this.timer && frames.length) {
      for (const x of frames) this.timer.push(x);
      s.holdS = this.timer.heldS;
    }
    this.frames = [];
  }

  private arm(move: MoveDef | null) {
    this.counter = null;
    this.timer = null;
    if (move && "custom" in move) {
      // A move you taught (ADR-0047): its template counts it.
      const tpl = (move as CustomMoveDef).custom.template;
      if (tpl.kind === "reps") this.counter = new TemplateCounter(tpl);
      else this.timer = new TemplateHold(tpl);
      return;
    }
    if (!move || move.judge === "manual" || !move.sig) return;
    // Every angle the move is counted from (cameraReady.ts MoveCounter: a push-up side-on or facing the phone).
    if (move.kind === "reps" && move.rep) this.counter = moveCounter(move);
    if (move.kind === "hold" && move.hold) this.timer = new HoldTimer(move.sig, move.hold, move.guards ?? [], move.cues ?? []);
  }

  /** Switch the set's move (a lookalike: "it's a goblet squat"), keeping its count. */
  switchMove(moveId: string) {
    const m = cameraMove(moveId);
    if (!m || !this.set) return;
    const same = this.set.move && this.set.move.sig && m.sig && JSON.stringify(this.set.move.sig) === JSON.stringify(m.sig);
    this.set.move = m;
    this.set.manual = m.judge === "manual";
    if (!same) this.arm(m);
  }

  /** +1 / −1 on the count (the camera missed or added one), or a typed count for a manual move. */
  adjust(delta: number) {
    if (!this.set) return;
    this.set.reps = Math.max(0, this.set.reps + delta);
    this.set.adjusted = true;
  }
  setReps(n: number) {
    if (!this.set) return;
    this.set.reps = Math.max(0, Math.round(n));
    this.set.adjusted = true;
  }
  /** A manual hold's time (you timed it). */
  setHold(s: number) {
    if (!this.set) return;
    this.set.holdS = Math.max(0, Math.round(s));
    this.set.adjusted = true;
  }
  setLoad(kg: number | undefined) {
    if (!this.set) return;
    if (kg && kg > 0) this.set.loadKg = Math.round(kg * 10) / 10;
    else delete this.set.loadKg;
  }

  /** Ends the set: logs it and starts the rest timer. Returns what was logged (null when nothing was done). */
  endSet(nowMs: number, restS?: number): CameraSet | null {
    const s = this.set;
    this.state = "rest";
    this.restUntilMs = nowMs + (restS ?? defaultRestS(s?.move ?? null)) * 1000;
    this.set = null;
    this.counter = null;
    this.timer = null;
    if (!s || !s.move || (s.reps <= 0 && s.holdS < 1)) return null;
    const judged: CameraJudge = s.manual ? "manual" : s.adjusted || s.move.judge === "count" ? "count" : "camera";
    const set: CameraSet = { reps: s.reps, judged };
    if (s.holdS >= 1) set.holdS = Math.round(s.holdS);
    if (s.loadKg) set.loadKg = s.loadKg;
    if (s.side) set.side = s.side;
    if (s.roms.length) set.romPct = median(s.roms);
    if (s.tempos.length) set.tempoS = Math.round((s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length) * 10) / 10;
    if (s.cues.size) set.cues = [...s.cues].slice(0, 6);
    // Camera-counted work: first rep to last (plus one rep's time), or the hold. Manual sets count none.
    if (!s.manual) {
      if (s.holdS >= 1) this.workS += s.holdS;
      else if (s.reps > 0 && s.firstRepMs) {
        const avg = s.tempos.length ? s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length : 2;
        this.workS += Math.min((s.lastRepMs - s.firstRepMs) / 1000 + avg, s.reps * CAMERA_POINTS.maxRepS);
      }
    }
    const entry = this.log.find((m) => m.id === s.move!.id) ?? this.log[this.log.push({ id: s.move.id, sets: [] }) - 1]!;
    entry.sets.push(set);
    return set;
  }

  /** Feeds one frame (or null: nobody in the picture). Returns what happened. */
  push(f: PoseFrame | null, nowMs: number): CameraEvent[] {
    const out: CameraEvent[] = [];
    const rep = this.framingNow(f);
    const fr = rep.state;
    // Said on screen once it held a second (the first one at once): a joint flickering doesn't flash the banner.
    const key = `${fr}|${rep.missing.join(",")}|${rep.tips.join(",")}`;
    if (key === this.lastFraming) this.pendingFraming = null;
    else {
      if (!this.pendingFraming || this.pendingFraming.key !== key) this.pendingFraming = { key, since: nowMs };
      if (this.lastFraming === null || nowMs - this.pendingFraming.since >= FRAMING_STEADY_MS) {
        this.lastFraming = key;
        this.pendingFraming = null;
        out.push({ type: "framing", framing: fr, missing: rep.missing, tips: rep.tips });
      }
    }
    const dt = this.lastFrameMs ? Math.min(0.5, Math.max(0, (nowMs - this.lastFrameMs) / 1000)) : 0;
    this.lastFrameMs = nowMs;
    if (this.paused) return out;
    if (f && fr !== "none") this.trackedS += dt;

    // Liveness: during rest only, when due.
    const sessS = this.sessionS(nowMs);
    if (this.liveness.active) {
      const r = this.liveness.push(f, nowMs);
      if (r) out.push({ type: "livenessResult", result: r });
    } else if (!this.noChecks && this.liveness.due(sessS, this.state === "rest" || this.state === "idle") && fr !== "none") {
      out.push({ type: "liveness", kind: this.liveness.ask(nowMs, sessS, f) });
    }
    if (this.state === "rest" && this.restUntilMs && nowMs >= this.restUntilMs) {
      this.restUntilMs = 0;
      out.push({ type: "restOver" });
    }
    if (this.state !== "set" || !this.set || !f) return out;
    const s = this.set;

    if (!s.move) {
      this.frames.push(f);
      // The frames' own clock (session time), not the screen's (`nowMs`): mixing them emptied the window every frame.
      const cutoff = f.t - DETECT.windowMs;
      while (this.frames.length && this.frames[0]!.t < cutoff) this.frames.shift();
      // Every half second (each look replays the window through every candidate).
      if (f.t - this.lastDetectT < 500) return out;
      this.lastDetectT = f.t;
      const d = detectMove(this.frames);
      if (d) {
        this.adopt(d.move, d.reps, this.frames, nowMs);
        out.push({ type: "detected", move: d.move.id, reps: d.reps });
      }
      return out;
    }
    if (this.counter) {
      const { reps, partials = [] } = this.counter.push(f);
      for (const r of reps) {
        s.reps++;
        if (!s.firstRepMs) s.firstRepMs = r.t - r.durS * 1000;
        s.lastRepMs = r.t;
        s.roms.push(r.romPct);
        s.tempos.push(r.durS);
        r.cues.forEach((c) => s.cues.add(c));
        if (r.quality === "limited") s.limited++;
        if (r.quality === "uncertain") s.uncertain++;
        const sig = this.counter.sig;
        const side = sig && "side" in sig && sig.side === "alt" ? (r.ch === 0 ? "l" : "r") : undefined;
        out.push({ type: "rep", n: s.reps, ...(side ? { side } : {}), cues: r.cues, ...(r.quality ? { quality: r.quality } : {}) });
      }
      if (partials.length) {
        s.cues.add("depth");
        out.push({ type: "partial" });
      }
    } else if (this.timer) {
      const before = Math.floor(s.holdS);
      const cues = this.timer.push(f);
      s.holdS = this.timer.heldS;
      cues.forEach((c) => s.cues.add(c));
      if (cues.length) out.push({ type: "holdCue", cues });
      if (Math.floor(s.holdS) !== before) out.push({ type: "hold", s: Math.floor(s.holdS) });
    }
    return out;
  }

  /**
   * The hold's timer now (a hold set counted by the camera): waiting for the position, settling in, holding, a
   * wobble, tracking lost, broken. Null outside a camera-timed hold.
   */
  holdStatus(): HoldStatus | null {
    return this.timer?.status ? this.timer.status() : null;
  }

  /** The framing guide for the set's move (its parts of the body), or the whole body but head and feet. */
  framingNow(f: PoseFrame | null): FramingReport {
    const m = this.set?.move ?? null;
    // A move counted from more than one angle (cameraReady.ts countViews) doesn't get a "turn side-on" tip.
    return framingReport(f, m ? { need: moveNeeds(m), view: countViews(m).length > 1 ? "either" : m.view } : { need: DETECT_AREAS });
  }

  /** The summary to upload (ends a set still open first). */
  summary(nowMs: number): CameraSummary | null {
    if (this.state === "set") this.endSet(nowMs, 0);
    this.liveness.cancel();
    if (!this.log.length) return null;
    const checks = this.liveness.results.map((r) => ({ t: r.t, kind: r.kind, ok: r.ok, ...(r.ms !== undefined ? { ms: r.ms } : {}) }));
    return {
      v: 1,
      moves: this.log.map((m) => ({ id: m.id, sets: m.sets.map((s) => ({ ...s })) })),
      trackedS: Math.round(this.trackedS),
      workS: Math.round(this.workS),
      liveness: { asked: checks.length, passed: checks.filter((c) => c.ok).length, ...(checks.length ? { checks } : {}) },
      ...(this.heart ? { heart: this.heart } : {}),
    };
  }

  /** The VVake sport this session is saved as. */
  sport(): MoveDef["sport"] {
    return cameraSessionSport(this.log.map((m) => m.id));
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2);
}

// ── Routines ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface CameraRoutine {
  id: string;
  name: { en: string; fr: string };
  /** Minutes it takes about. */
  minutes: number;
  equipment: "none" | "dumbbells" | "barbell" | "kettlebell";
  sets: PlannedSet[];
  /** How its rests may follow the heart (cameraHeart.ts): "flex" (default) or "fixed" (intervals: never shortened). */
  rest?: "flex" | "fixed";
  /** Who it's for (the starter routines say it; the picker shows it). */
  level?: "beginner" | "intermediate" | "advanced";
  /** No jumping (kind to joints and neighbours); a short wake-up routine (the daily rhythm links it). */
  tags?: readonly ("low-impact" | "morning")[];
  /** One line under its name. */
  about?: { en: string; fr: string };
}

const rx = (move: string, n: number, sets: number, restS: number, hold = false, easier = false): PlannedSet[] =>
  Array.from({ length: sets }, () => ({ move, ...(hold ? { holdS: n } : { reps: n }), restS, ...(easier ? { easier: true } : {}) }));

export const CAMERA_ROUTINES: readonly CameraRoutine[] = [
  // Starter routines (tester report 2026-10-26), with the starter moves (chair squat, wall push-up, march, knee raise,
  // arm circles); a march counts each knee lift.
  {
    id: "beginner-full-body",
    name: { en: "Beginner full body", fr: "Corps complet débutant" },
    about: {
      en: "Chair squats, incline push-ups, reverse lunges, a short plank, marching.",
      fr: "Squats sur chaise, pompes inclinées, fentes arrière, courte planche, marche sur place.",
    },
    minutes: 14,
    equipment: "none",
    level: "beginner",
    sets: [
      ...rx("chair-squat", 10, 2, 45),
      ...rx("incline-push-up", 8, 2, 45),
      ...rx("reverse-lunge", 16, 2, 45),
      ...rx("plank", 20, 2, 30, true),
      ...rx("march", 40, 2, 30),
    ],
  },
  {
    id: "low-impact",
    name: { en: "Low impact, beginner", fr: "Sans impact, débutant" },
    about: {
      en: "No jumps: chair squats, wall push-ups, knee raises, calf raises, stretches.",
      fr: "Sans saut : squats sur chaise, pompes au mur, montées de genou, mollets, étirements.",
    },
    minutes: 13,
    equipment: "none",
    level: "beginner",
    tags: ["low-impact"],
    sets: [
      ...rx("chair-squat", 10, 2, 45),
      ...rx("incline-push-up", 8, 2, 45),
      ...rx("standing-knee-raise", 10, 2, 30),
      ...rx("calf-raise", 15, 2, 30),
      ...rx("hamstring-stretch", 30, 1, 15, true),
      ...rx("overhead-reach", 30, 1, 15, true),
    ],
  },
  {
    id: "morning-activation",
    name: { en: "Morning activation", fr: "Réveil musculaire" },
    about: { en: "Seven easy minutes to wake the body up.", fr: "Sept minutes tranquilles pour réveiller le corps." },
    minutes: 7,
    equipment: "none",
    level: "beginner",
    tags: ["morning", "low-impact"],
    sets: [
      ...rx("march", 60, 1, 10),
      ...rx("squat", 10, 1, 20),
      ...rx("arm-circles", 30, 1, 10, true),
      ...rx("reverse-lunge", 10, 1, 20),
      ...rx("calf-raise", 15, 1, 15),
      ...rx("hamstring-stretch", 30, 1, 10, true),
      ...rx("overhead-reach", 30, 1, 10, true),
    ],
  },
  {
    id: "intermediate-full-body",
    name: { en: "Intermediate full body", fr: "Corps complet intermédiaire" },
    about: {
      en: "Squats, push-ups, lunges, mountain climbers, plank: 3 rounds.",
      fr: "Squats, pompes, fentes, mountain climbers, planche : 3 séries.",
    },
    minutes: 25,
    equipment: "none",
    level: "intermediate",
    sets: [
      ...rx("squat", 15, 3, 45),
      ...rx("push-up", 10, 3, 60),
      ...rx("reverse-lunge", 20, 3, 45),
      ...rx("mountain-climber", 30, 3, 30),
      ...rx("plank", 40, 3, 30, true),
    ],
  },
  {
    id: "full-body-bw",
    name: { en: "Full body, no equipment", fr: "Corps complet, sans matériel" },
    minutes: 20,
    equipment: "none",
    sets: [
      ...rx("squat", 15, 3, 45),
      ...rx("push-up", 10, 3, 45),
      ...rx("reverse-lunge", 12, 2, 45),
      ...rx("glute-bridge", 15, 2, 30),
      ...rx("plank", 40, 2, 30, true),
    ],
  },
  {
    id: "hiit-10",
    name: { en: "10-minute cardio blast", fr: "Cardio express 10 minutes" },
    minutes: 10,
    equipment: "none",
    rest: "fixed",
    sets: [
      ...rx("jumping-jack", 30, 2, 20),
      ...rx("high-knees", 30, 2, 20),
      ...rx("mountain-climber", 24, 2, 20),
      ...rx("burpee", 8, 2, 30),
    ],
  },
  {
    id: "dumbbell-full",
    name: { en: "Dumbbell full body", fr: "Corps complet aux haltères" },
    minutes: 30,
    equipment: "dumbbells",
    sets: [
      ...rx("goblet-squat", 10, 3, 90),
      ...rx("romanian-deadlift", 10, 3, 90),
      ...rx("overhead-press", 8, 3, 90),
      ...rx("bent-over-row", 10, 3, 75),
      ...rx("biceps-curl", 12, 2, 60),
      ...rx("lateral-raise", 12, 2, 60),
    ],
  },
  {
    id: "barbell-basics",
    name: { en: "Barbell basics", fr: "Les bases à la barre" },
    minutes: 40,
    equipment: "barbell",
    sets: [
      ...rx("back-squat", 5, 5, 150),
      ...rx("bench-press", 5, 3, 150),
      ...rx("deadlift", 5, 3, 180),
      ...rx("overhead-press", 6, 3, 120),
    ],
  },
  {
    id: "kettlebell-20",
    name: { en: "Kettlebell 20", fr: "Kettlebell 20" },
    minutes: 20,
    equipment: "kettlebell",
    sets: [
      ...rx("kettlebell-swing", 15, 4, 60),
      ...rx("goblet-squat", 10, 3, 60),
      ...rx("clean", 8, 2, 60),
      ...rx("farmer-carry", 40, 2, 45, true),
    ],
  },
  {
    id: "core-10",
    name: { en: "Core 10", fr: "Gainage 10" },
    minutes: 10,
    equipment: "none",
    sets: [...rx("plank", 45, 2, 30, true), ...rx("sit-up", 15, 2, 30), ...rx("leg-raise", 12, 2, 30), ...rx("bird-dog", 10, 2, 30)],
  },
  {
    id: "mobility-10",
    name: { en: "Mobility 10", fr: "Mobilité 10" },
    minutes: 10,
    equipment: "none",
    sets: [
      ...rx("deep-squat-hold", 45, 2, 15, true),
      ...rx("hamstring-stretch", 40, 2, 15, true),
      ...rx("downward-dog", 40, 2, 15, true),
      ...rx("quad-stretch", 30, 2, 15, true),
      ...rx("overhead-reach", 30, 1, 15, true),
    ],
  },
];

/**
 * A routine for today's planned session (the coach's plan): strength → the dumbbell full body (or bodyweight without
 * weights), core → core, flexibility / recovery → mobility, HIIT → the cardio blast.
 *
 * Longer planned minutes never repeat the whole routine (tester report 2026-10-27: a 45-minute strength day ran the
 * dumbbell full body twice, 6 sets of every move, without saying so: that was this function's "× 2"). A session at
 * least half again as long as a strength routine gets one more set of the moves that already have three (never past
 * four); anything longer stays the routine, honestly timed. A 10-minute circuit may run twice, as 2 rounds shown and
 * announced (cameraPlan.ts planRounds).
 */
export function routineForPlan(sport: string, minutes: number, hasWeights: boolean): CameraRoutine | null {
  const pick = (id: string) => CAMERA_ROUTINES.find((r) => r.id === id)!;
  let base: CameraRoutine | null = null;
  if (sport === "strength" || sport === "lifter") base = hasWeights ? pick("dumbbell-full") : pick("full-body-bw");
  else if (sport === "functional-strength" || sport === "cross-training") base = pick("full-body-bw");
  else if (sport === "core" || sport === "pilates") base = pick("core-10");
  else if (sport === "flexibility" || sport === "recovery" || sport === "cooldown" || sport === "yoga" || sport === "mind-body")
    base = pick("mobility-10");
  else if (sport === "hiit" || sport === "mixed-cardio") base = pick("hiit-10");
  if (!base) return null;
  if (minutes < base.minutes * 1.5) return base;
  // A short circuit (10 minutes: core, mobility, the cardio blast): twice through, as 2 rounds the screen shows and
  // the voice announces ("Round 2 of 2: same moves again.").
  if (base.minutes <= 10)
    return { ...base, id: `${base.id}-x2`, minutes: base.minutes * 2, sets: [...base.sets, ...base.sets].map((x) => ({ ...x })) };
  // One more set of each main move (three sets → four), in place: the same order, no repeated sequence.
  const sets: PlannedSet[] = [];
  base.sets.forEach((s, i) => {
    sets.push(s);
    const last = i === base!.sets.length - 1 || base!.sets[i + 1]!.move !== s.move;
    const runOf = base!.sets.filter((x) => x.move === s.move).length;
    if (last && runOf === 3) sets.push({ ...s });
  });
  if (sets.length === base.sets.length) return base;
  return { ...base, id: `${base.id}-plus`, minutes: Math.round((base.minutes * sets.length) / base.sets.length), sets };
}
