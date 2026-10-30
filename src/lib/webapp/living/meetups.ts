// Copied from VVFit packages/game-core/src/meetups.ts (3e812ccd 2026-10-30) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Training meetups (docs/02-product/living-app.md §14 "Meetups on the map", docs/05-tech/places-and-meetups.md):
 * a sport, a start time (in the future, at most 30 days ahead), a duration, a meeting point, a pace/level line, a
 * size, and the people invited. Safety first, by design:
 * - **Invite-only** in v1: the host invites friends, crew or challenge rivals (the people they've faced, GET
 *   /v1/friends); there is no public discovery, nobody can find a meetup they weren't invited to.
 * - **Public meeting points only**: an OpenStreetMap public place of a meeting kind (car park, trailhead, park, track,
 *   sports centre…) or a place with public notes (placeNotes.ts). The coordinates always come from that place, never
 *   typed or dropped on the map, so nobody's home can be a meeting point.
 * - **"I'm here"** check-ins instead of live location; block and report on every meetup.
 * - Reminders 2 h and 15 min before, never in quiet hours (the evening before instead, see meetupReminders).
 * - "Add to calendar" exports only what the host typed (meetupIcs): no names, no e-mail, nobody's location.
 *
 * Pure TypeScript: the API, the phone and the web share these rules.
 */
import { icsEscape, icsFold } from "./icsCore";
import { QUIET_HOURS } from "./quietHours";
import { osmPlaceKey, parsePlaceKey } from "./placeNotes";
import { PIN_POINT_KEY } from "./meetupPins";
import { PLACE_SETS, type PlaceKind, type PlaceSet } from "./places";
import type { MeetupMode } from "./trainCall";
import { sportName } from "./sportCatalog";
import { ugcProblem, type UgcProblem } from "../camera/ugc";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const MEETUP_MAX_AHEAD_DAYS = 30;
/** A meetup starts at least this far ahead (time to see the invite). */
export const MEETUP_MIN_LEAD_MIN = 15;
export const MEETUP_DURATION_MIN = { min: 15, max: 600 } as const;
/** People in a meetup, the host included. */
export const MEETUP_PEOPLE = { min: 2, max: 20 } as const;
/** Pace / level line typed by the host ("easy 6:00/km, chatty"). */
export const MEETUP_LEVEL_MAX = 60;
/** "I'm here" opens this long before the start and closes at the end. */
export const MEETUP_HERE_BEFORE_MIN = 30;
/** Meetups one person can host in a day (rate limit beside the API's). */
export const MEETUP_HOST_PER_DAY = 5;

/** The public place kinds a meeting point can be (OSM, places.ts). Businesses and private places are not. */
export const MEETUP_POINT_KINDS: readonly PlaceKind[] = [
  "parking",
  "trailhead",
  "park",
  "nature",
  "track",
  "sports_centre",
  "pitch",
  "court",
  "beach",
  "outdoor_gym",
  "launch",
  "marina",
  "ski_area",
  "ice_rink",
  "pool",
  "skatepark",
  "crag",
];

/** The place sets a meeting point is looked up in: every point-shaped set of a meeting kind. */
export const MEETUP_POINT_SETS: readonly PlaceSet[] = Object.values(PLACE_SETS).filter(
  (s) => s.shape === "point" && MEETUP_POINT_KINDS.includes(s.kind),
);

export const isMeetupPointSet = (setId: string): boolean => MEETUP_POINT_SETS.some((s) => s.id === setId);

export type MeetupStatus = "planned" | "cancelled" | "done";
/** What the apps show: from the stored status and the clock. */
export type MeetupPhase = "planned" | "soon" | "now" | "done" | "cancelled";

export interface MeetupTimes {
  status: MeetupStatus;
  startMs: number;
  durationMin: number;
}

export function meetupPhase(m: MeetupTimes, nowMs: number): MeetupPhase {
  if (m.status === "cancelled") return "cancelled";
  const end = m.startMs + m.durationMin * MIN;
  if (m.status === "done" || nowMs >= end) return "done";
  if (nowMs >= m.startMs) return "now";
  if (nowMs >= m.startMs - 2 * HOUR) return "soon";
  return "planned";
}

// ── Creating ────────────────────────────────────────────────────────────────────────────────────────────────

export interface MeetupInput {
  sport: string;
  startMs: number;
  durationMin: number;
  /**
   * The meeting point: an OSM place id ("n123", "osm:node/123"), a public place-note key ("gh:…") or "pin" (a custom
   * pin, meetupPins.ts; its fields are checked there). Ignored in mode "call".
   */
  pointKey: string;
  /** "place" (default) or "call": train together over a call, no meeting point (trainCall.ts). */
  mode?: MeetupMode;
  level?: string | null;
  maxPeople: number;
  invitees: readonly string[];
}

export type MeetupProblem = "sport" | "start_past" | "start_far" | "duration" | "people" | "invitees" | "point" | "level_long" | UgcProblem;

const SPORT_KEY = /^(c_[a-z0-9]{1,20}|[a-z][a-z-]{0,39})$/;

export const cleanLevel = (t: string | null | undefined): string => (t ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

/** Checks a meetup (the API re-checks invitees and the point against its own data). Pure. */
export function checkMeetup(
  i: MeetupInput,
  nowMs: number,
): { ok: true; pointKey: string; mode: MeetupMode; level: string | null; invitees: string[] } | { ok: false; problem: MeetupProblem } {
  if (!SPORT_KEY.test(i.sport)) return { ok: false, problem: "sport" };
  if (!Number.isFinite(i.startMs) || i.startMs < nowMs + MEETUP_MIN_LEAD_MIN * MIN) return { ok: false, problem: "start_past" };
  if (i.startMs > nowMs + MEETUP_MAX_AHEAD_DAYS * DAY) return { ok: false, problem: "start_far" };
  if (!Number.isInteger(i.durationMin) || i.durationMin < MEETUP_DURATION_MIN.min || i.durationMin > MEETUP_DURATION_MIN.max)
    return { ok: false, problem: "duration" };
  if (!Number.isInteger(i.maxPeople) || i.maxPeople < MEETUP_PEOPLE.min || i.maxPeople > MEETUP_PEOPLE.max)
    return { ok: false, problem: "people" };
  const invitees = [...new Set(i.invitees)];
  if (!invitees.length || invitees.length > MEETUP_PEOPLE.max - 1) return { ok: false, problem: "invitees" };
  const mode: MeetupMode = i.mode === "call" ? "call" : "place";
  const pointKey =
    mode === "call" ? "" : i.pointKey === PIN_POINT_KEY ? PIN_POINT_KEY : parsePlaceKey(i.pointKey) ? i.pointKey : osmPlaceKey(i.pointKey);
  if (pointKey === null || (mode === "place" && !pointKey)) return { ok: false, problem: "point" };
  const level = cleanLevel(i.level);
  if ([...level].length > MEETUP_LEVEL_MAX) return { ok: false, problem: "level_long" };
  if (level) {
    const p = ugcProblem(level);
    if (p) return { ok: false, problem: p };
  }
  return { ok: true, pointKey, mode, level: level || null, invitees };
}

/** Who may be invited: someone the host has faced (friends, crew, challenge rivals), not blocked either way. */
export function canInvite(hostId: string, inviteeId: string, friends: ReadonlySet<string>, blocked: ReadonlySet<string>): boolean {
  return inviteeId !== hostId && friends.has(inviteeId) && !blocked.has(inviteeId);
}

export type JoinDecision = "ok" | "not_invited" | "full" | "closed" | "blocked";

/** May this person join ("I'm in")? Invited only, room left, not over or cancelled, not blocked with the host. */
export function joinDecision(o: {
  phase: MeetupPhase;
  invited: boolean;
  joined: boolean;
  going: number;
  maxPeople: number;
  blockedWithHost: boolean;
}): JoinDecision {
  if (o.blockedWithHost) return "blocked";
  if (!o.invited) return "not_invited";
  if (o.phase === "done" || o.phase === "cancelled") return "closed";
  if (o.joined) return "ok";
  return o.going >= o.maxPeople ? "full" : "ok";
}

/** "I'm here" is open from 30 min before the start to the end, for people who joined. */
export function hereAllowed(m: MeetupTimes, joined: boolean, nowMs: number): boolean {
  if (!joined || m.status !== "planned") return false;
  return nowMs >= m.startMs - MEETUP_HERE_BEFORE_MIN * MIN && nowMs < m.startMs + m.durationMin * MIN;
}

// ── Reminders ───────────────────────────────────────────────────────────────────────────────────────────────

export type MeetupReminderKind = "two_hours" | "evening_before" | "fifteen_min";
export interface MeetupReminder {
  kind: MeetupReminderKind;
  atMs: number;
}

const inQuiet = (ms: number, offMin: number) => {
  const h = new Date(ms + offMin * MIN).getUTCHours();
  return h >= QUIET_HOURS.start || h < QUIET_HOURS.end;
};

/**
 * Reminders for someone who joined: 2 h and 15 min before. A 2-hour reminder that would land in quiet hours (22:00–
 * 07:00 local) moves to 20:00 the evening before (an early meetup); the 15-minute one is dropped in quiet hours unless
 * the meetup itself starts in them (the athlete chose that time). Reminders already in the past at `fromMs` (the
 * moment they joined) are left out.
 */
export function meetupReminders(startMs: number, tzOffsetMin: number, fromMs: number): MeetupReminder[] {
  const out: MeetupReminder[] = [];
  const twoH = startMs - 2 * HOUR;
  if (!inQuiet(twoH, tzOffsetMin)) out.push({ kind: "two_hours", atMs: twoH });
  else {
    const off = tzOffsetMin * MIN;
    const evening = Math.floor((startMs + off) / DAY) * DAY - DAY + 20 * HOUR - off;
    if (startMs - evening <= 14 * HOUR) out.push({ kind: "evening_before", atMs: evening });
  }
  const quarter = startMs - 15 * MIN;
  if (!inQuiet(quarter, tzOffsetMin) || inQuiet(startMs, tzOffsetMin)) out.push({ kind: "fifteen_min", atMs: quarter });
  return out.filter((r) => r.atMs > fromMs).sort((a, b) => a.atMs - b.atMs);
}

/** The reminder due now (the latest one passed and not sent), or null. Late ones go out until the start only. */
export function dueMeetupReminder(
  startMs: number,
  tzOffsetMin: number,
  joinedMs: number,
  sent: readonly MeetupReminderKind[],
  nowMs: number,
): MeetupReminder | null {
  if (nowMs >= startMs) return null;
  const due = meetupReminders(startMs, tzOffsetMin, joinedMs).filter((r) => r.atMs <= nowMs);
  const last = due[due.length - 1];
  // Only the latest: a 2-hour reminder never goes out after the 15-minute one is due.
  return last && !sent.includes(last.kind) && !(last.kind !== "fifteen_min" && sent.includes("fifteen_min")) ? last : null;
}

// ── Copy (EN/FR, tutoiement) ────────────────────────────────────────────────────────────────────────────────

export type MeetupPushKind = "invite" | MeetupReminderKind | "cancelled" | "changed";

/**
 * A push's title and body. `when` is already formatted for the reader ("Sat 9:00", "sam. 9 h"); `place` is the
 * meeting point's name (or its kind's name); `host` the host's public name.
 */
export function meetupPushText(
  kind: MeetupPushKind,
  v: { host: string; sport: string; when: string; place: string },
  lang: "en" | "fr",
): { title: string; body: string } {
  const sport = sportName(v.sport, lang);
  const fr = lang === "fr";
  switch (kind) {
    case "invite":
      return fr
        ? { title: `${v.host} t’invite : ${sport.toLowerCase()}`, body: `${v.when} · ${v.place}. Tu viens ?` }
        : { title: `${v.host} invites you: ${sport.toLowerCase()}`, body: `${v.when} · ${v.place}. Are you in?` };
    case "two_hours":
      return fr
        ? { title: `${sport} dans 2 h`, body: `${v.place} à ${v.when}.` }
        : { title: `${sport} in 2 hours`, body: `${v.place} at ${v.when}.` };
    case "evening_before":
      return fr
        ? { title: `${sport} demain`, body: `${v.when} · ${v.place}. Prépare tes affaires ce soir.` }
        : { title: `${sport} tomorrow`, body: `${v.when} · ${v.place}. Get your kit ready tonight.` };
    case "fifteen_min":
      return fr
        ? { title: `${sport} dans 15 min`, body: `${v.place}. Touche « Je suis là » en arrivant.` }
        : { title: `${sport} in 15 minutes`, body: `${v.place}. Tap “I’m here” when you arrive.` };
    case "cancelled":
      return fr
        ? { title: `${sport} annulé`, body: `${v.host} a annulé le rendez-vous de ${v.when}.` }
        : { title: `${sport} cancelled`, body: `${v.host} cancelled the meetup on ${v.when}.` };
    case "changed":
      return fr
        ? { title: `${sport} : changement`, body: `Nouveau rendez-vous : ${v.when} · ${v.place}.` }
        : { title: `${sport}: plan changed`, body: `Now ${v.when} · ${v.place}.` };
  }
}

export const MEETUP_REPORT_REASONS = ["unsafe", "harassment", "spam", "fake", "other"] as const;
export type MeetupReportReason = (typeof MEETUP_REPORT_REASONS)[number];
export const MEETUP_REPORT_REASON_TEXT: Readonly<Record<MeetupReportReason, { en: string; fr: string }>> = {
  unsafe: { en: "Felt unsafe", fr: "Je ne me suis pas senti en sécurité" },
  harassment: { en: "Harassment or insults", fr: "Harcèlement ou insultes" },
  spam: { en: "Spam or advertising", fr: "Spam ou publicité" },
  fake: { en: "Not a real training", fr: "Pas un vrai entraînement" },
  other: { en: "Something else", fr: "Autre chose" },
};

export function meetupProblemText(p: MeetupProblem, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  const t: Record<MeetupProblem, [string, string]> = {
    sport: ["Pick a sport.", "Choisis un sport."],
    start_past: [
      `Pick a time at least ${MEETUP_MIN_LEAD_MIN} minutes from now.`,
      `Choisis une heure dans ${MEETUP_MIN_LEAD_MIN} minutes au moins.`,
    ],
    start_far: [`Up to ${MEETUP_MAX_AHEAD_DAYS} days ahead.`, `Jusqu’à ${MEETUP_MAX_AHEAD_DAYS} jours à l’avance.`],
    duration: ["Between 15 minutes and 10 hours.", "Entre 15 minutes et 10 heures."],
    people: [
      `Between ${MEETUP_PEOPLE.min} and ${MEETUP_PEOPLE.max} people.`,
      `Entre ${MEETUP_PEOPLE.min} et ${MEETUP_PEOPLE.max} personnes.`,
    ],
    invitees: ["Invite at least one friend, rival or crew mate.", "Invite au moins un ami, rival ou membre de ta bande."],
    point: [
      "Pick a public meeting point on the map (car park, trailhead, park, track…).",
      "Choisis un point de rendez-vous public sur la carte (parking, départ de sentier, parc, piste…).",
    ],
    level_long: [`${MEETUP_LEVEL_MAX} characters at most.`, `${MEETUP_LEVEL_MAX} caractères au plus.`],
    empty: ["Write a few words, or leave it empty.", "Écris quelques mots, ou laisse vide."],
    link: ["No links.", "Pas de liens."],
    contact: ["No e-mail or phone number here.", "Pas d’e-mail ni de numéro de téléphone ici."],
    markup: ["No symbols like < > { } [ ].", "Pas de symboles comme < > { } [ ]."],
    money: ["No money, tokens or rewards in the text.", "Pas d’argent, de jetons ni de récompenses dans le texte."],
    abuse: ["That word isn’t allowed. Keep it friendly.", "Ce mot n’est pas accepté. Reste sympa."],
  };
  return t[p][fr ? 1 : 0];
}

export const MEETUP_TEXT = {
  title: { en: "Train together", fr: "S’entraîner ensemble" },
  newMeetup: { en: "New meetup", fr: "Nouveau rendez-vous" },
  meetingPoint: { en: "Meeting point", fr: "Point de rendez-vous" },
  pointHint: {
    en: "Public places only: car parks, trailheads, parks, tracks.",
    fr: "Lieux publics seulement : parkings, départs de sentier, parcs, pistes.",
  },
  level: { en: "Pace or level", fr: "Allure ou niveau" },
  levelPlaceholder: { en: "Easy pace, we chat", fr: "Allure tranquille, on discute" },
  maxPeople: { en: "People at most", fr: "Personnes au plus" },
  invite: { en: "Invite", fr: "Inviter" },
  inviteHint: {
    en: "Friends, rivals and crew only. Nobody else can see it.",
    fr: "Amis, rivaux et ta bande seulement. Personne d’autre ne le voit.",
  },
  join: { en: "I’m in", fr: "Je viens" },
  leave: { en: "I can’t make it", fr: "Je ne peux pas venir" },
  here: { en: "I’m here", fr: "Je suis là" },
  hereDone: { en: "You’re here", fr: "Tu es là" },
  cancel: { en: "Cancel the meetup", fr: "Annuler le rendez-vous" },
  directions: { en: "Directions", fr: "Itinéraire" },
  addToCalendar: { en: "Add to calendar", fr: "Ajouter au calendrier" },
  report: { en: "Report", fr: "Signaler" },
  block: { en: "Block", fr: "Bloquer" },
  full: { en: "Full", fr: "Complet" },
  cancelled: { en: "Cancelled", fr: "Annulé" },
  done: { en: "Done", fr: "Terminé" },
  rateSpot: { en: "Rate the spot", fr: "Noter le lieu" },
  noLive: {
    en: "No live location: people tap “I’m here” when they arrive.",
    fr: "Pas de position en direct : chacun touche « Je suis là » en arrivant.",
  },
  safety: {
    en: "Meet in public places. VVake doesn’t check who people are.",
    fr: "Retrouve-toi dans des lieux publics. VVake ne vérifie pas l’identité des gens.",
  },
} as const satisfies Record<string, { en: string; fr: string }>;

// ── Calendar (RFC 5545) ─────────────────────────────────────────────────────────────────────────────────────

export interface MeetupIcsInput {
  id: string;
  sport: string;
  startMs: number;
  durationMin: number;
  status: MeetupStatus;
  /** The meeting point's name or kind ("Parc Laurier", "Trailhead"). */
  place: string;
  lat?: number;
  lon?: number;
  /** The host's pace/level line (already filtered). */
  level?: string | null;
  /** DTSTAMP: when the file is made. */
  nowMs: number;
  /** Bumped on each change, so calendars update the event. */
  sequence?: number;
  lang: "en" | "fr";
}

const icsDate = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
/**
 * The meetup as an iCalendar file (one VEVENT, UTC times, a 30-minute alarm). Only what the host typed and the
 * public meeting point: no attendee, no organizer, no e-mail, nobody's location.
 */
export function meetupIcs(m: MeetupIcsInput): string {
  const sport = sportName(m.sport, m.lang);
  const summary = m.lang === "fr" ? `${sport} · rendez-vous VVake` : `${sport} · VVake meetup`;
  const desc = [
    m.level ?? "",
    m.lang === "fr" ? "Touche « Je suis là » dans VVake en arrivant." : "Tap “I’m here” in VVake when you arrive.",
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VVake//Meetups 1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:meetup-${m.id}@vvake.com`,
    `DTSTAMP:${icsDate(m.nowMs)}`,
    `DTSTART:${icsDate(m.startMs)}`,
    `DTEND:${icsDate(m.startMs + m.durationMin * MIN)}`,
    `SEQUENCE:${m.sequence ?? 0}`,
    `STATUS:${m.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(m.place)}`,
    ...(m.lat !== undefined && m.lon !== undefined ? [`GEO:${m.lat.toFixed(5)};${m.lon.toFixed(5)}`] : []),
    `DESCRIPTION:${icsEscape(desc)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT30M",
    `DESCRIPTION:${icsEscape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
