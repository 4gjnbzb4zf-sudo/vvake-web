import type { Locale } from "@/i18n/config";
import { cameraMove } from "./camera/cameraMoves";
import { defaultRestS, type PlannedSet } from "./camera/cameraSession";
import { flowSpeech, type CoachSpeech, type VoiceLang } from "./appVoice";
import { cueText } from "./voice";

/**
 * The lines a session is likely to say beyond the recorded pack and library (pure: voiceLikely.test.ts), made in the
 * coach's voice before it starts for VVake Coach Plus / Premium (coachAudio.ts prefetchSpeech), so none of them falls
 * to the browser voice for want of a recording.
 */

/** A GPS or indoor workout: the minutes every 5 min for the first half hour (no sensor, and zones 2–3), the sensor lines. */
export function workoutLikelyLines(lang: Locale): string[] {
  const out: string[] = [];
  for (let m = 5; m <= 30; m += 5) {
    out.push(cueText.minutes(lang, m, 0));
    if (m <= 15) out.push(cueText.minutes(lang, m, 2), cueText.minutes(lang, m, 3));
  }
  out.push(cueText.noSensor(lang), cueText.sensorLost(lang), cueText.sensorBack(lang));
  return [...new Set(out)];
}

/** A camera session: each set's demo and the rest before the next one, as the flow will say them. */
export function cameraLikelyLines(sets: readonly PlannedSet[] | null, lang: VoiceLang): CoachSpeech[] {
  if (!sets?.length) return [];
  const out: CoachSpeech[] = [];
  sets.forEach((set, i) => {
    const demo = flowSpeech({ type: "demo", move: set.move, loop: 1, target: set }, lang);
    if (demo) out.push(demo);
    const next = sets[i + 1];
    if (next) {
      const restS = set.restS ?? defaultRestS(cameraMove(set.move) ?? null);
      const rest = flowSpeech({ type: "rest", untilMs: 0, restS, next }, lang);
      if (rest) out.push(rest);
    }
  });
  return out;
}
