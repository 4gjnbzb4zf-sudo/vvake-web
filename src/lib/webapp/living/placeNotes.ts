// Copied from VVFit packages/game-core/src/placeNotes.ts (55e30955 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Place notes (docs/02-product/living-app.md §6.1, ADR-0062 §5, docs/05-tech/places-and-meetups.md): a 3-tap review
 * of a spot after a session: ★ 1–5, "would you recommend it?", tips from a fixed list, and at most 80 characters of
 * text. Our own data, never OpenStreetMap's: a note is keyed by the OSM element's id only ("osm:node/123", allowed by
 * ODbL; no OSM attribute is ever stored with it), or for a spot OSM doesn't know, by the geohash-7 cell of the point
 * ("gh:u0nd9hq", a cell of about 150 m, so the key itself is the rounding).
 *
 * Privacy: notes are shown as aggregates only, from PLACE_NOTES_MIN_SHOWN notes on (average, % who recommend, tips as
 * counts), never with who wrote them, never with the session or its track. Free text goes through the UGC filter
 * (ugc.ts) and is shown only once a moderator approved it.
 *
 * Pure TypeScript: the API, the phone, the web (and the watches' copies) read the same rules.
 */
import { distanceM, type LatLon } from "./location";
import { geohash, geohashBox } from "./places";
import { ugcProblem, type UgcProblem } from "../camera/ugc";

/** Tips from a fixed list (chips), EN/FR. */
export const PLACE_NOTE_TAGS = [
  "muddy",
  "steep",
  "crowded",
  "shade",
  "water_point",
  "parking",
  "dogs_on_leash",
  "closed_in_winter",
  "lit_at_night",
  "quiet",
] as const;
export type PlaceNoteTag = (typeof PLACE_NOTE_TAGS)[number];
export const PLACE_NOTE_TAG_TEXT: Readonly<Record<PlaceNoteTag, { en: string; fr: string }>> = {
  muddy: { en: "Muddy", fr: "Boueux" },
  steep: { en: "Steep", fr: "Raide" },
  crowded: { en: "Crowded", fr: "Fréquenté" },
  shade: { en: "Shade", fr: "Ombragé" },
  water_point: { en: "Water point", fr: "Point d’eau" },
  parking: { en: "Parking", fr: "Parking" },
  dogs_on_leash: { en: "Dogs on leash", fr: "Chiens en laisse" },
  closed_in_winter: { en: "Closed in winter", fr: "Fermé l’hiver" },
  lit_at_night: { en: "Lit at night", fr: "Éclairé la nuit" },
  quiet: { en: "Quiet", fr: "Calme" },
};

/** At most this many characters of text in a note. */
export const PLACE_NOTE_TEXT_MAX = 80;
/** At most this many tips per note. */
export const PLACE_NOTE_TAGS_MAX = 4;
/** Aggregates are shown from this many notes on (fewer could point at one person). */
export const PLACE_NOTES_MIN_SHOWN = 3;
/** One note per person per place per 30 days. */
export const PLACE_NOTE_REPEAT_DAYS = 30;
/** A place is "undocumented" with no OSM spot of the sport and no public or saved spot within 300 m. */
export const UNDOCUMENTED_RADIUS_M = 300;
/** Geohash precision of a key for a spot OSM doesn't know (7: about 150 m × 150 m). */
export const PLACE_KEY_PRECISION = 7;
/** Approved text tips shown at most, newest first. */
export const PLACE_TIPS_SHOWN = 3;
/** Tags shown at most, by count. */
export const PLACE_TAGS_SHOWN = 5;

export type PlaceKey = string;
export type ParsedPlaceKey = { kind: "osm"; type: "node" | "way" | "relation"; id: string } | { kind: "gh"; hash: string };

const OSM_TYPES = { n: "node", w: "way", r: "relation" } as const;
const OSM_KEY = /^osm:(node|way|relation)\/([1-9]\d{0,14})$/;
const GH_KEY = /^gh:([0-9b-hjkmnp-z]{7})$/;

/**
 * The key of an OSM element: the API's place id ("n123", GET /v1/places) or "node/123" → "osm:node/123". Null when it
 * isn't one.
 */
export function osmPlaceKey(id: string): PlaceKey | null {
  const short = /^([nwr])([1-9]\d{0,14})$/.exec(id);
  if (short) return `osm:${OSM_TYPES[short[1] as "n" | "w" | "r"]}/${short[2]}`;
  const long = /^(?:osm:)?(node|way|relation)\/([1-9]\d{0,14})$/.exec(id);
  return long ? `osm:${long[1]}/${long[2]}` : null;
}

/** The key of a spot OSM doesn't know: the geohash-7 cell of the point (about 150 m). */
export const pointPlaceKey = (lat: number, lon: number): PlaceKey => `gh:${geohash(lat, lon, PLACE_KEY_PRECISION)}`;

export function parsePlaceKey(key: string): ParsedPlaceKey | null {
  const o = OSM_KEY.exec(key);
  if (o) return { kind: "osm", type: o[1] as "node" | "way" | "relation", id: o[2]! };
  const g = GH_KEY.exec(key);
  return g ? { kind: "gh", hash: g[1]! } : null;
}

/** The API's place id ("n123") of an OSM key; null for a geohash key. */
export function placeIdOfKey(key: string): string | null {
  const p = parsePlaceKey(key);
  return p?.kind === "osm" ? `${p.type[0]}${p.id}` : null;
}

/** The centre of a geohash key's cell (the only coordinates a geohash spot ever has). */
export function placeKeyCenter(key: string): LatLon | null {
  const p = parsePlaceKey(key);
  if (p?.kind !== "gh") return null;
  const b = geohashBox(p.hash);
  return { lat: Math.round(((b.s + b.n) / 2) * 1e5) / 1e5, lon: Math.round(((b.w + b.e) / 2) * 1e5) / 1e5 };
}

// ── A note ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface PlaceNoteInput {
  placeKey: string;
  sport: string;
  rating: number;
  recommend: boolean;
  tags?: readonly string[];
  text?: string | null;
}

export interface PlaceNote {
  placeKey: PlaceKey;
  sport: string;
  rating: 1 | 2 | 3 | 4 | 5;
  recommend: boolean;
  tags: PlaceNoteTag[];
  /** Normalised text, or null. */
  text: string | null;
}

export type PlaceNoteProblem = "place" | "sport" | "rating" | "tags" | "too_long" | UgcProblem;

/** Same spaces, NFC, trimmed. */
export const cleanNoteText = (t: string | null | undefined): string => (t ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

const SPORT_KEY = /^(c_[a-z0-9]{1,20}|[a-z][a-z-]{0,39})$/;

/** Checks a note and returns it cleaned (tags deduplicated in list order), or the first problem. Pure. */
export function checkPlaceNote(input: PlaceNoteInput): { ok: true; note: PlaceNote } | { ok: false; problem: PlaceNoteProblem } {
  const placeKey = parsePlaceKey(input.placeKey) ? input.placeKey : osmPlaceKey(input.placeKey);
  if (!placeKey) return { ok: false, problem: "place" };
  if (!SPORT_KEY.test(input.sport)) return { ok: false, problem: "sport" };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { ok: false, problem: "rating" };
  const raw = input.tags ?? [];
  if (raw.some((t) => !(PLACE_NOTE_TAGS as readonly string[]).includes(t))) return { ok: false, problem: "tags" };
  const tags = PLACE_NOTE_TAGS.filter((t) => raw.includes(t));
  if (tags.length > PLACE_NOTE_TAGS_MAX) return { ok: false, problem: "tags" };
  const text = cleanNoteText(input.text);
  if ([...text].length > PLACE_NOTE_TEXT_MAX) return { ok: false, problem: "too_long" };
  if (text) {
    const p = ugcProblem(text);
    if (p) return { ok: false, problem: p };
  }
  return {
    ok: true,
    note: {
      placeKey,
      sport: input.sport,
      rating: input.rating as PlaceNote["rating"],
      recommend: input.recommend === true,
      tags,
      text: text || null,
    },
  };
}

/** The message for a problem (EN/FR, tutoiement). */
export function placeNoteProblemText(p: PlaceNoteProblem, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  switch (p) {
    case "place":
      return fr ? "Ce lieu est introuvable." : "We can’t find this place.";
    case "sport":
      return fr ? "Choisis un sport." : "Pick a sport.";
    case "rating":
      return fr ? "Donne une note de 1 à 5." : "Give it 1 to 5 stars.";
    case "tags":
      return fr ? `Jusqu’à ${PLACE_NOTE_TAGS_MAX} infos de la liste.` : `Up to ${PLACE_NOTE_TAGS_MAX} tips from the list.`;
    case "too_long":
      return fr ? `${PLACE_NOTE_TEXT_MAX} caractères au plus.` : `${PLACE_NOTE_TEXT_MAX} characters at most.`;
    case "empty":
      return fr ? "Écris quelques mots, ou laisse vide." : "Write a few words, or leave it empty.";
    case "link":
    case "contact":
    case "markup":
    case "money":
    case "abuse":
      return fr
        ? {
            link: "Pas de liens.",
            contact: "Pas d’e-mail ni de numéro de téléphone : c’est public.",
            markup: "Pas de symboles comme < > { } [ ].",
            money: "Pas d’argent, de jetons ni de récompenses dans le texte.",
            abuse: "Ce mot n’est pas accepté. Reste sympa : tout le monde peut le voir.",
          }[p]
        : {
            link: "No links.",
            contact: "No e-mail or phone number: this is public.",
            markup: "No symbols like < > { } [ ].",
            money: "No money, tokens or rewards in the text.",
            abuse: "That word isn’t allowed. Keep it friendly: everyone can see it.",
          }[p];
  }
}

/** Geohash keys of the cells around a point (radius in m): the public spots without an OSM id to look up. */
export function pointPlaceKeysNear(lat: number, lon: number, radiusM = UNDOCUMENTED_RADIUS_M): PlaceKey[] {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const b = geohashBox(geohash(lat, lon, PLACE_KEY_PRECISION));
  const stepLat = (b.n - b.s) * 0.9;
  const stepLon = (b.e - b.w) * 0.9;
  const out = new Set<string>();
  for (let la = lat - dLat; ; la = Math.min(lat + dLat, la + stepLat)) {
    for (let lo = lon - dLon; ; lo = Math.min(lon + dLon, lo + stepLon)) {
      out.add(pointPlaceKey(la, lo));
      if (lo >= lon + dLon) break;
    }
    if (la >= lat + dLat) break;
  }
  return [...out].sort();
}

/** One note per person per place per 30 days: may they write one now, given their last note on this place? */
export const placeNoteAllowed = (lastAtMs: number | null | undefined, nowMs: number): boolean =>
  lastAtMs == null || nowMs - lastAtMs >= PLACE_NOTE_REPEAT_DAYS * 86_400_000;

// ── Aggregates ──────────────────────────────────────────────────────────────────────────────────────────────

export type TextStatus = "pending" | "approved" | "hidden";

/** A stored note as the aggregate reads it: never who wrote it. */
export interface PlaceNoteRow {
  /** The note's id (shown with an approved tip, so it can be reported; it never leads to who wrote it). */
  id?: string;
  rating: number;
  recommend: boolean;
  tags: readonly string[];
  text?: string | null;
  textStatus?: TextStatus;
  /** Epoch ms (newest tips first). */
  atMs?: number;
}

export interface PlaceAggregate {
  placeKey: PlaceKey;
  count: number;
  /** Average stars, one decimal. */
  rating: number;
  /** Who would recommend it, 0–100. */
  recommendPct: number;
  /** The most given tips, by count. */
  tags: { tag: PlaceNoteTag; count: number }[];
  /** Approved text tips only, newest first (id: to report it). */
  tips: { id: string | null; text: string }[];
}

/**
 * The aggregate of a place's notes, or null below PLACE_NOTES_MIN_SHOWN notes (an average of one or two notes could
 * point at the person who wrote it). Pure.
 */
export function aggregatePlaceNotes(placeKey: PlaceKey, notes: readonly PlaceNoteRow[]): PlaceAggregate | null {
  // A hidden text (taken down) hides the text only: the stars and tips still count.
  const shown = notes;
  if (shown.length < PLACE_NOTES_MIN_SHOWN) return null;
  const count = shown.length;
  const rating = Math.round((shown.reduce((s, n) => s + n.rating, 0) / count) * 10) / 10;
  const recommendPct = Math.round((shown.filter((n) => n.recommend).length / count) * 100);
  const counts = new Map<PlaceNoteTag, number>();
  for (const n of shown)
    for (const t of n.tags)
      if ((PLACE_NOTE_TAGS as readonly string[]).includes(t)) counts.set(t as PlaceNoteTag, (counts.get(t as PlaceNoteTag) ?? 0) + 1);
  const tags = [...counts]
    .map(([tag, c]) => ({ tag, count: c }))
    .sort((a, b) => b.count - a.count || PLACE_NOTE_TAGS.indexOf(a.tag) - PLACE_NOTE_TAGS.indexOf(b.tag))
    .slice(0, PLACE_TAGS_SHOWN);
  const tips = shown
    .filter((n) => n.textStatus === "approved" && n.text)
    .sort((a, b) => (b.atMs ?? 0) - (a.atMs ?? 0))
    .slice(0, PLACE_TIPS_SHOWN)
    .map((n) => ({ id: n.id ?? null, text: n.text! }));
  return { placeKey, count, rating, recommendPct, tags, tips };
}

/** One line for a list or the coach: "4.3★ · 82% recommend · Muddy (5) · Shade (3)". */
export function placeAggregateLine(a: PlaceAggregate, lang: "en" | "fr", maxTags = 2): string {
  const fr = lang === "fr";
  const rating = fr ? String(a.rating).replace(".", ",") : String(a.rating);
  const parts = [`${rating}★`, fr ? `${a.recommendPct} % le recommandent` : `${a.recommendPct}% recommend`];
  for (const t of a.tags.slice(0, maxTags)) parts.push(`${PLACE_NOTE_TAG_TEXT[t.tag][lang]} (${t.count})`);
  return parts.join(" · ");
}

// ── Undocumented places ─────────────────────────────────────────────────────────────────────────────────────

export interface UndocumentedInput {
  /** Where the session started or spent most time (the device's own fix; the API gets 3 decimals at most). */
  at: LatLon;
  /** OSM spots of this sport around (GET /v1/places for the sport). */
  osm: readonly LatLon[];
  /** Public spots: places with notes shown (≥ PLACE_NOTES_MIN_SHOWN), e.g. geohash keys' centres. */
  publicSpots?: readonly LatLon[];
  /** The athlete's own saved spots (kept on the device). */
  savedSpots?: readonly LatLon[];
}

/** True when nothing we know of is within UNDOCUMENTED_RADIUS_M: no OSM spot of the sport, no public or saved spot. */
export function isUndocumentedPlace(i: UndocumentedInput, radiusM = UNDOCUMENTED_RADIUS_M): boolean {
  const near = (p: LatLon) => distanceM(i.at, p) <= radiusM;
  return !i.osm.some(near) && !(i.publicSpots ?? []).some(near) && !(i.savedSpots ?? []).some(near);
}

// ── Copy ────────────────────────────────────────────────────────────────────────────────────────────────────

export const PLACE_NOTE_TEXT = {
  title: { en: "How was this spot?", fr: "C’était comment, ce coin ?" },
  newTitle: { en: "A new spot: how was it?", fr: "Un nouveau coin : c’était comment ?" },
  recommend: { en: "Would you recommend it?", fr: "Tu le recommandes ?" },
  yes: { en: "Yes", fr: "Oui" },
  no: { en: "No", fr: "Non" },
  tipPlaceholder: { en: "One tip (optional, 80 characters)", fr: "Une info (facultatif, 80 caractères)" },
  done: { en: "Done", fr: "Terminé" },
  thanks: { en: "Thanks! Your note helps the next person.", fr: "Merci ! Ta note aide les suivants." },
  private: { en: "Anonymous: your name and your route are never shown.", fr: "Anonyme : ni ton nom ni ton parcours ne sont montrés." },
  pending: { en: "Your tip shows once it’s checked.", fr: "Ton info s’affiche une fois vérifiée." },
  tooSoon: { en: "You rated this spot in the last 30 days.", fr: "Tu as noté ce coin ces 30 derniers jours." },
  fewNotes: { en: "Not enough notes yet.", fr: "Pas encore assez de notes." },
  credit: {
    en: "Notes: VVake athletes. Map data © OpenStreetMap contributors.",
    fr: "Notes : athlètes VVake. Données de carte © les contributeurs d’OpenStreetMap.",
  },
} as const satisfies Record<string, { en: string; fr: string }>;
