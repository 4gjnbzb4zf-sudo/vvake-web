// Copied from VVFit packages/game-core/src/athleteModel.ts (15193a8f 2026-10-30) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.
/**
 * The athlete model (build 62, founder 2026-10-30, ADR-0069): what VVake learns from the athlete's own sessions and
 * health data, in the order a good coach trusts them:
 *
 * 1. Health data first (Apple Health / Health Connect, shared by the athlete): resting heart rate, HRV, VO2max
 *    estimate, a measured max heart rate, sleep.
 * 2. Session sensors next: heart rate (zones, TRIMP load, the highest heart rates seen), pace and distance (the speed
 *    the athlete really runs or walks in zone 2 and zone 4, and how many metres each heartbeat carries them).
 * 3. The athlete last, only when it is needed or gives a clearly better answer (`confirmQuestion`): "Was 186 really
 *    your max?", "How hard was that walk?" (no heart rate).
 *
 * It computes:
 * - Load per session: Banister TRIMP from heart-rate zones; without heart rate, session RPE × minutes (scaled to the
 *   same units); without either, an estimate from the sport and how it felt.
 * - Fitness / fatigue / form: 42-day and 7-day weighted averages of daily load (CTL / ATL / TSB), the acute:chronic
 *   ratio and the weekly ramp. Shown in plain words, never as a score to chase.
 * - Readiness today (fresh / ok / tired / strained) with its reasons (HRV under baseline, resting heart rate up,
 *   short sleep, a load spike, low form).
 * - Parameters with a confidence (0–1) and a source: max and resting heart rate, VO2max, HRV baseline, and per sport
 *   the easy and hard speeds (km/h, as speedZones.ts) and the aerobic efficiency (metres per beat in zone 2).
 * - A weekly trace (26 weeks) of fitness, fatigue, minutes, efficiency, VO2max and resting heart rate: the athlete's
 *   evolution, and `ModelChange`s with a reason each time a parameter moves.
 *
 * Health-first (ADR-0002, C19): the model never rewards load; proposals built on it (adaptiveProposals.ts) only
 * ever suggest, and rest is always a fine answer. Wellness guidance, not medical advice. Pure and deterministic.
 */
import { ageMaxHr, zoneOfBpm, type Profile } from "./hr";
import type { AdaptiveSummary, Readiness } from "./adaptiveSession";
import { addDays, dayNum, localIso, mondayOf } from "../living/seasonGoals";
import { sportName } from "../living/sportCatalog";

type Lang = "en" | "fr";

// ── Inputs ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface ModelSession {
  id: string;
  startMs: number;
  sport: string;
  activeS: number;
  distanceM?: number;
  avgBpm?: number;
  maxBpm?: number;
  /** Seconds in zones 1…5 (the session's own zones). */
  zoneS?: readonly number[];
  /** Effort out of 10 the athlete gave (after the session, or the in-session checks' average). */
  rpe?: number;
  /** The one-tap feel after the session. */
  feel?: "hard" | "right" | "easy";
  /** 10-s samples: t (s), m (cumulative metres), bpm. */
  samples?: readonly { t: number; m?: number; bpm?: number }[];
  adaptive?: Pick<AdaptiveSummary, "workPlannedS" | "workDoneS" | "adjust" | "rpe">;
}

/** One day of shared health numbers (numbers only, never a condition). */
export interface BodySignal {
  day: string;
  restingHr?: number;
  hrvMs?: number;
  vo2max?: number;
  sleepH?: number;
  /** A max heart rate Health measured (a test, the watch's own estimate). */
  maxHr?: number;
}

/** What the athlete has set (the server copy, the device's fresher values over it). */
export interface ModelProfile {
  age?: number;
  female?: boolean;
  restingHr?: number;
  maxHr?: number;
  /** The athlete said their max heart rate is right (a confirm answer). */
  maxHrConfirmed?: boolean;
  /** Pace / speed zones per sport, km/h (speedZones.ts easy / hard). */
  speed?: Record<string, { easy: number; hard: number }>;
  /** Effort by feel (heart rate blunted): heart-rate parameters are never learned or proposed. */
  effortByFeel?: boolean;
}

export interface ModelInput {
  sessions: readonly ModelSession[];
  signals: readonly BodySignal[];
  profile: ModelProfile;
  /** YYYY-MM-DD, the athlete's local day. */
  today: string;
  nowIso: string;
  /** The previous model, to tell what changed. */
  prev?: AthleteModel | null;
  tzOffsetMin?: number;
}

// ── Outputs ─────────────────────────────────────────────────────────────────────────────────────────────────

export type ParamSource = "health" | "sensor" | "athlete" | "default";

export interface ParamEstimate {
  value: number;
  /** 0–1: how sure. Proposals need ≥ 0.7; between 0.4 and 0.7 VVake asks first. */
  confidence: number;
  source: ParamSource;
  /** Data points behind it (sessions or days). */
  n: number;
}

export interface SportParams {
  /** Speed held in zone 2 / zone 4, km/h. */
  easyKmh?: ParamEstimate;
  hardKmh?: ParamEstimate;
  /** Metres per heartbeat in zone 2 (higher is fitter). */
  efficiency?: ParamEstimate;
}

export interface LoadState {
  /** 42-day load average (CTL): the base built. */
  fitness: number;
  /** 7-day load average (ATL): recent fatigue. */
  fatigue: number;
  /** fitness − fatigue (TSB): positive = fresh. */
  form: number;
  /** fatigue / fitness, null while the base is tiny. Above 1.5 = a spike. */
  acwr: number | null;
  /** Fitness gained over the last 7 days. */
  rampPerWeek: number;
  /** This week (Monday on): load and minutes. */
  weekLoad: number;
  weekMinutes: number;
}

export type ReadinessReason = "hrv_low" | "resting_high" | "sleep_short" | "load_spike" | "form_low" | "form_fresh";

export interface ReadinessState {
  level: Readiness;
  reasons: ReadinessReason[];
}

export interface TracePoint {
  /** The Monday of the week. */
  week: string;
  fitness: number;
  fatigue: number;
  minutes: number;
  sessions: number;
  efficiency?: number;
  vo2max?: number;
  restingHr?: number;
}

export interface AthleteModel {
  v: 1;
  updatedAt: string;
  today: string;
  load: LoadState;
  readiness: ReadinessState;
  params: {
    maxHr?: ParamEstimate;
    restingHr?: ParamEstimate;
    vo2max?: ParamEstimate;
    hrvBaseline?: ParamEstimate;
    sports: Record<string, SportParams>;
  };
  trace: TracePoint[];
  /** Sessions in the last 180 days behind it. */
  sessionsUsed: number;
}

export type ChangeReason =
  "max_seen" | "max_health" | "resting_health" | "vo2_health" | "easy_speed" | "hard_speed" | "efficiency_up" | "efficiency_down";

/** A parameter that moved, and why (kept as the athlete's history). */
export interface ModelChange {
  at: string;
  /** maxHr, restingHr, vo2max, or `<sport>.easyKmh` / `.hardKmh` / `.efficiency`. */
  param: string;
  from?: number;
  to: number;
  reason: ChangeReason;
  source: ParamSource;
}

// ── Load ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Heart-rate reserve at the middle of zones 1…5. */
const ZONE_MID = [0.55, 0.65, 0.75, 0.85, 0.95];
/** sRPE (effort × minutes) to TRIMP units: an hour at effort 3 ≈ an hour in zone 2. */
export const SRPE_TO_TRIMP = 0.45;
const FEEL_RPE = { easy: 3, right: 5, hard: 7 } as const;
const CALM = ["yoga", "meditation", "stretching", "mobility", "tai-chi", "pilates", "mind-and-body", "breathwork"];
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

const trimpPerMin = (hrr: number, female?: boolean) => hrr * (female ? 0.86 * Math.exp(1.67 * hrr) : 0.64 * Math.exp(1.92 * hrr));

/** A session's training load (TRIMP units) and how it was found. Pure. */
export function sessionLoad(s: ModelSession, p: ModelProfile): { load: number; method: "trimp" | "srpe" | "estimate" } {
  const min = Math.max(0, s.activeS) / 60;
  if (s.zoneS && s.zoneS.length === 5 && s.zoneS.some((z) => finite(z) && z > 0) && !p.effortByFeel) {
    let t = 0;
    for (let i = 0; i < 5; i++) t += (Math.max(0, s.zoneS[i] ?? 0) / 60) * trimpPerMin(ZONE_MID[i]!, p.female);
    return { load: r1(t), method: "trimp" };
  }
  const rest = p.restingHr ?? 60;
  const max = p.maxHr ?? ageMaxHr(p.age ?? 35, p.female);
  if (finite(s.avgBpm) && s.avgBpm > rest && !p.effortByFeel) {
    const hrr = Math.min(1, (s.avgBpm - rest) / Math.max(1, max - rest));
    return { load: r1(min * trimpPerMin(hrr, p.female)), method: "trimp" };
  }
  const rpe = finite(s.rpe) ? s.rpe : s.feel ? FEEL_RPE[s.feel] : undefined;
  if (rpe !== undefined) return { load: r1(min * rpe * SRPE_TO_TRIMP), method: "srpe" };
  const guess = CALM.includes(s.sport) ? 2 : s.sport === "walk" ? 3 : 4;
  return { load: r1(min * guess * SRPE_TO_TRIMP), method: "estimate" };
}

// ── The model ───────────────────────────────────────────────────────────────────────────────────────────────

const CTL_DAYS = 42;
const ATL_DAYS = 7;
const HISTORY_DAYS = 180;
const TRACE_WEEKS = 26;
const PACE_DAYS = 42;
const MIN_PAIRS = 60;
const SPEED_SPORTS = new Set([
  "run",
  "trail-run",
  "walk",
  "hike",
  "nordic-walking",
  "ride",
  "gravel",
  "mountain-bike",
  "treadmill",
  "indoor-run",
]);

const median = (xs: readonly number[]) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** The heart profile the zones of the model's own sums use. */
function heartProfile(p: ModelProfile): Profile {
  const age = p.age ?? 35;
  const rest = p.restingHr ?? 60;
  return { age, restingHr: rest, ...(p.maxHr ? { maxHr: p.maxHr } : {}), ...(p.female ? { female: true } : {}) };
}

/** Zone-2 / zone-4 speeds and metres per beat of one session (pairs of 10-s samples). */
function sessionSpeeds(s: ModelSession, hp: Profile) {
  const z2: number[] = [];
  const z4: number[] = [];
  const eff: number[] = [];
  const pts = s.samples ?? [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[k + 1]!;
    const dt = b.t - a.t;
    if (!(dt > 0 && dt <= 30) || !finite(a.m) || !finite(b.m) || !finite(a.bpm) || a.bpm < 40) continue;
    const v = (b.m - a.m) / dt;
    if (!(v > 0.3 && v < 25)) continue;
    const z = zoneOfBpm(a.bpm, hp);
    if (z === 2) {
      z2.push(v);
      eff.push((v * 60) / a.bpm);
    } else if (z === 4) z4.push(v);
  }
  return { z2, z4, eff };
}

/** Builds the model from the athlete's sessions and health days. Pure. */
export function buildAthleteModel(input: ModelInput): { model: AthleteModel; changes: ModelChange[] } {
  const { profile: p, today } = input;
  const tz = input.tzOffsetMin ?? 0;
  const todayN = dayNum(today);
  const sessions = input.sessions.filter((s) => finite(s.startMs) && s.activeS > 0);
  const dayOf = (ms: number) => localIso(ms, tz);
  const recent = sessions.filter((s) => {
    const d = dayNum(dayOf(s.startMs));
    return d <= todayN && d > todayN - HISTORY_DAYS;
  });

  // Daily loads → fitness / fatigue.
  const daily = new Map<number, number>();
  const dailyMin = new Map<number, number>();
  for (const s of recent) {
    const d = dayNum(dayOf(s.startMs));
    daily.set(d, (daily.get(d) ?? 0) + sessionLoad(s, p).load);
    dailyMin.set(d, (dailyMin.get(d) ?? 0) + s.activeS / 60);
  }
  let ctl = 0;
  let atl = 0;
  const ctlAt = new Map<number, number>();
  const atlAt = new Map<number, number>();
  for (let d = todayN - HISTORY_DAYS + 1; d <= todayN; d++) {
    const l = daily.get(d) ?? 0;
    ctl += (l - ctl) / CTL_DAYS;
    atl += (l - atl) / ATL_DAYS;
    ctlAt.set(d, ctl);
    atlAt.set(d, atl);
  }
  const monday = dayNum(mondayOf(today));
  let weekLoad = 0;
  let weekMinutes = 0;
  for (let d = monday; d <= todayN; d++) {
    weekLoad += daily.get(d) ?? 0;
    weekMinutes += dailyMin.get(d) ?? 0;
  }
  const load: LoadState = {
    fitness: r1(ctl),
    fatigue: r1(atl),
    form: r1(ctl - atl),
    acwr: ctl >= 5 ? r2(atl / ctl) : null,
    rampPerWeek: r1(ctl - (ctlAt.get(todayN - 7) ?? 0)),
    weekLoad: Math.round(weekLoad),
    weekMinutes: Math.round(weekMinutes),
  };

  // Health parameters.
  const sig = input.signals
    .filter((g) => {
      const d = dayNum(g.day);
      return d <= todayN && d > todayN - 60;
    })
    .sort((a, b) => dayNum(a.day) - dayNum(b.day));
  const within = (n: number) => sig.filter((g) => dayNum(g.day) > todayN - n);
  const params: AthleteModel["params"] = { sports: {} };
  const rhr14 = within(14)
    .map((g) => g.restingHr)
    .filter((x): x is number => finite(x) && x >= 30 && x <= 120);
  if (rhr14.length >= 5)
    params.restingHr = {
      value: Math.round(median(rhr14)),
      confidence: r2(Math.min(0.9, 0.3 + (rhr14.length / 14) * 0.6)),
      source: "health",
      n: rhr14.length,
    };
  else if (p.restingHr) params.restingHr = { value: p.restingHr, confidence: 0.4, source: "athlete", n: 0 };
  const vo2 = within(30)
    .map((g) => g.vo2max)
    .filter((x): x is number => finite(x) && x > 10 && x < 95);
  if (vo2.length) params.vo2max = { value: r1(vo2[vo2.length - 1]!), confidence: 0.7, source: "health", n: vo2.length };
  const hrv30 = within(30)
    .map((g) => g.hrvMs)
    .filter((x): x is number => finite(x) && x > 5 && x < 300);
  if (hrv30.length >= 7)
    params.hrvBaseline = {
      value: Math.round(mean(hrv30)),
      confidence: r2(Math.min(0.9, hrv30.length / 30 + 0.3)),
      source: "health",
      n: hrv30.length,
    };

  // Max heart rate: Health's measured one, else the highest seen in sessions (two within 4 beats agree).
  if (!p.effortByFeel) {
    const ageMax = ageMaxHr(p.age ?? 35, p.female);
    const healthMax = sig.map((g) => g.maxHr).filter((x): x is number => finite(x) && x >= 120 && x <= 225);
    const seen = recent
      .map((s) => s.maxBpm)
      .filter((x): x is number => finite(x) && x >= 120 && x <= Math.min(225, ageMax + 25))
      .sort((a, b) => b - a);
    if (p.maxHrConfirmed && p.maxHr) params.maxHr = { value: p.maxHr, confidence: 0.95, source: "athlete", n: 1 };
    else if (seen.length >= 2 && seen[0]! - seen[1]! <= 4)
      params.maxHr = {
        value: Math.round(seen[1]!),
        confidence: r2(Math.min(0.9, 0.7 + seen.filter((x) => seen[0]! - x <= 4).length * 0.05)),
        source: "sensor",
        n: seen.length,
      };
    else if (healthMax.length)
      params.maxHr = { value: Math.round(healthMax[healthMax.length - 1]!), confidence: 0.7, source: "health", n: healthMax.length };
    else if (seen.length >= 1)
      params.maxHr = { value: Math.round(seen[0]!), confidence: seen.length >= 2 ? 0.55 : 0.45, source: "sensor", n: seen.length };
  }

  // Speeds and efficiency per sport (last 6 weeks), with the athlete's own heart profile.
  const hp = heartProfile(p);
  const effBySession = new Map<string, number>();
  if (!p.effortByFeel) {
    const bySport = new Map<string, ModelSession[]>();
    for (const s of recent)
      if (SPEED_SPORTS.has(s.sport) && s.samples?.length) {
        const list = bySport.get(s.sport) ?? [];
        list.push(s);
        bySport.set(s.sport, list);
      }
    for (const [sport, list] of bySport) {
      const z2: number[] = [];
      const z4: number[] = [];
      const eff: number[] = [];
      let n2 = 0;
      let n4 = 0;
      for (const s of list) {
        const r = sessionSpeeds(s, hp);
        if (r.eff.length >= 6) effBySession.set(s.id, median(r.eff));
        if (dayNum(dayOf(s.startMs)) <= todayN - PACE_DAYS) continue;
        if (r.z2.length >= 6) {
          z2.push(...r.z2);
          eff.push(...r.eff);
          n2++;
        }
        if (r.z4.length >= 6) {
          z4.push(...r.z4);
          n4++;
        }
      }
      const sp: SportParams = {};
      if (z2.length >= MIN_PAIRS && n2 >= 2) {
        sp.easyKmh = { value: r1(median(z2) * 3.6), confidence: r2(Math.min(0.9, 0.4 + n2 * 0.1)), source: "sensor", n: n2 };
        sp.efficiency = { value: r2(median(eff)), confidence: r2(Math.min(0.9, 0.4 + n2 * 0.1)), source: "sensor", n: n2 };
      }
      if (z4.length >= MIN_PAIRS && n4 >= 2)
        sp.hardKmh = { value: r1(median(z4) * 3.6), confidence: r2(Math.min(0.85, 0.35 + n4 * 0.1)), source: "sensor", n: n4 };
      if (Object.keys(sp).length) params.sports[sport] = sp;
    }
  }

  // Readiness.
  const reasons: ReadinessReason[] = [];
  let score = 0;
  const last3 = within(3);
  const hrv3 = last3.map((g) => g.hrvMs).filter((x): x is number => finite(x) && x > 5);
  if (params.hrvBaseline && params.hrvBaseline.n >= 14 && hrv3.length >= 2 && mean(hrv3) < params.hrvBaseline.value * 0.9) {
    reasons.push("hrv_low");
    score += 2;
  }
  const rhr3 = last3.map((g) => g.restingHr).filter((x): x is number => finite(x) && x >= 30);
  const rhr30 = within(30)
    .map((g) => g.restingHr)
    .filter((x): x is number => finite(x) && x >= 30);
  if (rhr30.length >= 10 && rhr3.length >= 2 && mean(rhr3) >= median(rhr30) + 5) {
    reasons.push("resting_high");
    score += 2;
  }
  const sleep3 = last3.map((g) => g.sleepH).filter((x): x is number => finite(x) && x > 0);
  if (sleep3.length >= 2 && mean(sleep3) < 6) {
    reasons.push("sleep_short");
    score += 1;
  }
  if (load.acwr !== null && load.acwr > 1.5 && ctl >= 10) {
    reasons.push("load_spike");
    score += 2;
  }
  if (load.form < -25 && ctl >= 15) {
    reasons.push("form_low");
    score += 1;
  }
  if (score === 0 && load.form > 5 && ctl >= 10) reasons.push("form_fresh");
  const level: Readiness = score >= 4 ? "strained" : score >= 2 ? "tired" : reasons.includes("form_fresh") ? "fresh" : "ok";

  // Weekly trace.
  const trace: TracePoint[] = [];
  for (let w = TRACE_WEEKS - 1; w >= 0; w--) {
    const start = monday - w * 7;
    const end = Math.min(start + 6, todayN);
    if (start < todayN - HISTORY_DAYS + 1) continue;
    const inWeek = recent.filter((s) => {
      const d = dayNum(dayOf(s.startMs));
      return d >= start && d <= end;
    });
    let minutes = 0;
    for (let d = start; d <= end; d++) minutes += dailyMin.get(d) ?? 0;
    const effs = inWeek.map((s) => effBySession.get(s.id)).filter(finite);
    const wsig = sig.filter((g) => {
      const d = dayNum(g.day);
      return d >= start && d <= end;
    });
    const v = wsig.map((g) => g.vo2max).filter(finite);
    const r = wsig.map((g) => g.restingHr).filter(finite);
    trace.push({
      week: addDays(today, start - todayN),
      fitness: r1(ctlAt.get(end) ?? 0),
      fatigue: r1(atlAt.get(end) ?? 0),
      minutes: Math.round(minutes),
      sessions: inWeek.length,
      ...(effs.length ? { efficiency: r2(median(effs)) } : {}),
      ...(v.length ? { vo2max: r1(v[v.length - 1]!) } : {}),
      ...(r.length ? { restingHr: Math.round(median(r)) } : {}),
    });
  }

  const model: AthleteModel = {
    v: 1,
    updatedAt: input.nowIso,
    today,
    load,
    readiness: { level, reasons },
    params,
    trace,
    sessionsUsed: recent.length,
  };
  return { model, changes: modelChanges(input.prev ?? null, model, input.nowIso) };
}

/** What moved between two models, past small noise. Pure. */
export function modelChanges(prev: AthleteModel | null, next: AthleteModel, at: string): ModelChange[] {
  const out: ModelChange[] = [];
  const cmp = (
    param: string,
    a: ParamEstimate | undefined,
    b: ParamEstimate | undefined,
    minDelta: number,
    reason: (from: number | undefined, to: number) => ChangeReason,
    rel = false,
  ) => {
    if (!b || b.confidence < 0.5) return;
    const delta = a ? Math.abs(b.value - a.value) : Infinity;
    if (a && (rel ? delta / Math.max(1e-9, a.value) : delta) < minDelta) return;
    out.push({ at, param, ...(a ? { from: a.value } : {}), to: b.value, reason: reason(a?.value, b.value), source: b.source });
  };
  const P = prev?.params;
  cmp("maxHr", P?.maxHr, next.params.maxHr, 2, () => (next.params.maxHr?.source === "health" ? "max_health" : "max_seen"));
  cmp("restingHr", P?.restingHr, next.params.restingHr, 2, () => "resting_health");
  cmp("vo2max", P?.vo2max, next.params.vo2max, 1, () => "vo2_health");
  for (const [sport, sp] of Object.entries(next.params.sports)) {
    const ps = P?.sports?.[sport];
    cmp(`${sport}.easyKmh`, ps?.easyKmh, sp.easyKmh, 0.03, () => "easy_speed", true);
    cmp(`${sport}.hardKmh`, ps?.hardKmh, sp.hardKmh, 0.03, () => "hard_speed", true);
    cmp(
      `${sport}.efficiency`,
      ps?.efficiency,
      sp.efficiency,
      0.04,
      (f, t) => (f !== undefined && t < f ? "efficiency_down" : "efficiency_up"),
      true,
    );
  }
  return out;
}

// ── Asking the athlete ──────────────────────────────────────────────────────────────────────────────────────

export type ConfirmKey = "max_hr" | "rpe_session";

export interface ConfirmQuestion {
  key: ConfirmKey;
  /** max_hr: the beat count to confirm. */
  value?: number;
  /** rpe_session: the session asked about. */
  sessionId?: string;
  sport?: string;
  minutes?: number;
  /** The answers offered: max_hr yes / no; rpe_session easy / moderate / hard. */
  answers: readonly string[];
}

/**
 * At most one question a day, and only when the answer changes something: a max heart rate seen once above the one
 * set (a glitch or the truth?), or a session of 15 minutes or more in the last day with no heart rate and no feel.
 * Pure.
 */
export function confirmQuestion(
  model: AthleteModel,
  p: ModelProfile,
  sessions: readonly ModelSession[],
  asked: readonly { key: string; at: string; ref?: string }[],
  nowMs: number,
): ConfirmQuestion | null {
  const today = model.today;
  if (asked.some((a) => a.at.slice(0, 10) === today)) return null;
  const m = model.params.maxHr;
  const setMax = p.maxHr ?? ageMaxHr(p.age ?? 35, p.female);
  if (!p.effortByFeel && !p.maxHrConfirmed && m && m.source === "sensor" && m.confidence < 0.7 && m.value >= setMax + 5) {
    const recentAsk = asked.find((a) => a.key === "max_hr" && dayNum(a.at.slice(0, 10)) > dayNum(today) - 30);
    if (!recentAsk) return { key: "max_hr", value: m.value, answers: ["yes", "no"] };
  }
  const last = [...sessions]
    .filter(
      (s) =>
        nowMs - s.startMs < 86_400_000 &&
        s.activeS >= 900 &&
        !finite(s.avgBpm) &&
        !s.zoneS?.some((z) => z > 0) &&
        s.rpe === undefined &&
        !s.feel,
    )
    .sort((a, b) => b.startMs - a.startMs)[0];
  if (last && !asked.some((a) => a.key === "rpe_session" && a.ref === last.id))
    return {
      key: "rpe_session",
      sessionId: last.id,
      sport: last.sport,
      minutes: Math.round(last.activeS / 60),
      answers: ["easy", "moderate", "hard"],
    };
  return null;
}

export function confirmQuestionText(q: ConfirmQuestion, lang: Lang, sportName?: string): string {
  const fr = lang === "fr";
  if (q.key === "max_hr")
    return fr
      ? `Ton cœur est monté à ${q.value} une fois. C’est bien ton max, ou un bug du capteur ?`
      : `Your heart reached ${q.value} once. Is that really your max, or a sensor glitch?`;
  const what = sportName ?? (fr ? "séance" : "session");
  return fr ? `Ta ${what} de ${q.minutes} min, c’était facile, moyen ou dur ?` : `Your ${q.minutes}-min ${what}: easy, moderate or hard?`;
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────

const READINESS_WORD: Record<Readiness, { en: string; fr: string }> = {
  fresh: { en: "Fresh", fr: "En forme" },
  ok: { en: "Ready", fr: "Prêt" },
  tired: { en: "A bit tired", fr: "Un peu fatigué" },
  strained: { en: "Needs rest", fr: "Besoin de repos" },
};
export const readinessWord = (r: Readiness, lang: Lang) => READINESS_WORD[r][lang];

const REASON_LINE: Record<ReadinessReason, { en: string; fr: string }> = {
  hrv_low: { en: "Your heart-rate variability is under your usual level.", fr: "Ta variabilité cardiaque est sous ton niveau habituel." },
  resting_high: { en: "Your resting heart rate is up 5 beats or more.", fr: "Ton cœur au repos est 5 battements plus haut ou plus." },
  sleep_short: { en: "Under 6 hours of sleep these nights.", fr: "Moins de 6 heures de sommeil ces nuits-ci." },
  load_spike: {
    en: "This week is much bigger than your usual weeks.",
    fr: "Cette semaine est bien plus chargée que tes semaines habituelles.",
  },
  form_low: { en: "Fatigue has built up over the last days.", fr: "La fatigue s’est accumulée ces derniers jours." },
  form_fresh: { en: "You are rested: a good day for a key session.", fr: "Tu es reposé : bon jour pour une séance clé." },
};
export const readinessReasonLine = (r: ReadinessReason, lang: Lang) => REASON_LINE[r][lang];

/** "Max heart rate 182 → 186: seen twice in your runs" — the history line of a change. Pure. */
export function modelChangeLine(c: ModelChange, lang: Lang, units: "metric" | "imperial" = "metric"): string {
  const fr = lang === "fr";
  const [sportKey, key] = c.param.includes(".") ? (c.param.split(".") as [string, string]) : ["", c.param];
  const sport = sportKey ? sportName(sportKey, lang) : "";
  const kmh = (v: number) => (units === "imperial" ? `${r1(v / 1.609344)} mph` : `${r1(v)} km/h`);
  const fromTo = (f: (v: number) => string) => (c.from !== undefined ? `${f(c.from)} → ${f(c.to)}` : f(c.to));
  const why: Record<ChangeReason, { en: string; fr: string }> = {
    max_seen: { en: "seen in your sessions", fr: "vu pendant tes séances" },
    max_health: { en: "measured by Health", fr: "mesuré par Santé" },
    resting_health: { en: "your mornings in Health", fr: "tes matins dans Santé" },
    vo2_health: { en: "from Health", fr: "d’après Santé" },
    easy_speed: { en: "what you hold in zone 2", fr: "ce que tu tiens en zone 2" },
    hard_speed: { en: "what you hold in zone 4", fr: "ce que tu tiens en zone 4" },
    efficiency_up: {
      en: "more distance per heartbeat: aerobic fitness up",
      fr: "plus de distance par battement : ton endurance progresse",
    },
    efficiency_down: {
      en: "less distance per heartbeat (heat, fatigue or a break)",
      fr: "moins de distance par battement (chaleur, fatigue ou pause)",
    },
  };
  const w = why[c.reason][lang];
  switch (key) {
    case "maxHr":
      return fr ? `FC max ${fromTo(String)} : ${w}` : `Max heart rate ${fromTo(String)}: ${w}`;
    case "restingHr":
      return fr ? `FC au repos ${fromTo(String)} : ${w}` : `Resting heart rate ${fromTo(String)}: ${w}`;
    case "vo2max":
      return fr ? `VO2max ${fromTo(String)} : ${w}` : `VO2max ${fromTo(String)}: ${w}`;
    case "easyKmh":
      return fr ? `${sport} : vitesse facile ${fromTo(kmh)} (${w})` : `${sport}: easy speed ${fromTo(kmh)} (${w})`;
    case "hardKmh":
      return fr ? `${sport} : vitesse soutenue ${fromTo(kmh)} (${w})` : `${sport}: hard speed ${fromTo(kmh)} (${w})`;
    case "efficiency":
      return fr ? `${sport} : ${w}` : `${sport}: ${w}`;
  }
  return c.param;
}

// ── For other features (nutrition) ──────────────────────────────────────────────────────────────────────────

export interface TrainingContext {
  /** Load done today and this week (TRIMP units), minutes this week. */
  todayLoad: number;
  weekLoad: number;
  weekMinutes: number;
  fitness: number;
  form: number;
  readiness: Readiness;
  /** building: fitness rising; steady; recovering: a lighter stretch (fitness falling or a deload). */
  phase: "building" | "steady" | "recovering";
  /** Rough training energy today, kcal (≈ 1 kcal per TRIMP unit × 7 for a 70 kg athlete; a guide only). */
  trainingKcalToday: number;
}

/**
 * What nutrition (and anything else) may read about training without touching the model: today's and the week's
 * load, the trend, readiness. Pure.
 */
export function trainingContext(model: AthleteModel, todayLoad: number, weightKg = 70): TrainingContext {
  const ramp = model.load.rampPerWeek;
  return {
    todayLoad: Math.round(todayLoad),
    weekLoad: model.load.weekLoad,
    weekMinutes: model.load.weekMinutes,
    fitness: model.load.fitness,
    form: model.load.form,
    readiness: model.readiness.level,
    phase: ramp > 1 ? "building" : ramp < -1 ? "recovering" : "steady",
    trainingKcalToday: Math.round(todayLoad * 7 * (weightKg / 70)),
  };
}

/** Today's load from the sessions of the day. Pure. */
export function todayLoad(sessions: readonly ModelSession[], p: ModelProfile, today: string, tzOffsetMin = 0): number {
  return sessions.filter((s) => localIso(s.startMs, tzOffsetMin) === today).reduce((a, s) => a + sessionLoad(s, p).load, 0);
}
