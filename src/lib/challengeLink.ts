/**
 * Challenge invite links: https://vvake.com/c/<code> (universal link into the app, see
 * public/.well-known/apple-app-site-association). Codes are 8 characters from the API's alphabet
 * (no 0/O/1/I), matched case-insensitively.
 *
 * GitHub Pages can't route /c/<code> (static export, unknown codes), so its 404 page sends the browser to
 * /<lang>/c/#<code>, the fallback page for people without the app. Dependency-free: `challengeRedirect` is
 * serialised into an inline script.
 */
export const CHALLENGE_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** A valid code from "#abcd2345", "abcd2345" or "/c/ABCD2345/", uppercased; null otherwise. */
export function parseChallengeCode(raw: string): string | null {
  const code = raw
    .replace(/^#/, "")
    .replace(/^\/?c\//, "")
    .replace(/\/$/, "")
    .toUpperCase();
  return CHALLENGE_CODE.test(code) ? code : null;
}

/** Where a /c/<code> path should go on this static site, or null when the path isn't a challenge link. */
export function challengeRedirect(pathname: string, lang: string): string | null {
  const m = /^\/c\/([A-Za-z0-9]{1,16})\/?$/.exec(pathname);
  return m ? "/" + lang + "/c/#" + m[1]!.toUpperCase() : null;
}

export const challengeAppUrl = (scheme: string, code: string) => `${scheme}://c/${code}`;
