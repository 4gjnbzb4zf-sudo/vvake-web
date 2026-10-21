import { describe, expect, it } from "vitest";
import {
  browserKind,
  browserSupport,
  cameraSport,
  defaultEntry,
  deniedHelp,
  errorState,
  forCamera,
  initialState,
  OutlineClock,
  parseEntryChoices,
  parseOutlinePref,
  previewHint,
  Steady,
  withEntryChoice,
} from "./webSetup";
import { FRAMING_TEXT, FRAMING_TIP_TEXT } from "./cameraCues";

describe("camera entry", () => {
  it("offers the camera for the indoor sports it has a routine for", () => {
    for (const s of ["strength", "core", "hiit", "yoga", "flexibility", "pilates"]) expect(cameraSport(s)).toBe(s);
    for (const s of ["run", "mind-body", "swim", null]) expect(cameraSport(s)).toBeNull();
  });
  it("remembers the choice per sport, the camera by default", () => {
    const c = withEntryChoice(parseEntryChoices("{bad"), "yoga", "heart");
    expect(defaultEntry(c, "yoga")).toBe("heart");
    expect(defaultEntry(c, "core")).toBe("camera");
    expect(parseEntryChoices(JSON.stringify({ a: "camera", b: 3 }))).toEqual({ a: "camera" });
    expect(parseOutlinePref(null)).toBe(true);
    expect(parseOutlinePref("0")).toBe(false);
  });
});

describe("the camera step", () => {
  it("never leaves a blank screen", () => {
    expect(browserSupport({ secure: false, mediaDevices: true, wasm: true })).toBe("insecure");
    expect(browserSupport({ secure: true, mediaDevices: false, wasm: true })).toBe("unsupported");
    expect(initialState({ support: "ok", permission: null, cameras: 0 })).toBe("no_camera");
    expect(initialState({ support: "ok", permission: "denied", cameras: 1 })).toBe("denied");
    expect(initialState({ support: "ok", permission: "granted", cameras: 1 })).toBe("ready");
    expect(initialState({ support: "ok", permission: "prompt", cameras: null })).toBe("ask");
    expect(errorState({ name: "NotAllowedError" })).toBe("denied");
    expect(errorState({ name: "NotFoundError" })).toBe("no_camera");
    expect(errorState({ name: "NotReadableError" })).toBe("error");
    expect(errorState(new Error("x"))).toBe("error");
  });
  it("says where this browser's camera switch is", () => {
    const ua = {
      chrome: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
      edge: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0",
      safari: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15",
      ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1",
      firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      samsung: "Mozilla/5.0 (Linux; Android 15) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36",
    } as const;
    for (const [k, v] of Object.entries(ua)) expect(browserKind(v)).toBe(k);
    expect(deniedHelp("chrome", "en")).toMatch(/Chrome/);
    expect(deniedHelp("safari", "fr")).toMatch(/Safari/);
  });
  it("the preview hint: starting, no picture, nobody, then the framing guide", () => {
    expect(previewHint({ startedAt: null, lastFrameAt: null, lastPersonAt: null, frame: null, now: 0 }).kind).toBe("starting");
    expect(previewHint({ startedAt: 0, lastFrameAt: null, lastPersonAt: null, frame: null, now: 7000 }).kind).toBe("no_frames");
    expect(previewHint({ startedAt: 0, lastFrameAt: 6000, lastPersonAt: null, frame: null, now: 7000 }).kind).toBe("nobody");
    expect(previewHint({ startedAt: 0, lastFrameAt: 1000, lastPersonAt: null, frame: null, now: 2000 }).kind).toBe("framing");
  });
  it("a line changes once it held a second", () => {
    const s = new Steady<string>();
    expect(s.next("a", "a", 0)).toBe("a");
    expect(s.next("b", "b", 100)).toBe("a");
    expect(s.next("b", "b", 900)).toBe("a");
    expect(s.next("b", "b", 1100)).toBe("b");
  });
  it("framing lines talk about the camera, not the phone", () => {
    for (const lang of ["en", "fr"] as const) {
      for (const l of [...Object.values(FRAMING_TEXT), ...Object.values(FRAMING_TIP_TEXT)])
        expect(forCamera(l[lang], lang)).not.toMatch(/phone|téléphone/i);
    }
    expect(forCamera("Tilt the phone down a little, or step back.", "en")).toBe("Tilt the camera down a little, or step back.");
    expect(forCamera("Entre dans le cadre, à 2–3 m du téléphone.", "fr")).toBe("Entre dans le cadre, à 2–3 m de la caméra.");
  });
});

describe("the body outline", () => {
  it("shows 35 s once you're seen, fades, comes back on a tap or after being lost 5 s", () => {
    const o = new OutlineClock(true);
    expect(o.visible(0)).toBe(false);
    o.track(1000, true);
    expect(o.visible(35_000)).toBe(true);
    expect(o.visible(36_001)).toBe(false);
    o.show(40_000);
    expect(o.visible(74_000)).toBe(true);
    o.track(80_000, false);
    o.track(86_000, false);
    o.track(86_500, true);
    expect(o.visible(120_000)).toBe(true);
    o.setAuto(false, 121_000);
    expect(o.visible(121_000)).toBe(false);
    const off = new OutlineClock(false);
    off.track(0, true);
    expect(off.visible(1)).toBe(false);
    off.show(10);
    expect(off.leftS(10)).toBe(35);
  });
});
