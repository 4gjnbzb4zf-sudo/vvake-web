import { describe, expect, it } from "vitest";
import { sports } from "@/lib/sports";
import {
  bearingDeg,
  compassPoint,
  directionsUrl,
  fetchPlaces,
  formatPlaceDistance,
  kindName,
  kindsIn,
  nearestPlaces,
  openNow,
  osmUrl,
  parsePlacesAnswer,
  PLACE_SPORTS,
  placesAppPath,
  placesUrl,
  placeTitle,
  roundForPrivacy,
  type Place,
} from "./places";

const here = { lat: 45.50123, lon: -73.56789 };
/** A place `m` metres north of `here` (1° of latitude ≈ 111 195 m). */
const north = (id: string, m: number, extra: Partial<Place> = {}): Place => ({
  id,
  kind: "pool",
  lat: here.lat + m / 111_195,
  lon: here.lon,
  ...extra,
});

describe("privacy", () => {
  it("rounds the position to 2 decimals before it leaves the browser", () => {
    expect(roundForPrivacy(45.50123, -73.56789)).toEqual({ lat: 45.5, lon: -73.57 });
    const url = placesUrl("https://api.example/", { sport: "swim", ...here, radiusKm: 5 });
    expect(url).toBe("https://api.example/v1/places?sport=swim&lat=45.50&lon=-73.57&radius=5");
    expect(url).not.toContain("50123");
    expect(url).not.toContain("56789");
  });
  it("keeps the radius inside the API's 1–25 km", () => {
    expect(placesUrl("https://a", { sport: "run", ...here, radiusKm: 80 })).toContain("radius=25");
    expect(placesUrl("https://a", { sport: "run", ...here, radiusKm: 0 })).toContain("radius=1");
  });
});

describe("distances and directions", () => {
  it("sorts by exact distance, drops places outside the radius and near duplicates", () => {
    const list = nearestPlaces(
      [
        north("n3", 3000),
        north("n1", 400, { name: "Piscine A" }),
        north("n2", 450, { name: "Piscine A" }), // same name, 50 m away: one place
        north("n9", 9000),
        north("n1", 400), // the same element twice
      ],
      here,
      5,
    );
    expect(list.map((p) => p.id)).toEqual(["n1", "n3"]);
    expect(list[0]!.distanceM).toBe(400);
    expect(list[0]!.bearing).toBe(0);
  });
  it("gives a bearing and a compass point in each language", () => {
    expect(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBe(90);
    expect(compassPoint(225, "en")).toBe("SW");
    expect(compassPoint(225, "fr")).toBe("SO");
    expect(compassPoint(-10, "fr")).toBe("N");
    expect(compassPoint(290, "fr")).toBe("O");
  });
  it("formats distances like the apps", () => {
    expect(formatPlaceDistance(3, "metric")).toBe("10 m");
    expect(formatPlaceDistance(448)).toBe("450 m");
    expect(formatPlaceDistance(3240, "metric", "fr")).toBe("3,2 km");
    expect(formatPlaceDistance(12_400)).toBe("12 km");
    expect(formatPlaceDistance(500, "imperial")).toBe("0.3 mi");
  });
  it("links Apple Maps and Google Maps, walking for short hops", () => {
    expect(directionsUrl({ lat: 1, lon: 2, name: "Pool & Co" }, "apple", 800)).toBe(
      "https://maps.apple.com/?daddr=1,2&dirflg=w&q=Pool%20%26%20Co",
    );
    expect(directionsUrl({ lat: 1, lon: 2 }, "google", 5000)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=1,2&travelmode=driving",
    );
    expect(osmUrl("w456")).toBe("https://www.openstreetmap.org/way/456");
    expect(osmUrl("r7")).toBe("https://www.openstreetmap.org/relation/7");
  });
});

describe("names", () => {
  it("names a place by its own name, its sport or its kind", () => {
    expect(placeTitle({ name: "Centre Claude-Robillard", kind: "pool" }, "fr")).toBe("Centre Claude-Robillard");
    expect(placeTitle({ kind: "pitch", sport: "tennis;padel" }, "en")).toBe("Tennis pitch");
    expect(placeTitle({ kind: "court", sport: "basketball" }, "fr")).toBe("Terrain de basket");
    expect(placeTitle({ kind: "pool" }, "fr")).toBe("Piscine");
    expect(kindName("something_new", "fr")).toBe("Lieu");
  });
  it("counts the kinds for the filter chips, most frequent first", () => {
    expect(kindsIn([{ kind: "park" }, { kind: "track" }, { kind: "track" }])).toEqual([
      { kind: "track", n: 2 },
      { kind: "park", n: 1 },
    ]);
  });
  it("forwards /<lang>/app/places/?sport= to the web app's route", () => {
    expect(placesAppPath("fr", "swim")).toBe("/fr/app/#/places/swim");
    expect(placesAppPath("en", "nope")).toBe("/en/app/#/places");
    expect(placesAppPath("en", "<script>")).toBe("/en/app/#/places");
    expect(placesAppPath("en", null)).toBe("/en/app/#/places");
  });
  it("only lists sports of the catalog", () => {
    const keys = new Set(sports.sports.map((s) => s.key));
    for (const k of PLACE_SPORTS) expect(keys.has(k), k).toBe(true);
  });
});

describe("open now", () => {
  // 2026-10-21 is a Wednesday.
  const wed = (h: number, m = 0) => new Date(2026, 9, 21, h, m);
  it("reads the common shapes", () => {
    expect(openNow(undefined, wed(10))).toBeNull();
    expect(openNow("24/7", wed(3))).toBe(true);
    expect(openNow("Mo-Fr 06:00-22:00; Sa,Su 08:00-20:00", wed(10))).toBe(true);
    expect(openNow("Mo-Fr 06:00-22:00; Sa,Su 08:00-20:00", wed(22, 30))).toBe(false);
    expect(openNow("06:00-23:00", wed(5, 59))).toBe(false);
    expect(openNow("Sa,Su 08:00-20:00", wed(10))).toBe(false);
    expect(openNow("Mo-Su 07:00-12:00,14:00-21:00; We off", wed(10))).toBe(false);
  });
  it("follows hours past midnight from the day before", () => {
    expect(openNow("Tu 20:00-02:00", wed(1))).toBe(true);
    expect(openNow("Tu 20:00-02:00", wed(3))).toBe(false);
  });
  it("never guesses what it can't read", () => {
    expect(openNow("Mo-Fr 08:00-18:00; PH off", wed(10))).toBeNull();
    expect(openNow("sunrise-sunset", wed(10))).toBeNull();
  });
});

describe("the API's answer", () => {
  it("keeps good places and skips broken ones", () => {
    const a = parsePlacesAnswer(
      {
        sport: "swim",
        places: [
          { id: "n1", kind: "pool", lat: 45.5, lon: -73.6, name: "A", hours: null, lengthM: 25, indoor: true },
          { id: "x1", kind: "pool", lat: 45.5, lon: -73.6 },
          { id: "w2", kind: "beach", lat: 145, lon: -73.6 },
          { id: "w3", kind: "beach", lat: 45.51, lon: -73.61, surface: 42 },
        ],
        partial: true,
        radiusKm: 5,
      },
      "swim",
      5,
    );
    expect(a.places.map((p) => p.id)).toEqual(["n1", "w3"]);
    expect(a.places[0]).toEqual({ id: "n1", kind: "pool", lat: 45.5, lon: -73.6, name: "A", lengthM: 25, indoor: true });
    expect(a.places[1]!.surface).toBeUndefined();
    expect(a.partial).toBe(true);
    expect(parsePlacesAnswer(null, "run", 5)).toEqual({ sport: "run", places: [], partial: false, radiusKm: 5 });
  });

  const fake =
    (status: number, body: unknown, headers: Record<string, string> = {}) =>
    async (url: RequestInfo | URL, init?: RequestInit) => {
      fake.last = { url: String(url), init };
      return new Response(JSON.stringify(body), { status, headers });
    };
  fake.last = null as null | { url: string; init?: RequestInit };

  it("asks without credentials and reads a list", async () => {
    const r = await fetchPlaces(
      "https://api.example",
      { sport: "tennis", ...here, radiusKm: 5 },
      { fetchImpl: fake(200, { places: [{ id: "n5", kind: "court", lat: 45.5, lon: -73.57 }] }) },
    );
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.answer.places.length).toBe(1);
    expect(fake.last?.url).toContain("lat=45.50&lon=-73.57");
    expect(fake.last?.init?.credentials).toBe("omit");
  });
  it("says busy on a 503 with its retry-after", async () => {
    expect(
      await fetchPlaces(
        "https://a",
        { sport: "swim", ...here, radiusKm: 5 },
        { fetchImpl: fake(503, { error: "unavailable" }, { "retry-after": "45" }) },
      ),
    ).toEqual({ kind: "busy", retryAfterS: 45 });
    expect(
      await fetchPlaces("https://a", { sport: "swim", ...here, radiusKm: 5 }, { fetchImpl: fake(503, { error: "unavailable" }) }),
    ).toEqual({ kind: "busy", retryAfterS: 30 });
  });
  it("says error on anything else", async () => {
    expect(await fetchPlaces("https://a", { sport: "swim", ...here, radiusKm: 5 }, { fetchImpl: fake(400, {}) })).toEqual({
      kind: "error",
    });
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await fetchPlaces("https://a", { sport: "swim", ...here, radiusKm: 5 }, { fetchImpl: offline })).toEqual({ kind: "error" });
  });
});
