/** Public, build-time configuration. Every value here ends up in the static bundle. */
export const siteConfig = {
  name: "VVake",
  /** Canonical origin, without trailing slash. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vvake.com").replace(/\/$/, ""),
  /**
   * Waitlist API base URL (see docs/WAITLIST_API.md). When empty, the site shows
   * "waitlist opening soon" instead of a form. Nothing is faked.
   */
  waitlistEndpoint: (process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT ?? "").replace(/\/$/, ""),
  /**
   * Live activity feed (GET {liveEndpoint}/live). Empty = labelled demo mode on the world map.
   * Contract: docs/WAITLIST_API.md#live-activity.
   */
  /** Cloudflare Turnstile site key (public). When empty, the signup form shows no bot check. */
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  liveEndpoint: (process.env.NEXT_PUBLIC_LIVE_ENDPOINT ?? "").replace(/\/$/, ""),
  /**
   * VVake API (services/api in the monorepo). Used by the challenge page (/[lang]/c/) to preview who sent the
   * invite (the page works without it) and by the rewards page (/[lang]/rewards/: sign-in, weeks, wallet, proofs).
   */
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "https://vvake-api.simon-54e.workers.dev").replace(/\/$/, ""),
  /** Custom URL scheme of the iOS app (fallback when universal links don't open it). */
  appScheme: "vvake",
  /**
   * Where "Get VVake" goes on challenge and invite pages: the public TestFlight or App Store link once there is one.
   * Empty = early access (the waitlist on the home page). The one place to change it.
   */
  appDownloadUrl: (process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ?? "").trim(),
  social: {
    x: "https://x.com/VVakeFit",
    xHandle: "@VVakeFit",
  },
  /** Third-party launchpad (independent; not an affiliation). */
  vibeVibeUrl: "https://testnet.vibevibe.fun/",
  contactEmail: "hello@vvake.com",
  partnersEmail: "partners@vvake.com",
  privacyEmail: "privacy@vvake.com",
} as const;
