import { CAMERA_MOVES, cameraMove } from "@/lib/webapp/camera/cameraMoves";
import { CUSTOM_MOVE_ID, CUSTOM_MOVE_ICONS, CUSTOM_MOVE_NAME_MAX, type CustomMove } from "@/lib/webapp/camera/cameraCustom";
import type { MoveTemplate } from "@/lib/webapp/camera/cameraTemplate";
import {
  cleanTraining,
  TRAINING_LIMITS,
  type Training,
  type TrainingLevel,
  type TrainingProblem,
  type TrainingVisibility,
} from "@/lib/webapp/camera/cameraTraining";
import { ugcProblem, type UgcProblem } from "@/lib/webapp/camera/ugc";
import type { NewMove, TrainingBody } from "./api";

/**
 * The web app's training builder and "teach a move" (ADR-0047): what the form holds, turned into the API body and
 * checked by game-core's own rules (cleanTraining, ugcProblem) before anything is sent, so the browser refuses exactly
 * what the API refuses.
 */

export type Intensity = "none" | "zone" | "effort";

export interface DraftSet {
  move: string;
  /** Reps, or the hold time in seconds (from the move's kind). */
  amount: number;
  intensity: Intensity;
  zone: number;
  rpe: number;
  restS: number;
}

export interface Draft {
  id: string | null;
  name: string;
  description: string;
  level: TrainingLevel;
  visibility: TrainingVisibility;
  rounds: number;
  roundRestS: number;
  rest: "flex" | "fixed";
  tags: string;
  sets: DraftSet[];
}

export const kindOf = (move: string, moves: readonly Pick<CustomMove, "id" | "kind">[]): "reps" | "hold" =>
  CUSTOM_MOVE_ID.test(move) ? (moves.find((m) => m.id === move)?.kind ?? "reps") : (cameraMove(move)?.kind ?? "reps");

/** A new set for a move: 12 reps or a 30 s hold, zone 3, 45 s rest. */
export function newSet(move: string, moves: readonly Pick<CustomMove, "id" | "kind">[]): DraftSet {
  return { move, amount: kindOf(move, moves) === "hold" ? 30 : 12, intensity: "zone", zone: 3, rpe: 6, restS: 45 };
}

export function emptyDraft(): Draft {
  return {
    id: null,
    name: "",
    description: "",
    level: "intermediate",
    visibility: "unlisted",
    rounds: 1,
    roundRestS: 60,
    rest: "flex",
    tags: "",
    sets: [newSet("squat", [])],
  };
}

/** The form's training, as the API takes it (only the custom moves its sets use travel with it). */
export function draftBody(d: Draft, myMoves: readonly CustomMove[], lang: "en" | "fr"): TrainingBody {
  const used = myMoves.filter((m) => d.sets.some((s) => s.move === m.id));
  return {
    name: d.name,
    description: d.description,
    level: d.level,
    visibility: d.visibility,
    lang,
    rounds: d.rounds,
    ...(d.rounds > 1 ? { roundRestS: d.roundRestS } : {}),
    ...(d.rest === "fixed" ? { rest: "fixed" as const } : {}),
    tags: d.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    moves: used,
    sets: d.sets.map((s) => ({
      move: s.move,
      ...(kindOf(s.move, myMoves) === "hold" ? { holdS: s.amount } : { reps: s.amount }),
      ...(s.intensity === "zone" ? { zone: s.zone as 1 | 2 | 3 | 4 | 5 } : {}),
      ...(s.intensity === "effort" ? { rpe: s.rpe } : {}),
      restS: s.restS,
    })),
  };
}

/** The same check the phone and the API make (game-core cleanTraining): the cleaned training, or the first problem. */
export function checkDraft(
  d: Draft,
  myMoves: readonly CustomMove[],
  lang: "en" | "fr",
): { training: Training } | { problem: TrainingProblem } {
  return cleanTraining(draftBody(d, myMoves, lang));
}

/** A training back into the form (edit). */
export function draftOf(t: Training): Draft {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    level: t.level,
    visibility: t.visibility,
    rounds: t.rounds,
    roundRestS: t.roundRestS ?? 60,
    rest: t.rest ?? "flex",
    tags: (t.tags ?? []).join(", "),
    sets: t.sets.map((s) => ({
      move: s.move,
      amount: s.reps ?? s.holdS ?? 10,
      intensity: s.zone ? "zone" : s.rpe ? "effort" : "none",
      zone: s.zone ?? 3,
      rpe: s.rpe ?? 6,
      restS: s.restS ?? 45,
    })),
  };
}

/** Moves the builder offers: the catalogue, by name, then yours. */
export function builderMoves(
  myMoves: readonly CustomMove[],
  lang: "en" | "fr",
): { catalogue: { id: string; name: string }[]; mine: { id: string; name: string }[] } {
  return {
    catalogue: CAMERA_MOVES.map((m) => ({ id: m.id, name: m.name[lang] })).sort((a, b) => a.name.localeCompare(b.name, lang)),
    mine: myMoves.map((m) => ({ id: m.id, name: m.name })),
  };
}

export const canAddSet = (d: Draft) => d.sets.length < TRAINING_LIMITS.sets;

/** Moves a set up (-1) or down (+1). */
export function moveSet(sets: readonly DraftSet[], i: number, by: -1 | 1): DraftSet[] {
  const j = i + by;
  if (j < 0 || j >= sets.length) return [...sets];
  const out = [...sets];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

// ── Teach a move ───────────────────────────────────────────────────────────────────────────────────────────────

/** A taught move's name: required, 32 characters at most, through the public text filter. */
export function moveNameProblem(name: string): UgcProblem | "long" | null {
  const n = name.trim();
  if ([...n].length > CUSTOM_MOVE_NAME_MAX) return "long";
  return ugcProblem(n);
}

/** POST /v1/moves body (the server makes the id and checks it again with cleanCustomMove). */
export function newMoveBody(template: MoveTemplate, name: string, icon: string, weighted: boolean, checked: boolean): NewMove {
  return {
    name: name.trim().slice(0, CUSTOM_MOVE_NAME_MAX),
    icon: (CUSTOM_MOVE_ICONS as readonly string[]).includes(icon) ? icon : CUSTOM_MOVE_ICONS[0],
    kind: template.kind,
    ...(weighted ? { weighted: true } : {}),
    template,
    checked,
  };
}

/** A glyph for each custom move icon (SF Symbol names in the API; the web shows a plain character). */
export const ICON_GLYPH: Readonly<Record<string, string>> = {
  "figure.strengthtraining.functional": "◆",
  "figure.cross.training": "✚",
  "figure.core.training": "◎",
  "figure.martial.arts": "✦",
  "figure.boxing": "●",
  "figure.dance": "♪",
  "figure.yoga": "◐",
  "figure.flexibility": "〰",
  "figure.highintensity.intervaltraining": "⚑",
  "figure.step.training": "▤",
  "figure.arms.open": "⋎",
  "dumbbell.fill": "▬",
  "flame.fill": "▲",
  "bolt.fill": "ϟ",
  "star.fill": "★",
  "heart.fill": "♥",
};
