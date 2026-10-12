import { describe, expect, it } from "vitest";
import {
  billingSchema,
  countdown,
  discountText,
  invoiceSchema,
  isHttpsUrl,
  isPayUri,
  isStripeUrl,
  paidByCard,
  plusActive,
  quoteSchema,
  shortAddress,
  tokensText,
  usdText,
} from "./plusPay";
import { encodeQr, qrPath } from "./qr";

const PAY_URI =
  "ethereum:0x2b85aC6a3fB1e5d0a2e1C7dE59e2d5F1C9e93Cde@46630/transfer?address=0xBe8BC5e660C10A2c080a4580bb901774bf0c91ae&uint256=297501356784000000000000";

const invoice = {
  id: "a".repeat(24),
  status: "open",
  amount: "297501356784000000000000",
  amountTokens: "297501.356784",
  amountDisplay: "297501.356784 VVAKE",
  usd: "4.491",
  listUsd: "4.99",
  discountBps: 1000,
  vvakeUsd: "0.0000151",
  token: "0x2b85aC6a3fB1e5d0a2e1C7dE59e2d5F1C9e93Cde",
  symbol: "VVAKE",
  decimals: 18,
  treasury: "0xBe8BC5e660C10A2c080a4580bb901774bf0c91ae",
  chainId: 46630,
  network: "testnet",
  payUri: PAY_URI,
  months: 1,
  createdAt: "2026-10-12T10:00:00.000Z",
  expiresAt: "2026-10-12T10:30:00.000Z",
};

describe("Plus with $VVAKE on vvake.com", () => {
  it("formats prices, the discount and exact token amounts per language", () => {
    expect(usdText("4.491", "en")).toBe("$4.49");
    expect(usdText("4.491", "fr")).toBe("4,49 $");
    expect(discountText(1000, "en")).toBe("−10%");
    expect(discountText(1500, "fr")).toBe("−15 %");
    expect(tokensText("297501.356784", "en")).toBe("297,501.356784");
    expect(tokensText("297501.356784", "fr")).toBe("297 501,356784");
    expect(tokensText("1000", "en")).toBe("1,000");
  });

  it("counts down to the invoice's expiry and stops at 0:00", () => {
    const at = Date.parse(invoice.expiresAt);
    expect(countdown(invoice.expiresAt, at - 29 * 60_000 - 59_000)).toBe("29:59");
    expect(countdown(invoice.expiresAt, at + 5000)).toBe("0:00");
    expect(countdown("not a date", at)).toBe("0:00");
  });

  it("counts Plus only while plusUntil is in the future", () => {
    const now = Date.parse("2026-10-12T00:00:00Z");
    expect(plusActive("2026-11-11T00:00:00Z", now)).toBe(true);
    expect(plusActive("2026-10-11T00:00:00Z", now)).toBe(false);
    expect(plusActive(null, now)).toBe(false);
    expect(plusActive("soon", now)).toBe(false);
  });

  it("only turns an EIP-681 transfer link or an https receipt into a link", () => {
    expect(isPayUri(PAY_URI)).toBe(true);
    expect(isPayUri("javascript:alert(1)")).toBe(false);
    expect(isPayUri("https://evil.example/pay")).toBe(false);
    expect(isHttpsUrl("https://explorer.testnet.chain.robinhood.com/tx/0xabc")).toBe(true);
    expect(isHttpsUrl("http://example.com")).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
    expect(shortAddress(invoice.treasury)).toBe("0xBe8B…91ae");
  });

  it("reads the API's billing answers, dropping a malformed open invoice instead of failing", () => {
    expect(invoiceSchema.safeParse(invoice).success).toBe(true);
    expect(
      quoteSchema.safeParse({ listUsd: "4.99", usd: "4.491", discountBps: 1000, amountTokens: "297501", network: "testnet" }).success,
    ).toBe(true);
    const b = billingSchema.parse({ plan: "free", vvakePay: { available: true, discountBps: 1000 }, openInvoice: { id: 1 }, receipts: [] });
    expect(b.openInvoice).toBeNull();
    expect(b.vvakePay?.available).toBe(true);
    expect(billingSchema.parse({ plan: "plus", plusUntil: "2026-11-11T00:00:00Z" }).plusUntil).toBe("2026-11-11T00:00:00Z");
  });

  it("draws the payment link as a QR code", () => {
    const qr = encodeQr(PAY_URI, { ecl: "M" });
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qrPath(qr, 2)).toMatch(/^M\d/);
  });
});

describe("Plus by card (Stripe)", () => {
  it("only Stripe's own https checkout and portal pages are followed", () => {
    expect(isStripeUrl("https://checkout.stripe.com/c/pay/cs_test_a1b2#fid")).toBe(true);
    expect(isStripeUrl("https://billing.stripe.com/p/session/test_123")).toBe(true);
    expect(isStripeUrl("http://checkout.stripe.com/c/pay/cs_1")).toBe(false);
    expect(isStripeUrl("https://checkout.stripe.com.evil.example/c")).toBe(false);
    expect(isStripeUrl("https://evil.example/?https://checkout.stripe.com/")).toBe(false);
    expect(isStripeUrl("javascript:alert(1)")).toBe(false);
  });

  it("a card subscription is live or test-mode Stripe", () => {
    expect(paidByCard("stripe")).toBe(true);
    expect(paidByCard("stripe_test")).toBe(true);
    expect(paidByCard("apple")).toBe(false);
    expect(paidByCard(null)).toBe(false);
  });

  it("reads the card channel and the store subscription, and tolerates an older API without them", () => {
    const b = billingSchema.parse({
      plan: "plus",
      stripe: { available: true },
      subscription: { provider: "stripe", active: true, autoRenew: true, expiresAt: "2026-11-12T00:00:00.000Z" },
    });
    expect(b.stripe?.available).toBe(true);
    expect(b.subscription?.provider).toBe("stripe");
    const old = billingSchema.parse({ plan: "free" });
    expect(old.stripe).toBeUndefined();
    const odd = billingSchema.parse({ plan: "free", stripe: "yes", subscription: 3 });
    expect(odd.stripe?.available).toBe(false);
    expect(odd.subscription).toBeNull();
  });
});
