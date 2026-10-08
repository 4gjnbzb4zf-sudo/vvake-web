import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, claimOpensAt, errorKey, isAppCode, isEmailCode, missingConditions, RewardsSession } from "./rewardsApi";

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
  it("maps the API's missing conditions (ADR-0024 order), unknown ones to other", () => {
    expect(missingConditions(["entry", "account", "wallet", "adult", "effort", "skill"])).toEqual([
      "entry",
      "account",
      "wallet",
      "adult",
      "effort",
      "skill",
    ]);
    // Weeks built before migration 0019 say "plus": that's the entry condition now (Plus or the free entry).
    expect(missingConditions(["plus", "wallet", "adult", "effort"])).toEqual(["entry", "wallet", "adult", "effort"]);
    expect(missingConditions(["plus_inactive", "no_wallet", "age", "min_sessions"])).toEqual(["entry", "wallet", "adult", "effort"]);
    expect(missingConditions(["account_too_new", "no_heart_rate", "skill_question"])).toEqual(["account", "effort", "skill"]);
    // The capped pilot (review 2026-10-07 DEEP-02): no seat yet, on the waiting list.
    expect(missingConditions(["effort", "pilot"])).toEqual(["effort", "pilot"]);
    expect(missingConditions(["something_new", "else"])).toEqual(["other"]);
    expect(missingConditions(undefined)).toEqual([]);
    expect(missingConditions(null)).toEqual([]);
  });

  it("claims open at claimableAt: a date before then, null once open (or when the API doesn't say)", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    expect(claimOpensAt({ status: "opening", claimableAt: "2026-10-08T12:00:00Z" }, now)?.toISOString()).toBe("2026-10-08T12:00:00.000Z");
    // Even if a cached status still says claimable, a future claimableAt keeps the claim closed.
    expect(claimOpensAt({ status: "claimable", claimableAt: "2026-10-08T12:00:00Z" }, now)).not.toBeNull();
    expect(claimOpensAt({ status: "claimable", claimableAt: "2026-10-06T12:00:00Z" }, now)).toBeNull();
    expect(claimOpensAt({ status: "claimable", claimableAt: null }, now)).toBeNull();
    expect(claimOpensAt({ status: "claimable" }, now)).toBeNull();
    // "opening" without a date: still not open (unknown opening time).
    expect(claimOpensAt({ status: "opening", claimableAt: null }, now)).toEqual(new Date(Number.NaN));
  });
});

describe("free entry and skill question calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(reply: (url: string, init: RequestInit) => Response) {
    const sent: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return reply(url, init);
    });
    const session = new RewardsSession("https://api.test");
    (session as unknown as { access: string }).access = "token";
    return { sent, session };
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("enter: POST /v1/rewards/entry with the bearer, returns when it counts from", async () => {
    const { sent, session } = stub(() => json({ entry: { enteredAt: "2026-10-06T10:00:00Z", countsFrom: "2026-10-12T00:00:00.000Z" } }));
    const res = await session.enterFree();
    expect(res).toEqual({ enteredAt: "2026-10-06T10:00:00Z", countsFrom: "2026-10-12T00:00:00.000Z" });
    expect(sent[0]!.url).toBe("https://api.test/v1/rewards/entry");
    expect(sent[0]!.init.method).toBe("POST");
    expect((sent[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer token");
  });

  it("withdraw: DELETE /v1/rewards/entry (204)", async () => {
    const { sent, session } = stub(() => new Response(null, { status: 204 }));
    await session.withdrawFree();
    expect(sent[0]!.url).toBe("https://api.test/v1/rewards/entry");
    expect(sent[0]!.init.method).toBe("DELETE");
  });

  it("skill: GET with the epoch, POST {epoch, answer} as a number", async () => {
    const { sent, session } = stub((url) =>
      url.includes("?")
        ? json({ epoch: 2961, answered: false, answeredAt: null, attemptsLeft: 5, question: "7 × 8 + 12 − 4" })
        : json({ epoch: 2961, correct: true, answeredAt: "2026-10-06T12:00:00Z", attemptsLeft: 4 }),
    );
    const q = await session.skill(2961);
    expect(q.question).toBe("7 × 8 + 12 − 4");
    expect(sent[0]!.url).toBe("https://api.test/v1/rewards/skill?epoch=2961");
    const a = await session.answerSkill(64, 2961);
    expect(a.correct).toBe(true);
    expect(sent[1]!.init.method).toBe("POST");
    expect(JSON.parse(String(sent[1]!.init.body))).toEqual({ epoch: 2961, answer: 64 });
  });

  it("reads today's GET /v1/rewards: entry, rules, opening claims, no estimate, no rate", async () => {
    const body = {
      enabled: true,
      chainId: 46630,
      rules: {
        plusRequired: false,
        freeEntry: true,
        beforeWeekStart: true,
        heartRateRequired: true,
        skillQuestion: true,
        uploadGraceHours: 4,
        dailyPointCap: 150,
        maxShareBps: 1000,
        minSessions: 3,
        minActiveMinutes: 90,
      },
      plus: { active: false, until: null },
      entry: { plus: false, free: { enteredAt: "2026-10-01T00:00:00Z", countsFrom: "2026-10-05T00:00:00.000Z" } },
      wallet: { address: "0x" + "11".repeat(20), linkedAt: "2026-10-06T00:00:00Z", adult: true, countsFrom: "2026-10-12T00:00:00.000Z" },
      week: {
        epoch: 2961,
        startsAt: "a",
        endsAt: "b",
        points: 40,
        sessions: 1,
        activeMinutes: 30,
        eligible: false,
        missing: ["wallet", "effort", "skill"],
        entry: "free",
        skill: { answered: false },
      },
      epochs: [
        {
          epoch: 2960,
          startsAt: "a",
          endsAt: "b",
          points: 300,
          amount: "100",
          amountBase: "100",
          address: "0x" + "11".repeat(20),
          status: "opening",
          claimableAt: "2026-10-08T12:00:00Z",
          deadline: null,
        },
      ],
    };
    const { session } = stub(() => json(body));
    const r = await session.rewards();
    expect(r.entry?.free?.countsFrom).toBe("2026-10-05T00:00:00.000Z");
    expect(r.rules?.dailyPointCap).toBe(150);
    expect(r.wallet?.countsFrom).toBe("2026-10-12T00:00:00.000Z");
    expect(r.week?.skill?.answered).toBe(false);
    expect(r.epochs?.[0]?.status).toBe("opening");
    expect(r.epochs?.[0]?.claimableAt).toBe("2026-10-08T12:00:00Z");
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

describe("VVaker ownership calls (monorepo ADR-0026)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(reply: (url: string) => Response) {
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      sent.push(url);
      return reply(url);
    });
    const session = new RewardsSession("https://api.test");
    (session as unknown as { access: string }).access = "token";
    return { sent, session };
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("asks whose a look is, with the nearest free one when it's someone else's", async () => {
    const { sent, session } = stub(() =>
      json({ feature: true, current: null, pending: null, rendersLeft: 1, owner: "someone", suggestion: "VVP-e30000-12-8" }),
    );
    expect(await session.vvakerOwner("VVP-e30000-10-8")).toEqual({ owner: "someone", suggestion: "VVP-e30000-12-8" });
    expect(sent[0]).toBe("https://api.test/v1/vvaker?code=VVP-e30000-10-8");
  });

  it("lists my VVakers, and fetches only the API's own render paths (never another URL)", async () => {
    const { sent, session } = stub((url) =>
      url.endsWith("/mine")
        ? json({
            vvakers: [
              {
                code: "VVP-e30000-10-8",
                claimedAt: "x",
                current: true,
                renders: [
                  {
                    id: "a".repeat(32),
                    status: "ready",
                    createdAt: "2026-10-06",
                    imageUrl: `/v1/vvaker/renders/${"a".repeat(32)}.png`,
                    current: true,
                  },
                ],
              },
            ],
          })
        : new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { "content-type": "image/png" } }),
    );
    const mine = await session.myVVakers();
    expect(mine[0]!.renders[0]!.current).toBe(true);
    expect(await session.vvakerImage("https://evil.example/x.png")).toBeNull();
    expect(await session.vvakerImage("/v1/vvaker/renders/../../x.png")).toBeNull();
    expect(sent).toEqual(["https://api.test/v1/vvaker/mine"]);
    const src = await session.vvakerImage(mine[0]!.renders[0]!.imageUrl!);
    expect(src?.startsWith("data:image/png")).toBe(true);
    expect(sent[1]).toBe(`https://api.test/v1/vvaker/renders/${"a".repeat(32)}.png`);
  });
});
