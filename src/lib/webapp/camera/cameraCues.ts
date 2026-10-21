// Copied from VVFit packages/game-core/src/cameraCues.ts (200973e 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): what the coach says. Form cues (short, said by the coach voice through the workout voice
 * switch, ADR-0044), the framing guide and the liveness prompts, in English and French. And when a cue may be said:
 * never two in a row closer than 8 s, the same one at most every 25 s, no cue on a rep the coach just counted aloud.
 * The framing guide is written on the screen; the voice says at most one positioning line at the start and one more
 * if you're still not in view 20 s later (FramingVoice), never during the sets.
 */
import type { CueId } from "./cameraReps";
import type { BodyArea, Framing, FramingReport, FramingTip } from "./cameraPose";
import type { MoveDef } from "./cameraMoves";

type Line = { en: string; fr: string };
const l = (en: string, fr: string): Line => ({ en, fr });

export const CUE_TEXT: Readonly<Record<CueId, Line>> = {
  depth: l("Go a little deeper.", "Descends un peu plus."),
  lockout: l("Finish each rep fully.", "Va au bout de chaque répétition."),
  knee_valgus: l("Push your knees out.", "Pousse les genoux vers l’extérieur."),
  chest_up: l("Chest up.", "Poitrine haute."),
  hinge_more: l("Hinge forward a bit more.", "Penche-toi un peu plus en avant, dos droit."),
  elbow_flare: l("Elbows in a little.", "Rentre un peu les coudes."),
  symmetry: l("Even it out, left and right.", "Équilibre gauche et droite."),
  hips_sag: l("Lift your hips: keep a straight line.", "Remonte les hanches : corps bien aligné."),
  hips_pike: l("Lower your hips: keep a straight line.", "Baisse les hanches : corps bien aligné."),
  elbow_swing: l("Keep your elbows still.", "Garde les coudes fixes."),
  knees_soft: l("Push the hips back.", "Recule les hanches."),
  too_high: l("Stop at shoulder height.", "Arrête-toi à hauteur d’épaules."),
  slow_down: l("Slow it down, control the way down.", "Ralentis, contrôle la descente."),
  chin_over: l("Chin over the bar.", "Le menton au-dessus de la barre."),
  upright: l("Stay tall through the torso.", "Garde le buste droit."),
};

export function cueLine(id: CueId, move: Pick<MoveDef, "cueText"> | undefined, lang: "en" | "fr"): string {
  return (move?.cueText?.[id] ?? CUE_TEXT[id])[lang];
}

/** The framing guide's line on screen (framingLine adds the parts not seen where it says "cut off" / "not seen"). */
export const FRAMING_TEXT: Readonly<Record<Framing, Line>> = {
  ok: l("You’re in. Ready.", "C’est bon, tu es dans le cadre."),
  none: l("Step into the picture, 2–3 m from the phone.", "Entre dans le cadre, à 2–3 m du téléphone."),
  step_back: l("Step back a little.", "Recule un peu."),
  step_closer: l("Come a little closer.", "Approche-toi un peu."),
  move_left: l("Move a little to your left.", "Décale-toi un peu sur ta gauche."),
  move_right: l("Move a little to your right.", "Décale-toi un peu sur ta droite."),
  tilt_down: l("Tilt the phone down a little, or step back.", "Incline un peu le téléphone vers le bas, ou recule."),
  tilt_up: l("Tilt the phone up a little, or step back.", "Redresse un peu le téléphone, ou recule."),
  hidden: l("Turn a little toward the phone.", "Tourne-toi un peu vers le téléphone."),
};

/** Parts of the body in plain words (all plural, so one sentence fits any of them; French: their gender too). */
export const AREA_TEXT: Readonly<Record<BodyArea, Line & { fem: boolean }>> = {
  head: { en: "head", fr: "ta tête", fem: true },
  shoulders: { en: "shoulders", fr: "tes épaules", fem: true },
  arms: { en: "arms", fr: "tes bras", fem: false },
  hips: { en: "hips", fr: "tes hanches", fem: true },
  knees: { en: "knees", fr: "tes genoux", fem: false },
  feet: { en: "feet", fr: "tes pieds", fem: false },
};

function joinWords(ws: string[], lang: "en" | "fr"): string {
  if (ws.length <= 1) return ws[0] ?? "";
  return `${ws.slice(0, -1).join(", ")} ${lang === "fr" ? "et" : "and"} ${ws[ws.length - 1]}`;
}

/** "your knees and hips" / "tes genoux et tes hanches". */
export function areasText(areas: readonly BodyArea[], lang: "en" | "fr"): string {
  if (lang === "fr")
    return joinWords(
      areas.map((a) => AREA_TEXT[a].fr),
      "fr",
    );
  return `your ${joinWords(
    areas.map((a) => AREA_TEXT[a].en),
    "en",
  )}`;
}

/** The framing guide in one short line, naming what isn't seen ("Tilt the phone down: your knees are cut off."). */
export function framingLine(r: Pick<FramingReport, "state" | "missing">, lang: "en" | "fr"): string {
  const parts = r.missing.filter((a) => a !== "head");
  if (!parts.length) return FRAMING_TEXT[r.state][lang];
  const what = areasText(parts, lang);
  const fem = parts.every((a) => AREA_TEXT[a].fem);
  const cut = lang === "fr" ? `${what} sont ${fem ? "coupées" : "coupés"}` : `${what} are cut off`;
  switch (r.state) {
    case "tilt_down":
      return lang === "fr" ? `Incline le téléphone vers le bas ou recule : ${cut}.` : `Tilt the phone down or step back: ${cut}.`;
    case "tilt_up":
      return lang === "fr" ? `Redresse le téléphone ou recule : ${cut}.` : `Tilt the phone up or step back: ${cut}.`;
    case "step_back":
      return lang === "fr" ? `Recule un peu : ${cut}.` : `Step back a little: ${cut}.`;
    case "hidden":
      return lang === "fr"
        ? `VVake ne voit pas bien ${what} : tourne-toi un peu vers le téléphone.`
        : `VVake can’t see ${what} well: turn a little toward the phone.`;
    default:
      return FRAMING_TEXT[r.state][lang];
  }
}

/** The tips under the framing line. */
export const FRAMING_TIP_TEXT: Readonly<Record<FramingTip, Line>> = {
  light: l("More light helps: face a window or turn a lamp on.", "Plus de lumière aide : mets-toi face à une fenêtre ou allume une lampe."),
  side_on: l(
    "Side-on works best for this move: turn your side to the phone.",
    "De profil, c’est mieux pour ce mouvement : mets-toi de côté face au téléphone.",
  ),
  front_on: l("Facing the phone works best for this move.", "Face au téléphone, c’est mieux pour ce mouvement."),
};

/** Always on screen while you set up: what VVake reads, and that the head and feet don't matter. */
export const FRAMING_NOTE: Line = l(
  "VVake reads your shoulders, arms, hips and knees. Your head and feet can be out of the picture.",
  "VVake lit tes épaules, tes bras, tes hanches et tes genoux. Ta tête et tes pieds peuvent sortir du cadre.",
);

/**
 * The only framing lines the voice says: one calm line when the camera starts, and one more if you still haven't been
 * in view 20 s later. Once you've been in view, the voice never talks about framing again (you'll move away from the
 * phone to train; the screen keeps the tips).
 */
export const FRAMING_VOICE: Readonly<{ start: Line; remind: Line; remindAfterMs: number }> = {
  start: l(
    "Camera on. Stand 2 to 3 metres away; the screen shows how to get in view.",
    "Caméra allumée. Mets-toi à 2 ou 3 mètres ; l’écran te montre comment bien te placer.",
  ),
  remind: l("Still can’t see you well. Check the tips on the screen.", "Je ne te vois pas encore bien. Regarde les conseils à l’écran."),
  remindAfterMs: 20_000,
};

export class FramingVoice {
  private startedAt: number | null = null;
  private seenOk = false;
  private reminded = false;

  /** The line to say when the camera starts (once; null after). */
  start(nowMs: number): "start" | null {
    if (this.startedAt !== null) return null;
    this.startedAt = nowMs;
    return "start";
  }

  /** Each frame's framing: `remind` once, 20 s in, if you were never in view; null otherwise. */
  push(nowMs: number, state: Framing): "remind" | null {
    if (this.startedAt === null) this.startedAt = nowMs;
    if (state === "ok") this.seenOk = true;
    if (this.seenOk || this.reminded) return null;
    if (nowMs - this.startedAt < FRAMING_VOICE.remindAfterMs) return null;
    this.reminded = true;
    return "remind";
  }
}

/** Paces the spoken form cues. */
export class CuePacer {
  private lastAny = -Infinity;
  private last = new Map<CueId, number>();
  constructor(
    private readonly gapMs = 8000,
    private readonly sameMs = 25_000,
  ) {}
  /** The cue to say now from these (the first allowed), and remembers it. */
  pick(t: number, cues: readonly CueId[]): CueId | null {
    if (t - this.lastAny < this.gapMs) return null;
    for (const c of cues) {
      if (t - (this.last.get(c) ?? -Infinity) < this.sameMs) continue;
      this.lastAny = t;
      this.last.set(c, t);
      return c;
    }
    return null;
  }
}

/** The rep count said aloud: every rep with the voice on; every 5th on "essential only"; never off. */
export function sayRep(n: number, mode: "on" | "essential" | "off"): boolean {
  if (mode === "off" || n <= 0) return false;
  return mode === "on" ? true : n % 5 === 0;
}

/** Form cues are coaching: said with the voice on, not on "essential only". */
export const sayCues = (mode: "on" | "essential" | "off") => mode === "on";
