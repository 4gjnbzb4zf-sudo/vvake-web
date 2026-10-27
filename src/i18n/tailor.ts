import type { Locale } from "./config";

/**
 * The web's own words for "Your VVake" (ADR-0059). The survey's questions, answers, feature and preset names are
 * game-core's TAILOR_TEXT (tailor.ts, read with tailorText) so they read the same on every device; these are the
 * web's screens around them. French must match English key for key (the type checker says so).
 */
const en = {
  dev: {
    title: "Developer",
    lead: "Your VVake: the tailored app, for testers. Off, VVake looks as it does today.",
    toggle: "Your VVake (preview)",
    survey: "Take the survey",
  },
  you: {
    yourVVakeDetail: "{preset} · choose what VVake shows",
    allFeatures: "All features",
    allFeaturesDetail: "{on} on · {off} off",
    settings: "Settings",
    settingsDetail: "Profile, voice, units, devices, account",
    hide: "Hide settings",
  },
  today: {
    next: "Next",
    pickAnother: "Pick another",
    rest: "Rest day ✓",
    trainAnyway: "Train anyway",
    dailyMove: "Daily move · 10 min",
    camera: "Start workout",
    quick: "{sport} · start",
    week: "This week",
    sessions: "sessions",
    minutes: "min",
    streak: "day streak",
    points: "VV points",
    last: "Last session",
    goal: "{name} · {days}",
    first: "Your first session shows here.",
    allFeatures: "All features",
  },
  features: {
    title: "All features",
    lead: "Everything VVake does, on or off. Off features leave your tabs and Today but keep your data.",
    open: "Open",
    turned: "Saved. Your tabs follow.",
  },
  survey: {
    step: "{n} of {total}",
    edit: "Your answers",
    editLead: "Tap an answer to change it. Nothing changes until you save.",
    save: "Save",
    saving: "Saving…",
    error: "That didn't work. Check your connection and try again.",
    unchanged: "Nothing changes.",
    summaryLead: "Turn anything on or off. Change it any time in You › Your VVake.",
    sportsHint: "Main sport first",
    sportsMax: "Up to {n}",
    noSport: "No sport found",
    events: {
      "5k": "5K",
      "10k": "10K",
      half: "Half marathon",
      marathon: "Marathon",
      triathlon: "Triathlon",
      ironman: "Ironman",
      other: "Other",
    },
    tabs: "Tabs",
  },
  account: {
    lead: "The features you use. The ones you turned off leave your tabs, Today and this page, and keep their data: their settings wait under All features below.",
    profile: "Your profile",
    answers: "Change your answers",
    allFeatures: "All features",
    allFeaturesLead: "Settings of the features you turned off. Turn a feature on above to bring it back.",
    show: "Show {n} more",
  },
};

export type TailorDict = typeof en;

const fr: TailorDict = {
  dev: {
    title: "Développeur",
    lead: "Ton VVake : l’app sur mesure, pour les testeurs. Désactivé, VVake reste comme aujourd’hui.",
    toggle: "Ton VVake (aperçu)",
    survey: "Répondre au questionnaire",
  },
  you: {
    yourVVakeDetail: "{preset} · choisis ce que VVake affiche",
    allFeatures: "Toutes les fonctions",
    allFeaturesDetail: "{on} activées · {off} désactivées",
    settings: "Réglages",
    settingsDetail: "Profil, voix, unités, appareils, compte",
    hide: "Masquer les réglages",
  },
  today: {
    next: "À suivre",
    pickAnother: "Choisir autre chose",
    rest: "Jour de repos ✓",
    trainAnyway: "M’entraîner quand même",
    dailyMove: "Bouger du jour · 10 min",
    camera: "Lancer la séance",
    quick: "{sport} · démarrer",
    week: "Cette semaine",
    sessions: "séances",
    minutes: "min",
    streak: "jours de série",
    points: "points VV",
    last: "Dernière séance",
    goal: "{name} · {days}",
    first: "Ta première séance s’affichera ici.",
    allFeatures: "Toutes les fonctions",
  },
  features: {
    title: "Toutes les fonctions",
    lead: "Tout ce que fait VVake, activé ou non. Une fonction désactivée quitte tes onglets et Aujourd’hui, tes données restent.",
    open: "Ouvrir",
    turned: "Enregistré. Tes onglets suivent.",
  },
  survey: {
    step: "{n} sur {total}",
    edit: "Tes réponses",
    editLead: "Touche une réponse pour la changer. Rien ne change avant d’enregistrer.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    error: "Ça n’a pas marché. Vérifie ta connexion et réessaie.",
    unchanged: "Rien ne change.",
    summaryLead: "Active ou désactive ce que tu veux. Modifiable à tout moment dans Toi › Ton VVake.",
    sportsHint: "Ton sport principal d’abord",
    sportsMax: "Jusqu’à {n}",
    noSport: "Aucun sport trouvé",
    events: {
      "5k": "5 km",
      "10k": "10 km",
      half: "Semi-marathon",
      marathon: "Marathon",
      triathlon: "Triathlon",
      ironman: "Ironman",
      other: "Autre",
    },
    tabs: "Onglets",
  },
  account: {
    lead: "Les fonctions que tu utilises. Celles que tu as désactivées quittent tes onglets, Aujourd’hui et cette page, et gardent leurs données : leurs réglages attendent sous Toutes les fonctions, plus bas.",
    profile: "Ton profil",
    answers: "Changer tes réponses",
    allFeatures: "Toutes les fonctions",
    allFeaturesLead: "Les réglages des fonctions désactivées. Active une fonction plus haut pour la retrouver.",
    show: "Afficher {n} de plus",
  },
};

const dicts: Record<Locale, TailorDict> = { en, fr };
export const getTailorDict = (locale: Locale): TailorDict => dicts[locale];
