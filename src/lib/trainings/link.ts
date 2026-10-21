/**
 * Custom training links (monorepo ADR-0047, docs/05-tech/custom-trainings.md): https://vvake.com/<lang>/t/<CODE>, with
 * `?c=<CHALLENGE>` for a challenge on it, and creator pages https://vvake.com/<lang>/coach/<handle>. They open the
 * app (universal links, public/.well-known/apple-app-site-association) or else the site's page.
 *
 * The site is a static export: its 404 page forwards /<lang>/t/<CODE> (and /t/<CODE>) to /<lang>/t/#<CODE> and
 * /<lang>/coach/<handle> to /<lang>/coach/#<handle>, like /c/ links. `trainingRedirect` and `creatorRedirect` are
 * serialised into that page's inline script: dependency-free, no module constants.
 */

/** Training share codes and challenge codes: 8 characters from the invite alphabet (no 0/O/1/I). */
export const TRAINING_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
/** A public creator handle: 3 to 20 of a-z, 0-9 and _. */
export const CREATOR_HANDLE = /^[a-z0-9_]{3,20}$/;

/** A valid code from "#abcd2345", "abcd2345", "/t/ABCD2345/", uppercased; null otherwise. */
export function parseTrainingCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/[?].*$/, "")
    .replace(/^\/?((en|fr)\/)?t\//, "")
    .replace(/\/$/, "")
    .toUpperCase();
  return TRAINING_CODE.test(code) ? code : null;
}

/** The share page's training code (hash) and challenge code (`?c=` in the query, or after the code in the hash). */
export function readShareLocation(hash: string, search: string): { code: string | null; challenge: string | null } {
  const h = hash.replace(/^#/, "");
  const [codePart, hashQuery] = h.split("?");
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  const fromHash = hashQuery ? new URLSearchParams(hashQuery).get("c") : null;
  return { code: parseTrainingCode(codePart), challenge: parseTrainingCode(q.get("c") ?? fromHash) };
}

/** A creator handle from "#Coach_Sam", "coach_sam" or "@coach_sam", lower-cased; null otherwise. */
export function parseHandle(raw: string | null | undefined): string | null {
  const h = (raw ?? "").trim().replace(/^#/, "").replace(/^@/, "").replace(/\/$/, "").toLowerCase();
  return CREATOR_HANDLE.test(h) ? h : null;
}

/** Where a /t/<code> or /<lang>/t/<code> path goes on this static site (the challenge kept), or null. */
export function trainingRedirect(pathname: string, lang: string, search?: string): string | null {
  const m = /^\/(?:(en|fr)\/)?t\/([A-Za-z0-9]{1,16})\/?$/.exec(pathname);
  if (!m) return null;
  const c = /[?&]c=([A-Za-z0-9]{1,16})/.exec(search || "");
  return "/" + (m[1] || lang) + "/t/" + (c ? "?c=" + c[1]!.toUpperCase() : "") + "#" + m[2]!.toUpperCase();
}

/** Where a /coach/<handle> or /<lang>/coach/<handle> path goes (the creator page reads the hash), or null. */
export function creatorRedirect(pathname: string, lang: string): string | null {
  const m = /^\/(?:(en|fr)\/)?coach\/([A-Za-z0-9_]{3,20})\/?$/.exec(pathname);
  return m ? "/" + (m[1] || lang) + "/coach/#" + m[2]!.toLowerCase() : null;
}

/** The link people share: https://vvake.com/<lang>/t/<CODE> (+ ?c=<CHALLENGE>). */
export function trainingShareUrl(origin: string, lang: string, code: string, challenge?: string | null): string {
  return `${origin.replace(/\/$/, "")}/${lang}/t/${code}${challenge ? `?c=${challenge}` : ""}`;
}

/** The app's own link (custom scheme), for "Open in the app" from the site page (same-site universal links don't open it). */
export const trainingAppUrl = (scheme: string, code: string, challenge?: string | null) =>
  `${scheme}://t/${code}${challenge ? `?c=${challenge}` : ""}`;

/** The web app running this training with the webcam: /<lang>/app/#/train/<CODE>(/<CHALLENGE>). */
export const trainingWebRunUrl = (lang: string, code: string, challenge?: string | null) =>
  `/${lang}/app/#/train/${code}${challenge ? `/${challenge}` : ""}`;

/** The creator page: /<lang>/coach/#<handle>. */
export const creatorPageUrl = (lang: string, handle: string) => `/${lang}/coach/#${handle}`;
