// Copied from VVFit packages/game-core/src/cameraFlow.ts (e628403d 2026-10-26) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts, hands-free (ADR-0046 amendment 2026-10-21). Founder, after build 34: "It's video training mode:
 * the user should not have to go to the phone and tap or type to be recognised." One tap on Start, then the session
 * runs on its own until the routine is done:
 *
 *   demo (each new move, full screen, played twice) → setup (the readiness check: in the picture, the right angle,
 *   in the start position; cameraReady.ts) → countdown 3-2-1 → set (reps or the hold counted from the pose) → the set
 *   ends by itself (target reached, you stopped moving for 7 s, the hold's time) → rest (the next exercise previewed;
 *   the last seconds ask you to get into position; liveness checks during rest are pose-only, as before) → the next
 *   set, or the next move's demo → … → done.
 *
 * Nothing starts before you're ready (tester report 2026-10-26: a plank timer started before the plank), except your
 * own Start. A hold's timer runs only while you hold the position; a brief tracking loss doesn't pause it, a real
 * break does (and says so), and a manual Start / Resume times it by hand when the camera struggles.
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
import { ReadyGate, readiness as defaultReadiness, type ReadyPrompt, type ReadyReport } from "./cameraReady";
import { easierOf, getReadyLine, promptLine, viewAsk } from "./cameraPrep";
import { progressLine } from "./cameraCues";
import { normalizeVoice } from "./voiceNormalize";

export const HANDS_FREE = {
  /** The 3-2-1 before each set. */
  countdownMs: 3000,
  /** No rep for this long, after at least one: the set is over. */
  idleEndMs: 7000,
  /** "Just start moving": a hold that stopped (out of position) this long, after at least `holdMinS`: the set is over. */
  holdIdleEndMs: 6000,
  holdMinS: 3,
  /** A planned hold: out of position (or out of sight) this long and its timer shows "paused" (a blip isn't a break). */
  holdPauseMs: 2500,
  /** A planned hold: a break this long, after at least `holdMinS`, ends the set (you stopped). */
  holdBreakEndMs: 12_000,
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
  /** During a set, out of sight (or the needed parts out of frame) this long: "I can't see you…" on screen. */
  lostMs: 2500,
  /** The rest's last seconds ask you to get into position (a third of the rest, 5 to 10 s). */
  prepMinS: 5,
  prepMaxS: 10,
  /** The rest you can set during the workout (s). */
  restMinS: 10,
  restMaxS: 300,
} as const;

/** How long the "get into position" part of a rest lasts (s). */
export const restPrepS = (restS: number) => Math.max(HANDS_FREE.prepMinS, Math.min(HANDS_FREE.prepMaxS, Math.round(restS / 3)));

export type FlowPhase = "demo" | "setup" | "countdown" | "set" | "rest" | "ready" | "done";
export type SetEndReason = "target" | "idle" | "time" | "switch" | "nothing" | "skip";
/** A planned hold's timer, as the screen shows it (cameraReps.ts HoldTimer's states folded: settling = waiting,
 * a wobble or a brief loss = holding, a break or a long loss = paused). */
export type FlowHoldState = "waiting" | "holding" | "paused";

/** The readiness check (cameraReady.ts `readiness`); a test or the detection work may hand in another. */
export type ReadinessProbe = (f: PoseFrame | null, m: MoveDef, o: { requirePosition?: boolean }) => ReadyReport;
type Gate = { push(f: PoseFrame | null, nowMs: number): ReadyReport & { readyForMs: number } };

/** ReadyGate's behaviour around another probe: ready once it held a second. */
class ProbeGate implements Gate {
  private since = 0;
  constructor(
    private readonly probe: ReadinessProbe,
    private readonly m: MoveDef,
    private readonly requirePosition: boolean,
  ) {}
  push(f: PoseFrame | null, nowMs: number) {
    const r = this.probe(f, this.m, { requirePosition: this.requirePosition });
    if (r.ready) this.since ||= nowMs;
    else this.since = 0;
    const readyForMs = this.since ? nowMs - this.since : 0;
    const ok = r.ready && readyForMs >= 1000;
    return { ...r, ready: ok, prompt: ok ? ("ready" as const) : r.ready ? ("get_in_position" as const) : r.prompt, readyForMs };
  }
}

export type FlowEvent =
  | Exclude<CameraEvent, { type: "restOver" }>
  /** A new move's demo starts a loop (1, then 2). */
  | { type: "demo"; move: string; loop: number; target: PlannedSet | null }
  /** The readiness check before a set: waiting for you (in the picture, the right angle, the start position). */
  | { type: "setup"; move: string; target: PlannedSet | null; prompt: ReadyPrompt | null }
  /** What to change shown/said changed (setup, and the rest's last seconds); null: nothing to change. */
  | { type: "readyPrompt"; move: string; prompt: ReadyPrompt | null }
  /** Ready (`by`: the camera saw you ready, or your own Start): the countdown follows. */
  | { type: "ready"; move: string; by: "camera" | "you" }
  /** The rest's last seconds: get into position for the next set. */
  | { type: "getReady"; move: string; leftS: number }
  | { type: "countdown"; n: number }
  /** Counting starts: `setNo` of `sets` (the plan's sets of this move; 0 / 0 without a plan). */
  | { type: "go"; move: string | null; setNo: number; sets: number }
  /** A planned hold's timer: waiting for the position, running, or paused by a real break. */
  | { type: "holdState"; state: FlowHoldState; manual: boolean }
  /** During a set, VVake lost sight of what it needs (and what to change), then found it again. */
  | { type: "lost"; prompt: ReadyPrompt | null }
  | { type: "found" }
  | { type: "setEnd"; move: string | null; set: CameraSet | null; reason: SetEndReason }
  /** `newMove`: the next set is another move (the rest previews it and asks for its angle). */
  | { type: "rest"; untilMs: number; restS: number; next: PlannedSet | null; newMove?: boolean }
  /** The rest changed by you (+15 s, the rest length): `addS` when it was "more rest". */
  | { type: "restChanged"; untilMs: number; addS?: number; restS?: number }
  /** The rest followed the heart (cameraHeart.ts): stretched (`addS`) or the next set soon (`leftS`). */
  | { type: "restHeart"; kind: "extend"; addS: number; untilMs: number }
  | { type: "restHeart"; kind: "shorten"; leftS: number; untilMs: number }
  /** The plan's next sets of a move swapped for its easier variation. */
  | { type: "swapped"; from: string; to: string }
  | { type: "done" };

export interface FlowOptions {
  routine?: CameraRoutine | null;
  /** A single move picked (no routine): `HANDS_FREE.singleMoveSets` sets of it. */
  move?: string | null;
  /** The last load used per move (kg): weighted sets start with it, never asked during the workout. */
  loads?: Readonly<Record<string, number>>;
  /** The readiness check before each set (cameraReady.ts); the detection work may hand in a better one. */
  readiness?: ReadinessProbe;
  /** The rest between sets for the whole workout (s), instead of the plan's. */
  restS?: number;
}

/** How honestly a set was tracked (the summary says it: never more sure than the camera was). */
export interface SetNote {
  move: string;
  /** Its index among this move's logged sets. */
  n: number;
  /** Seconds VVake couldn't see what it needed during the set (the count may be low). */
  lostS: number;
  /** Reps seen but not deep enough to count (never punished, just said). */
  partials: number;
  /** A hold timed by your own Start / Resume (not judged by the camera). */
  byHand: boolean;
  /** Counted reps in your own (shorter, consistent) range, and counted reps seen unsurely (cameraReps.ts quality). */
  limited: number;
  uncertain: number;
  reason: SetEndReason;
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
  /** The planned hold's timer now (null: not a planned camera hold). */
  holdState: FlowHoldState | null = null;
  /** VVake can't see what it needs right now, during a set (the screen says what to change). */
  lost: { since: number; prompt: ReadyPrompt | null; shown: boolean } | null = null;
  /** How each logged set was tracked (the summary's honesty lines). */
  readonly notes: SetNote[] = [];
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
  private readonly probe: ReadinessProbe | null;
  /** The readiness gate for the next set (cameraReady.ts ReadyGate), its key (plan index, position asked), its last
   * report and the prompt shown (null: nothing to change). */
  private gate: Gate | null = null;
  private gateKey = "";
  private lastReady: (ReadyReport & { readyForMs: number }) | null = null;
  private shownPrompt: ReadyPrompt | null | undefined = undefined;
  private readyIdx = -1;
  /** A planned hold's break (or long loss) since (the set ends after HANDS_FREE.holdBreakEndMs). */
  private holdPausedSince = 0;
  private getReadySaid = false;
  /** "Skip preview": the next move's demo isn't played. */
  private skipDemo = false;
  /** The rest you set during the workout (s), for every rest from now. */
  private restOverrideS: number | null;
  /** A hold timed by hand (your Start / Resume): from when, and what was held before. */
  private manualHoldAt = 0;
  private manualHoldBase = 0;
  private setLostMs = 0;
  private setPartials = 0;

  constructor(nowMs: number, rnd: () => number, o: FlowOptions = {}) {
    this.engine = new CameraWorkoutEngine(nowMs, rnd);
    this.plan = flowPlan(o);
    this.loads = { ...(o.loads ?? {}) };
    this.lastActivityMs = nowMs;
    // The screen's clock starts here (any epoch: Date.now on a phone), so the detection pace doesn't depend on it.
    this.lastDetectMs = nowMs;
    this.restRule = o.routine?.rest ?? "flex";
    this.probe = o.readiness ?? null;
    this.restOverrideS = o.restS ? clampRest(o.restS) : null;
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
  /** The readiness for the next set (setup, rest, demo, countdown): the last check, and the prompt shown. */
  get readiness(): (ReadyReport & { shown: ReadyPrompt | null }) | null {
    const r = this.lastReady;
    return r && this.readyIdx === this.idx ? { ...r, shown: this.shownPrompt ?? null } : null;
  }
  /** The rest's "get into position" part has started. */
  get inPrep(): boolean {
    return this.phase === "rest" && !!this.plan && this.phaseUntilMs - this.lastNow <= restPrepS(this.restPlannedS) * 1000;
  }
  /** The rest for the sets from now (s): yours when you set one, else the plan's next. */
  get restS(): number {
    return this.restOverrideS ?? this.target?.restS ?? defaultRestS(this.target ? (cameraMove(this.target.move) ?? null) : null);
  }
  /** A hold being timed by hand. */
  get manualHold(): boolean {
    return this.manualHoldAt > 0;
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
    this.lastNow = nowMs;
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
    if (this.manualHoldAt) this.manualHoldAt += d;
    this.holdGrowMs += d;
    if (this.lost) this.lost.since += d;
    this.resumedMs = nowMs;
    this.lastActivityMs = nowMs;
    this.buf = [];
  }

  // ── Your controls (taps or voice): never needed, always there ─────────────────────────────────────────────────

  /** Your Start: the setup (or the rest, or the demo) goes straight to the 3-2-1, ready or not. */
  startNow(nowMs: number): FlowEvent[] {
    if (!this.plan || this.paused) return [];
    if (this.phase !== "setup" && this.phase !== "rest" && this.phase !== "demo") return [];
    if (this.phase === "rest" && !this.target) return [];
    if (this.phase === "rest") this.engine.restUntilMs = 0;
    this.engine.liveness.cancel();
    return [{ type: "ready", move: this.target!.move, by: "you" }, ...this.beginCountdown(nowMs)];
  }

  /**
   * Skip: the demo (straight to the setup), the rest (the next set now, once you're ready), or this set (what you did
   * is kept; with nothing done, on to the next set without a rest).
   */
  skip(nowMs: number): FlowEvent[] {
    const out: FlowEvent[] = [];
    if (this.paused || this.phase === "done") return out;
    switch (this.phase) {
      case "demo":
        return this.beginSetup(nowMs);
      case "rest":
        if (this.free) {
          this.enter("ready", nowMs, 0);
          return out;
        }
        this.engine.restUntilMs = 0;
        this.engine.liveness.cancel();
        return this.beginPlanned(nowMs);
      case "setup":
      case "countdown":
        if (!this.plan) return out;
        out.push({ type: "setEnd", move: this.target?.move ?? null, set: null, reason: "skip" });
        this.idx++;
        if (this.idx >= this.plan.length) {
          this.finishFlow(out);
          return out;
        }
        out.push(...this.beginPlanned(nowMs));
        return out;
      case "set": {
        const s = this.engine.set;
        if (s && (s.reps > 0 || s.holdS >= 1)) {
          this.endSet(nowMs, "skip", out);
          return out;
        }
        this.engine.endSet(nowMs, 0);
        out.push({ type: "setEnd", move: s?.move?.id ?? null, set: null, reason: "skip" });
        if (!this.plan) {
          this.enter("ready", nowMs, 0);
          return out;
        }
        this.idx++;
        if (this.idx >= this.plan.length) {
          this.finishFlow(out);
          return out;
        }
        out.push(...this.beginPlanned(nowMs));
        return out;
      }
      default:
        return out;
    }
  }

  /** More rest (+15 s, +30 s): only during a rest. */
  extendRest(addS: number, nowMs: number): FlowEvent[] {
    if (this.phase !== "rest" || addS <= 0) return [];
    this.phaseUntilMs = Math.max(this.phaseUntilMs, nowMs) + addS * 1000;
    if (this.engine.restUntilMs) this.engine.restUntilMs = this.phaseUntilMs;
    this.restPlannedS += addS;
    if (!this.inPrepAt(nowMs)) this.getReadySaid = false;
    return [{ type: "restChanged", untilMs: this.phaseUntilMs, addS }];
  }

  /** The rest between sets from now on (s); the rest running now follows it too (never under 5 s left). */
  setRestS(s: number, nowMs: number): FlowEvent[] {
    const v = clampRest(s);
    this.restOverrideS = v;
    if (this.phase !== "rest") return [];
    this.phaseUntilMs = Math.max(nowMs + 5000, this.phaseStartMs + v * 1000);
    this.restPlannedS = v;
    if (this.engine.restUntilMs) this.engine.restUntilMs = this.phaseUntilMs;
    if (!this.inPrepAt(nowMs)) this.getReadySaid = false;
    return [{ type: "restChanged", untilMs: this.phaseUntilMs, restS: v }];
  }

  /** "Skip preview": the next move's full-screen demo isn't played (you know it). During a demo: ends it. */
  skipPreview(nowMs: number): FlowEvent[] {
    if (this.phase === "demo") return this.beginSetup(nowMs);
    this.skipDemo = true;
    return [];
  }

  /** Undo "Skip preview": the next move's demo plays after all. */
  showPreview() {
    this.skipDemo = false;
  }

  /** "Replay demo": during the setup, the demo plays again full screen (the rest's preview replays on screen). */
  replayDemo(nowMs: number): FlowEvent[] {
    const t = this.target;
    if (this.phase !== "setup" || !t) return [];
    this.skipDemo = false;
    return this.beginDemo(t, nowMs);
  }

  /** The easier variation's move for the next sets of this move (rest, demo, setup): knee push-ups for push-ups. */
  swapEasier(nowMs: number, lang: "en" | "fr" = "en"): FlowEvent[] {
    const t = this.target;
    if (!this.plan || !t || (this.phase !== "rest" && this.phase !== "setup" && this.phase !== "demo")) return [];
    const e = easierOf(t.move, lang);
    if (!e?.move) return [];
    const from = t.move;
    for (let i = this.idx; i < this.plan.length && this.plan[i]!.move === from; i++) this.plan[i] = { ...this.plan[i]!, move: e.move };
    // Later sets of the same move: the easier one too (one choice for the workout).
    for (let i = this.idx; i < this.plan.length; i++) if (this.plan[i]!.move === from) this.plan[i] = { ...this.plan[i]!, move: e.move };
    this.gate = null;
    this.gateKey = "";
    this.lastReady = null;
    const out: FlowEvent[] = [{ type: "swapped", from, to: e.move }];
    if (this.phase !== "rest") out.push(...this.beginDemo(this.plan[this.idx]!, nowMs));
    return out;
  }

  /** Your Start / Resume on a hold the camera can't see well: timed by hand from now (judged as yours). */
  startHoldByHand(nowMs: number): FlowEvent[] {
    const s = this.engine.set;
    if (this.phase !== "set" || !s?.move || s.move.kind !== "hold" || this.manualHoldAt) return [];
    this.manualHoldBase = s.holdS;
    this.manualHoldAt = nowMs;
    this.holdGrowMs = nowMs;
    this.holdState = "holding";
    return [{ type: "holdState", state: "holding", manual: true }];
  }

  /** Feeds a frame (null: nobody in the picture) and the clock: what happened. Call it on every frame. */
  push(f: PoseFrame | null, nowMs: number): FlowEvent[] {
    this.lastNow = nowMs;
    // No new quick check while you watch, get set up, count down, or get into position at the end of a rest.
    this.engine.noChecks =
      this.phase === "demo" || this.phase === "countdown" || this.phase === "done" || this.phase === "setup" || this.inPrep;
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
    this.checkReady(f, nowMs, out);
    switch (this.phase) {
      case "demo":
        this.tickDemo(nowMs, out);
        break;
      case "setup":
        if (this.lastReady?.ready) {
          out.push({ type: "ready", move: this.target!.move, by: "camera" });
          out.push(...this.beginCountdown(nowMs));
        }
        break;
      case "countdown":
        this.tickCountdown(nowMs, out);
        break;
      case "set":
        this.tickSet(nowMs, out, f);
        break;
      case "rest":
        if (this.free && this.detectStart(nowMs, out)) break;
        if (this.plan) {
          this.heartRest(nowMs, out);
          const t = this.target;
          if (t && !this.getReadySaid && this.inPrepAt(nowMs)) {
            this.getReadySaid = true;
            out.push({ type: "getReady", move: t.move, leftS: Math.max(1, Math.round((this.phaseUntilMs - nowMs) / 1000)) });
          }
        }
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
    const s = this.engine.set;
    if (this.phase === "set" && s && (s.reps > 0 || s.holdS >= 1)) this.note(s.move?.id ?? null, "skip", nowMs);
    this.phase = "done";
    return this.engine.summary(nowMs);
  }

  // ── Phases ──────────────────────────────────────────────────────────────────────────────────────────────────

  private lastNow = 0;

  private enter(p: FlowPhase, nowMs: number, durMs: number) {
    this.phase = p;
    this.phaseStartMs = nowMs;
    this.phaseUntilMs = durMs ? nowMs + durMs : 0;
  }

  private inPrepAt(nowMs: number) {
    return this.phase === "rest" && !!this.plan && this.phaseUntilMs - nowMs <= restPrepS(this.restPlannedS) * 1000;
  }

  /** The readiness for the next set, on every frame before it (demo, setup, countdown, rest): the screen shows it. */
  private checkReady(f: PoseFrame | null, nowMs: number, out: FlowEvent[]) {
    const t = this.target;
    const before = this.phase === "demo" || this.phase === "setup" || this.phase === "countdown" || (this.phase === "rest" && !!this.plan);
    if (!t || !before) return;
    const m = cameraMove(t.move);
    if (!m) return;
    // The rest's preview checks the framing only; from the "get into position" seconds on, the start position too.
    const requirePosition = !(this.phase === "rest" && !this.inPrepAt(nowMs));
    const key = `${this.idx}|${t.move}|${requirePosition}`;
    if (key !== this.gateKey) {
      this.gate = this.probe ? new ProbeGate(this.probe, m, requirePosition) : new ReadyGate(m, { requirePosition });
      this.gateKey = key;
      if (this.readyIdx !== this.idx) this.shownPrompt = undefined;
      this.readyIdx = this.idx;
    }
    const r = this.gate!.push(f, nowMs);
    this.lastReady = r;
    const p = r.prompt === "ready" ? null : r.prompt;
    if (p !== this.shownPrompt) {
      this.shownPrompt = p;
      if (this.phase === "setup" || this.inPrepAt(nowMs)) out.push({ type: "readyPrompt", move: t.move, prompt: p });
    }
  }

  /** Whether VVake sees what this move needs, from an angle that counts it (no start position: mid-set). */
  private framed(f: PoseFrame | null, m: MoveDef): ReadyReport {
    return (this.probe ?? defaultReadiness)(f, m, { requirePosition: false });
  }

  /** The planned set at `idx`: a demo when the move is new, else the readiness check. */
  private beginPlanned(nowMs: number): FlowEvent[] {
    const t = this.target;
    if (!t) {
      const out: FlowEvent[] = [];
      this.finishFlow(out);
      return out;
    }
    const prev = this.idx > 0 ? this.plan![this.idx - 1]!.move : null;
    if (prev !== t.move && !this.skipDemo) return this.beginDemo(t, nowMs);
    this.skipDemo = false;
    return this.beginSetup(nowMs);
  }

  private beginDemo(t: PlannedSet, nowMs: number): FlowEvent[] {
    this.demo = demoLoop(t.move);
    this.demoLoopNo = 1;
    this.enter("demo", nowMs, demoMs(t.move));
    return [{ type: "demo", move: t.move, loop: 1, target: t }];
  }

  private tickDemo(nowMs: number, out: FlowEvent[]) {
    const loop = this.demo ? 1 + Math.floor((nowMs - this.phaseStartMs) / this.demo.loopMs) : 1;
    if (nowMs >= this.phaseUntilMs) {
      out.push(...this.beginSetup(nowMs));
      return;
    }
    if (loop > this.demoLoopNo) {
      this.demoLoopNo = loop;
      out.push({ type: "demo", move: this.target?.move ?? "", loop, target: this.target });
    }
  }

  /** The readiness check: straight to the 3-2-1 when you're already ready, else wait for you (or your Start). */
  private beginSetup(nowMs: number): FlowEvent[] {
    const t = this.target!;
    const sameGate = this.readyIdx === this.idx && this.gateKey.endsWith("|true");
    if (sameGate && this.lastReady?.ready) return [{ type: "ready", move: t.move, by: "camera" }, ...this.beginCountdown(nowMs)];
    this.enter("setup", nowMs, 0);
    const p = this.readyIdx === this.idx && this.shownPrompt !== undefined ? this.shownPrompt : "step_in";
    return [{ type: "setup", move: t.move, target: t, prompt: p }];
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
      const m = this.engine.set?.move;
      if (this.plan && m?.kind === "hold" && m.judge !== "manual") {
        this.holdState = "waiting";
        out.push({ type: "holdState", state: "waiting", manual: false });
      }
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
    this.holdState = null;
    this.holdPausedSince = 0;
    this.manualHoldAt = 0;
    this.manualHoldBase = 0;
    this.lost = null;
    this.setLostMs = 0;
    this.setPartials = 0;
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
      if (e.type === "partial") this.setPartials++;
      if (e.type === "rep" || e.type === "hold" || e.type === "detected") this.lastActivityMs = nowMs;
    }
    if (m && m.judge !== "manual") this.trackLost(f, m, nowMs, out);
    if (this.manualHoldAt) {
      // Timed by hand (your Start / Resume): the clock, logged as yours.
      const held = this.manualHoldBase + (nowMs - this.manualHoldAt) / 1000;
      this.engine.setHold(held);
      s.holdS = held;
      this.lastActivityMs = nowMs;
      if (t?.holdS && held >= t.holdS) this.endSet(nowMs, "time", out);
      return;
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
    if (m?.kind === "hold" && this.plan) {
      // A planned hold: the timer shows waiting / holding / paused (the engine's HoldTimer: it starts only once you're
      // in position, rides through a wobble or a brief loss, pauses on a real break); a 12 s break ends the set.
      const hs = this.engine.holdStatus();
      const quiet = nowMs - Math.max(this.holdGrowMs, since);
      const st: FlowHoldState = hs
        ? hs.state === "waiting" || hs.state === "settling"
          ? "waiting"
          : hs.running
            ? "holding"
            : "paused"
        : s.holdS < 0.5
          ? "waiting"
          : quiet < HANDS_FREE.holdPauseMs
            ? "holding"
            : "paused";
      if (st !== this.holdState) {
        this.holdState = st;
        out.push({ type: "holdState", state: st, manual: false });
      }
      if (st === "paused") this.holdPausedSince ||= nowMs;
      else this.holdPausedSince = 0;
      if (s.holdS >= HANDS_FREE.holdMinS && st === "paused" && nowMs - Math.max(this.holdPausedSince, since) >= HANDS_FREE.holdBreakEndMs)
        return this.endSet(nowMs, "idle", out);
    } else if (m?.kind === "hold" && s.holdS >= HANDS_FREE.holdMinS && nowMs - Math.max(this.holdGrowMs, since) >= HANDS_FREE.holdIdleEndMs)
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

  /** During a set: out of sight (or the needed parts out of frame) for 2.5 s says so, and what to change. */
  private trackLost(f: PoseFrame | null, m: MoveDef, nowMs: number, out: FlowEvent[]) {
    const r = this.framed(f, m);
    const prompt = r.ready ? null : r.prompt;
    if (r.ready) {
      if (this.lost) {
        this.setLostMs += nowMs - this.lost.since;
        if (this.lost.shown) out.push({ type: "found" });
        this.lost = null;
      }
      return;
    }
    if (!this.lost) {
      this.lost = { since: nowMs, prompt, shown: false };
      return;
    }
    // Said once it's been 2.5 s (a blip isn't news), and again only when what to change is different.
    if (nowMs - this.lost.since >= HANDS_FREE.lostMs && (!this.lost.shown || this.lost.prompt !== prompt)) {
      this.lost.shown = true;
      this.lost.prompt = prompt;
      out.push({ type: "lost", prompt });
    }
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

  /** The tracking note of the set ending now (only for a set that's logged). */
  private note(move: string | null, reason: SetEndReason, nowMs: number) {
    if (!move) return;
    const lostMs = this.setLostMs + (this.lost ? nowMs - this.lost.since : 0);
    const n = this.engine.log.find((x) => x.id === move)?.sets.length ?? 0;
    const s = this.engine.set;
    this.notes.push({
      move,
      n,
      lostS: Math.round(lostMs / 1000),
      partials: this.setPartials,
      byHand: this.manualHoldAt > 0,
      limited: s?.limited ?? 0,
      uncertain: s?.uncertain ?? 0,
      reason,
    });
  }

  private endSet(nowMs: number, reason: SetEndReason, out: FlowEvent[]) {
    const s = this.engine.set;
    const move = s?.move?.id ?? null;
    const t = this.target;
    const restS = this.restOverrideS ?? t?.restS ?? defaultRestS(s?.move ?? null);
    if (move && s?.loadKg) this.loads[move] = s.loadKg;
    const lostMs = this.setLostMs + (this.lost ? nowMs - this.lost.since : 0);
    const partials = this.setPartials;
    const byHand = this.manualHoldAt > 0;
    const limited = s?.limited ?? 0;
    const uncertain = s?.uncertain ?? 0;
    const set = this.engine.endSet(nowMs, reason === "switch" ? 0 : restS);
    if (set && move) {
      const n = (this.engine.log.find((x) => x.id === move)?.sets.length ?? 1) - 1;
      this.notes.push({ move, n, lostS: Math.round(lostMs / 1000), partials, byHand, limited, uncertain, reason });
    }
    this.holdState = null;
    this.lost = null;
    this.manualHoldAt = 0;
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
    this.getReadySaid = false;
    const next = this.target && this.plan ? this.target : null;
    out.push({ type: "rest", untilMs: this.phaseUntilMs, restS, next, ...(next ? { newMove: next.move !== move } : {}) });
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
    this.holdState = null;
    this.engine.liveness.cancel();
    out.push({ type: "done" });
  }
}

const clampRest = (s: number) => Math.max(HANDS_FREE.restMinS, Math.min(HANDS_FREE.restMaxS, Math.round(s / 5) * 5));

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
 * demo; what to change before the set (once, then the screen); 3-2-1; go; a hold paused or back; the set done; the
 * rest, what's next and its camera angle; get ready; the end. The form cues stay as they were (cameraCues.ts); the
 * counts follow `repLine`. Null: nothing to say.
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
    case "setup":
    case "readyPrompt":
      return e.prompt && e.prompt !== "ready" ? promptLine(e.prompt, cameraMove(e.move), lang) : null;
    case "getReady":
      return getReadyLine(e.move, lang);
    case "countdown":
      return String(e.n);
    case "go":
      return e.sets ? (fr ? "C’est parti !" : "Go!") : null;
    case "detected":
      return fr ? `${name(e.move)} : je compte.` : `${name(e.move)}: counting.`;
    case "holdState":
      if (e.state === "paused")
        return fr ? "Chrono en pause. Reprends la position quand tu veux." : "Timer paused. Get back into position when you’re ready.";
      return null;
    case "lost":
      return e.prompt
        ? `${fr ? "Je ne te vois plus bien." : "I can’t see you well."} ${promptLine(e.prompt, null, lang)}`
        : fr
          ? "Je ne te vois plus bien."
          : "I can’t see you well.";
    case "setEnd":
      if (e.reason === "switch") return null;
      if (!e.set)
        return e.reason === "nothing"
          ? fr
            ? "On passe à la suite."
            : "Let’s move on."
          : e.reason === "skip"
            ? fr
              ? "On passe."
              : "Skipping."
            : null;
      if (e.set.holdS && !e.set.reps) return fr ? `Série terminée : ${e.set.holdS} secondes.` : `Set done: ${e.set.holdS} seconds.`;
      return fr ? `Série terminée : ${e.set.reps}.` : `Set done: ${e.set.reps}.`;
    case "rest": {
      if (!e.next)
        return fr
          ? `Repos. Reprends quand tu veux, je reconnais ton mouvement.`
          : `Rest. Start moving when you’re ready: I’ll recognise the move.`;
      const base = fr
        ? `Repos ${e.restS} secondes. Ensuite : ${name(e.next.move)}.`
        : `Rest ${e.restS} seconds. Next: ${name(e.next.move)}.`;
      const m = e.newMove ? cameraMove(e.next.move) : null;
      const ask = m ? viewAsk(m, lang) : null;
      return ask ? `${base} ${ask}` : base;
    }
    case "restChanged":
      return e.addS ? (fr ? `${e.addS} secondes de plus.` : `${e.addS} more seconds.`) : null;
    case "swapped":
      return fr ? `D’accord : ${name(e.to)}.` : `Okay: ${name(e.to)}.`;
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

// ── The count, said: progress, not every rep ──────────────────────────────────────────────────────────────────────

/** Encouragement, said now and then at the halfway mark (never the same one twice in a row). */
export const CHEERS: readonly { en: string; fr: string }[] = [
  { en: "Halfway. Nice and steady.", fr: "À mi-chemin. Bien régulier." },
  { en: "Halfway. Looking strong.", fr: "À mi-chemin. Tu assures." },
  { en: "Halfway. Keep that rhythm.", fr: "À mi-chemin. Garde ce rythme." },
];

/**
 * What to say for a rep (tester report 2026-10-26: progress, not every rep): with a target, cameraCues.ts
 * `progressLine` ("10 of 15 done.", "3 more.", "Last one."), and with the voice on a cheer at the halfway mark
 * (`cheer`: which one, by set). Without a target: every 5th count. The last rep is the set's "Set done". Voice off:
 * nothing; "essential only": the progress, no cheer.
 */
export function repLine(
  n: number,
  target: number | undefined,
  mode: "on" | "essential" | "off",
  lang: "en" | "fr",
  cheer = 0,
): string | null {
  if (mode === "off" || n <= 0) return null;
  if (!target) return n % 5 === 0 ? String(n) : null;
  const p = progressLine(n, target, lang);
  if (p) return p;
  if (mode === "on" && target >= 8 && n === Math.ceil(target / 2)) return CHEERS[Math.abs(cheer) % CHEERS.length]![lang];
  return null;
}

/**
 * Paces what the voice says about getting ready and tracking (the screen always shows it): a new prompt once it held
 * (the flow debounces it), at most every 8 s, the same prompt at most every 20 s, four per exercise.
 */
export class PromptVoice {
  private lastAt = -Infinity;
  private said = new Map<string, number>();
  private count = 0;
  /** A new exercise (or set): the budget starts again. */
  newExercise() {
    this.count = 0;
    this.said.clear();
  }
  allow(key: string, nowMs: number): boolean {
    if (this.count >= 4 || nowMs - this.lastAt < 8000 || nowMs - (this.said.get(key) ?? -Infinity) < 20_000) return false;
    this.lastAt = nowMs;
    this.said.set(key, nowMs);
    this.count++;
    return true;
  }
}

// ── Voice controls during a camera workout ────────────────────────────────────────────────────────────────────────

export type CameraVoiceAction = "pause" | "resume" | "more_rest" | "skip" | "start" | "replay" | "easier";

const VOICE_ACTIONS: readonly [CameraVoiceAction, RegExp][] = [
  [
    "more_rest",
    /^(more rest|more time|extend( the)? rest|extra rest|longer rest|give me (more|a minute|a moment)|plus de repos|encore (du|un peu de) repos|rallonge( le repos)?|plus de temps|encore un peu)$/,
  ],
  [
    "replay",
    /^(replay( the)?( demo)?|show (me )?(it )?again|demo again|rejoue( la demo)?|remontre( moi)?|montre (moi )?encore|encore la demo)$/,
  ],
  ["easier", /^(easier|make it easier|easier version|plus facile|version plus facile|en plus facile)$/],
  ["skip", /^(skip( it| this| the rest| rest)?|next( one)?|passe|on passe|suivant|passe au suivant|saute)$/],
  ["pause", /^(pause|wait|hold on|stop|attends|pause la seance|stop)$/],
  ["resume", /^(resume|continue|go on|keep going|reprends|on reprend|continue|reprise)$/],
  ["start", /^(start|go|ready|i m ready|im ready|lets go|let s go|c est parti|cest parti|pret|prete|je suis pret|je suis prete|go go)$/],
];

/** A short spoken control during a camera workout ("more rest", « on passe », "I'm ready"), or null. */
export function cameraVoiceAction(text: string): CameraVoiceAction | null {
  const t = normalizeVoice(text)
    .replace(/^(hey |ok |okay )?(vvake |wake )?/, "")
    .replace(/ (please|s il te plait|stp)$/, "")
    .trim();
  for (const [a, re] of VOICE_ACTIONS) if (re.test(t)) return a;
  return null;
}

/** What an athlete can say during a camera workout (the voice sheet's help line). */
export const CAMERA_VOICE_HELP = {
  en: "Say “pause”, “more rest”, “skip”, “I’m ready”, “replay the demo” or “easier”.",
  fr: "Dis « pause », « plus de repos », « on passe », « je suis prêt », « rejoue la démo » ou « plus facile ».",
} as const;

// ── The summary, honestly ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * How well each set was tracked, in plain words (never more sure than the camera was): timed by you, VVake lost sight
 * of you for a while (the count may be low), shorter reps seen but not counted, counted without judging the form.
 * Empty when every set was tracked clearly.
 */
export function trackingNotes(notes: readonly SetNote[], summary: Pick<CameraSummary, "moves">, lang: "en" | "fr"): string[] {
  const fr = lang === "fr";
  const name = (id: string) => cameraMove(id)?.name[lang] ?? id;
  const out: string[] = [];
  for (const n of notes) {
    const set = summary.moves.find((m) => m.id === n.move)?.sets[n.n];
    if (!set) continue;
    const head = fr ? `${name(n.move)}, série ${n.n + 1} :` : `${name(n.move)}, set ${n.n + 1}:`;
    if (n.byHand)
      out.push(
        fr
          ? `${head} chronométrée par toi (la caméra ne voyait pas bien la position).`
          : `${head} timed by you (the camera couldn’t see the position well).`,
      );
    if (n.lostS >= 3)
      out.push(
        fr
          ? `${head} VVake ne t’a pas vu pendant ${n.lostS} s ; le compte peut être un peu bas.`
          : `${head} VVake lost sight of you for ${n.lostS} s; the count may be a little low.`,
      );
    if (n.uncertain > 0)
      out.push(
        fr
          ? `${head} ${n.uncertain} répétition${n.uncertain > 1 ? "s" : ""} comptée${n.uncertain > 1 ? "s" : ""} sans être bien vue${n.uncertain > 1 ? "s" : ""}.`
          : `${head} ${n.uncertain} rep${n.uncertain > 1 ? "s" : ""} counted without being seen clearly.`,
      );
    if (n.limited > 0)
      out.push(
        fr
          ? `${head} ${n.limited} répétition${n.limited > 1 ? "s" : ""} avec ton amplitude à toi, comptée${n.limited > 1 ? "s" : ""}.`
          : `${head} ${n.limited} rep${n.limited > 1 ? "s" : ""} in your own range, counted.`,
      );
    if (n.partials > 0)
      out.push(
        fr
          ? `${head} ${n.partials} répétition${n.partials > 1 ? "s" : ""} plus courte${n.partials > 1 ? "s" : ""} vue${n.partials > 1 ? "s" : ""}, pas comptée${n.partials > 1 ? "s" : ""}.`
          : `${head} ${n.partials} shorter rep${n.partials > 1 ? "s" : ""} seen, not counted.`,
      );
  }
  for (const m of summary.moves) {
    const def = cameraMove(m.id);
    if (def?.judge === "count" && m.sets.some((s) => s.judged === "count"))
      out.push(
        fr ? `${name(m.id)} : compté, sans juger la posture depuis cet angle.` : `${name(m.id)}: counted, form not judged from this angle.`,
      );
  }
  return out;
}
