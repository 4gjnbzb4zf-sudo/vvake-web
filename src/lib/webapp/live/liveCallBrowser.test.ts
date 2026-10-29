import { describe, expect, it } from "vitest";
import { b64, liveFlagsFrom, toPcm16k } from "./liveCallBrowser";

describe("live call switch (GET /v1/health)", () => {
  it("is on only when the server says so; an older API is off", () => {
    expect(liveFlagsFrom({ features: { liveCall: true, onboardingCall: false } })).toEqual({ call: true, onboarding: false });
    expect(liveFlagsFrom({ features: { coach: true } })).toEqual({ call: false, onboarding: false });
    expect(liveFlagsFrom(null)).toEqual({ call: false, onboarding: false });
    expect(liveFlagsFrom({ features: { liveCall: "on" } })).toEqual({ call: false, onboarding: false });
  });
});

describe("microphone frames for cloud speech to text", () => {
  it("resamples 48 kHz floats to 16 kHz PCM16", () => {
    const one = new Float32Array(48000).fill(0.5);
    const out = toPcm16k(one, 48000);
    expect(out.length).toBe(16000);
    expect(out[0]).toBe(Math.floor(0.5 * 0x7fff));
    const clipped = toPcm16k(new Float32Array([2, 2, 2, -2, -2, -2]), 48000);
    expect([...clipped]).toEqual([0x7fff, -0x8000]);
  });
  it("encodes bytes as base64", () => {
    expect(b64(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });
});
