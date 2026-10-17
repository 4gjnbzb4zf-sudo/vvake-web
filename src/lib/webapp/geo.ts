/**
 * GPS in the browser (vvake.com/app live workout): the phone app's rules (apps/mobile app/workout.tsx onFix) applied to
 * navigator.geolocation fixes, plus the filtering a browser needs more than a phone (stale cached fixes, jitter while
 * standing, a fix that jumps faster than the sport allows). Pure: tested in geo.test.ts.
 *
 * - Distance counts only from good fixes (accuracy ≤ 25 m), never while paused, never a jump of 100 m or more between
 *   two fixes (as on the phone), never faster than 1.5× the sport's believable speed (anti-cheat.md: teleport), and
 *   only once you moved past the jitter radius (a few metres while standing still add nothing).
 * - Elevation gain from the fixes' altitude, with a 3 m hysteresis (GPS altitude wanders).
 * - Splits: the time of each full kilometre (or mile).
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Fix extends LatLon {
  /** Horizontal accuracy in metres (the browser's coords.accuracy). */
  acc: number;
  /** Altitude in metres, when the device gives one. */
  alt?: number | null;
  /** Wall-clock time of the fix (ms). */
  at: number;
}

/** A point of the route kept for the map and the session's own route (never uploaded with coordinates). */
export interface RoutePoint extends LatLon {
  /** Session second. */
  t: number;
  /** Metres so far. */
  m: number;
  alt?: number;
}

/** Fixes worse than this never count for distance (the phone's rule). */
export const GOOD_ACCURACY_M = 25;
/** Fixes worse than this don't even move your VVaker on the map. */
export const SHOW_ACCURACY_M = 50;
/** A jump this long between two counted fixes is a GPS glitch (the phone's rule). */
export const MAX_STEP_M = 100;
/** Standing still: moves shorter than this (or than a third of the accuracy) add nothing yet. */
export const JITTER_M = 3;
/** A fix older than this when it arrives is a cached one (browsers hand back the last known position). */
export const STALE_FIX_MS = 10_000;
/** Altitude changes under this are noise. */
export const ALT_HYSTERESIS_M = 3;
/** Speed allowed between two fixes, over the sport's believable average (anti-cheat.md teleport check). */
export const SPEED_SLACK = 1.5;
/** Without a sport cap: no human on foot or a bike goes faster between two fixes. */
export const DEFAULT_CAP_KMH = 80;

/** Metres between two points (haversine), as the phone's metresApart. */
export function metresBetween(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A real position: finite, on the globe, not the 0,0 a broken fix reports. */
export function validFix(f: Partial<Fix>): f is Fix {
  const { lat, lon, acc, at } = f;
  if (typeof lat !== "number" || typeof lon !== "number" || typeof acc !== "number" || typeof at !== "number") return false;
  if (![lat, lon, acc, at].every(Number.isFinite)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return false;
  return acc >= 0;
}

/** GPS quality bars, as the phone shows them (4: ≤ 5 m … 1: ≤ 50 m, 0: none or worse). */
export function gpsBars(accuracy: number | null | undefined): number {
  if (accuracy == null || !Number.isFinite(accuracy)) return 0;
  if (accuracy <= 5) return 4;
  if (accuracy <= 10) return 3;
  if (accuracy <= 20) return 2;
  if (accuracy <= 50) return 1;
  return 0;
}

export type FixVerdict = "counted" | "jitter" | "inaccurate" | "stale" | "jump" | "too-fast" | "paused" | "invalid" | "first";

export interface TrackState {
  metres: number;
  /** The last fix that counted (distance is measured from it). */
  last: (LatLon & { at: number; alt?: number | null }) | null;
  /** Where to draw you: the last fix good enough to show. */
  here: LatLon | null;
  accuracy: number | null;
  gainM: number;
  /** The altitude the gain is measured from (hysteresis anchor). */
  altRef: number | null;
  route: RoutePoint[];
  /** Fixes refused as jumps or too fast in a row (several in a row: the GPS moved for real, re-anchor). */
  refused: number;
  /** Rejected fixes by reason (shown nowhere; sanity and tests). */
  rejected: Partial<Record<FixVerdict, number>>;
}

export const emptyTrack = (): TrackState => ({
  metres: 0,
  last: null,
  here: null,
  accuracy: null,
  gainM: 0,
  altRef: null,
  route: [],
  refused: 0,
  rejected: {},
});

/** Points kept on the map; beyond, every other point of the older half goes (the shape stays). */
export const ROUTE_MAX = 3000;

function thin(points: RoutePoint[], max: number): RoutePoint[] {
  let out = points;
  while (out.length > max) {
    const half = Math.floor(out.length / 2);
    out = [...out.slice(0, half).filter((_, i) => i % 2 === 0), ...out.slice(half)];
  }
  return out;
}

/**
 * One fix into the track. `t` is the session second it belongs to, `now` the wall clock when it arrived, `capKmh`
 * the sport's believable speed (sportLive.json `cap`), `paused` whether the clock is stopped. Returns the new state
 * (the input is never changed) and what happened to the fix.
 */
export function addFix(
  s: TrackState,
  f: Partial<Fix>,
  o: { t: number; now: number; capKmh?: number | null; paused?: boolean },
): { state: TrackState; verdict: FixVerdict } {
  const reject = (verdict: FixVerdict, patch: Partial<TrackState> = {}) => ({
    state: { ...s, ...patch, rejected: { ...s.rejected, [verdict]: (s.rejected[verdict] ?? 0) + 1 } },
    verdict,
  });
  if (!validFix(f)) return reject("invalid");
  if (o.now - f.at > STALE_FIX_MS) return reject("stale");
  const shown: Partial<TrackState> = { accuracy: f.acc, ...(f.acc <= SHOW_ACCURACY_M ? { here: { lat: f.lat, lon: f.lon } } : {}) };
  if (o.paused) return reject("paused", { ...shown, last: null });
  if (f.acc > GOOD_ACCURACY_M) return reject("inaccurate", shown);
  const point = (metres: number): RoutePoint => ({
    t: Math.max(0, Math.round(o.t)),
    m: Math.round(metres),
    lat: f.lat,
    lon: f.lon,
    ...(f.alt != null && Number.isFinite(f.alt) ? { alt: Math.round(f.alt) } : {}),
  });
  if (!s.last) {
    return {
      state: {
        ...s,
        ...shown,
        last: { lat: f.lat, lon: f.lon, at: f.at, alt: f.alt },
        altRef: s.altRef ?? (f.alt != null && Number.isFinite(f.alt) ? f.alt : null),
        route: [...s.route, point(s.metres)],
        refused: 0,
      },
      verdict: "first",
    };
  }
  const d = metresBetween(s.last, f);
  const dt = Math.max(0.001, (f.at - s.last.at) / 1000);
  const cap = ((o.capKmh ?? DEFAULT_CAP_KMH) * SPEED_SLACK) / 3.6;
  // Three refused fixes in a row: the GPS really is over there (a tunnel, a cold start): start again from here,
  // without counting the gap.
  const reanchor = () =>
    s.refused >= 2
      ? {
          state: {
            ...s,
            ...shown,
            last: { lat: f.lat, lon: f.lon, at: f.at, alt: f.alt },
            refused: 0,
            rejected: { ...s.rejected, jump: (s.rejected.jump ?? 0) + 1 },
          },
          verdict: "jump" as const,
        }
      : null;
  if (d >= MAX_STEP_M) return reanchor() ?? reject("jump", { ...shown, refused: s.refused + 1 });
  if (d / dt > cap) return reanchor() ?? reject("too-fast", { ...shown, refused: s.refused + 1 });
  if (d < Math.max(JITTER_M, f.acc / 3)) return reject("jitter", { ...shown, refused: 0 });
  const metres = s.metres + d;
  let gainM = s.gainM;
  let altRef = s.altRef;
  if (f.alt != null && Number.isFinite(f.alt)) {
    if (altRef === null) altRef = f.alt;
    else if (f.alt - altRef >= ALT_HYSTERESIS_M) {
      gainM += f.alt - altRef;
      altRef = f.alt;
    } else if (altRef - f.alt >= ALT_HYSTERESIS_M) altRef = f.alt;
  }
  const route = thin([...s.route, point(metres)], ROUTE_MAX);
  return {
    state: { ...s, ...shown, metres, gainM, altRef, route, refused: 0, last: { lat: f.lat, lon: f.lon, at: f.at, alt: f.alt } },
    verdict: "counted",
  };
}

/** Seconds of each full split (1000 m, or 1609.344 m in miles) from the route points (time interpolated). */
export function splitsOf(route: readonly RoutePoint[], unitM = 1000): number[] {
  const out: number[] = [];
  let next = unitM;
  let lastT = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    while (b.m >= next && b.m > a.m) {
      const at = a.t + ((next - a.m) / (b.m - a.m)) * (b.t - a.t);
      out.push(Math.round(at - lastT));
      lastT = at;
      next += unitM;
    }
  }
  return out;
}

/** Seconds per km (or mile), or null when there is too little distance to say. */
export function paceOf(seconds: number, metres: number, unitM = 1000): number | null {
  if (!(metres >= 50) || !(seconds > 0)) return null;
  const pace = seconds / (metres / unitM);
  return pace >= 60 && pace <= 3600 * 2 ? pace : null;
}
