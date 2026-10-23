import { describe, expect, it } from "vitest";
import { LOST_RETRY_MS, reconnectDelayMs } from "./ble";

describe("reconnectDelayMs (a known sensor comes back as soon as it can)", () => {
  it("tries fast at first, 1 s doubling", () => {
    expect([0, 1, 2, 3, 4, 5].map((a) => reconnectDelayMs(a))).toEqual([1000, 2000, 4000, 8000, 16000, 32000]);
  });
  it("then keeps trying every 30 s while the page is visible", () => {
    expect(reconnectDelayMs(6)).toBe(LOST_RETRY_MS);
    expect(reconnectDelayMs(40)).toBe(30_000);
  });
  it("never while the page is hidden (it comes back when the page does)", () => {
    expect(reconnectDelayMs(0, false)).toBeNull();
    expect(reconnectDelayMs(9, false)).toBeNull();
  });
});
