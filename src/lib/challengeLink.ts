/**
 * Challenge invite links: https://vvake.com/c/<code> (universal link into the app, see
 * public/.well-known/apple-app-site-association). Codes are 8 characters from the API's alphabet
 * (no 0/O/1/I), matched case-insensitively.
 *
 * GitHub Pages can't route /c/<code> (static export, unknown codes), so its 404 page sends the browser to
 * /<lang>/c/#<code>, the fallback page for people without the app. Dependency-free: `challengeRedirect` is
 * serialised into an inline script.
 */
import sportsData from "@/data/sports.json";

export const CHALLENGE_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** A valid code from "#abcd2345", "abcd2345" or "/c/ABCD2345/", uppercased; null otherwise. */
export function parseChallengeCode(raw: string): string | null {
  const code = raw
    .replace(/^#/, "")
    .replace(/^\/?c\//, "")
    .replace(/\/$/, "")
    .toUpperCase();
  return CHALLENGE_CODE.test(code) ? code : null;
}

/** Where a /c/<code> path should go on this static site, or null when the path isn't a challenge link. */
export function challengeRedirect(pathname: string, lang: string): string | null {
  const m = /^\/c\/([A-Za-z0-9]{1,16})\/?$/.exec(pathname);
  return m ? "/" + lang + "/c/#" + m[1]!.toUpperCase() : null;
}

export const challengeAppUrl = (scheme: string, code: string) => `${scheme}://c/${code}`;

// ── 24-hour challenges ("beat my mark", the app's game-core challengeTarget.ts) ─────────────────────────────────

export type TargetKind = "time" | "distance" | "minutes" | "ghost" | "route" | "training";
/**
 * Ghost modes (the app's game-core ghostModes.ts): `route` races the challenger's own route (shared trimmed and
 * opt-in, fetched only by the people racing it: this page never gets a point, only its length and climb); `training`
 * races their heart-rate session over `durationS`, judged by effort (cardio) or time in their zones `band` (strength,
 * yoga, climbing).
 */
export interface ChallengeTarget {
  kind: TargetKind;
  sport?: string;
  distanceM?: number;
  timeS?: number;
  minutes?: number;
  climbM?: number;
  durationS?: number;
  effort?: number;
  band?: [number, number];
  bandS?: number;
  rule?: "effort" | "zones";
}
export type AttemptStatus = "accepted" | "won" | "lost";
export interface BoardEntry {
  name: string;
  castId?: string;
  status: AttemptStatus;
  best?: number;
}

/** What the page shows from the public preview (GET /v1/challenges/code/:code); null when it isn't one. */
export interface ChallengePreview {
  name: string;
  castId: string | null;
  metric: string | null;
  hours: number | null;
  status: string | null;
  expiresAt: string | null;
  target: ChallengeTarget | null;
  open: boolean;
  participants: { accepted: number; won: number; racing: number } | null;
  board: BoardEntry[];
  hidden: number;
  /** A route challenge's summary (never a point of it). */
  route: { lengthM: number; climbM?: number } | null;
  /** The challenge this one is a rematch of (its mark). */
  rematchOf: ChallengeTarget | null;
}

const num = (x: unknown, max = 1e7): number | undefined =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max ? x : undefined;
const str = (x: unknown, max = 64): string | undefined => (typeof x === "string" && x.length <= max ? x : undefined);
const CAST = /^[A-Za-z0-9._-]{1,64}$/;

/** A target from the API, with only the fields its kind uses and sane numbers; null otherwise. */
export function readTarget(x: unknown): ChallengeTarget | null {
  if (!x || typeof x !== "object") return null;
  const j = x as Record<string, unknown>;
  const kind = j.kind;
  const sport = str(j.sport, 40);
  if (kind === "time" || kind === "ghost") {
    const distanceM = num(j.distanceM);
    const timeS = num(j.timeS, 86_400);
    return distanceM && timeS ? { kind, distanceM, timeS, ...(sport ? { sport } : {}) } : null;
  }
  if (kind === "distance") {
    const distanceM = num(j.distanceM);
    return distanceM ? { kind, distanceM, ...(sport ? { sport } : {}) } : null;
  }
  if (kind === "minutes") {
    const minutes = num(j.minutes, 1440);
    return minutes ? { kind, minutes, ...(sport ? { sport } : {}) } : null;
  }
  if (kind === "route") {
    const distanceM = num(j.distanceM);
    const timeS = num(j.timeS, 86_400);
    const climbM = num(j.climbM, 20_000);
    return distanceM && timeS && sport ? { kind, sport, distanceM, timeS, ...(climbM !== undefined ? { climbM } : {}) } : null;
  }
  if (kind === "training") {
    const durationS = num(j.durationS, 86_400);
    const effort = num(j.effort, 10_000);
    const bandS = num(j.bandS, 86_400);
    const rule = j.rule === "effort" || j.rule === "zones" ? j.rule : null;
    const b = Array.isArray(j.band) ? j.band : [];
    const band: [number, number] | null =
      b.length === 2 &&
      b.every((z) => Number.isInteger(z) && (z as number) >= 1 && (z as number) <= 5) &&
      (b[0] as number) <= (b[1] as number)
        ? [b[0] as number, b[1] as number]
        : null;
    return durationS && effort !== undefined && bandS !== undefined && rule && band && sport
      ? { kind, sport, durationS, effort, band, bandS, rule }
      : null;
  }
  return null;
}

/** A sport's name in the visitor's language, from the app's catalog export ("HIIT", "Course"). */
export function sportLabel(key: string | undefined, lang: "en" | "fr"): string {
  const s = (sportsData as { sports: { key: string; name: { en: string; fr: string } }[] }).sports.find((x) => x.key === key);
  return s ? s.name[lang] : lang === "fr" ? "Séance" : "Workout";
}

/** Reads only the fields the page shows (older APIs sent `displayName` instead of `from`); null when unusable. */
export function readPreview(json: unknown): ChallengePreview | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const from = (j.from && typeof j.from === "object" ? j.from : {}) as Record<string, unknown>;
  const name = (str(from.name, 200) ?? str(j.displayName, 200))?.slice(0, 40);
  if (!name) return null;
  const castRaw = str(from.castId) ?? str(j.castId);
  const p = (j.participants && typeof j.participants === "object" ? j.participants : null) as Record<string, unknown> | null;
  const board = Array.isArray(j.board)
    ? j.board
        .flatMap((b: unknown): BoardEntry[] => {
          if (!b || typeof b !== "object") return [];
          const e = b as Record<string, unknown>;
          const n = str(e.name, 200)?.slice(0, 40);
          const status: AttemptStatus | null = e.status === "won" || e.status === "accepted" || e.status === "lost" ? e.status : null;
          if (!n || !status) return [];
          const cast = str(e.castId);
          const best = num(e.best);
          return [{ name: n, status, ...(cast && CAST.test(cast) ? { castId: cast } : {}), ...(best !== undefined ? { best } : {}) }];
        })
        .slice(0, 20)
    : [];
  return {
    name,
    castId: castRaw && CAST.test(castRaw) ? castRaw : null,
    metric: str(j.metric, 20) ?? null,
    hours: num(j.windowHours, 1000) ?? null,
    status: str(j.status, 20) ?? null,
    expiresAt: str(j.expiresAt, 40) && !Number.isNaN(Date.parse(j.expiresAt as string)) ? (j.expiresAt as string) : null,
    target: readTarget(j.target),
    open: j.open === true,
    participants: p ? { accepted: num(p.accepted) ?? 0, won: num(p.won) ?? 0, racing: num(p.racing) ?? 0 } : null,
    board,
    hidden: num(j.hidden) ?? 0,
    route: readRouteSummary(j.route),
    rematchOf: j.rematchOf && typeof j.rematchOf === "object" ? readTarget((j.rematchOf as Record<string, unknown>).target) : null,
  };
}

/** Only a length and a climb: anything else the API might send about a route is ignored. */
function readRouteSummary(x: unknown): { lengthM: number; climbM?: number } | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const lengthM = num(r.lengthM, 1_000_000);
  const climbM = num(r.climbM, 20_000);
  return lengthM ? { lengthM, ...(climbM !== undefined ? { climbM } : {}) } : null;
}

/** m:ss or h:mm:ss. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** "5 km", "10.5 km" ("10,5 km" in French). */
export function km(m: number, lang: "en" | "fr"): string {
  const x = Math.round((m / 1000) * 10) / 10;
  const s = Number.isInteger(x) ? String(x) : x.toFixed(1);
  return `${lang === "fr" ? s.replace(".", ",") : s} km`;
}

const DO: Record<string, { en: string; fr: string }> = {
  run: { en: "Run", fr: "Cours" },
  walk: { en: "Walk", fr: "Marche" },
  ride: { en: "Ride", fr: "Roule" },
  hike: { en: "Hike", fr: "Randonne" },
  swim: { en: "Swim", fr: "Nage" },
  skate: { en: "Skate", fr: "Patine" },
};

/** The mark as a headline, like the app: "Beat 5 km in 24:10", "Run 10 km", "30 active minutes". */
export function targetTitle(t: ChallengeTarget, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  switch (t.kind) {
    case "time":
    case "ghost":
      return fr ? `Bats ${km(t.distanceM!, lang)} en ${clock(t.timeS!)}` : `Beat ${km(t.distanceM!, lang)} in ${clock(t.timeS!)}`;
    case "distance": {
      const verb = t.sport ? DO[t.sport]?.[lang] : undefined;
      return verb ? `${verb} ${km(t.distanceM!, lang)}` : km(t.distanceM!, lang);
    }
    case "minutes":
      return fr ? `${t.minutes} minutes actives` : `${t.minutes} active minutes`;
    case "route":
      return fr
        ? `Bats mon parcours de ${km(t.distanceM!, lang)} en ${clock(t.timeS!)}`
        : `Beat my ${km(t.distanceM!, lang)} route in ${clock(t.timeS!)}`;
    case "training": {
      const name = sportLabel(t.sport, lang);
      const min = Math.round(t.durationS! / 60);
      return fr ? `Bats ma séance de ${name} de ${min} min` : `Beat my ${min}-min ${name}`;
    }
  }
}

/** A route's summary line: "2 km route · 15 m climb" / "Parcours de 2 km · 15 m de dénivelé". */
export function routeLine(r: { lengthM: number; climbM?: number }, lang: "en" | "fr"): string {
  const d = km(r.lengthM, lang);
  const climb = r.climbM !== undefined ? Math.round(r.climbM) : undefined;
  if (lang === "fr") return `Parcours de ${d}${climb !== undefined ? ` · ${climb} m de dénivelé` : ""}`;
  return `${d} route${climb !== undefined ? ` · ${climb} m climb` : ""}`;
}

/** A board result in the mark's unit. */
export function targetResult(t: ChallengeTarget, best: number | undefined, lang: "en" | "fr"): string | null {
  if (best === undefined) return null;
  if (t.kind === "time" || t.kind === "ghost" || t.kind === "route") return clock(best);
  if (t.kind === "distance") return km(best, lang);
  if (t.kind === "training") {
    if (t.rule === "zones") return lang === "fr" ? `${Math.round(best / 60)} min en zone` : `${Math.round(best / 60)} min in zone`;
    const e = Math.round(best * 10) / 10;
    return lang === "fr" ? `${String(e).replace(".", ",")} pts d'effort` : `${e} effort pts`;
  }
  return `${Math.round(best)} min`;
}

/** "6 d 23:59:12" / "23:59:12": time left, for the live countdowns. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const hms = `${String(h).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return d > 0 ? `${d} d ${hms}` : hms;
}

/** Can the link still be accepted (its status and its 7 days)? */
export const takeable = (p: Pick<ChallengePreview, "status" | "expiresAt">, nowMs: number) =>
  (p.status === "pending" || p.status === "open") && (!p.expiresAt || Date.parse(p.expiresAt) > nowMs);

/** "ABCD-2345": easier to type in the app. */
export const prettyChallengeCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

/** The link itself, as the app shares it. */
export const challengeLinkUrl = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/c/${encodeURIComponent(code)}`;
