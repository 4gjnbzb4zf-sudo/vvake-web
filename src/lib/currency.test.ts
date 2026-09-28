import { describe, expect, it } from "vitest";
import { exampleAmount, fillMoney, isCurrency } from "./currency";

describe("currency", () => {
  it("defaults examples to round local amounts", () => {
    expect(exampleAmount(1, "USD")).toBe(1);
    expect(exampleAmount(1, "EUR")).toBe(1);
    expect(exampleAmount(1, "JPY")).toBe(150);
    expect(exampleAmount(1, "KRW")).toBe(1400);
    expect(exampleAmount(1000, "EUR")).toBe(920);
  });
  it("formats per language and validates codes", () => {
    expect(fillMoney("{money} per workout", 1, "USD", "en")).toBe("$1 per workout");
    expect(fillMoney("{money} par séance", 1, "EUR", "fr")).toBe("1 € par séance");
    expect(fillMoney("{money}", 1, "CAD", "en")).toBe("CA$1");
    expect(isCurrency("GBP")).toBe(true);
    expect(isCurrency("DOGE")).toBe(false);
  });
});
