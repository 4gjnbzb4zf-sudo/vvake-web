import type { Locale } from "@/i18n/config";
import {
  weekdayOf,
  type EditDraft,
  type Intensity,
  type MissedView,
  type PostponeChoiceView,
  type SeasonSessionView,
  type ServerEdit,
  type SessionType,
} from "./season";

/**
 * Editing the planned week by hand on the web (VVFit ADR-0052, game-core planEdit.ts): the edit sheet's draft, its live
 * summary ("Bike · 60 min · Zone 2 · Sat 9:00", the same words as game-core sessionSummary), the one `change` edit it
 * sends (only the fields that changed; null clears one), "Add a session" and "Duplicate" as an `add`, and the skipped
 * session's choices (tomorrow, pick a day, shorter today, skip it). Edits the API builds (a postpone, a rebalance) are
 * sent back as they came. Pure: planEdit.test.ts.
 */

export const SESSION_TYPES: readonly SessionType[] = ["easy", "long", "tempo", "intervals", "recovery", "strength"];

export const TYPE_WORD: Record<SessionType, { en: string; fr: string }> = {
  easy: { en: "Easy", fr: "Facile" },
  long: { en: "Long", fr: "Longue" },
  tempo: { en: "Tempo", fr: "Tempo" },
  intervals: { en: "Intervals", fr: "Fractionné" },
  recovery: { en: "Recovery", fr: "Récup" },
  strength: { en: "Strength", fr: "Renfo" },
};

/** A type picked in the sheet → its zone and intensity (game-core TYPE_SHAPE). */
export const TYPE_SHAPE: Record<SessionType, { zone?: number; intensity: Intensity }> = {
  easy: { zone: 2, intensity: "easy" },
  long: { zone: 2, intensity: "easy" },
  tempo: { zone: 3, intensity: "moderate" },
  intervals: { zone: 4, intensity: "hard" },
  recovery: { zone: 1, intensity: "easy" },
  strength: { intensity: "moderate" },
};

export const isSessionType = (t: unknown): t is SessionType => typeof t === "string" && (SESSION_TYPES as readonly string[]).includes(t);
export const zoneIntensity = (z: number): Intensity => (z <= 2 ? "easy" : z === 3 ? "moderate" : "hard");

/** The type a session reads as (game-core sessionType). */
export function sessionType(s: { purpose?: string | null; zone?: number | null; intensity?: string | null }): SessionType {
  switch (s.purpose) {
    case "long":
      return "long";
    case "recovery":
    case "shakeout":
      return "recovery";
    case "strength":
      return "strength";
    case "tempo":
    case "race-pace":
    case "brick":
    case "openers":
      return "tempo";
    case "intervals":
    case "hills":
    case "benchmark":
    case "race":
      return "intervals";
    default:
      return s.intensity === "hard" || (s.zone ?? 0) >= 4 ? "intervals" : s.intensity === "moderate" || s.zone === 3 ? "tempo" : "easy";
  }
}

/** "45 min", "1 h 30 min" / "1 h 30" (game-core durationText). */
export function durationText(min: number, lang: Locale): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return lang === "fr" ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${h} h${m ? ` ${m} min` : ""}`;
}

const SHORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT_FR = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export interface SummaryInput {
  sport: string;
  minutes: number;
  date: string;
  zone?: number | null;
  rpe?: number | null;
  distanceKm?: number | null;
  slot?: string | null;
  purpose?: string | null;
  intensity?: string | null;
  /** A custom training's name (else the sport's). */
  title?: string | null;
}

/** "Bike · 60 min · Zone 2 · Sat 9:00" / "Vélo · 60 min · Zone 2 · sam. 9:00" (game-core sessionSummary). */
export function sessionSummary(s: SummaryInput, lang: Locale, sportName: (key: string) => string): string {
  const fr = lang === "fr";
  const parts = [s.title || sportName(s.sport)];
  const type = sessionType(s);
  if (type !== "easy" || s.purpose === "easy") parts.push(TYPE_WORD[type][fr ? "fr" : "en"]);
  parts.push(s.minutes < 100 ? `${s.minutes} min` : durationText(s.minutes, lang));
  if (s.distanceKm) parts.push(`${s.distanceKm} km`);
  if (s.zone) parts.push(`Zone ${s.zone}`);
  if (s.rpe) parts.push(`Effort ${s.rpe}/10`);
  const day = (fr ? SHORT_FR : SHORT_EN)[weekdayOf(s.date)]!;
  parts.push(s.slot ? `${day} ${s.slot.replace(/^0/, "")}` : day);
  return parts.join(" · ");
}

// ── The edit sheet ────────────────────────────────────────────────────────────────────────────────────────────────

export interface SheetDraft {
  sport: string;
  /** A custom training kept from the session (its id and name). */
  trainingId: string | null;
  title: string | null;
  minutes: number;
  distanceKm: number | null;
  type: SessionType;
  /** The session's own purpose (kept until the type is changed: "aerobic", "hills"…). */
  purpose: string | null;
  intensity: Intensity;
  zone: number | null;
  rpe: number | null;
  date: string;
  slot: string | null;
  memo: string;
  locked: boolean;
}

const INTENSITIES: readonly Intensity[] = ["easy", "moderate", "hard", "mindful"];
const asIntensity = (i: unknown): Intensity => (INTENSITIES.includes(i as Intensity) ? (i as Intensity) : "easy");

/** The sheet's fields for a planned session. */
export function draftOfSession(x: SeasonSessionView): SheetDraft {
  return {
    sport: x.sport,
    trainingId: x.trainingId ?? null,
    title: x.trainingId ? (x.title ?? null) : null,
    minutes: x.minutes,
    distanceKm: x.distanceKm ?? null,
    type: isSessionType(x.type) ? x.type : sessionType(x),
    purpose: x.purpose ?? null,
    intensity: asIntensity(x.intensity),
    zone: x.zone ?? null,
    rpe: x.rpe ?? null,
    date: x.date,
    slot: x.slot ?? null,
    memo: x.memo ?? "",
    locked: x.locked === true,
  };
}

/** "Add a session": an easy 30 minutes of the sport on that day. */
export function emptySheet(date: string, sport = "run"): SheetDraft {
  return {
    sport,
    trainingId: null,
    title: null,
    minutes: 30,
    distanceKm: null,
    type: "easy",
    purpose: "easy",
    intensity: "easy",
    zone: 2,
    rpe: null,
    date,
    slot: null,
    memo: "",
    locked: false,
  };
}

/** A new type: its zone and intensity follow (effort out of 10 stays as set). */
export function withType(d: SheetDraft, type: SessionType): SheetDraft {
  const shape = TYPE_SHAPE[type];
  return { ...d, type, purpose: type, intensity: shape.intensity, zone: d.rpe !== null && d.zone === null ? null : (shape.zone ?? null) };
}

/** A new zone (null: none): the intensity follows, as the API does. */
export function withZone(d: SheetDraft, zone: number | null): SheetDraft {
  return { ...d, zone, intensity: zone === null || d.intensity === "mindful" ? d.intensity : zoneIntensity(zone) };
}

/** The live summary of the sheet. */
export function draftSummary(d: SheetDraft, lang: Locale, sportName: (key: string) => string): string {
  return sessionSummary(
    {
      sport: d.sport,
      minutes: d.minutes,
      date: d.date,
      zone: d.zone,
      rpe: d.rpe,
      distanceKm: d.distanceKm,
      slot: d.slot,
      purpose: d.purpose ?? d.type,
      intensity: d.intensity,
      title: d.trainingId ? d.title : null,
    },
    lang,
    sportName,
  );
}

const memoOf = (m: string) => m.trim().slice(0, 200) || null;
const clampMin = (n: number) => Math.max(5, Math.min(300, Math.round(n)));

/** The one `change` the sheet sends: only what changed (null clears a field); null when nothing did. */
export function changeEdit(x: SeasonSessionView, d: SheetDraft): Extract<EditDraft, { kind: "change" }> | null {
  const o = draftOfSession(x);
  const e: Extract<EditDraft, { kind: "change" }> = { kind: "change", session: x.id };
  if (d.sport !== o.sport || d.trainingId !== o.trainingId) {
    e.sport = d.sport;
    if (o.trainingId && !d.trainingId) {
      e.trainingId = null;
      e.title = null;
    } else if (d.trainingId && d.trainingId !== o.trainingId) {
      e.trainingId = d.trainingId;
      if (d.title) e.title = d.title;
    }
  }
  if (clampMin(d.minutes) !== o.minutes) e.minutes = clampMin(d.minutes);
  if (d.distanceKm !== o.distanceKm) e.distanceKm = d.distanceKm;
  if (d.type !== o.type) e.purpose = d.type;
  if (d.zone !== o.zone) e.zone = d.zone;
  if (d.rpe !== o.rpe) e.rpe = d.rpe;
  if (d.date !== o.date) e.to = d.date;
  if (d.slot !== o.slot) e.slot = d.slot;
  if (memoOf(d.memo) !== memoOf(o.memo)) e.memo = memoOf(d.memo);
  if (d.locked !== o.locked) e.locked = d.locked;
  return Object.keys(e).length > 2 ? e : null;
}

/** "Add a session": the sheet as an `add` (only the fields set). */
export function addEdit(d: SheetDraft): Extract<EditDraft, { kind: "add" }> {
  const memo = memoOf(d.memo);
  return {
    kind: "add",
    date: d.date,
    sport: d.sport,
    minutes: clampMin(d.minutes),
    purpose: d.type,
    ...(d.zone !== null ? { zone: d.zone } : {}),
    ...(d.rpe !== null ? { rpe: d.rpe } : {}),
    ...(d.distanceKm !== null ? { distanceKm: d.distanceKm } : {}),
    ...(d.slot ? { slot: d.slot } : {}),
    ...(memo ? { memo } : {}),
    ...(d.locked ? { locked: true } : {}),
    ...(d.trainingId ? { trainingId: d.trainingId, ...(d.title ? { title: d.title } : {}) } : {}),
  };
}

/** "Duplicate": the same session on another day, as an `add` (game-core duplicateEdit). */
export function duplicateEdit(x: SeasonSessionView, to: string): Extract<EditDraft, { kind: "add" }> {
  return {
    kind: "add",
    date: to,
    sport: x.sport,
    minutes: x.minutes,
    intensity: asIntensity(x.intensity),
    ...(x.trainingId ? { trainingId: x.trainingId, ...(x.title ? { title: x.title } : {}) } : {}),
    purpose: isSessionType(x.type) ? x.type : sessionType(x),
    ...(x.zone ? { zone: x.zone } : {}),
    ...(x.rpe ? { rpe: x.rpe } : {}),
    ...(x.distanceKm ? { distanceKm: x.distanceKm } : {}),
    ...(x.memo ? { memo: x.memo } : {}),
  };
}

/** A typed distance ("12,5", "10") → km (null: none or not a distance). */
export function parseKm(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0.1 && n <= 1000 ? Math.round(n * 100) / 100 : null;
}

/** "128–139 bpm" for a zone, from where zones 1…5 start. */
export function zoneRangeText(thresholds: readonly number[], zone: number): string | null {
  if (thresholds.length !== 5 || zone < 1 || zone > 5) return null;
  const lo = thresholds[zone - 1]!;
  return zone === 5 ? `≥ ${lo} bpm` : `${lo}–${thresholds[zone]! - 1} bpm`;
}

// ── Request bodies ────────────────────────────────────────────────────────────────────────────────────────────────

/** POST /v1/season/edits for one edit. */
export const editBody = (edit: EditDraft | ServerEdit) => ({ edit, device: "web" as const });
/** POST /v1/season/edits for several at once (a rebalance: 1–7 edits). */
export const editsBody = (edits: readonly (EditDraft | ServerEdit)[]) => ({ edits: edits.slice(0, 7), device: "web" as const });
/** The ids Undo takes back (a batch has several). */
export const undoIds = (r: { editId?: string | null; editIds?: readonly string[] | null }): string[] =>
  r.editIds?.length ? [...r.editIds] : r.editId ? [r.editId] : [];

// ── The skipped session ───────────────────────────────────────────────────────────────────────────────────────────

/** A choice that can be applied (it works and the API built its edit). */
export const usable = (c: PostponeChoiceView | null | undefined): c is PostponeChoiceView & { edit: ServerEdit } => !!c && c.ok && !!c.edit;

/** The card's buttons: the one-tap (tomorrow or the best day), the 7 days to pick from, shorter today, skip. */
export function missedActions(m: MissedView) {
  const quick = m.unwell ? null : usable(m.quick) ? m.quick : usable(m.tomorrow) ? m.tomorrow : null;
  return {
    quick,
    days: m.unwell ? [] : m.days,
    today: m.unwell || !usable(m.today) ? null : m.today,
    skip: m.skip ?? null,
  };
}

/** A choice's trade-offs in one line ("Thursday's easy run moves to Saturday"). */
export const choiceLine = (c: { lines: readonly string[] } | null | undefined) => (c?.lines ?? []).join(" · ");

/** "Not now": the card stays closed for this session, today, on this device. */
export const DISMISS_KEY = "vvake-app-missed-dismissed";
type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined;

export function isDismissed(store: Store, today: string, sessionId: string): boolean {
  try {
    const v = JSON.parse(store?.getItem(DISMISS_KEY) ?? "null") as { day?: string; ids?: string[] } | null;
    return !!v && v.day === today && Array.isArray(v.ids) && v.ids.includes(sessionId);
  } catch {
    return false;
  }
}

export function dismiss(store: Store, today: string, sessionId: string): void {
  try {
    const v = JSON.parse(store?.getItem(DISMISS_KEY) ?? "null") as { day?: string; ids?: string[] } | null;
    const ids = v && v.day === today && Array.isArray(v.ids) ? v.ids.filter((i) => typeof i === "string").slice(-20) : [];
    store?.setItem(DISMISS_KEY, JSON.stringify({ day: today, ids: [...new Set([...ids, sessionId])] }));
  } catch {
    // private mode: the card simply shows again
  }
}
