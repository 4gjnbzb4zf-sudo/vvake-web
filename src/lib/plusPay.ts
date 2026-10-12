import * as z from "zod/mini";

/**
 * vvake.com/plus: a month of VVake Fit Plus paid with $VVAKE from the visitor's own wallet (contract: monorepo
 * docs/05-tech/api-v1.md, "Billing: Plus with $VVAKE"). The amounts come from the API as exact strings; nothing here
 * does money math, it only reads and formats. Mirrors the phone's src/lib/vvakePay.ts.
 */

/** Poll the open invoice this often while the page is visible. */
export const POLL_MS = 5000;

export const quoteSchema = z.object({
  listUsd: z.string(),
  usd: z.string(),
  discountBps: z.number(),
  amountTokens: z.string(),
  symbol: z.optional(z.string()),
  chainId: z.optional(z.number()),
  network: z.optional(z.string()),
  months: z.optional(z.number()),
});
export type VvakeQuote = z.infer<typeof quoteSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "paid", "expired"]),
  amount: z.string(),
  amountTokens: z.string(),
  amountDisplay: z.string(),
  usd: z.string(),
  listUsd: z.string(),
  discountBps: z.number(),
  symbol: z.optional(z.string()),
  treasury: z.string(),
  chainId: z.number(),
  network: z.optional(z.string()),
  payUri: z.string(),
  months: z.optional(z.number()),
  createdAt: z.optional(z.string()),
  expiresAt: z.string(),
  paidAt: z.optional(z.string()),
  txHash: z.optional(z.string()),
  explorerUrl: z.optional(z.string()),
});
export type VvakeInvoice = z.infer<typeof invoiceSchema>;

const planFields = {
  plan: z.optional(z.string()),
  plusUntil: z.optional(z.nullable(z.string())),
  plusSource: z.optional(z.nullable(z.string())),
};

export const billingSchema = z.object({
  ...planFields,
  vvakePay: z.optional(
    z.catch(
      z.object({
        available: z.boolean(),
        network: z.optional(z.string()),
        chainId: z.optional(z.number()),
        listUsd: z.optional(z.string()),
        discountBps: z.optional(z.number()),
      }),
      { available: false },
    ),
  ),
  openInvoice: z.optional(z.catch(z.nullable(invoiceSchema), null)),
});
export type Billing = z.infer<typeof billingSchema>;

export const invoiceStatusSchema = z.object({ invoice: invoiceSchema, ...planFields, checked: z.optional(z.boolean()) });
export const invoiceCreatedSchema = z.object({ invoice: invoiceSchema });

/** "29:59" until the invoice expires, "0:00" after. */
export function countdown(expiresAt: string, now: number): string {
  const s = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "4.491" → "$4.49" / "4,49 $" (display only). */
export function usdText(usd: string, lang: string): string {
  const n = Number(usd);
  if (!Number.isFinite(n)) return `$${usd}`;
  const cents = (Math.round(n * 100) / 100).toFixed(2);
  return lang === "fr" ? `${cents.replace(".", ",")} $` : `$${cents}`;
}

/** 1000 → "−10%" ("−10 %" in French). */
export const discountText = (bps: number, lang: string) => `−${Math.round(bps / 100)}${lang === "fr" ? " %" : "%"}`;

/** "297501.356784" → "297,501.356784" / "297 501,356784": grouped, every decimal kept (the amount must be exact). */
export function tokensText(amountTokens: string, lang: string): string {
  const [whole = "0", frac] = amountTokens.split(".");
  const sep = lang === "fr" ? " " : ",";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return frac ? `${grouped}${lang === "fr" ? "," : "."}${frac}` : grouped;
}

/** "0xBe8BC5e660C10A2c080a4580bb901774bf0c91ae" → "0xBe8B…91ae". */
export const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Plus on the account: `plusUntil` parses and is after now. */
export function plusActive(plusUntil: string | null | undefined, now: number): boolean {
  if (!plusUntil) return false;
  const t = Date.parse(plusUntil);
  return Number.isFinite(t) && t > now;
}

/** Only an EIP-681 link may become a link on the page (never a javascript: or http: URL from a response). */
export const isPayUri = (uri: string) => /^ethereum:0x[0-9a-fA-F]{40}@\d+\/transfer\?address=0x[0-9a-fA-F]{40}&uint256=\d+$/.test(uri);

/** Only an https explorer link becomes a receipt link. */
export const isHttpsUrl = (url: string | undefined) => !!url && /^https:\/\/[^\s"'<>]+$/.test(url);

// ── The signed-in account's Plus, for the logo's "+" badge in this tab ─────────────────────────────────────────────

const PLUS_KEY = "vvake-plus-until";
export const PLUS_EVENT = "vvake-plus";

function session(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Remember (or forget, with null) the signed-in account's plusUntil for this tab, and tell the logos on the page.
 * Kept with the session (sessionStorage), so signing out or closing the tab drops it.
 */
export function rememberPlus(plusUntil: string | null | undefined) {
  try {
    if (plusUntil) session()?.setItem(PLUS_KEY, plusUntil);
    else session()?.removeItem(PLUS_KEY);
  } catch {
    // storage unavailable: the badge shows on this page only
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PLUS_EVENT, { detail: plusUntil ?? null }));
}

/** The remembered plusUntil, if any. */
export function storedPlusUntil(): string | null {
  try {
    return session()?.getItem(PLUS_KEY) ?? null;
  } catch {
    return null;
  }
}
