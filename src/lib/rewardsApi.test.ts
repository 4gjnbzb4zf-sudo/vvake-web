import { describe, expect, it } from "vitest";
import { ApiError, errorKey, isAppCode, isEmailCode, missingConditions } from "./rewardsApi";

describe("rewards sign-in", () => {
  it("accepts the app's link codes and 6-digit e-mail codes", () => {
    expect(isAppCode("abcd-2345")).toBe(true);
    expect(isAppCode("ABCD 2345")).toBe(true);
    expect(isAppCode("ABCD0123")).toBe(false); // 0 and 1 aren't in the alphabet
    expect(isAppCode("ABC")).toBe(false);
    expect(isEmailCode(" 012345 ")).toBe(true);
    expect(isEmailCode("12345")).toBe(false);
  });

  it("maps API and wallet errors to messages", () => {
    expect(errorKey(new ApiError(401, "unauthorized", "Wrong code"))).toBe("wrongCode");
    expect(errorKey(new ApiError(401, "unauthorized", "Code expired or already used"))).toBe("expired");
    expect(errorKey(new ApiError(429, "rate_limited", ""))).toBe("tooMany");
    expect(errorKey(new ApiError(403, "forbidden", "Sign in on your phone to link another phone"))).toBe("guest");
    expect(errorKey(new ApiError(409, "conflict", ""))).toBe("walletTaken");
    expect(errorKey(new ApiError(400, "invalid", "The signature isn't from this wallet"))).toBe("signatureMismatch");
    expect(errorKey(new ApiError(0, "network", "network"))).toBe("network");
    expect(errorKey({ code: 4001, message: "User rejected the request." })).toBe("walletRefused");
    expect(errorKey(new Error("x"))).toBe("generic");
  });
});

describe("prize eligibility", () => {
  it("maps the API's missing conditions, unknown ones to other", () => {
    expect(missingConditions(["plus", "wallet", "adult", "effort"])).toEqual(["plus", "wallet", "adult", "effort"]);
    expect(missingConditions(["plus_inactive", "no_wallet", "age", "min_sessions"])).toEqual(["plus", "wallet", "adult", "effort"]);
    expect(missingConditions(["something_new", "else"])).toEqual(["other"]);
    expect(missingConditions(undefined)).toEqual([]);
    expect(missingConditions(null)).toEqual([]);
  });
});
