/**
 * Which voice says what in the web app (pure: voicePick.test.ts).
 *
 * - The account's coach voice (You → Coach voice in the app, `/v1/me` coach.voice): "coach" is VVake's recorded voice
 *   (the phone's voice pack and cheer library, the same for every account, free included), "device" the device's own
 *   voice. Plus coach replies come in the coach's voice too (the API decides, within its daily quota).
 * - A workout cue is a recorded voice-pack line (`pack`), a run of cheer-library lines (`lib`, game-core cheerVoice.ts
 *   ids), or a line with exact numbers registered with the API (`line`: Plus synthesizes it once, everyone gets it once
 *   it's recorded, else the browser voice says it).
 * - The browser voice, the fallback: the best installed voice for the language (Premium, Enhanced, Natural, Neural,
 *   Google), never a novelty one, never the default robot when a better one is there.
 */

export type VoiceMode = "coach" | "device" | "off";

/** The voice this browser speaks in: off with the voice toggle off, else the account's choice (coach by default). */
export function voiceMode(voiceOn: boolean, accountVoice: string | null | undefined): VoiceMode {
  if (!voiceOn) return "off";
  return accountVoice === "device" ? "device" : "coach";
}

// ── What a cue sounds like ─────────────────────────────────────────────────────────────────────────────────────

export type PackId = "start" | "zone1" | "zone2" | "zone3" | "zone4" | "zone5" | "paused" | "resumed" | "energy" | "done";

/** A line to say: its words (on screen, and for the browser voice) and where its recording comes from. */
export interface Spoken {
  text: string;
  /** A voice-pack cue (GET /v1/voice/pack). */
  pack?: PackId;
  /** Cheer-library lines played in order (GET /v1/voice/library). */
  lib?: string[];
}

const range = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let v = a; v <= b; v += step) out.push(v);
  return out;
};
/** game-core cheerVoice.ts SAY_DOMAINS / SAY_DOMAINS_IMPERIAL (the recorded values). */
const KM = new Set([...range(1, 50, 1), ...range(55, 100, 5)]);
const MILE = new Set([...range(1, 30, 1), ...range(35, 60, 5)]);
const PACE = { min: 120, max: 900 };
const MIPACE = { min: 190, max: 1450 };

/** The split's seconds to the nearest 5 (the recorded paces), or null outside them. */
export function paceBucket(seconds: number, imperial: boolean): number | null {
  if (!Number.isFinite(seconds)) return null;
  const v = Math.round(seconds / 5) * 5;
  const d = imperial ? MIPACE : PACE;
  return v >= d.min && v <= d.max ? v : null;
}

/**
 * A full km (or mile) as the phone's cheers say it: "3 kilometres done." then "That one in 5:15." (the split's own
 * time). A number past the recorded ones: "Another kilometre." instead.
 */
export function splitLines(n: number, splitS: number | null, imperial: boolean): string[] {
  const p = imperial ? "mi" : "km";
  const out = [(imperial ? MILE : KM).has(n) ? `${p}.1:${n}` : `${p}.next`];
  const pace = splitS === null ? null : paceBucket(splitS, imperial);
  if (pace !== null) out.push(`${p}.pace:${pace}`);
  return out;
}

/** "zone3" for zone 3; null outside 1–5. */
export const zonePack = (z: number): PackId | null => (z >= 1 && z <= 5 ? (`zone${z}` as PackId) : null);

// ── The browser's best voice ───────────────────────────────────────────────────────────────────────────────────

export interface BrowserVoice {
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
}

/** macOS/iOS novelty and Eloquence voices: never the coach. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

/** How good a voice sounds: 4 premium, 3 enhanced/natural/neural, 2 Google (online only), 1 any other local voice. */
export function voiceRank(v: BrowserVoice, online: boolean): number {
  if (NOVELTY.test(v.name)) return -1;
  if (/premium/i.test(v.name)) return 4;
  if (/enhanced|natural|neural|wavenet/i.test(v.name)) return v.localService || online ? 3 : -1;
  if (/google/i.test(v.name)) return online ? 2 : -1;
  return v.localService ? 1 : online ? 0 : -1;
}

/**
 * The coach's recorded voice is the one the athlete chose, a woman's or a man's (ADR-0056, coachVoices.ts
 * coachVoiceProfile), so the browser voice standing in is of the same gender when the browser has one. Browsers don't
 * say a voice's gender: it is read from the names they list (Apple, Google, Microsoft, Android); a name not listed is
 * neither.
 */
const FEMALE =
  /\b(samantha|ava|allison|susan|zoe|zoé|karen|moira|tessa|fiona|victoria|serena|nicky|kate|stephanie|joelle|evelyn|noelle|siri female|aria|jenny|michelle|emma|ana|sonia|libby|natasha|clara|amélie|amelie|audrey|aurélie|aurelie|marie|julie|hortense|denise|eloise|élise|elise|brigitte|celine|céline|chantal|sylvie|vivienne|female|femme)\b/i;
const MALE =
  /\b(alex|daniel|fred|tom|aaron|arthur|evan|nathan|oliver|gordon|rishi|lee|ralph|junior|guy|david|mark|james|ryan|eric|christopher|roger|brian|andrew|steffan|thomas|jacques|paul|henri|claude|nicolas|antoine|yves|alain|gérard|gerard|remy|rémy|male|homme)\b/i;

/** 2 the wanted gender, 1 unknown, 0 the other ("Google US English" and "Google français" are women's voices). */
export function voiceGenderScore(v: Pick<BrowserVoice, "name">, want: "female" | "male" = "female"): number {
  const n = v.name;
  const female = FEMALE.test(n) || /^google (us english|français|francais)$/i.test(n.trim());
  const male = !female && MALE.test(n);
  if (want === "male") return male ? 2 : female ? 0 : 1;
  return female ? 2 : male ? 0 : 1;
}

/**
 * The best voice for `locale` ("fr-FR"): the highest rank (quality first), then the coach's gender (`want`: the chosen
 * voice's, a woman's by default), then the exact locale before another region of the language, then the browser's
 * default, then the list's order (the same voices always give the same pick). Undefined when the browser has none for
 * the language (the browser then picks).
 */
export function bestBrowserVoice<V extends BrowserVoice>(
  voices: readonly V[],
  locale: string,
  online = true,
  want: "female" | "male" = "female",
): V | undefined {
  const lang = locale.slice(0, 2).toLowerCase();
  const norm = (s: string) => s.replace("_", "-").toLowerCase();
  let best: V | undefined;
  let bestScore = -Infinity;
  for (const v of voices) {
    if (!norm(v.lang).startsWith(lang)) continue;
    const r = voiceRank(v, online);
    if (r < 0) continue;
    const score = r * 100 + voiceGenderScore(v, want) * 10 + (norm(v.lang) === locale.toLowerCase() ? 2 : 0) + (v.default ? 1 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}
