import { cameraMove } from "./camera/cameraMoves";
import { flowLine, type FlowEvent } from "./camera/cameraFlow";

/**
 * One coach voice everywhere (voice-one): the parts of the monorepo's game-core appVoice.ts the web needs, word for
 * word (the API records the same texts once for everyone and serves them at GET /v1/voice/app, looked up by text):
 * the coach-voice preview, who the browser voice should sound like, and the camera lines split into short fixed
 * parts ("Squat." "15 reps." "Zone 3."), so built-in moves get the recorded voice. Keep the texts identical to
 * game-core (a changed word is a new recording).
 */

export type VoiceLang = "en" | "fr";

/** The coach's recorded voice (an ElevenLabs female voice, US English; French read as French). */
export const COACH_VOICE_PROFILE = {
  gender: "female" as "female" | "male",
  locale: { en: "en-US", fr: "fr-FR" } as Record<VoiceLang, string>,
};

/** game-core APP_VOICE.preview (id app.preview). */
export const PREVIEW_LINE: Record<VoiceLang, string> = {
  en: "Hi, I'm your coach. This is the voice you'll hear in every workout, every call and every reminder.",
  fr: "Salut, je suis ton coach. C'est cette voix que tu entendras à chaque séance, chaque appel et chaque rappel.",
};

/** A line to say: its words (screen, browser voice) and, when it has them, the short recorded parts to play instead. */
export interface CoachSpeech {
  text: string;
  parts?: string[];
}

const moveName = (id: string, lang: VoiceLang) => cameraMove(id)?.name[lang] ?? id;
const part = {
  move: (id: string, lang: VoiceLang) => `${moveName(id, lang)}.`,
  reps: (n: number, lang: VoiceLang) => (lang === "fr" ? `${n} répétitions.` : `${n} reps.`),
  holdS: (n: number, lang: VoiceLang) => (lang === "fr" ? `${n} secondes.` : `${n} seconds.`),
  holdPos: (lang: VoiceLang) => (lang === "fr" ? "Tiens la position." : "Hold the position."),
  free: (lang: VoiceLang) => (lang === "fr" ? "À ton rythme, jusqu’à ce que tu t’arrêtes." : "At your pace, until you stop."),
  zone: (z: number) => `Zone ${z}.`,
  rest: (s: number, lang: VoiceLang) => (lang === "fr" ? `Repos ${s} secondes.` : `Rest ${s} seconds.`),
  next: (id: string, lang: VoiceLang) => (lang === "fr" ? `Ensuite : ${moveName(id, lang)}.` : `Next: ${moveName(id, lang)}.`),
};

/** game-core flowSpeech: flowLine's words, the demo and the rest-with-next split into fixed parts. Null: nothing. */
export function flowSpeech(e: FlowEvent, lang: VoiceLang): CoachSpeech | null {
  const text = flowLine(e, lang);
  if (!text) return null;
  if (e.type === "demo") {
    const m = cameraMove(e.move);
    const t = e.target;
    const target = t?.reps
      ? part.reps(t.reps, lang)
      : t?.holdS
        ? part.holdS(t.holdS, lang)
        : m?.kind === "hold"
          ? part.holdPos(lang)
          : part.free(lang);
    return { text, parts: [part.move(e.move, lang), target, ...(t?.zone ? [part.zone(t.zone)] : [])] };
  }
  if (e.type === "rest" && e.next) return { text, parts: [part.rest(e.restS, lang), part.next(e.next.move, lang)] };
  return { text };
}
