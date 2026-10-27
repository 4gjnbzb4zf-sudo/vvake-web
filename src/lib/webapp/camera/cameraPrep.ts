// Copied from VVFit packages/game-core/src/cameraPrep.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
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
  const p = viewPrompt(m);
  return p ? READY_TEXT[p][lang] : null;
}

/** The angle prompt for a move counted from one angle (a diagonal too: the plank), or null. */
export function viewPrompt(m: MoveDef): "turn_sideways" | "face_phone" | "turn_diagonal" | null {
  if (anyView(m)) return null;
  const all = validatedViews(m);
  const v = all.filter((x) => x !== "diagonal");
  if (v.length !== 1) return null;
  if (v[0] === "side") return all.includes("diagonal") ? "turn_diagonal" : "turn_sideways";
  return "face_phone";
}

/**
 * Only what changes between two moves (tester report 2026-10-27: repositioning between standing and floor moves was
 * tiring): the angle to turn to for `next` when the last move's best angle doesn't count it, else null (stay as you
 * are). No previous move (the first one, or one you count yourself): the next move's own angle prompt.
 */
export function turnFor(
  prev: MoveDef | null | undefined,
  next: MoveDef | null | undefined,
): "turn_sideways" | "face_phone" | "turn_diagonal" | null {
  if (!next) return null;
  const nv = validatedViews(next);
  if (!nv.length) return null;
  const pv = prev ? validatedViews(prev) : [];
  // You're at the last move's best angle (where its line put you): stay when the next move counts from it.
  if (pv.length && nv.includes(pv[0]!)) return null;
  return viewPrompt(next);
}

// ── One camera spot for the whole workout ───────────────────────────────────────────────────────────────────────

export type PlacementKind = "mixed" | "floor" | "standing" | "none";

export interface WorkoutPlacement {
  kind: PlacementKind;
  /** Where the phone goes, once for the whole workout. */
  distanceM: [number, number];
  /** Said once at the start (and shown on the plan). */
  line: string;
}

/**
 * Where to put the phone once for the whole workout (tester report 2026-10-27). Mixed standing and floor moves: low
 * (on the floor or a low step) 2 to 2.5 m away, the spot the replay tests count both from (test/cameraV3.test.ts:
 * squats, Romanian deadlifts, rows, presses side-on, push-ups and the plank, phone 0.1 to 0.7 m high); from there
 * you only turn. Floor only: on the floor 1.5 to 2.5 m. Standing only: about waist height, 2 to 3 m.
 */
export function workoutPlacement(moveIds: readonly string[], lang: Lang): WorkoutPlacement {
  const fr = lang === "fr";
  const ms = [...new Set(moveIds)].map((id) => cameraMove(id)).filter((m): m is MoveDef => !!m && validatedViews(m).length > 0);
  const floor = ms.some((m) => floorMove(m));
  const standing = ms.some((m) => !floorMove(m));
  if (floor && standing)
    return {
      kind: "mixed",
      distanceM: [2, 2.5],
      line: fr
        ? "Un seul endroit pour toute la séance : le téléphone bas, au sol ou sur une marche, à 2–2,5 m, tout ton corps visible debout comme au sol. Ensuite tu te tournes seulement : je te dis quand."
        : "One spot for the whole workout: the phone low, on the floor or a step, 2–2.5 m away, your whole body in the picture standing and lying. After that you only turn: I’ll tell you when.",
    };
  if (floor)
    return {
      kind: "floor",
      distanceM: [1.5, 2.5],
      line: fr
        ? "Pose le téléphone au sol à 1,5–2,5 m, tout ton corps visible de la tête aux pieds."
        : "Put the phone on the floor 1.5–2.5 m away, your whole body in the picture, head to feet.",
    };
  if (standing)
    return {
      kind: "standing",
      distanceM: [2, 3],
      line: fr
        ? "Pose le téléphone à hauteur de taille à 2–3 m, tout ton corps visible."
        : "Put the phone at about waist height 2–3 m away, your whole body in the picture.",
    };
  return { kind: "none", distanceM: [2, 3], line: "" };
}

// ── The set's intro: the exact variation, stance and equipment ───────────────────────────────────────────────────

/**
 * How the move is set up (tester report 2026-10-27: "goblet squat, close stance with weights" left the variation
 * unclear): the stance and where the weight is, in one short sentence said with the demo and shown before the set.
 * The full how-to lives elsewhere (move explanations); this is the one line before a set.
 */
const SETUP: Readonly<Record<string, Line>> = {
  squat: l(
    "Feet shoulder-width, toes slightly out, arms forward for balance.",
    "Pieds largeur d’épaules, pointes un peu ouvertes, bras devant pour l’équilibre.",
  ),
  "goblet-squat": l(
    "Feet shoulder-width, one dumbbell held upright at your chest, elbows in.",
    "Pieds largeur d’épaules, un haltère tenu debout contre la poitrine, coudes serrés.",
  ),
  "back-squat": l("Bar on your upper back, feet shoulder-width.", "Barre sur le haut du dos, pieds largeur d’épaules."),
  "front-squat": l(
    "Bar on the front of your shoulders, elbows high, feet shoulder-width.",
    "Barre sur l’avant des épaules, coudes hauts, pieds largeur d’épaules.",
  ),
  "romanian-deadlift": l(
    "Feet hip-width, a dumbbell in each hand in front of your thighs, knees soft.",
    "Pieds largeur de hanches, un haltère dans chaque main devant les cuisses, genoux souples.",
  ),
  deadlift: l(
    "Feet hip-width, the weight close to your shins, back flat.",
    "Pieds largeur de hanches, la charge près des tibias, dos plat.",
  ),
  "bent-over-row": l(
    "Hinge forward about 45°, a dumbbell in each hand, arms long.",
    "Buste penché à 45° environ, un haltère dans chaque main, bras tendus.",
  ),
  "overhead-press": l(
    "Standing, feet hip-width, dumbbells at your shoulders, palms forward.",
    "Debout, pieds largeur de hanches, haltères aux épaules, paumes vers l’avant.",
  ),
  "push-press": l(
    "Dumbbells at your shoulders, a small dip of the knees to drive them up.",
    "Haltères aux épaules, une petite flexion des genoux pour pousser.",
  ),
  "biceps-curl": l(
    "Standing, a dumbbell in each hand, elbows at your sides, palms forward.",
    "Debout, un haltère dans chaque main, coudes le long du corps, paumes vers l’avant.",
  ),
  "hammer-curl": l(
    "Standing, a dumbbell in each hand, palms facing each other.",
    "Debout, un haltère dans chaque main, paumes face à face.",
  ),
  "lateral-raise": l(
    "Standing, a light dumbbell in each hand at your sides, elbows soft.",
    "Debout, un haltère léger dans chaque main le long du corps, coudes souples.",
  ),
  "front-raise": l(
    "Standing, a light dumbbell in each hand in front of your thighs.",
    "Debout, un haltère léger dans chaque main devant les cuisses.",
  ),
  "upright-row": l(
    "Standing, the weights in front of your thighs, hands close.",
    "Debout, les charges devant les cuisses, mains rapprochées.",
  ),
  shrug: l(
    "Standing, a dumbbell in each hand at your sides, arms long.",
    "Debout, un haltère dans chaque main le long du corps, bras tendus.",
  ),
  "triceps-extension": l(
    "One dumbbell held in both hands above your head, elbows close.",
    "Un haltère tenu à deux mains au-dessus de la tête, coudes serrés.",
  ),
  "triceps-kickback": l(
    "Hinged forward, upper arm along your body, a dumbbell in each hand.",
    "Buste penché, bras collé au corps, un haltère dans chaque main.",
  ),
  "bench-press": l(
    "Lying on the bench, feet flat, the weight above your chest.",
    "Allongé sur le banc, pieds à plat, la charge au-dessus de la poitrine.",
  ),
  "floor-press": l(
    "Lying on the floor, knees bent, dumbbells above your chest.",
    "Allongé au sol, genoux pliés, haltères au-dessus de la poitrine.",
  ),
  "hip-thrust": l(
    "Upper back on a bench, feet flat, the weight on your hips.",
    "Haut du dos sur un banc, pieds à plat, la charge sur les hanches.",
  ),
  "kettlebell-swing": l(
    "Feet a little wider than shoulders, the kettlebell held in both hands.",
    "Pieds un peu plus larges que les épaules, le kettlebell à deux mains.",
  ),
  thruster: l(
    "Dumbbells at your shoulders, feet shoulder-width: squat, then press.",
    "Haltères aux épaules, pieds largeur d’épaules : squat, puis développé.",
  ),
  "weighted-lunge": l(
    "A dumbbell in each hand at your sides, step forward.",
    "Un haltère dans chaque main le long du corps, un pas en avant.",
  ),
  "weighted-reverse-lunge": l(
    "A dumbbell in each hand at your sides, step back.",
    "Un haltère dans chaque main le long du corps, un pas en arrière.",
  ),
  "farmer-carry": l("A heavy weight in each hand at your sides, stand tall.", "Une charge lourde dans chaque main, grandis-toi."),
  clean: l(
    "The weight at your shins, back flat: pull and catch it at your shoulders.",
    "La charge aux tibias, dos plat : tire et réceptionne aux épaules.",
  ),
  "push-up": l(
    "Hands under your shoulders, body straight from head to heels.",
    "Mains sous les épaules, corps droit de la tête aux talons.",
  ),
  "knee-push-up": l(
    "Knees down, hands under your shoulders, body straight from head to knees.",
    "Genoux au sol, mains sous les épaules, corps droit de la tête aux genoux.",
  ),
  plank: l("On your forearms, elbows under your shoulders, body straight.", "Sur les avant-bras, coudes sous les épaules, corps droit."),
  "reverse-lunge": l("Feet hip-width, step one foot back, then the other.", "Pieds largeur de hanches, recule un pied, puis l’autre."),
  lunge: l("Feet hip-width, step one foot forward, then the other.", "Pieds largeur de hanches, avance un pied, puis l’autre."),
  "glute-bridge": l("On your back, knees bent, feet flat near your hips.", "Sur le dos, genoux pliés, pieds à plat près des fesses."),
  "chair-squat": l("A chair behind you, feet shoulder-width.", "Une chaise derrière toi, pieds largeur d’épaules."),
  "incline-push-up": l("Hands on a wall, a table or a bench, body straight.", "Mains sur un mur, une table ou un banc, corps droit."),
};

/** The move's setup in one sentence ("Feet shoulder-width, one dumbbell held upright at your chest."), or null. */
export function setupOf(id: string, lang: Lang): string | null {
  return SETUP[id]?.[lang] ?? null;
}

export interface SetIntro {
  /** "Goblet squat". */
  name: string;
  /** The stance and the equipment (null: nothing to add to the demo). */
  setup: string | null;
  /** One or two form cues. */
  cues: string[];
}

/** What the screen shows before a set (the demo and the get-ready panel): the variation, its setup, 1–2 cues. */
export function setIntro(id: string, lang: Lang, label?: string): SetIntro {
  const m = cameraMove(id);
  const name = label || (m?.name[lang] ?? id);
  const setup = setupOf(id, lang);
  const cues = m ? moveTips(m, lang).filter((c) => c !== setup) : [];
  return { name, setup, cues };
}

/** "Next up: Reverse lunge. Turn sideways so I can track you." */
export function nextUpLine(id: string, lang: Lang): string {
  const m = cameraMove(id);
  const name = m?.name[lang] ?? id;
  const ask = m ? viewAsk(m, lang) : null;
  const head = lang === "fr" ? `Ensuite : ${name}.` : `Next up: ${name}.`;
  return ask ? `${head} ${ask}` : head;
}

/**
 * Said in the last seconds of the rest: get into position for the next set. `turn`: only what changes from the move
 * before (turnFor); left out, the move's own angle.
 */
export function getReadyLine(id: string, lang: Lang, turn?: ReadyPrompt | null): string {
  return getReadyParts(id, lang, turn).join(" ");
}

/** getReadyLine in its fixed parts ("Get ready.", the angle, the start position), each a recorded line. */
export function getReadyParts(id: string, lang: Lang, turn?: ReadyPrompt | null): string[] {
  const m = cameraMove(id);
  const pos = m && (m.kind === "hold" || floorMove(m)) ? positionLine(m, lang) : null;
  const ask = turn === undefined ? (m ? viewAsk(m, lang) : null) : turn ? READY_TEXT[turn][lang] : null;
  return [lang === "fr" ? "Prépare-toi." : "Get ready.", ask, pos].filter((x): x is string => !!x);
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
