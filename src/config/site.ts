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
  liveEndpoint: (process.env.NEXT_PUBLIC_LIVE_ENDPOINT ?? "").replace(/\/$/, ""),
  social: {
    x: "https://x.com/vvake",
    xHandle: "@vvake",
  },
  /** Third-party launchpad (independent; not an affiliation). */
  vibeVibeUrl: "https://testnet.vibevibe.fun/",
  contactEmail: "hello@vvake.com",
  partnersEmail: "partners@vvake.com",
  privacyEmail: "privacy@vvake.com",
} as const;
