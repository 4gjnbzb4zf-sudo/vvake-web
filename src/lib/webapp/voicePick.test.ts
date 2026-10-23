import { describe, expect, it } from "vitest";
import { buildCsp, cspProblems, injectCsp, parseCsp, webAppMedia } from "@/lib/csp";
import { VOICE_PATH } from "@/lib/rewardsApi";
import { cueSpoken } from "./voice";
import { bestBrowserVoice, paceBucket, splitLines, voiceGenderScore, voiceMode, voiceRank, zonePack, type BrowserVoice } from "./voicePick";

const v = (name: string, lang: string, localService = true, isDefault = false): BrowserVoice => ({
  name,
  lang,
  localService,
  default: isDefault,
});

describe("which voice", () => {
  it("the account's coach voice by default, the device voice when chosen, nothing with the toggle off", () => {
    expect(voiceMode(true, undefined)).toBe("coach");
    expect(voiceMode(true, "coach")).toBe("coach");
    expect(voiceMode(true, "device")).toBe("device");
    expect(voiceMode(false, "coach")).toBe("off");
  });
});

describe("what a cue plays", () => {
  it("fixed cues from the voice pack, as on the phone", () => {
    expect(cueSpoken.start("en", "Sam", "Running")).toEqual({
      text: "Let's go Sam! Running. Warm up easy for the first few minutes.",
      pack: "start",
    });
    expect(cueSpoken.zone("fr", 3).pack).toBe("zone3");
    expect(cueSpoken.paused("en").pack).toBe("paused");
    expect(cueSpoken.resumed("en").pack).toBe("resumed");
    expect(cueSpoken.energy("en").pack).toBe("energy");
    expect(cueSpoken.done("en", 32).pack).toBe("done");
    expect(zonePack(0)).toBeNull();
    expect(zonePack(6)).toBeNull();
  });
  it("splits from the cheer library, with the split's own time when it was recorded", () => {
    expect(splitLines(3, 314, false)).toEqual(["km.1:3", "km.pace:315"]);
    expect(splitLines(3, null, false)).toEqual(["km.1:3"]);
    expect(splitLines(51, 300, false)).toEqual(["km.next", "km.pace:300"]);
    expect(splitLines(55, 2000, false)).toEqual(["km.1:55"]);
    expect(splitLines(2, 600, true)).toEqual(["mi.1:2", "mi.pace:600"]);
    expect(splitLines(31, 120, true)).toEqual(["mi.next"]);
    expect(paceBucket(117, false)).toBe(null);
    expect(paceBucket(118, false)).toBe(120);
    expect(cueSpoken.split("en", 2, "10:30", false, 330)).toEqual({
      text: "2 kilometres. Time 10:30. Keep moving.",
      lib: ["km.1:2", "km.pace:330"],
    });
  });
  it("lines with exact numbers go to the API (no pack, no library)", () => {
    const m = cueSpoken.minutes("en", 10, 2);
    expect(m.text).toBe("10 minutes in, zone 2. Nice work.");
    expect(m.pack).toBeUndefined();
    expect(m.lib).toBeUndefined();
  });
});

describe("the browser voice, the fallback", () => {
  const mac = [
    v("Albert", "en-US"),
    v("Samantha", "en-US", true, true),
    v("Ava (Premium)", "en-US"),
    v("Zoe (Enhanced)", "en-US"),
    v("Google US English", "en-US", false),
    v("Daniel", "en-GB"),
    v("Thomas", "fr-FR"),
    v("Amélie (Enhanced)", "fr-CA"),
  ];
  it("Premium, then Enhanced/Natural, then Google, never a novelty voice", () => {
    expect(bestBrowserVoice(mac, "en-US")?.name).toBe("Ava (Premium)");
    expect(
      bestBrowserVoice(
        mac.filter((x) => !/Premium/.test(x.name)),
        "en-US",
      )?.name,
    ).toBe("Zoe (Enhanced)");
    expect(bestBrowserVoice([v("Samantha", "en-US"), v("Google US English", "en-US", false)], "en-US")?.name).toBe("Google US English");
    expect(bestBrowserVoice([v("Albert", "en-US")], "en-US")).toBeUndefined();
    expect(voiceRank(v("Microsoft Aria Online (Natural) - English (United States)", "en-US", false), true)).toBe(3);
  });
  it("offline: only local voices (a Google voice needs the network)", () => {
    expect(bestBrowserVoice([v("Samantha", "en-US"), v("Google US English", "en-US", false)], "en-US", false)?.name).toBe("Samantha");
  });
  it("the language first: another region of it before nothing", () => {
    expect(bestBrowserVoice(mac, "fr-FR")?.name).toBe("Amélie (Enhanced)");
    // Same quality: a woman's voice like the coach's, before the exact region.
    expect(bestBrowserVoice([v("Thomas", "fr-FR"), v("Amélie", "fr-CA")], "fr-FR")?.name).toBe("Amélie");
    expect(bestBrowserVoice([v("Thomas", "fr-FR"), v("Jacques", "fr-CA")], "fr-FR")?.name).toBe("Thomas");
    expect(bestBrowserVoice([v("Daniel", "en_GB")], "en-US")?.name).toBe("Daniel");
    expect(bestBrowserVoice([v("Daniel", "en-GB")], "fr-FR")).toBeUndefined();
  });
});

describe("the browser voice sounds like the coach (a woman's voice, voice-one)", () => {
  it("a woman's voice of the same quality before a man's, but never a worse one", () => {
    expect(bestBrowserVoice([v("Daniel (Enhanced)", "en-US"), v("Zoe (Enhanced)", "en-US")], "en-US")?.name).toBe("Zoe (Enhanced)");
    expect(bestBrowserVoice([v("Evan (Premium)", "en-US"), v("Samantha", "en-US")], "en-US")?.name).toBe("Evan (Premium)");
    expect(bestBrowserVoice([v("Thomas (Enhanced)", "fr-FR"), v("Audrey (Enhanced)", "fr-FR")], "fr-FR")?.name).toBe("Audrey (Enhanced)");
    expect(
      bestBrowserVoice(
        [
          v("Microsoft Guy Online (Natural) - English (United States)", "en-US", false),
          v("Microsoft Jenny Online (Natural) - English (United States)", "en-US", false),
        ],
        "en-US",
      )?.name,
    ).toMatch(/Jenny/);
  });
  it("Google's US English and French voices count as women's", () => {
    expect(voiceGenderScore({ name: "Google US English" })).toBe(2);
    expect(voiceGenderScore({ name: "Google français" })).toBe(2);
    expect(voiceGenderScore({ name: "Google UK English Male" })).toBe(0);
    expect(voiceGenderScore({ name: "Thomas" })).toBe(0);
    expect(voiceGenderScore({ name: "Unknown voice" })).toBe(1);
  });
});

describe("the voice's audio on the web app's pages", () => {
  const cfg = { apiUrl: "https://api.example/x", rpcUrl: "", waitlistEndpoint: "", liveEndpoint: "", turnstileSiteKey: "" };
  it("media-src allows blob: and the API on the web app only", () => {
    const app = parseCsp(buildCsp([], cfg, [], webAppMedia(cfg)));
    expect(app["media-src"]).toEqual(["'self'", "blob:", "https://api.example"]);
    expect(parseCsp(buildCsp([], cfg))["media-src"]).toBeUndefined();
    const ok = injectCsp("<html><head></head><body></body></html>", buildCsp([], cfg, [], webAppMedia(cfg)));
    expect(cspProblems(ok, cfg)).toEqual([]);
    const wide = injectCsp("<html><head></head><body></body></html>", buildCsp([], cfg, [], ["https://evil.example"]));
    expect(cspProblems(wide, cfg)).toContain("media-src is wider than 'self' blob: and the API");
  });
  it("only the API's voice paths are fetched with the token", () => {
    expect(VOICE_PATH.test("/v1/voice/0123456789abcdef0123456789abcdef.mp3")).toBe(true);
    expect(VOICE_PATH.test("/v1/voice/../me")).toBe(false);
    expect(VOICE_PATH.test("https://evil.example/v1/voice/0123456789abcdef0123456789abcdef.mp3")).toBe(false);
  });
});

describe("the browser voice is of the chosen coach's gender (ADR-0056)", () => {
  const en = [v("Zoe (Enhanced)", "en-US"), v("Daniel (Enhanced)", "en-GB"), v("Evan (Enhanced)", "en-US"), v("Samantha", "en-US")];
  const fr = [v("Audrey (Enhanced)", "fr-FR"), v("Thomas (Enhanced)", "fr-FR"), v("Amélie", "fr-CA")];
  it("a man's voice for the man's coach voice, a woman's for the woman's (the default)", () => {
    expect(bestBrowserVoice(en, "en-US", true, "male")?.name).toBe("Evan (Enhanced)");
    expect(bestBrowserVoice(en, "en-US", true, "female")?.name).toBe("Zoe (Enhanced)");
    expect(bestBrowserVoice(en, "en-US")?.name).toBe("Zoe (Enhanced)");
    expect(bestBrowserVoice(fr, "fr-FR", true, "male")?.name).toBe("Thomas (Enhanced)");
    expect(bestBrowserVoice(fr, "fr-FR", true, "female")?.name).toBe("Audrey (Enhanced)");
  });
  it("quality still comes first, and the same voices always give the same pick", () => {
    expect(bestBrowserVoice([v("Samantha (Premium)", "en-US"), v("Alex", "en-US")], "en-US", true, "male")?.name).toBe(
      "Samantha (Premium)",
    );
    const ties = [v("Unknown A", "en-US"), v("Unknown B", "en-US")];
    expect(bestBrowserVoice(ties, "en-US", true, "male")?.name).toBe("Unknown A");
    expect(bestBrowserVoice([...ties].reverse(), "en-US", true, "male")?.name).toBe("Unknown B");
    expect(
      bestBrowserVoice([v("Google UK English Male", "en-GB"), v("Google UK English Female", "en-GB")], "en-US", true, "male")?.name,
    ).toBe("Google UK English Male");
  });
  it("scores a name for the wanted gender", () => {
    expect(voiceGenderScore({ name: "Thomas" }, "male")).toBe(2);
    expect(voiceGenderScore({ name: "Google français" }, "male")).toBe(0);
    expect(voiceGenderScore({ name: "Unknown voice" }, "male")).toBe(1);
  });
});
