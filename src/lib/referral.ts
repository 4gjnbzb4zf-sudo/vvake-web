import type { Locale } from "@/i18n/config";

const REF_PATTERN = /^[a-z0-9]{6,12}$/;

/** Reads a referral code from a query string such as "?ref=ab12cd34". */
export function readReferral(search: string): string | undefined {
  const ref = new URLSearchParams(search).get("ref")?.toLowerCase();
  return ref && REF_PATTERN.test(ref) ? ref : undefined;
}

/** Share pages /[lang]/s/1…N/: same destination, each with its own preview image (duo + app challenge). */
export const SHARE_VARIANTS = 8;

/**
 * The invite link. With a `variant` (1…SHARE_VARIANTS) it goes through that share page, so the post's preview
 * shows a different picture; the page forwards to the home page with ?ref and ?city intact.
 */
export function referralUrl(origin: string, locale: Locale, code: string, city: string, variant?: number): string {
  const url = new URL(variant ? `/${locale}/s/${variant}/` : `/${locale}/`, origin);
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

/** Where the post-signup share buttons go. Each opens the network's own share screen, prefilled. */
export type ShareNetwork = "x" | "whatsapp" | "telegram" | "linkedin" | "threads";

export function shareUrl(network: ShareNetwork, text: string, url: string): string {
  switch (network) {
    case "x":
      return xShareUrl(text, url);
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case "threads":
      return `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`;
  }
}

/** A random share page for one post. */
export const randomVariant = () => 1 + Math.floor(Math.random() * SHARE_VARIANTS);
