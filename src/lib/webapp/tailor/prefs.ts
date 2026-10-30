import {
  cleanAnswers,
  TAILOR_FEATURES,
  TAILOR_VERSION,
  type TailorAnswers,
  type TailorFeature,
  type TailorFeatures,
  type TailorPrefs,
  type TailorTab,
} from "./tailor";

/**
 * "Your VVake" on the web (ADR-0059): reading the account's `prefs.tailor` from /v1/me, making a new one to send
 * (newest `at` wins on the server), the web's tabs from the profile's, where each feature lives on the web and on the
 * account page, and the web-only Developer flag that shows the switch to testers. The profile itself is always
 * recomputed with game-core's profileFromPrefs (tailor.ts).
 */

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/;

/** The account's `prefs.tailor`, checked; null when absent or not one (then the web is today's web). Pure. */
export function parseTailorPrefs(raw: unknown): TailorPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== TAILOR_VERSION || typeof r.tailorOn !== "boolean" || typeof r.at !== "string" || !ISO.test(r.at)) return null;
  if (!r.answers || typeof r.answers !== "object") return null;
  const overrides = cleanOverrides(r.overrides);
  return {
    v: TAILOR_VERSION,
    tailorOn: r.tailorOn,
    answers: cleanAnswers(r.answers),
    ...(overrides ? { overrides } : {}),
    source: r.source === "inferred" ? "inferred" : "picked",
    at: r.at,
    ...(typeof r.reviewAt === "string" && ISO.test(r.reviewAt) ? { reviewAt: r.reviewAt } : {}),
  };
}

/** The summary's toggles, only known features with a boolean; undefined when none. Pure. */
export function cleanOverrides(raw: unknown): Partial<TailorFeatures> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<TailorFeatures> = {};
  for (const k of TAILOR_FEATURES) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A new `prefs.tailor` to send, stamped now (the server keeps the newest). Pure but for the clock. */
export function nextTailorPrefs(
  prev: TailorPrefs | null,
  change: { answers?: TailorAnswers; overrides?: Partial<TailorFeatures>; tailorOn?: boolean; source?: TailorPrefs["source"] },
  now = Date.now(),
): TailorPrefs {
  const answers = cleanAnswers(change.answers ?? prev?.answers ?? {});
  const overrides = cleanOverrides(change.overrides !== undefined ? change.overrides : prev?.overrides);
  return {
    v: TAILOR_VERSION,
    tailorOn: change.tailorOn ?? prev?.tailorOn ?? false,
    answers,
    ...(overrides ? { overrides } : {}),
    source: change.source ?? (change.answers ? "picked" : (prev?.source ?? "picked")),
    at: new Date(Math.max(now, prev ? Date.parse(prev.at) + 1 : 0)).toISOString(),
    ...(prev?.reviewAt ? { reviewAt: prev.reviewAt } : {}),
  };
}

/** The web app's tabs (AppContext TABS ids). */
export type WebTab = "today" | "plan" | "trainings" | "crew" | "coach" | "you";

/** The profile's tabs as the web's: the phone's Train tab is the web's Trainings. Pure. */
export const webTabs = (tabs: readonly TailorTab[]): WebTab[] => tabs.map((t) => (t === "train" ? "trainings" : t));

/** Where each feature opens in the web app (All features): a route of the app, or a page of the site. */
export type FeatureTarget = { route: "season" | "coach" | "rhythm" | "places" | "trainings" | "crew" } | { page: string };
export const FEATURE_TARGET: Readonly<Record<TailorFeature, FeatureTarget>> = {
  plan: { route: "season" },
  coach: { route: "coach" },
  habits: { route: "rhythm" },
  music: { page: "account/#connections" },
  outdoor: { route: "places" },
  camera: { route: "trainings" },
  social: { route: "crew" },
  rewards: { page: "rewards/" },
  desk: { page: "account/#connections" },
};

/**
 * The account page's sections and the feature each belongs to (null: always shown). An off feature's sections fold
 * under All features at the bottom of the page; nothing is removed.
 */
export const ACCOUNT_SECTION_FEATURE = {
  profile: null,
  app: null,
  reminders: "habits",
  plan: "plan",
  coach: "coach",
  health: null,
  zones: null,
  goals: "plan",
  nutrition: "nutrition",
  connections: null,
  pulse: "rewards",
  plus: "coach",
  data: null,
} as const satisfies Record<string, TailorFeature | null>;

// ── The Developer switch on the web (testers only) ──────────────────────────────────────────────────────────────

const DEV_KEY = "vvake-tailor-dev";

/** `?tailor=1` shows the Developer switch in this browser, `?tailor=0` hides it again. Returns whether it is shown. */
export function readTailorDev(search: string): boolean {
  const q = new URLSearchParams(search).get("tailor");
  try {
    if (q === "1") localStorage.setItem(DEV_KEY, "1");
    else if (q === "0") localStorage.removeItem(DEV_KEY);
    return localStorage.getItem(DEV_KEY) === "1";
  } catch {
    return q === "1";
  }
}
