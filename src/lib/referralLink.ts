/**
 * Referral invite links: https://vvake.com/r/<code> (universal link into the app, see
 * public/.well-known/apple-app-site-association). A VVake member shares the link; the friend installs VVake and enters
 * the code at sign-up (or opens the link again once the app is installed). Codes are 8 characters from the API's
 * alphabet (ABCDEFGHJKLMNPQRSTUVWXYZ23456789: no 0/O/1/I), matched case-insensitively.
 *
 * GitHub Pages can't route /r/<code> (static export), so its 404 page sends the browser to /<lang>/r/#<code>, the
 * fallback page for people without the app. Dependency-free: `referralRedirect` is serialised into an inline script.
 */
export const REFERRAL_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** A valid code from "#abcd2345", "abcd2345" or "/r/ABCD2345/", uppercased; null otherwise. */
export function parseReferralCode(raw: string): string | null {
  const code = raw
    .replace(/^#/, "")
    .replace(/^\/?r\//, "")
    .replace(/\/$/, "")
    .trim()
    .toUpperCase();
  return REFERRAL_CODE.test(code) ? code : null;
}

/** Where a /r/<code> path should go on this static site, or null when the path isn't a referral link. */
export function referralRedirect(pathname: string, lang: string): string | null {
  const m = /^\/r\/([A-Za-z0-9]{1,16})\/?$/.exec(pathname);
  return m ? "/" + lang + "/r/#" + m[1]!.toUpperCase() : null;
}

export const referralAppUrl = (scheme: string, code: string) => `${scheme}://r/${code}`;

/** The invite link itself (what the app shares): https://vvake.com/r/<code>, opening the app when it's installed. */
export const referralLinkUrl = (origin: string, code: string) => `${origin.replace(/\/$/, "")}/r/${encodeURIComponent(code)}`;
