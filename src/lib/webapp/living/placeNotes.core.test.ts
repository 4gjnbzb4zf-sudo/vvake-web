// Copied from VVFit packages/game-core/test/placeNotes.test.ts (55e30955 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
import { describe, expect, it } from "vitest";
import {
  aggregatePlaceNotes,
  checkPlaceNote,
  geohash,
  isUndocumentedPlace,
  osmPlaceKey,
  parsePlaceKey,
  placeAggregateLine,
  placeIdOfKey,
  placeKeyCenter,
  placeNoteAllowed,
  placeNoteProblemText,
  PLACE_NOTE_TAGS,
  PLACE_NOTE_TAG_TEXT,
  PLACE_NOTE_TEXT,
  pointPlaceKey,
  pointPlaceKeysNear,
  type PlaceNoteProblem,
  type PlaceNoteRow,
} from "./index";
import { distanceM } from "./location";

describe("place keys", () => {
  it("OSM ids from the places API or node/123 become osm:type/id; anything else is refused", () => {
    expect(osmPlaceKey("n123")).toBe("osm:node/123");
    expect(osmPlaceKey("w45")).toBe("osm:way/45");
    expect(osmPlaceKey("r7")).toBe("osm:relation/7");
    expect(osmPlaceKey("node/123")).toBe("osm:node/123");
    expect(osmPlaceKey("osm:way/9")).toBe("osm:way/9");
    for (const bad of ["x1", "n0", "n", "node/abc", "n12345678901234567", ""]) expect(osmPlaceKey(bad), bad).toBeNull();
    expect(placeIdOfKey("osm:node/123")).toBe("n123");
    expect(placeIdOfKey("gh:u0nd9hq")).toBeNull();
  });

  it("a spot OSM does not know: the geohash-7 cell (~150 m), its centre is the only coordinate", () => {
    const k = pointPlaceKey(45.52345, -73.58123);
    expect(k).toBe(`gh:${geohash(45.52345, -73.58123, 7)}`);
    expect(parsePlaceKey(k)).toEqual({ kind: "gh", hash: k.slice(3) });
    const c = placeKeyCenter(k)!;
    expect(distanceM(c, { lat: 45.52345, lon: -73.58123 })).toBeLessThan(110);
    // A step of ~50 m stays in the same cell or a neighbour: the key is the rounding.
    expect(placeKeyCenter("osm:node/1")).toBeNull();
    expect(parsePlaceKey("gh:u0nd9h")).toBeNull(); // 6 chars
    expect(parsePlaceKey("gh:u0nd9ha")).toBeNull(); // "a" is not geohash
  });
});

describe("checkPlaceNote", () => {
  const ok = { placeKey: "n123", sport: "hike", rating: 4, recommend: true };

  it("accepts a 3-tap note and cleans it", () => {
    const r = checkPlaceNote({ ...ok, tags: ["shade", "muddy", "shade"], text: "  Bring   water  " });
    expect(r).toEqual({
      ok: true,
      note: { placeKey: "osm:node/123", sport: "hike", rating: 4, recommend: true, tags: ["muddy", "shade"], text: "Bring water" },
    });
    const bare = checkPlaceNote({ ...ok, recommend: false });
    expect(bare.ok && bare.note).toMatchObject({ tags: [], text: null, recommend: false });
  });

  it("refuses bad places, sports, ratings, tags and text", () => {
    const p = (x: Partial<typeof ok> & { tags?: string[]; text?: string }) => {
      const r = checkPlaceNote({ ...ok, ...x });
      return r.ok ? null : r.problem;
    };
    expect(p({ placeKey: "home" })).toBe("place");
    expect(p({ sport: "Hike!" })).toBe("sport");
    expect(p({ rating: 0 })).toBe("rating");
    expect(p({ rating: 4.5 })).toBe("rating");
    expect(p({ rating: 6 })).toBe("rating");
    expect(p({ tags: ["wifi"] })).toBe("tags");
    expect(p({ tags: ["muddy", "steep", "shade", "quiet", "crowded"] })).toBe("tags");
    expect(p({ text: "x".repeat(81) })).toBe("too_long");
    expect(p({ text: "é".repeat(80) })).toBeNull();
    expect(p({ text: "see www.example.com" })).toBe("link");
    expect(p({ text: "call 06 12 34 56 78" })).toBe("contact");
    expect(p({ text: "earn tokens here" })).toBe("money");
    expect(p({ text: "merde alors" })).toBe("abuse");
  });

  it("every problem has EN and FR words", () => {
    const all: PlaceNoteProblem[] = [
      "place",
      "sport",
      "rating",
      "tags",
      "too_long",
      "empty",
      "link",
      "contact",
      "markup",
      "money",
      "abuse",
    ];
    for (const pr of all)
      for (const l of ["en", "fr"] as const) expect(placeNoteProblemText(pr, l).length, `${pr} ${l}`).toBeGreaterThan(3);
    for (const t of PLACE_NOTE_TAGS) expect(PLACE_NOTE_TAG_TEXT[t].fr && PLACE_NOTE_TAG_TEXT[t].en).toBeTruthy();
    for (const v of Object.values(PLACE_NOTE_TEXT)) expect(v.en && v.fr).toBeTruthy();
  });

  it("one note per person per place per 30 days", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    expect(placeNoteAllowed(null, now)).toBe(true);
    expect(placeNoteAllowed(now - 29 * 86_400_000, now)).toBe(false);
    expect(placeNoteAllowed(now - 30 * 86_400_000, now)).toBe(true);
  });
});

describe("aggregatePlaceNotes", () => {
  const n = (rating: number, recommend: boolean, tags: string[] = [], extra: Partial<PlaceNoteRow> = {}): PlaceNoteRow => ({
    rating,
    recommend,
    tags,
    ...extra,
  });

  it("nothing below 3 notes (an average of one or two could point at someone)", () => {
    expect(aggregatePlaceNotes("osm:node/1", [])).toBeNull();
    expect(aggregatePlaceNotes("osm:node/1", [n(5, true), n(4, true)])).toBeNull();
  });

  it("average, % recommend, tips as counts, approved text only (newest first), never who", () => {
    const a = aggregatePlaceNotes("osm:node/1", [
      n(5, true, ["muddy", "shade"], { id: "a1", text: "Go early", textStatus: "approved", atMs: 3 }),
      n(4, true, ["muddy"], { text: "pending one", textStatus: "pending", atMs: 4 }),
      n(3, false, ["muddy", "steep", "shade"], { text: "gone", textStatus: "hidden", atMs: 5 }),
      n(4, true, [], { text: "Nice loop", textStatus: "approved", atMs: 6 }),
    ])!;
    expect(a).toEqual({
      placeKey: "osm:node/1",
      count: 4,
      rating: 4,
      recommendPct: 75,
      tags: [
        { tag: "muddy", count: 3 },
        { tag: "shade", count: 2 },
        { tag: "steep", count: 1 },
      ],
      tips: [
        { id: null, text: "Nice loop" },
        { id: "a1", text: "Go early" },
      ],
    });
    expect(JSON.stringify(a)).not.toMatch(/user|author|track|lat|lon/);
    expect(JSON.stringify(a)).not.toContain("pending one");
    expect(JSON.stringify(a)).not.toContain("gone");
    expect(placeAggregateLine(a, "en")).toBe("4★ · 75% recommend · Muddy (3) · Shade (2)");
    expect(placeAggregateLine({ ...a, rating: 4.3 }, "fr", 1)).toBe("4,3★ · 75 % le recommandent · Boueux (3)");
  });
});

describe("pointPlaceKeysNear", () => {
  it("covers every cell within the radius (the point's own cell included)", () => {
    const keys = pointPlaceKeysNear(45.5, -73.6, 300);
    expect(keys).toContain(pointPlaceKey(45.5, -73.6));
    expect(keys).toContain(pointPlaceKey(45.50265, -73.6));
    expect(keys).toContain(pointPlaceKey(45.5, -73.6038));
    expect(keys.length).toBeGreaterThan(9);
    expect(keys.length).toBeLessThan(60);
  });
});

describe("isUndocumentedPlace", () => {
  const at = { lat: 45.5, lon: -73.6 };
  // ~0.0027° latitude ≈ 300 m
  const at250 = { lat: 45.50225, lon: -73.6 };
  const at400 = { lat: 45.5036, lon: -73.6 };

  it("new when nothing we know of is within 300 m", () => {
    expect(isUndocumentedPlace({ at, osm: [] })).toBe(true);
    expect(isUndocumentedPlace({ at, osm: [at400], publicSpots: [at400], savedSpots: [at400] })).toBe(true);
  });
  it("documented by an OSM spot of the sport, a public spot or a saved spot within 300 m", () => {
    expect(isUndocumentedPlace({ at, osm: [at250] })).toBe(false);
    expect(isUndocumentedPlace({ at, osm: [], publicSpots: [at250] })).toBe(false);
    expect(isUndocumentedPlace({ at, osm: [], savedSpots: [at250] })).toBe(false);
  });
});
