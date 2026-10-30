// Copied from VVFit packages/game-core/src/coachMemory.ts (c525a71a 2026-10-30) by scripts/sync-coach-core.ts. Do not edit: re-sync.
/**
 * The coach's durable memory of an athlete (build 60, ADR-0068; extends ADR-0038's ≤ 20 lines).
 *
 * What a good human coach keeps in their head: facts ("works night shifts"), preferences ("hates treadmills"),
 * injuries and niggles ("left knee sore since Tue 28 Oct", never a diagnosis), life events ("wedding 15 Nov"),
 * goals, wins, what worked or didn't, and how the athlete likes to be coached ("straight talk, no cheerleading").
 * Extracted by the server after each conversation (and from a stated preference, an approved change, an app
 * milestone), shown in You › Coach memory ("What your coach remembers"), editable and deletable there, cleared by a
 * fresh start, deleted with the account.
 *
 * Retrieval: `recallFor` picks the few lines that matter for what the athlete just said + the always-on ones (how
 * they like to be coached, current injuries, events coming up), and `dueCheckIns` gives the coach its "How's the knee
 * since Tuesday?" moments. Pure.
 */

type Lang = "en" | "fr";

export const MEMORY_KINDS = ["fact", "preference", "injury", "life_event", "goal", "win", "worked", "didnt_work", "style"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** said: the athlete said it; agreed: an approved proposal; extracted: the after-conversation pass; app: a milestone;
 *  edited: the athlete corrected it in You › Coach memory (an edited line is never overwritten by extraction). */
export const MEMORY_SOURCES = ["said", "agreed", "extracted", "app", "edited"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export interface CoachMemoryItem {
  id: string;
  kind: MemoryKind;
  /** One short line in the athlete's language, ≤ 140 characters. */
  text: string;
  /** The day it is about (an injury's start, an event's date, a win's day), YYYY-MM-DD. */
  on?: string;
  /** injury: still bothering them (false once they say it's fine; then it is history, kept 60 days). */
  active?: boolean;
  source: MemorySource;
  createdAt: string;
  updatedAt?: string;
  /** Last time the coach checked in about it (injury, life event). */
  checkedAt?: string;
}

/** How many lines per kind are kept (oldest first out, edited lines last). */
export const MEMORY_CAPS: Readonly<Record<MemoryKind, number>> = {
  fact: 15,
  preference: 15,
  injury: 8,
  life_event: 10,
  goal: 6,
  win: 15,
  worked: 8,
  didnt_work: 8,
  style: 4,
};
export const MEMORY_TOTAL_MAX = Object.values(MEMORY_CAPS).reduce((a, b) => a + b, 0);
export const MEMORY_TEXT_MAX = 140;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/**
 * Words that name a diagnosis or a medical condition (not a body part or a feeling): kept off the server. "Knee sore"
 * and "tired after night shifts" are fine; "diabetes", "depression", "ACL tear" are not (ADR-0038 health rule).
 */
const DIAGNOSIS = [
  /\b(diabet\w*|asthm\w*|epilep\w*|cancer|tumou?r|hiv|aids|hepatitis|depress\w*|anxiety disorder|bipolar|schizo\w*|adhd|autis\w*|anorex\w*|bulimi\w*|pregnan\w*|arrhythmia|afib|atrial fibrillation|heart (disease|failure|condition)|hypertension|cardiomyopathy|multiple sclerosis|parkinson\w*|crohn\w*|arthritis|osteopor\w*|herni\w*|torn|tear|fracture\w*|acl|mcl|meniscus|tendinitis|tendinopathy|plantar fasciitis|concussion|surgery|operation)\b/,
  /\b(diabète|asthme|épilep\w*|cancer|tumeur|vih|sida|hépatite|dépress\w*|trouble anxieux|bipolaire|schizo\w*|tdah|autis\w*|anorex\w*|boulimi\w*|enceinte|grossesse|arythmie|fibrillation|insuffisance cardiaque|hypertension|sclérose|parkinson|crohn|arthrite|arthrose|ostéopor\w*|hernie|déchir\w*|fracture\w*|ligament croisé|ménisque|tendinite|fasciite|commotion|opération|chirurgie)\b/u,
];

/** Does the line name a diagnosis or condition (so it isn't stored)? Pure. */
export const namesDiagnosis = (t: string): boolean => DIAGNOSIS.some((re) => re.test(t.toLowerCase()));

/** One item as stored, or null when unusable (empty, too short, names a diagnosis, unknown kind). Pure. */
export function cleanMemoryItem(raw: unknown): Omit<CoachMemoryItem, "id" | "createdAt" | "source"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = MEMORY_KINDS.find((k) => k === r.kind);
  if (!kind || typeof r.text !== "string") return null;
  const text = r.text
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MEMORY_TEXT_MAX)
    .trim();
  if (text.length < 3 || namesDiagnosis(text)) return null;
  const on = typeof r.on === "string" && DAY.test(r.on) ? r.on : undefined;
  const active = kind === "injury" ? r.active !== false : undefined;
  return { kind, text, ...(on ? { on } : {}), ...(active !== undefined ? { active } : {}) };
}

const words = (t: string): string[] =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(
  "the and for with that this have has had was were are you your but not they them then than from into about just when what who how why can could would should will very really also some more most much any all its our out over too yes non oui les des une est pas que qui pour avec dans sur mon mes ton tes son ses mais plus tres bien comme fait etre avoir elle il nous vous ils elles cette ces aux par".split(
    " ",
  ),
);

/** How alike two lines are (0–1, word overlap). Pure. */
export function similarity(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

export interface MergeResult {
  add: Omit<CoachMemoryItem, "id" | "createdAt">[];
  /** Existing ids to update with the new text / on / active. */
  update: { id: string; text: string; on?: string; active?: boolean }[];
  /** Existing ids to drop to stay under the caps (oldest first; edited lines last). */
  drop: string[];
}

/**
 * New lines from the extraction pass merged into what the coach already remembers: the same thing again updates the
 * old line (never a duplicate); an athlete-edited line is never overwritten; per-kind caps keep the newest. Pure.
 */
export function mergeMemory(
  existing: readonly CoachMemoryItem[],
  incoming: readonly unknown[],
  source: MemorySource = "extracted",
): MergeResult {
  const out: MergeResult = { add: [], update: [], drop: [] };
  const live = existing.map((e) => ({ ...e }));
  for (const raw of incoming) {
    const c = cleanMemoryItem(raw);
    if (!c) continue;
    const same = live.find((e) => e.kind === c.kind && similarity(e.text, c.text) >= 0.6);
    if (same) {
      if (same.source === "edited") continue;
      if (same.text !== c.text || same.on !== c.on || same.active !== c.active) {
        out.update.push({
          id: same.id,
          text: c.text,
          ...(c.on ? { on: c.on } : {}),
          ...(c.active !== undefined ? { active: c.active } : {}),
        });
        Object.assign(same, c);
      }
      continue;
    }
    out.add.push({ ...c, source });
    live.push({ ...c, id: `new${out.add.length}`, source, createdAt: "9999" });
  }
  for (const kind of MEMORY_KINDS) {
    const of = live.filter((e) => e.kind === kind);
    const over = of.length - MEMORY_CAPS[kind];
    if (over <= 0) continue;
    const order = [...of].sort(
      (a, b) => (a.source === "edited" ? 1 : 0) - (b.source === "edited" ? 1 : 0) || a.createdAt.localeCompare(b.createdAt),
    );
    for (const e of order.slice(0, over)) {
      if (e.id.startsWith("new")) {
        const i = Number(e.id.slice(3)) - 1;
        out.add[i] = undefined as never;
      } else out.drop.push(e.id);
    }
  }
  out.add = out.add.filter(Boolean);
  return out;
}

/** Always in the coach's head, whatever is said: style, current injuries, events in the next 21 days or just past. */
function alwaysOn(items: readonly CoachMemoryItem[], today: string): CoachMemoryItem[] {
  const t = dayNum(today);
  return items.filter(
    (m) =>
      m.kind === "style" ||
      (m.kind === "injury" && m.active !== false) ||
      (m.kind === "goal" && (!m.on || dayNum(m.on) >= t - 3)) ||
      (m.kind === "life_event" && m.on && dayNum(m.on) >= t - 3 && dayNum(m.on) <= t + 21),
  );
}

const KIND_WEIGHT: Readonly<Record<MemoryKind, number>> = {
  style: 1,
  injury: 1,
  goal: 0.9,
  life_event: 0.8,
  preference: 0.8,
  didnt_work: 0.7,
  worked: 0.7,
  fact: 0.6,
  win: 0.5,
};

/**
 * The lines for this turn: the always-on ones + the `k` most relevant to what was just said (word overlap, kind,
 * recency). Ordered by kind for the prompt. Pure.
 */
export function recallFor(items: readonly CoachMemoryItem[], said: string, today: string, k = 6): CoachMemoryItem[] {
  const base = alwaysOn(items, today);
  const t = dayNum(today);
  const scored = items
    .filter((m) => !base.includes(m))
    .map((m) => {
      const age = Math.max(0, t - dayNum((m.updatedAt ?? m.createdAt).slice(0, 10)));
      const rel = similarity(said, m.text);
      return { m, s: rel * 2 + KIND_WEIGHT[m.kind] * 0.5 + Math.max(0, 1 - age / 120) * 0.3 };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.m);
  const all = [...base, ...scored];
  return MEMORY_KINDS.flatMap((kind) => all.filter((m) => m.kind === kind));
}

const KIND_LABEL: Readonly<Record<MemoryKind, { en: string; fr: string }>> = {
  style: { en: "How they like to be coached", fr: "Comment iel aime être coaché·e" },
  injury: { en: "Body (not a diagnosis)", fr: "Corps (pas un diagnostic)" },
  goal: { en: "Goals", fr: "Objectifs" },
  life_event: { en: "Life", fr: "Vie" },
  preference: { en: "Likes and dislikes", fr: "Goûts" },
  fact: { en: "About them", fr: "À son sujet" },
  worked: { en: "What worked", fr: "Ce qui a marché" },
  didnt_work: { en: "What didn't", fr: "Ce qui n’a pas marché" },
  win: { en: "Wins", fr: "Victoires" },
};

/** The section title of a kind (You › Coach memory groups by these). Pure. */
export const memoryKindLabel = (k: MemoryKind, lang: Lang) => KIND_LABEL[k][lang];

/** The prompt block ("What you remember about them") from recalled lines; '' when none. Pure. */
export function memoryBlock(items: readonly CoachMemoryItem[]): string {
  if (!items.length) return "";
  const lines = items.map(
    (m) => `- [${m.kind}${m.on ? ` ${m.on}` : ""}${m.kind === "injury" && m.active === false ? " healed" : ""}] ${m.text}`,
  );
  return `What you remember about them (use it naturally, never recite it; never guess beyond it):\n${lines.join("\n")}`;
}

export interface CheckIn {
  id: string;
  kind: "injury" | "life_event" | "goal";
  /** A hint for the model ("ask how the left knee feels since Tue 28 Oct"), not words to read out. */
  hint: string;
}

/**
 * The coach's natural check-ins now: an active injury 2+ days old not asked about for 2 days; a life event that
 * happened 0–3 days ago and wasn't asked about; a goal event within 3 days (before) or just done. At most `max`. Pure.
 */
export function dueCheckIns(items: readonly CoachMemoryItem[], today: string, max = 2): CheckIn[] {
  const t = dayNum(today);
  const asked = (m: CoachMemoryItem, days: number) => !!m.checkedAt && t - dayNum(m.checkedAt.slice(0, 10)) < days;
  const out: CheckIn[] = [];
  for (const m of items) {
    if (m.kind === "injury" && m.active !== false) {
      const since = m.on ? t - dayNum(m.on) : t - dayNum(m.createdAt.slice(0, 10));
      if (since >= 2 && !asked(m, 2))
        out.push({ id: m.id, kind: "injury", hint: `ask how it feels now: "${m.text}"${m.on ? ` (since ${m.on})` : ""}` });
    } else if (m.kind === "life_event" && m.on) {
      const d = t - dayNum(m.on);
      if (d >= 0 && d <= 3 && !asked(m, 7)) out.push({ id: m.id, kind: "life_event", hint: `ask how it went: "${m.text}" (${m.on})` });
    } else if (m.kind === "goal" && m.on) {
      const d = dayNum(m.on) - t;
      if (d >= -2 && d <= 3 && !asked(m, 3))
        out.push({
          id: m.id,
          kind: "goal",
          hint: d >= 0 ? `their goal event is in ${d} day(s): "${m.text}"` : `their goal event just happened: "${m.text}", ask how it went`,
        });
    }
  }
  const rank = { injury: 0, goal: 1, life_event: 2 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, max);
}

// ── The relationship arc ──────────────────────────────────────────────────────────────────────────────────

export type RelationshipStage = "new" | "building" | "steady" | "long_term";

/**
 * Where the coach and the athlete are (days since the first session together, conversations had): new (first week:
 * ask more, explain more), building (learning what works), steady (shorter, more direct, references to their
 * history), long_term (3+ months: celebrate the journey, ask bigger questions). Pure.
 */
export function relationshipStage(daysTogether: number, conversations: number): RelationshipStage {
  if (daysTogether < 7 || conversations < 3) return "new";
  if (daysTogether < 30 || conversations < 10) return "building";
  if (daysTogether < 90) return "steady";
  return "long_term";
}

/** The prompt line for the stage. Pure. */
export function stageLine(stage: RelationshipStage): string {
  switch (stage) {
    case "new":
      return "You are just getting to know them: ask one good question at a time, explain your reasons briefly, learn how they like to be coached.";
    case "building":
      return "You know them a little: use what you remember, check what worked, keep learning their preferences.";
    case "steady":
      return "You know them well: be direct and brief, refer to their history and wins naturally, no generic advice.";
    case "long_term":
      return "You have coached them for months: speak like a long-time coach, connect today to their journey, celebrate how far they came.";
  }
}

/** App milestones the coach keeps as wins (source app), from journey / celebrations events. */
export const MILESTONE_KINDS = [
  "first_workout",
  "sessions_10",
  "sessions_50",
  "sessions_100",
  "streak_7",
  "streak_30",
  "first_5k",
  "first_10k",
  "first_half",
  "first_marathon",
  "goal_done",
  "level_up",
  "comeback",
] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

/** The memory line of a milestone (celebrations.ts has its own milestoneLine), in the athlete's language. Pure. */
export function milestoneMemoryLine(m: MilestoneKind, lang: Lang, detail?: string): string {
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const d = detail ? ` (${detail})` : "";
  switch (m) {
    case "first_workout":
      return L(`First workout with VVake${d}`, `Première séance avec VVake${d}`);
    case "sessions_10":
      return L(`10 workouts done${d}`, `10 séances faites${d}`);
    case "sessions_50":
      return L(`50 workouts done${d}`, `50 séances faites${d}`);
    case "sessions_100":
      return L(`100 workouts done${d}`, `100 séances faites${d}`);
    case "streak_7":
      return L(`First 7-day streak${d}`, `Première série de 7 jours${d}`);
    case "streak_30":
      return L(`30-day streak${d}`, `Série de 30 jours${d}`);
    case "first_5k":
      return L(`First 5 km${d}`, `Premiers 5 km${d}`);
    case "first_10k":
      return L(`First 10 km${d}`, `Premiers 10 km${d}`);
    case "first_half":
      return L(`First half marathon${d}`, `Premier semi-marathon${d}`);
    case "first_marathon":
      return L(`First marathon${d}`, `Premier marathon${d}`);
    case "goal_done":
      return L(`Goal reached${d}`, `Objectif atteint${d}`);
    case "level_up":
      return L(`Level up${d}`, `Niveau supérieur${d}`);
    case "comeback":
      return L(`Came back after a break${d}`, `Retour après une pause${d}`);
  }
}
