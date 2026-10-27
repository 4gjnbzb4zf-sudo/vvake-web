// Copied from VVFit packages/game-core/src/cameraReady.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): getting set up for a move and counting it from whichever angle the camera has. Pure.
 *
 * - `moveSetup`: per move, the camera angles it is counted from (validated by the replay tests, best first), the parts
 *   of the body that must be in the picture from each, where to put the phone, and the line to say before the set
 *   ("Turn sideways so I can track you.").
 * - `readiness`: from one frame, the one actionable prompt (step in / move back / come closer / your legs are out of
 *   the picture / turn sideways / face the phone / get into position / ready).
 * - `ReadyGate`: readiness held for a second (no flicker), what the flow waits on before a set starts on its own.
 * - `inStartPosition`: the body is in the move's starting position (a plank, the top of a push-up, standing).
 * - `MoveCounter`: a move's reps from its main angle and its other angles together (MoveDef.alts), one rep counted
 *   once.
 *
 * 2026-10-26 tester report: push-ups never counted (side or front), lunges only from the side, the plank timer ran
 * before the plank. Each now either counts from that angle or says, before the set, which angle it needs.
 */
import { moveNeeds, signalAreas, type AltCount, type CameraPlacement, type MoveDef } from "./cameraMoves";
import {
  CORE_AREAS,
  framingReport,
  shoulderSpan,
  torsoLength,
  torsoTilt,
  viewOf,
  type BodyArea,
  type FramingReport,
  type FramingTip,
  type PoseFrame,
} from "./cameraPose";
import { guardState, RepCounter, type Guard, type PartialEvent, type RepEvent, type SignalSpec } from "./cameraReps";

type Line = { en: string; fr: string };
const l = (en: string, fr: string): Line => ({ en, fr });

// ── Setup ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Moves the replay tests count from 45° too (test/cameraTester.test.ts). The plank (tester report 2026-10-27: it
 * paused and resumed at a diagonal, never face-on): its hold is timed from 45°, see test/cameraV3.test.ts. */
const DIAGONAL_OK = new Set(["push-up", "knee-push-up", "plank"]);

/**
 * Seen from about 45° (on the floor): the shoulders look wider than side-on (the view reads "front") but nothing like
 * a torso pointing at the phone (its span is well over 1 face-on in a plank).
 */
export const DIAGONAL_SPAN = { min: 0.3, max: 0.9 } as const;
export function diagonalSeen(f: PoseFrame): boolean {
  const span = shoulderSpan(f);
  return viewOf(f) === "front" && span !== null && span >= DIAGONAL_SPAN.min && span < DIAGONAL_SPAN.max;
}

/** The parts a floor move needs seen from the side or a diagonal: the whole length of the body (2026-10-27). */
const FLOOR_BODY: readonly BodyArea[] = ["shoulders", "hips", "knees"];

/** A camera angle, the diagonal included. */
export type CameraAngle = CameraPlacement | "diagonal";

/** Moves done on the floor (the phone goes low, on the floor or a step, and the body is long across the picture). */
const FLOOR_FAMILIES = new Set(["core"]);
const FLOOR_IDS = new Set([
  "push-up",
  "knee-push-up",
  "pike-push-up",
  "mountain-climber",
  "glute-bridge",
  "burpee",
  "bench-press",
  "floor-press",
  "hip-thrust",
  "downward-dog",
  "cobra",
  "childs-pose",
]);

export interface MoveSetup {
  /** The angles the camera counts this move from, best first (empty: a move you count yourself). */
  views: CameraPlacement[];
  /** The parts of the body that must be in the picture, per angle. */
  need: Partial<Record<CameraPlacement, BodyArea[]>>;
  /** Done on the floor: the phone low (on the floor or a step), the whole length of the body in the picture. */
  floor: boolean;
  /** How far the phone should be (m). */
  distanceM: [number, number];
  /** Also counted from 45° (validated). */
  diagonal: boolean;
}

/** The angles a move is counted from: its own, then its other angles (MoveDef.alts). `either` = front, then side. */
export function countViews(m: Pick<MoveDef, "view" | "judge" | "alts" | "sig">): CameraPlacement[] {
  if (m.judge === "manual" || !m.sig) return [];
  const out: CameraPlacement[] = m.view === "either" ? ["front", "side"] : [m.view];
  for (const a of m.alts ?? []) if (!out.includes(a.view)) out.push(a.view);
  return out;
}

function needsOf(sig: SignalSpec, guards: readonly Guard[] | undefined): BodyArea[] {
  const out = new Set<BodyArea>(CORE_AREAS);
  signalAreas(sig).forEach((a) => out.add(a));
  for (const g of guards ?? []) if (!g.optional) signalAreas(g.sig).forEach((a) => out.add(a));
  return (["shoulders", "arms", "hips", "knees", "feet"] as const).filter((a) => out.has(a));
}

export function moveSetup(m: MoveDef): MoveSetup {
  const views = countViews(m);
  const need: MoveSetup["need"] = {};
  const main = moveNeeds(m);
  for (const v of views) {
    const alt = (m.alts ?? []).find((a) => a.view === v);
    // The main signal's angle(s) use the move's needs; an angle only an alt covers, the alt's.
    need[v] = alt && !(m.view === v || m.view === "either") ? needsOf(alt.sig, alt.guards) : main;
  }
  const floor = FLOOR_IDS.has(m.id) || FLOOR_FAMILIES.has(m.family);
  return { views, need, floor, distanceM: floor ? [1.5, 2.5] : [2, 3], diagonal: views.length > 0 && DIAGONAL_OK.has(m.id) };
}

/**
 * The angles a move is counted from as the replay tests cover them, best first (a move is never said to work from an
 * angle they don't): push-ups side-on, facing the phone and diagonal; lunges side-on and facing; the plank side-on.
 */
export function validatedViews(m: MoveDef): CameraAngle[] {
  const v: CameraAngle[] = countViews(m);
  return DIAGONAL_OK.has(m.id) && v.length ? [...v, "diagonal"] : v;
}

/** Counted facing the phone and side-on: never "turn sideways" / "face the phone" for it. */
export function anyView(m: MoveDef): boolean {
  const v = countViews(m);
  return v.includes("front") && v.includes("side");
}

/** What to say before the set about where to put the phone and which way to face (one short line). */
export function setupLine(m: MoveDef, lang: "en" | "fr"): string {
  const s = moveSetup(m);
  const fr = lang === "fr";
  if (!s.views.length)
    return fr ? "Celui-ci, tu le comptes toi-même : je garde le temps." : "You count this one yourself: I’ll keep the time.";
  const [a, b] = s.distanceM;
  const where = s.floor
    ? fr
      ? `Pose le téléphone au sol, à ${a}–${b} m`
      : `Put the phone on the floor, ${a}–${b} m away`
    : fr
      ? `Pose le téléphone à hauteur de taille, à ${a}–${b} m`
      : `Put the phone at waist height, ${a}–${b} m away`;
  if (s.views.length > 1) {
    const best =
      s.views[0] === "side"
        ? fr
          ? "de profil c’est le mieux"
          : "side-on is best"
        : fr
          ? "face au téléphone c’est le mieux"
          : "facing it is best";
    return fr ? `${where} ; ${best}.` : `${where}; ${best}.`;
  }
  if (s.views[0] === "side" && s.diagonal)
    return fr
      ? `${where}, et mets-toi en diagonale ou de profil pour que je te voie.`
      : `${where}, and turn diagonal or sideways so I can see you.`;
  return s.views[0] === "side"
    ? fr
      ? `${where}, et mets-toi de profil pour que je puisse te suivre.`
      : `${where}, and turn sideways so I can track you.`
    : fr
      ? `${where}, et mets-toi face au téléphone.`
      : `${where}, and face the phone.`;
}

// ── Starting position ────────────────────────────────────────────────────────────────────────────────────────────

/** The starting-position checks from each angle (the main one first). */
function startChecks(m: MoveDef): { view: CameraPlacement | "either"; guards: Guard[] }[] {
  const out: { view: CameraPlacement | "either"; guards: Guard[] }[] = [];
  if (m.sig) {
    if (m.start) out.push({ view: m.view, guards: m.start });
    else if (m.kind === "hold" && m.hold)
      out.push({ view: m.view, guards: [...(m.guards ?? []), { sig: m.sig, min: m.hold.lo, max: m.hold.hi }] });
    else if (m.rep) {
      const r = m.rep;
      const atRest: Guard =
        r.dir === "down"
          ? { sig: m.sig, min: r.rest - 0.05 * Math.abs(r.rest - r.work) }
          : { sig: m.sig, max: r.rest + 0.05 * Math.abs(r.rest - r.work) };
      // Posture guards that hold through the move (standing, lying): the ones on the torso's tilt.
      out.push({ view: m.view, guards: [...(m.guards ?? []).filter((g) => g.sig.k === "tilt"), atRest] });
    }
  }
  for (const a of m.alts ?? [])
    out.push({ view: a.view, guards: a.start ?? [...(a.guards ?? []).filter((g) => g.sig.k === "tilt" || g.sig.k === "span")] });
  return out;
}

/** The body is in the move's starting position this frame (from any angle the move is counted from). */
export function inStartPosition(f: PoseFrame, m: MoveDef): boolean {
  const ref = torsoLength(f) ?? 0;
  return startChecks(m).some((c) => c.guards.length > 0 && guardState(f, c.guards, ref) === "ok");
}

// ── Readiness ────────────────────────────────────────────────────────────────────────────────────────────────────

export type ReadyPrompt =
  | "ready"
  | "step_in"
  | "move_back"
  | "come_closer"
  | "move_left"
  | "move_right"
  | "tilt_down"
  | "tilt_up"
  | "legs_out"
  | "arms_out"
  | "body_hidden"
  | "turn_sideways"
  | "face_phone"
  | "turn_diagonal"
  | "get_in_position";

export interface ReadyReport {
  ready: boolean;
  prompt: ReadyPrompt;
  /** The needed parts not seen. */
  missing: BodyArea[];
  /** Extra tips (more light…), from the framing guide. */
  tips: FramingTip[];
  /** The angle the camera sees the body from now (null: can't tell). */
  view: "front" | "side" | null;
  /** In the move's starting position. */
  inPosition: boolean;
}

export const READY_TEXT: Readonly<Record<ReadyPrompt, Line>> = {
  ready: l("Ready. Start when you like.", "C’est bon. Commence quand tu veux."),
  step_in: l("Step into the picture.", "Entre dans le cadre."),
  move_back: l("Move back a little.", "Recule un peu."),
  come_closer: l("Come a little closer.", "Approche-toi un peu."),
  move_left: l("Move a little to your left.", "Décale-toi un peu sur ta gauche."),
  move_right: l("Move a little to your right.", "Décale-toi un peu sur ta droite."),
  tilt_down: l("Tilt the phone down a little.", "Incline un peu le téléphone vers le bas."),
  tilt_up: l("Tilt the phone up a little.", "Redresse un peu le téléphone."),
  legs_out: l("Your legs are out of the picture: move back.", "Tes jambes sont hors du cadre : recule."),
  arms_out: l("Your arms are out of the picture: move back.", "Tes bras sont hors du cadre : recule."),
  body_hidden: l(
    "I can’t see you well: more light, or turn a little toward the phone.",
    "Je te vois mal : plus de lumière, ou tourne-toi un peu vers le téléphone.",
  ),
  turn_sideways: l("Turn sideways so I can track you.", "Mets-toi de profil pour que je puisse te suivre."),
  face_phone: l("Face the phone so I can track you.", "Mets-toi face au téléphone pour que je puisse te suivre."),
  turn_diagonal: l(
    "Turn diagonal or sideways to the phone so I can see you.",
    "Mets-toi en diagonale ou de profil face au téléphone pour que je te voie.",
  ),
  get_in_position: l("Get into position: I’ll start when you’re there.", "Mets-toi en position : je démarre quand tu y es."),
};

export const readyLine = (r: Pick<ReadyReport, "prompt">, lang: "en" | "fr") => READY_TEXT[r.prompt][lang];

/**
 * The one thing to do before this move can be counted, from this frame. In order: be in the picture, have the needed
 * parts in it, face the right way (only the angles the move is counted from), be in the starting position.
 * `requirePosition: false` stops at the framing (a preview during rest, before you get down).
 */
export function readiness(f: PoseFrame | null, m: MoveDef, o: { requirePosition?: boolean } = {}): ReadyReport {
  const setup = moveSetup(m);
  const view = f ? viewOf(f) : null;
  // The parts needed from the angle you're at (or the least demanding of the move's angles when it can't tell).
  const needFor = (v: CameraPlacement | null): BodyArea[] => {
    if (v && setup.need[v]) return setup.need[v]!;
    const all = Object.values(setup.need);
    return all.length ? all.reduce((a, b) => (b.length < a.length ? b : a)) : [...CORE_AREAS];
  };
  // A floor move seen from the side or a diagonal: the whole body in the picture before it starts (shoulders to
  // knees at least), so a plank or a push-up isn't started with half the body out of frame (2026-10-27).
  const diag = !!f && setup.diagonal && diagonalSeen(f);
  const lengthwise = setup.floor && setup.views.length > 0 && (view === "side" || diag);
  const need = needFor(diag && !setup.need.front ? "side" : view);
  const fr: FramingReport = framingReport(f, { need: lengthwise ? [...new Set([...need, ...FLOOR_BODY])] : need });
  const inPosition = !!f && inStartPosition(f, m);
  const base = { missing: fr.missing, tips: fr.tips, view, inPosition };
  const not = (prompt: ReadyPrompt): ReadyReport => ({ ready: false, prompt, ...base });
  if (fr.state === "none") return not("step_in");
  if (fr.missing.length) {
    if (fr.state === "step_back" || fr.state === "tilt_down" || fr.state === "tilt_up") {
      if (fr.missing.some((a) => a === "knees" || a === "feet" || a === "hips")) return not("legs_out");
      if (fr.missing.includes("arms")) return not("arms_out");
      return not(fr.state === "step_back" ? "move_back" : fr.state);
    }
    if (fr.missing.includes("arms") && !fr.missing.some((a) => a !== "arms"))
      return not(fr.state === "hidden" ? "body_hidden" : "arms_out");
    return not("body_hidden");
  }
  if (fr.state === "step_back") return not("move_back");
  if (fr.state === "step_closer") return not("come_closer");
  if (fr.state === "move_left" || fr.state === "move_right") return not(fr.state);
  // Which way you face: told only for a move that can't be counted from where you are. A floor move's angle reads
  // only once you're down (standing side-on to the phone and lying side-on to it look different): in position, the
  // torso level, or pointing at the phone.
  const checkView =
    setup.views.length > 0 && view !== null && (!setup.floor || inPosition || (torsoTilt(f!) ?? 0) > 45 || (shoulderSpan(f!) ?? 0) >= 1.2);
  if (checkView && !setup.views.includes(view)) {
    // A diagonal counts for the moves the replay tests time from 45° (the plank): face-on asks for the diagonal.
    if (!(view === "front" && diag)) return not(view === "front" ? (setup.diagonal ? "turn_diagonal" : "turn_sideways") : "face_phone");
  }
  if (o.requirePosition !== false && setup.views.length && !inPosition) return not("get_in_position");
  return { ready: true, prompt: "ready", ...base };
}

/** Readiness, steady: a prompt shows once it held `steadyMs`; `ready` once ready held `readyMs` (in position). */
export class ReadyGate {
  private shown: ReadyReport | null = null;
  private pending: { prompt: ReadyPrompt; since: number } | null = null;
  private readySince = 0;
  constructor(
    readonly move: MoveDef,
    private readonly o: { steadyMs?: number; readyMs?: number; requirePosition?: boolean } = {},
  ) {}

  /** Feed every frame (null: nobody). Returns the steady report (the first frame's at once). */
  push(f: PoseFrame | null, nowMs: number): ReadyReport & { readyForMs: number } {
    const r = readiness(f, this.move, { requirePosition: this.o.requirePosition ?? true });
    if (r.ready) {
      if (!this.readySince) this.readySince = nowMs;
    } else this.readySince = 0;
    const steady = this.o.steadyMs ?? 1000;
    if (!this.shown || this.shown.prompt === r.prompt) {
      this.shown = r;
      this.pending = null;
    } else {
      if (!this.pending || this.pending.prompt !== r.prompt) this.pending = { prompt: r.prompt, since: nowMs };
      if (nowMs - this.pending.since >= steady) {
        this.shown = r;
        this.pending = null;
      }
    }
    const readyForMs = this.readySince ? nowMs - this.readySince : 0;
    const readyNow = readyForMs >= (this.o.readyMs ?? 1000);
    const out = readyNow
      ? { ...r, prompt: "ready" as const, ready: true }
      : { ...this.shown, ready: false, prompt: this.shown.prompt === "ready" ? ("get_in_position" as const) : this.shown.prompt };
    return { ...out, readyForMs };
  }
}

// ── Counting from every angle ────────────────────────────────────────────────────────────────────────────────────

/** A rep from MoveCounter: which angle counted it. */
export type ViewRepEvent = RepEvent & { view: CameraPlacement | "either" };

/**
 * A rep move counted from its main angle and its other ones (MoveDef.alts) at once: the angles' checks exclude each
 * other (a push-up's tilt needs a side view, its "torso pointing at the phone" a front view), and a rep finished by
 * one angle within MERGE_MS of a rep by another is the same rep, counted once. Same shape as RepCounter.push.
 */
export class MoveCounter {
  static readonly MERGE_MS = 900;
  private readonly counters: { view: CameraPlacement | "either"; rc: RepCounter }[];
  private lastRep: { t: number; i: number } | null = null;
  readonly sig: SignalSpec;

  constructor(readonly move: MoveDef) {
    if (!move.sig || !move.rep) throw new Error(`${move.id} is not a camera rep move`);
    this.sig = move.sig;
    this.counters = [{ view: move.view, rc: new RepCounter(move.sig, move.rep, move.guards ?? [], move.cues ?? []) }];
    for (const a of move.alts ?? []) this.counters.push({ view: a.view, rc: altCounter(a) });
  }

  /** The angle that counted the last rep. */
  get lastView(): CameraPlacement | "either" | null {
    return this.lastRep ? this.counters[this.lastRep.i]!.view : null;
  }

  /** Reps that reached the signal's position without the move's path (hands moved, hips stayed up). */
  get rejected(): number {
    return this.counters.reduce((n, c) => n + c.rc.rejected, 0);
  }

  push(f: PoseFrame): { reps: ViewRepEvent[]; partials: PartialEvent[] } {
    const reps: ViewRepEvent[] = [];
    const partials: PartialEvent[] = [];
    this.counters.forEach((c, i) => {
      const r = c.rc.push(f);
      for (const ev of r.reps) {
        if (this.lastRep && this.lastRep.i !== i && ev.t - this.lastRep.t < MoveCounter.MERGE_MS) continue;
        this.lastRep = { t: ev.t, i };
        reps.push({ ...ev, view: c.view });
      }
      // Partials only from the angle you're seen from (the main one unless an alt counted last).
      if (i === (this.lastRep?.i ?? 0)) partials.push(...r.partials);
    });
    return { reps, partials };
  }
}

const altCounter = (a: AltCount) => new RepCounter(a.sig, a.rep, a.guards ?? [], a.cues ?? []);

/** The counter a set uses: a MoveCounter when the move counts from other angles too, else its RepCounter. */
export function moveCounter(m: MoveDef): MoveCounter | RepCounter | null {
  if (m.kind !== "reps" || !m.sig || !m.rep || m.judge === "manual") return null;
  return m.alts?.length ? new MoveCounter(m) : new RepCounter(m.sig, m.rep, m.guards ?? [], m.cues ?? []);
}
