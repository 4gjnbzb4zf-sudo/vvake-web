import type { Locale } from "@/i18n/config";

/**
 * What changed in each app release, newest first (vvake.com/<lang>/releases/). The apps' TestFlight builds are the
 * source: add one entry per build that reaches testers, in plain words (what people notice, not code). The site
 * follows the apps: the same day a build ships.
 */
export interface Release {
  /** App version and build, as TestFlight shows it: "1.0.0 (12)". */
  version: string;
  /** ISO date the build reached testers. */
  date: string;
  /** "beta" (TestFlight testers) or "store" (App Store / Google Play). */
  channel: "beta" | "store";
  /** Phone, watch or both. */
  devices: ("iphone" | "watch")[];
  notes: Record<Locale, { added?: string[]; improved?: string[]; fixed?: string[] }>;
}

export const releases: Release[] = [
  {
    version: "1.0.0 (12)",
    date: "2026-10-12",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        improved: ["Every VVaker the app makes shows the VVake sign: three fingers up in a row, thumb and little finger touching."],
        fixed: [
          "A generated VVaker no longer sits on a white box on the dark theme: the background is always made transparent, and pictures made before are cleaned up for free.",
          "The watch picks up your cleaned-up VVaker too.",
        ],
      },
      fr: {
        improved: [
          "Chaque VVaker créé par l'app fait le signe VVake : trois doigts levés côte à côte, pouce et auriculaire qui se touchent.",
        ],
        fixed: [
          "Un VVaker généré ne s'affiche plus dans un carré blanc en thème sombre : le fond est toujours rendu transparent, et les images déjà faites sont nettoyées gratuitement.",
          "La montre récupère aussi votre VVaker nettoyé.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (11)",
    date: "2026-10-11",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Live speed during a workout.",
          "Stop a workout from either your iPhone or your watch.",
          "Plus preview for beta testers: try Plus for 30 days, nothing charged.",
          "Up to 3 VVaker renders per account during the beta.",
        ],
        improved: ["One coach voice at a time, and your music on the iPhone gets quieter while the watch coach talks."],
      },
      fr: {
        added: [
          "Vitesse en direct pendant une séance.",
          "Arrêtez une séance depuis l'iPhone ou la montre.",
          "Aperçu de Plus pour les bêta-testeurs : 30 jours de Plus, rien n'est facturé.",
          "Jusqu'à 3 rendus de VVaker par compte pendant la bêta.",
        ],
        improved: ["Une seule voix de coach à la fois, et votre musique sur l'iPhone baisse quand le coach de la montre parle."],
      },
    },
  },
  {
    version: "1.0.0 (10)",
    date: "2026-10-10",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        improved: [
          "Every watch screen reviewed in English and French on the smallest and largest watches: nothing cut by the round corners, no text running off the screen.",
          "Ghost races: the ghost moves at exactly the same pace on the watch and the phone, and pauses with you.",
        ],
        fixed: [
          "A loop route only counts as finished after at least 80% of its distance and of its path, never just because you're back at the start.",
        ],
      },
      fr: {
        improved: [
          "Tous les écrans de la montre revus en français et en anglais, sur la plus petite et la plus grande montre : rien de coupé par les coins arrondis, aucun texte qui déborde.",
          "Courses contre son fantôme : le fantôme avance exactement au même rythme sur la montre et sur le téléphone, et s'arrête avec vous.",
        ],
        fixed: [
          "Un parcours en boucle n'est terminé qu'après au moins 80 % de sa distance et de son tracé, jamais juste parce que vous êtes revenu au départ.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (9)",
    date: "2026-10-09",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Coach calls (Plus): your coach rings you, like a call, about what matters today.",
          "Ghost races synced between phone and watch: the ghost runs its recorded path, and your VVaker is your marker on the map.",
        ],
      },
      fr: {
        added: [
          "Appels du coach (Plus) : votre coach vous appelle, comme un vrai appel, pour ce qui compte aujourd'hui.",
          "Courses contre son fantôme synchronisées entre téléphone et montre : le fantôme suit son tracé enregistré, et votre VVaker est votre repère sur la carte.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (8)",
    date: "2026-10-09",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "The live workout on one screen: heart rate, map and route, zone block, coach and music.",
          "Zone blocks with a real countdown, and a 10% bonus when you hold the zone 80% of the time.",
          "Your own heart-rate zones, per sport.",
          "On the watch: your route, challenges, and discarding a workout.",
          "A pace indicator, and a notice when you're offline.",
        ],
        improved: ["The coach can vibrate instead of speaking over your music."],
      },
      fr: {
        added: [
          "La séance en direct sur un seul écran : cardio, carte et tracé, bloc de zone, coach et musique.",
          "Des blocs de zone avec un vrai compte à rebours, et 10 % de bonus quand vous tenez la zone 80 % du temps.",
          "Vos propres zones cardio, par sport.",
          "Sur la montre : votre tracé, les défis, et l'abandon d'une séance.",
          "Un indicateur d'allure, et un avertissement hors connexion.",
        ],
        improved: ["Le coach peut vibrer au lieu de parler par-dessus votre musique."],
      },
    },
  },
  {
    version: "1.0.0 (7)",
    date: "2026-10-09",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Habit points: water, meals and sleep earn or cost points, with a daily history and a good-habits streak.",
          "New perks, some of them hard to get, and trophies to be proud of.",
          'Start a workout with Siri using "wake up" phrases.',
        ],
        fixed: ["Siri recognizes VVake again (too many phrases had been registered)."],
      },
      fr: {
        added: [
          "Points d'habitudes : eau, repas et sommeil rapportent ou coûtent des points, avec un historique par jour et une série de bonnes habitudes.",
          "De nouveaux bonus, certains difficiles à obtenir, et des trophées dont être fier.",
          "Lancez une séance avec Siri grâce aux phrases « wake up ».",
        ],
        fixed: ["Siri reconnaît de nouveau VVake (trop de phrases avaient été enregistrées)."],
      },
    },
  },
  {
    version: "1.0.0 (6)",
    date: "2026-10-08",
    channel: "beta",
    devices: ["iphone"],
    notes: {
      en: {
        added: [
          "Answer reminders right from the notification: Done, In 15 min, or Not this time.",
          "Your reminder settings are saved with your account.",
        ],
      },
      fr: {
        added: [
          "Répondez aux rappels directement depuis la notification : Fait, Dans 15 min, ou Pas cette fois.",
          "Vos réglages de rappels sont enregistrés avec votre compte.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (5)",
    date: "2026-10-07",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: { added: ["The first beta of VVake on iPhone and Apple Watch, in English and French."] },
      fr: { added: ["La première bêta de VVake sur iPhone et Apple Watch, en français et en anglais."] },
    },
  },
];
