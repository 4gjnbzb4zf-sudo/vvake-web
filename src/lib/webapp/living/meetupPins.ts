// Copied from VVFit packages/game-core/src/meetupPins.ts (3e812ccd 2026-10-30) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * A custom meeting point for a meetup (ADR-0071 §B, docs/05-tech/places-and-meetups.md "Custom meeting point"): the
 * host long-presses the map and names the spot ("North gate"), with an optional note and photo. Safety and privacy:
 * - The pin is seen ONLY by the meetup's invitees (the API checks membership; 404 for anyone else) and never appears
 *   on public maps, Spots, place notes or any listing.
 * - If no public meeting place (car park, trailhead, park, track…) is within PIN_PUBLIC_M, the host sees a calm hint
 *   ("Meeting somewhere public is safer") and, when one is within PIN_SNAP_M, "Snap to the nearest public place".
 * - Its precise coordinates are kept only until PIN_KEEP_DAYS days after the meetup ends (the API's
 *   MEETUP_PIN_KEEP_DAYS), then deleted with its note and photo.
 *
 * Pure TypeScript: the API, the phone and the web share these rules.
 */
import { distanceM, type LatLon } from "./location";
import { bearingDeg, compassPoint } from "./places";
import { ugcProblem, type UgcProblem } from "../camera/ugc";

/** `point.key` a client sends for a custom pin (the API stores `pin:<meetup id>`). */
export const PIN_POINT_KEY = "pin";
export const PIN_NAME_MAX = 40;
export const PIN_NOTE_MAX = 200;
/** Days after the meetup's end the pin (coordinates, note, photo) is kept (server var MEETUP_PIN_KEEP_DAYS). */
export const PIN_KEEP_DAYS = 7;
/** A pin this close to a public meeting place counts as "at a public place" (no hint). */
export const PIN_PUBLIC_M = 50;
/** "Snap to the nearest public place" offers places this close at most. */
export const PIN_SNAP_M = 150;
/** Photo: JPEG only, at most this many bytes after the phone shrinks it (metadata stripped on both sides). */
export const PIN_PHOTO_MAX_BYTES = 1_500_000;

export interface MeetupPin extends LatLon {
  name: string;
  note?: string | null;
}

export type PinProblem = "pin_name" | "pin_name_long" | "pin_note_long" | "pin_where" | UgcProblem;

const clean = (t: string | null | undefined): string => (t ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

/** Checks a pin: a name (1–40 characters), an optional note (≤ 200), real coordinates, through the UGC filter. */
export function checkPin(p: {
  name?: string | null;
  note?: string | null;
  lat: number;
  lon: number;
}): { ok: true; pin: MeetupPin } | { ok: false; problem: PinProblem } {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 85 || Math.abs(p.lon) > 180 || (p.lat === 0 && p.lon === 0))
    return { ok: false, problem: "pin_where" };
  const name = clean(p.name);
  if (!name) return { ok: false, problem: "pin_name" };
  if ([...name].length > PIN_NAME_MAX) return { ok: false, problem: "pin_name_long" };
  const note = clean(p.note);
  if ([...note].length > PIN_NOTE_MAX) return { ok: false, problem: "pin_note_long" };
  for (const t of [name, note]) {
    if (!t) continue;
    const u = ugcProblem(t);
    if (u) return { ok: false, problem: u };
  }
  // 6 decimals (~0.1 m): precise enough to meet, no more.
  const r = (x: number) => Math.round(x * 1e6) / 1e6;
  return { ok: true, pin: { name, ...(note ? { note } : {}), lat: r(p.lat), lon: r(p.lon) } };
}

/** The nearest public place to the pin within `maxM` (PIN_SNAP_M), or null. `places`: GET /v1/places?sport=meet. */
export function nearestPublic<P extends LatLon>(pin: LatLon, places: readonly P[], maxM = PIN_SNAP_M): (P & { distanceM: number }) | null {
  let best: (P & { distanceM: number }) | null = null;
  for (const p of places) {
    const d = distanceM(pin, p);
    if (d <= maxM && (!best || d < best.distanceM)) best = { ...p, distanceM: d };
  }
  return best;
}

/** Is the pin at a public meeting place (one within PIN_PUBLIC_M)? Shown: no hint. */
export const pinAtPublic = (pin: LatLon, places: readonly LatLon[]): boolean => nearestPublic(pin, places, PIN_PUBLIC_M) !== null;

/** What the host sees about safety: nothing, the hint alone, or the hint with "Snap to the nearest public place". */
export function pinSafety<P extends LatLon>(
  pin: LatLon,
  places: readonly P[],
): { hint: false } | { hint: true; snapTo: (P & { distanceM: number }) | null } {
  if (pinAtPublic(pin, places)) return { hint: false };
  return { hint: true, snapTo: nearestPublic(pin, places, PIN_SNAP_M) };
}

/** The pin moved onto the public place (its name kept; empty → the place's name). */
export function snapPin(pin: Partial<MeetupPin> & LatLon, place: LatLon & { name?: string }): MeetupPin {
  const name = clean(pin.name) || clean(place.name).slice(0, PIN_NAME_MAX);
  return { name, ...(pin.note ? { note: pin.note } : {}), lat: place.lat, lon: place.lon };
}

/** The pin's coordinates are gone after this (ms): the meetup's end + keepDays. */
export const pinExpiresAt = (endsAtMs: number, keepDays = PIN_KEEP_DAYS) => endsAtMs + keepDays * 86_400_000;
export const pinExpired = (endsAtMs: number, nowMs: number, keepDays = PIN_KEEP_DAYS) => nowMs >= pinExpiresAt(endsAtMs, keepDays);

/** "320 m NE" / « 1,2 km SO »: under 1 km rounded to 10 m, else km with one decimal. The watches use the same rule. */
export function pinDirection(from: LatLon, to: LatLon, lang: "en" | "fr"): { distanceM: number; sector: string; text: string } {
  const d = distanceM(from, to);
  const sector = compassPoint(bearingDeg(from, to), lang);
  const dist =
    d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(Math.round(d / 100) / 10).toFixed(1).replace(".", lang === "fr" ? "," : ".")} km`;
  return { distanceM: d, sector, text: `${dist} ${sector}` };
}

export function pinProblemText(p: PinProblem, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  const t: Record<PinProblem, [string, string]> = {
    pin_name: [
      "Give the meeting point a short name, like “North gate”.",
      "Donne un nom court au point de rendez-vous, comme « Porte nord ».",
    ],
    pin_name_long: [`${PIN_NAME_MAX} characters at most.`, `${PIN_NAME_MAX} caractères au plus.`],
    pin_note_long: [`${PIN_NOTE_MAX} characters at most.`, `${PIN_NOTE_MAX} caractères au plus.`],
    pin_where: ["Long-press the map where you’ll meet.", "Appuie longuement sur la carte là où vous vous retrouvez."],
    empty: ["Write a few words.", "Écris quelques mots."],
    link: ["No links.", "Pas de liens."],
    contact: ["No e-mail or phone number here.", "Pas d’e-mail ni de numéro de téléphone ici."],
    markup: ["No symbols like < > { } [ ].", "Pas de symboles comme < > { } [ ]."],
    money: ["No money, tokens or rewards in the text.", "Pas d’argent, de jetons ni de récompenses dans le texte."],
    abuse: ["That word isn’t allowed. Keep it friendly.", "Ce mot n’est pas accepté. Reste sympa."],
  };
  return t[p][fr ? 1 : 0];
}

export const PIN_TEXT = {
  longPress: {
    en: "Or long-press the map to drop your own meeting point.",
    fr: "Ou appuie longuement sur la carte pour poser ton propre point de rendez-vous.",
  },
  custom: { en: "Your meeting point", fr: "Ton point de rendez-vous" },
  name: { en: "Name", fr: "Nom" },
  namePlaceholder: { en: "North gate", fr: "Porte nord" },
  note: { en: "Note (optional)", fr: "Note (facultatif)" },
  notePlaceholder: { en: "By the big oak, left of the fountain", fr: "Près du grand chêne, à gauche de la fontaine" },
  photo: { en: "Add a photo", fr: "Ajouter une photo" },
  photoRemove: { en: "Remove the photo", fr: "Retirer la photo" },
  safer: { en: "Meeting somewhere public is safer.", fr: "Se retrouver dans un lieu public, c’est plus sûr." },
  snap: { en: "Snap to the nearest public place", fr: "Aller au lieu public le plus proche" },
  remove: { en: "Remove the pin", fr: "Retirer le point" },
  privacy: {
    en: `Only the people you invite see this point. It’s never on public maps or Spots, and it’s deleted ${PIN_KEEP_DAYS} days after the meetup.`,
    fr: `Seules les personnes invitées voient ce point. Il n’apparaît jamais sur les cartes publiques ni dans les Spots, et il est supprimé ${PIN_KEEP_DAYS} jours après le rendez-vous.`,
  },
  openInMaps: { en: "Open in Maps", fr: "Ouvrir dans Plans" },
  gone: { en: "This meeting point was deleted after the meetup.", fr: "Ce point de rendez-vous a été supprimé après le rendez-vous." },
} as const satisfies Record<string, { en: string; fr: string }>;
