import { describe, expect, it } from "vitest";
import { CameraHeart, clockText, holdText } from "./cameraHeart";
import { bigNumberFallback, bigNumberPx, hasStrapHeart, middleFitPx, pointsKind, shortScreenCap, zoneBars, zoneTone } from "./webHeart";
import { zoneOf } from "../heart";

/** About 0.8 em a digit in the display font: what a size gives as a width (the colon and "s" narrower). */
const widthAt = (text: string, px: number) => [...text].reduce((a, ch) => a + (ch === ":" ? 0.4 : ch === "s" ? 0.7 : 0.8), 0) * px;

describe("big numbers on one line", () => {
  it("m:ss and 45s, never seconds that wrap", () => {
    expect(clockText(65_000)).toBe("1:05");
    expect(clockText(600_000)).toBe("10:00");
    expect(holdText(45)).toBe("45s");
    expect(holdText(65)).toBe("1:05");
  });
  it("fits 320 and 360 px windows (and 200 % zoom: 160 px)", () => {
    for (const w of [160, 296, 336, 1200]) {
      for (const text of ["3", "12", "100", "45s", "1:05", "10:00"]) {
        const px = bigNumberPx(text, w, { small: 144, large: 192 })!;
        expect(px).toBeGreaterThanOrEqual(40);
        expect(px).toBeLessThanOrEqual(w >= 600 ? 192 : 144);
        if (w >= 296) expect(widthAt(text, px)).toBeLessThanOrEqual(w);
      }
    }
    expect(bigNumberPx("1:05", 0, { small: 144, large: 192 })).toBeNull();
    expect(bigNumberFallback("10:00", 176)).toMatch(/^clamp\(40px, [\d.]+vw, 176px\)$/);
  });
});

describe("the strap's heart on the camera screen", () => {
  const p = { age: 35, restingHr: 60 };
  it("zones from your heart, lost after 15 s, effort for the summary", () => {
    const h = new CameraHeart((b) => zoneOf(b, p));
    expect(h.signal(0)).toBe("none");
    for (let i = 0; i <= 10; i++) h.push("strap", 150, i * 1000);
    expect(h.now(10_000)).toMatchObject({ bpm: 150, source: "strap", zone: zoneOf(150, p) });
    expect(h.signal(30_000)).toBe("lost");
    const s = h.stats()!;
    expect(s).toMatchObject({ source: "strap", avgBpm: 150, maxBpm: 150 });
    const bars = zoneBars(s);
    expect(bars).toHaveLength(5);
    expect(bars.find((b) => b.zone === zoneOf(150, p))?.share).toBe(1);
    expect(zoneBars(null)).toEqual([]);
    expect(zoneTone(9)).toContain("bg-pulse");
  });
  it("heart points with two samples or more, else camera points", () => {
    expect(hasStrapHeart([{ bpm: 120 }])).toBe(false);
    expect(pointsKind([{ bpm: 120 }, {}, { bpm: 121 }])).toBe("heart");
    expect(pointsKind([])).toBe("camera");
  });
});

describe("shortScreenCap", () => {
  it("leaves tall screens alone (375×812 and up)", () => {
    expect(shortScreenCap(160, 812)).toBe(160);
    expect(shortScreenCap(160, 0)).toBe(160);
  });
  it("fits the big number to a short screen (320×640), never under 72 px", () => {
    expect(shortScreenCap(144, 640)).toBe(109);
    expect(shortScreenCap(144, 360)).toBe(72);
    expect(shortScreenCap(60, 640)).toBe(60);
  });
});

describe("middleFitPx", () => {
  it("fits the number in the middle's height less its lines, never under 56 px", () => {
    expect(middleFitPx(0, 130)).toBeNull();
    expect(middleFitPx(300, 130)).toBe(170);
    expect(middleFitPx(150, 130)).toBe(56);
  });
});
