import { describe, expect, it } from "vitest";
import { parseReferralCode, referralAppUrl, referralRedirect } from "./referralLink";

describe("referral links", () => {
  it("reads a code from a hash or a path, case-insensitively", () => {
    expect(parseReferralCode("#abcd2345")).toBe("ABCD2345");
    expect(parseReferralCode("ABCD2345")).toBe("ABCD2345");
    expect(parseReferralCode("/r/luxe7899")).toBe("LUXE7899"); // L and U are in the alphabet
    expect(parseReferralCode("/r/abcd2345/")).toBe("ABCD2345");
    expect(parseReferralCode("")).toBeNull();
    expect(parseReferralCode("#ABCD2340")).toBeNull(); // 0 isn't in the alphabet
    expect(parseReferralCode("#ABCDEFGI")).toBeNull(); // nor I
    expect(parseReferralCode("#ABCD234")).toBeNull();
    expect(parseReferralCode("#ABCD23456")).toBeNull();
    expect(parseReferralCode("#<script>")).toBeNull();
  });

  it("sends /r/<code> to the localized fallback page, nothing else", () => {
    expect(referralRedirect("/r/abcd2345", "fr")).toBe("/fr/r/#ABCD2345");
    expect(referralRedirect("/r/ABCD2345/", "en")).toBe("/en/r/#ABCD2345");
    expect(referralRedirect("/c/ABCD2345", "en")).toBeNull();
    expect(referralRedirect("/rewards", "en")).toBeNull();
    expect(referralRedirect("/r/", "en")).toBeNull();
  });

  it("builds the app's custom-scheme link", () => {
    expect(referralAppUrl("vvake", "ABCD2345")).toBe("vvake://r/ABCD2345");
  });
});
