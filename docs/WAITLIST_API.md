# Waitlist API contract

GitHub Pages is static, so the waitlist runs as a small separate API. Set its base URL in the repository variable
`WAITLIST_ENDPOINT` (e.g. `https://api.vvake.com/waitlist`). If it's empty, the site shows "waitlist opening soon"
and never shows fake numbers. Client: `src/lib/waitlist.ts` (schemas are the source of truth).

## `POST {endpoint}/signup`

Request (`application/json`):

```json
{ "email": "you@example.com", "city": "lyon", "fanbase": "OL", "ref": "ab12cd34", "locale": "fr", "consent": true }
```

Exactly one of `city` (a launch-city slug) or `requestedCity` (free text, 2–80 chars, e.g. `"Grenoble, France"`) is required.
Requested cities are normalized server-side (trim, case, accents) and aggregated into a demand ranking; they get no tier and no counter until the city is added to the launch list.

Response `200`:

```json
{ "referralCode": "k3x9p2qa", "cityRank": 37, "citySignups": 412, "tier": "founder", "pendingVerification": true }
```

Errors: `400/422` invalid input · `429` rate limited · `5xx` server error.

**Server rules (must implement):**

- Validate with the same rules as `signupInputSchema`; reject disposable email domains.
- Send a confirmation email; **only confirmed signups count** toward city counters and ranks.
- `cityRank` = order of confirmation in that city; `tier` from ADR-0007 (founder ≤ 100, pioneer ≤ 1,000).
- Referrals are single-level; credit the referrer only after the referee's first 3 sessions (in the app).
- Idempotent per email: signing up twice returns the existing record.
- Rate limit per IP and per email; honeypot is handled client-side.
- CORS: allow `https://vvake.com` (and `http://localhost:3000` in dev) only.
- Store the minimum (see the privacy notice); no third-party trackers.

## `GET {endpoint}/cities`

Response `200`: confirmed signups per city slug, cacheable for ~60 s.

```json
{ "lyon": 412, "saint-etienne": 188 }
```

## Suggested implementation

Cloudflare Worker + D1 (SQLite) + a transactional email provider (e.g. Resend or Postmark): free-tier friendly,
EU-region storage available, no servers to run. To be built in the private monorepo under `services/waitlist`.

## Live activity

`GET {NEXT_PUBLIC_LIVE_ENDPOINT}/live` feeds the world map. Response `200`, cacheable ~15 s:

```json
{ "updatedAt": "2026-09-28T18:30:00Z", "cities": [{ "slug": "lyon", "active": 420 }] }
```

**Privacy rules (server must enforce; the client re-applies them):**

- City totals only: no individual positions, routes or user ids, ever.
- A city appears only with ≥ 10 active movers (k-anonymity), and counts are rounded down to 10s.
- "Active" = a session recorded in the last 15 minutes.

When the variable is empty, the map runs a clearly labelled demo ("Demo · live data starts at launch").
