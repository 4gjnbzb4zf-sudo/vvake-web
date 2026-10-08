/**
 * Frame guard for vvake.com/rewards (VV-12). GitHub Pages can't send X-Frame-Options or a CSP frame-ancestors
 * header, and a <meta> CSP can't carry frame-ancestors, so the page protects itself against clickjacking:
 *
 * - The rewards content ([data-frame-guard]) is hidden by CSS unless <html> has `data-unframed`.
 * - This script, inline in <head> of every page (so client-side navigation keeps the flag), sets `data-unframed` only
 *   when the page is the top window. In a frame, or in a sandboxed frame where scripts don't run, the content stays
 *   hidden and [data-frame-notice] links to vvake.com/rewards instead.
 *
 * Kept tiny and dependency-free: it's hashed into the CSP like every other inline script.
 *
 * Served from Cloudflare (docs/cloudflare-hosting.md), every response also carries `frame-ancestors 'none'` and
 * `X-Frame-Options: DENY` (src/lib/cloudflareHeaders.ts), so every wallet surface (/en/rewards/, /fr/rewards/ and the
 * 404 page that forwards /rewards) and every other page refuses to be framed by the browser itself; this script stays
 * as the fallback for GitHub Pages.
 */
export const FRAME_GUARD_SCRIPT = `(function(){try{if(window.top===window.self)document.documentElement.setAttribute("data-unframed","")}catch(e){}})();`;
