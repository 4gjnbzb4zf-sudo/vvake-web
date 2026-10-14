/**
 * Live City Clashes (GET /v1/public/clashes): one city challenges another; each side plays a fixed 12 hours from its
 * own local 08:00; scores are per-capita effort points. Public, no auth, cached 30 s by the API. The site is a static
 * export, so the browser fetches it; nothing here is ever faked: no answer, no clash shown.
 */

export type ClashStatus = "buildup" | "live" | "provisional";

export interface ClashSide {
  city: string;
  score: number;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Clash {
  id: string;
  status: ClashStatus;
  a: ClashSide;
  b: ClashSide;
  startsAt: string;
  endsAt: string;
  durationHours: number;
}

export interface ClashFeed {
  clashes: Clash[];
  /** Server clock minus the browser clock at fetch time, in ms (0 when the API sent no usable serverNow). */
  offsetMs: number;
}

export const MAX_CLASHES = 20;
/** Data refresh while the page is visible. */
export const REFRESH_MS = 60_000;

const STATUS_ORDER: Record<ClashStatus, number> = { live: 0, provisional: 1, buildup: 2 };

const isoOrNull = (x: unknown): string | null => (typeof x === "string" && x.length <= 40 && !Number.isNaN(Date.parse(x)) ? x : null);

function readSide(x: unknown): ClashSide | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Record<string, unknown>;
  const city = typeof s.city === "string" ? s.city.trim().slice(0, 60) : "";
  if (!city) return null;
  const score = typeof s.score === "number" && Number.isFinite(s.score) && s.score >= 0 && s.score <= 1e7 ? s.score : 0;
  return { city, score, startsAt: isoOrNull(s.startsAt), endsAt: isoOrNull(s.endsAt) };
}

function readClash(x: unknown): Clash | null {
  if (!x || typeof x !== "object") return null;
  const j = x as Record<string, unknown>;
  const status = j.status;
  if (status !== "buildup" && status !== "live" && status !== "provisional") return null;
  const id = typeof j.id === "string" && j.id.length > 0 && j.id.length <= 64 ? j.id : null;
  const a = readSide(j.a);
  const b = readSide(j.b);
  const startsAt = isoOrNull(j.startsAt);
  const endsAt = isoOrNull(j.endsAt);
  if (!id || !a || !b || !startsAt || !endsAt) return null;
  const hours = typeof j.durationHours === "number" && j.durationHours > 0 && j.durationHours <= 168 ? j.durationHours : 12;
  return { id, status, a, b, startsAt, endsAt, durationHours: hours };
}

/** Live first, then results being checked, then upcoming; by end time within live, by start time within upcoming. */
export function sortClashes(list: Clash[]): Clash[] {
  return [...list].sort((x, y) => {
    const d = STATUS_ORDER[x.status] - STATUS_ORDER[y.status];
    if (d !== 0) return d;
    const key = (c: Clash) => Date.parse(c.status === "buildup" ? c.startsAt : c.endsAt);
    return key(x) - key(y);
  });
}

/** The feed from the API's JSON, with only the fields shown and sane values; an empty feed when unusable. */
export function readClashFeed(json: unknown, clientNowMs: number): ClashFeed {
  if (!json || typeof json !== "object") return { clashes: [], offsetMs: 0 };
  const j = json as Record<string, unknown>;
  const raw = Array.isArray(j.clashes) ? j.clashes : [];
  const seen = new Set<string>();
  const clashes = raw.flatMap((c) => {
    const clash = readClash(c);
    if (!clash || seen.has(clash.id)) return [];
    seen.add(clash.id);
    return [clash];
  });
  const server = isoOrNull(j.serverNow);
  return { clashes: sortClashes(clashes).slice(0, MAX_CLASHES), offsetMs: server ? serverOffset(server, clientNowMs) : 0 };
}

/** Server clock minus browser clock: add it to Date.now() to count down on the server's time. */
export const serverOffset = (serverNowIso: string, clientNowMs: number) => Date.parse(serverNowIso) - clientNowMs;

export type ClashClock = { kind: "endsIn"; ms: number } | { kind: "startsIn"; ms: number } | { kind: "resultsSoon" };

/** What the card's clock says at `nowMs` (server time): time left, time to start, or results soon. */
export function clashClock(c: Pick<Clash, "status" | "startsAt" | "endsAt">, nowMs: number): ClashClock {
  if (c.status === "live") return { kind: "endsIn", ms: Math.max(0, Date.parse(c.endsAt) - nowMs) };
  if (c.status === "buildup") return { kind: "startsIn", ms: Math.max(0, Date.parse(c.startsAt) - nowMs) };
  return { kind: "resultsSoon" };
}

/** "11:59:07", "2 d 03:00:00" (days only past 24 h). */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d} d ${hms}` : hms;
}

/** City A's share of the tug bar, 0..1 (even when both are at zero). */
export function tugShare(a: number, b: number): number {
  const total = a + b;
  return total > 0 ? a / total : 0.5;
}

/** "12.4" / "12,4": one decimal, like the app's effort points. */
export function formatScore(score: number, lang: "en" | "fr"): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(score);
}
