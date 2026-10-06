import { describe, expect, it } from "vitest";
import { regionOf } from "./accountPrefs";
import { visitorDatePrefs } from "./dates";
import { formatDate, formatDateTime, formatTime, type DateFormatPrefs } from "./datetime";

// Thursday 31 December 2026, 18:30 in Montréal: the same cases as the apps (game-core datetime.test.ts).
const NYE = "2026-12-31T23:30:00Z";
const tz = "America/Toronto";
const at = (lang: "en" | "fr", region: string, o: Partial<DateFormatPrefs> = {}): DateFormatPrefs => ({ lang, region, timeZone: tz, ...o });

describe("dates on the site read like the apps", () => {
  it("times and dates across locales", () => {
    expect(formatTime(NYE, at("en", "US"))).toBe("6:30 PM");
    expect(formatTime(NYE, at("en", "GB"))).toBe("18:30");
    expect(formatTime(NYE, at("fr", "CA"))).toBe("18 h 30");
    expect(formatDate(NYE, at("en", "CA"), "numeric")).toBe("2026-12-31");
    expect(formatDate(NYE, at("fr", "FR"), "medium")).toBe("31 déc. 2026");
    expect(formatDateTime(NYE, at("en", "US"), "short")).toBe("Dec 31, 6:30 PM");
  });
  it("the account's choices win over the browser's", () => {
    expect(formatTime(NYE, at("en", "US", { timeFormat: "24h" }))).toBe("18:30");
    expect(formatDate(NYE, at("en", "US", { dateFormat: "dmy" }), "numeric")).toBe("31/12/2026");
    const p = visitorDatePrefs("fr", { timeFormat: "12h", dateFormat: "ymd" });
    expect(p.timeFormat).toBe("12h");
    expect(p.dateFormat).toBe("ymd");
    expect(visitorDatePrefs("en", { timeFormat: "nonsense" }).timeFormat).toBeUndefined();
  });
  it("regionOf", () => {
    expect(regionOf("fr-CA")).toBe("CA");
    expect(regionOf("en")).toBeUndefined();
  });
});
