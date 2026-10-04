# Point vvake.com to GitHub Pages

The site is deployed by `.github/workflows/deploy.yml` (GitHub Actions → Pages). With an Actions deployment,
**the custom domain is set in repository settings; no `CNAME` file is needed** (GitHub ignores it for Actions deploys).

## 1. Verify the domain on your GitHub account (prevents domain takeover)

1. GitHub → your avatar → **Settings → Pages → Add a domain** → enter `vvake.com`.
2. GitHub shows a TXT record like:

   | Type | Host / Name                               | Value                    |
   | ---- | ----------------------------------------- | ------------------------ |
   | TXT  | `_github-pages-challenge-4gjnbzb4zf-sudo` | `<code shown by GitHub>` |

3. Add it at your registrar, wait a few minutes, click **Verify**.

## 2. DNS records at your registrar (for `vvake.com`)

Delete any existing `A`/`AAAA`/`CNAME`/URL-forwarding records on `@` and `www` first (parking pages included).

| Type  | Host / Name | Value                        | TTL  |
| ----- | ----------- | ---------------------------- | ---- |
| A     | `@`         | `185.199.108.153`            | 3600 |
| A     | `@`         | `185.199.109.153`            | 3600 |
| A     | `@`         | `185.199.110.153`            | 3600 |
| A     | `@`         | `185.199.111.153`            | 3600 |
| AAAA  | `@`         | `2606:50c0:8000::153`        | 3600 |
| AAAA  | `@`         | `2606:50c0:8001::153`        | 3600 |
| AAAA  | `@`         | `2606:50c0:8002::153`        | 3600 |
| AAAA  | `@`         | `2606:50c0:8003::153`        | 3600 |
| CNAME | `www`       | `4gjnbzb4zf-sudo.github.io.` | 3600 |

Recommended extras:

| Type | Host     | Value                                            | Why                                                                         |
| ---- | -------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| CAA  | `@`      | `0 issue "letsencrypt.org"`                      | Only Let's Encrypt (used by GitHub Pages) may issue certificates            |
| TXT  | `@`      | `v=spf1 -all`                                    | Until you send email from this domain: nobody may send as @vvake.com        |
| TXT  | `_dmarc` | keep ONE record (GoDaddy default `p=quarantine`) | Anti-spoofing; move to `p=reject` once real email has SPF + DKIM (ADR-0009) |

> When you set up email (e.g. hello@vvake.com), replace the SPF/DMARC records with the ones your email provider gives you.

## 3. Repository settings

1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Custom domain:** `vvake.com` → Save. GitHub checks DNS (can take up to 24 h, usually minutes).
3. When the certificate is issued, tick **Enforce HTTPS**.

## 4. The other domains (vvake.fr, vvake.app, defensive ones)

GitHub Pages serves one custom domain per site. Redirect the others with your registrar's
**URL forwarding (301, HTTPS)** to `https://vvake.com` (and `https://vvake.com/fr/` for `vvake.fr`).
`.app` requires HTTPS end-to-end: make sure the registrar's forwarding supports HTTPS; otherwise use a
free redirect service like Cloudflare (Redirect Rules) in front of it.

## 5. Universal links (challenge invites)

The app's challenge links are `https://vvake.com/c/<code>`. iOS opens them in the app thanks to
`public/.well-known/apple-app-site-association` (exported to `out/.well-known/`, app ID `4RMR8QACMY.com.vvake.app`,
paths `/c/*`, plus `webcredentials` for the same app).

- **Deploy:** `actions/upload-pages-artifact` skips dot-folders by default, so `deploy.yml` sets
  `include-hidden-files: true`. Without it the file is missing from the site.
- **Content type:** GitHub Pages serves a file without an extension as `application/octet-stream` and lets you set no
  headers. Apple asks for HTTPS with no redirects; `application/json` is recommended but its CDN
  (which fetches the file for devices) accepts this. Check after a deploy:
  `curl -sI https://vvake.com/.well-known/apple-app-site-association` (200, no redirect) and
  `curl -s https://app-site-association.cdn-apple.com/a/v1/vvake.com` (shows the JSON Apple cached).
  If Apple ever refuses it: proxy the domain through Cloudflare (DNS "proxied") and add a **Response Header Transform
  Rule** for `/.well-known/apple-app-site-association` setting `Content-Type: application/json`. Today the DNS points
  straight at GitHub (section 2), so no Cloudflare rule applies.
- **Without the app:** GitHub Pages can't route `/c/<code>` (static site), so it answers with the 404 page, whose
  inline script forwards to `/<lang>/c/#<code>` (open in the app, or join early access). That first response is an
  HTTP 404, so link previews (iMessage, WhatsApp) show the generic 404 title; a Cloudflare Redirect Rule
  (`/c/*` → `/en/c/#…`) or a real host route would fix that later.
- **Preview of the invite:** the page calls `GET {NEXT_PUBLIC_API_URL}/v1/challenges/code/<code>` in the browser
  (default `https://vvake-api.simon-54e.workers.dev`). Today that route needs a signed-in user and the API only allows
  the origins in `ALLOWED_ORIGINS`, so the page shows the code without the sender. To show "Leo challenged you", make
  the route public (it only returns a display name and the challenge terms) and add `https://vvake.com` to
  `ALLOWED_ORIGINS`.

## 6. Check

```sh
dig +short vvake.com A        # the four 185.199.x.153 addresses
dig +short www.vvake.com      # 4gjnbzb4zf-sudo.github.io.
curl -sI https://vvake.com/en/ | head -1   # HTTP/2 200 once live
```
