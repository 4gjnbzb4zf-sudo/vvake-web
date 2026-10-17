import { describe, expect, it } from "vitest";
import { heartEffort, heartProfileOf, parseHeartRate, usableBpm, zoneOf, zoneSeconds, zoneThresholds } from "./heart";

const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe("Heart Rate Measurement (0x2A37) packets", () => {
  it("reads a uint8 heart rate with no contact support", () => {
    expect(parseHeartRate(view([0x00, 72]))).toEqual({ bpm: 72, contact: null, rr: [] });
  });
  it("reads a uint16 heart rate (flag bit 0), little-endian", () => {
    expect(parseHeartRate(view([0x01, 0x2c, 0x01]))?.bpm).toBe(300);
  });
  it("reads sensor contact (bits 1–2)", () => {
    expect(parseHeartRate(view([0x06, 140]))?.contact).toBe(true);
    expect(parseHeartRate(view([0x04, 140]))?.contact).toBe(false);
  });
  it("reads energy expended (bit 3) and RR intervals (bit 4) in 1/1024 s", () => {
    const p = parseHeartRate(view([0x18, 150, 0x10, 0x00, 0x00, 0x04, 0x00, 0x02]));
    expect(p).toEqual({ bpm: 150, contact: null, energyKj: 16, rr: [1000, 500] });
  });
  it("reads RR after a uint16 heart rate", () => {
    const p = parseHeartRate(view([0x11, 0x80, 0x00, 0x00, 0x04]));
    expect(p?.bpm).toBe(128);
    expect(p?.rr).toEqual([1000]);
  });
  it("refuses a packet too short, and readings without skin contact or out of range", () => {
    expect(parseHeartRate(view([0x01, 0x40]))).toBeNull();
    expect(parseHeartRate(view([0x00]))).toBeNull();
    expect(usableBpm(parseHeartRate(view([0x04, 140])))).toBe(false);
    expect(usableBpm(parseHeartRate(view([0x00, 0])))).toBe(false);
    expect(usableBpm(parseHeartRate(view([0x06, 140])))).toBe(true);
  });
});

describe("zones, the apps' rule", () => {
  it("Karvonen on the stand-in heart (age 32, resting 58): max 185.6", () => {
    const p = heartProfileOf(null);
    expect(zoneThresholds(p)).toEqual([122, 135, 148, 161, 173]);
    expect(zoneOf(100, p)).toBe(0);
    expect(zoneOf(130, p)).toBe(1);
    expect(zoneOf(150, p)).toBe(3);
    expect(zoneOf(180, p)).toBe(5);
  });
  it("Gulati's max for women, a measured max when shared", () => {
    expect(zoneThresholds(heartProfileOf({ age: 40, sex: "female", restingHr: 60 }))[4]).toBe(
      Math.ceil(60 + 0.9 * (206 - 0.88 * 40 - 60) - 1e-9),
    );
    expect(zoneThresholds(heartProfileOf({ age: 40, restingHr: 60, maxHr: 200 }))).toEqual([130, 144, 158, 172, 186]);
  });
  it("your own zones for the sport (from the account) win, others' sports keep Karvonen", () => {
    const h = { age: 30, restingHr: 55, zones: { run: [110, 125, 140, 155, 170] } };
    expect(zoneOf(141, heartProfileOf(h, "run"))).toBe(3);
    expect(zoneThresholds(heartProfileOf(h, "ride"))).not.toEqual([110, 125, 140, 155, 170]);
    // Invalid thresholds (not increasing by 3+) are ignored.
    expect(heartProfileOf({ zones: { run: [110, 111, 140, 155, 170] } }, "run").zones).toBeUndefined();
  });
  it("seconds in each zone and the effort from 10-s samples (zone 5 pays like zone 4, gaps count nothing)", () => {
    const p = heartProfileOf(null);
    const samples = [
      { t: 0, bpm: 150 },
      { t: 10, bpm: 150 },
      { t: 20, bpm: 180 },
      { t: 30, bpm: 180 },
      { t: 100, bpm: 150 },
    ];
    expect(zoneSeconds(samples, p)).toEqual([0, 0, 20, 0, 10]);
    const e = heartEffort(samples, p);
    expect(e.activeMin).toBeCloseTo(0.5, 5);
    expect(e.effort).toBeCloseTo((20 / 60) * 3 + (10 / 60) * 4, 1);
    expect(heartEffort(samples, p, 0.25).activeMin).toBeCloseTo(0.25, 5);
  });
});
