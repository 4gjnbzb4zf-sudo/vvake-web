// Copied from VVFit packages/game-core/src/cameraFlow.ts (322f91e 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts, hands-free (ADR-0046 amendment 2026-10-21). Founder, after build 34: "It's video training mode:
 * the user should not have to go to the phone and tap or type to be recognised." One tap on Start, then the session
 * runs on its own until the routine is done:
 *
 *   demo (each new move, full screen, played twice) → countdown 3-2-1 → set (reps or the hold counted from the pose)
 *   → the set ends by itself (target reached, you stopped moving for 7 s, the hold's time) → rest (big timer; liveness
 *   checks during rest are pose-only, as before) → the next set, or the next move's demo → … → done.
 *
 * Without a routine ("just start moving"): VVake recognises the move you're doing, counts it, ends the set when you
 * stop, and starts a new set when you move again; when you change moves it switches on its own (only once the other
 * move is clear for 1.5 s and the current one has stopped for 3 s: no flicker between lookalikes).
 *
 * Pure, like the engine it drives (cameraSession.ts): the screen feeds frames and the clock, draws the phase, says
 * the events. The points rules don't change (cameraPoints.ts): the same engine logs the same sets and checks.
 */
import type { CameraSet } from "./cameraPoints";
import { cameraMove, type MoveDef } from "./cameraMoves";
import { CameraWorkoutEngine, defaultRestS, type CameraEvent, type CameraRoutine, type PlannedSet } from "./cameraSession";
import { DETECT, detectMove } from "./cameraDetect";
import { demoLoop, demoMs, targetText, type DemoLoop } from "./cameraDemo";
import type { PoseFrame } from "./cameraPose";
import type { CameraSummary } from "./cameraPoints";
import { CAMERA_HEART, restHeartDecision, restHeartLine, type RestRule } from "./cameraHeart";

export const HANDS_FREE = {
  /** The 3-2-1 before each set. */
  countdownMs: 3000,
  /** No rep for this long, after at least one: the set is over. */
  idleEndMs: 7000,
  /** A hold that stopped (out of position) this long, after at least `holdMinS`: the set is over. */
  holdIdleEndMs: 6000,
  holdMinS: 3,
  /** Nothing counted this long since the set started: move on (never stuck waiting for a tap). */
  nothingMs: 60_000,
  /** A move the camera can't count: a timed set (the routine's reps × 3 s, else 40 s; a hold: its time, else 30 s). */
  manualRepS: 3,
  manualS: 40,
  holdS: 30,
  /** A single move picked without a routine: this many sets. */
  singleMoveSets: 3,
  /** "Just start moving": how often the move is recognised, and the switch's hysteresis. */
  detectEveryMs: 500,
  switchSteadyMs: 1500,
  switchQuietMs: 3000,
  /** "Just start moving": nothing for this long after a set, the workout is over. */
  freeDoneMs: 150_000,
} as const;

export type FlowPhase = "demo" | "countdown" | "set" | "rest" | "ready" | "done";
export type SetEndReason = "target" | "idle" | "time" | "switch" | "nothing";

export type FlowEvent =
  | Exclude<CameraEvent, { type: "restOver" }>
  /** A new move's demo starts a loop (1, then 2). */
  | { type: "demo"; move: string; loop: number; target: PlannedSet | null }
  | { type: "countdown"; n: number }
  /** Counting starts: `setNo` of `sets` (the plan's sets of this move; 0 / 0 without a plan). */
  | { type: "go"; move: string | null; setNo: number; sets: number }
  | { type: "setEnd"; move: string | null; set: CameraSet | null; reason: SetEndReason }
  | { type: "rest"; untilMs: number; restS: number; next: PlannedSet | null }
  /** The rest followed the heart (cameraHeart.ts): stretched (`addS`) or the next set soon (`leftS`). */
  | { type: "restHeart"; kind: "extend"; addS: number; untilMs: number }
  | { type: "restHeart"; kind: "shorten"; leftS: number; untilMs: number }
  | { type: "done" };

export interface FlowOptions {
  routine?: CameraRoutine | null;
  /** A single move picked (no routine): `HANDS_FREE.singleMoveSets` sets of it. */
  move?: string | null;
  /** The last load used per move (kg): weighted sets start with it, never asked during the workout. */
  loads?: Readonly<Record<string, number>>;
}

/** The plan a routine or a single move makes (null: "just start moving"). */
export function flowPlan(o: FlowOptions): PlannedSet[] | null {
  if (o.routine?.sets.length) return o.routine.sets.map((s) => ({ ...s }));
  const m = o.move ? cameraMove(o.move) : undefined;
  if (!m) return null;
  return Array.from({ length: HANDS_FREE.singleMoveSets }, () => ({
    move: m.id,
    ...(m.kind === "hold" ? { holdS: HANDS_FREE.holdS } : {}),
  }));
}

/** A camera-counted move's set, or a timed one (the camera can't count it): its length (ms). */
export function manualSetMs(m: MoveDef, t: PlannedSet | null): number {
  if (m.kind === "hold") return (t?.holdS ?? HANDS_FREE.holdS) * 1000;
  return (t?.reps ? t.reps * HANDS_FREE.manualRepS : HANDS_FREE.manualS) * 1000;
}

export class HandsFreeWorkout {
  readonly engine: CameraWorkoutEngine;
  readonly plan: PlannedSet[] | null;
  phase: FlowPhase = "ready";
  phaseStartMs = 0;
  phaseUntilMs = 0;
  /** The planned set in progress, or next (null without a plan, or when done). */
  idx = 0;
  /** The demo playing (demo phase), built once per move. */
  demo: DemoLoop | null = null;
  private demoLoopNo = 0;
  private countN = 0;
  private loads: Record<string, number>;
  private buf: PoseFrame[] = [];
  private lastDetectMs = 0;
  private cand: { id: string; since: number } | null = null;
  /** "Just start moving": the winner of the last look (a move starts when two looks in a row agree). */
  private startCand: string | null = null;
  private lastActivityMs: number;
  private holdGrowMs = 0;
  /** The last rep (the screen's clock: frame times may run on another one). */
  private lastRepAt = 0;
  /** …and its frame's time (the frames after it are what a new move is recognised from). */
  private lastRepFrameT = -Infinity;
  private lastHoldS = 0;
  private resumedMs = 0;
  private pausedAt = 0;
  /** The heart now (the screen sets it from cameraHeart.ts before each push; null: no fresh reading). */
  private heartNow: { bpm: number; zone: number } | null = null;
  private recoveredSince: number | null = null;
  private restPlannedS = 0;
  private restExtraS = 0;
  private restShortened = false;
  /** How this plan's rests may follow the heart. */
  readonly restRule: RestRule;

  constructor(nowMs: number, rnd: () => number, o: FlowOptions = {}) {
    this.engine = new CameraWorkoutEngine(nowMs, rnd);
    this.plan = flowPlan(o);
    this.loads = { ...(o.loads ?? {}) };
    this.lastActivityMs = nowMs;
    // The screen's clock starts here (any epoch: Date.now on a phone), so the detection pace doesn't depend on it.
    this.lastDetectMs = nowMs;
    this.restRule = o.routine?.rest ?? "flex";
  }

  /** The heart rate now (bpm and zone), or null when there's no fresh reading: planned rests follow it. */
  setHeart(h: { bpm: number; zone: number } | null, nowMs: number) {
    this.heartNow = h;
    if (h && h.zone <= CAMERA_HEART.recoveredZone) this.recoveredSince ??= nowMs;
    else this.recoveredSince = null;
  }

  /** Seconds the heart added to the rest on now. */
  get restExtra() {
    return this.restExtraS;
  }

  get free() {
    return this.plan === null;
  }
  get paused() {
    return this.pausedAt > 0;
  }
  /** The planned set in progress (or next), its target. */
  get target(): PlannedSet | null {
    return this.plan?.[this.idx] ?? null;
  }
  /** The set after this one (the rest screen's "Next"). */
  get upNext(): PlannedSet | null {
    if (!this.plan) return null;
    return this.phase === "rest" ? (this.plan[this.idx] ?? null) : (this.plan[this.idx + 1] ?? null);
  }
  /** "Set 2 of 3" of this move in the plan. */
  setOf(i = this.idx): { n: number; of: number } {
    if (!this.plan || !this.plan[i]) return { n: 0, of: 0 };
    const id = this.plan[i]!.move;
    let a = i;
    while (a > 0 && this.plan[a - 1]!.move === id) a--;
    let b = i;
    while (b + 1 < this.plan.length && this.plan[b + 1]!.move === id) b++;
    return { n: i - a + 1, of: b - a + 1 };
  }
  /** The load the next set of this move starts with (kg). */
  loadFor(moveId: string): number | undefined {
    return this.loads[moveId];
  }
  setLoad(moveId: string, kg: number | undefined) {
    if (kg && kg > 0) this.loads[moveId] = Math.round(kg * 10) / 10;
    else delete this.loads[moveId];
  }
  get allLoads(): Readonly<Record<string, number>> {
    return this.loads;
  }

  /** After the one tap on Start: the first move's demo, or (no plan) waiting for you to move. */
  start(nowMs: number): FlowEvent[] {
    if (!this.plan) {
      this.enter("ready", nowMs, 0);
      return [];
    }
    return this.beginPlanned(nowMs);
  }

  pause(nowMs: number) {
    if (this.pausedAt || this.phase === "done") return;
    this.pausedAt = nowMs;
    this.engine.pause(nowMs);
  }
  resume(nowMs: number) {
    if (!this.pausedAt) return;
    const d = nowMs - this.pausedAt;
    this.pausedAt = 0;
    this.engine.resume(nowMs);
    this.phaseStartMs += d;
    if (this.phaseUntilMs) this.phaseUntilMs += d;
    if (this.engine.restUntilMs) this.engine.restUntilMs += d;
    this.resumedMs = nowMs;
    this.lastActivityMs = nowMs;
    this.buf = [];
  }

  /** Feeds a frame (null: nobody in the picture) and the clock: what happened. Call it on every frame. */
  push(f: PoseFrame | null, nowMs: number): FlowEvent[] {
    this.engine.noChecks = this.phase === "demo" || this.phase === "countdown" || this.phase === "done";
    const out: FlowEvent[] = this.engine
      .push(f, nowMs)
      .filter((e): e is Exclude<CameraEvent, { type: "restOver" }> => e.type !== "restOver");
    if (this.paused || this.phase === "done") return out;
    if (f) {
      this.buf.push(f);
      // The frames' own clock (session time): never the screen's clock, which is another one (Date.now on the phone).
      const cutoff = f.t - DETECT.windowMs;
      while (this.buf.length && this.buf[0]!.t < cutoff) this.buf.shift();
    }
    switch (this.phase) {
      case "demo":
        this.tickDemo(nowMs, out);
        break;
      case "countdown":
        this.tickCountdown(nowMs, out);
        break;
      case "set":
        this.tickSet(nowMs, out, f);
        break;
      case "rest":
        if (this.free && this.detectStart(nowMs, out)) break;
        if (this.plan) this.heartRest(nowMs, out);
        if (nowMs >= this.phaseUntilMs && !this.engine.liveness.active) {
          if (this.plan) out.push(...this.beginPlanned(nowMs));
          else this.enter("ready", nowMs, 0);
        }
        break;
      case "ready":
        if (this.detectStart(nowMs, out)) break;
        if (this.engine.log.length && nowMs - this.lastActivityMs >= HANDS_FREE.freeDoneMs && !this.engine.liveness.active)
          this.finishFlow(out);
        break;
    }
    return out;
  }

  /** The summary to upload (ends a set still open first); the flow is done. */
  summary(nowMs: number): CameraSummary | null {
    this.phase = "done";
    return this.engine.summary(nowMs);
  }

  // ── Phases ──────────────────────────────────────────────────────────────────────────────────────────────────

  private enter(p: FlowPhase, nowMs: number, durMs: number) {
    this.phase = p;
    this.phaseStartMs = nowMs;
    this.phaseUntilMs = durMs ? nowMs + durMs : 0;
  }

  /** The planned set at `idx`: a demo when the move is new, else straight to the countdown. */
  private beginPlanned(nowMs: number): FlowEvent[] {
    const t = this.target;
    if (!t) {
      const out: FlowEvent[] = [];
      this.finishFlow(out);
      return out;
    }
    const prev = this.idx > 0 ? this.plan![this.idx - 1]!.move : null;
    if (prev !== t.move) {
      this.demo = demoLoop(t.move);
      this.demoLoopNo = 1;
      this.enter("demo", nowMs, demoMs(t.move));
      return [{ type: "demo", move: t.move, loop: 1, target: t }];
    }
    return this.beginCountdown(nowMs);
  }

  private tickDemo(nowMs: number, out: FlowEvent[]) {
    const loop = this.demo ? 1 + Math.floor((nowMs - this.phaseStartMs) / this.demo.loopMs) : 1;
    if (nowMs >= this.phaseUntilMs) {
      out.push(...this.beginCountdown(nowMs));
      return;
    }
    if (loop > this.demoLoopNo) {
      this.demoLoopNo = loop;
      out.push({ type: "demo", move: this.target?.move ?? "", loop, target: this.target });
    }
  }

  private beginCountdown(nowMs: number): FlowEvent[] {
    this.enter("countdown", nowMs, HANDS_FREE.countdownMs);
    this.countN = 3;
    return [{ type: "countdown", n: 3 }];
  }

  private tickCountdown(nowMs: number, out: FlowEvent[]) {
    if (nowMs >= this.phaseUntilMs) {
      const t = this.target;
      const load = t ? this.loads[t.move] : undefined;
      this.engine.startSet(nowMs, t?.move ?? null, load ? { loadKg: load } : {});
      this.startedSet(nowMs);
      const so = this.setOf();
      out.push({ type: "go", move: t?.move ?? null, setNo: so.n, sets: so.of });
      return;
    }
    const n = Math.max(1, 3 - Math.floor((nowMs - this.phaseStartMs) / 1000));
    if (n !== this.countN) {
      this.countN = n;
      out.push({ type: "countdown", n });
    }
  }

  private startedSet(nowMs: number) {
    this.enter("set", nowMs, 0);
    this.holdGrowMs = nowMs;
    this.lastHoldS = 0;
    this.lastRepAt = 0;
    this.lastRepFrameT = -Infinity;
    this.cand = null;
    this.lastActivityMs = nowMs;
  }

  private tickSet(nowMs: number, out: FlowEvent[], f: PoseFrame | null) {
    const s = this.engine.set;
    if (!s) return;
    const t = this.target;
    const m = s.move;
    for (const e of out) {
      if (e.type === "rep") {
        this.lastRepAt = nowMs;
        if (f) this.lastRepFrameT = f.t;
      }
      if (e.type === "rep" || e.type === "hold" || e.type === "detected") this.lastActivityMs = nowMs;
    }
    if (m && s.holdS > this.lastHoldS + 0.05) {
      this.lastHoldS = s.holdS;
      this.holdGrowMs = nowMs;
    }
    const since = Math.max(this.phaseStartMs, this.resumedMs);
    if (m && m.judge === "manual") {
      // The camera can't count it: a timed set, logged as yours (never camera points), like typing the time.
      if (nowMs - this.phaseStartMs >= manualSetMs(m, t)) {
        this.engine.setHold((nowMs - this.phaseStartMs) / 1000);
        this.endSet(nowMs, "time", out);
      }
      return;
    }
    if (m?.kind === "reps" && t?.reps && s.reps >= t.reps) return this.endSet(nowMs, "target", out);
    if (m?.kind === "hold" && t?.holdS && s.holdS >= t.holdS) return this.endSet(nowMs, "time", out);
    if (m?.kind === "reps" && s.reps > 0 && nowMs - Math.max(this.lastRepAt, since) >= HANDS_FREE.idleEndMs)
      return this.endSet(nowMs, "idle", out);
    if (m?.kind === "hold" && s.holdS >= HANDS_FREE.holdMinS && nowMs - Math.max(this.holdGrowMs, since) >= HANDS_FREE.holdIdleEndMs)
      return this.endSet(nowMs, "idle", out);
    if (s.reps <= 0 && s.holdS < 1 && nowMs - since >= HANDS_FREE.nothingMs) {
      // Planned: move on to the next set. Free: back to waiting for a move (nothing was logged).
      if (this.plan) return this.endSet(nowMs, "nothing", out);
      if (m) {
        this.engine.endSet(nowMs, 0);
        this.enter("ready", nowMs, 0);
      }
      return;
    }
    if (this.free && m && s.reps > 0) this.maybeSwitch(nowMs, out);
  }

  /** "Just start moving": another move, clearly, while this one stopped: a new set of it, no rest between. */
  private maybeSwitch(nowMs: number, out: FlowEvent[]) {
    if (nowMs - this.lastDetectMs < HANDS_FREE.detectEveryMs) return;
    this.lastDetectMs = nowMs;
    const cur = this.engine.set!.move!;
    // Only what came after this move's last rep: the reps it already counted can't outvote the new move.
    const recent = this.buf.filter((x) => x.t > this.lastRepFrameT);
    const d = detectMove(recent);
    const other = d && d.move.id !== cur.id && JSON.stringify(d.move.sig) !== JSON.stringify(cur.sig) ? d : null;
    if (!other) {
      this.cand = null;
      return;
    }
    if (!this.cand || this.cand.id !== other.move.id) this.cand = { id: other.move.id, since: nowMs };
    const quiet = nowMs - this.lastRepAt >= HANDS_FREE.switchQuietMs;
    if (nowMs - this.cand.since >= HANDS_FREE.switchSteadyMs && quiet) {
      this.endSet(nowMs, "switch", out);
      this.buf = recent;
      this.adoptDetected(nowMs, other.move.id, other.reps, out);
    }
  }

  /** Free mode, waiting or resting: a move recognised starts its set at once (its reps so far count). */
  private detectStart(nowMs: number, out: FlowEvent[]): boolean {
    if (this.engine.liveness.active || nowMs - this.lastDetectMs < HANDS_FREE.detectEveryMs) return false;
    this.lastDetectMs = nowMs;
    const d = detectMove(this.buf);
    // The same clear winner twice in a row (hysteresis): one look's answer can depend on where the window starts.
    const prev = this.startCand;
    this.startCand = d ? d.move.id : null;
    if (!d || prev !== d.move.id) return false;
    this.startCand = null;
    this.adoptDetected(nowMs, d.move.id, d.reps, out);
    return true;
  }

  private adoptDetected(nowMs: number, moveId: string, reps: number, out: FlowEvent[]) {
    const load = this.loads[moveId];
    this.engine.startDetected(nowMs, moveId, reps, this.buf, load ? { loadKg: load } : {});
    this.buf = [];
    this.startedSet(nowMs);
    // Reps already counted from the window: the idle clock runs from now.
    this.lastRepAt = nowMs;
    this.lastRepFrameT = this.engine.set?.lastRepMs ?? -Infinity;
    out.push({ type: "detected", move: moveId, reps }, { type: "go", move: moveId, setNo: 0, sets: 0 });
  }

  private endSet(nowMs: number, reason: SetEndReason, out: FlowEvent[]) {
    const s = this.engine.set;
    const move = s?.move?.id ?? null;
    const t = this.target;
    const restS = t?.restS ?? defaultRestS(s?.move ?? null);
    if (move && s?.loadKg) this.loads[move] = s.loadKg;
    const set = this.engine.endSet(nowMs, reason === "switch" ? 0 : restS);
    out.push({ type: "setEnd", move, set, reason });
    this.lastActivityMs = nowMs;
    if (reason === "switch") return;
    if (this.plan) {
      this.idx++;
      if (this.idx >= this.plan.length) return this.finishFlow(out);
    }
    this.enter("rest", nowMs, restS * 1000);
    this.restPlannedS = restS;
    this.restExtraS = 0;
    this.restShortened = false;
    out.push({ type: "rest", untilMs: this.phaseUntilMs, restS, next: this.target && this.plan ? this.target : null });
  }

  /** A planned rest follows the heart: 15 s more while it's still high at the end (≤ 45 s), or sooner once recovered. */
  private heartRest(nowMs: number, out: FlowEvent[]) {
    if (this.engine.liveness.active) return;
    const d = restHeartDecision({
      nowMs,
      restStartMs: this.phaseStartMs,
      restUntilMs: this.phaseUntilMs,
      plannedS: this.restPlannedS,
      extraS: this.restExtraS,
      shortened: this.restShortened,
      rule: this.restRule,
      heart: this.heartNow,
      recoveredSince: this.recoveredSince,
    });
    if (!d) return;
    if (d.kind === "extend") {
      this.restExtraS += d.addS;
      this.phaseUntilMs = Math.max(this.phaseUntilMs, nowMs) + d.addS * 1000;
      out.push({ type: "restHeart", kind: "extend", addS: d.addS, untilMs: this.phaseUntilMs });
    } else {
      this.restShortened = true;
      this.phaseUntilMs = nowMs + d.leftS * 1000;
      out.push({ type: "restHeart", kind: "shorten", leftS: d.leftS, untilMs: this.phaseUntilMs });
    }
    if (this.engine.restUntilMs) this.engine.restUntilMs = this.phaseUntilMs;
  }

  private finishFlow(out: FlowEvent[]) {
    this.phase = "done";
    this.phaseUntilMs = 0;
    this.engine.liveness.cancel();
    out.push({ type: "done" });
  }
}

/**
 * The loads you set at the end (the summary, optional): every set of that move gets it. The camera never sees the
 * load; nothing is asked during the workout.
 */
export function applyLoads(summary: CameraSummary, loads: Readonly<Record<string, number | undefined>>): CameraSummary {
  return {
    ...summary,
    moves: summary.moves.map((m) => {
      const kg = loads[m.id];
      if (kg === undefined) return m;
      return {
        ...m,
        sets: m.sets.map((s) => {
          const x = { ...s };
          if (kg > 0) x.loadKg = Math.round(kg * 10) / 10;
          else delete x.loadKg;
          return x;
        }),
      };
    }),
  };
}

/** The weighted moves of a summary (the loads the summary offers to fill in). */
export function weightedMoves(summary: Pick<CameraSummary, "moves">): string[] {
  return summary.moves.filter((m) => cameraMove(m.id)?.weighted).map((m) => m.id);
}

/**
 * What the coach voice says for the flow's events (both apps say the same): the move and its target once, with the
 * demo; 3-2-1; go; the set done; the rest and what's next; the end. The form cues and counts stay as they were
 * (cameraCues.ts). Null: nothing to say.
 */
export function flowLine(e: FlowEvent, lang: "en" | "fr"): string | null {
  const fr = lang === "fr";
  const name = (id: string | null | undefined) => (id ? (cameraMove(id)?.name[lang] ?? id) : "");
  switch (e.type) {
    case "demo": {
      if (e.loop !== 1) return null;
      const m = cameraMove(e.move) ?? null;
      const zone = e.target?.zone ? (fr ? ` Zone ${e.target.zone}.` : ` Zone ${e.target.zone}.`) : "";
      return `${name(e.move)}. ${targetText(e.target, m, lang)}.${zone}`;
    }
    case "countdown":
      return String(e.n);
    case "go":
      return e.sets ? (fr ? "C’est parti !" : "Go!") : null;
    case "detected":
      return fr ? `${name(e.move)} : je compte.` : `${name(e.move)}: counting.`;
    case "setEnd":
      if (e.reason === "switch") return null;
      if (!e.set) return e.reason === "nothing" ? (fr ? "On passe à la suite." : "Let’s move on.") : null;
      if (e.set.holdS && !e.set.reps) return fr ? `Série terminée : ${e.set.holdS} secondes.` : `Set done: ${e.set.holdS} seconds.`;
      return fr ? `Série terminée : ${e.set.reps}.` : `Set done: ${e.set.reps}.`;
    case "rest":
      if (!e.next)
        return fr
          ? `Repos. Reprends quand tu veux, je reconnais ton mouvement.`
          : `Rest. Start moving when you’re ready: I’ll recognise the move.`;
      return fr ? `Repos ${e.restS} secondes. Ensuite : ${name(e.next.move)}.` : `Rest ${e.restS} seconds. Next: ${name(e.next.move)}.`;
    case "done":
      return fr ? "Séance terminée. Bravo !" : "Workout done. Great work.";
    case "restHeart":
      return e.kind === "extend"
        ? restHeartLine({ kind: "extend", addS: e.addS }, lang)
        : restHeartLine({ kind: "shorten", leftS: e.leftS }, lang);
    default:
      return null;
  }
}
