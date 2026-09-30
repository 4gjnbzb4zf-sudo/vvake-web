# VVake: website

> **VVake** (say _“wake”_): a new way to train: challenge yourself, your crew and your city, with an AI coach and much more at your wrist.
> Two Vs make a W.

Marketing and launch site for VVake: storytelling, city-unlock waitlist, rivalries, open-book split and the
VVaker avatar builder. English and French. Deployed as a static site on GitHub Pages.

## Stack

- **Next.js 16** (App Router, static export) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS 4** with brand tokens in `src/app/globals.css`
- **zod** for the waitlist contract · **Vitest** · ESLint · Prettier
- Zero runtime dependencies beyond React/Next; no cookies, no trackers

## Getting started

```sh
nvm use        # Node 22 (22.12+ recommended)
npm install
npm run dev    # http://localhost:3000 → redirects to /en/ or /fr/
```

| Script          | What it does                                |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Dev server (also regenerates social images) |
| `npm run build` | Static export to `out/`                     |
| `npm start`     | Serve `out/` locally                        |
| `npm run check` | Format check, lint, typecheck, tests        |
| `npm run og`    | Regenerate `public/og/{en,fr}.png`          |

## Languages

English is the default. `/` picks the language in the browser: an explicit earlier choice (saved when
the visitor clicks EN/FR) wins; otherwise the first supported language in the browser/OS preference
order (`fr-CA`, `fr-BE`… count as French); otherwise English. Localized URLs (`/en/`, `/fr/`) are never
force-redirected, so shared links stay as sent; a small dismissible bar offers the preferred language instead.
Logic: `src/i18n/negotiate.ts` (tested).

## Configuration (build-time)

| Variable                        | Default             | Purpose                                                                                |
| ------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `https://vvake.com` | Canonical URLs, sitemap, share links                                                   |
| `NEXT_PUBLIC_WAITLIST_ENDPOINT` | _(empty)_           | Waitlist API base URL ([contract](docs/WAITLIST_API.md)). Empty = "opening soon" state |

In GitHub Actions these come from repository **variables** `SITE_URL` and `WAITLIST_ENDPOINT`.

## Project layout

```
src/
  app/                 routes: /(root) language redirect, /[lang] pages, global 404, robots, sitemap, icon
  components/
    brand/             logo (VV → W heartbeat)
    sections/          page sections (hero, story, rivalries, unlock + waitlist form, open book…)
    vvaker/            VVaker voxel avatar (pure SVG) + studio with PNG export
    ui/                primitives (Section, Button, InView)
  i18n/                locales + typed dictionaries (fr must match en)
  lib/                 domain logic: cities & thresholds, waitlist client, referrals (unit-tested)
  og/                  social card rendered to PNG at build
scripts/generate-og.tsx
docs/                  DOMAIN_SETUP · WAITLIST_API · BRAND_GUARDRAILS
```

## Deploy

Push to `main` → **CI checks → static build → GitHub Pages**. Domain setup: [docs/DOMAIN_SETUP.md](docs/DOMAIN_SETUP.md).

## Content rules

All copy follows [docs/BRAND_GUARDRAILS.md](docs/BRAND_GUARDRAILS.md): VVake is a fitness and training service, not a financial product.

---

© VVake. All rights reserved. Code is shared for transparency; no license is granted for reuse of the brand, characters or copy.
