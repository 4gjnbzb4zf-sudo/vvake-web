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

## 5. Check

```sh
dig +short vvake.com A        # the four 185.199.x.153 addresses
dig +short www.vvake.com      # 4gjnbzb4zf-sudo.github.io.
curl -sI https://vvake.com/en/ | head -1   # HTTP/2 200 once live
```
