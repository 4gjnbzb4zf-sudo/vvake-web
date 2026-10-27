// Copied from VVFit packages/game-core/src/tailor.ts (c7b1cabb 2026-10-27) by scripts/sync-tailor-core.ts. Do not edit: re-sync.
/**
 * "Your VVake": the lean, tailored app (ADR-0059, docs/02-product/lean-tailored-experience.md, founder survey GO
 * 2026-10-27). Ten one-tap questions give a profile that switches nine features on or off for one athlete, on every
 * device: which tabs exist, Today's one next action, the coach's settings, the notification budget, the music service,
 * the sports and the default device, and which permissions to ask for (only when an answer needs them).
 *
 * Nothing is removed: a feature that is off leaves no tab, card, push or upsell, but stays reachable in All features
 * and settings search, and its data is kept. VV points accrue for everyone; Rewards & web3 is only what is shown.
 *
 * Words: the nine features are "features" here (ids `plan`, `coach`, …), never "packs": packs are the coach's voice
 * minute packs (ADR-0051). The founders' name for the screen is "Your VVake".
 *
 * Everything is gated by the profile only while `tailorOn` is true (decision 12: a Developer switch for one TestFlight
 * build, then on for all). With it off, or without a profile (older apps), every gate says yes: today's app.
 *
 * Pure. Mirrored in Swift (Apple Watch) and Kotlin (Wear OS) where the watches need it, checked against
 * test/fixtures/tailor-golden.json (scripts/export-tailor-golden.ts).
 */
import { sportEntry } from "./tailorSports";

// ── Ids ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const TAILOR_VERSION = 1 as const;

/** The nine switchable features, in the order of the "Your VVake" summary and the All features grid. */
export const TAILOR_FEATURES = ["plan", "coach", "habits", "music", "outdoor", "camera", "social", "rewards", "desk"] as const;
export type TailorFeature = (typeof TAILOR_FEATURES)[number];
export type TailorFeatures = Record<TailorFeature, boolean>;

export const TAILOR_GOALS = ["move", "home", "event", "outdoor", "compete", "earn"] as const;
export type TailorGoal = (typeof TAILOR_GOALS)[number];
export const TAILOR_SPORT_MODES = ["one", "few"] as const;
export type TailorSportMode = (typeof TAILOR_SPORT_MODES)[number];
export const TAILOR_WHERE = ["outside", "camera", "gym", "watch"] as const;
export type TailorWhere = (typeof TAILOR_WHERE)[number];
export const TAILOR_EVENT = ["yes", "later", "no"] as const;
export type TailorEvent = (typeof TAILOR_EVENT)[number];
export const TAILOR_CHALLENGE = ["self", "friends", "city", "none"] as const;
export type TailorChallenge = (typeof TAILOR_CHALLENGE)[number];
export const TAILOR_COACHING = ["lots", "cues", "ask", "none"] as const;
export type TailorCoaching = (typeof TAILOR_COACHING)[number];
export const TAILOR_VOICE = ["woman", "man"] as const;
export type TailorVoice = (typeof TAILOR_VOICE)[number];
export const TAILOR_STYLE = ["calm", "motivating", "direct"] as const;
export type TailorStyle = (typeof TAILOR_STYLE)[number];
export const TAILOR_HABITS = ["yes", "move", "no"] as const;
export type TailorHabits = (typeof TAILOR_HABITS)[number];
export const TAILOR_MUSIC = ["spotify", "apple", "mixes", "own", "none"] as const;
export type TailorMusic = (typeof TAILOR_MUSIC)[number];
export const TAILOR_NOTIFY = ["few", "more", "all"] as const;
export type TailorNotify = (typeof TAILOR_NOTIFY)[number];

/** Most goals one athlete picks (question 1) and most sports kept (question 2). */
export const TAILOR_GOALS_MAX = 2;
export const TAILOR_SPORTS_MAX = 8;
/** An event's type: a sport key or a short label ("10k", "marathon", "ironman"). */
export const TAILOR_EVENT_TYPE = /^[a-z0-9_-]{1,40}$/;
const SPORT_KEY = /^[a-z0-9_-]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The survey's answers, one field per question (7 has two: voice and style; 4 has the event's type and date). */
export interface TailorAnswers {
  /** 1. What brings you to VVake? (1–2) */
  goals: TailorGoal[];
  /** 2. Which sports? Just one or a few, and the sports (main first). */
  sportMode: TailorSportMode;
  sports: string[];
  /** 3. Where do you usually train? (1+) */
  where: TailorWhere[];
  /** 4. An event you're aiming for? With "yes": its type and date when given. */
  event: TailorEvent;
  eventType?: string;
  eventDate?: string;
  /** 5. How do you like a challenge? */
  challenge: TailorChallenge;
  /** 6. How much coaching? */
  coaching: TailorCoaching;
  /** 7. Coach voice and style. */
  voice: TailorVoice;
  style: TailorStyle;
  /** 8. Daily habits help? */
  habits: TailorHabits;
  /** 9. Music while you train? */
  music: TailorMusic;
  /** 10. How many notifications? */
  notifications: TailorNotify;
}

// ── The survey ──────────────────────────────────────────────────────────────────────────────────────────────

/** The steps of the survey in order; `eventDetails` is the adaptive sub-step of question 4, `summary` the last screen. */
export const TAILOR_STEPS = [
  "goals",
  "sports",
  "where",
  "event",
  "eventDetails",
  "challenge",
  "coaching",
  "voice",
  "habits",
  "music",
  "notifications",
  "summary",
] as const;
export type TailorStep = (typeof TAILOR_STEPS)[number];
export type TailorQuestionId = Exclude<TailorStep, "eventDetails" | "summary">;

export interface TailorQuestion {
  id: TailorQuestionId;
  /** Its number on screen (1–10). */
  n: number;
  /** Several answers can be picked (up to `max`). */
  multi: boolean;
  max?: number;
  /** The answer ids, in display order (question 2: the mode; the sports come from the picker). */
  answers: readonly string[];
  /** Question 7's second row (style). */
  answers2?: readonly string[];
  /** What it sets, for the summary's "why". */
  sets: readonly TailorFeature[];
}

export const TAILOR_QUESTIONS: readonly TailorQuestion[] = [
  { id: "goals", n: 1, multi: true, max: TAILOR_GOALS_MAX, answers: TAILOR_GOALS, sets: ["plan", "habits", "camera", "social", "rewards"] },
  { id: "sports", n: 2, multi: false, answers: TAILOR_SPORT_MODES, sets: ["plan"] },
  { id: "where", n: 3, multi: true, max: TAILOR_WHERE.length, answers: TAILOR_WHERE, sets: ["outdoor", "camera"] },
  { id: "event", n: 4, multi: false, answers: TAILOR_EVENT, sets: ["plan"] },
  { id: "challenge", n: 5, multi: false, answers: TAILOR_CHALLENGE, sets: ["social"] },
  { id: "coaching", n: 6, multi: false, answers: TAILOR_COACHING, sets: ["coach"] },
  { id: "voice", n: 7, multi: false, answers: TAILOR_VOICE, answers2: TAILOR_STYLE, sets: [] },
  { id: "habits", n: 8, multi: false, answers: TAILOR_HABITS, sets: ["habits"] },
  { id: "music", n: 9, multi: false, answers: TAILOR_MUSIC, sets: ["music"] },
  { id: "notifications", n: 10, multi: false, answers: TAILOR_NOTIFY, sets: [] },
];

/** What the device knows before the survey: a paired watch preselects "Anywhere, with my watch". */
export interface TailorDeviceContext {
  watchPaired?: boolean;
  /** Sports from an earlier survey or history, main first: question 2's preselection. */
  sports?: string[];
}

/** Every card's preselected answer, so Next always works (survey: "defaults preselected"). Pure. */
export function defaultAnswers(ctx: TailorDeviceContext = {}): TailorAnswers {
  const sports = cleanSports(ctx.sports ?? []);
  return {
    goals: ["move"],
    sportMode: sports.length > 1 ? "few" : "one",
    sports,
    where: ctx.watchPaired ? ["watch"] : ["outside"],
    event: "later",
    challenge: "self",
    coaching: "cues",
    voice: "woman",
    style: "motivating",
    habits: "move",
    music: "own",
    notifications: "few",
  };
}

/**
 * The preselected answer of a later card from the answers so far (the cards adapt): a goal of "Train for an event"
 * preselects Yes on question 4, "Compete" With friends, "Earn" Against my city, "Move more" Yes on habits, a camera-only
 * athlete gets no habits push by default. Pure.
 */
export function suggestedAnswer(
  step: TailorQuestionId,
  partial: Partial<TailorAnswers>,
  ctx: TailorDeviceContext = {},
): Partial<TailorAnswers> {
  const d = defaultAnswers(ctx);
  const goals = partial.goals ?? d.goals;
  switch (step) {
    case "event":
      return { event: goals.includes("event") ? "yes" : d.event };
    case "challenge":
      return { challenge: goals.includes("earn") ? "city" : goals.includes("compete") ? "friends" : d.challenge };
    case "coaching":
      return { coaching: goals.includes("event") ? "lots" : d.coaching };
    case "habits":
      return { habits: goals.includes("move") ? "yes" : "no" };
    case "where":
      return { where: goals.includes("home") && !goals.includes("outdoor") ? ["camera"] : d.where };
    default:
      return {};
  }
}

/**
 * The steps shown for these answers, in order (adaptive rules): question 4 asks the type and date only after "Yes";
 * the voice card is skipped with "No coaching" (workout cues keep the default voice). Pure.
 */
export function visibleSteps(a: Partial<TailorAnswers>): TailorStep[] {
  return TAILOR_STEPS.filter((s) => (s === "eventDetails" ? a.event === "yes" : s === "voice" ? a.coaching !== "none" : true));
}

/** A camera-only athlete (no GPS anywhere): GPS questions, the live map and the location permission are skipped. Pure. */
export const cameraOnly = (a: Pick<TailorAnswers, "where" | "goals">): boolean =>
  a.where.length > 0 && a.where.every((w) => w === "camera" || w === "gym") && a.where.includes("camera") && !a.goals.includes("outdoor");

/**
 * The coach's partial redo (survey: "I want to start running for a 10K" → 2 questions): the steps to show again for one
 * topic. Pure data.
 */
export const TAILOR_REDO: Readonly<
  Record<"event" | "sports" | "coach" | "habits" | "music" | "social" | "notifications" | "where", readonly TailorStep[]>
> = {
  event: ["event", "eventDetails", "sports"],
  sports: ["sports", "where"],
  coach: ["coaching", "voice"],
  habits: ["habits"],
  music: ["music"],
  social: ["challenge"],
  notifications: ["notifications"],
  where: ["where"],
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const pickMany = <T extends string>(v: unknown, allowed: readonly T[], max: number): T[] => {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v)
    if (typeof x === "string" && (allowed as readonly string[]).includes(x) && !out.includes(x as T) && out.length < max) out.push(x as T);
  return out;
};
const cleanSports = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) if (typeof x === "string" && SPORT_KEY.test(x) && !out.includes(x) && out.length < TAILOR_SPORTS_MAX) out.push(x);
  return out;
};

/**
 * Answers made safe: unknown ids dropped, lists capped and de-duplicated, empty required lists back to their default,
 * the event's details kept only with "yes" (a date as YYYY-MM-DD). The server stores only this. Pure.
 */
export function cleanAnswers(raw: unknown): TailorAnswers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = defaultAnswers();
  const goals = pickMany(r.goals, TAILOR_GOALS, TAILOR_GOALS_MAX);
  const where = pickMany(r.where, TAILOR_WHERE, TAILOR_WHERE.length);
  const sports = cleanSports(r.sports);
  const event = pick(r.event, TAILOR_EVENT, d.event);
  const out: TailorAnswers = {
    goals: goals.length ? goals : d.goals,
    sportMode: pick(r.sportMode, TAILOR_SPORT_MODES, sports.length > 1 ? "few" : "one"),
    sports,
    where: where.length ? where : d.where,
    event,
    challenge: pick(r.challenge, TAILOR_CHALLENGE, d.challenge),
    coaching: pick(r.coaching, TAILOR_COACHING, d.coaching),
    voice: pick(r.voice, TAILOR_VOICE, d.voice),
    style: pick(r.style, TAILOR_STYLE, d.style),
    habits: pick(r.habits, TAILOR_HABITS, d.habits),
    music: pick(r.music, TAILOR_MUSIC, d.music),
    notifications: pick(r.notifications, TAILOR_NOTIFY, d.notifications),
  };
  if (event === "yes") {
    if (typeof r.eventType === "string" && TAILOR_EVENT_TYPE.test(r.eventType)) out.eventType = r.eventType;
    if (typeof r.eventDate === "string" && DAY.test(r.eventDate)) out.eventDate = r.eventDate;
  }
  return out;
}

// ── The profile ─────────────────────────────────────────────────────────────────────────────────────────────

/** The presets (doc §3.2 archetypes): the summary's title and a one-tap reset. */
export const TAILOR_PRESETS = [
  "just_run",
  "event_prep",
  "home_workouts",
  "daily_mover",
  "social_competitor",
  "web3_earner",
  "multisport_pro",
  "everything",
] as const;
export type TailorPreset = (typeof TAILOR_PRESETS)[number];

/** The phone's (and web's) tabs: Today first, You last, 0–3 feature tabs between. Web shows `train` as Trainings. */
export type TailorTab = "today" | "plan" | "train" | "crew" | "coach" | "you";
/** The watches' pages (vertical pager) and Today's dock tiles (doc §8). */
export type TailorWatchPage = "today" | "coach" | "social" | "music" | "you";
export type TailorDockTile = "race" | "move" | "quest" | "coach";

/**
 * Today's one primary button: the planned session, a one-tap start of the last setup, the camera on the next routine,
 * the daily move, or Train now (the sport picker). `rest_day` only from todayNextAction.
 */
export type TailorNextAction = "planned_session" | "quick_start" | "camera_workout" | "daily_move" | "train_now" | "rest_day";

export type TailorPermission = "location" | "camera" | "mic" | "health" | "spotify";

export interface TailorCoach {
  /** The Coach feature: Coach tab, chat, calls, live coach. Off: workout cues stay on "essential". */
  on: boolean;
  /** CoachSettings.chattiness. */
  chattiness: "quiet" | "normal" | "chatty";
  /** prefs.workoutVoice default (ADR-0044). */
  workoutVoice: "on" | "essential";
  /** Offer coach calls (Plus, still opt-in: CoachSettings.callsOn is only proposed). */
  calls: boolean;
  /** The hands-free live coach in workouts (ADR-0036). */
  live: boolean;
  /** Coach check-ins and proposals on Today. */
  checkIns: boolean;
  /** CoachSettings.voiceGender (ADR-0056). */
  voiceGender: TailorVoice;
  /** The tone of cues and calls (told to the coach). */
  style: TailorStyle;
}

/**
 * Kinds of notification, local and server. `feature`: the feature it belongs to (null: core). `level`: the lowest
 * notification answer that keeps it ("few" < "more" < "all"). `priority`: may still go past the daily budget up to the
 * hard cap (decision 5: coach call › challenge result › habit reminder). `late`: what happens when it can't go now
 * (digest = the evening digest; drop = useless later). `exempt`: never counted nor held (security, a reply to the
 * user's own action, a call's quiet update, the lock the user's own desk rule asked for).
 */
export const TAILOR_NOTIFY_KINDS = {
  coach_call: { feature: "coach", level: "few", priority: 1, late: "drop" },
  coach_checkin: { feature: "coach", level: "more", late: "drop" },
  plan_session: { feature: "plan", level: "few", late: "drop" },
  plan_skipped: { feature: "plan", level: "more", late: "digest" },
  habit_reminder: { feature: "habits", level: "few", priority: 3, late: "drop" },
  daily_move: { feature: "habits", level: "few", late: "drop" },
  challenge_result: { feature: "social", level: "few", priority: 2, late: "digest" },
  challenge: { feature: "social", level: "more", late: "digest" },
  challenge_poke: { feature: "social", level: "all", late: "drop" },
  clash: { feature: "social", level: "more", late: "digest" },
  crew_quest: { feature: "social", level: "more", late: "digest" },
  training_challenge: { feature: "social", level: "more", late: "digest" },
  moment: { feature: "social", level: "all", late: "drop" },
  pulse: { feature: "rewards", level: "all", late: "digest" },
  referral: { feature: null, level: "more", late: "digest" },
  desk_lock: { feature: "desk", level: "few", late: "drop", exempt: true },
  account: { feature: null, level: "few", late: "drop", exempt: true },
  device_link: { feature: null, level: "few", late: "drop", exempt: true },
  coach_call_update: { feature: null, level: "few", late: "drop", exempt: true },
} as const satisfies Record<
  string,
  { feature: TailorFeature | null; level: TailorNotify; priority?: number; late: "digest" | "drop"; exempt?: boolean }
>;
export type TailorNotifyKind = keyof typeof TAILOR_NOTIFY_KINDS;
type KindRule = { feature: TailorFeature | null; level: TailorNotify; priority?: number; late: "digest" | "drop"; exempt?: boolean };
const kindRule = (k: TailorNotifyKind): KindRule => TAILOR_NOTIFY_KINDS[k] as KindRule;

/** Daily budgets (decision 5): 3 by default, 6 for "A few more"; "Everything" keeps every kind but the hard cap stays 6. */
export const TAILOR_NOTIFY_BUDGET: Readonly<Record<TailorNotify, number>> = { few: 3, more: 6, all: 6 };
export const TAILOR_NOTIFY_HARD_CAP = 6;
/** Quiet hours, minutes from local midnight [start, end): 21:30–07:00 (doc §6). */
export const TAILOR_QUIET: readonly [number, number] = [21 * 60 + 30, 7 * 60];
/** The evening digest goes out at this local time (minutes from midnight), once a day when something waits. */
export const TAILOR_DIGEST_AT = 19 * 60 + 30;
const LEVEL_RANK: Readonly<Record<TailorNotify, number>> = { few: 0, more: 1, all: 2 };

export interface TailorNotifications {
  level: TailorNotify;
  /** Sent per local day before only priority kinds may go (up to hardCap). */
  budget: number;
  hardCap: number;
  /** The kinds this level keeps on (their feature on too); others wait for the evening digest or are dropped. */
  kinds: TailorNotifyKind[];
  quiet: readonly [number, number];
  digestAt: number;
}

export interface TailorProfile {
  v: typeof TAILOR_VERSION;
  preset: TailorPreset;
  features: TailorFeatures;
  /** Show rewards & $VVAKE (the summary's web3 toggle, off by default; points accrue anyway). Same as features.rewards. */
  rewardsVisible: boolean;
  /** Phone/web tabs (≤ 5). */
  tabs: TailorTab[];
  watchPages: TailorWatchPage[];
  watchDock: TailorDockTile[];
  /** Today's default primary button (todayNextAction picks the day's). */
  nextAction: TailorNextAction;
  coach: TailorCoach;
  notifications: TailorNotifications;
  music: TailorMusic;
  sportMode: TailorSportMode;
  /** Main first (the picker shows these first; the watch's start list). */
  sports: string[];
  /** Where workouts start by default. */
  device: "phone" | "watch";
  /** Ghost races on (Outdoor's "me vs myself"). */
  ghosts: boolean;
  /** Habits: daily rhythm reminders (water, meals, sleep) and move reminders; offer the desk lock from habits. */
  habits: { rhythm: boolean; moveReminders: boolean; deskOffer: boolean };
  /** The event of question 4 (Plan's season plan), when given. */
  event: { type?: string; date?: string } | null;
  /** Ask only these, each at the moment it is needed. */
  permissions: TailorPermission[];
}

export interface TailorOptions {
  /** The summary's toggles (they always win over the answers), the web3 toggle included (`rewards`). */
  overrides?: Partial<TailorFeatures>;
  /** A Mac companion or Claude desk link exists (decision 9: the Desk feature is on by default only then). */
  deskLinked?: boolean;
}

/** A GPS sport in the catalog (custom sports: no). */
const gpsSport = (key: string) => !!sportEntry(key)?.gps;

/** The nine features from the answers alone (before the summary's toggles). Pure. */
export function featuresFromAnswers(raw: TailorAnswers, opts: Pick<TailorOptions, "deskLinked"> = {}): TailorFeatures {
  const a = cleanAnswers(raw);
  const g = (x: TailorGoal) => a.goals.includes(x);
  return {
    plan: a.event === "yes" || g("event") || (a.sportMode === "few" && a.sports.length >= 3),
    coach: a.coaching !== "none",
    habits: a.habits !== "no",
    music: a.music === "spotify" || a.music === "apple" || a.music === "mixes",
    outdoor: a.where.includes("outside") || g("outdoor") || (a.where.includes("watch") && a.sports.some(gpsSport)),
    camera: a.where.includes("camera") || g("home"),
    social: a.challenge === "friends" || a.challenge === "city" || g("compete") || g("earn"),
    // Decision 4: off unless "Earn while I move" was picked; the summary's toggle can flip it.
    rewards: g("earn"),
    // Decision 9: off unless a Mac / Claude link exists.
    desk: !!opts.deskLinked,
  };
}

/** The closest preset for these features (doc §3.2). Pure. */
export function tailorPresetFor(f: TailorFeatures, a: Pick<TailorAnswers, "sports" | "goals">): TailorPreset {
  const on = TAILOR_FEATURES.filter((k) => k !== "desk" && f[k]).length;
  if (on >= 7) return "everything";
  if (f.plan && a.sports.length >= 3 && (f.outdoor || f.camera)) return "multisport_pro";
  if (f.plan) return "event_prep";
  if (f.rewards) return "web3_earner";
  if (f.social) return "social_competitor";
  if (f.camera) return "home_workouts";
  if (f.habits || a.goals.includes("move")) return "daily_mover";
  return "just_run";
}

/**
 * Tabs: Today, then Plan (Plan on) or Train (Camera on and Plan off: planners reach trainings from the plan and the
 * picker), Crew (Social), Coach (Coach), then You. At most 5. Pure.
 */
export function tabsFor(f: TailorFeatures): TailorTab[] {
  const mid: TailorTab[] = [];
  if (f.plan) mid.push("plan");
  else if (f.camera) mid.push("train");
  if (f.social) mid.push("crew");
  if (f.coach) mid.push("coach");
  return ["today", ...mid, "you"];
}

/** Watch pages (Today and You always; Coach ⇔ Coach; Social ⇔ Social or Rewards; Music ⇔ Music) and dock tiles. Pure. */
export function watchPagesFor(f: TailorFeatures): TailorWatchPage[] {
  const out: TailorWatchPage[] = ["today"];
  if (f.coach) out.push("coach");
  if (f.social || f.rewards) out.push("social");
  if (f.music) out.push("music");
  out.push("you");
  return out;
}
export function watchDockFor(f: TailorFeatures): TailorDockTile[] {
  const out: TailorDockTile[] = [];
  if (f.outdoor) out.push("race");
  if (f.habits) out.push("move");
  if (f.social) out.push("quest");
  if (f.coach) out.push("coach");
  return out;
}

const NEXT_BY_PRESET: Readonly<Record<TailorPreset, TailorNextAction>> = {
  just_run: "quick_start",
  event_prep: "planned_session",
  home_workouts: "camera_workout",
  daily_mover: "daily_move",
  social_competitor: "train_now",
  web3_earner: "train_now",
  multisport_pro: "planned_session",
  everything: "planned_session",
};

/** The coach's settings from questions 6 and 7. Pure. */
export function coachFromAnswers(a: Pick<TailorAnswers, "coaching" | "voice" | "style">): TailorCoach {
  const base = { voiceGender: a.voice, style: a.style } as const;
  switch (a.coaching) {
    case "lots":
      return { on: true, chattiness: "chatty", workoutVoice: "on", calls: true, live: true, checkIns: true, ...base };
    case "cues":
      return { on: true, chattiness: "normal", workoutVoice: "essential", calls: false, live: false, checkIns: false, ...base };
    case "ask":
      return { on: true, chattiness: "quiet", workoutVoice: "essential", calls: false, live: false, checkIns: false, ...base };
    default:
      return { on: false, chattiness: "quiet", workoutVoice: "essential", calls: false, live: false, checkIns: false, ...base };
  }
}

/** The notification settings for an answer to question 10, with the features that are on. Pure. */
export function notificationsFor(level: TailorNotify, f: TailorFeatures): TailorNotifications {
  const kinds = (Object.keys(TAILOR_NOTIFY_KINDS) as TailorNotifyKind[]).filter((k) => {
    const r = kindRule(k);
    return (r.feature === null || f[r.feature]) && LEVEL_RANK[r.level] <= LEVEL_RANK[level];
  });
  return {
    level,
    budget: TAILOR_NOTIFY_BUDGET[level],
    hardCap: TAILOR_NOTIFY_HARD_CAP,
    kinds,
    quiet: TAILOR_QUIET,
    digestAt: TAILOR_DIGEST_AT,
  };
}

/** Permissions the answers need (asked only at the moment of need; none for features that are off). Pure. */
export function permissionsFor(a: TailorAnswers, f: TailorFeatures, coach: TailorCoach): TailorPermission[] {
  const out: TailorPermission[] = [];
  if (!cameraOnly(a) && (f.outdoor || a.where.includes("outside") || a.sports.some(gpsSport))) out.push("location");
  if (f.camera) out.push("camera");
  if (coach.on && coach.live) out.push("mic");
  if (a.where.includes("watch") || f.habits || a.goals.includes("move")) out.push("health");
  if (f.music && a.music === "spotify") out.push("spotify");
  return out;
}

/** The whole profile from the answers (and the summary's toggles). Pure: the same answers give the same profile everywhere. */
export function tailorFromAnswers(raw: TailorAnswers, opts: TailorOptions = {}): TailorProfile {
  const a = cleanAnswers(raw);
  const features: TailorFeatures = { ...featuresFromAnswers(a, opts) };
  for (const k of TAILOR_FEATURES) {
    const o = opts.overrides?.[k];
    if (typeof o === "boolean") features[k] = o;
  }
  const coach = coachFromAnswers(a);
  // The Coach toggle wins over question 6: switched on from "None" → essentials; switched off → no calls, no live.
  const coachOut: TailorCoach = features.coach
    ? coach.on
      ? coach
      : { ...coachFromAnswers({ ...a, coaching: "cues" }) }
    : { ...coach, on: false, calls: false, live: false, checkIns: false, workoutVoice: "essential" };
  const preset = tailorPresetFor(features, a);
  const event =
    features.plan && a.event === "yes"
      ? { ...(a.eventType ? { type: a.eventType } : {}), ...(a.eventDate ? { date: a.eventDate } : {}) }
      : null;
  return {
    v: TAILOR_VERSION,
    preset,
    features,
    rewardsVisible: features.rewards,
    tabs: tabsFor(features),
    watchPages: watchPagesFor(features),
    watchDock: watchDockFor(features),
    nextAction: NEXT_BY_PRESET[preset],
    coach: coachOut,
    notifications: notificationsFor(a.notifications, features),
    music: features.music ? a.music : a.music === "none" ? "none" : "own",
    sportMode: a.sportMode,
    sports: a.sports,
    device: a.where.includes("watch") ? "watch" : "phone",
    ghosts: features.outdoor && a.challenge !== "none",
    habits: {
      rhythm: features.habits && a.habits === "yes",
      moveReminders: features.habits,
      deskOffer: a.habits === "yes" && !features.desk,
    },
    event,
    permissions: permissionsFor(a, features, coachOut),
  };
}

/** The answers a preset stands for (the summary's one-tap reset to an archetype). Pure. */
export function answersForPreset(p: TailorPreset, base: TailorAnswers = defaultAnswers()): TailorAnswers {
  const a = cleanAnswers(base);
  switch (p) {
    case "just_run":
      return {
        ...a,
        goals: ["outdoor"],
        where: ["outside"],
        event: "no",
        challenge: "self",
        coaching: "none",
        habits: "no",
        music: a.music === "none" || a.music === "own" ? "mixes" : a.music,
      };
    case "event_prep":
      return {
        ...a,
        goals: ["event"],
        where: a.where.includes("outside") ? a.where : ["outside"],
        event: "yes",
        challenge: "self",
        coaching: "lots",
        habits: "no",
        music: a.music === "none" || a.music === "own" ? "mixes" : a.music,
      };
    case "home_workouts":
      return {
        ...a,
        goals: ["home"],
        where: ["camera"],
        event: "no",
        challenge: "self",
        coaching: "cues",
        habits: "no",
        music: a.music === "none" || a.music === "own" ? "mixes" : a.music,
      };
    case "daily_mover":
      return { ...a, goals: ["move"], where: ["outside"], event: "no", challenge: "none", coaching: "cues", habits: "yes", music: "own" };
    case "social_competitor":
      return {
        ...a,
        goals: ["compete"],
        where: ["outside"],
        event: "no",
        challenge: "city",
        coaching: "none",
        habits: "no",
        music: a.music === "none" || a.music === "own" ? "mixes" : a.music,
      };
    case "web3_earner":
      return {
        ...a,
        goals: ["earn", "compete"],
        where: ["outside"],
        event: "no",
        challenge: "city",
        coaching: "none",
        habits: "no",
        music: "own",
      };
    case "multisport_pro":
      return {
        ...a,
        goals: ["event", "outdoor"],
        sportMode: "few",
        sports: a.sports.length >= 3 ? a.sports : ["run", "ride", "swim"],
        where: ["outside", "camera", "watch"],
        event: "yes",
        challenge: "self",
        coaching: "lots",
        habits: "no",
        music: a.music === "none" || a.music === "own" ? "mixes" : a.music,
      };
    case "everything":
      return {
        ...a,
        goals: ["event", "earn"],
        sportMode: "few",
        sports: a.sports.length >= 3 ? a.sports : ["run", "ride", "swim"],
        where: ["outside", "camera", "watch"],
        event: "yes",
        challenge: "city",
        coaching: "lots",
        habits: "yes",
        music: a.music === "none" || a.music === "own" ? "mixes" : a.music,
        notifications: "more",
      };
  }
}

/**
 * Today's one primary button for the day: a planned session first; a planned rest day with Plan on; else the profile's
 * default (a plan profile with nothing planned and no rest: Train now). Pure.
 */
export function todayNextAction(p: TailorProfile, day: { planned: boolean; restDay?: boolean }): TailorNextAction {
  if (day.planned) return "planned_session";
  if (p.features.plan && day.restDay) return "rest_day";
  if (p.nextAction === "planned_session") return "train_now";
  if (p.nextAction === "camera_workout" && !p.features.camera) return "train_now";
  return p.nextAction;
}

// ── Stored on the account ───────────────────────────────────────────────────────────────────────────────────

/**
 * What the account keeps (`prefs.tailor` in /v1/me, newest `at` wins like the other synced prefs): the answers, the
 * summary's toggles, how it was made, the Developer switch, and when a review was last offered. The profile itself is
 * always recomputed (profileFromPrefs), so every device and the server agree.
 */
export interface TailorPrefs {
  v: typeof TAILOR_VERSION;
  /** Decision 12: the profile gates the apps and the server's pushes only while this is true. */
  tailorOn: boolean;
  answers: TailorAnswers;
  overrides?: Partial<TailorFeatures>;
  source: "picked" | "inferred";
  /** When these answers were saved (ISO). */
  at: string;
  /** When a review was last offered (the Today card, ISO). */
  reviewAt?: string;
}

/** True when the tailored app is switched on for this account (decision 12). Absent prefs: false (today's app). Pure. */
export const tailorActive = (prefs: Pick<TailorPrefs, "tailorOn"> | null | undefined): boolean => prefs?.tailorOn === true;

/** The profile the account's prefs stand for; null when the tailored app is off (every gate then says yes). Pure. */
export function profileFromPrefs(
  prefs: TailorPrefs | null | undefined,
  opts: Pick<TailorOptions, "deskLinked"> = {},
): TailorProfile | null {
  if (!prefs || !tailorActive(prefs)) return null;
  return tailorFromAnswers(prefs.answers, { ...opts, ...(prefs.overrides ? { overrides: prefs.overrides } : {}) });
}

// ── Gates the apps and the server call ──────────────────────────────────────────────────────────────────────

/** A feature is on (no profile: every feature is on, today's app). Pure. */
export const packOn = (p: TailorProfile | null | undefined, feature: TailorFeature): boolean => (p ? p.features[feature] : true);

export type TailorNotifyDecision = "send" | "digest" | "drop";

/** Inside quiet hours (minutes from local midnight). Pure. */
export const tailorQuiet = (localMinute: number, quiet: readonly [number, number] = TAILOR_QUIET): boolean => {
  const m = ((localMinute % 1440) + 1440) % 1440;
  return quiet[0] > quiet[1] ? m >= quiet[0] || m < quiet[1] : m >= quiet[0] && m < quiet[1];
};

/**
 * May this notification go now? `sentToday`: notifications already sent on this local day (exempt kinds not counted).
 * - exempt kinds (security, the user's own action, a desk lock their rule asked for): always sent;
 * - the kind's feature is off: dropped (decision 7: social pushes off unless Social);
 * - quiet hours (when `localMinute` is given), a kind the answer to question 10 doesn't keep, or over the budget: the
 *   evening digest when it still means something later, else dropped;
 * - priority kinds (coach call › challenge result › habit reminder) may pass the budget up to the hard cap.
 * No profile: always sent (today's app). Pure.
 */
export function notificationAllowed(
  p: TailorProfile | null | undefined,
  kind: TailorNotifyKind,
  sentToday: number,
  opts: { localMinute?: number } = {},
): TailorNotifyDecision {
  if (!p) return "send";
  const r = kindRule(kind);
  if (r.exempt) return "send";
  if (r.feature && !p.features[r.feature]) return "drop";
  const later: TailorNotifyDecision = r.late;
  if (opts.localMinute !== undefined && tailorQuiet(opts.localMinute, p.notifications.quiet)) return later;
  if (LEVEL_RANK[r.level] > LEVEL_RANK[p.notifications.level]) return later;
  if (sentToday < p.notifications.budget) return "send";
  if (r.priority !== undefined && sentToday < p.notifications.hardCap) return "send";
  return later;
}

/**
 * Where an upsell (VVake Coach Plus / Premium, minute packs, creator) may show (decision 8): on You and in features
 * that are on, never in a feature that is off. `core` = Today, workouts, sessions. No profile: anywhere. Pure.
 */
export function upsellAllowed(p: TailorProfile | null | undefined, surface: TailorFeature | "you" | "core"): boolean {
  if (!p || surface === "you" || surface === "core") return true;
  return p.features[surface];
}

/** What the apps do with the desk lock (decision 9: Focus lock + Claude lock = one Desk feature). */
export interface TailorDeskRules {
  /** The Desk feature: its screen, Today's lock card, desk pushes shown. */
  on: boolean;
  /** Offer the desk lock once (habits "Yes, remind me" and Desk off): one line in Habits, never a Today card. */
  offer: boolean;
  /** A linked Mac / Claude rule keeps working whatever the switch (nothing is removed). */
  ruleRuns: boolean;
  /** Today shows the desk card only while locked and Desk is on. */
  todayCard: (locked: boolean) => boolean;
}

/** Desk rules for this profile and the account's links. No profile: today's app (on, the rule runs). Pure. */
export function deskRules(p: TailorProfile | null | undefined, links: { linked: boolean }): TailorDeskRules {
  const on = p ? p.features.desk : true;
  return { on, offer: !!p && !on && p.habits.deskOffer && !links.linked, ruleRuns: links.linked, todayCard: (locked) => on && locked };
}

/** Desk's default for a new profile: on only when a Mac or Claude link exists (decision 9). Pure. */
export const deskDefaultOn = (links: { linked: boolean }): boolean => links.linked;

// ── The coach ───────────────────────────────────────────────────────────────────────────────────────────────

const STYLE_EN: Readonly<Record<TailorStyle, string>> = {
  calm: "calm and reassuring",
  motivating: "motivating and upbeat",
  direct: "straight to the point",
};

/**
 * One line for the coach's prompt (the dynamic part, after the cached persona): which features this athlete uses and
 * the style they asked for. The coach talks only about features that are on; the off list is there so it never
 * brings them up unless the athlete asks. No profile: empty (the coach as today). Pure.
 */
export function tailorCoachLine(p: TailorProfile | null | undefined): string {
  if (!p) return "";
  const on = TAILOR_FEATURES.filter((k) => p.features[k]);
  const off = TAILOR_FEATURES.filter((k) => !p.features[k]);
  const parts = [
    `- VVake profile ("Your VVake"): ${TAILOR_PRESET_TEXT[p.preset].en}. Features on: ${on.length ? on.join(", ") : "none beyond the basics"}.`,
    off.length
      ? ` Off: ${off.join(", ")}: never suggest or mention them unless the athlete asks (then say they can turn it on in Your VVake).`
      : "",
    ` Style: ${STYLE_EN[p.coach.style]}${p.coach.on ? "" : ", cues only (they chose no coaching: answer when asked, never start a topic)"}.`,
    p.event?.date || p.event?.type ? ` Event: ${[p.event.type, p.event.date].filter(Boolean).join(" on ")}.` : "",
  ];
  return parts.join("");
}

// ── Changes, review, inference ──────────────────────────────────────────────────────────────────────────────

export interface TailorChanges {
  on: TailorFeature[];
  off: TailorFeature[];
  tabsChanged: boolean;
  /** "This turns on Plan, off Habits." (empty when nothing changes). */
  text: { en: string; fr: string };
}

/** The preview on Settings › Your VVake before saving: which features turn on and off. Pure. */
export function previewChanges(before: TailorProfile | null | undefined, after: TailorProfile): TailorChanges {
  const was = (k: TailorFeature) => (before ? before.features[k] : true);
  const on = TAILOR_FEATURES.filter((k) => after.features[k] && !was(k));
  const off = TAILOR_FEATURES.filter((k) => !after.features[k] && was(k));
  const tabsChanged = (before?.tabs ?? ["today", "plan", "crew", "coach", "you"]).join() !== after.tabs.join();
  return { on, off, tabsChanged, text: { en: changeText(on, off, "en"), fr: changeText(on, off, "fr") } };
}

const list = (names: string[], lang: "en" | "fr") => {
  if (names.length <= 1) return names.join("");
  const and = lang === "fr" ? " et " : " and ";
  return `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}`;
};

/** "This turns on Plan and Music, off Habits." / « Ça active Plan et Musique, désactive Habitudes. » Pure. */
export function changeText(on: readonly TailorFeature[], off: readonly TailorFeature[], lang: "en" | "fr"): string {
  const n = (k: TailorFeature) => TAILOR_FEATURE_NAMES[k][lang];
  const a = on.length ? (lang === "fr" ? `active ${list(on.map(n), lang)}` : `on ${list(on.map(n), lang)}`) : "";
  const b = off.length ? (lang === "fr" ? `désactive ${list(off.map(n), lang)}` : `off ${list(off.map(n), lang)}`) : "";
  if (!a && !b) return "";
  return `${lang === "fr" ? "Ça " : "This turns "}${[a, b].filter(Boolean).join(", ")}.`;
}

/**
 * Thirty days of use, summarised by the server (GET /v1/me/usage30) or by a device from its own history (signed out).
 * Counts only, never content.
 */
export interface TailorUsage30 {
  days: number;
  sessions: {
    total: number;
    /** Sessions per sport key (top sports first when read). */
    bySport: Record<string, number>;
    /** With a distance (GPS). */
    gps: number;
    /** Camera workouts. */
    camera: number;
    /** By source. */
    watch: number;
    phone: number;
    web: number;
    /** Raced a ghost or a best. */
    ghost: number;
  };
  coach: {
    /** Chat turns and decisions the coach made with them (plan / settings proposals, memories, feedback). */
    talks: number;
    /** Coach calls answered. */
    callsAnswered: number;
    /** Live coach seconds. */
    liveSeconds: number;
    on: boolean;
    callsOn: boolean;
    chattiness: "quiet" | "normal" | "chatty";
    voiceGender: TailorVoice;
    /** prefs.workoutVoice mode, when set. */
    workoutVoice: "on" | "essential" | "off" | null;
  };
  plan: {
    /** A season plan exists. */
    season: boolean;
    /** Goals with a date still ahead. */
    goals: number;
    /** The next goal (date YYYY-MM-DD, its kind as text ≤ 40). */
    nextGoalDate: string | null;
    planChanges: number;
  };
  habits: { days: number; rhythmOn: boolean; moveReminder: boolean };
  music: { spotifyLinked: boolean };
  social: { challenges: number; clashVotes: number; crewQuests: number; rivalEvents: number; trainingChallenges: number };
  rewards: { walletLinked: boolean; pulsePicks: number };
  trainings: { runs: number; custom: number };
  desk: { linked: boolean };
  /** Notifications the account allowed (absent = on). */
  alerts: { challenge: boolean; cityClash: boolean };
}

/** An empty summary (no use yet): the shape for devices and tests. */
export function emptyUsage30(days = 30): TailorUsage30 {
  return {
    days,
    sessions: { total: 0, bySport: {}, gps: 0, camera: 0, watch: 0, phone: 0, web: 0, ghost: 0 },
    coach: {
      talks: 0,
      callsAnswered: 0,
      liveSeconds: 0,
      on: true,
      callsOn: false,
      chattiness: "normal",
      voiceGender: "woman",
      workoutVoice: null,
    },
    plan: { season: false, goals: 0, nextGoalDate: null, planChanges: 0 },
    habits: { days: 0, rhythmOn: false, moveReminder: false },
    music: { spotifyLinked: false },
    social: { challenges: 0, clashVotes: 0, crewQuests: 0, rivalEvents: 0, trainingChallenges: 0 },
    rewards: { walletLinked: false, pulsePicks: 0 },
    trainings: { runs: 0, custom: 0 },
    desk: { linked: false },
    alerts: { challenge: true, cityClash: true },
  };
}

const socialCount = (u: TailorUsage30) =>
  u.social.challenges + u.social.clashVotes + u.social.crewQuests + u.social.rivalEvents + u.social.trainingChallenges;
const coachUsed = (u: TailorUsage30) => u.coach.talks + u.coach.callsAnswered + (u.coach.liveSeconds > 0 ? 1 : 0);

/** Which features 30 days of use say are used (doc §9's table). Pure. */
export function usedFeatures(u: TailorUsage30): TailorFeatures {
  return {
    plan: u.plan.season || u.plan.goals > 0 || u.plan.planChanges > 0,
    coach: coachUsed(u) > 0,
    habits: u.habits.days >= 3 || u.habits.rhythmOn || u.habits.moveReminder,
    music: u.music.spotifyLinked,
    outdoor: u.sessions.gps > 0 || u.sessions.ghost > 0,
    camera: u.sessions.camera > 0 || u.trainings.runs > 0 || u.trainings.custom > 0,
    social: socialCount(u) > 0,
    rewards: u.rewards.walletLinked || u.rewards.pulsePicks > 0,
    desk: u.desk.linked,
  };
}

/**
 * Existing users (decision 2: infer + apply + review card + undo): the answers 30 days of use point to, for the survey
 * pre-filled. Pure.
 */
export function inferAnswers(u: TailorUsage30): TailorAnswers {
  const used = usedFeatures(u);
  const sports = Object.entries(u.sessions.bySport)
    .filter(([k, n]) => SPORT_KEY.test(k) && n > 0)
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    .map(([k]) => k)
    .slice(0, TAILOR_SPORTS_MAX);
  const goals: TailorGoal[] = [];
  const add = (g: TailorGoal) => goals.length < TAILOR_GOALS_MAX && !goals.includes(g) && goals.push(g);
  if (used.plan) add("event");
  if (used.rewards) add("earn");
  if (used.social) add("compete");
  if (used.camera && u.sessions.camera >= u.sessions.gps) add("home");
  if (used.outdoor) add("outdoor");
  if (used.camera) add("home");
  if (used.habits || !goals.length) add("move");
  const where: TailorWhere[] = [];
  if (used.outdoor) where.push("outside");
  if (used.camera) where.push("camera");
  if (u.sessions.watch > 0 && u.sessions.watch >= u.sessions.phone) where.push("watch");
  const coaching: TailorCoaching = !u.coach.on
    ? "none"
    : u.coach.callsAnswered > 0 || u.coach.liveSeconds > 0 || u.coach.chattiness === "chatty"
      ? "lots"
      : u.coach.talks > 0
        ? u.coach.chattiness === "quiet"
          ? "ask"
          : "cues"
        : "cues";
  const n = Object.values(used).filter(Boolean).length;
  return cleanAnswers({
    goals,
    sportMode: sports.length > 1 ? "few" : "one",
    sports,
    where: where.length ? where : ["outside"],
    event: u.plan.nextGoalDate || u.plan.season ? "yes" : "later",
    ...(u.plan.nextGoalDate ? { eventDate: u.plan.nextGoalDate } : {}),
    challenge: used.social
      ? u.social.clashVotes > 0
        ? "city"
        : "friends"
      : u.sessions.ghost > 0
        ? "self"
        : used.outdoor
          ? "self"
          : "none",
    coaching,
    voice: u.coach.voiceGender,
    style: "motivating",
    habits: u.habits.rhythmOn || u.habits.days >= 3 ? "yes" : u.habits.moveReminder ? "move" : "no",
    music: u.music.spotifyLinked ? "spotify" : "own",
    // Testers who used most of the app keep more notifications.
    notifications: n >= 6 ? "more" : "few",
  });
}

/**
 * The inferred profile's toggles: anything used in 30 days stays on even when the answers alone would turn it off
 * (nothing someone uses disappears after the update). Pure.
 */
export function inferredOverrides(u: TailorUsage30): Partial<TailorFeatures> {
  const used = usedFeatures(u);
  const fromAnswers = featuresFromAnswers(inferAnswers(u), { deskLinked: u.desk.linked });
  const out: Partial<TailorFeatures> = {};
  for (const k of TAILOR_FEATURES) if (used[k] && !fromAnswers[k]) out[k] = true;
  return out;
}

/** Every 3 months, and never two review prompts within this many days. */
export const TAILOR_REVIEW_DAYS = 90;
export const TAILOR_REVIEW_GAP_DAYS = 30;
/** A profile younger than this is never said to diverge (give it time). */
export const TAILOR_REVIEW_SETTLE_DAYS = 14;

export interface TailorReview {
  due: boolean;
  reason: "quarterly" | "diverged" | null;
  /** Features used while off, and features on but unused (coach on, never used). */
  diverged: { usedWhileOff: TailorFeature[]; unusedWhileOn: TailorFeature[] };
}

/**
 * The quiet "Check Your VVake" card on Today: every 3 months since the answers or the last review, or when 30 days of
 * use clearly diverge from the profile (camera workouts while Camera is off, coach on but never used…), at most one
 * prompt per 30 days. `profileAt` is the profile's `at`; `lastReviewAt` the last prompt (ISO or null). Pure.
 */
export function shouldSuggestReview(
  p: TailorProfile,
  u: TailorUsage30,
  lastReviewAt: string | null | undefined,
  now: number,
  profileAt?: string | null,
): TailorReview {
  const used = usedFeatures(u);
  const usedWhileOff = TAILOR_FEATURES.filter((k) => k !== "desk" && !p.features[k] && strongUse(k, u));
  const unusedWhileOn = TAILOR_FEATURES.filter(
    (k) => p.features[k] && !used[k] && (k === "coach" || k === "plan" || k === "social" || k === "camera") && u.sessions.total >= 4,
  );
  const diverged = { usedWhileOff, unusedWhileOn };
  const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
  const dayMs = 86_400_000;
  const last = ms(lastReviewAt);
  if (Number.isFinite(last) && now - last < TAILOR_REVIEW_GAP_DAYS * dayMs) return { due: false, reason: null, diverged };
  const since = Math.max(Number.isFinite(last) ? last : -Infinity, Number.isFinite(ms(profileAt)) ? ms(profileAt) : -Infinity);
  if (Number.isFinite(since) && now - since >= TAILOR_REVIEW_DAYS * dayMs) return { due: true, reason: "quarterly", diverged };
  const settled = !Number.isFinite(ms(profileAt)) || now - ms(profileAt) >= TAILOR_REVIEW_SETTLE_DAYS * dayMs;
  if (settled && (usedWhileOff.length > 0 || unusedWhileOn.length > 0)) return { due: true, reason: "diverged", diverged };
  return { due: false, reason: null, diverged };
}

/** Clear use of a feature (not one stray tap): 2+ camera workouts, 2+ social events, 3+ coach talks… Pure. */
function strongUse(k: TailorFeature, u: TailorUsage30): boolean {
  switch (k) {
    case "camera":
      return u.sessions.camera + u.trainings.runs >= 2;
    case "social":
      return socialCount(u) >= 2;
    case "coach":
      return coachUsed(u) >= 3;
    case "plan":
      return u.plan.season || u.plan.planChanges >= 2;
    case "outdoor":
      return u.sessions.gps >= 3;
    case "habits":
      return u.habits.days >= 5;
    case "music":
      return u.music.spotifyLinked;
    case "rewards":
      return u.rewards.walletLinked;
    default:
      return false;
  }
}

// ── Words (EN + FR) ─────────────────────────────────────────────────────────────────────────────────────────

/** The nine features' names (summary, All features, previews, coach). */
export const TAILOR_FEATURE_NAMES: Readonly<Record<TailorFeature, { en: string; fr: string }>> = {
  plan: { en: "Plan", fr: "Plan" },
  coach: { en: "Coach", fr: "Coach" },
  habits: { en: "Habits", fr: "Habitudes" },
  music: { en: "Music", fr: "Musique" },
  outdoor: { en: "Outdoor extras", fr: "Extras plein air" },
  camera: { en: "Camera & trainings", fr: "Caméra et entraînements" },
  social: { en: "Friends & city", fr: "Amis et ville" },
  rewards: { en: "Rewards & $VVAKE", fr: "Récompenses et $VVAKE" },
  desk: { en: "Desk", fr: "Bureau" },
};

/** The presets' names on the summary. */
export const TAILOR_PRESET_TEXT: Readonly<Record<TailorPreset, { en: string; fr: string }>> = {
  just_run: { en: "Just train", fr: "Juste bouger" },
  event_prep: { en: "Event prep", fr: "Objectif événement" },
  home_workouts: { en: "Home workouts", fr: "Séances à la maison" },
  daily_mover: { en: "Daily mover", fr: "Bouger chaque jour" },
  social_competitor: { en: "Social competitor", fr: "Compétiteur" },
  web3_earner: { en: "Rewards earner", fr: "Chasseur de récompenses" },
  multisport_pro: { en: "Multisport", fr: "Multisport" },
  everything: { en: "Everything", fr: "Tout VVake" },
};

/**
 * Text keys for the apps' catalogs (`tailor.<question>.title`, `tailor.<question>.<answer>`, `tailor.preset.<id>`,
 * `tailor.feature.<id>`, `tailor.summary.*`), EN + FR. The apps copy these into their own string catalogs.
 */
export const TAILOR_TEXT: Readonly<Record<string, { en: string; fr: string }>> = {
  "tailor.title": { en: "Your VVake", fr: "Ton VVake" },
  "tailor.goals.title": { en: "What brings you to VVake?", fr: "Qu'est-ce qui t'amène sur VVake ?" },
  "tailor.goals.hint": { en: "Up to 2", fr: "Jusqu'à 2" },
  "tailor.goals.move": { en: "Move more every day", fr: "Bouger plus chaque jour" },
  "tailor.goals.home": { en: "Get fit at home", fr: "Me remettre en forme à la maison" },
  "tailor.goals.event": { en: "Train for an event", fr: "M'entraîner pour un événement" },
  "tailor.goals.outdoor": { en: "Outdoor adventures", fr: "Aventures en plein air" },
  "tailor.goals.compete": { en: "Compete with others", fr: "Me mesurer aux autres" },
  "tailor.goals.earn": { en: "Earn while I move", fr: "Gagner en bougeant" },
  "tailor.sports.title": { en: "Which sports?", fr: "Quels sports ?" },
  "tailor.sports.one": { en: "Just one", fr: "Un seul" },
  "tailor.sports.few": { en: "A few", fr: "Quelques-uns" },
  "tailor.sports.search": { en: "Search a sport", fr: "Chercher un sport" },
  "tailor.where.title": { en: "Where do you usually train?", fr: "Où t'entraînes-tu d'habitude ?" },
  "tailor.where.outside": { en: "Outside with GPS", fr: "Dehors avec le GPS" },
  "tailor.where.camera": { en: "At home with the camera", fr: "À la maison avec la caméra" },
  "tailor.where.gym": { en: "At the gym", fr: "À la salle" },
  "tailor.where.watch": { en: "Anywhere, with my watch", fr: "Partout, avec ma montre" },
  "tailor.event.title": { en: "An event you’re aiming for?", fr: "Un événement en vue ?" },
  "tailor.event.yes": { en: "Yes", fr: "Oui" },
  "tailor.event.later": { en: "Maybe later", fr: "Peut-être plus tard" },
  "tailor.event.no": { en: "No", fr: "Non" },
  "tailor.eventDetails.title": { en: "Which event, and when?", fr: "Quel événement, et quand ?" },
  "tailor.eventDetails.type": { en: "Event", fr: "Événement" },
  "tailor.eventDetails.date": { en: "Date", fr: "Date" },
  "tailor.challenge.title": { en: "How do you like a challenge?", fr: "Les défis, tu les aimes comment ?" },
  "tailor.challenge.self": { en: "Just me vs myself", fr: "Moi contre moi-même" },
  "tailor.challenge.friends": { en: "With friends", fr: "Avec des amis" },
  "tailor.challenge.city": { en: "Against my city and others", fr: "Contre ma ville et les autres" },
  "tailor.challenge.none": { en: "Not really", fr: "Pas vraiment" },
  "tailor.coaching.title": { en: "How much coaching?", fr: "Combien de coaching ?" },
  "tailor.coaching.lots": { en: "Lots, talk to me", fr: "Beaucoup, parle-moi" },
  "tailor.coaching.cues": { en: "Short cues only", fr: "Juste des indications courtes" },
  "tailor.coaching.ask": { en: "Only when I ask", fr: "Seulement quand je demande" },
  "tailor.coaching.none": { en: "None", fr: "Aucun" },
  "tailor.voice.title": { en: "Coach voice & style", fr: "Voix et style du coach" },
  "tailor.voice.woman": { en: "Woman", fr: "Femme" },
  "tailor.voice.man": { en: "Man", fr: "Homme" },
  "tailor.voice.calm": { en: "Calm", fr: "Calme" },
  "tailor.voice.motivating": { en: "Motivating", fr: "Motivant" },
  "tailor.voice.direct": { en: "Straight to the point", fr: "Droit au but" },
  "tailor.habits.title": { en: "Daily habits help?", fr: "Un coup de main pour tes habitudes ?" },
  "tailor.habits.yes": { en: "Yes, remind me", fr: "Oui, rappelle-moi" },
  "tailor.habits.move": { en: "Only move reminders", fr: "Seulement les rappels pour bouger" },
  "tailor.habits.no": { en: "No", fr: "Non" },
  "tailor.music.title": { en: "Music while you train?", fr: "De la musique pendant le sport ?" },
  "tailor.music.spotify": { en: "Spotify", fr: "Spotify" },
  "tailor.music.apple": { en: "Apple Music", fr: "Apple Music" },
  "tailor.music.mixes": { en: "VVake mixes", fr: "Mix VVake" },
  "tailor.music.own": { en: "My own, no player", fr: "La mienne, sans lecteur" },
  "tailor.music.none": { en: "None", fr: "Aucune" },
  "tailor.notifications.title": { en: "How many notifications?", fr: "Combien de notifications ?" },
  "tailor.notifications.few": { en: "Only what matters (3 a day)", fr: "L'essentiel (3 par jour)" },
  "tailor.notifications.more": { en: "A few more (6)", fr: "Un peu plus (6)" },
  "tailor.notifications.all": { en: "Everything", fr: "Tout" },
  "tailor.summary.title": { en: "Here’s your VVake", fr: "Voici ton VVake" },
  "tailor.summary.rewards": { en: "Show rewards & $VVAKE", fr: "Afficher récompenses et $VVAKE" },
  "tailor.summary.rewardsHint": { en: "VV points count either way", fr: "Les points VV comptent dans tous les cas" },
  "tailor.summary.start": { en: "Start", fr: "Commencer" },
  "tailor.summary.retake": { en: "Retake the survey", fr: "Refaire le questionnaire" },
  "tailor.review.card": { en: "We tailored VVake to what you use · Check it (30 s)", fr: "On a adapté VVake à ton usage · Vérifie (30 s)" },
  "tailor.review.quarterly": { en: "Still the right VVake for you? (30 s)", fr: "Toujours le bon VVake pour toi ? (30 s)" },
  "tailor.review.undo": { en: "Undo", fr: "Annuler" },
  "tailor.off.turnOn": { en: "{feature} is off · Turn on", fr: "{feature} est désactivé · Activer" },
  "tailor.digest.title": { en: "Today on VVake", fr: "Aujourd'hui sur VVake" },
  "tailor.digest.one": { en: "1 update waiting: {first}", fr: "1 nouveauté : {first}" },
  "tailor.digest.many": { en: "{n} updates waiting: {first} and more", fr: "{n} nouveautés : {first} et plus" },
  ...Object.fromEntries(TAILOR_PRESETS.map((p) => [`tailor.preset.${p}`, TAILOR_PRESET_TEXT[p]])),
  ...Object.fromEntries(TAILOR_FEATURES.map((f) => [`tailor.feature.${f}`, TAILOR_FEATURE_NAMES[f]])),
};

/**
 * The evening digest's push: "Today on VVake" and how many updates wait, the first one's title quoted. Pure.
 */
export function digestText(titles: readonly string[], lang: "en" | "fr"): { title: string; body: string } {
  const first = (titles[0] ?? "").slice(0, 60);
  const body =
    titles.length <= 1
      ? tailorText("tailor.digest.one", lang).replace("{first}", first)
      : tailorText("tailor.digest.many", lang).replace("{n}", String(titles.length)).replace("{first}", first);
  return { title: tailorText("tailor.digest.title", lang), body };
}

/** A text key in a language (the key itself when unknown). Pure. */
export const tailorText = (key: string, lang: "en" | "fr"): string => TAILOR_TEXT[key]?.[lang] ?? key;
