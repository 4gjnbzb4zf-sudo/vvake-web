import type { Locale } from "@/i18n/config";
import { splitLines, zonePack, type Spoken } from "./voicePick";

/**
 * The coach's words in the browser: the apps' workout cues (apps/mobile lib/coachVoice.ts `cue`, same words in English
 * and French) and the recording each one plays (`cueSpoken`: the voice pack, the cheer library, or a line registered
 * with the API), spoken by coachAudio.ts in VVake's recorded coach voice; and listening for the coach chat (Web Speech
 * recognition, where the browser has it: Chrome, Edge, Safari). The live voice coach and coach calls stay in the apps.
 */

type Vars = Record<string, string | number>;
const fill = (s: string, v: Vars = {}) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

const CUES = {
  en: {
    start: "Let's go {name}! {sport}. Warm up easy for the first few minutes.",
    zone: [
      "",
      "Zone 1. Nice and easy.",
      "Zone 2. Easy and steady, you could hold a conversation.",
      "Zone 3. Good rhythm. Hold it right there.",
      "Zone 4. Strong! Keep it controlled.",
      "Zone 5. That's your limit, ease off a little.",
    ],
    km1: "{n} kilometre. Time {time}. Keep moving.",
    km: "{n} kilometres. Time {time}. Keep moving.",
    mile1: "{n} mile. Time {time}. Keep moving.",
    mile: "{n} miles. Time {time}. Keep moving.",
    minutes: "{m} minutes in, zone {z}. Nice work.",
    minutesNoHr: "{m} minutes in. Nice work.",
    energy: "Energy used up. From here, this session counts for your journal and your streak.",
    done: "Session done: {minutes} minutes. Nice work, see you next time!",
    paused: "Paused.",
    resumed: "Back at it!",
    noSensor: "Without a heart-rate sensor this session won't earn points.",
    points: "{total} points.",
    sensorLost: "Heart-rate sensor lost. Trying to reconnect.",
    sensorBack: "Heart-rate sensor back.",
  },
  fr: {
    start: "C'est parti {name} ! {sport}. Échauffe-toi doucement les premières minutes.",
    zone: [
      "",
      "Zone 1. Tout en douceur.",
      "Zone 2. Facile et régulier, tu pourrais tenir une conversation.",
      "Zone 3. Bon rythme. Garde-le.",
      "Zone 4. Solide ! Reste en contrôle.",
      "Zone 5. C'est ta limite, lève un peu le pied.",
    ],
    km1: "{n} kilomètre. Temps : {time}. Continue.",
    km: "{n} kilomètres. Temps : {time}. Continue.",
    mile1: "{n} mile. Temps : {time}. Continue.",
    mile: "{n} miles. Temps : {time}. Continue.",
    minutes: "{m} minutes de faites, zone {z}. Beau travail.",
    minutesNoHr: "{m} minutes de faites. Beau travail.",
    energy: "Énergie épuisée. À partir de maintenant, cette séance compte pour ton journal et ta série.",
    done: "Séance terminée : {minutes} minutes. Beau travail, à la prochaine !",
    paused: "En pause.",
    resumed: "C'est reparti !",
    noSensor: "Sans capteur cardio, cette séance ne rapporte pas de points.",
    points: "{total} points.",
    sensorLost: "Capteur cardio perdu. Je tente de le reconnecter.",
    sensorBack: "Capteur cardio de retour.",
  },
} as const;

export type Chattiness = "quiet" | "normal" | "chatty";

/** The words of a cue, in the app's language. */
export const cueText = {
  start: (l: Locale, name: string, sport: string) => fill(name ? CUES[l].start : CUES[l].start.replace(" {name}", ""), { name, sport }),
  zone: (l: Locale, z: number) => CUES[l].zone[z] ?? "",
  split: (l: Locale, n: number, time: string, miles: boolean) =>
    fill(CUES[l][miles ? (n > 1 ? "mile" : "mile1") : n > 1 ? "km" : "km1"], { n, time }),
  minutes: (l: Locale, m: number, z: number) => fill(z > 0 ? CUES[l].minutes : CUES[l].minutesNoHr, { m, z }),
  energy: (l: Locale) => CUES[l].energy,
  done: (l: Locale, minutes: number) => fill(CUES[l].done, { minutes: Math.max(1, minutes) }),
  paused: (l: Locale) => CUES[l].paused,
  resumed: (l: Locale) => CUES[l].resumed,
  noSensor: (l: Locale) => CUES[l].noSensor,
  points: (l: Locale, total: number) => fill(CUES[l].points, { total }),
  sensorLost: (l: Locale) => CUES[l].sensorLost,
  sensorBack: (l: Locale) => CUES[l].sensorBack,
};

/**
 * What each cue plays (the phone's choices, apps/mobile workout.tsx `speakCue`/`playCheer`): the start, zones, pause,
 * resume, energy and end from the voice pack (said without the name and the minutes, as on the phone); a split from
 * the cheer library ("3 kilometres done. That one in 5:15."); the rest, lines with exact numbers, registered with the
 * API. `text` stays the full screen line, and is what the browser voice says when the recording doesn't come.
 */
export const cueSpoken = {
  start: (l: Locale, name: string, sport: string): Spoken => ({ text: cueText.start(l, name, sport), pack: "start" }),
  zone: (l: Locale, z: number): Spoken => {
    const pack = zonePack(z);
    return { text: cueText.zone(l, z), ...(pack ? { pack } : {}) };
  },
  /** `splitS`: this km's (or mile's) own time, null when unknown. */
  split: (l: Locale, n: number, time: string, miles: boolean, splitS: number | null): Spoken => ({
    text: cueText.split(l, n, time, miles),
    lib: splitLines(n, splitS, miles),
  }),
  minutes: (l: Locale, m: number, z: number): Spoken => ({ text: cueText.minutes(l, m, z) }),
  energy: (l: Locale): Spoken => ({ text: cueText.energy(l), pack: "energy" }),
  done: (l: Locale, minutes: number): Spoken => ({ text: cueText.done(l, minutes), pack: "done" }),
  paused: (l: Locale): Spoken => ({ text: cueText.paused(l), pack: "paused" }),
  resumed: (l: Locale): Spoken => ({ text: cueText.resumed(l), pack: "resumed" }),
  noSensor: (l: Locale): Spoken => ({ text: cueText.noSensor(l) }),
  points: (l: Locale, total: number): Spoken => ({ text: cueText.points(l, total) }),
  sensorLost: (l: Locale): Spoken => ({ text: cueText.sensorLost(l) }),
  sensorBack: (l: Locale): Spoken => ({ text: cueText.sensorBack(l) }),
};

/** Which cues a chattiness allows (apps/mobile lib/coachSettings.ts cueAllowed): quiet says only zone 5. */
export function cueAllowed(level: Chattiness, cue: "zone" | "split" | "minutes", zone = 0): boolean {
  if (level === "quiet") return cue === "zone" && zone >= 5;
  return true;
}

/** "5:32" or "1:05:32" as the coach says a time. */
export function spokenClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Listening (coach chat) ───────────────────────────────────────────────────────────────────────────────────

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canListen = () => recognitionCtor() !== null;

/**
 * Listens for one sentence. `onText` gets the words as they come (interim) and once final; `onEnd` when it stops
 * (silence, an error, or `stop()`). Returns the stop handle, or null when the browser can't listen.
 */
export function listen(
  lang: Locale,
  onText: (text: string, final: boolean) => void,
  onEnd: (error?: string) => void,
): { stop(): void } | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  try {
    const r = new Ctor();
    r.lang = lang === "fr" ? "fr-FR" : "en-US";
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = false;
    let err: string | undefined;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i]![0]?.transcript ?? "";
        if (e.results[i]!.isFinal) final = true;
      }
      onText(text.trim(), final);
    };
    r.onerror = (e) => {
      err = e.error;
    };
    r.onend = () => onEnd(err);
    r.start();
    return { stop: () => r.stop() };
  } catch {
    return null;
  }
}
