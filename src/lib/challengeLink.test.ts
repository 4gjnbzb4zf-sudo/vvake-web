import { describe, expect, it } from "vitest";
import {
  challengeAppUrl,
  challengeRedirect,
  clock,
  countdown,
  km,
  parseChallengeCode,
  prettyChallengeCode,
  readPreview,
  readTarget,
  takeable,
  targetResult,
  targetTitle,
} from "./challengeLink";

describe("challenge links", () => {
  it("reads a code from a hash or a path, case-insensitively", () => {
    expect(parseChallengeCode("#abcd2345")).toBe("ABCD2345");
    expect(parseChallengeCode("/c/ABCD2345/")).toBe("ABCD2345");
    expect(parseChallengeCode("")).toBeNull();
    expect(parseChallengeCode("#ABCD0123")).toBeNull(); // 0 and 1 aren't in the alphabet
    expect(parseChallengeCode("#<script>")).toBeNull();
  });

  it("sends /c/<code> to the localized fallback page, nothing else", () => {
    expect(challengeRedirect("/c/abcd2345", "fr")).toBe("/fr/c/#ABCD2345");
    expect(challengeRedirect("/c/ABCD2345/", "en")).toBe("/en/c/#ABCD2345");
    expect(challengeRedirect("/en/missing/", "en")).toBeNull();
    expect(challengeRedirect("/c/", "en")).toBeNull();
  });

  it("builds the app's custom-scheme link", () => {
    expect(challengeAppUrl("vvake", "ABCD2345")).toBe("vvake://c/ABCD2345");
  });
});

describe("24-hour challenge links", () => {
  const api = {
    code: "ABCD2345",
    from: { name: "Ana", castId: "VV-000-0000-00-0" },
    displayName: "Ana",
    kind: "target",
    metric: "distance",
    windowHours: 24,
    status: "open",
    expiresAt: "2026-10-13T08:00:00.000Z",
    target: { kind: "time", sport: "run", distanceM: 5000, timeS: 1450 },
    open: true,
    participants: { accepted: 3, won: 1, racing: 1 },
    board: [
      { name: "Ben", status: "won", best: 1438 },
      { name: "<b>x</b>".repeat(30), status: "nope" },
    ],
    hidden: 2,
  };

  it("reads the preview: the sender (from, or displayName from older APIs), the mark, the board", () => {
    const p = readPreview(api)!;
    expect(p).toMatchObject({
      name: "Ana",
      castId: "VV-000-0000-00-0",
      status: "open",
      open: true,
      hidden: 2,
      participants: { accepted: 3, won: 1, racing: 1 },
    });
    expect(p.target).toEqual({ kind: "time", sport: "run", distanceM: 5000, timeS: 1450 });
    expect(p.board).toEqual([{ name: "Ben", status: "won", best: 1438 }]); // unknown status dropped
    expect(readPreview({ displayName: "Old", metric: "minutes", windowHours: 72 })).toMatchObject({
      name: "Old",
      hours: 72,
      target: null,
      open: false,
    });
    expect(readPreview({ from: {} })).toBeNull();
    expect(readPreview("nope")).toBeNull();
    expect(readTarget({ kind: "time", distanceM: 5000 })).toBeNull();
    expect(readTarget({ kind: "minutes", minutes: 30, sport: "yoga" })).toEqual({ kind: "minutes", minutes: 30, sport: "yoga" });
  });

  it("writes the mark like the app, EN/FR", () => {
    expect(targetTitle({ kind: "time", sport: "run", distanceM: 5000, timeS: 1450 }, "en")).toBe("Beat 5 km in 24:10");
    expect(targetTitle({ kind: "ghost", sport: "run", distanceM: 10_500, timeS: 3725 }, "fr")).toBe("Bats 10,5 km en 1:02:05");
    expect(targetTitle({ kind: "distance", sport: "ride", distanceM: 40_000 }, "fr")).toBe("Roule 40 km");
    expect(targetTitle({ kind: "minutes", minutes: 30 }, "en")).toBe("30 active minutes");
    expect(targetResult({ kind: "time", distanceM: 5000, timeS: 1450 }, 1438, "en")).toBe("23:58");
    expect(targetResult({ kind: "minutes", minutes: 30 }, undefined, "en")).toBeNull();
    expect(clock(59)).toBe("0:59");
    expect(km(5250, "en")).toBe("5.3 km");
  });

  it("counts down the time left to accept, and knows when the link is over", () => {
    expect(countdown(24 * 3_600_000)).toBe("1 d 00:00:00");
    expect(countdown(3_661_000)).toBe("01:01:01");
    expect(countdown(-5)).toBe("00:00:00");
    const exp = Date.parse(api.expiresAt);
    expect(takeable({ status: "open", expiresAt: api.expiresAt }, exp - 1)).toBe(true);
    expect(takeable({ status: "open", expiresAt: api.expiresAt }, exp)).toBe(false);
    expect(takeable({ status: "accepted", expiresAt: api.expiresAt }, 0)).toBe(false);
    expect(prettyChallengeCode("ABCD2345")).toBe("ABCD-2345");
  });
});
