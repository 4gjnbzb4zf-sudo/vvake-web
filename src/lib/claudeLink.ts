/**
 * Claude Code link codes: https://vvake.com/claude/<code> (universal link into the app, see
 * public/.well-known/apple-app-site-association). The VVake plugin for Claude Code shows this link as a QR code;
 * the app confirms "Link Claude Code on <machine>?". Codes are 8 characters from the API's alphabet (no 0/O/1/I/L/U),
 * shown as XXXX-XXXX, matched case-insensitively with or without the dash.
 *
 * GitHub Pages can't route /claude/<code> (static export), so its 404 page sends the browser to
 * /<lang>/claude/#<code>, the fallback page for people without the app. Dependency-free: `claudeRedirect` is
 * serialised into an inline script.
 */
export const CLAUDE_CODE = /^[2-9A-HJKMNP-TV-Z]{8}$/;

/** "X7K29QPR" → "X7K2-9QPR". */
export const formatClaudeCode = (code: string) => code.slice(0, 4) + "-" + code.slice(4);

/** A valid code from "#x7k2-9qpl", "X7K29QPL" or "/claude/X7K2-9QPR/", as XXXX-XXXX; null otherwise. */
export function parseClaudeCode(raw: string): string | null {
  const code = raw
    .replace(/^#/, "")
    .replace(/^\/?claude\//, "")
    .replace(/\/$/, "")
    .replace(/[-\s]/g, "")
    .toUpperCase();
  return CLAUDE_CODE.test(code) ? formatClaudeCode(code) : null;
}

/** Where a /claude/<code> path should go on this static site, or null when the path isn't a Claude Code link. */
export function claudeRedirect(pathname: string, lang: string): string | null {
  const m = /^\/claude\/([A-Za-z0-9-]{1,16})\/?$/.exec(pathname);
  return m ? "/" + lang + "/claude/#" + m[1]!.toUpperCase() : null;
}

export const claudeAppUrl = (scheme: string, code: string) => `${scheme}://claude/${code}`;
