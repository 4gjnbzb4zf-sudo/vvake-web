import { describe, expect, it } from "vitest";
import { dailySignals, pulseLine, suggestWatchlist } from "./pulse";

// Shared vectors with packages/game-core/test/pulse.test.ts.
describe("pulse mirror", () => {
  it("matches game-core", () => {
    expect(suggestWatchlist(["runner", "yogi"], "GRMN").map((a) => a.symbol)).toEqual(["NKE", "ONON", "DECK", "LULU", "GRMN"]);
    expect(pulseLine("NKE", -4.1, "today")).toBe("NKE −4.1% today");
    const s = dailySignals(
      [
        { symbol: "NKE", kind: "stock" },
        { symbol: "BTC", kind: "crypto" },
      ],
      [
        { symbol: "NKE", kind: "stock", changePct: -4.1 },
        { symbol: "BTC", kind: "crypto", changePct: 7.5 },
      ],
      "NKE",
    );
    expect(s.map((x) => x.type)).toEqual(["move", "rally"]);
  });
});

describe("pairing mirror", () => {
  it("matches game-core", async () => {
    const { pairedAsset, brokerFor } = await import("./pulse");
    expect(pairedAsset("runner")?.symbol).toBe("NKE");
    expect(brokerFor("CA")).toBe("licensed-partner");
  });
});
