import * as z from "zod/mini";

/**
 * Where to train near me on the web (vvake.com/<lang>/app/#/places/<sport>): the parts of the monorepo's game-core
 * places.ts the browser needs, word for word (PLACE_KINDS, placeTitle, formatPlaceDistance, nearestPlaces, bearingDeg,
 * compassPoint, openNow, directionsUrl, osmUrl, roundForPrivacy and the sports that have places), plus reading
 * GET /v1/places (public, no sign-in). Pure: tested in places.test.ts.
 *
 * Privacy (the apps' rules): the position is read only when you tap "Use my location", rounded to 2 decimals (about
 * 1 km) before it leaves the browser; the exact fix stays here to sort by distance and point the way. Directions are
 * plain Apple Maps / Google Maps links. Data © OpenStreetMap contributors (ODbL 1.0), credited on the list and the map.
 */

export type PlaceKind =
  | "trailhead"
  | "hiking_route"
  | "park"
  | "nature"
  | "track"
  | "running_route"
  | "cycle_route"
  | "cycleway"
  | "bike_park"
  | "pool"
  | "beach"
  | "climbing_gym"
  | "crag"
  | "court"
  | "pitch"
  | "gym"
  | "outdoor_gym"
  | "studio"
  | "dance_studio"
  | "dojo"
  | "ice_rink"
  | "ski_area"
  | "nordic_trail"
  | "water_club"
  | "launch"
  | "marina"
  | "golf"
  | "skatepark"
  | "riding"
  | "bowling"
  | "fishing"
  | "sports_centre";

type Lang = "en" | "fr";

/** Names (EN/FR) per kind (game-core PLACE_KINDS, without the native icon names). */
export const PLACE_KINDS: Readonly<Record<PlaceKind, { en: string; fr: string }>> = {
  trailhead: { en: "Trailhead", fr: "Départ de sentier" },
  hiking_route: { en: "Hiking route", fr: "Itinéraire de randonnée" },
  park: { en: "Park", fr: "Parc" },
  nature: { en: "Nature area", fr: "Espace naturel" },
  track: { en: "Running track", fr: "Piste d’athlétisme" },
  running_route: { en: "Running loop", fr: "Boucle de course" },
  cycle_route: { en: "Bike route", fr: "Itinéraire vélo" },
  cycleway: { en: "Bike path", fr: "Piste cyclable" },
  bike_park: { en: "Bike park", fr: "Bike park" },
  pool: { en: "Pool", fr: "Piscine" },
  beach: { en: "Beach or swim spot", fr: "Plage ou baignade" },
  climbing_gym: { en: "Climbing gym", fr: "Salle d’escalade" },
  crag: { en: "Climbing crag", fr: "Site d’escalade" },
  court: { en: "Court", fr: "Terrain" },
  pitch: { en: "Pitch", fr: "Terrain" },
  gym: { en: "Gym", fr: "Salle de sport" },
  outdoor_gym: { en: "Outdoor gym", fr: "Fitness en plein air" },
  studio: { en: "Studio", fr: "Studio" },
  dance_studio: { en: "Dance studio", fr: "École de danse" },
  dojo: { en: "Dojo or club", fr: "Dojo ou club" },
  ice_rink: { en: "Ice rink", fr: "Patinoire" },
  ski_area: { en: "Ski area", fr: "Domaine skiable" },
  nordic_trail: { en: "Cross-country trail", fr: "Piste de ski de fond" },
  water_club: { en: "Water sports club", fr: "Club nautique" },
  launch: { en: "Launch spot", fr: "Mise à l’eau" },
  marina: { en: "Marina", fr: "Port de plaisance" },
  golf: { en: "Golf", fr: "Golf" },
  skatepark: { en: "Skate spot", fr: "Spot de glisse" },
  riding: { en: "Riding centre", fr: "Centre équestre" },
  bowling: { en: "Bowling", fr: "Bowling" },
  fishing: { en: "Fishing spot", fr: "Coin de pêche" },
  sports_centre: { en: "Sports centre", fr: "Centre sportif" },
};

export const isPlaceKind = (k: string): k is PlaceKind => Object.prototype.hasOwnProperty.call(PLACE_KINDS, k);

/** A kind's shown name ("Pool", "Piscine"); an unknown kind from a newer API reads "Place". */
export const kindName = (k: string, lang: Lang) => (isPlaceKind(k) ? PLACE_KINDS[k][lang] : lang === "fr" ? "Lieu" : "Place");

/** The credit every list and map of places shows (ODbL 1.0 §4.3). */
export const PLACES_ATTRIBUTION = "© OpenStreetMap contributors";
export const PLACES_LICENSE_URL = "https://www.openstreetmap.org/copyright";

/** The catalog sports that have their own places (game-core SPORT_SETS keys without "other" and "padel"). */
export const PLACE_SPORTS: readonly string[] = [
  "run",
  "walk",
  "ride",
  "hike",
  "strength",
  "dance",
  "boxing",
  "yoga",
  "swim",
  "skate",
  "track-field",
  "swim-bike-run",
  "transition",
  "wheelchair-walk",
  "wheelchair-run",
  "hand-cycling",
  "elliptical",
  "rowing",
  "stair-stepper",
  "stairs",
  "hiit",
  "mixed-cardio",
  "cross-training",
  "step-training",
  "jump-rope",
  "fitness-gaming",
  "functional-strength",
  "core",
  "gymnastics",
  "pilates",
  "barre",
  "tai-chi",
  "mind-body",
  "flexibility",
  "cooldown",
  "recovery",
  "cardio-dance",
  "kickboxing",
  "martial-arts",
  "wrestling",
  "fencing",
  "tennis",
  "badminton",
  "table-tennis",
  "pickleball",
  "squash",
  "racquetball",
  "soccer",
  "basketball",
  "volleyball",
  "hockey",
  "rugby",
  "american-football",
  "australian-football",
  "baseball",
  "softball",
  "cricket",
  "lacrosse",
  "handball",
  "disc-sports",
  "water-polo",
  "open-water",
  "surf",
  "paddle",
  "sailing",
  "water-sports",
  "water-fitness",
  "downhill-ski",
  "cross-country-ski",
  "snowboard",
  "snow-sports",
  "curling",
  "climbing",
  "equestrian",
  "golf",
  "archery",
  "fishing",
  "hunting",
  "bowling",
  "play",
];

export const hasPlaces = (sport: string) => PLACE_SPORTS.includes(sport);

/** The API's radius limits (km). */
export const PLACES_RADIUS = { min: 1, max: 25, default: 5 } as const;

export interface Place {
  /** OSM element: n123 (node), w456 (way), r789 (relation). */
  id: string;
  kind: PlaceKind | string;
  set?: string;
  name?: string;
  lat: number;
  lon: number;
  /** OSM `sport=*` (courts, clubs), as tagged ("tennis;basketball"). */
  sport?: string;
  /** OSM `opening_hours`, as tagged. */
  hours?: string;
  surface?: string;
  /** Routes and paths: their length (m). */
  lengthM?: number;
  indoor?: boolean;
  fee?: boolean;
  lit?: boolean;
  access?: string;
  website?: string;
  difficulty?: string;
}

export type NearPlace = Place & { distanceM: number; bearing: number };

// ── Privacy ─────────────────────────────────────────────────────────────────────────────────────────────────

/** What the browser sends instead of its fix: 2 decimals (≈ 1.1 km north–south, less east–west). */
export function roundForPrivacy(lat: number, lon: number): { lat: number; lon: number } {
  const r = (x: number) => Math.round(x * 100) / 100;
  return { lat: r(lat), lon: r(lon) };
}

// ── Distances, bearings, names ──────────────────────────────────────────────────────────────────────────────

const R_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function placeDistanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north (0–359). */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

const COMPASS = { en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"], fr: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] } as const;
/** "NE", "SO"… for a bearing. */
export const compassPoint = (deg: number, lang: Lang = "en") => COMPASS[lang][Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;

const SPORT_WORDS: Readonly<Record<string, { en: string; fr: string }>> = {
  tennis: { en: "Tennis", fr: "tennis" },
  padel: { en: "Padel", fr: "padel" },
  basketball: { en: "Basketball", fr: "basket" },
  volleyball: { en: "Volleyball", fr: "volley" },
  beachvolleyball: { en: "Beach volleyball", fr: "beach-volley" },
  soccer: { en: "Football", fr: "foot" },
  futsal: { en: "Futsal", fr: "futsal" },
  badminton: { en: "Badminton", fr: "badminton" },
  table_tennis: { en: "Table tennis", fr: "ping-pong" },
  pickleball: { en: "Pickleball", fr: "pickleball" },
  squash: { en: "Squash", fr: "squash" },
  handball: { en: "Handball", fr: "handball" },
  baseball: { en: "Baseball", fr: "baseball" },
  softball: { en: "Softball", fr: "softball" },
  rugby_union: { en: "Rugby", fr: "rugby" },
  rugby_league: { en: "Rugby", fr: "rugby" },
  american_football: { en: "Football", fr: "football américain" },
  cricket: { en: "Cricket", fr: "cricket" },
  field_hockey: { en: "Hockey", fr: "hockey" },
  ice_hockey: { en: "Hockey", fr: "hockey" },
  athletics: { en: "Athletics", fr: "athlétisme" },
  running: { en: "Running", fr: "course" },
};

/** A place's shown name: its own, else "Tennis court", "Terrain de tennis", "Pool"… */
export function placeTitle(p: Pick<Place, "name" | "kind" | "sport">, lang: Lang = "en"): string {
  if (p.name) return p.name;
  if ((p.kind === "court" || p.kind === "pitch") && p.sport) {
    const k = PLACE_KINDS[p.kind];
    const first = p.sport.split(";")[0]!;
    const sp = SPORT_WORDS[first];
    if (sp) return lang === "fr" ? `${k.fr} de ${sp.fr}` : `${sp.en} ${p.kind}`;
  }
  return kindName(p.kind, lang);
}

/** "450 m", "3.2 km" (metric) or "0.3 mi" (imperial); French decimals with a comma. */
export function formatPlaceDistance(m: number, units: "metric" | "imperial" = "metric", lang: Lang = "en"): string {
  const dec = (x: number) => (lang === "fr" ? String(x).replace(".", ",") : String(x));
  if (units === "imperial") {
    const mi = m / 1609.344;
    return `${dec(mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi))} mi`;
  }
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${dec(m < 10_000 ? Math.round(m / 100) / 10 : Math.round(m / 1000))} km`;
}

/** Sorted by distance from the browser's own fix, inside the radius, without near duplicates (same name < 150 m). */
export function nearestPlaces(places: readonly Place[], at: { lat: number; lon: number }, radiusKm: number, max = 60): NearPlace[] {
  const out: NearPlace[] = [];
  const seen = new Set<string>();
  const sorted = places
    .map((p) => ({ ...p, distanceM: Math.round(placeDistanceM(at, p)), bearing: bearingDeg(at, p) }))
    .filter((p) => p.distanceM <= radiusKm * 1000)
    .sort((a, b) => a.distanceM - b.distanceM);
  for (const p of sorted) {
    if (seen.has(p.id)) continue;
    if (p.name && out.some((q) => q.name === p.name && q.kind === p.kind && placeDistanceM(q, p) < 150)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

// ── Opening hours ───────────────────────────────────────────────────────────────────────────────────────────

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const RULE =
  /^(?:((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(off|closed|(?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?)(?:,\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?)*)$/;

/**
 * Open right now, from the common shapes of `opening_hours` ("24/7"; "Mo-Fr 06:00-22:00; Sa,Su 08:00-20:00";
 * "06:00-23:00"; "off"). Anything else (public holidays, months, sunrise…) → null: shown as tagged, never guessed.
 * game-core's own small reader (opening_hours.js is LGPL, not used).
 */
export function openNow(hours: string | undefined, at: Date): boolean | null {
  if (!hours) return null;
  const h = hours.trim();
  if (h === "24/7") return true;
  const day = (at.getDay() + 6) % 7; // Monday = 0
  const min = at.getHours() * 60 + at.getMinutes();
  const prevDay = (day + 6) % 7;
  let ruled = false;
  let open = false;
  for (const rule of h
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)) {
    const m = RULE.exec(rule);
    if (!m) return null;
    const days = new Set<number>();
    if (m[1]) {
      for (const part of m[1].split(",")) {
        const [a, b] = part.split("-") as [string, string | undefined];
        const i = DAYS.indexOf(a as (typeof DAYS)[number]);
        const j = b ? DAYS.indexOf(b as (typeof DAYS)[number]) : i;
        for (let k = i; ; k = (k + 1) % 7) {
          days.add(k);
          if (k === j) break;
        }
      }
    } else for (let k = 0; k < 7; k++) days.add(k);
    const spans =
      m[2] === "off" || m[2] === "closed"
        ? []
        : m[2]!.split(",").map((s) => {
            const [a, b] = s.replace("+", "").split("-") as [string, string];
            const toMin = (x: string) => Number(x.split(":")[0]) * 60 + Number(x.split(":")[1]);
            return [toMin(a), toMin(b)] as const;
          });
    // A later rule for the same day replaces the earlier ones (opening_hours semantics).
    if (days.has(day)) {
      ruled = true;
      open = spans.some(([a, b]) => (b > a ? min >= a && min < b : min >= a));
    }
    // Past midnight from yesterday ("Fr 20:00-02:00").
    if (days.has(prevDay) && spans.some(([a, b]) => b <= a && min < b)) {
      ruled = true;
      open = true;
    }
  }
  return ruled ? open : false;
}

// ── Links ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Directions in Apple Maps or Google Maps (plain links: nothing is sent by VVake). Walking for short hops. */
export function directionsUrl(p: { lat: number; lon: number; name?: string }, app: "apple" | "google", distanceM?: number): string {
  const ll = `${p.lat},${p.lon}`;
  const walk = distanceM !== undefined && distanceM < 1500;
  if (app === "apple")
    return `https://maps.apple.com/?daddr=${ll}&dirflg=${walk ? "w" : "d"}${p.name ? `&q=${encodeURIComponent(p.name)}` : ""}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${walk ? "walking" : "driving"}`;
}

/** The place on openstreetmap.org (to check or fix it). */
export const osmUrl = (id: string) =>
  `https://www.openstreetmap.org/${id[0] === "n" ? "node" : id[0] === "w" ? "way" : "relation"}/${id.slice(1)}`;

/** The kinds present in a list, most frequent first (the filter chips). */
export function kindsIn(places: readonly Pick<Place, "kind">[]): { kind: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n || a.kind.localeCompare(b.kind));
}

// ── GET /v1/places ──────────────────────────────────────────────────────────────────────────────────────────

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));

const placeSchema = z.object({
  id: z.string().check(z.regex(/^[nwr]\d+$/)),
  kind: z.string(),
  set: opt(z.string()),
  name: opt(z.string()),
  lat: z.number().check(z.gte(-90), z.lte(90)),
  lon: z.number().check(z.gte(-180), z.lte(180)),
  sport: opt(z.string()),
  hours: opt(z.string()),
  surface: opt(z.string()),
  lengthM: opt(z.number()),
  indoor: opt(z.boolean()),
  fee: opt(z.boolean()),
  lit: opt(z.boolean()),
  access: opt(z.string()),
  website: opt(z.string()),
  difficulty: opt(z.string()),
});

export interface PlacesAnswer {
  sport: string;
  places: Place[];
  /** Some tiles couldn't be fetched this time: the list may miss a few places. */
  partial: boolean;
  radiusKm: number;
}

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as { [K in keyof T]: Exclude<T[K], null> };

/** The API's answer, leniently: a place a newer API shapes differently is skipped, never a broken screen. */
export function parsePlacesAnswer(body: unknown, sport: string, radiusKm: number): PlacesAnswer {
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const raw = Array.isArray(o.places) ? o.places : [];
  const places: Place[] = [];
  for (const p of raw) {
    const r = placeSchema.safeParse(p);
    if (r.success) places.push(clean(r.data) as Place);
  }
  return {
    sport: typeof o.sport === "string" ? o.sport : sport,
    places,
    partial: o.partial === true,
    radiusKm: typeof o.radiusKm === "number" ? o.radiusKm : radiusKm,
  };
}

/** The URL asked: only the rounded point ever goes in it. */
export function placesUrl(apiUrl: string, q: { sport: string; lat: number; lon: number; radiusKm: number }): string {
  const at = roundForPrivacy(q.lat, q.lon);
  const radius = Math.min(PLACES_RADIUS.max, Math.max(PLACES_RADIUS.min, Math.round(q.radiusKm)));
  const p = new URLSearchParams({ sport: q.sport, lat: at.lat.toFixed(2), lon: at.lon.toFixed(2), radius: String(radius) });
  return `${apiUrl.replace(/\/$/, "")}/v1/places?${p}`;
}

export type PlacesResult =
  | { kind: "ok"; answer: PlacesAnswer }
  /** 503: OpenStreetMap's servers are busy and nothing is cached for this area yet. */
  | { kind: "busy"; retryAfterS: number }
  | { kind: "error" };

/** GET /v1/places (public: no sign-in, no cookies). The first search in a new area can take up to ~40 s. */
export async function fetchPlaces(
  apiUrl: string,
  q: { sport: string; lat: number; lon: number; radiusKm: number },
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<PlacesResult> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(placesUrl(apiUrl, q), { signal: opts.signal, credentials: "omit", headers: { accept: "application/json" } });
    if (res.status === 503) {
      const ra = Number(res.headers.get("retry-after"));
      return { kind: "busy", retryAfterS: Number.isFinite(ra) && ra > 0 ? Math.min(600, Math.round(ra)) : 30 };
    }
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", answer: parsePlacesAnswer(await res.json(), q.sport, q.radiusKm) };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return { kind: "error" };
  }
}
