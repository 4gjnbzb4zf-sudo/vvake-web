import { describe, expect, it } from "vitest";
import { challengeAppUrl, challengeRedirect, parseChallengeCode } from "./challengeLink";

describe("challenge links", () => {
  it("reads a code from a hash or a path, case-insensitively", () => {
    expect(parseChallengeCode("#abcd2345")).toBe("ABCD2345");
    expect(parseChallengeCode("/c/ABCD2345/")).toBe("ABCD2345");
    expect(parseChallengeCode("")).toBeNull();
    expect(parseChallengeCode("#ABCD0123")).toBeNull(); // 0 and 1 aren't in the alphabet
    expect(parseChallengeCode("#<script>")).toBeNull();
  });

  it("sends /c/<code> to the localized fallback page, nothing else", () => {
    expect(challengeRedirect("/c/abcd2345", "fr")).toBe("/fr/c/#ABCD2345");
    expect(challengeRedirect("/c/ABCD2345/", "en")).toBe("/en/c/#ABCD2345");
    expect(challengeRedirect("/en/missing/", "en")).toBeNull();
    expect(challengeRedirect("/c/", "en")).toBeNull();
  });

  it("builds the app's custom-scheme link", () => {
    expect(challengeAppUrl("vvake", "ABCD2345")).toBe("vvake://c/ABCD2345");
  });
});
