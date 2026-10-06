import { afterEach, describe, expect, it, vi } from "vitest";
import { prizeHoldings } from "./chain";

const REWARDS = "0xEF0D0c1c32D56A50dc1addc6471772F9E4a2aE0F";
const TOKEN = "0x2b85b57383bA4C7eDABf6289E6bfe3a9C4833Cde";
const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

afterEach(() => vi.unstubAllGlobals());

describe("prize contract holdings (counts direct deposits, not only conversions)", () => {
  it("reads the token balance of the rewards contract and its unallocated amount", async () => {
    const calls: { to: string; data: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const { id, params } = JSON.parse(init.body);
        calls.push(params[0]);
        const held = 1_653_038_722_209_908_576_461_880n;
        const result = params[0].to.toLowerCase() === TOKEN.toLowerCase() ? word(held) : word(held - 1000n);
        return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }));
      }),
    );
    const h = await prizeHoldings(REWARDS, TOKEN);
    expect(h).toEqual({ held: 1_653_038_722_209_908_576_461_880n, available: 1_653_038_722_209_908_576_460_880n });
    expect(calls).toContainEqual({ to: TOKEN, data: "0x70a08231" + REWARDS.slice(2).toLowerCase().padStart(64, "0") });
    expect(calls).toContainEqual({ to: REWARDS, data: "0xdf1c455c" });
  });
  it("is null when the chain can't be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    expect(await prizeHoldings(REWARDS, TOKEN)).toBeNull();
  });
});
