// Mirrors packages/game-core/src/calendar.ts (keep in sync).
/**
 * Calendar sync (docs/05-tech/calendar-sync.md): put planned sessions in the user's own agenda
 * (Google Calendar, Microsoft Outlook / 365, Apple Calendar) and plan around their busy times.
 *
 * Privacy (C28): we read free/busy only (never titles, attendees or places) and write only to a
 * dedicated "VVake" calendar. Events are private and can use a neutral title.
 */
import type { PlannedSession, Weekday } from "./plan";

/** Minutes after local midnight, e.g. 18:30 → 1110. */
export type LocalMinute = number;
export interface Busy {
  day: Weekday;
  start: LocalMinute;
  end: LocalMinute;
}
export interface Window {
  start: LocalMinute;
  end: LocalMinute;
}

/** Default training windows: evenings on weekdays, mornings at the weekend. */
export const DEFAULT_WINDOWS: Readonly<Record<"weekday" | "weekend", Window>> = {
  weekday: { start: 17 * 60 + 30, end: 21 * 60 },
  weekend: { start: 9 * 60, end: 12 * 60 },
};
/** Time kept free around meetings (travel, changing). */
export const BUFFER_MIN = 15;

/** Earliest start in `window` with `duration` minutes free (plus buffers), or null. Step: 15 min. */
export function firstFreeSlot(
  busy: readonly Busy[],
  day: Weekday,
  window: Window,
  duration: number,
  buffer = BUFFER_MIN,
): LocalMinute | null {
  const today = busy.filter((b) => b.day === day);
  for (let t = window.start; t + duration <= window.end; t += 15) {
    if (today.every((b) => t + duration + buffer <= b.start || t >= b.end + buffer)) return t;
  }
  return null;
}

export interface Placement {
  session: PlannedSession;
  start: LocalMinute | null;
}

/**
 * Gives each session a start time that fits the agenda. Fixed sessions keep their own time;
 * `start: null` means no free slot that day: the app offers another day instead of forcing it.
 */
export function placeSessions(
  sessions: readonly (PlannedSession & { start?: LocalMinute })[],
  busy: readonly Busy[],
  windows: Partial<Record<Weekday, Window>> = {},
): Placement[] {
  return sessions.map((s) => {
    if (s.start !== undefined) return { session: s, start: s.start };
    const w = windows[s.day] ?? (s.day >= 5 ? DEFAULT_WINDOWS.weekend : DEFAULT_WINDOWS.weekday);
    return { session: s, start: firstFreeSlot(busy, s.day, w, s.durationMin) };
  });
}

export interface IcsOptions {
  /** Monday of the first week, "YYYY-MM-DD" (local date). */
  weekStart: string;
  /** IANA time zone, e.g. "Europe/Paris". Events use local wall time in that zone. */
  timeZone: string;
  /** Event title per session (localized by the caller). */
  title: (s: PlannedSession) => string;
  /** Minutes before start for a calendar alert; omit for none (VVake already sends reminders). */
  alarmMin?: number;
  /** Fixed timestamp for DTSTAMP (tests); defaults to now. */
  nowMs?: number;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

/** RFC 5545 TEXT escaping. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1), without splitting a UTF-8 character. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function localStamp(weekStart: string, day: Weekday, minute: LocalMinute): string {
  const [y, m, d] = weekStart.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + day));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(Math.floor(minute / 60))}${pad(minute % 60)}00`;
}

function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * An .ics file for the placed sessions. Weekly sessions become one recurring event (RRULE), so the
 * file works for a one-tap import or a subscription in Google, Outlook and Apple calendars.
 * Sessions without a slot are left out.
 */
export function toIcs(placements: readonly Placement[], o: IcsOptions): string {
  const now = utcStamp(o.nowMs ?? Date.now());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VVake//Training plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:VVake",
  ];
  for (const { session: s, start } of placements) {
    if (start === null) continue;
    const uid = `${o.weekStart}-${s.day}-${s.sport}-${s.crewId ?? s.with}@vvake.com`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${o.timeZone}:${localStamp(o.weekStart, s.day, start)}`,
      `DTEND;TZID=${o.timeZone}:${localStamp(o.weekStart, s.day, start + s.durationMin)}`,
      `SUMMARY:${icsEscape(o.title(s))}`,
      "CLASS:PRIVATE",
      "TRANSP:OPAQUE",
      "CATEGORIES:VVake",
    );
    if (s.recurrence === "weekly") lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.day]}`);
    if (o.alarmMin !== undefined) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${o.alarmMin}M`, `DESCRIPTION:${icsEscape(o.title(s))}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
