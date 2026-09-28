import { describe, expect, it, vi } from "vitest";
import { fetchCityCounts, submitSignup, type SignupDraft } from "./waitlist";

const draft: SignupDraft = { email: "a@b.co", city: "lyon", locale: "fr", consent: true };
const okBody = { referralCode: "ab12cd34", cityRank: 7, citySignups: 412, tier: "founder", pendingVerification: true };

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("submitSignup", () => {
  it("does nothing when the waitlist is not configured", async () => {
    const f = mockFetch(200, okBody);
    expect(await submitSignup("", draft, f)).toEqual({ ok: false, error: "not-configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("validates before sending: consent, email, known city", async () => {
    const f = mockFetch(200, okBody);
    for (const bad of [
      { consent: false },
      { email: "nope" },
      { city: "atlantis" },
      { ref: "UPPER!" },
      { requestedCity: "Grenoble" }, // both city and requestedCity
      { city: undefined }, // neither
    ]) {
      expect(await submitSignup("https://api.test", { ...draft, ...bad }, f)).toEqual({ ok: false, error: "invalid" });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("accepts a requested city instead of a launch city", async () => {
    const f = mockFetch(200, okBody);
    const res = await submitSignup(
      "https://api.test",
      { email: "a@b.co", requestedCity: "Grenoble, France", locale: "fr", consent: true },
      f,
    );
    expect(res.ok).toBe(true);
  });

  it("posts JSON and parses a valid response", async () => {
    const f = mockFetch(200, okBody);
    const res = await submitSignup("https://api.test", draft, f);
    expect(res).toEqual({ ok: true, data: okBody });
    expect(f).toHaveBeenCalledWith("https://api.test/signup", expect.objectContaining({ method: "POST" }));
  });

  it("maps HTTP and network failures", async () => {
    expect(await submitSignup("https://api.test", draft, mockFetch(429, {}))).toEqual({ ok: false, error: "rate-limited" });
    expect(await submitSignup("https://api.test", draft, mockFetch(422, {}))).toEqual({ ok: false, error: "invalid" });
    expect(await submitSignup("https://api.test", draft, mockFetch(500, {}))).toEqual({ ok: false, error: "server" });
    expect(await submitSignup("https://api.test", draft, mockFetch(200, { junk: true }))).toEqual({ ok: false, error: "server" });
    const offline = vi.fn(async () => {
      throw new TypeError("offline");
    });
    expect(await submitSignup("https://api.test", draft, offline)).toEqual({ ok: false, error: "network" });
  });
});

describe("fetchCityCounts", () => {
  it("returns counts, or null on any problem", async () => {
    expect(await fetchCityCounts("https://api.test", mockFetch(200, { lyon: 12 }))).toEqual({ lyon: 12 });
    expect(await fetchCityCounts("https://api.test", mockFetch(200, { lyon: -1 }))).toBeNull();
    expect(await fetchCityCounts("https://api.test", mockFetch(503, {}))).toBeNull();
    expect(await fetchCityCounts("", mockFetch(200, {}))).toBeNull();
  });
});
