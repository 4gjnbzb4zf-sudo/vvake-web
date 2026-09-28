import type { Locale } from "@/i18n/config";

const REF_PATTERN = /^[a-z0-9]{6,12}$/;

/** Reads a referral code from a query string such as "?ref=ab12cd34". */
export function readReferral(search: string): string | undefined {
  const ref = new URLSearchParams(search).get("ref")?.toLowerCase();
  return ref && REF_PATTERN.test(ref) ? ref : undefined;
}

export function referralUrl(origin: string, locale: Locale, code: string, city: string): string {
  const url = new URL(`/${locale}/`, origin);
  url.searchParams.set("ref", code);
  if (city) url.searchParams.set("city", city);
  return url.toString();
}

export function xShareUrl(text: string, url: string): string {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}
