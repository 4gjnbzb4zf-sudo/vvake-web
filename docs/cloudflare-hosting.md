# Serve vvake.com from Cloudflare

Why (review WEB-SEC-01): GitHub Pages can't send response headers, so the site has no HSTS, no `nosniff`, no
`frame-ancestors` and only a `<meta>` CSP. On Cloudflare the same static export is served with real headers. Moving the
DNS to Cloudflare also unlocks Email Routing, so hello@, privacy@, security@ and partners@ finally receive mail
(vvake.com has no MX record today).

Nothing here is deployed yet. GitHub Pages keeps serving vvake.com until step 5.

## What's in the repo

| File                                      | What it does                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wrangler.jsonc`                          | An assets-only Worker named `vvake-web`. It serves `out/` with `html_handling: auto-trailing-slash` (`/en/rewards` → `/en/rewards/`, like Pages) and `not_found_handling: 404-page`. Unknown paths get `out/404.html` with a 404 status, and its script forwards `/c/…`, `/r/…`, `/claude/…` and `/rewards`. |
| `scripts/cloudflare-headers.ts`           | Writes `out/_headers` after the build (`src/lib/cloudflareHeaders.ts`, tested).                                                                                                                                                                                                                              |
| `.github/workflows/deploy-cloudflare.yml` | A manual deploy (Actions → Deploy to Cloudflare → Run workflow). It runs the same checks and build as `deploy.yml`, then `wrangler deploy`.                                                                                                                                                                  |
| `npm run deploy:cloudflare`               | The same deploy from your computer (`npx wrangler login` first).                                                                                                                                                                                                                                             |

### Headers sent

- **Every response:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - a `Permissions-Policy` that turns off the camera, the microphone, geolocation, payment, USB and so on (passkeys, the clipboard and Web Share stay allowed)
  - `X-Frame-Options: DENY`
  - a baseline CSP: `frame-ancestors 'none'; object-src 'none'; base-uri 'none'`
- **Each page:** its own CSP, built from the same policy as its `<meta>` (same script hashes), plus `frame-ancestors 'none'`.
  - No page can be framed, so every wallet surface is covered: `/en/rewards/`, `/fr/rewards/` and the 404 page that forwards `/rewards`.
  - The frame-guard script stays as the fallback for GitHub Pages.
- **`/.well-known/apple-app-site-association`:** `Content-Type: application/json` (universal links and passkeys).
- **Hidden files:** Wrangler uploads `out/.well-known/`. `wrangler deploy --dry-run` lists `/.well-known/apple-app-site-association`.

A local check with `npx wrangler@4.136.0 dev` returned, as expected:

- `/en/rewards/`: 200 with every header;
- `/en/rewards`: 307 to `/en/rewards/`;
- the AASA file as `application/json`;
- `/c/ABC123`: 404 with the forwarding page.

### Why Workers static assets, not Pages

- Cloudflare now tells new projects to start with Workers (developers.cloudflare.com/pages). Workers static assets is where new features land.
- A Next.js static export is plain files. Workers static assets serves them with `_headers`, `_redirects`, trailing-slash handling and a 404 page, like Pages.
- Requests for static assets are free and don't count against the Workers Free plan's request limit, because no script runs.
- One `wrangler.jsonc` in the repo describes the whole setup, and the deploy is one `wrangler deploy`. There's no Pages project to configure by hand.

## Founder steps

### 1. Add the zone to Cloudflare (free plan)

1. Go to dash.cloudflare.com, then **Add a domain**. Enter `vvake.com`, choose **Free**, and let it scan the DNS.
2. Don't change nameservers yet.

### 2. Recreate every DNS record first

Cloudflare's scan can miss records, so compare it with what GoDaddy serves today. On 2026-10-08, `dig` showed:

```sh
for t in A AAAA CNAME MX TXT CAA NS; do echo "== $t"; dig +short vvake.com $t; done
dig +short www.vvake.com CNAME
dig +short _dmarc.vvake.com TXT
dig +short _domainconnect.vvake.com CNAME
```

| Type  | Name             | Value                                                                               | Keep on Cloudflare?                                                      |
| ----- | ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A     | `@`              | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (GitHub Pages)                | Yes until step 4, **DNS only** (grey cloud). Step 4 replaces them.       |
| AAAA  | `@`              | `2606:50c0:8000::153`, `8001::153`, `8002::153`, `8003::153`                        | Same as above                                                            |
| CNAME | `www`            | `4gjnbzb4zf-sudo.github.io`                                                         | Same as above                                                            |
| TXT   | `_dmarc`         | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | **Yes**, copy it exactly (you may later point `rua` to your own mailbox) |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com` (GoDaddy's)                                   | Not needed once GoDaddy no longer hosts the DNS                          |
| MX    | (none)           |                                                                                     | Step 6 adds them                                                         |
| TXT   | `@`              | (none today: no SPF and no verification records)                                    |                                                                          |

- Also check GoDaddy's DNS page itself for anything `dig` can't guess: verification TXT records (Google, Apple, Resend), DKIM records like `resend._domainkey`, or `send` subdomain records. Copy every one of them.
- The API sends sign-in codes from `hello@vvake.com` through Resend, and no Resend record answers in DNS today. If Resend shows the domain as verified, copy its records from the Resend dashboard. If it doesn't, add them on Cloudflare now.

### 3. Change the nameservers at GoDaddy

1. In GoDaddy, open **My Products → vvake.com → DNS → Nameservers → Change → I'll use my own nameservers**.
2. Enter the two `*.ns.cloudflare.com` names that Cloudflare shows.
3. Wait for the zone to show **Active** in Cloudflare. This takes minutes to a few hours.
4. During that wait the old records still answer, so the site stays up.

Optional: turn off DNSSEC at GoDaddy before the switch if it's on, then turn it on in Cloudflare (**DNS → Settings**) and add the DS record it gives you at GoDaddy.

### 4. Deploy and attach the custom domain

1. In Cloudflare, open **My Profile → API Tokens → Create Token** and use the **Edit Cloudflare Workers** template, limited to your account and the `vvake.com` zone.
2. In GitHub, open the repo and go to **Settings → Secrets and variables → Actions**. Add the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (Account ID is on the Workers overview page).
3. Run **Actions → Deploy to Cloudflare** once. The site appears at `https://vvake-web.<your-subdomain>.workers.dev`. Check it there first (step 7 commands, with that host).
4. Delete the GitHub A, AAAA and `www` CNAME records in Cloudflare DNS.
5. Uncomment the `routes` block in `wrangler.jsonc` (`vvake.com` and `www.vvake.com` as custom domains), commit, and run the workflow again. Cloudflare creates the DNS records and the certificate.
   - Or use the dashboard instead: **Workers & Pages → vvake-web → Settings → Domains & Routes → Add → Custom domain**.
6. Send `www` to the apex: go to **Rules → Redirect Rules → Create rule**.
   - When: hostname equals `www.vvake.com`.
   - Then: dynamic redirect to `concat("https://vvake.com", http.request.uri.path)`, status 301, keeping the query string.
7. Go to **SSL/TLS → Edge Certificates** and turn on **Always Use HTTPS**.

### 5. Retire GitHub Pages

Do this only after step 7 passes on `https://vvake.com`.

1. In the repo, go to **Settings → Pages**, remove the custom domain, then set **Source** to none or disable Pages.
2. Change `deploy.yml` to `workflow_dispatch` only, or delete it, and give `deploy-cloudflare.yml` an `on: push: branches: [main]` trigger.
3. Keep the account-level domain verification under **GitHub → Settings → Pages → Verified domains**. It stops anyone else from claiming vvake.com on Pages.

### 6. Email Routing (hello@, privacy@, security@, partners@)

Email Routing needs Cloudflare DNS, so do it after step 3.

1. Go to **Email → Email Routing → Get started**. Let Cloudflare add its MX records and the SPF TXT record (`v=spf1 include:_spf.mx.cloudflare.net ~all`).
   - If Resend sends from a subdomain such as `send.vvake.com`, its own SPF there is separate and stays.
2. Under **Destination addresses**, add your inbox: `______________________` (fill this in). Open the confirmation e-mail Cloudflare sends to it.
3. Under **Routing rules**, create one custom address for each of these, all with the action **Send to an email** and your verified inbox as the destination:
   - `hello@vvake.com`
   - `privacy@vvake.com`
   - `security@vvake.com`
   - `partners@vvake.com`
4. Leave the catch-all off (spam).
5. Test it: send a message from another account to each address.
   - The site already shows hello@, privacy@ and partners@. `security@` is new: `SECURITY.md` sends reports to GitHub private advisories, so list it there only if you want mail reports too.

### 7. Verify the headers

```sh
curl -sI https://vvake.com/en/rewards/ | grep -iE 'strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy'
curl -sI https://vvake.com/en/rewards        # 307/308 to /en/rewards/
curl -sI https://vvake.com/.well-known/apple-app-site-association | grep -i content-type   # application/json, 200, no redirect
curl -s  -o /dev/null -w '%{http_code}\n' https://vvake.com/c/ABC123   # 404, and the page forwards in a browser
curl -sI https://www.vvake.com/fr/ | grep -i location                 # https://vvake.com/fr/
curl -s https://app-site-association.cdn-apple.com/a/v1/vvake.com     # Apple's cached copy (can lag a day)
dig +short vvake.com MX                                               # Cloudflare's route*.mx.cloudflare.net
```

Then open https://vvake.com/en/rewards/ in a browser. The console should show no CSP errors, and passkey sign-in, wallet linking and the waitlist should still work.
