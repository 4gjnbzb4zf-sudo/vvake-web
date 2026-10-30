import { describe, expect, it } from "vitest";
import { b64, liveFlagsFrom, rms, toPcm16k, VoiceDetector } from "./liveCallBrowser";

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

describe("voice detector (cloud STT barge-in, ADR-0068)", () => {
  const frames = (v: VoiceDetector, level: number, n: number, strict = false) => {
    const out: (boolean | null)[] = [];
    for (let i = 0; i < n; i++) out.push(v.push(level, 85, strict));
    return out.filter((x) => x !== null);
  };
  it("starts after ~160 ms of voice over the noise floor and stops after ~450 ms of quiet", () => {
    const v = new VoiceDetector();
    expect(frames(v, 0.003, 20)).toEqual([]);
    expect(frames(v, 0.08, 1)).toEqual([]);
    expect(frames(v, 0.08, 2)).toEqual([true]);
    expect(frames(v, 0.08, 30)).toEqual([]);
    expect(frames(v, 0.003, 6)).toEqual([false]);
  });
  it("a steady hum never counts as talking; the bar is higher while the coach speaks", () => {
    const v = new VoiceDetector();
    expect(frames(v, 0.006, 60)).toEqual([]);
    const w = new VoiceDetector();
    frames(w, 0.002, 20);
    expect(frames(w, 0.015, 10, true)).toEqual([]);
    const x = new VoiceDetector();
    frames(x, 0.002, 20);
    expect(frames(x, 0.015, 10, false)).toEqual([true]);
  });
  it("rms of a frame", () => {
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rms(new Float32Array([]))).toBe(0);
  });
});
