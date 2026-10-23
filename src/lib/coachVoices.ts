import * as z from "zod/mini";

/**
 * The coach's four voices (VVFit ADR-0056, game-core coachVoices.ts, the parts the web needs): a woman's and a man's
 * voice per language. The athlete chooses woman or man (the web app's You › Coach voice and onboarding, the account
 * page, the phone, the watches: `/v1/me` coach.voiceGender); the app's language picks the voice of that pair.
 * Everything the athlete hears from the coach is in that one voice (ADR-0049). Pure (coachVoices.test.ts).
 */

export type CoachVoiceGender = "woman" | "man";
export const COACH_VOICE_GENDERS: readonly CoachVoiceGender[] = ["woman", "man"];
/** Never chosen (every account before ADR-0056, a new account that skipped the choice): a woman's voice. */
export const DEFAULT_COACH_VOICE_GENDER: CoachVoiceGender = "woman";

type Lang = "en" | "fr";
const langOf = (l: string): Lang => (l === "fr" ? "fr" : "en");

/** Anything stored or sent ("woman", "man"; else the default). */
export function coachVoiceGender(x: unknown): CoachVoiceGender {
  return x === "man" || x === "woman" ? x : DEFAULT_COACH_VOICE_GENDER;
}

/** "en-woman", "fr-man": which voice a pack, a list of recordings or a kept clip belongs to. */
export type CoachVoiceSlot = `${Lang}-${CoachVoiceGender}`;
export const COACH_VOICE_SLOTS: readonly CoachVoiceSlot[] = ["en-woman", "fr-woman", "en-man", "fr-man"];
export const coachVoiceSlot = (lang: string, gender: unknown = DEFAULT_COACH_VOICE_GENDER): CoachVoiceSlot =>
  `${langOf(lang)}-${coachVoiceGender(gender)}`;

/** Who the browser voice standing in should sound like: the chosen coach's gender and accent (speech engines' words). */
export function coachVoiceProfile(gender: unknown = DEFAULT_COACH_VOICE_GENDER): {
  gender: "female" | "male";
  locale: Record<Lang, string>;
} {
  return { gender: coachVoiceGender(gender) === "man" ? "male" : "female", locale: { en: "en-US", fr: "fr-FR" } };
}

// ── GET /v1/voice/voices?lang= (public): the two voices of a language and their "Hear it" line ──────────────────

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
export const coachVoicesSchema = z.object({
  lang: str,
  voices: z.array(
    z.object({
      lang: str,
      gender: z.string(),
      slot: str,
      tag: str,
      preview: opt(z.object({ text: str, url: str })),
    }),
  ),
});
export type CoachVoices = z.infer<typeof coachVoicesSchema>;

/** The "Hear it" audio path of a voice in the list (a `/v1/voice/<key>.mp3` path), or null. */
export function previewPath(list: CoachVoices | null | undefined, gender: CoachVoiceGender): string | null {
  const v = list?.voices.find((x) => x.gender === gender);
  const url = v?.preview?.url;
  if (!url) return null;
  let path = url;
  if (/^https?:\/\//.test(url)) {
    try {
      path = new URL(url).pathname;
    } catch {
      return null;
    }
  }
  return path.startsWith("/") ? path : `/${path}`;
}
