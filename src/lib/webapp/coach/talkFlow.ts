/**
 * "Talk to your coach" on the web (VVFit ADR-0068, build 60): the pure decisions behind the talk sheet
 * (components/webapp/TalkSheet.tsx). Which way it opens (live / push-to-talk / text, game-core talkMode plus what this
 * browser can do), the push-to-talk loop, a said or typed answer to the card on screen (game-core cardDecision, every
 * mode), which cards run on arrival, and the places an outing card offers. Pure.
 */
import { needsConfirm, cardDecision, type CoachAppAction } from "./coachActions";
import { talkMode, type TalkModePick } from "./coachTalk";
import type { CoachTierKey } from "@/lib/coachPlus";
import { hasPlaces, placeDistanceM, placeTitle, type Place } from "../places";

export type Lang = "en" | "fr";

// ── Which way it opens ─────────────────────────────────────────────────────────────────────────────────────────

export interface WebTalkInput {
  tier: CoachTierKey;
  /** GET /v1/coach/live `talk.live` (the server switch, already for this account) and its seconds left. */
  liveOn: boolean;
  leftS?: number;
  online: boolean;
  /** The browser can open the microphone for the live call (getUserMedia + Web Audio, a secure page). */
  canHear: boolean;
  /** The browser has speech recognition for push-to-talk (Web Speech). */
  canListen: boolean;
  /** The microphone was refused in this visit. */
  micDenied?: boolean;
  /** The athlete chose typing (this browser), or `?live=0`-style forcing of push-to-talk. */
  prefersText?: boolean;
  forcePtt?: boolean;
}

export interface WebTalkPick extends TalkModePick {
  /** No speech recognition in this browser (push-to-talk would have nothing to hear with): text instead. */
  noSpeech?: boolean;
}

/**
 * game-core talkMode, then the browser: live needs the microphone stream (cloud speech-to-text through the live
 * call); push-to-talk needs the browser's speech recognition (no server speech-to-text outside a live call). Pure.
 */
export function webTalkMode(i: WebTalkInput): WebTalkPick {
  const micAllowed = !i.micDenied && (i.canHear || i.canListen);
  const pick = talkMode({
    tier: i.tier,
    liveOn: i.liveOn && !i.forcePtt,
    ...(i.leftS !== undefined ? { leftS: i.leftS } : {}),
    online: i.online,
    micAllowed,
    prefersText: i.prefersText,
  });
  if (pick.mode === "live" && !i.canHear)
    return i.canListen ? { mode: "ptt", why: "no_mic" } : { mode: "text", why: "no_mic", noSpeech: true };
  if (pick.mode === "ptt" && !i.canListen) return { mode: "text", why: pick.why === "offline" ? "offline" : "no_mic", noSpeech: true };
  if (pick.mode === "ptt" && i.forcePtt && !pick.why) return { mode: "ptt", why: "off" };
  return pick;
}

// ── Push-to-talk ───────────────────────────────────────────────────────────────────────────────────────────────

export type PttPhase = "idle" | "listening" | "thinking" | "speaking";
export type PttEvent =
  | { type: "tap" }
  | { type: "heard"; text: string }
  | { type: "silence" }
  | { type: "reply"; spoken: boolean }
  | { type: "spoken" }
  | { type: "error" };

/**
 * The push-to-talk loop: tap → listening; the end of speech is detected (no second tap) → thinking; the reply →
 * speaking (aloud) or idle; tapping while it speaks stops it and listens; tapping while it listens stops listening.
 * Returns the next phase and what to do (`stopVoice`: hush the coach; `listen`: open the recogniser; `send`: the words
 * to send; `stopListening`). Pure.
 */
export function pttNext(
  phase: PttPhase,
  ev: PttEvent,
): { phase: PttPhase; stopVoice?: boolean; listen?: boolean; stopListening?: boolean; send?: string } {
  switch (ev.type) {
    case "tap":
      if (phase === "listening") return { phase: "idle", stopListening: true };
      if (phase === "thinking") return { phase };
      return { phase: "listening", listen: true, ...(phase === "speaking" ? { stopVoice: true } : {}) };
    case "heard": {
      const t = ev.text.trim();
      if (phase !== "listening") return { phase };
      return t ? { phase: "thinking", send: t } : { phase: "idle" };
    }
    case "silence":
      return phase === "listening" ? { phase: "idle" } : { phase };
    case "reply":
      return phase === "thinking" ? { phase: ev.spoken ? "speaking" : "idle" } : { phase };
    case "spoken":
      return phase === "speaking" ? { phase: "idle" } : { phase };
    case "error":
      return { phase: "idle", ...(phase === "listening" ? { stopListening: true } : {}) };
  }
}

// ── The card on screen ─────────────────────────────────────────────────────────────────────────────────────────

/** "Oui vas-y", "yes go ahead", "non pas maintenant": both halves read, kept when they agree (the phone's rule). */
const DOUBLE = /^\s*(yes|yeah|ok|okay|oui|ouais|no|non)[\s,.!]+(.+)$/i;
function doubled(text: string): ReturnType<typeof cardDecision> {
  const m = DOUBLE.exec(text);
  if (!m) return null;
  const a = cardDecision(m[1]!);
  const b = cardDecision(m[2]!);
  if (a && (!b || b.decision === a.decision) && a.decision !== "change") {
    // "oui vas-y": the second half is a go-ahead the first already said; "no, not now": the same.
    return /^(vas[- ]y|go( ahead)?|do it|fais[- ]le|let'?s go|on y va|pas maintenant|not now|thanks|merci)\b/i.test(m[2]!.trim()) || b
      ? a
      : null;
  }
  return null;
}

export type CardAnswer = { kind: "confirm" } | { kind: "cancel" } | { kind: "change"; rest: string } | null;

/**
 * A said or typed answer to the card on screen, in every mode (ADR-0068): "yes" confirms (only a card the web can
 * run now), "no" cancels, "no, rather Thursday" cancels and asks the coach for a new offer with `rest`, anything else
 * goes to the coach and the card stays. Pure.
 */
export function cardAnswer(text: string, card: { pending: boolean; runnable: boolean } | null): CardAnswer {
  if (!card?.pending) return null;
  const d = cardDecision(text) ?? doubled(text);
  if (!d) return null;
  if (d.decision === "confirm") return card.runnable ? { kind: "confirm" } : null;
  if (d.decision === "cancel") return { kind: "cancel" };
  return { kind: "change", rest: d.rest ?? "" };
}

/**
 * Runs on arrival, no buttons (the athlete asked): pause / resume a workout, a summary, places. Everything that waits
 * for a yes (needsConfirm) shows its buttons; open_screen stays the coach's link. Pure.
 */
export const runsOnArrival = (a: Pick<CoachAppAction, "type" | "op">): boolean => a.type !== "open_screen" && !needsConfirm(a);

/** The card's id for the live server (`card{id,state}`, answer_card): the tool call's, else one made here. */
export const cardIdOf = (args: Record<string, unknown>, toolId: string): string =>
  typeof args.id === "string" && /^[\w-]{1,64}$/.test(args.id) ? args.id : toolId;

// ── Places for an outing (show_places / find_places) ───────────────────────────────────────────────────────────

export interface OutingPlace {
  name: string;
  /** How far away it starts (km, one decimal). */
  awayKm: number;
  /** A route's length (km), when OpenStreetMap has it. */
  loopKm?: number;
  climbM?: number;
  /** Rough time for the route on foot (hike pacing: 4 km/h + 1 h per 600 m of climb). */
  minutes?: number;
  lat: number;
  lon: number;
}

/** Hike pacing (the coach's knowledge note): 4 km/h plus an hour for every 600 m of climb. Pure. */
export const hikeMinutes = (km: number, climbM = 0): number => Math.round((km / 4) * 60 + (Math.max(0, climbM) / 600) * 60);

/**
 * 1–3 places for the outing the athlete described: nearest first within `maxTravelKm` (default 25 km), routes whose
 * time on foot fits `minutes` (± 25 %) ahead of the rest when the outing has a duration. Pure.
 */
export function outingPlaces(
  places: readonly Place[],
  at: { lat: number; lon: number },
  o: { sport?: string; minutes?: number; distanceKm?: number; maxTravelKm?: number },
  lang: Lang,
  max = 3,
): OutingPlace[] {
  const limitKm = o.maxTravelKm ?? 25;
  const foot = !o.sport || ["hike", "walk", "run", "trail"].includes(o.sport);
  const rows = places
    .map((p) => {
      const awayKm = Math.round(placeDistanceM(at, p) / 100) / 10;
      const loopKm = p.lengthM ? Math.round(p.lengthM / 100) / 10 : undefined;
      const minutes = loopKm && foot ? hikeMinutes(loopKm) : undefined;
      const fits =
        (o.minutes && minutes ? Math.abs(minutes - o.minutes) <= o.minutes * 0.25 : false) ||
        (o.distanceKm && loopKm ? Math.abs(loopKm - o.distanceKm) <= o.distanceKm * 0.25 : false);
      const name = (p.name ?? "").trim() || placeTitle(p, lang);
      return { p, awayKm, loopKm, minutes, fits, name };
    })
    .filter((r) => r.awayKm <= limitKm)
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.awayKm - b.awayKm);
  const seen = new Set<string>();
  const out: OutingPlace[] = [];
  for (const r of rows) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push({
      name: r.name,
      awayKm: r.awayKm,
      ...(r.loopKm ? { loopKm: r.loopKm } : {}),
      ...(r.minutes ? { minutes: r.minutes } : {}),
      lat: r.p.lat,
      lon: r.p.lon,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** What find_places returns to the live coach (no coordinates: names and distances only). Pure. */
export const placesForCoach = (list: readonly OutingPlace[]) =>
  list.map(({ name, awayKm, loopKm, climbM, minutes }) => ({
    name,
    awayKm,
    ...(loopKm ? { loopKm } : {}),
    ...(climbM ? { climbM } : {}),
    ...(minutes ? { minutes } : {}),
  }));

/** The places search's sport for an outing: hikes and walks search walking routes and trails. Pure. */
export const placesSportOf = (sport: string | undefined): string => (sport && hasPlaces(sport) ? sport : "hike");
