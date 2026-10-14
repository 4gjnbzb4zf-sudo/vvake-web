import { describe, expect, it } from "vitest";
import { clashClock, formatCountdown, formatScore, readClashFeed, serverOffset, sortClashes, tugShare, type Clash } from "./clashes";

const T0 = Date.parse("2026-10-14T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3_600_000;

const clash = (id: string, status: Clash["status"], startsAt: number, endsAt: number): Clash => ({
  id,
  status,
  a: { city: "Testville", score: 1, startsAt: iso(startsAt), endsAt: iso(endsAt) },
  b: { city: "Sampleton", score: 2, startsAt: iso(startsAt), endsAt: iso(endsAt) },
  startsAt: iso(startsAt),
  endsAt: iso(endsAt),
  durationHours: 12,
});

describe("countdown and server offset", () => {
  it("formats h:mm:ss, days past 24 h, never negative", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(11 * H + 59 * 60_000 + 7_900)).toBe("11:59:07");
    expect(formatCountdown(51 * H)).toBe("2 d 03:00:00");
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });
  it("measures the server clock against the browser clock", () => {
    expect(serverOffset(iso(T0), T0 - 90_000)).toBe(90_000);
    expect(serverOffset(iso(T0), T0 + 2_000)).toBe(-2_000);
  });
  it("reads the offset from serverNow, 0 without it", () => {
    expect(readClashFeed({ clashes: [], serverNow: iso(T0) }, T0 - 4_000).offsetMs).toBe(4_000);
    expect(readClashFeed({ clashes: [] }, T0).offsetMs).toBe(0);
    expect(readClashFeed({ clashes: [], serverNow: "nope" }, T0).offsetMs).toBe(0);
  });
  it("counts to the overall end when live, to the start when upcoming, and says results soon when provisional", () => {
    expect(clashClock(clash("1", "live", T0 - H, T0 + 2 * H), T0)).toEqual({ kind: "endsIn", ms: 2 * H });
    expect(clashClock(clash("2", "buildup", T0 + 3 * H, T0 + 15 * H), T0)).toEqual({ kind: "startsIn", ms: 3 * H });
    expect(clashClock(clash("3", "provisional", T0 - 13 * H, T0 - H), T0)).toEqual({ kind: "resultsSoon" });
    expect(clashClock(clash("4", "live", T0 - 13 * H, T0 - H), T0)).toEqual({ kind: "endsIn", ms: 0 });
  });
});

describe("feed parsing and ordering", () => {
  it("orders live, then provisional, then upcoming", () => {
    const list = [
      clash("up-late", "buildup", T0 + 5 * H, T0 + 17 * H),
      clash("prov", "provisional", T0 - 13 * H, T0 - H),
      clash("up-soon", "buildup", T0 + H, T0 + 13 * H),
      clash("live-late", "live", T0 - H, T0 + 11 * H),
      clash("live-soon", "live", T0 - 10 * H, T0 + 2 * H),
    ];
    expect(sortClashes(list).map((c) => c.id)).toEqual(["live-soon", "live-late", "prov", "up-soon", "up-late"]);
  });
  it("drops malformed and duplicate clashes, unknown statuses, and caps the list at 20", () => {
    const good = clash("ok", "live", T0 - H, T0 + H);
    const feed = readClashFeed(
      {
        clashes: [
          good,
          good,
          { ...good, id: "bad-status", status: "finished" },
          { ...good, id: "no-city", a: { city: "  ", score: 1 } },
          { ...good, id: "bad-date", endsAt: "soon" },
          null,
          ...Array.from({ length: 30 }, (_, i) => clash(`b${i}`, "buildup", T0 + (i + 1) * H, T0 + (i + 13) * H)),
        ],
      },
      T0,
    );
    expect(feed.clashes).toHaveLength(20);
    expect(feed.clashes[0]!.id).toBe("ok");
    expect(feed.clashes.some((c) => c.id.startsWith("bad") || c.id === "no-city")).toBe(false);
  });
  it("treats an unusable answer as no clash", () => {
    expect(readClashFeed(null, T0).clashes).toEqual([]);
    expect(readClashFeed({ clashes: "x" }, T0).clashes).toEqual([]);
  });
  it("clamps bad scores to zero", () => {
    const c = { ...clash("s", "live", T0, T0 + H), a: { city: "Testville", score: -3 }, b: { city: "Sampleton", score: "9" } };
    const [read] = readClashFeed({ clashes: [c] }, T0).clashes;
    expect(read!.a.score).toBe(0);
    expect(read!.b.score).toBe(0);
  });
});

describe("tug bar and scores", () => {
  it("splits by score, evenly at zero", () => {
    expect(tugShare(0, 0)).toBe(0.5);
    expect(tugShare(3, 1)).toBe(0.75);
    expect(tugShare(0, 4)).toBe(0);
  });
  it("shows one decimal in the visitor's language", () => {
    expect(formatScore(12.44, "en")).toBe("12.4");
    expect(formatScore(9.8, "fr")).toBe("9,8");
    expect(formatScore(3, "en")).toBe("3.0");
  });
});
