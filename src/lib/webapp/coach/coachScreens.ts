// Copied from VVFit packages/game-core/src/coachScreens.ts (c525a71a 2026-10-30) by scripts/sync-coach-core.ts. Do not edit: re-sync.
/**
 * The screens the coach may open (living app, ADR-0062 §5 "Helps navigate"): "where are my moves?" is answered in one
 * line plus a button. The coach's `open_screen` action names one of these routes; anything else is dropped. The
 * scripted coach (no model, or the AI account out of credit) finds the screen from a keyword table, EN and FR.
 *
 * Pure. The phone and the web open the route; the watches show "Show on iPhone / phone" with the label.
 */

export interface CoachScreen {
  route: string;
  label: { en: string; fr: string };
  /** Words that point at this screen (lower case, no accents); the longest match wins. */
  words: { en: readonly string[]; fr: readonly string[] };
}

export const COACH_SCREENS: readonly CoachScreen[] = [
  {
    route: "/trainings",
    label: { en: "Your library", fr: "Ta bibliothèque" },
    words: {
      en: ["trainings", "my trainings", "saved trainings", "library", "my library"],
      fr: ["entrainements", "mes entrainements", "bibliotheque", "ma bibliotheque"],
    },
  },
  {
    route: "/my-moves",
    label: { en: "My moves", fr: "Mes mouvements" },
    words: { en: ["my moves", "moves i taught", "taught moves", "my own moves"], fr: ["mes mouvements", "mouvements appris"] },
  },
  {
    route: "/skills",
    label: { en: "Skills", fr: "Skills" },
    words: { en: ["skill", "skills", "splits", "handstand"], fr: ["skill", "skills", "grand ecart", "poirier"] },
  },
  {
    route: "/own-workout",
    label: { en: "Your own workout", fr: "Ta propre séance" },
    words: {
      en: ["own workout", "my own workout", "paste a workout", "write a workout"],
      fr: ["propre seance", "ma propre seance", "coller une seance", "ecrire une seance"],
    },
  },
  {
    route: "/camera-workout",
    label: { en: "Camera workout", fr: "Séance caméra" },
    words: {
      en: ["camera", "camera workout", "webcam", "count my reps", "rep counter", "home workout", "workout at home"],
      fr: ["camera", "seance camera", "entrainement camera", "webcam", "compter mes repetitions", "seance a la maison", "seance maison"],
    },
  },
  {
    route: "/move-loads",
    label: { en: "Move loads", fr: "Charges des mouvements" },
    words: {
      en: ["move loads", "body load", "muscle load", "loads"],
      fr: ["charges", "charge des mouvements", "charges des mouvements", "charge musculaire"],
    },
  },
  {
    route: "/discover",
    label: { en: "Discover", fr: "Découvrir" },
    words: {
      en: ["discover", "new trainings", "popular trainings", "coaches", "creators"],
      fr: ["decouvrir", "nouveaux entrainements", "coachs", "createurs"],
    },
  },
  {
    route: "/teach-move",
    label: { en: "Teach a move", fr: "Apprendre un mouvement" },
    words: {
      en: ["teach a move", "teach a new move", "teach move", "record a move", "add a move", "new move"],
      fr: ["apprendre un mouvement", "enseigner un mouvement", "montrer un mouvement", "ajouter un mouvement", "nouveau mouvement"],
    },
  },
  {
    route: "/training-builder",
    label: { en: "Build a training", fr: "Créer un entraînement" },
    words: {
      en: ["build a training", "training builder", "create a training", "make a training", "series builder", "builder"],
      fr: ["creer un entrainement", "construire un entrainement", "createur d entrainement"],
    },
  },
  {
    route: "/places",
    label: { en: "Spots", fr: "Spots" },
    words: {
      en: ["places", "spot", "spots", "new spot", "trail", "trails", "offline map", "offline maps"],
      fr: ["lieux", "spot", "spots", "sentier", "sentiers", "carte hors ligne", "cartes hors ligne"],
    },
  },
  {
    route: "/season",
    label: { en: "Season", fr: "Saison" },
    words: { en: ["season", "season plan", "race plan", "my race"], fr: ["saison", "plan de saison", "plan de course", "ma course"] },
  },
  {
    route: "/plan",
    label: { en: "Your plan", fr: "Ton plan" },
    words: {
      en: ["plan", "my plan", "my week", "weekly plan", "this week"],
      fr: ["plan", "mon plan", "ma semaine", "cette semaine", "programme"],
    },
  },
  {
    route: "/suggestions",
    label: { en: "Suggestions & tips", fr: "Suggestions et conseils" },
    words: {
      en: ["suggestions", "tips", "quiet", "quiet mode", "tours"],
      fr: ["suggestions", "conseils", "astuces", "mode silence", "silence"],
    },
  },
  {
    route: "/sport-zones",
    label: { en: "Heart & pace zones", fr: "Zones cardio et allure" },
    words: {
      en: ["zones", "heart zones", "pace zones", "heart rate zones", "max heart rate", "my zones"],
      fr: ["zones", "zones cardiaques", "zones cardio", "zones d allure", "fc max", "mes zones"],
    },
  },
  {
    route: "/connections",
    label: { en: "Connections", fr: "Connexions" },
    words: {
      en: ["connections", "strava", "calendar", "google calendar", "apple calendar", "connect an app"],
      fr: ["connexions", "strava", "agenda", "calendrier", "google agenda"],
    },
  },
  {
    route: "/coach-voice",
    label: { en: "Coach voice", fr: "Voix du coach" },
    words: { en: ["coach voice", "coach s voice", "voice", "the voice"], fr: ["voix du coach", "voix", "la voix"] },
  },
  {
    route: "/challenge",
    label: { en: "Challenge", fr: "Défi" },
    words: { en: ["challenge", "challenges", "challenge a friend", "dare", "duel"], fr: ["defi", "defis", "defier un ami", "duel"] },
  },
  {
    route: "/crew",
    label: { en: "Crew & City", fr: "Équipe et ville" },
    words: { en: ["crew", "city clash", "clash", "friends", "my city"], fr: ["equipe", "city clash", "clash", "amis", "ma ville"] },
  },
  {
    route: "/health",
    label: { en: "Health", fr: "Santé" },
    words: { en: ["health", "apple health", "health connect", "health data"], fr: ["sante", "health connect", "donnees de sante"] },
  },
  {
    route: "/rhythm",
    label: { en: "Daily rhythm", fr: "Rythme quotidien" },
    words: {
      en: ["daily rhythm", "rhythm", "water reminder", "meal reminder", "meal reminders", "reminders"],
      fr: ["rythme", "rythme quotidien", "rappel d eau", "rappels des repas", "rappels"],
    },
  },
  {
    route: "/habits",
    label: { en: "Habits", fr: "Habitudes" },
    words: { en: ["habit", "habits", "my habits"], fr: ["habitude", "habitudes", "mes habitudes"] },
  },
  {
    route: "/points",
    label: { en: "VV points", fr: "Points VV" },
    words: { en: ["points", "vv points", "my points", "rewards"], fr: ["points", "points vv", "mes points", "recompenses"] },
  },
  {
    route: "/you",
    label: { en: "You", fr: "Toi" },
    words: {
      en: ["profile", "settings", "account", "my account", "my vvaker", "vvaker"],
      fr: ["profil", "reglages", "parametres", "compte", "mon compte", "mon vvaker", "vvaker"],
    },
  },
];

export const COACH_SCREEN_ROUTES: readonly string[] = COACH_SCREENS.map((s) => s.route);

/** The allow-listed screen for a route (exact), else undefined. Pure. */
export function coachScreen(route: unknown): CoachScreen | undefined {
  return typeof route === "string" ? COACH_SCREENS.find((s) => s.route === route) : undefined;
}

/** The coach's `open_screen` action for a route, with the label in the athlete's language; null when not allowed. Pure. */
export function openScreenAction(route: unknown, lang: "en" | "fr"): { type: "open_screen"; route: string; label: string } | null {
  const s = coachScreen(route);
  return s ? { type: "open_screen", route: s.route, label: s.label[lang] } : null;
}

/** Lower case, accents off, apostrophes and hyphens as spaces. */
const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'‘\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Where is…", "how do I find…", « où sont… », « comment je change… »: a question about finding a screen. */
const NAV_EN =
  /\b(where (is|are|s|do i|can i|would i|to)|wheres|how (do|can|would) i (find|get to|open|see|reach|change|edit|set|setup|turn|switch|add|connect|link|manage|use|teach|build|create|make|record|save|join|invite|start|rate|pick|choose)|find my|show me|take me to|open my|open the|go to)\b/;
const NAV_FR =
  /\b(ou (est|sont|se trouve|se trouvent|trouver|je trouve|puis je|peut on|je peux|on trouve|il y a|regler|changer)|comment (je |on )?(trouve|trouver|aller|ouvrir|voir|change|changer|modifie|modifier|regle|regler|ajoute|ajouter|connecte|connecter|active|activer|cree|creer|construis|construire|enregistre|enregistrer|rejoins|rejoindre|invite|inviter|lance|lancer|note|noter)|montre moi|emmene moi|ouvre (mes|ma|mon|les|la|le)|va sur|aller (sur|dans))\b/;

/** Is this message a "where is / how do I find" question? Pure. */
export const isNavQuestion = (message: string): boolean => {
  const m = norm(message);
  return NAV_EN.test(m) || NAV_FR.test(m);
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The screen a "where is X / how do I find X" question points at (keywords in both languages, the longest match
 * wins), or undefined (not a navigation question, or no screen named). Pure.
 */
export function screenFromQuestion(message: string): CoachScreen | undefined {
  if (!isNavQuestion(message)) return undefined;
  const m = ` ${norm(message)} `;
  let best: { s: CoachScreen; len: number } | undefined;
  for (const s of COACH_SCREENS) {
    for (const w of [...s.words.en, ...s.words.fr]) {
      if (w.length > (best?.len ?? 0) && new RegExp(`[^a-z0-9]${esc(w)}s?[^a-z0-9]`).test(m)) best = { s, len: w.length };
    }
  }
  return best?.s;
}

/** The scripted coach's line for a screen ("It's in My moves: tap below."). Pure. */
export function openScreenReply(s: CoachScreen, lang: "en" | "fr"): string {
  return lang === "fr" ? `C’est dans ${s.label.fr}. Touche le bouton pour y aller.` : `It’s in ${s.label.en}. Tap the button to go there.`;
}
