// Copied from VVFit packages/game-core/src/places.ts (d5cab170 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Where to train near me (docs/02-product/nearby-places.md): places to practise each sport, from OpenStreetMap.
 *
 * One table of OSM tag filters per "place set" (pools, tennis courts, trailheads…) drives everything: the API's
 * Overpass queries (`overpassQueries`), reading its answer back (`readOverpass`, which also says which set each element
 * belongs to) and the cache, keyed by set and geohash tile (`tilesFor`). Each sport of the catalog lists its sets
 * (`placeSetsFor`). Pure TypeScript: the API, the phone and the web read the same rules.
 *
 * Privacy: the device rounds its position to 2 decimals (about 1 km) before asking (`roundForPrivacy`); the server
 * asks Overpass for whole tiles around that point, so neither VVake nor OpenStreetMap learns the exact position.
 * Distances and bearings are computed on the device from its own fix.
 *
 * Data © OpenStreetMap contributors, ODbL 1.0 (`PLACES_ATTRIBUTION`). No Google Places, no scraping.
 */
import { SPORT_CATALOG } from "./sportCatalog";
import { normalizeVoice } from "../camera/voiceNormalize";

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
  | "sports_centre"
  | "parking";

/** Names (EN/FR), an SF Symbol and a Material icon per kind. */
export const PLACE_KINDS: Readonly<Record<PlaceKind, { en: string; fr: string; ios: string; android: string }>> = {
  trailhead: { en: "Trailhead", fr: "Départ de sentier", ios: "signpost.right.fill", android: "signpost" },
  hiking_route: { en: "Hiking route", fr: "Itinéraire de randonnée", ios: "figure.hiking", android: "hiking" },
  park: { en: "Park", fr: "Parc", ios: "tree.fill", android: "park" },
  nature: { en: "Nature area", fr: "Espace naturel", ios: "leaf.fill", android: "forest" },
  track: { en: "Running track", fr: "Piste d’athlétisme", ios: "figure.run.circle.fill", android: "directions_run" },
  running_route: { en: "Running loop", fr: "Boucle de course", ios: "figure.run", android: "directions_run" },
  cycle_route: { en: "Bike route", fr: "Itinéraire vélo", ios: "bicycle", android: "directions_bike" },
  cycleway: { en: "Bike path", fr: "Piste cyclable", ios: "bicycle", android: "pedal_bike" },
  bike_park: { en: "Bike park", fr: "Bike park", ios: "bicycle.circle.fill", android: "pedal_bike" },
  pool: { en: "Pool", fr: "Piscine", ios: "figure.pool.swim", android: "pool" },
  beach: { en: "Beach or swim spot", fr: "Plage ou baignade", ios: "beach.umbrella.fill", android: "beach_access" },
  climbing_gym: { en: "Climbing gym", fr: "Salle d’escalade", ios: "figure.climbing", android: "landscape" },
  crag: { en: "Climbing crag", fr: "Site d’escalade", ios: "mountain.2.fill", android: "terrain" },
  court: { en: "Court", fr: "Terrain", ios: "sportscourt.fill", android: "sports_tennis" },
  pitch: { en: "Pitch", fr: "Terrain", ios: "sportscourt.fill", android: "sports_soccer" },
  gym: { en: "Gym", fr: "Salle de sport", ios: "dumbbell.fill", android: "fitness_center" },
  outdoor_gym: { en: "Outdoor gym", fr: "Fitness en plein air", ios: "figure.strengthtraining.functional", android: "fitness_center" },
  studio: { en: "Studio", fr: "Studio", ios: "figure.yoga", android: "self_improvement" },
  dance_studio: { en: "Dance studio", fr: "École de danse", ios: "figure.dance", android: "nightlife" },
  dojo: { en: "Dojo or club", fr: "Dojo ou club", ios: "figure.martial.arts", android: "sports_martial_arts" },
  ice_rink: { en: "Ice rink", fr: "Patinoire", ios: "figure.skating", android: "ice_skating" },
  ski_area: { en: "Ski area", fr: "Domaine skiable", ios: "figure.skiing.downhill", android: "downhill_skiing" },
  nordic_trail: { en: "Cross-country trail", fr: "Piste de ski de fond", ios: "figure.skiing.crosscountry", android: "nordic_walking" },
  water_club: { en: "Water sports club", fr: "Club nautique", ios: "figure.rower", android: "rowing" },
  launch: { en: "Launch spot", fr: "Mise à l’eau", ios: "sailboat.fill", android: "kayaking" },
  marina: { en: "Marina", fr: "Port de plaisance", ios: "sailboat.fill", android: "sailing" },
  golf: { en: "Golf", fr: "Golf", ios: "figure.golf", android: "golf_course" },
  skatepark: { en: "Skate spot", fr: "Spot de glisse", ios: "figure.skateboarding", android: "skateboarding" },
  riding: { en: "Riding centre", fr: "Centre équestre", ios: "figure.equestrian.sports", android: "bedroom_baby" },
  bowling: { en: "Bowling", fr: "Bowling", ios: "figure.bowling", android: "sports" },
  fishing: { en: "Fishing spot", fr: "Coin de pêche", ios: "figure.fishing", android: "phishing" },
  sports_centre: { en: "Sports centre", fr: "Centre sportif", ios: "building.2.fill", android: "stadium" },
  parking: { en: "Car park", fr: "Parking", ios: "parkingsign.circle.fill", android: "local_parking" },
};

/** The credit every list and map of places shows (ODbL 1.0 §4.3). */
export const PLACES_ATTRIBUTION = "© OpenStreetMap contributors";
export const PLACES_LICENSE_URL = "https://www.openstreetmap.org/copyright";

// ── Tag filters ─────────────────────────────────────────────────────────────────────────────────────────────

/** One tag test: equals, matches (POSIX ERE, also a JS RegExp), doesn't match (absent passes), or present. */
export type TagTest = readonly [key: string, op: "=" | "~" | "!~" | "*", value?: string];
export interface TagFilter {
  /** OSM element types: nodes, ways and relations ('nwr'), ways only, relations only. */
  el: "nwr" | "way" | "rel";
  tags: readonly TagTest[];
}

/**
 * How a set's elements come back: `point` (nodes and areas, as their centre), `line` (ways with their length, same
 * names merged: bike paths come in many pieces) or `route` (relations: their length and the centre of the part
 * inside the asked area, so a 2,000 km route shows where it passes near you, not its middle).
 */
export type PlaceShape = "point" | "line" | "route";

export interface PlaceSet {
  id: string;
  kind: PlaceKind;
  shape: PlaceShape;
  filters: readonly TagFilter[];
}

/** `(^|;)(a|b)(;|$)`: one of these values in a `;` list ("soccer;basketball"). */
const oneOf = (...v: string[]) => `(^|;)(${v.join("|")})(;|$)`;
const NOT_PRIVATE: TagTest = ["access", "!~", "^(private|no)$"];
const f = (el: TagFilter["el"], ...tags: TagTest[]): TagFilter => ({ el, tags: [...tags] });

/** The OSM `sport=*` values of each pitch or court set (taginfo spellings). */
const PITCH_SPORTS: Readonly<Record<string, { osm: string[]; kind: "court" | "pitch" }>> = {
  tennis: { osm: ["tennis"], kind: "court" },
  padel: { osm: ["padel"], kind: "court" },
  badminton: { osm: ["badminton"], kind: "court" },
  table_tennis: { osm: ["table_tennis"], kind: "court" },
  pickleball: { osm: ["pickleball"], kind: "court" },
  squash: { osm: ["squash"], kind: "court" },
  racquetball: { osm: ["racquetball"], kind: "court" },
  basketball: { osm: ["basketball"], kind: "court" },
  volleyball: { osm: ["volleyball", "beachvolleyball"], kind: "court" },
  handball: { osm: ["handball"], kind: "court" },
  soccer: { osm: ["soccer", "futsal"], kind: "pitch" },
  field_hockey: { osm: ["field_hockey", "hockey", "ice_hockey"], kind: "pitch" },
  rugby: { osm: ["rugby_union", "rugby_league", "rugby"], kind: "pitch" },
  american_football: { osm: ["american_football"], kind: "pitch" },
  australian_football: { osm: ["australian_football"], kind: "pitch" },
  baseball: { osm: ["baseball", "softball"], kind: "pitch" },
  cricket: { osm: ["cricket"], kind: "pitch" },
  lacrosse: { osm: ["lacrosse"], kind: "pitch" },
  ultimate: { osm: ["ultimate", "disc_golf", "frisbee"], kind: "pitch" },
  archery: { osm: ["archery"], kind: "pitch" },
  curling: { osm: ["curling"], kind: "pitch" },
  fencing: { osm: ["fencing"], kind: "court" },
  gymnastics: { osm: ["gymnastics", "acrobatics", "trampoline"], kind: "court" },
};

const pitchSet = (key: keyof typeof PITCH_SPORTS & string): PlaceSet => {
  const p = PITCH_SPORTS[key]!;
  return {
    id: `pitch.${key}`,
    kind: p.kind,
    shape: "point",
    filters: [
      f(
        "nwr",
        ["leisure", "~", "^(pitch|sports_centre|sports_hall|stadium|disc_golf_course)$"],
        ["sport", "~", oneOf(...p.osm)],
        NOT_PRIVATE,
      ),
    ],
  };
};

const SETS: readonly PlaceSet[] = [
  { id: "trailheads", kind: "trailhead", shape: "point", filters: [f("nwr", ["highway", "=", "trailhead"])] },
  { id: "hiking_routes", kind: "hiking_route", shape: "route", filters: [f("rel", ["route", "~", "^(hiking|foot)$"])] },
  { id: "parks", kind: "park", shape: "point", filters: [f("nwr", ["leisure", "=", "park"], ["name", "*"], NOT_PRIVATE)] },
  {
    id: "nature",
    kind: "nature",
    shape: "point",
    filters: [f("nwr", ["leisure", "=", "nature_reserve"], ["name", "*"]), f("nwr", ["boundary", "=", "national_park"], ["name", "*"])],
  },
  {
    id: "tracks",
    kind: "track",
    shape: "point",
    filters: [
      f("nwr", ["leisure", "~", "^(track|stadium|sports_centre|pitch)$"], ["sport", "~", oneOf("running", "athletics")], NOT_PRIVATE),
    ],
  },
  { id: "running_routes", kind: "running_route", shape: "route", filters: [f("rel", ["route", "~", "^(running|fitness_trail)$"])] },
  { id: "cycle_routes", kind: "cycle_route", shape: "route", filters: [f("rel", ["route", "~", "^(bicycle|mtb)$"])] },
  { id: "cycleways", kind: "cycleway", shape: "line", filters: [f("way", ["highway", "=", "cycleway"], ["name", "*"])] },
  {
    id: "bike_parks",
    kind: "bike_park",
    shape: "point",
    filters: [f("nwr", ["leisure", "~", "^(track|pitch|sports_centre)$"], ["sport", "~", oneOf("bmx", "mtb", "cycling", "pumptrack")])],
  },
  {
    id: "pools",
    kind: "pool",
    shape: "point",
    filters: [
      // Named pools only: most unnamed ones are someone's garden.
      f("nwr", ["leisure", "=", "swimming_pool"], ["name", "*"], NOT_PRIVATE),
      f("nwr", ["leisure", "=", "sports_centre"], ["sport", "~", oneOf("swimming", "diving", "water_polo")], NOT_PRIVATE),
      f("nwr", ["leisure", "=", "water_park"], NOT_PRIVATE),
    ],
  },
  {
    id: "beaches",
    kind: "beach",
    shape: "point",
    filters: [
      f("nwr", ["natural", "=", "beach"], ["name", "*"], NOT_PRIVATE),
      f("nwr", ["leisure", "=", "swimming_area"], NOT_PRIVATE),
      f("nwr", ["leisure", "=", "beach_resort"]),
    ],
  },
  {
    id: "climbing_gyms",
    kind: "climbing_gym",
    shape: "point",
    filters: [
      f(
        "nwr",
        ["leisure", "~", "^(sports_centre|fitness_centre|sports_hall)$"],
        ["sport", "~", oneOf("climbing", "bouldering", "climbing_adventure")],
      ),
    ],
  },
  {
    id: "crags",
    kind: "crag",
    shape: "point",
    filters: [
      f("nwr", ["climbing", "~", "^(crag|area|boulder)$"]),
      f("nwr", ["natural", "~", "^(cliff|rock)$"], ["sport", "~", oneOf("climbing", "bouldering")]),
    ],
  },
  {
    id: "gyms",
    kind: "gym",
    shape: "point",
    filters: [
      f("nwr", ["leisure", "=", "fitness_centre"], NOT_PRIVATE),
      f("nwr", ["leisure", "=", "sports_centre"], ["sport", "~", oneOf("fitness", "multi", "crossfit", "weightlifting")], NOT_PRIVATE),
    ],
  },
  { id: "outdoor_gyms", kind: "outdoor_gym", shape: "point", filters: [f("nwr", ["leisure", "=", "fitness_station"])] },
  {
    id: "studios",
    kind: "studio",
    shape: "point",
    filters: [
      f("nwr", ["sport", "~", oneOf("yoga", "pilates", "barre")]),
      f("nwr", ["leisure", "=", "fitness_centre"], ["fitness_centre", "~", "^(yoga|pilates)$"]),
    ],
  },
  {
    id: "dance_studios",
    kind: "dance_studio",
    shape: "point",
    filters: [
      f("nwr", ["leisure", "=", "dance"]),
      f("nwr", ["amenity", "=", "dancing_school"]),
      f("nwr", ["sport", "~", oneOf("dance", "zumba")]),
    ],
  },
  {
    id: "dojos",
    kind: "dojo",
    shape: "point",
    filters: [
      f("nwr", ["amenity", "=", "dojo"]),
      f("nwr", [
        "sport",
        "~",
        oneOf(
          "martial_arts",
          "judo",
          "karate",
          "taekwondo",
          "aikido",
          "kickboxing",
          "boxing",
          "wrestling",
          "jiu-jitsu",
          "mma",
          "muay_thai",
        ),
      ]),
    ],
  },
  { id: "ice_rinks", kind: "ice_rink", shape: "point", filters: [f("nwr", ["leisure", "=", "ice_rink"], NOT_PRIVATE)] },
  {
    id: "ski_areas",
    kind: "ski_area",
    shape: "point",
    filters: [
      f("nwr", ["landuse", "=", "winter_sports"]),
      f("nwr", ["leisure", "=", "sports_centre"], ["sport", "~", oneOf("skiing", "snowboard")]),
    ],
  },
  {
    id: "nordic_trails",
    kind: "nordic_trail",
    shape: "route",
    filters: [f("rel", ["route", "=", "piste"], ["piste:type", "~", "^(nordic|skitour)$"])],
  },
  {
    id: "water_clubs",
    kind: "water_club",
    shape: "point",
    filters: [
      f("nwr", [
        "sport",
        "~",
        oneOf("rowing", "canoe", "kayak", "canoeing", "paddleboarding", "surfing", "sailing", "windsurfing", "kitesurfing", "water_ski"),
      ]),
    ],
  },
  {
    id: "launches",
    kind: "launch",
    shape: "point",
    filters: [f("nwr", ["leisure", "=", "slipway"], NOT_PRIVATE), f("nwr", ["canoe", "=", "put_in"])],
  },
  { id: "marinas", kind: "marina", shape: "point", filters: [f("nwr", ["leisure", "=", "marina"])] },
  {
    id: "golf",
    kind: "golf",
    shape: "point",
    filters: [f("nwr", ["leisure", "=", "golf_course"]), f("nwr", ["golf", "=", "driving_range"])],
  },
  {
    id: "skate",
    kind: "skatepark",
    shape: "point",
    filters: [f("nwr", ["sport", "~", oneOf("skateboard", "roller_skating", "inline_skating")])],
  },
  {
    id: "riding",
    kind: "riding",
    shape: "point",
    filters: [f("nwr", ["leisure", "=", "horse_riding"]), f("nwr", ["sport", "~", oneOf("equestrian")], ["leisure", "*"])],
  },
  {
    id: "bowling",
    kind: "bowling",
    shape: "point",
    filters: [f("nwr", ["leisure", "=", "bowling_alley"]), f("nwr", ["sport", "~", oneOf("10pin", "9pin", "bowls")])],
  },
  { id: "fishing", kind: "fishing", shape: "point", filters: [f("nwr", ["leisure", "=", "fishing"], NOT_PRIVATE)] },
  {
    id: "sports_centres",
    kind: "sports_centre",
    shape: "point",
    filters: [f("nwr", ["leisure", "=", "sports_centre"], ["name", "*"], NOT_PRIVATE)],
  },
  ...Object.keys(PITCH_SPORTS).map(pitchSet),
  // Meeting points for meetups (meetups.ts): public car parks only (no private, customer or permit parking, nothing
  // underground or along a street). Asked only through the "meet" pseudo-sport, never for a sport's own list.
  {
    id: "parkings",
    kind: "parking",
    shape: "point",
    filters: [
      f(
        "nwr",
        ["amenity", "=", "parking"],
        ["access", "!~", "^(private|no|customers|permit|delivery|residents)$"],
        ["parking", "!~", "^(underground|multi-storey|rooftop|street_side|lane|on_kerb|half_on_kerb)$"],
      ),
    ],
  },
];

export const PLACE_SETS: Readonly<Record<string, PlaceSet>> = Object.fromEntries(SETS.map((s) => [s.id, s]));

/**
 * The place sets per sport (catalog keys), most useful first, at most four. A few place-only keys too ("padel"),
 * for sports you added yourself that the phone recognises by name.
 */
const SPORT_SETS: Readonly<Record<string, readonly string[]>> = {
  run: ["tracks", "parks", "running_routes", "nature"],
  walk: ["parks", "nature", "hiking_routes", "trailheads"],
  ride: ["cycle_routes", "cycleways", "bike_parks"],
  hike: ["trailheads", "hiking_routes", "nature", "parks"],
  strength: ["gyms", "outdoor_gyms"],
  dance: ["dance_studios"],
  boxing: ["dojos", "gyms"],
  yoga: ["studios", "parks"],
  swim: ["pools", "beaches"],
  skate: ["skate", "ice_rinks"],
  "track-field": ["tracks"],
  "swim-bike-run": ["pools", "tracks", "cycle_routes"],
  transition: ["pools", "tracks", "cycle_routes"],
  "wheelchair-walk": ["parks", "tracks"],
  "wheelchair-run": ["tracks", "parks"],
  "hand-cycling": ["cycle_routes", "cycleways"],
  elliptical: ["gyms"],
  rowing: ["water_clubs", "launches", "gyms"],
  "stair-stepper": ["gyms"],
  stairs: ["parks", "gyms"],
  hiit: ["gyms", "outdoor_gyms", "parks"],
  "mixed-cardio": ["gyms", "outdoor_gyms", "parks"],
  "cross-training": ["gyms", "outdoor_gyms"],
  "step-training": ["gyms"],
  "jump-rope": ["outdoor_gyms", "parks", "gyms"],
  "fitness-gaming": ["gyms"],
  "functional-strength": ["gyms", "outdoor_gyms"],
  core: ["gyms", "studios"],
  gymnastics: ["pitch.gymnastics", "gyms"],
  pilates: ["studios"],
  barre: ["studios", "dance_studios"],
  "tai-chi": ["parks", "studios", "dojos"],
  "mind-body": ["studios", "parks"],
  flexibility: ["studios", "parks"],
  cooldown: ["parks"],
  recovery: ["parks", "studios"],
  "cardio-dance": ["dance_studios", "gyms"],
  kickboxing: ["dojos", "gyms"],
  "martial-arts": ["dojos"],
  wrestling: ["dojos"],
  fencing: ["pitch.fencing", "sports_centres"],
  tennis: ["pitch.tennis"],
  padel: ["pitch.padel", "pitch.tennis"],
  badminton: ["pitch.badminton", "sports_centres"],
  "table-tennis": ["pitch.table_tennis"],
  pickleball: ["pitch.pickleball", "pitch.tennis"],
  squash: ["pitch.squash"],
  racquetball: ["pitch.racquetball", "pitch.squash"],
  soccer: ["pitch.soccer"],
  basketball: ["pitch.basketball"],
  volleyball: ["pitch.volleyball", "beaches"],
  hockey: ["pitch.field_hockey", "ice_rinks"],
  rugby: ["pitch.rugby"],
  "american-football": ["pitch.american_football"],
  "australian-football": ["pitch.australian_football"],
  baseball: ["pitch.baseball"],
  softball: ["pitch.baseball"],
  cricket: ["pitch.cricket"],
  lacrosse: ["pitch.lacrosse"],
  handball: ["pitch.handball"],
  "disc-sports": ["pitch.ultimate", "parks"],
  "water-polo": ["pools"],
  "open-water": ["beaches", "launches"],
  surf: ["beaches", "water_clubs"],
  paddle: ["launches", "water_clubs", "beaches"],
  sailing: ["marinas", "water_clubs"],
  "water-sports": ["water_clubs", "launches", "beaches"],
  "water-fitness": ["pools"],
  "downhill-ski": ["ski_areas"],
  "cross-country-ski": ["nordic_trails", "ski_areas"],
  snowboard: ["ski_areas"],
  "snow-sports": ["ski_areas", "nordic_trails", "ice_rinks"],
  curling: ["pitch.curling", "ice_rinks"],
  climbing: ["climbing_gyms", "crags"],
  equestrian: ["riding"],
  golf: ["golf"],
  archery: ["pitch.archery"],
  fishing: ["fishing", "launches"],
  hunting: ["nature"],
  bowling: ["bowling"],
  play: ["parks", "sports_centres"],
  other: ["sports_centres", "parks"],
  /** Not a sport: public meeting points for a meetup (meetups.ts MEETUP_POINT_KINDS), GET /v1/places?sport=meet. */
  meet: ["parkings", "trailheads", "parks", "sports_centres"],
};

/** Sports with places that aren't catalog sports (yet): the phone maps a sport you added by its name. */
export const PLACE_ONLY_SPORTS: readonly string[] = ["padel"];

/** The sets to look for a sport (catalog key, or a place-only key); unknown sports get sports centres and parks. */
export function placeSetsFor(sport: string): PlaceSet[] {
  return (SPORT_SETS[sport] ?? SPORT_SETS.other!).map((id) => PLACE_SETS[id]!).filter(Boolean);
}

/** True when the sport has its own places (not the generic fallback). */
export const hasPlaces = (sport: string): boolean => sport in SPORT_SETS && sport !== "other";

/** Every sport key the places endpoint accepts. */
export const PLACE_SPORTS: readonly string[] = Object.keys(SPORT_SETS);

/** A sport you added, by its name (EN or FR): "Padel" → padel; else null (generic places). */
export function placeSportForName(name: string): string | null {
  const n = normalizeVoice(name);
  for (const k of PLACE_ONLY_SPORTS) if (n.split(" ").includes(k)) return k;
  return null;
}

// ── Matching an element (JS twin of the Overpass filters) ────────────────────────────────────────────────────

const OSM_TYPE: Record<string, "n" | "w" | "r"> = { node: "n", way: "w", relation: "r" };

function testTag(tags: Readonly<Record<string, string>>, [k, op, v]: TagTest): boolean {
  const val = tags[k];
  if (op === "*") return val !== undefined && val !== "";
  if (op === "=") return val === v;
  if (op === "~") return val !== undefined && new RegExp(v!).test(val);
  return val === undefined || !new RegExp(v!).test(val);
}

/** Does an element (type n/w/r and tags) pass one of the set's filters. */
export function inPlaceSet(set: PlaceSet, type: "n" | "w" | "r", tags: Readonly<Record<string, string>>): boolean {
  return set.filters.some(
    (fl) => (fl.el === "nwr" || (fl.el === "way" ? type === "w" : type === "r")) && fl.tags.every((t) => testTag(tags, t)),
  );
}

// ── Geohash tiles ───────────────────────────────────────────────────────────────────────────────────────────

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohash(lat: number, lon: number, precision: number): string {
  let latR: [number, number] = [-90, 90];
  let lonR: [number, number] = [-180, 180];
  let out = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (out.length < precision) {
    const r = even ? lonR : latR;
    const v = even ? lon : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v >= mid) {
      ch = (ch << 1) | 1;
      r[0] = mid;
    } else {
      ch = ch << 1;
      r[1] = mid;
    }
    even = !even;
    if (++bit === 5) {
      out += B32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return out;
}

export interface BBox {
  s: number;
  w: number;
  n: number;
  e: number;
}

export function geohashBox(hash: string): BBox {
  let latR: [number, number] = [-90, 90];
  let lonR: [number, number] = [-180, 180];
  let even = true;
  for (const c of hash) {
    const idx = B32.indexOf(c);
    if (idx < 0) throw new Error("bad geohash");
    for (let b = 4; b >= 0; b--) {
      const r = even ? lonR : latR;
      const mid = (r[0] + r[1]) / 2;
      if ((idx >> b) & 1) r[0] = mid;
      else r[1] = mid;
      even = !even;
    }
  }
  return { s: latR[0], w: lonR[0], n: latR[1], e: lonR[1] };
}

/** Cell size in degrees for a precision (lat, lon). */
const cellDeg = (p: number) => {
  const bits = p * 5;
  const lonBits = Math.ceil(bits / 2);
  const latBits = Math.floor(bits / 2);
  return { lat: 180 / 2 ** latBits, lon: 360 / 2 ** lonBits };
};

/** Search radius bounds (km). */
export const PLACES_RADIUS = { min: 1, max: 25, default: 5 } as const;

/** Tile precision for a radius: ~5 km tiles (geohash 5) up to 5 km, ~20–40 km tiles (geohash 4) beyond. */
export const tilePrecision = (radiusKm: number) => (radiusKm <= 5 ? 5 : 4);

const KM_PER_DEG = 111.32;

/** The circle's bounding box (degrees), clamped to the map. */
export function circleBox(lat: number, lon: number, radiusKm: number): BBox {
  const dLat = radiusKm / KM_PER_DEG;
  const dLon = radiusKm / (KM_PER_DEG * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return { s: Math.max(-90, lat - dLat), n: Math.min(90, lat + dLat), w: Math.max(-180, lon - dLon), e: Math.min(180, lon + dLon) };
}

/** The geohash tiles covering a circle: the cache keys and what Overpass is asked for. */
export function tilesFor(lat: number, lon: number, radiusKm: number): string[] {
  const p = tilePrecision(radiusKm);
  const box = circleBox(lat, lon, radiusKm);
  const d = cellDeg(p);
  const out = new Set<string>();
  // Step a little under a cell so no cell is skipped; the edges are sampled too.
  for (let la = box.s; ; la = Math.min(box.n, la + d.lat * 0.9)) {
    for (let lo = box.w; ; lo = Math.min(box.e, lo + d.lon * 0.9)) {
      out.add(geohash(la, lo, p));
      if (lo >= box.e) break;
    }
    if (la >= box.n) break;
  }
  return [...out].sort();
}

/** The union box of tiles. */
export function unionBox(hashes: readonly string[]): BBox {
  const boxes = hashes.map(geohashBox);
  return {
    s: Math.min(...boxes.map((b) => b.s)),
    w: Math.min(...boxes.map((b) => b.w)),
    n: Math.max(...boxes.map((b) => b.n)),
    e: Math.max(...boxes.map((b) => b.e)),
  };
}

/** What the device sends instead of its fix: 2 decimals (≈ 1.1 km north–south, less east–west). */
export function roundForPrivacy(lat: number, lon: number): { lat: number; lon: number } {
  const r = (x: number) => Math.round(x * 100) / 100;
  return { lat: r(lat), lon: r(lon) };
}

// ── The Overpass query ──────────────────────────────────────────────────────────────────────────────────────

const ql = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const filterQL = (fl: TagFilter, el = fl.el === "rel" ? "relation" : fl.el) =>
  `${el}${fl.tags.map(([k, op, v]) => (op === "*" ? `["${ql(k)}"]` : `["${ql(k)}"${op}"${ql(v!)}"]`)).join("")}`;
const boxQL = (b: BBox) => [b.s, b.w, b.n, b.e].map((x) => x.toFixed(5)).join(",");

/** Results per shape at most (the answer stays small: a busy city has hundreds of pitches). */
export const OVERPASS_MAX = { point: 1500, line: 600, route: 150 } as const;

/**
 * The Overpass QL queries for several sets over a box, run side by side (Overpass allows two at a time): one for
 * points (nodes and areas: centre and tags), one for lines and routes (ways: centre, length and tags; route
 * relations: their tags, then one of their ways inside the box with its centre, so a 2,000 km route shows where it
 * passes near you, not its middle; a relation's length is its `distance` tag, measuring it is too slow).
 */
export function overpassQueries(sets: readonly PlaceSet[], box: BBox, timeoutS = 40): string[] {
  const b = boxQL(box);
  const head = `[out:json][timeout:${timeoutS}][bbox:${b}];`;
  const by = (shape: PlaceShape) => sets.filter((s) => s.shape === shape).flatMap((s) => s.filters);
  const out: string[] = [];
  const points = by("point");
  if (points.length)
    out.push(
      [head, `(${points.map((fl) => `${filterQL(fl)};`).join("")})->.p;`, `.p out tags center qt ${OVERPASS_MAX.point};`].join("\n"),
    );
  const lines = by("line");
  const routes = by("route");
  const linear: string[] = [];
  if (lines.length)
    linear.push(
      `(${lines.map((fl) => `${filterQL(fl, "way")};`).join("")})->.l;`,
      `.l convert line ::id=id(),::=::,::geom=center(geom()),vv_len=length();`,
      `out geom qt ${OVERPASS_MAX.line};`,
    );
  if (routes.length)
    linear.push(
      `(${routes.map((fl) => `${filterQL(fl, "relation")};`).join("")})->.r;`,
      `foreach.r->.x(.x convert route ::id=id(),::=::;out tags;way(r.x)(${b});out ids center 1;);`,
    );
  if (linear.length) out.push([head, ...linear].join("\n"));
  return out;
}

/** A place as the API sends it and the apps show it. */
export interface Place {
  /** OSM element: n123 (node), w456 (way), r789 (relation). */
  id: string;
  kind: PlaceKind;
  /** The set that found it (pitch.tennis…), for the cache. */
  set: string;
  name?: string;
  lat: number;
  lon: number;
  /** OSM `sport=*` (courts, clubs), as tagged ("tennis;basketball"). */
  sport?: string;
  /** OSM `opening_hours`, as tagged ("Mo-Fr 06:00-22:00"). */
  hours?: string;
  surface?: string;
  /** Routes and paths: their length (m). */
  lengthM?: number;
  /** Indoors (`indoor=yes`, `covered=yes`, or a hall). */
  indoor?: boolean;
  /** `fee=yes` / `fee=no`. */
  fee?: boolean;
  lit?: boolean;
  /** `access=customers|members`… (open to all when absent or yes/public). */
  access?: string;
  website?: string;
  /** Piste or hiking difficulty (`piste:difficulty`, `sac_scale`). */
  difficulty?: string;
}

interface OverpassEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { type?: string; coordinates?: [number, number] };
  tags?: Record<string, string>;
}

const num = (s: string | undefined) => {
  if (!s) return undefined;
  const m = /^\s*([\d.]+)\s*(km|m|mi)?\s*$/i.exec(s);
  if (!m) return undefined;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return undefined;
  const unit = (m[2] ?? "").toLowerCase();
  return unit === "m" ? v : unit === "mi" ? v * 1609.344 : v * 1000;
};
const yesNo = (s: string | undefined) => (s === "yes" ? true : s === "no" ? false : undefined);
const clip = (s: string | undefined, n = 120) => (s ? s.slice(0, n) : undefined);
const webUrl = (s: string | undefined) => (s && /^https?:\/\/[^\s]+$/i.test(s) && s.length <= 200 ? s : undefined);

/** A place from an element, for a set, or null (no position). */
function toPlace(el: OverpassEl, set: PlaceSet, type: "n" | "w" | "r", tags: Record<string, string>): Place | null {
  const pos =
    el.lat !== undefined && el.lon !== undefined
      ? { lat: el.lat, lon: el.lon }
      : el.center
        ? el.center
        : el.geometry?.coordinates
          ? { lat: el.geometry.coordinates[1], lon: el.geometry.coordinates[0] }
          : null;
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return null;
  const len = Number(tags.vv_len);
  const lengthM = set.shape === "point" ? undefined : (num(tags.distance) ?? (Number.isFinite(len) && len > 0 ? len : undefined));
  const indoor =
    tags.indoor === "yes" ||
    tags.covered === "yes" ||
    tags.leisure === "sports_hall" ||
    (tags.building !== undefined && tags.building !== "no")
      ? true
      : undefined;
  const access = tags.access && !["yes", "public", "permissive", "designated"].includes(tags.access) ? tags.access : undefined;
  const p: Place = {
    id: `${type}${el.id}`,
    kind: set.kind,
    set: set.id,
    lat: Math.round(pos.lat * 1e6) / 1e6,
    lon: Math.round(pos.lon * 1e6) / 1e6,
  };
  const name = clip(tags.name ?? tags.ref);
  if (name) p.name = name;
  if (tags.sport) p.sport = clip(tags.sport, 60)!;
  if (tags.opening_hours) p.hours = clip(tags.opening_hours, 200)!;
  if (tags.surface) p.surface = clip(tags.surface, 40)!;
  if (lengthM) p.lengthM = Math.round(lengthM);
  if (indoor) p.indoor = true;
  const fee = yesNo(tags.fee);
  if (fee !== undefined) p.fee = fee;
  const lit = yesNo(tags.lit);
  if (lit !== undefined) p.lit = lit;
  if (access) p.access = clip(access, 30)!;
  const site = webUrl(tags.website ?? tags["contact:website"]);
  if (site) p.website = site;
  const diff = tags["piste:difficulty"] ?? tags.sac_scale;
  if (diff) p.difficulty = clip(diff, 30)!;
  return p;
}

/**
 * Reads Overpass answers back into places of the asked sets (an element can belong to several: a sports centre
 * with a pool and a gym). A route comes as its tags, then one of its ways inside the box (its position). Bike
 * paths of the same name and set are merged into one, their lengths added.
 */
export function readOverpass(body: { elements?: OverpassEl[] }, sets: readonly PlaceSet[]): Place[] {
  const out: Place[] = [];
  const lines = new Map<string, Place>();
  const els = body.elements ?? [];
  for (let i = 0; i < els.length; i++) {
    const el = els[i]!;
    const tags = el.tags ?? {};
    let type: "n" | "w" | "r";
    let shape: PlaceShape;
    let pos: OverpassEl = el;
    if (el.type === "route") {
      // Its position: the next element when it's the way that follows it (no tags, a centre).
      const next = els[i + 1];
      if (!next || next.type !== "way" || next.tags || !next.center) continue;
      i++;
      pos = next;
      type = "r";
      shape = "route";
    } else if (el.type === "line") {
      type = "w";
      shape = "line";
    } else {
      const t = OSM_TYPE[el.type];
      if (!t || !el.tags) continue;
      type = t;
      shape = "point";
    }
    for (const set of sets) {
      if (set.shape !== shape || !inPlaceSet(set, type, tags)) continue;
      const p = toPlace({ ...pos, id: el.id }, set, type, tags);
      if (!p) continue;
      if (set.shape === "line" && p.name) {
        const key = `${set.id}|${p.name.toLowerCase()}`;
        const prev = lines.get(key);
        if (prev) {
          prev.lengthM = (prev.lengthM ?? 0) + (p.lengthM ?? 0);
          continue;
        }
        lines.set(key, p);
      }
      out.push(p);
    }
  }
  return out;
}

// ── Distances, bearings, hours ──────────────────────────────────────────────────────────────────────────────

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
export const compassPoint = (deg: number, lang: "en" | "fr" = "en") => COMPASS[lang][Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;

/** A place's shown name: its own, else "Tennis court", "Pool"… */
export function placeTitle(p: Pick<Place, "name" | "kind" | "sport">, lang: "en" | "fr" = "en"): string {
  if (p.name) return p.name;
  const k = PLACE_KINDS[p.kind];
  if ((p.kind === "court" || p.kind === "pitch") && p.sport) {
    const first = p.sport.split(";")[0]!;
    const sp = SPORT_WORDS[first];
    if (sp) return lang === "fr" ? `${k.fr} de ${sp.fr}` : `${sp.en} ${p.kind}`;
  }
  return k[lang];
}

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

/** "450 m", "3.2 km" (metric) or "0.3 mi" (imperial). */
export function formatPlaceDistance(m: number, units: "metric" | "imperial" = "metric", lang: "en" | "fr" = "en"): string {
  const dec = (x: number) => (lang === "fr" ? String(x).replace(".", ",") : String(x));
  if (units === "imperial") {
    const mi = m / 1609.344;
    return `${dec(mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi))} mi`;
  }
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${dec(m < 10_000 ? Math.round(m / 100) / 10 : Math.round(m / 1000))} km`;
}

/** Sorted by distance from the device's own fix, inside the radius, without near duplicates (same name < 150 m). */
export function nearestPlaces(
  places: readonly Place[],
  at: { lat: number; lon: number },
  radiusKm: number,
  max = 60,
): (Place & { distanceM: number; bearing: number })[] {
  const out: (Place & { distanceM: number; bearing: number })[] = [];
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

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

/**
 * Open right now, from the common shapes of `opening_hours` ("24/7"; "Mo-Fr 06:00-22:00; Sa,Su 08:00-20:00";
 * "06:00-23:00"; "off"). Anything else (public holidays, months, sunrise…) → null: shown as tagged, never guessed.
 * Our own small reader (opening_hours.js is LGPL, not used).
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
    const m =
      /^(?:((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+)?(off|closed|(?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?)(?:,\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?)*)$/.exec(
        rule,
      );
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

// ── Directions ──────────────────────────────────────────────────────────────────────────────────────────────

/** Directions in the phone's maps app (deep links: nothing is sent by VVake). Walking for short hops. */
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

// ── "Where can I swim near me?" ─────────────────────────────────────────────────────────────────────────────

const NEAR_EN = [
  "near me",
  "nearby",
  "near here",
  "around me",
  "around here",
  "close to me",
  "close by",
  "closest",
  "nearest",
  "in my area",
  "near my place",
  "near my home",
  "near home",
  "around my place",
];
const NEAR_FR = [
  "pres de moi",
  "pres d ici",
  "pres de chez moi",
  "autour de moi",
  "autour d ici",
  "a proximite",
  "pas loin",
  "dans le coin",
  "dans mon quartier",
  "le plus proche",
  "la plus proche",
  "les plus proches",
  "aux alentours",
  "dans les environs",
  "proche de moi",
];
const WHERE_EN = [
  "where can i",
  "where could i",
  "where should i",
  "where do i",
  "where to",
  "where is",
  "where s",
  "where are",
  "any place to",
  "a place to",
  "a spot to",
  "places to",
  "spots to",
  "find a",
  "find me",
  "good spot",
  "good place",
];
const WHERE_FR = [
  "ou puis je",
  "ou est ce que je peux",
  "ou je peux",
  "ou pourrais je",
  "ou aller",
  "ou faire",
  "ou trouver",
  "ou est",
  "ou sont",
  "ou y a t il",
  "un endroit pour",
  "un coin pour",
  "un spot pour",
  "un lieu pour",
  "trouve moi",
  "trouver un",
  "trouver une",
  "des endroits",
];

let SPORT_PHRASES: { phrase: string; key: string }[] | null = null;
function sportPhrases() {
  if (SPORT_PHRASES) return SPORT_PHRASES;
  const list: { phrase: string; key: string }[] = [];
  for (const s of SPORT_CATALOG) {
    for (const w of [...s.words.en, ...s.words.fr, ...s.verbs.en, ...s.verbs.fr, s.name.en, s.name.fr]) {
      const n = normalizeVoice(w);
      if (n.length >= 3) list.push({ phrase: n, key: s.key });
    }
  }
  // Place words that say the sport ("a pool" = swim, "a court" alone says nothing).
  const extra: [string, string][] = [
    ["pool", "swim"],
    ["piscine", "swim"],
    ["swimming pool", "swim"],
    ["beach", "swim"],
    ["plage", "swim"],
    ["baignade", "swim"],
    ["trail", "hike"],
    ["trails", "hike"],
    ["sentier", "hike"],
    ["sentiers", "hike"],
    ["rando", "hike"],
    ["randonnee", "hike"],
    ["gym", "strength"],
    ["salle de sport", "strength"],
    ["salle de muscu", "strength"],
    ["tennis court", "tennis"],
    ["court de tennis", "tennis"],
    ["padel", "padel"],
    ["bike path", "ride"],
    ["piste cyclable", "ride"],
    ["running track", "track-field"],
    ["piste d athletisme", "track-field"],
    ["climbing gym", "climbing"],
    ["salle d escalade", "climbing"],
    ["crag", "climbing"],
    ["bloc", "climbing"],
    ["skatepark", "skate"],
    ["patinoire", "skate"],
  ];
  for (const [p, k] of extra) list.push({ phrase: p, key: k });
  list.sort((a, b) => b.phrase.length - a.phrase.length);
  SPORT_PHRASES = list;
  return list;
}

const hasPhrase = (text: string, p: string) => ` ${text} `.includes(` ${p} `);

/** The sport named in a sentence (longest phrase wins), or null. */
export function sportInText(text: string): string | null {
  const n = normalizeVoice(text);
  for (const { phrase, key } of sportPhrases()) if (hasPhrase(n, phrase)) return key;
  return null;
}

/**
 * "Where can I swim near me?", "any tennis courts nearby", "où courir près de chez moi" → { sport } (null sport: the
 * question is about places but names no sport: the app uses today's sport). Not a places question → null.
 */
export function placesQuestion(text: string): { sport: string | null } | null {
  const n = normalizeVoice(text);
  if (!n) return null;
  const near = [...NEAR_EN, ...NEAR_FR].some((p) => hasPhrase(n, p));
  const where = [...WHERE_EN, ...WHERE_FR].some((p) => hasPhrase(n, p) || n.startsWith(`${p} `));
  const sport = sportInText(n);
  // "near me" is enough; "where can I swim" too (a sport and a where); "where should I go today" isn't.
  if (near || (where && sport)) return { sport };
  return null;
}
