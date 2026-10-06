import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorKey, isAppCode, isEmailCode, missingConditions, RewardsSession } from "./rewardsApi";

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

describe("SEC-W13 the vault upload carries the six blob fields only", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("SEC-W13 extra properties on the object (a key, a PRF output) are never sent", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ vault: { ...body, createdAt: "2026-10-06T00:00:00Z" } }), { status: 201 });
    });
    const session = new RewardsSession("https://api.test");
    (session as unknown as { access: string }).access = "token";
    const blob = {
      version: 1 as const,
      credentialId: "a".repeat(22),
      salt: "s",
      iv: "i",
      ciphertext: "c",
      address: "0x" + "11".repeat(20),
    };
    await session.saveVault({ ...blob, privateKey: "0x" + "22".repeat(32), prf: "x" } as typeof blob);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://api.test/v1/rewards/vault");
    expect(sent[0]!.init.method).toBe("PUT");
    expect(Object.keys(JSON.parse(String(sent[0]!.init.body))).sort()).toEqual([
      "address",
      "ciphertext",
      "credentialId",
      "iv",
      "salt",
      "version",
    ]);
  });

  it("maps passkey errors to their messages", () => {
    const named = (name: string) => Object.assign(new Error("x"), { name });
    expect(errorKey(named("NotAllowedError"))).toBe("passkeyCancelled");
    expect(errorKey(named("VaultLockedError"))).toBe("passkeyLocked");
    expect(errorKey(named("PrfUnsupportedError"))).toBe("prfUnsupported");
    expect(errorKey(named("NeedsGasError"))).toBe("needsGas");
    expect(errorKey(named("LinkRefusedError"))).toBe("linkRefused");
  });
});
