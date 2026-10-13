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
    version: "1.0.0 (18)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        fixed: [
          "On the watch's Today screen, the Race, Move, Quest and Coach buttons now sit fully inside the screen's rounded corners on every watch size, including Ultra.",
          'When Spotify plays from its own watch app, VVake\'s watch player shows and controls it instead of "Open Spotify on your iPhone".',
        ],
      },
      fr: {
        fixed: [
          "Sur l'écran Aujourd'hui de la montre, les boutons Course, Bouger, Quête et Coach restent entièrement dans les coins arrondis de l'écran, sur toutes les tailles, Ultra compris.",
          "Quand Spotify joue depuis son app de montre, le lecteur VVake de la montre l'affiche et le contrôle au lieu de « Ouvre Spotify sur ton iPhone ».",
        ],
      },
    },
  },
  {
    version: "1.0.0 (17)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          'Tap a quick-check reminder (like "Had a meal?") and VVake opens right on that question, on the iPhone and on the Apple Watch.',
        ],
        improved: [
          "Spotify from the watch: every music control drives Spotify, and the watch shows what Spotify is actually playing, even when you change it in the Spotify app.",
          "The watch player shows Spotify as a neat chip at the top, with the album art next to the song.",
          "The watch's Today screen keeps its shortcuts in a row inside the round corners, all visible at first sight.",
        ],
        fixed: [
          "Spotify controls on the watch now work with the iPhone locked in your pocket.",
          "Tapping the output device that is playing unselects it.",
          '"Play on iPhone" and "Open Spotify" from the watch no longer ask you to update VVake.',
        ],
      },
      fr: {
        added: [
          "Touchez un rappel rapide (comme « Tu as mangé ? ») et VVake s'ouvre directement sur cette question, sur l'iPhone et sur l'Apple Watch.",
        ],
        improved: [
          "Spotify depuis la montre : chaque commande pilote Spotify, et la montre affiche ce que Spotify joue vraiment, même si vous changez dans l'app Spotify.",
          "Le lecteur de la montre affiche Spotify dans une étiquette en haut, avec la pochette à côté du titre.",
          "L'écran Aujourd'hui de la montre garde ses raccourcis sur une ligne dans les coins arrondis, tous visibles d'emblée.",
        ],
        fixed: [
          "Les commandes Spotify de la montre fonctionnent avec l'iPhone verrouillé dans la poche.",
          "Toucher l'appareil de sortie qui joue le désélectionne.",
          "« Lire sur l'iPhone » et « Ouvrir Spotify » depuis la montre ne demandent plus de mettre VVake à jour.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (15)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone"],
    notes: {
      en: {
        fixed: ["Changing the language or theme during a workout no longer ends it: the change applies as soon as the workout closes."],
      },
      fr: {
        fixed: ["Changer la langue ou le thème pendant une séance ne l'arrête plus : le changement s'applique dès la fin de la séance."],
      },
    },
  },
  {
    version: "1.0.0 (14)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        improved: [
          'During a workout, "back to your workout" is now a slim bar at the very bottom of the phone, and screens move up so it never covers anything.',
          "The watch's Today shows your VVaker in the background.",
          "Every watch screen was checked on small and large watches in English and French, so text and buttons are no longer cut by the rounded corners.",
          "When no free slot is left today, the phone and the watch say so plainly and offer a short daily move instead.",
        ],
        fixed: [
          'On the watch\'s coach page, the "Your coaching" button is no longer cut off.',
          "On the watch's music page, the page dots no longer sit on the speaker button.",
        ],
      },
      fr: {
        improved: [
          "Pendant une séance, « Retour à ta séance » devient une fine barre tout en bas du téléphone, et les écrans remontent pour qu'elle ne cache rien.",
          "L'écran Aujourd'hui de la montre affiche votre VVaker en fond.",
          "Chaque écran de la montre a été vérifié sur petites et grandes montres, en anglais et en français : textes et boutons ne sont plus coupés par les coins arrondis.",
          "Quand il ne reste plus de créneau libre aujourd'hui, le téléphone et la montre le disent clairement et proposent un petit mouvement du jour.",
        ],
        fixed: [
          "Sur la page coach de la montre, le bouton « Ton coaching » n'est plus coupé.",
          "Sur la page musique de la montre, les points de page ne recouvrent plus le bouton haut-parleur.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (13)",
    date: "2026-10-12",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Coach calls ring on your iPhone and your Apple Watch: answer on either one, the other follows (in call on your watch, ended, declined).",
          "A full call screen on the watch: your VVaker, the coach's voice, captions and Hang up.",
          "Add a moment after a run, walk or ride: a selfie, the view, or a 6-second clip, kept on your phone.",
          "Brag cards: your moment with your VVaker and the session's highlights, ready to share, with no map and no location.",
          "Plus: a small + on the VVake logo when Plus is on, and Plus can be bought in the app through Apple once it opens (beta testers keep the free preview).",
        ],
        improved: [
          "Shares on X come with a fun line for the moment and a link that shows a proper preview card.",
          "After an outdoor workout, the watch reminds you that you can add a moment on your iPhone.",
        ],
        fixed: ["The coach call screen shows your whole VVaker in the circle, and the header no longer sits under the camera."],
      },
      fr: {
        added: [
          "Les appels du coach sonnent sur l'iPhone et sur l'Apple Watch : répondez sur l'un, l'autre suit (en appel sur la montre, terminé, refusé).",
          "Un vrai écran d'appel sur la montre : votre VVaker, la voix du coach, les sous-titres et Raccrocher.",
          "Ajoutez un moment après une course, une marche ou une sortie vélo : un selfie, la vue ou une vidéo de 6 secondes, gardés sur votre téléphone.",
          "Les cartes à partager : votre moment avec votre VVaker et les temps forts de la séance, sans carte ni lieu.",
          "Plus : un petit + sur le logo VVake quand Plus est actif, et Plus pourra s'acheter dans l'app via Apple dès son ouverture (les testeurs gardent l'aperçu gratuit).",
        ],
        improved: [
          "Les partages sur X arrivent avec une phrase drôle pour le moment et un lien qui affiche un vrai aperçu.",
          "Après une séance en extérieur, la montre rappelle qu'on peut ajouter un moment sur l'iPhone.",
        ],
        fixed: ["L'écran d'appel du coach montre votre VVaker en entier dans le cercle, et l'en-tête ne passe plus sous la caméra."],
      },
    },
  },
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
