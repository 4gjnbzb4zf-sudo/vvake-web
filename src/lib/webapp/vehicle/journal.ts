/**
 * What the journal says about a session (VVFit build 58): a mostly-vehicle session is "Not counted: vehicle detected"
 * (flag "vehicle"); a partly-vehicle one says how long was left out; a workout continued on another device lists its
 * sources in order ("Phone 10 min · Watch 14 min", from the API's merged `sources`). Pure.
 */

type Fmt = (template: string, vars: Record<string, string | number>) => string;

export interface JournalWords {
  vehicleNotCounted: string;
  vehicleLeftOut: string;
  sourcePhone: string;
  sourceWatch: string;
}

export interface JournalSession {
  flags?: string[] | null;
  vehicleS?: number | null;
  sources?: { device: string; minutes: number }[] | null;
}

/** "Not counted: vehicle detected", "Vehicle stretch left out: N min", or null. */
export function vehicleLine(s: JournalSession, t: JournalWords, fmt: Fmt): string | null {
  if (s.flags?.includes("vehicle")) return t.vehicleNotCounted;
  const min = Math.round((s.vehicleS ?? 0) / 60);
  return min >= 1 ? fmt(t.vehicleLeftOut, { n: min }) : null;
}

/** "Phone 10 min · Watch 14 min" for a workout in parts, or null for a session from one device. */
export function sourcesLine(s: JournalSession, t: JournalWords, fmt: Fmt): string | null {
  const src = s.sources ?? [];
  if (src.length < 2) return null;
  return src.map((x) => fmt(x.device === "watch" ? t.sourceWatch : t.sourcePhone, { n: x.minutes })).join(" · ");
}
