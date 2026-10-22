import { beforeEach, describe, expect, it } from "vitest";
import { resetVoiceTipForTests, takeVoiceTip, TIP_KEY, voicePlatform } from "./voiceTip";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("the 'get a better voice' tip", () => {
  beforeEach(() => resetVoiceTipForTests());

  it("shows once, then never again in this browser", () => {
    const s = memory();
    expect(takeVoiceTip(s)).toBe(true);
    expect(s.m.get(TIP_KEY)).toBe("1");
    expect(takeVoiceTip(s)).toBe(false);
    resetVoiceTipForTests(); // a new visit
    expect(takeVoiceTip(s)).toBe(false);
  });

  it("storage that throws (private mode): once per visit", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    };
    expect(takeVoiceTip(broken)).toBe(true);
    expect(takeVoiceTip(broken)).toBe(false);
  });

  it("no storage: once per visit", () => {
    expect(takeVoiceTip(null)).toBe(true);
    expect(takeVoiceTip(null)).toBe(false);
  });

  it("points to this device's voice settings", () => {
    expect(voicePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(voicePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios"); // iPadOS
    expect(voicePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("mac");
    expect(voicePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(voicePlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("android");
    expect(voicePlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });
});
