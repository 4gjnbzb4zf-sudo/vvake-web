// Copied from VVFit packages/game-core/src/cameraCustom.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Custom moves (ADR-0047): a move you taught VVake (cameraTemplate.ts), as a catalogue-like MoveDef the session
 * engine, the hands-free flow, the demo and auto-detect use like any other. Ids are `m_` + 10 lower-case letters or
 * digits (the API makes them). The moves the session can use are registered here (yours, and those of a training
 * you joined or opened from a share link): `cameraMove(id)` finds them next to the catalogue.
 */
import type { MoveDef, MoveFamily } from "./cameraMoves";
import { cleanTemplate, type MoveTemplate } from "./cameraTemplate";

export const CUSTOM_MOVE_ID = /^m_[a-z0-9]{10}$/;
export const CUSTOM_MOVE_NAME_MAX = 32;
/** Moves one account can keep. */
export const CUSTOM_MOVE_MAX = 40;

/** Icons a custom move can have (SF Symbol names; the Android app maps them). */
export const CUSTOM_MOVE_ICONS = [
  "figure.strengthtraining.functional",
  "figure.cross.training",
  "figure.core.training",
  "figure.martial.arts",
  "figure.boxing",
  "figure.dance",
  "figure.yoga",
  "figure.flexibility",
  "figure.highintensity.intervaltraining",
  "figure.step.training",
  "figure.arms.open",
  "dumbbell.fill",
  "flame.fill",
  "bolt.fill",
  "star.fill",
  "heart.fill",
] as const;

export interface CustomMove {
  id: string;
  name: string;
  icon: string;
  kind: "reps" | "hold";
  family?: MoveFamily;
  /** Weighted: asks for a load like the catalogue's weighted moves. */
  weighted?: boolean;
  template: MoveTemplate;
  /** The test after teaching passed (cameraTemplate.liveTestPassed). */
  checked: boolean;
  /** Who taught it (shown on a shared training: "taught by …"). */
  by?: { id: string; name: string } | null;
}

/** Whether sets of this move can earn camera points: a good template whose live test passed. Never prizes. */
export function customMoveEarns(m: Pick<CustomMove, "template" | "checked">): boolean {
  return m.checked && m.template.quality === "good";
}

const SPORT_OF: Readonly<Record<MoveFamily, MoveDef["sport"]>> = {
  squat: "functional-strength",
  lunge: "functional-strength",
  hinge: "functional-strength",
  push: "functional-strength",
  pull: "functional-strength",
  press: "strength",
  arms: "strength",
  raise: "strength",
  core: "core",
  cardio: "hiit",
  carry: "strength",
  mobility: "flexibility",
};

export type CustomMoveDef = MoveDef & { custom: CustomMove };

/** The custom move as a MoveDef (judged `count`: counted from the pose, no form cues promised). */
export function customMoveDef(m: CustomMove): CustomMoveDef {
  const family = m.family ?? (m.kind === "hold" ? "mobility" : "core");
  return {
    id: m.id,
    name: { en: m.name, fr: m.name },
    family,
    equipment: m.weighted ? ["dumbbell"] : ["bodyweight"],
    weighted: !!m.weighted,
    kind: m.kind,
    view: m.template.demo.view,
    judge: "count",
    detect: true,
    sport: SPORT_OF[family],
    custom: m,
  };
}

const REGISTRY = new Map<string, CustomMoveDef>();

/** The custom moves this session can use (replaces the previous set). */
export function registerCustomMoves(moves: readonly CustomMove[]) {
  REGISTRY.clear();
  for (const m of moves) if (CUSTOM_MOVE_ID.test(m.id)) REGISTRY.set(m.id, customMoveDef(m));
}
/** Adds a few (a training opened from a link) without dropping the others. */
export function addCustomMoves(moves: readonly CustomMove[]) {
  for (const m of moves) if (CUSTOM_MOVE_ID.test(m.id)) REGISTRY.set(m.id, customMoveDef(m));
}
export const customMove = (id: string): CustomMoveDef | undefined => REGISTRY.get(id);
export const registeredCustomMoves = (): CustomMoveDef[] => [...REGISTRY.values()];
export const isCustomMoveId = (id: string) => CUSTOM_MOVE_ID.test(id);

/** A custom move as received (API, share link): checked and cleaned, or null. */
export function cleanCustomMove(x: unknown): CustomMove | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || !CUSTOM_MOVE_ID.test(o.id)) return null;
  const template = cleanTemplate(o.template);
  if (!template) return null;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, CUSTOM_MOVE_NAME_MAX) : "";
  if (!name) return null;
  const icon = typeof o.icon === "string" && (CUSTOM_MOVE_ICONS as readonly string[]).includes(o.icon) ? o.icon : CUSTOM_MOVE_ICONS[0];
  const by = o.by && typeof o.by === "object" ? (o.by as Record<string, unknown>) : null;
  return {
    id: o.id,
    name,
    icon,
    kind: template.kind,
    ...(typeof o.family === "string" && o.family in SPORT_OF ? { family: o.family as MoveFamily } : {}),
    ...(o.weighted === true ? { weighted: true } : {}),
    template,
    checked: o.checked === true,
    by: by && typeof by.id === "string" && typeof by.name === "string" ? { id: by.id, name: by.name.slice(0, 40) } : null,
  };
}
