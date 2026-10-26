// Copied from VVFit packages/game-core/src/cameraPrep.ts (e628403d 2026-10-26) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts, the lines around a set (tester report 2026-10-26), on top of cameraReady.ts (readiness, the
 * angles a move counts from, setupLine): the start position named for the move, "Next: … Turn sideways so I can
 * track you." (only when one angle counts it), "Get ready…" in the rest's last seconds, one or two form tips, the
 * easier variation of a move, and the prompt line for the screen and the voice. Pure, EN/FR.
 */
import { cameraMove, type MoveDef } from "./cameraMoves";
import { cueLine } from "./cameraCues";
import { moveTip } from "./cameraDemo";
import { anyView, moveSetup, READY_TEXT, validatedViews, type ReadyPrompt } from "./cameraReady";

type Line = { en: string; fr: string };
const l = (en: string, fr: string): Line => ({ en, fr });
type Lang = "en" | "fr";

/** A floor move (plank, push-up, bridge…): the phone goes low. */
export const floorMove = (m: MoveDef) => moveSetup(m).floor;

/** The start position, named for the move where it helps ("Get into your plank."). */
export function positionLine(m: MoveDef, lang: Lang): string {
  const fr = lang === "fr";
  if (m.id === "plank" || m.id === "side-plank") return fr ? "Mets-toi en planche." : "Get into your plank.";
  if (m.family === "push" && floorMove(m))
    return fr ? "Mets-toi en haut de la pompe, bras tendus." : "Get into the top of a push-up, arms straight.";
  if (m.id === "wall-sit") return fr ? "Dos au mur, descends en chaise." : "Back to the wall, sit down into the chair.";
  if (floorMove(m)) return fr ? "Mets-toi au sol en position de départ." : "Get down into the start position.";
  return READY_TEXT.get_in_position[lang];
}

/** A prompt in words, the start position named for the move ("Get into your plank."). */
export function promptLine(p: ReadyPrompt, m: MoveDef | null | undefined, lang: Lang): string {
  if (p === "get_in_position" && m) return positionLine(m, lang);
  return READY_TEXT[p][lang];
}

/** The angle to ask for when only one counts the move ("Turn sideways so I can track you."); null when several do. */
export function viewAsk(m: MoveDef, lang: Lang): string | null {
  if (anyView(m)) return null;
  const v = validatedViews(m).filter((x) => x !== "diagonal");
  if (v.length !== 1) return null;
  return READY_TEXT[v[0] === "side" ? "turn_sideways" : "face_phone"][lang];
}

/** "Next up: Reverse lunge. Turn sideways so I can track you." */
export function nextUpLine(id: string, lang: Lang): string {
  const m = cameraMove(id);
  const name = m?.name[lang] ?? id;
  const ask = m ? viewAsk(m, lang) : null;
  const head = lang === "fr" ? `Ensuite : ${name}.` : `Next up: ${name}.`;
  return ask ? `${head} ${ask}` : head;
}

/** Said in the last seconds of the rest: get into position for the next set. */
export function getReadyLine(id: string, lang: Lang): string {
  const m = cameraMove(id);
  const pos = m && (m.kind === "hold" || floorMove(m)) ? positionLine(m, lang) : null;
  const ask = m ? viewAsk(m, lang) : null;
  return [lang === "fr" ? "Prépare-toi." : "Get ready.", ask, pos].filter(Boolean).join(" ");
}

/** One or two form tips for the preview: the move's key tip, then its first form cue when it says something else. */
export function moveTips(m: MoveDef, lang: Lang): string[] {
  const out = [moveTip(m, lang)];
  for (const c of m.cues ?? []) {
    const line = cueLine(c.id, m, lang);
    if (!out.includes(line)) {
      out.push(line);
      break;
    }
  }
  return out.slice(0, 2);
}

// ── Easier variations ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The easier way to do a move: another catalogue move the camera counts (knee push-ups for push-ups), and/or a tip
 * for a variation the camera counts as the same move (a chair behind you for squats, hands on a wall or a bench).
 */
const EASIER: Readonly<Record<string, { move?: string; tip: Line }>> = {
  "push-up": {
    move: "knee-push-up",
    tip: l("Knees down, or hands on a bench or a wall (incline).", "Genoux au sol, ou mains sur un banc ou un mur (inclinée)."),
  },
  "knee-push-up": {
    move: "incline-push-up",
    tip: l("Hands on a wall or a table: the higher, the easier.", "Mains sur un mur ou une table : plus c’est haut, plus c’est facile."),
  },
  "incline-push-up": { tip: l("Hands higher on the wall, feet closer to it.", "Mains plus haut sur le mur, pieds plus près.") },
  "chair-squat": { tip: l("A higher chair, or hold a table for balance.", "Une chaise plus haute, ou tiens-toi à une table.") },
  "standing-knee-raise": {
    move: "march",
    tip: l("Knees only as high as is comfortable, a hand on a wall.", "Genoux aussi haut que c’est confortable, une main au mur."),
  },
  "pike-push-up": { move: "push-up", tip: l("A regular push-up, or knees down.", "Une pompe classique, ou genoux au sol.") },
  squat: {
    move: "chair-squat",
    tip: l(
      "Chair squat: sit back until you touch a chair, then stand.",
      "Squat sur chaise : descends jusqu’à toucher une chaise, puis remonte.",
    ),
  },
  "jump-squat": { move: "squat", tip: l("A squat without the jump.", "Un squat sans le saut.") },
  lunge: {
    move: "reverse-lunge",
    tip: l(
      "Step back instead: easier on the knees. Hold a wall for balance.",
      "Recule plutôt : plus doux pour les genoux. Tiens-toi à un mur.",
    ),
  },
  "reverse-lunge": {
    tip: l("Shorter steps, a hand on a wall or a chair for balance.", "Des pas plus courts, une main sur un mur ou une chaise."),
  },
  plank: { tip: l("Knees down, or forearms on a bench.", "Genoux au sol, ou avant-bras sur un banc.") },
  "side-plank": { tip: l("Bottom knee down.", "Le genou du bas au sol.") },
  burpee: { move: "squat", tip: l("Step back instead of jumping, no push-up.", "Recule en marchant au lieu de sauter, sans pompe.") },
  "mountain-climber": { tip: l("Slower, or hands on a bench.", "Plus lentement, ou mains sur un banc.") },
  "jumping-jack": { tip: l("Step out one side at a time, no jump.", "Écarte un pied après l’autre, sans sauter.") },
  "high-knees": {
    move: "march",
    tip: l("March in place, knees as high as is comfortable.", "Marche sur place, genoux aussi haut que c’est confortable."),
  },
  "sit-up": { move: "crunch", tip: l("A crunch: shoulders off the floor only.", "Un crunch : décolle juste les épaules.") },
  "pull-up": {
    move: "inverted-row",
    tip: l("An inverted row under a low bar or a sturdy table.", "Un rowing inversé sous une barre basse ou une table solide."),
  },
  "chin-up": {
    move: "inverted-row",
    tip: l("An inverted row under a low bar or a sturdy table.", "Un rowing inversé sous une barre basse ou une table solide."),
  },
  "wall-sit": { tip: l("Not so low: knees at a wider angle.", "Moins bas : les genoux moins pliés.") },
  "glute-bridge": { tip: l("Smaller range, feet closer to you.", "Moins d’amplitude, pieds plus près de toi.") },
};

export interface Easier {
  /** The catalogue move to swap to (null: same move, done the easier way). */
  move: string | null;
  tip: string;
}

export function easierOf(id: string, lang: Lang): Easier | null {
  const e = EASIER[id];
  if (!e) return null;
  return { move: e.move && cameraMove(e.move) ? e.move : null, tip: e.tip[lang] };
}
