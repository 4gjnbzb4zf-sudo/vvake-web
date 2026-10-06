/**
 * COPY of packages/game-core/src/datetime.ts in the VVFit repo (the site follows the apps): keep identical, so a date
 * reads the same on the site, the phone and the watch. Tests: datetime.test.ts (a subset of game-core's cases).
 */
/**
 * Dates and times the way the user reads them (You → Settings → Time format, Date format): one formatting layer for
 * the phone, the server's pushes and coach, and the website, mirrored in apps/mobile/targets/watch/DateFormats.swift
 * (XCTest parity on the same cases as test/datetime.test.ts).
 *
 * - The app's language (en | fr) decides the words: month and weekday names, "Today", "in 2 days".
 * - The device's region decides the defaults ("System"): 12 or 24 hours, day/month/year order, French Canadian "18 h 30"
 *   versus French "18:30".
 * - The user's overrides win: `timeFormat` 12h | 24h, `dateFormat` dmy | mdy | ymd.
 *
 * The output is assembled here from fixed name tables rather than left to the engine's ICU (Hermes, Node, V8 in the
 * Worker, browsers and Foundation each print slightly different strings), so every surface and the watch agree to the
 * character. Intl is only used to read the wall clock in a given IANA time zone. Pure.
 */

export type ClockChoice = "system" | "12h" | "24h";
export type DateOrderChoice = "system" | "dmy" | "mdy" | "ymd";
export type DateOrder = "dmy" | "mdy" | "ymd";
export type DateLang = "en" | "fr";

export interface DateFormatPrefs {
  /** The app's language: the words. */
  lang: DateLang;
  /** The device's region (ISO 3166, "CA", "FR", "US"): the defaults when a choice is "system" or absent. */
  region?: string | undefined;
  timeFormat?: ClockChoice | undefined;
  dateFormat?: DateOrderChoice | undefined;
  /** What the device itself says when the choice is "system" (iOS: 24-hour time switch, region date format). */
  system?: { hour12?: boolean | undefined; order?: DateOrder | undefined } | undefined;
  /** IANA zone to read the wall clock in (the server's pushes, the website); absent = the device's local time. */
  timeZone?: string | undefined;
}

export type DateStyle =
  /** 31/12/2026 · 12/31/2026 · 2026-12-31 */
  | "numeric"
  /** 31/12 · 12/31 · 12-31 */
  | "numericShort"
  /** 31 Dec · Dec 31 · 31 déc. */
  | "short"
  /** 31 Dec 2026 · Dec 31, 2026 · 31 déc. 2026 */
  | "medium"
  /** Thu 31 Dec · Thu, Dec 31 · jeu. 31 déc. */
  | "weekdayShort"
  /** 31 December 2026 · December 31, 2026 · 31 décembre 2026 */
  | "longDate"
  /** Thursday 31 December 2026 · Thursday, December 31, 2026 · jeudi 31 décembre 2026 */
  | "long";

// ── Names (Unicode CLDR, the same as Foundation's for "en" and "fr") ────────────────────────────────────────────────

export const MONTHS: Record<DateLang, { long: string[]; short: string[] }> = {
  en: {
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  fr: {
    long: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    short: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  },
};

/** Sunday first (Date.getDay()). */
export const WEEKDAYS: Record<DateLang, { long: string[]; short: string[] }> = {
  en: {
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  fr: {
    long: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    short: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
  },
};

// ── Defaults from the region ─────────────────────────────────────────────────────────────────────────────────────

/** Regions writing month first (12/31/2026): the US and the places using its conventions. */
const MDY_REGIONS = ["US", "PH", "FM", "MH", "PW", "AS", "GU", "MP", "PR", "UM", "VI"];
/** Regions writing year first (2026-12-31): Canada (both languages), East Asia, Hungary, Lithuania, Sweden… */
const YMD_REGIONS = ["CA", "CN", "JP", "KR", "TW", "HU", "LT", "SE", "MN", "BT"];
/** English-speaking regions on a 12-hour clock by default (the rest of English and all of French: 24 hours). */
const H12_EN_REGIONS = ["US", "CA", "AU", "NZ", "IN", "PH", "PK", "BD", "EG", "SA", "MY", "JM", "PR"];

/** The region's day/month/year order. Unknown region: day first, except English without a region (en-US). */
export function defaultDateOrder(region: string | undefined, lang: DateLang = "en"): DateOrder {
  const r = region?.toUpperCase();
  if (!r) return lang === "en" ? "mdy" : "dmy";
  if (MDY_REGIONS.includes(r)) return "mdy";
  if (YMD_REGIONS.includes(r)) return "ymd";
  return "dmy";
}

/** 12 hours by default: English in the US, Canada, Australia, India…; French never (fr-CA is 24 h too). */
export function defaultHour12(region: string | undefined, lang: DateLang = "en"): boolean {
  if (lang === "fr") return false;
  const r = region?.toUpperCase();
  return !r || H12_EN_REGIONS.includes(r);
}

/** The clock in effect: the choice, else what the device says, else the region's default. */
export function resolveHour12(p: DateFormatPrefs): boolean {
  if (p.timeFormat === "12h") return true;
  if (p.timeFormat === "24h") return false;
  return p.system?.hour12 ?? defaultHour12(p.region, p.lang);
}

/** The date order in effect: the choice, else what the device says, else the region's default. */
export function resolveDateOrder(p: DateFormatPrefs): DateOrder {
  if (p.dateFormat === "dmy" || p.dateFormat === "mdy" || p.dateFormat === "ymd") return p.dateFormat;
  return p.system?.order ?? defaultDateOrder(p.region, p.lang);
}

// ── Wall clock ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface WallParts {
  y: number;
  /** 1-12 */
  m: number;
  d: number;
  h: number;
  mi: number;
  /** 0 = Sunday … 6 = Saturday */
  wd: number;
}

const zoneFmt = new Map<string, Intl.DateTimeFormat>();
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The date's wall clock in `timeZone` (IANA), or in the device's local time. An unknown zone falls back to local. */
export function wallParts(date: Date | number | string, timeZone?: string): WallParts {
  const d = date instanceof Date ? date : new Date(date);
  if (timeZone) {
    try {
      let f = zoneFmt.get(timeZone);
      if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
          timeZone,
          hourCycle: "h23",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          weekday: "short",
        });
        zoneFmt.set(timeZone, f);
      }
      const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
      return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute!, wd: WD[p.weekday!] ?? 0 };
    } catch {
      // unknown zone: the device's time
    }
  }
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), wd: d.getDay() };
}

const pad = (n: number) => String(n).padStart(2, "0");
const frenchCanada = (p: DateFormatPrefs) => p.lang === "fr" && p.region?.toUpperCase() === "CA";

// ── Time ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The day period after a 12-hour time: "PM" (US), "p.m." (Canada, French Canada), "pm" (elsewhere). */
function dayPeriod(h: number, p: DateFormatPrefs): string {
  const pm = h >= 12;
  const r = p.region?.toUpperCase();
  if (r === "CA") return pm ? "p.m." : "a.m.";
  if (p.lang === "en" && r && r !== "US") return pm ? "pm" : "am";
  return pm ? "PM" : "AM";
}

/**
 * A time of day from hours and minutes: "18:30", "6:30 PM", French Canadian "18 h 30" / "18 h", "6 h 30 p.m.".
 * 24 hours with a colon pads the hour ("08:30"), like the system clocks of those regions.
 */
export function formatClock(h: number, mi: number, p: DateFormatPrefs): string {
  const hh = ((Math.floor(h) % 24) + 24) % 24;
  const mm = ((Math.floor(mi) % 60) + 60) % 60;
  const h12 = resolveHour12(p);
  const shown = h12 ? hh % 12 || 12 : hh;
  if (frenchCanada(p)) return `${shown} h${mm ? ` ${pad(mm)}` : ""}${h12 ? ` ${dayPeriod(hh, p)}` : ""}`;
  if (h12) return `${shown}:${pad(mm)} ${dayPeriod(hh, p)}`;
  return `${pad(shown)}:${pad(mm)}`;
}

/** A time of day: "18:30" / "6:30 PM" / "18 h 30". */
export function formatTime(date: Date | number | string, p: DateFormatPrefs): string {
  const w = wallParts(date, p.timeZone);
  return formatClock(w.h, w.mi, p);
}

/** Minutes after midnight (a reminder, a bedtime, a daily slot): "07:30" / "7:30 AM" / "7 h 30". */
export const formatMinuteOfDay = (minutes: number, p: DateFormatPrefs) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return formatClock(Math.floor(m / 60), m % 60, p);
};

// ── Dates ────────────────────────────────────────────────────────────────────────────────────────────────────────

function dateFromParts(w: Pick<WallParts, "y" | "m" | "d" | "wd">, style: DateStyle, p: DateFormatPrefs): string {
  const order = resolveDateOrder(p);
  const L = p.lang;
  switch (style) {
    case "numeric":
      return order === "ymd"
        ? `${w.y}-${pad(w.m)}-${pad(w.d)}`
        : order === "mdy"
          ? `${w.m}/${w.d}/${w.y}`
          : `${pad(w.d)}/${pad(w.m)}/${w.y}`;
    case "numericShort":
      return order === "ymd" ? `${pad(w.m)}-${pad(w.d)}` : order === "mdy" ? `${w.m}/${w.d}` : `${pad(w.d)}/${pad(w.m)}`;
    default:
      break;
  }
  // Words: month first only when chosen (or the region's) month first; year first reads in the language's own
  // order with words (English "Dec 31", French "31 déc."), the year after.
  const monthFirst = order === "mdy" || (order === "ymd" && L === "en");
  const short = MONTHS[L].short[w.m - 1]!;
  const long = MONTHS[L].long[w.m - 1]!;
  const day = L === "fr" && w.d === 1 ? "1er" : String(w.d);
  switch (style) {
    case "short":
      return monthFirst ? `${short} ${day}` : `${day} ${short}`;
    case "medium":
      return monthFirst ? `${short} ${day}, ${w.y}` : `${day} ${short} ${w.y}`;
    case "longDate":
      return monthFirst ? `${long} ${day}, ${w.y}` : `${day} ${long} ${w.y}`;
    case "weekdayShort": {
      const wd = WEEKDAYS[L].short[w.wd]!;
      return monthFirst ? `${wd}, ${short} ${day}` : `${wd} ${day} ${short}`;
    }
    case "long": {
      const wd = WEEKDAYS[L].long[w.wd]!;
      return monthFirst ? `${wd}, ${long} ${day}, ${w.y}` : `${wd} ${day} ${long} ${w.y}`;
    }
  }
}

/** A date in the chosen order and the app's language (see DateStyle). */
export function formatDate(date: Date | number | string, p: DateFormatPrefs, style: DateStyle = "medium"): string {
  return dateFromParts(wallParts(date, p.timeZone), style, p);
}

/**
 * A calendar day given as "YYYY-MM-DD" (a goal's deadline, a reward week): no time zone shift, it is that day
 * wherever the user is.
 */
export function formatDay(isoDay: string, p: DateFormatPrefs, style: DateStyle = "medium"): string {
  const [y, m, d] = isoDay.slice(0, 10).split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dateFromParts({ y, m, d, wd }, style, p);
}

/** Date and time: "Dec 31, 2026, 6:30 PM" / "31 Dec 2026, 18:30" / "31 déc. 2026 à 18 h 30". */
export function formatDateTime(date: Date | number | string, p: DateFormatPrefs, style: DateStyle = "medium"): string {
  const w = wallParts(date, p.timeZone);
  return `${dateFromParts(w, style, p)}${p.lang === "fr" ? " à " : ", "}${formatClock(w.h, w.mi, p)}`;
}

/** The weekday: "Thursday" / "Thu" / "jeudi" / "jeu.". */
export function formatWeekday(date: Date | number | string, p: DateFormatPrefs, width: "long" | "short" = "long"): string {
  return WEEKDAYS[p.lang][width][wallParts(date, p.timeZone).wd]!;
}

/** Whole calendar days from `now`'s day to `date`'s day, in the zone (DST-proof: counted on the dates, not hours). */
export function calendarDaysBetween(now: Date | number | string, date: Date | number | string, timeZone?: string): number {
  const a = wallParts(now, timeZone);
  const b = wallParts(date, timeZone);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

const REL = {
  en: {
    today: "Today",
    yesterday: "Yesterday",
    tomorrow: "Tomorrow",
    in: (n: number) => `In ${n} days`,
    ago: (n: number) => `${n} days ago`,
  },
  fr: {
    today: "Aujourd'hui",
    yesterday: "Hier",
    tomorrow: "Demain",
    in: (n: number) => `Dans ${n} jours`,
    ago: (n: number) => `Il y a ${n} jours`,
  },
} as const;

export interface RelativeOptions {
  now?: Date | number | string;
  /** Add the time: "Today, 18:30" / "Hier à 6:30 PM". */
  withTime?: boolean;
  /** Within this many days a day count is said ("In 3 days"), past it the date. Default 6. */
  maxDays?: number;
  /** Within a week the weekday ("Monday") instead of "3 days ago" (a journal). Default false. */
  weekdays?: boolean;
  /** The weekday's width with `weekdays`. Default 'long'. */
  weekdayWidth?: "long" | "short";
  /** The date style past maxDays. Default 'short'. */
  dateStyle?: DateStyle;
  /** Inside a sentence ("Last seen today, 18:30"): the day words in lower case (English weekdays keep their capital). */
  inSentence?: boolean;
}

/** Today / Yesterday / Tomorrow / In 2 days / 3 days ago (or the weekday), else the date. Capitalised (a label). */
export function formatRelative(date: Date | number | string, p: DateFormatPrefs, o: RelativeOptions = {}): string {
  const now = o.now ?? Date.now();
  const n = calendarDaysBetween(now, date, p.timeZone);
  const R = REL[p.lang];
  const max = o.maxDays ?? 6;
  let day: string;
  const word = (w: string) => (o.inSentence ? w[0]!.toLowerCase() + w.slice(1) : w);
  if (n === 0) day = word(R.today);
  else if (n === -1) day = word(R.yesterday);
  else if (n === 1) day = word(R.tomorrow);
  else if (Math.abs(n) <= max) {
    if (o.weekdays) {
      const wd = WEEKDAYS[p.lang][o.weekdayWidth ?? "long"][wallParts(date, p.timeZone).wd]!;
      day = p.lang === "fr" && !o.inSentence ? wd[0]!.toUpperCase() + wd.slice(1) : wd;
    } else day = word(n > 0 ? R.in(n) : R.ago(-n));
  } else day = formatDate(date, p, o.dateStyle ?? "short");
  if (!o.withTime) return day;
  return `${day}${p.lang === "fr" ? " à " : ", "}${formatTime(date, p)}`;
}

// ── Durations ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A duration: 'clock' "1:52:30" / "26:40" (a timer, a race time; the default), 'text' "1 h 5 min" / "45 min" / "30 s"
 * (the same in English and French). Negative values read as zero.
 */
export function formatDuration(seconds: number, style: "clock" | "text" = "clock"): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (style === "clock") return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${r} s`;
}

// ── Spoken ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A time of day for a voice (the coach, Siri, the voice commands): what a person would say, in the user's clock.
 * English 12 h: "6 p.m.", "6:30 p.m.", "noon", "midnight"; 24 h: "18:30", "18 hundred". French 24 h: "18 heures",
 * "18 heures 30", "midi", "minuit"; French 12 h: "6 heures du soir", "6 heures 30 du matin".
 */
export function spokenClock(h: number, mi: number, p: DateFormatPrefs): string {
  const hh = ((Math.floor(h) % 24) + 24) % 24;
  const mm = ((Math.floor(mi) % 60) + 60) % 60;
  const h12 = resolveHour12(p);
  if (p.lang === "fr") {
    if (hh === 12 && mm === 0) return "midi";
    if (hh === 0 && mm === 0) return "minuit";
    const shown = h12 ? hh % 12 || 12 : hh;
    const base = `${shown} heure${shown > 1 ? "s" : ""}${mm ? ` ${mm}` : ""}`;
    if (!h12) return base;
    return `${base} ${hh < 12 ? "du matin" : hh < 18 ? "de l'après-midi" : "du soir"}`;
  }
  if (hh === 12 && mm === 0) return "noon";
  if (hh === 0 && mm === 0) return "midnight";
  if (h12) return `${hh % 12 || 12}${mm ? `:${pad(mm)}` : ""} ${hh < 12 ? "a.m." : "p.m."}`;
  return mm ? `${hh}:${pad(mm)}` : `${hh} hundred`;
}

/** A date's time for a voice, in the zone (see spokenClock). */
export function spokenTime(date: Date | number | string, p: DateFormatPrefs): string {
  const w = wallParts(date, p.timeZone);
  return spokenClock(w.h, w.mi, p);
}

/** One line for the coach's prompt: how this athlete writes times, and their zone. */
export function clockPromptLine(hour12: boolean, lang: DateLang, timeZone?: string): string {
  const ex = hour12
    ? lang === "fr"
      ? "« 6 h du soir », « 6 h 30 du matin »"
      : '"6 pm", "6:30 am"'
    : lang === "fr"
      ? "« 18 h », « 18 h 30 »"
      : '"18:00", "18:30"';
  return `- Clock: the athlete uses a ${hour12 ? "12-hour" : "24-hour"} clock; write any time like ${ex}.${timeZone ? ` Their time zone: ${timeZone}.` : ""}`;
}
