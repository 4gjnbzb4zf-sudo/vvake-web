import { describe, expect, it } from "vitest";
import { getWebAppDict } from "@/i18n/webapp";
import { buildHeaders, headersProblems, WEB_APP_PERMISSIONS } from "@/lib/cloudflareHeaders";
import { buildCsp, MAP_ORIGIN, parseCsp, webAppFile } from "@/lib/csp";
import { TOUR_SECTIONS } from "@/lib/routes";
import { parseRoute, routeHash } from "@/components/webapp/AppContext";
import { cueAllowed, cueText } from "./voice";

const cfg = { apiUrl: "https://api.example", rpcUrl: "", waitlistEndpoint: "", liveEndpoint: "", turnstileSiteKey: "" };

describe("the web app on the site", () => {
  it("allows the map tiles on the web app's pages only", () => {
    expect(webAppFile("en/app/index.html")).toBe(true);
    expect(webAppFile("fr/app/index.html")).toBe(true);
    expect(webAppFile("en/tour/index.html")).toBe(false);
    const app = parseCsp(buildCsp([], cfg, [MAP_ORIGIN]));
    const other = parseCsp(buildCsp([], cfg));
    expect(app["connect-src"]).toContain(MAP_ORIGIN);
    expect(other["connect-src"]).not.toContain(MAP_ORIGIN);
    // No blob: worker, no wider images: the map's worker is served from 'self'.
    expect(app["img-src"]).toEqual(["'self'", "data:"]);
    expect(app["default-src"]).toEqual(["'self'"]);
  });
  it("Cloudflare: the web app gets geolocation, microphone, Bluetooth and the wake lock; the rest of the site doesn't", () => {
    const text = buildHeaders([{ file: "en/app/index.html", html: "<head></head>" }]);
    expect(text).toContain("/en/app/*\n  ! Permissions-Policy\n  Permissions-Policy: " + WEB_APP_PERMISSIONS);
    expect(WEB_APP_PERMISSIONS).toContain("geolocation=(self)");
    expect(WEB_APP_PERMISSIONS).toContain("bluetooth=(self)");
    expect(text.split("\n").find((l) => l.includes("Permissions-Policy:") && l.includes("geolocation=()"))).toBeTruthy();
    expect(headersProblems(text)).toEqual([]);
  });
  it("old links to the tour's sections are recognised (they lived at /<lang>/app/#…)", () => {
    expect(TOUR_SECTIONS).toContain("coach");
    expect(TOUR_SECTIONS).toContain("screens");
    expect(TOUR_SECTIONS).not.toContain("vvaker");
  });
  it("hash routes", () => {
    expect(parseRoute("#/coach")).toEqual({ name: "coach" });
    expect(parseRoute("#/session/abc-1")).toEqual({ name: "session", id: "abc-1" });
    expect(parseRoute("#coach")).toEqual({ name: "coach" });
    expect(parseRoute("")).toEqual({ name: "today" });
    expect(parseRoute("#/nope")).toEqual({ name: "today" });
    expect(parseRoute("#/points")).toEqual({ name: "points" });
    expect(routeHash({ name: "points" })).toBe("#/points");
    expect(routeHash({ name: "session", id: "a b" })).toBe("#/session/a%20b");
    expect(parseRoute("#/places/swim")).toEqual({ name: "places", sport: "swim" });
    expect(parseRoute("#/places")).toEqual({ name: "places" });
    expect(parseRoute("#/places/<x>")).toEqual({ name: "places" });
    expect(routeHash({ name: "places", sport: "track-field" })).toBe("#/places/track-field");
  });
  it("custom training routes (ADR-0047): run, page, builder, teach, creator", () => {
    expect(parseRoute("#/train/abcd2345")).toEqual({ name: "train", ref: "ABCD2345" });
    expect(parseRoute("#/train/ABCD2345/wxyz2345")).toEqual({ name: "train", ref: "ABCD2345", challenge: "WXYZ2345" });
    expect(parseRoute("#/training/t_abcdefghij")).toEqual({ name: "training", ref: "t_abcdefghij" });
    expect(parseRoute("#/training/ABCD0345")).toEqual({ name: "trainings" });
    expect(parseRoute("#/build/t_abcdefghij")).toEqual({ name: "build", id: "t_abcdefghij" });
    expect(parseRoute("#/build")).toEqual({ name: "build" });
    expect(parseRoute("#/teach")).toEqual({ name: "teach" });
    expect(parseRoute("#/coach-profile")).toEqual({ name: "coach-profile" });
    expect(parseRoute("#/creator/Sam_Fit")).toEqual({ name: "creator", handle: "sam_fit" });
    for (const r of [
      { name: "train", ref: "ABCD2345", challenge: "WXYZ2345" },
      { name: "training", ref: "t_abcdefghij" },
      { name: "build", id: "t_abcdefghij" },
      { name: "creator", handle: "sam_fit" },
      { name: "trainings" },
    ] as const)
      expect(parseRoute(routeHash(r))).toEqual(r);
  });
});

describe("voice cues, EN and FR (the apps' words)", () => {
  it("says the start, zones, splits and the end", () => {
    expect(cueText.start("en", "Nova", "Run")).toBe("Let's go Nova! Run. Warm up easy for the first few minutes.");
    expect(cueText.start("en", "", "Run")).toBe("Let's go! Run. Warm up easy for the first few minutes.");
    expect(cueText.zone("fr", 2)).toBe("Zone 2. Facile et régulier, tu pourrais tenir une conversation.");
    expect(cueText.split("en", 1, "5:10", false)).toBe("1 kilometre. Time 5:10. Keep moving.");
    expect(cueText.split("fr", 3, "16:02", true)).toBe("3 miles. Temps : 16:02. Continue.");
    expect(cueText.minutes("en", 10, 0)).toBe("10 minutes in. Nice work.");
    expect(cueText.done("fr", 0)).toBe("Séance terminée : 1 minutes. Beau travail, à la prochaine !");
  });
  it("quiet says only zone 5", () => {
    expect(cueAllowed("quiet", "zone", 4)).toBe(false);
    expect(cueAllowed("quiet", "zone", 5)).toBe(true);
    expect(cueAllowed("quiet", "split")).toBe(false);
    expect(cueAllowed("normal", "split")).toBe(true);
  });
  it("French and English have the same keys (type-checked) and no empty strings", () => {
    const walk = (o: unknown): string[] =>
      typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(walk) : o && typeof o === "object" ? Object.values(o).flatMap(walk) : [];
    for (const l of ["en", "fr"] as const) expect(walk(getWebAppDict(l)).every((s) => s.trim().length > 0)).toBe(true);
  });
});
