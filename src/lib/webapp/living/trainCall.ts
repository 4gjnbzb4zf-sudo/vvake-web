// Copied from VVFit packages/game-core/src/trainCall.ts (0bee920f 2026-10-30) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * "Train together over a call" (ADR-0071 §A, docs/05-tech/places-and-meetups.md "Train together over a call"): a
 * meetup in mode `call` has no meeting point. The people who said "I'm in" each train wherever they are, talk on a
 * group audio call (phone or browser; the watch shows the board, audio stays on the phone or headphones) and share a
 * live board: each person's time, distance or reps and heart-rate zone, a start countdown and cheers.
 *
 * Health first:
 * - The board is never a ranking: rows stay in join order, nobody is "behind", no colour judges a pace.
 * - Anyone can leave quietly: their row just disappears, nobody is told.
 * - The coach is off by default; when the host turns it on, only scripted lines (TRAIN_CALL_COACH_LINES) are spoken,
 *   on each phone, never a model, so it costs nothing and is the same for everyone.
 * - No pushes beyond the meetup's own invite and reminders (the ones they accepted), nothing during Quiet.
 *
 * Audio is a separate, budgeted layer (trainCallAudioDecision): when it's off, over budget or unavailable, the board
 * still works ("The call isn't available right now. The board still works.").
 *
 * Pure TypeScript: the API, the phone and the web share these rules.
 */
export type MeetupMode = "place" | "call";

/** Seconds between a person's board beats (their stats out, the board back). */
export const TRAIN_CALL_BEAT_S = 10;
/** A row not heard from for this long is shown as "no signal" (never dropped: they may be in a tunnel). */
export const TRAIN_CALL_STALE_S = 45;
/** The shared start countdown (the host taps Start). */
export const TRAIN_CALL_COUNTDOWN_S = 10;
/** The board opens this long before the start and stays open this long after the end. */
export const TRAIN_CALL_OPEN_BEFORE_MIN = 15;
export const TRAIN_CALL_OPEN_AFTER_MIN = 60;
/** Cheers: one per sender every 5 s at most; the board keeps the last 20 minutes. */
export const CALL_CHEER_EVERY_S = 5;
export const CALL_CHEER_KEEP_MIN = 20;
/** Board rows and cheers are deleted once the meetup ended this long ago (the daily cleanup; ≤ 2 days in practice). */
export const TRAIN_CALL_BOARD_KEEP_H = 24;
/** Metering: a beat adds the time since the previous one, at most this much (a missed beat isn't billed twice). */
export const TRAIN_CALL_METER_MAX_S = 30;

export const CALL_CHEER_KINDS = ["clap", "fire", "strong", "smile"] as const;
export type CallCheerKind = (typeof CALL_CHEER_KINDS)[number];
export const CALL_CHEER_EMOJI: Readonly<Record<CallCheerKind, string>> = { clap: "👏", fire: "🔥", strong: "💪", smile: "🙂" };
export const CALL_CHEER_LABEL: Readonly<Record<CallCheerKind, { en: string; fr: string }>> = {
  clap: { en: "Clap", fr: "Bravo" },
  fire: { en: "On fire", fr: "En feu" },
  strong: { en: "Strong", fr: "Costaud" },
  smile: { en: "Smile", fr: "Sourire" },
};

export type BoardState = "waiting" | "running" | "paused" | "done" | "left";
export const BOARD_STATES: readonly BoardState[] = ["waiting", "running", "paused", "done", "left"];

export interface BoardRow {
  userId: string;
  name: string;
  castId?: string;
  state: BoardState;
  /** Elapsed seconds at `atMs` (counted on while running). */
  elapsedS: number;
  atMs: number;
  distanceM?: number | null;
  reps?: number | null;
  /** Heart-rate zone 1–5 (absent without a heart rate). */
  zone?: number | null;
  /** Joined the board (join order). */
  joinedMs: number;
  /** In the audio call now. */
  audio?: boolean;
}

export interface BoardView extends Omit<BoardRow, "joinedMs"> {
  me: boolean;
  /** Not heard from for TRAIN_CALL_STALE_S. */
  stale: boolean;
  elapsedNowS: number;
}

/** Elapsed seconds now: what they said, counted on while running. */
export const boardElapsed = (r: Pick<BoardRow, "state" | "elapsedS" | "atMs">, nowMs: number): number =>
  Math.max(
    0,
    Math.floor(r.elapsedS + (r.state === "running" ? Math.max(0, Math.min(nowMs - r.atMs, TRAIN_CALL_STALE_S * 1000)) / 1000 : 0)),
  );

/** The board as shown: people who left are hidden (quietly), the rest in join order. Never sorted by performance. */
export function boardView(rows: readonly BoardRow[], me: string, nowMs: number): BoardView[] {
  return [...rows]
    .filter((r) => r.state !== "left")
    .sort((a, b) => a.joinedMs - b.joinedMs || a.userId.localeCompare(b.userId))
    .map(({ joinedMs: _j, ...r }) => ({
      ...r,
      me: r.userId === me,
      stale: nowMs - r.atMs > TRAIN_CALL_STALE_S * 1000,
      elapsedNowS: boardElapsed(r, nowMs),
    }));
}

/** Is the board open for this meetup now? From 15 min before the start to 60 min after the end, not cancelled. */
export function callOpen(m: { mode?: MeetupMode; status: string; startMs: number; durationMin: number }, nowMs: number): boolean {
  if (m.mode !== "call" || m.status === "cancelled") return false;
  return (
    nowMs >= m.startMs - TRAIN_CALL_OPEN_BEFORE_MIN * 60_000 && nowMs <= m.startMs + (m.durationMin + TRAIN_CALL_OPEN_AFTER_MIN) * 60_000
  );
}

export type CallCountdown = { phase: "none" } | { phase: "counting"; secondsLeft: number } | { phase: "go" } | { phase: "started" };

/** The shared countdown: none before Start, then 10…1, "Go" for 2 s, then started. */
export function callCountdown(goAtMs: number | null | undefined, nowMs: number): CallCountdown {
  if (!goAtMs || !Number.isFinite(goAtMs)) return { phase: "none" };
  if (nowMs < goAtMs) return { phase: "counting", secondsLeft: Math.min(TRAIN_CALL_COUNTDOWN_S, Math.ceil((goAtMs - nowMs) / 1000)) };
  if (nowMs < goAtMs + 2000) return { phase: "go" };
  return { phase: "started" };
}

/** A beat's numbers, cleaned (the API trusts nothing; absurd values are dropped, not refused). */
export function cleanBeat(b: { state: string; elapsedS?: number; distanceM?: number | null; reps?: number | null; zone?: number | null }): {
  state: BoardState;
  elapsedS: number;
  distanceM: number | null;
  reps: number | null;
  zone: number | null;
} {
  const state = (BOARD_STATES as readonly string[]).includes(b.state) ? (b.state as BoardState) : "waiting";
  const n = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max ? x : null);
  return {
    state,
    elapsedS: Math.floor(n(b.elapsedS, 86_400) ?? 0),
    distanceM: n(b.distanceM, 500_000) === null ? null : Math.round(b.distanceM!),
    reps: n(b.reps, 100_000) === null ? null : Math.round(b.reps!),
    zone: typeof b.zone === "number" && Number.isInteger(b.zone) && b.zone >= 1 && b.zone <= 5 ? b.zone : null,
  };
}

/** Audio minutes a beat adds: the time since the previous beat in the call, at most TRAIN_CALL_METER_MAX_S. */
export function callMeterMinutes(prevMs: number | null | undefined, nowMs: number): number {
  if (!prevMs || !Number.isFinite(prevMs) || nowMs <= prevMs) return 0;
  return Math.min(nowMs - prevMs, TRAIN_CALL_METER_MAX_S * 1000) / 60_000;
}

export type AudioSwitch = "off" | "testers" | "on";
export type AudioDecision = "ok" | "off" | "tester_only" | "not_configured" | "global_cap" | "user_cap";

/**
 * May this person join the audio call now? The switch (default off), then the configuration (the founder creates the
 * Realtime app), then the daily caps in participant-minutes: everyone's together, then this account's. Pure.
 */
export function trainCallAudioDecision(o: {
  switch: AudioSwitch;
  tester: boolean;
  configured: boolean;
  globalUsedMin: number;
  globalCapMin: number;
  userUsedMin: number;
  userCapMin: number;
}): AudioDecision {
  if (o.switch === "off") return "off";
  if (o.switch === "testers" && !o.tester) return "tester_only";
  if (!o.configured) return "not_configured";
  if (o.globalCapMin <= 0 || o.globalUsedMin >= o.globalCapMin) return "global_cap";
  if (o.userCapMin <= 0 || o.userUsedMin >= o.userCapMin) return "user_cap";
  return "ok";
}

/** The athlete's line when audio isn't available (the board always works). */
export function audioUnavailableText(d: Exclude<AudioDecision, "ok">, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  if (d === "user_cap")
    return fr
      ? "Tu as utilisé tes minutes d’appel du jour. Le tableau marche toujours."
      : "You’ve used today’s call minutes. The board still works.";
  return fr
    ? "L’appel n’est pas disponible pour le moment. Le tableau marche toujours."
    : "The call isn’t available right now. The board still works.";
}

/**
 * Estimated egress for a call (Cloudflare Realtime bills egress only): each person receives everyone else's audio.
 * `kbps` per Opus voice stream with overhead (≈ 40). Returns GB for `minutes` of an `n`-person call.
 */
export function callEgressGb(n: number, minutes: number, kbps = 40): number {
  if (n < 2) return 0;
  return (n * (n - 1) * kbps * 1000 * 60 * minutes) / 8 / 1e9;
}

export type CallCoachEvent = "go" | "half" | "last_five" | "done";

/** The optional coach (off by default): scripted lines only, spoken on each phone. Several per event, rotated. */
export const TRAIN_CALL_COACH_LINES: Readonly<Record<CallCoachEvent, { en: readonly string[]; fr: readonly string[] }>> = {
  go: {
    en: ["Off you go, together. Your pace, your way.", "Go! Everyone at their own rhythm."],
    fr: ["C’est parti, ensemble. Ton rythme, à ta façon.", "Go ! Chacun à son rythme."],
  },
  half: {
    en: ["Halfway there, all of you. Nice work.", "Half done. Breathe easy and keep it comfortable."],
    fr: ["À mi-chemin, tout le monde. Beau travail.", "La moitié est faite. Respire et reste à l’aise."],
  },
  last_five: {
    en: ["Five minutes left. Finish the way that feels right.", "Last five minutes. Enjoy them."],
    fr: ["Plus que cinq minutes. Termine comme tu le sens.", "Les cinq dernières minutes. Profites-en."],
  },
  done: {
    en: ["Time’s up. Well done, everyone.", "That’s the session. Thanks for training together."],
    fr: ["C’est l’heure. Bravo à tous.", "Séance terminée. Merci d’avoir fait ça ensemble."],
  },
};

/** Which coach line is due (once each): `fired` holds the events already spoken. */
export function dueCallCoachEvent(
  goAtMs: number | null | undefined,
  durationMin: number,
  nowMs: number,
  fired: readonly CallCoachEvent[],
): CallCoachEvent | null {
  if (!goAtMs) return null;
  const t = (nowMs - goAtMs) / 60_000;
  const due: CallCoachEvent[] = [];
  if (t >= 0 && t < 1) due.push("go");
  if (t >= durationMin / 2 && t < durationMin / 2 + 1 && durationMin >= 10) due.push("half");
  if (t >= durationMin - 5 && t < durationMin - 4 && durationMin >= 15) due.push("last_five");
  if (t >= durationMin && t < durationMin + 2) due.push("done");
  return due.find((e) => !fired.includes(e)) ?? null;
}

export const callCoachLine = (e: CallCoachEvent, lang: "en" | "fr", seed = 0): string => {
  const l = TRAIN_CALL_COACH_LINES[e][lang];
  return l[Math.abs(seed) % l.length]!;
};

export const TRAIN_CALL_TEXT = {
  modePlace: { en: "Meet at a place", fr: "Se retrouver quelque part" },
  modeCall: { en: "Train together over a call", fr: "S’entraîner ensemble par appel" },
  modeCallHint: {
    en: "Everyone trains where they are and talks on a group call. A shared board shows each person’s time, distance and zone.",
    fr: "Chacun s’entraîne où il est et parle en appel de groupe. Un tableau partagé montre le temps, la distance et la zone de chacun.",
  },
  overCall: { en: "Over a call", fr: "Par appel" },
  coach: { en: "Coach on the call", fr: "Coach dans l’appel" },
  coachHint: {
    en: "Off by default. When on, the coach says a few short lines at the start, halfway and the end.",
    fr: "Désactivé par défaut. Activé, le coach dit quelques phrases courtes au début, à mi-parcours et à la fin.",
  },
  joinCall: { en: "Join the call", fr: "Rejoindre l’appel" },
  board: { en: "Board", fr: "Tableau" },
  start: { en: "Start the countdown", fr: "Lancer le compte à rebours" },
  go: { en: "Go", fr: "C’est parti" },
  mute: { en: "Mute", fr: "Couper le micro" },
  unmute: { en: "Unmute", fr: "Activer le micro" },
  audioOn: { en: "Join the audio", fr: "Rejoindre l’audio" },
  audioOff: { en: "Leave the audio", fr: "Quitter l’audio" },
  leave: { en: "Leave quietly", fr: "Partir discrètement" },
  leaveHint: { en: "Nobody is told. Leave whenever you like.", fr: "Personne n’est prévenu. Pars quand tu veux." },
  noPressure: { en: "Everyone at their own pace: this board isn’t a race.", fr: "Chacun à son rythme : ce tableau n’est pas une course." },
  you: { en: "You", fr: "Toi" },
  waiting: { en: "Getting ready", fr: "Se prépare" },
  paused: { en: "Paused", fr: "En pause" },
  done: { en: "Done", fr: "Fini" },
  stale: { en: "No signal", fr: "Pas de signal" },
  cheer: { en: "Cheer", fr: "Encourager" },
  audioOnPhone: { en: "Audio is on your phone", fr: "Le son passe par ton téléphone" },
  notOpen: { en: "The board opens 15 minutes before the start.", fr: "Le tableau ouvre 15 minutes avant le début." },
  privacy: {
    en: "Audio is never recorded. Only the people in this meetup see the board, and it’s deleted within two days.",
    fr: "L’audio n’est jamais enregistré. Seules les personnes du rendez-vous voient le tableau, et il est supprimé dans les deux jours.",
  },
} as const satisfies Record<string, { en: string; fr: string }>;
