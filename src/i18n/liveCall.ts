import type { Locale } from "./config";

/**
 * The web app's words for live coach calls and the day-one call by voice (monorepo docs/05-tech/live-call.md): the
 * same lines as the phone (apps/mobile components/LiveCallPanel.tsx, OnboardingCall.tsx). French must match English
 * key for key (the type checker says so). Tutoiement, like the apps.
 */
const en = {
  offer: {
    title: "Set it up by voice or by tapping",
    lead: "Your coach asks the same questions out loud and fills the cards on screen as you talk. Tap any card to fix it. The microphone is on only during the call.",
    talk: "Talk it through with your coach (3 min)",
    tap: "Tap through",
  },
  phase: {
    connecting: "Connecting…",
    speaking: "Coach speaking · just talk to cut in",
    thinking: "Coach thinking…",
    waiting: "Waiting for you on screen",
    listening: "Listening · talk any time",
    muted: "Muted · your coach can't hear you",
  },
  left: "{m}:{s} left",
  micOn: "Microphone on",
  mute: "Mute",
  unmute: "Unmute",
  interrupt: "Tap to interrupt",
  ratherTap: "I'd rather tap",
  onScreen: "Let's finish on screen. Your answers are kept.",
  firstWeek: "Your coach suggests a first week of {d} days, {m} minutes each.",
  healthOnPhone: "Health lives in the VVake phone app. Just tell your coach roughly how much you move.",
};

export type LiveCallDict = typeof en;

const fr: LiveCallDict = {
  offer: {
    title: "Configure à la voix ou en touchant",
    lead: "Ton coach pose les mêmes questions à voix haute et remplit les cartes à l’écran pendant que tu parles. Touche une carte pour la corriger. Le micro n’est allumé que pendant l’appel.",
    talk: "En parler avec ton coach (3 min)",
    tap: "Répondre en touchant",
  },
  phase: {
    connecting: "Connexion…",
    speaking: "Ton coach parle · parle pour l’interrompre",
    thinking: "Ton coach réfléchit…",
    waiting: "On t’attend à l’écran",
    listening: "J’écoute · parle quand tu veux",
    muted: "Micro coupé · ton coach ne t’entend pas",
  },
  left: "Encore {m}:{s}",
  micOn: "Micro allumé",
  mute: "Couper le micro",
  unmute: "Rallumer le micro",
  interrupt: "Touche pour interrompre",
  ratherTap: "Je préfère toucher",
  onScreen: "On termine à l’écran. Tes réponses sont gardées.",
  firstWeek: "Ton coach te propose une première semaine de {d} jours, {m} minutes chacun.",
  healthOnPhone: "Santé se trouve dans l’app VVake sur ton téléphone. Dis simplement à ton coach à peu près combien tu bouges.",
};

const dicts: Record<Locale, LiveCallDict> = { en, fr };
export const getLiveCallDict = (locale: Locale): LiveCallDict => dicts[locale];
