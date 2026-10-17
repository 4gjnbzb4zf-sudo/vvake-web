/**
 * The health & safety disclaimer's short version (ADR-0032), word for word from the apps (apps/mobile
 * lib/disclaimer.ts and src/i18n/fr/disclaimer.ts). The account keeps the highest version accepted (PATCH /v1/me
 * consents.disclaimer), so accepting it here counts in the app too, and the other way round.
 */
export const DISCLAIMER_VERSION = 1;

export const DISCLAIMER_SHORT = {
  en: [
    "VVake is a fitness and wellbeing app. It is not a medical device and it does not give medical advice.",
    "Plans, coach replies (written by AI, they can be wrong), heart rate, zones, points, Move Quests, challenges and reminders are suggestions only.",
    "Sensor and health data can be inaccurate, late or change, so a recommendation can be wrong or not right for you.",
    "You decide, and you are responsible for your own choices. If anything feels wrong, painful or dangerous, stop. Chest pain, dizziness or shortness of breath: stop and call emergency services.",
    "See a doctor before you start or change your training, especially with a health condition, an injury, a pregnancy or medication.",
    "Outside, watch traffic, terrain and weather, and keep your headphones low enough to hear what's around you. VVake is not for children under 13.",
  ],
  fr: [
    "VVake est une app de forme et de bien-être. Ce n’est pas un dispositif médical et elle ne donne pas d’avis médical.",
    "Les plans, les réponses du coach (écrites par une IA, elles peuvent se tromper), la fréquence cardiaque, les zones, les points, les quêtes de mouvement, les défis et les rappels ne sont que des suggestions.",
    "Les données des capteurs et de santé peuvent être inexactes, en retard ou changer : une recommandation peut donc être fausse ou ne pas te convenir.",
    "C’est toi qui décides, et tu es responsable de tes propres choix. Si quelque chose te semble anormal, douloureux ou dangereux, arrête-toi. Douleur à la poitrine, vertiges ou essoufflement : arrête-toi et appelle les secours.",
    "Consulte un médecin avant de commencer ou de changer ton entraînement, surtout si tu as un problème de santé, une blessure, si tu es enceinte ou si tu prends un traitement.",
    "Dehors, fais attention à la circulation, au terrain et à la météo, et garde le volume de tes écouteurs assez bas pour entendre ce qui t’entoure. VVake n’est pas destinée aux enfants de moins de 13 ans.",
  ],
} as const;
