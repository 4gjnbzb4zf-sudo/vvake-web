/**
 * English copy. `Dictionary` is derived from this object, so every other locale
 * must provide exactly the same keys (enforced by the type checker).
 * Wording guardrails: docs/BRAND_GUARDRAILS.md. No profit, yield or price promises.
 */
export const en = {
  meta: {
    title: "VVake: the market wakes, we move",
    description:
      "VVake (say “wake”) is the free fitness game where your city, your team and your squad move together. Heart over hype. Open-book team. Unlock your city.",
    ogAlt: "VVake: two Vs make a W. The market wakes, we move.",
  },
  nav: {
    story: "Story",
    how: "How it works",
    rivalries: "Rivalries",
    openBook: "Open book",
    vvaker: "Your VVaker",
    faq: "FAQ",
    join: "Unlock your city",
    skip: "Skip to content",
    language: "Language",
  },
  hero: {
    pronounce: "Say it: “wake”",
    prefix: "VVake up",
    anthem: ["for your health.", "for your wealth.", "for yourself.", "for your squad.", "for your city.", "for your team."],
    lead: "The free fitness game where your city, your team and your market move together. Scored on your heart, not your speed. Built by a team that only earns when you move.",
    ctaPrimary: "Unlock your city",
    ctaSecondary: "Read the story",
    chips: ["Free to start", "Heart, not speed", "Open-book team", "Watch & phone"],
  },
  story: {
    kicker: "06:00 AM",
    title: "You remember this feeling.",
    paragraphs: [
      "2022. Your energy just refilled. You lace up, open the app, and go. Around the world, hundreds of thousands of people were doing the same thing at the same moment.",
      "It was the most fun many of us ever had in crypto. Then it broke. Sneakers cost more than real sneakers. Every month there was something new to buy. The people who came to move ended up paying for the people who came to extract.",
      "The ritual was real. The economics weren't. So we rebuilt it from the ground up: we kept the magic and threw out everything that broke it.",
    ],
    fixesTitle: "What we fixed",
    fixes: [
      { was: "$1,000 to start", now: "Free to start. No NFT paywall, ever." },
      { was: "Rewards printed without limit", now: "Rewards only from real revenue, never from new users." },
      { was: "Speed decided everything", now: "Your heart decides. Age-fair effort scoring." },
      { was: "A new thing to buy every month", now: "One ecosystem. No pay-more-for-less treadmill." },
    ],
  },
  doubleV: {
    title: "Two Vs make a W.",
    body: "VV reads as W: wellness, wealth, win. In French, W is literally “double V”. Say it like wake, because that's what it's for.",
    words: ["Wellness", "Wealth", "Win"],
    healthIsWealth: "Health is the first wealth.",
  },
  how: {
    kicker: "How it works",
    title: "Short daily sessions. Real momentum.",
    items: [
      {
        title: "Energy refills on your clock",
        body: "Energy refills four times a day in your local time zone. One energy is five minutes of real effort. Show up, spend it, come back.",
      },
      {
        title: "Heart, not speed",
        body: "Effort is scored from heart-rate zones, adjusted for your age and your own baseline. A 63-year-old walker and a 24-year-old runner compete on the same line.",
      },
      {
        title: "Squads and rivalries",
        body: "Team up in squads, pass the baton across time zones, and put your city on the board in 12-hour clashes.",
      },
      {
        title: "Works anywhere",
        body: "Apple Watch, Wear OS or phone. No signal on the trail? Sessions record offline and sync later, so you never lose a day.",
      },
    ],
  },
  pulse: {
    kicker: "Market Pulse",
    title: "The market wakes. We move.",
    body: "Pick a Brand Team. When its market moves, a worldwide moment opens, and everyone moves together.",
    rally: { tag: "Red day", title: "Rally", body: "Brand down? A 45-minute worldwide Rally opens. Lace up with thousands of others." },
    recover: { tag: "Green day", title: "Recover", body: "Brand up? Rest, stretch, sleep well. A challenge drops in a few hours." },
    disclaimer:
      "Illustration. Market data only sets the theme of free challenges. Rewards never depend on prices, and VVake does not sell or give away stocks.",
  },
  rivalries: {
    kicker: "City Clash",
    title: "Prove your city.",
    body: "Twelve hours to build up. Twelve hours to clash. Scored per capita, so size doesn't win: showing up does.",
    tabs: { FR: "France", US: "USA" },
    toUnlock: "to unlock",
    vs: "vs",
    perCapita: "Per capita = how hard people went + how many showed up. A town of 330k can beat a metro of 3.7M.",
    stories: {
      "paris-marseille": "Le Classique: capital vs the south.",
      "lyon-saint-etienne": "The Derby du Rhône: France's oldest fire.",
      "lille-lens": "The Derby du Nord.",
      "bordeaux-toulouse": "Garonne rivals, in football and rugby.",
      "nantes-rennes": "The Breton derby. Is Nantes Breton? Settle it.",
      "montpellier-nimes": "The Languedoc derby.",
      "strasbourg-metz": "Alsace vs Lorraine.",
      "nice-toulon": "The Riviera meets rugby town.",
      "new-york-boston": "A century of baseball bad blood.",
      "los-angeles-san-francisco": "North vs south California.",
      "chicago-st-louis": "Cubs–Cardinals, since the 1890s.",
      "dallas-houston": "Texas bragging rights.",
      "philadelphia-pittsburgh": "The Battle of Pennsylvania.",
      "washington-baltimore": "The Beltway rivalry.",
      "seattle-portland": "Cascadia: the running-culture capitals.",
      "miami-tampa": "Florida supremacy.",
      "minneapolis-green-bay": "The Border Battle. The per-capita underdog showcase.",
    },
  },
  unlock: {
    kicker: "Unlock your city",
    title: "VVake isn't live in your city yet. You decide when.",
    body: "Each city goes live once enough people join. Rival cities launch together, so the first clash happens on day one.",
    tiersTitle: "Join early, get remembered",
    tiers: [
      {
        name: "City Founder",
        who: "First 100 in your city",
        perks: "Name on the Founders Wall · Founder gear skin · Captain eligibility · 48h early access",
      },
      { name: "Pioneer", who: "First 1,000", perks: "Pioneer skin · 2 streak freezes · 24h early access" },
      { name: "Early Mover", who: "Everyone before unlock", perks: "Early Mover badge · 1 streak freeze" },
    ],
    tiersNote: "Perks are in-game only and activate after your first 3 real sessions. Fake signups get nothing.",
    form: {
      email: "Email",
      emailPlaceholder: "you@example.com",
      city: "Your city",
      cityPlaceholder: "Choose your city",
      fanbase: "Your team (optional)",
      fanbasePlaceholder: "e.g. Montreal hockey, PSG, Packers",
      consent: "I agree to receive VVake launch updates. I can unsubscribe anytime.",
      privacy: "Privacy notice",
      submit: "Join the waitlist",
      submitting: "Joining…",
      rivalLabel: "Your rival",
      threshold: "Signups to unlock",
      counterLive: "joined",
      counterPending: "Live counters appear when the waitlist opens.",
    },
    success: {
      title: "You're in. Now bring your crew.",
      pending: "Check your inbox to confirm your email. Only confirmed signups move the counter.",
      rank: "You're #{rank} in {city}.",
      tier: { founder: "City Founder reserved", pioneer: "Pioneer reserved", early: "Early Mover reserved" },
      referralLabel: "Your invite link",
      copy: "Copy",
      copied: "Copied",
      shareX: "Share on X",
      shareText: "{city} is waking up. Help unlock VVake in our city 👇",
    },
    closed: {
      title: "The waitlist opens very soon.",
      body: "Follow {handle} to be first when counters go live, and grab a Founder spot in your city.",
      cta: "Follow on X",
    },
    errors: {
      invalid: "Please check your email and city.",
      "rate-limited": "Too many tries. Take a breath and try again in a minute.",
      network: "Network issue. Check your connection and try again.",
      server: "Something went wrong on our side. Please try again.",
      "not-configured": "The waitlist isn't open yet.",
    },
  },
  openBook: {
    kicker: "Open book",
    title: "Our salary is public before you ask.",
    body: "The team has no token allocation and is paid only from fees. Every dollar goes through one public split.",
    split: [
      { label: "Players", note: "Season rewards, paid for effort, never for holding", value: 30 },
      { label: "Team", note: "Our only income: salaries & infrastructure", value: 40 },
      { label: "Growth", note: "Events, rivalries, community", value: 20 },
      { label: "Reserve", note: "Keeps rewards steady in down seasons", value: 10 },
    ],
    promise: "No hidden wallets. No second token. A public report every season.",
  },
  vvaker: {
    kicker: "Your VVaker",
    title: "Meet your VVaker.",
    body: "A little voxel athlete that's yours, whoever and wherever you are. Pick your colors, your sport and your mood, then make it your profile picture.",
    controls: { color: "Color", sport: "Sport", headgear: "Headgear", mood: "Mood", energy: "Energy" },
    colors: { candy: "Candy", lilac: "Lilac", butter: "Butter", mint: "Mint", sky: "Sky", olive: "Olive" },
    sports: { runner: "Runner", lifter: "Lifter", coder: "Coder", baller: "Baller", walker: "Walker" },
    headgears: { none: "Headband", cap: "Cap", beanie: "Beanie", headphones: "Headphones" },
    moods: { fresh: "Fresh", fired: "Fired up", sleepy: "Sleepy", zen: "Zen" },
    download: "Download PNG",
    shuffle: "Shuffle",
    note: "Free for everyone. No wallet needed.",
    alt: "Your VVaker avatar",
  },
  dev: {
    kicker: "For builders",
    title: "Code hard. Move harder.",
    body: "Your AI is refactoring. Your spine is filing a complaint. The VVake companion lives in your terminal and editor, and nudges you outside when the build is green.",
    terminal: [
      "$ vv status",
      "⚡ 3 energy   🫀 118 min since you moved",
      "⚔️  PARIS 58.2 vs MARSEILLE 55.9 · 3h left",
      "✔ PR merged. Deploy & Dash window: 20 min. Go.",
    ],
    note: "Privacy first: no code or prompts ever leave your machine.",
  },
  faq: {
    title: "Questions",
    items: [
      {
        q: "Is VVake an investment?",
        a: "No. VVake is a fitness game. Rewards are small perks funded by real revenue, and nothing on VVake is a promise of profit. Move because it feels good.",
      },
      {
        q: "Is it free?",
        a: "Yes. Moving, squads, rivalries and your VVaker are free. Optional extras like cosmetics or a Plus subscription will never be required to take part.",
      },
      {
        q: "What happens to my health data?",
        a: "It's encrypted with a key only you hold. We never sell it and never use it for ads. Research use is opt-in and anonymized.",
      },
      {
        q: "Which devices?",
        a: "Apple Watch and Wear OS from day one, plus phone-only mode. Sessions work offline and sync later.",
      },
      {
        q: "Is there a token or NFTs?",
        a: "A web3 layer is planned for later, subject to legal review and not available in every country. It will never be needed to play, and collectibles are cosmetic only.",
      },
      {
        q: "When do you launch?",
        a: "City by city, as soon as your city hits its unlock number. Rival cities go live together.",
      },
    ],
  },
  footer: {
    tagline: "Two Vs make a W.",
    legal:
      "VVake is a fitness game, not a financial product. Nothing on this site is investment advice or an offer of any token, security or financial instrument. Market data is shown for entertainment only. Team names and tickers are used for identification only; no affiliation or endorsement is implied.",
    privacy: "Privacy",
    contact: "Contact",
    rights: "All rights reserved.",
  },
  privacy: {
    title: "Privacy notice (waitlist)",
    updated: "Draft, last updated 28 September 2026. To be reviewed by counsel before the waitlist opens.",
    sections: [
      {
        h: "What we collect",
        p: "Your email, your city, optionally your team, the language you use, and the referral code you used or received.",
      },
      {
        h: "Why",
        p: "To run the city waitlist (counters, early tiers, referrals) and to send you launch updates you agreed to receive. Legal basis: your consent.",
      },
      {
        h: "What we never do",
        p: "We never sell your data, never share it for advertising, and this site uses no tracking cookies or third-party analytics.",
      },
      {
        h: "How long",
        p: "Until launch plus 12 months, or until you unsubscribe or ask for deletion, whichever comes first.",
      },
      {
        h: "Your rights",
        p: "You can access, correct, export or delete your data, and withdraw consent at any time. Write to {email}.",
      },
    ],
  },
  notFound: { title: "Lost your way?", body: "This page took a rest day.", cta: "Back home" },
  root: { choose: "Choose your language" },
};

export type Dictionary = typeof en;
