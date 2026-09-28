/**
 * Display currency. USD is the default everywhere; visitors can pick another major currency.
 * Amounts on the site are illustrative examples written in USD and shown as a round local amount.
 * Legal figures (e.g. crowdfunding caps) are never converted.
 */
export const CURRENCIES = ["USD", "EUR", "CAD", "GBP", "JPY", "CHF", "AUD", "CNY", "HKD", "SGD", "INR", "BRL", "MXN", "KRW"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "USD";
export const CURRENCY_STORAGE_KEY = "vvake-currency";

/** Approximate units per 1 USD, only for turning examples into round local amounts (not quotes). */
const PER_USD: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  CAD: 1.36,
  GBP: 0.79,
  JPY: 150,
  CHF: 0.88,
  AUD: 1.52,
  CNY: 7.2,
  HKD: 7.8,
  SGD: 1.35,
  INR: 83,
  BRL: 5.2,
  MXN: 17.5,
  KRW: 1350,
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** A round example amount: whole units below 10, two significant digits above (1 USD → ¥150, ₩1,400). */
export function exampleAmount(usd: number, currency: Currency): number {
  const raw = usd * PER_USD[currency];
  if (raw < 10) return Math.max(1, Math.round(raw));
  const magnitude = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude;
}

export function formatMoney(amount: number, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/** Replaces every {money} in a template with the example amount in the chosen currency. */
export function fillMoney(template: string, usd: number, currency: Currency, locale: string): string {
  return template.replace(/\{money\}/g, formatMoney(exampleAmount(usd, currency), currency, locale));
}
