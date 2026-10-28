// Copied from VVFit packages/game-core/src/sportCatalog.ts (dbaea16c 2026-10-07) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * The sport catalog: every sport a session can be (every workout Apple Fitness offers on the watch), with its names
 * and the words people say for it in English and French, its SF Symbol, where it usually happens, whether it tracks
 * GPS, whether a distance means something, a MET default and a speed cap. Everything that lists sports reads it:
 * the API's sport enum and speed caps, the planner and plan changes, the voice grammar, the phone's pickers and the
 * watch (exported to apps/mobile/targets/watch/SportCatalog.swift by scripts/export-voice-commands.ts).
 *
 * Sport ids never change once shipped (sessions keep them): run, walk, ride, hike, strength, dance, boxing, yoga, swim,
 * skate were the first ten; the others are new ids. A sport you define yourself (custom sport) is not in the catalog:
 * it lives on the account (`CustomSport`, id `c_…`) and becomes an entry at runtime (`customSportEntry`).
 *
 * Voice words are normalised like speech (lower case, no accents, single spaces: see normalizeVoice): "vélo" is
 * written "velo". A word belongs to one sport (the first that lists it); never a word the grammar already uses
 * ("play", "workout", "track", "music"…).
 */

export type SportCategory =
  "endurance" | "gym" | "strength" | "mind" | "dance" | "combat" | "racket" | "team" | "water" | "snow" | "outdoor" | "other";

/** Category order for pickers, with EN/FR names. */
export const SPORT_CATEGORIES: readonly { key: SportCategory; name: { en: string; fr: string } }[] = [
  { key: "endurance", name: { en: "Run, walk, ride", fr: "Course, marche, vélo" } },
  { key: "gym", name: { en: "Gym & cardio", fr: "Salle & cardio" } },
  { key: "strength", name: { en: "Strength", fr: "Renforcement" } },
  { key: "mind", name: { en: "Mind & body", fr: "Corps & esprit" } },
  { key: "dance", name: { en: "Dance", fr: "Danse" } },
  { key: "combat", name: { en: "Combat", fr: "Combat" } },
  { key: "racket", name: { en: "Racket sports", fr: "Sports de raquette" } },
  { key: "team", name: { en: "Team sports", fr: "Sports collectifs" } },
  { key: "water", name: { en: "Water", fr: "Eau" } },
  { key: "snow", name: { en: "Snow & ice", fr: "Neige & glace" } },
  { key: "outdoor", name: { en: "Outdoors", fr: "Plein air" } },
  { key: "other", name: { en: "Other", fr: "Autre" } },
];

export interface SportEntry {
  /** The session sport (API, watch, phone): run, ride, skate, tennis… Stable forever. */
  key: string;
  /** The planner key (athlete.ts SURVEY_SPORT_KEY): a VVaker sport for the first ten (run → runner), else the key. */
  vvaker: string;
  /** The VVaker look that pictures it (vvaker.ts DNA sport), when there is one. */
  persona?: string;
  category: SportCategory;
  /** HealthKit HKWorkoutActivityType case (the watch starts this workout; the phone reads it back from Apple Health). */
  hk: string;
  /** SF Symbol (watch and phone). */
  icon: string;
  /** Usually outdoors (the watch starts it outdoors; an "Indoor" switch is offered when `gps`). */
  outdoor: boolean;
  /** Tracks GPS (distance, route, speed checks) when done outdoors. */
  gps: boolean;
  /** A distance means something: pace ghosts, distance goals, a recent best. */
  distance: boolean;
  /** Metabolic equivalent without speed or heart rate (Compendium of Physical Activities ballpark). */
  met: number;
  /** Highest believable average speed (km/h) for its distance: the API refuses faster, the prize checks use 3× (≥ 60). */
  speedCapKmh?: number;
  /** Impact on joints for the planner (low-impact swaps): running, jumping, contact = high; gliding, water = low. */
  impact?: "high" | "low";
  /** Counts as strength work for a strength plan. */
  strength?: boolean;
  /** Shown names. */
  name: { en: string; fr: string };
  /** What people say for it (first: the usual word). Normalised. */
  words: { en: string[]; fr: string[] };
  /** Played as a game: "play tennis", "jouer au foot" (racket and team sports, golf, curling, bowling, sports you add). */
  game?: boolean;
  /**
   * How people say they do it, as verbs (generated from the verb lexicon by `verbForms`, see VERB_LEXICON): "row",
   * "rowing", "lift weights", "play tennis"; "ramer", "rame", "je rame", "on rame", "jouer au foot". Normalised.
   * A noun in `words` wins over a verb form of another sport.
   */
  verbs: { en: string[]; fr: string[] };
}

type Opt = Partial<Pick<SportEntry, "persona" | "speedCapKmh" | "impact" | "strength" | "game">> & {
  vvaker?: string;
  gps?: boolean;
  distance?: boolean;
};

/** One entry: key, category, HealthKit type, icon, outdoor, MET, names, words, options. */
function sport(
  key: string,
  category: SportCategory,
  hk: string,
  icon: string,
  outdoor: boolean,
  met: number,
  name: [string, string],
  en: string[],
  fr: string[],
  o: Opt = {},
): SportEntry {
  const game = o.game ?? (category === "racket" || category === "team");
  return {
    key,
    vvaker: o.vvaker ?? key,
    ...(o.persona ? { persona: o.persona } : {}),
    category,
    hk,
    icon,
    outdoor,
    gps: o.gps ?? false,
    distance: o.distance ?? false,
    met,
    ...(o.speedCapKmh ? { speedCapKmh: o.speedCapKmh } : {}),
    ...(o.impact ? { impact: o.impact } : {}),
    ...(o.strength ? { strength: true } : {}),
    name: { en: name[0], fr: name[1] },
    words: { en, fr },
    ...(game ? { game: true } : {}),
    verbs: verbForms(VERB_LEXICON[key] ?? { en: [], fr: [] }, game ? { en, fr } : undefined),
  };
}

// ── Verbs: how people say they do a sport ─────────────────────────────────────────────────────────────────

/**
 * The verb lexicon: per sport, phrases led by a verb, English in its base form ("row", "lift weights", "do yoga",
 * "ice_skate" for a compound verb), French in the infinitive ("ramer", "faire de la muscu", "se promener"). `verbForms` turns each into what people
 * say: English base and -ing ("row", "rowing"); French infinitive, tu-imperative / present (je), "je …" and
 * "on …" ("courir", "cours", "je cours", "on court"). Racket and team sports (and golf, curling, bowling) also get
 * "play <name>" / "jouer au <name>" for each of their words. The grammar's rules add the rest: "go rowing", "let's
 * row", "I'm going to row", "on va ramer", "je vais ramer", "je pars ramer", "stop rowing", "arrête de ramer".
 * Never a word another command uses alone ("skip", "jump", "move", "break", "sauter", "joue", "fais").
 */
export const VERB_LEXICON: Readonly<Record<string, { en: string[]; fr: string[] }>> = {
  run: { en: ["run", "jog"], fr: ["courir", "trottiner", "faire un footing", "faire du jogging"] },
  walk: {
    en: ["walk", "stroll", "power_walk", "take a walk"],
    fr: ["marcher", "se promener", "se balader", "faire une marche", "faire une balade"],
  },
  ride: {
    en: ["ride", "bike", "cycle", "pedal", "spin", "ride my bike"],
    fr: ["pedaler", "rouler", "faire du velo", "faire du vtt", "faire du cyclisme"],
  },
  hike: { en: ["hike", "trek"], fr: ["randonner", "faire une rando", "faire de la randonnee", "faire de la rando"] },
  strength: {
    en: ["lift", "lift weights", "pump iron", "hit the gym"],
    fr: ["soulever des poids", "soulever de la fonte", "pousser de la fonte", "faire de la muscu", "faire de la musculation"],
  },
  dance: { en: ["dance"], fr: ["danser", "faire de la danse"] },
  boxing: { en: ["box", "spar", "hit the bag"], fr: ["boxer", "faire de la boxe"] },
  yoga: { en: ["do yoga", "practice yoga"], fr: ["faire du yoga", "pratiquer le yoga"] },
  swim: { en: ["swim", "swim laps"], fr: ["nager", "faire de la natation", "faire des longueurs"] },
  skate: {
    en: ["skate", "rollerblade", "skateboard", "ice_skate", "roller_skate", "inline_skate"],
    fr: ["patiner", "faire du patin", "faire du roller", "faire du skate"],
  },
  "track-field": { en: ["sprint", "run sprints", "do athletics"], fr: ["sprinter", "faire de l athletisme", "faire des sprints"] },
  "swim-bike-run": { en: ["do a triathlon", "do a duathlon"], fr: ["faire un triathlon", "faire un duathlon"] },
  transition: { en: ["do a transition", "practice transitions"], fr: ["faire la transition", "faire une transition"] },
  "wheelchair-walk": { en: ["roll my wheelchair", "do a wheelchair walk"], fr: ["pousser mon fauteuil", "faire une marche en fauteuil"] },
  "wheelchair-run": { en: ["race my wheelchair", "do a wheelchair run"], fr: ["courir en fauteuil", "faire une course en fauteuil"] },
  "hand-cycling": { en: ["handcycle", "hand_cycle", "ride my handbike"], fr: ["faire du handbike", "rouler en handbike"] },
  elliptical: { en: ["do elliptical", "use the elliptical"], fr: ["faire de l elliptique", "faire du velo elliptique"] },
  rowing: { en: ["row", "use the rower"], fr: ["ramer", "faire du rameur", "faire de l aviron"] },
  "stair-stepper": { en: ["use the stepper", "use the stairmaster"], fr: ["faire du stepper", "monter sur le stepper"] },
  stairs: {
    en: ["climb stairs", "climb the stairs", "take the stairs", "run stairs", "run the stairs"],
    fr: ["monter les escaliers", "grimper les escaliers", "faire les escaliers"],
  },
  hiit: { en: ["do hiit", "do intervals", "run intervals"], fr: ["faire du hiit", "faire du fractionne", "faire des intervalles"] },
  "mixed-cardio": { en: ["do cardio", "do aerobics"], fr: ["faire du cardio", "faire de l aerobic"] },
  "cross-training": { en: ["do crossfit", "cross_train"], fr: ["faire du crossfit", "faire du cross training"] },
  "step-training": { en: ["do step", "do step aerobics"], fr: ["faire du step", "faire de l aerobic step"] },
  "jump-rope": { en: ["jump rope", "skip rope"], fr: ["sauter a la corde", "faire de la corde a sauter"] },
  "fitness-gaming": {
    en: ["play beat saber", "play ring fit", "play a fitness game"],
    fr: ["jouer a beat saber", "jouer a ring fit", "jouer a un jeu de fitness"],
  },
  "functional-strength": {
    en: ["do kettlebells", "swing kettlebells", "do calisthenics", "do bodyweight training"],
    fr: ["faire du kettlebell", "faire du street workout", "faire de la callisthenie"],
  },
  core: { en: ["do abs", "do core", "work my abs", "work my core"], fr: ["faire du gainage", "faire des abdos", "faire la planche"] },
  gymnastics: { en: ["do gymnastics", "tumble", "do parkour"], fr: ["faire de la gymnastique", "faire du trampoline", "faire du parkour"] },
  pilates: { en: ["do pilates", "practice pilates"], fr: ["faire du pilates", "pratiquer le pilates"] },
  barre: { en: ["do barre", "take a barre class"], fr: ["faire de la barre au sol", "faire de la barre"] },
  "tai-chi": { en: ["do tai chi", "practice tai chi", "do qi gong"], fr: ["faire du tai chi", "pratiquer le tai chi", "faire du qi gong"] },
  "mind-body": {
    en: ["meditate", "do breathwork", "practice mindfulness"],
    fr: ["mediter", "faire de la meditation", "faire de la sophrologie"],
  },
  flexibility: { en: ["stretch", "do stretches", "do mobility"], fr: ["s etirer", "faire des etirements", "faire du stretching"] },
  cooldown: { en: ["cool down", "do a cooldown"], fr: ["faire le retour au calme", "faire un retour au calme"] },
  recovery: { en: ["warm up", "foam_roll", "recover"], fr: ["s echauffer", "recuperer", "faire de la recup"] },
  "cardio-dance": { en: ["do zumba", "do cardio dance"], fr: ["faire de la zumba", "faire de la danse cardio"] },
  kickboxing: { en: ["kickbox", "do muay thai"], fr: ["faire du kickboxing", "faire de la boxe thai", "faire du muay thai"] },
  "martial-arts": {
    en: ["do martial arts", "do karate", "do judo", "do taekwondo", "do jiu jitsu", "do mma", "train jiu jitsu"],
    fr: ["faire des arts martiaux", "faire du karate", "faire du judo", "faire du taekwondo", "faire du jiu jitsu", "faire du mma"],
  },
  wrestling: { en: ["wrestle", "grapple"], fr: ["lutter", "faire de la lutte"] },
  fencing: { en: ["fence"], fr: ["faire de l escrime", "croiser le fer"] },
  basketball: { en: ["shoot hoops"], fr: ["faire des paniers"] },
  "disc-sports": { en: ["throw a frisbee", "throw the frisbee"], fr: ["lancer le frisbee", "faire du frisbee"] },
  "water-polo": { en: [], fr: ["faire du water polo"] },
  "open-water": {
    en: ["swim open water", "swim in the sea", "swim in the lake"],
    fr: ["nager en eau libre", "nager en mer", "nager dans le lac"],
  },
  surf: {
    en: ["surf", "windsurf", "kitesurf", "bodyboard", "catch waves"],
    fr: ["surfer", "faire du surf", "faire du kitesurf", "faire de la planche a voile"],
  },
  paddle: { en: ["paddle", "kayak", "canoe", "paddleboard"], fr: ["pagayer", "faire du kayak", "faire du canoe", "faire du paddle"] },
  sailing: { en: ["sail"], fr: ["naviguer", "faire de la voile"] },
  "water-sports": { en: ["water_ski", "wakeboard", "snorkel"], fr: ["faire du ski nautique", "faire du wakeboard", "faire du snorkeling"] },
  "water-fitness": { en: ["do aqua aerobics", "do aquafit", "do water aerobics"], fr: ["faire de l aquagym", "faire de l aquabike"] },
  "downhill-ski": { en: ["ski", "hit the slopes"], fr: ["skier", "faire du ski"] },
  "cross-country-ski": { en: ["skate_ski", "ski cross country", "nordic_ski"], fr: ["faire du ski de fond", "faire du ski nordique"] },
  snowboard: { en: ["snowboard", "board down the slopes"], fr: ["faire du snowboard", "faire du surf des neiges"] },
  "snow-sports": { en: ["snowshoe", "sled", "sledge"], fr: ["faire de la raquette", "faire des raquettes", "faire de la luge"] },
  curling: { en: ["curl"], fr: ["faire du curling"] },
  climbing: { en: ["climb", "boulder", "rock_climb"], fr: ["grimper", "escalader", "faire de l escalade", "faire du bloc"] },
  equestrian: { en: ["ride a horse", "ride horses"], fr: ["monter a cheval", "faire du cheval", "faire de l equitation"] },
  golf: { en: ["golf", "hit the driving range"], fr: ["faire du golf", "faire un parcours de golf"] },
  archery: { en: ["shoot arrows", "do archery"], fr: ["tirer a l arc", "faire du tir a l arc"] },
  fishing: { en: ["fish", "fly_fish"], fr: ["pecher", "faire de la peche"] },
  hunting: { en: ["hunt"], fr: ["chasser", "faire de la chasse"] },
  bowling: { en: ["bowl"], fr: ["faire un bowling"] },
  play: { en: ["play outside", "play in the park"], fr: ["jouer dehors", "jouer au parc"] },
  other: { en: ["do another sport", "do a different sport"], fr: ["faire un autre sport", "faire une autre activite"] },
};

const VOWEL = /^[aeiou]/;

/** English -ing: "row" → "rowing", "skate" → "skating", "run" → "running", "ski" → "skiing", "canoe" → "canoeing". */
export function enIng(verb: string): string {
  if (/ie$/.test(verb)) return `${verb.slice(0, -2)}ying`;
  if (/[^eoy]e$/.test(verb)) return `${verb.slice(0, -1)}ing`;
  // One syllable, consonant-vowel-consonant: the consonant doubles (run, swim, jog, spin, spar, sled, trek, step).
  if (verb.length <= 4 && /(?:^|[^aeiou])[aeiou][b-df-hj-np-tvz]$/.test(verb)) return `${verb}${verb.slice(-1)}ing`;
  return `${verb}ing`;
}

/** French present of the irregular verbs the lexicon uses (je, il/on); the rest are -er verbs. */
const FR_IRREGULAR: Record<string, { je: string; on: string }> = {
  courir: { je: "cours", on: "court" },
  faire: { je: "fais", on: "fait" },
};

/** "ramer" → je / tu-imperative "rame", on "rame"; "courir" → "cours", "court". */
function frPresent(inf: string): { je: string; on: string } {
  const irr = FR_IRREGULAR[inf];
  if (irr) return irr;
  if (!inf.endsWith("er")) throw new Error(`No French conjugation for "${inf}"`);
  const stem = `${inf.slice(0, -2)}e`;
  return { je: stem, on: stem };
}

/**
 * One French phrase → what people say: the infinitive, the tu-imperative (also the present with "je"), "je …" and
 * "on …" ("faire du vélo", "fais du vélo", "je fais du vélo", "on fait du vélo"); "se promener" → "promène-toi",
 * "je me promène", "on se promène".
 */
export function frVerbPhrases(phrase: string): string[] {
  const t = phrase.split(" ");
  const reflexive = t[0] === "se" || t[0] === "s";
  const verb = reflexive ? t[1]! : t[0]!;
  const rest = t.slice(reflexive ? 2 : 1).join(" ");
  const p = frPresent(verb);
  const tail = (x: string) => (rest ? `${x} ${rest}` : x);
  const v = VOWEL.test(verb);
  if (reflexive) return [phrase, tail(`${p.je} toi`), tail(`je ${v ? "m" : "me"} ${p.je}`), tail(`on ${v ? "s" : "se"} ${p.on}`)];
  return [phrase, tail(p.je), tail(`${v ? "j" : "je"} ${p.je}`), tail(`on ${p.on}`)];
}

/**
 * One English phrase → its base and -ing forms ("lift weights", "lifting weights"). A compound verb is written with
 * "_" and inflects its last part: "ice_skate" → "ice skate", "ice skating".
 */
export function enVerbPhrases(phrase: string): string[] {
  const [verb, ...rest] = phrase.split(" ");
  const parts = verb!.split("_");
  const base = [parts.join(" "), ...rest].join(" ");
  return [base, [...parts.slice(0, -1), enIng(parts[parts.length - 1]!), ...rest].join(" ")];
}

/** Feminine sport names, for "jouer à la …". */
const FR_FEMININE = new Set(["crosse", "petanque", "lutte", "balle", "pelote"]);

/** "tennis" → "jouer au tennis", "crosse" → "jouer a la crosse", "ultimate" → "jouer a l ultimate". */
export function frPlay(word: string): string {
  const first = word.split(" ")[0]!;
  const art =
    word.startsWith("sports ") || word.startsWith("jeux") ? "aux" : FR_FEMININE.has(first) ? "a la" : VOWEL.test(word) ? "a l" : "au";
  return `jouer ${art} ${word}`;
}

/** A lexicon entry (and, for a game, its names) → its verb forms, in order, once each. */
export function verbForms(
  lex: { en: readonly string[]; fr: readonly string[] },
  game?: { en: readonly string[]; fr: readonly string[] },
): { en: string[]; fr: string[] } {
  const en = [...lex.en, ...(game?.en ?? []).map((w) => `play ${w}`)].flatMap(enVerbPhrases);
  const fr = [...lex.fr, ...(game?.fr ?? []).map(frPlay)].flatMap(frVerbPhrases);
  return { en: [...new Set(en)], fr: [...new Set(fr)] };
}

const GPS = (speedCapKmh: number, distance = true): Opt => ({ gps: true, distance, speedCapKmh });

export const SPORT_CATALOG: readonly SportEntry[] = [
  // The first ten: ids, planner keys and words unchanged.
  sport(
    "run",
    "endurance",
    "running",
    "figure.run",
    true,
    8,
    ["Run", "Course"],
    ["run", "runs", "running", "jog", "jogging", "trail run", "trail running"],
    ["course", "course a pied", "courir", "footing", "jogging", "running", "run", "trail"],
    { vvaker: "runner", persona: "runner", ...GPS(25), impact: "high" },
  ),
  sport(
    "walk",
    "endurance",
    "walking",
    "figure.walk",
    true,
    3.5,
    ["Walk", "Marche"],
    ["walk", "walking", "stroll", "power walk", "brisk walk", "nordic walking"],
    ["marche", "marcher", "balade", "promenade", "marche rapide", "marche nordique"],
    { vvaker: "walker", persona: "walker", ...GPS(12), impact: "low" },
  ),
  sport(
    "ride",
    "endurance",
    "cycling",
    "figure.outdoor.cycle",
    true,
    6,
    ["Ride", "Vélo"],
    ["ride", "bike ride", "bike", "biking", "cycling", "cycle", "bicycle", "indoor cycling", "spinning", "spin class", "mountain biking"],
    ["velo", "cyclisme", "pedaler", "vtt", "bicyclette", "velo d appartement", "home trainer", "spinning", "biking"],
    { vvaker: "cyclist", persona: "cyclist", ...GPS(80), impact: "low" },
  ),
  sport(
    "hike",
    "endurance",
    "hiking",
    "figure.hiking",
    true,
    5,
    ["Hike", "Randonnée"],
    ["hike", "hiking", "trek", "trekking"],
    ["randonnee", "rando", "randonner", "trek", "trekking"],
    { vvaker: "hiker", persona: "hiker", ...GPS(12) },
  ),
  sport(
    "strength",
    "strength",
    "traditionalStrengthTraining",
    "figure.strengthtraining.traditional",
    false,
    4.5,
    ["Strength", "Renfo"],
    [
      "strength",
      "strength training",
      "weights",
      "weight training",
      "weightlifting",
      "lifting",
      "gym",
      "traditional strength training",
      "bodybuilding",
    ],
    ["musculation", "muscu", "renforcement", "renfo", "renforcement musculaire", "halterophilie"],
    { vvaker: "lifter", persona: "lifter", strength: true },
  ),
  sport(
    "dance",
    "dance",
    "socialDance",
    "figure.socialdance",
    false,
    5,
    ["Dance", "Danse"],
    ["dance", "dancing", "social dance", "social dancing", "salsa", "tango", "bachata", "ballroom", "ballroom dancing", "swing dance"],
    ["danse", "danser", "danse de salon", "danse sociale", "salsa", "tango", "bachata", "rock n roll"],
    { vvaker: "dancer", persona: "dancer", impact: "high" },
  ),
  sport("boxing", "combat", "boxing", "figure.boxing", false, 7, ["Boxing", "Boxe"], ["boxing", "box", "boxe"], ["boxe", "boxe anglaise"], {
    vvaker: "boxer",
    persona: "boxer",
    impact: "high",
    strength: true,
  }),
  sport("yoga", "mind", "yoga", "figure.yoga", false, 2.5, ["Yoga", "Yoga"], ["yoga"], ["yoga"], {
    vvaker: "yogi",
    persona: "yogi",
    impact: "low",
  }),
  sport(
    "swim",
    "water",
    "swimming",
    "figure.pool.swim",
    false,
    7,
    ["Pool swim", "Natation"],
    ["swim", "swimming", "pool swim", "pool swimming", "laps", "swim laps"],
    ["natation", "nager", "nage", "piscine", "longueurs"],
    { vvaker: "swimmer", persona: "swimmer", distance: true, speedCapKmh: 8, impact: "low" },
  ),
  sport(
    "skate",
    "outdoor",
    "skatingSports",
    "figure.skating",
    true,
    7,
    ["Skate", "Patin"],
    [
      "skate",
      "skates",
      "skating",
      "inline skating",
      "roller skating",
      "rollerblading",
      "rollerblade",
      "roller blading",
      "ice skating",
      "skateboarding",
      "skateboard",
      "roller",
    ],
    [
      "patin",
      "patins",
      "patinage",
      "patiner",
      "patin a glace",
      "patins a roulettes",
      "patin a roulettes",
      "roller",
      "rollers",
      "skate",
      "skateboard",
    ],
    { vvaker: "skater", persona: "skater", ...GPS(50), impact: "high" },
  ),

  // Run, walk, ride: the rest.
  sport(
    "track-field",
    "endurance",
    "trackAndField",
    "figure.track.and.field",
    true,
    8,
    ["Track & field", "Athlétisme"],
    ["track and field", "athletics", "sprints", "sprinting", "long jump", "high jump", "shot put"],
    ["athletisme", "sprint", "saut en longueur", "saut en hauteur", "lancer du poids"],
    { persona: "runner", impact: "high" },
  ),
  sport(
    "swim-bike-run",
    "endurance",
    "swimBikeRun",
    "flag.checkered",
    true,
    9,
    ["Multisport", "Multisport"],
    ["triathlon", "duathlon", "multisport", "swim bike run", "aquathlon"],
    ["triathlon", "duathlon", "multisport", "aquathlon"],
    { persona: "runner", ...GPS(80) },
  ),
  sport(
    "transition",
    "endurance",
    "transition",
    "arrow.triangle.2.circlepath",
    true,
    4,
    ["Transition", "Transition"],
    ["transition", "triathlon transition"],
    ["transition", "transition triathlon"],
  ),
  sport(
    "wheelchair-walk",
    "endurance",
    "wheelchairWalkPace",
    "figure.roll",
    true,
    3.5,
    ["Wheelchair walk pace", "Fauteuil, allure marche"],
    ["wheelchair", "wheelchair walk", "wheelchair walk pace", "wheelchair push", "wheelchair pushing"],
    ["fauteuil", "fauteuil roulant", "fauteuil allure marche", "fauteuil marche"],
    { ...GPS(15), impact: "low" },
  ),
  sport(
    "wheelchair-run",
    "endurance",
    "wheelchairRunPace",
    "figure.roll.runningpace",
    true,
    6,
    ["Wheelchair run pace", "Fauteuil, allure course"],
    ["wheelchair run", "wheelchair run pace", "wheelchair racing", "wheelchair race"],
    ["fauteuil course", "fauteuil allure course", "course en fauteuil", "fauteuil athletisme"],
    { ...GPS(35), impact: "low" },
  ),
  sport(
    "hand-cycling",
    "endurance",
    "handCycling",
    "figure.hand.cycling",
    true,
    6,
    ["Hand cycling", "Handbike"],
    ["hand cycling", "handcycling", "handbike", "hand bike", "handcycle"],
    ["handbike", "handcycle", "handcycling", "velo a main", "velo a mains"],
    { persona: "cyclist", ...GPS(60), impact: "low" },
  ),

  // Gym & cardio.
  sport(
    "elliptical",
    "gym",
    "elliptical",
    "figure.elliptical",
    false,
    5,
    ["Elliptical", "Elliptique"],
    ["elliptical", "elliptical trainer", "cross trainer", "elliptical machine"],
    ["elliptique", "velo elliptique", "appareil elliptique"],
    { impact: "low" },
  ),
  sport(
    "rowing",
    "gym",
    "rowing",
    "figure.rower",
    false,
    6,
    ["Rower", "Rameur"],
    ["rowing", "rower", "rowing machine", "indoor rowing", "erg", "rowing erg"],
    ["rameur", "aviron", "aviron indoor", "rameur indoor"],
    { persona: "paddler", impact: "low" },
  ),
  sport(
    "stair-stepper",
    "gym",
    "stairClimbing",
    "figure.stair.stepper",
    false,
    8,
    ["Stair stepper", "Stepper"],
    ["stair stepper", "stairmaster", "stair master", "step machine", "stepper", "stair climber"],
    ["stepper", "simulateur d escalier", "stairmaster"],
  ),
  sport(
    "stairs",
    "gym",
    "stairs",
    "figure.stairs",
    false,
    8,
    ["Stairs", "Escaliers"],
    ["stairs", "stair climbing", "stair climb", "stair running", "steps workout"],
    ["escaliers", "escalier", "montee d escaliers", "monter les escaliers"],
    { impact: "high" },
  ),
  sport(
    "hiit",
    "gym",
    "highIntensityIntervalTraining",
    "figure.highintensity.intervaltraining",
    false,
    8,
    ["HIIT", "HIIT"],
    ["hiit", "high intensity interval training", "interval training", "intervals", "tabata", "circuit training", "circuit"],
    ["hiit", "fractionne", "intervalles", "tabata", "circuit training", "circuit", "entrainement fractionne"],
    { impact: "high", strength: true },
  ),
  sport(
    "mixed-cardio",
    "gym",
    "mixedCardio",
    "figure.mixed.cardio",
    false,
    6,
    ["Mixed cardio", "Cardio mixte"],
    ["mixed cardio", "cardio", "cardio workout", "aerobics"],
    ["cardio", "cardio mixte", "aerobic", "aerobics"],
  ),
  sport(
    "cross-training",
    "gym",
    "crossTraining",
    "figure.cross.training",
    false,
    7,
    ["Cross training", "Cross-training"],
    ["cross training", "crossfit", "cross fit", "bootcamp", "boot camp"],
    ["cross training", "crossfit", "cross fit", "bootcamp"],
    { persona: "lifter", impact: "high", strength: true },
  ),
  sport(
    "step-training",
    "gym",
    "stepTraining",
    "figure.step.training",
    false,
    7,
    ["Step training", "Step"],
    ["step training", "step aerobics", "step class", "step"],
    ["step", "cours de step", "step aerobic"],
  ),
  sport(
    "jump-rope",
    "gym",
    "jumpRope",
    "figure.jumprope",
    false,
    11,
    ["Jump rope", "Corde à sauter"],
    ["jump rope", "jumping rope", "skipping", "skipping rope", "rope skipping"],
    ["corde a sauter", "corde", "saut a la corde"],
    { impact: "high" },
  ),
  sport(
    "fitness-gaming",
    "gym",
    "fitnessGaming",
    "gamecontroller.fill",
    false,
    4,
    ["Fitness gaming", "Jeu de fitness"],
    ["fitness gaming", "exergaming", "ring fit", "vr fitness", "beat saber", "fitness game"],
    ["jeu de fitness", "jeux de fitness", "fitness gaming", "jeu video fitness", "fitness en realite virtuelle"],
  ),

  // Strength.
  sport(
    "functional-strength",
    "strength",
    "functionalStrengthTraining",
    "figure.strengthtraining.functional",
    false,
    5,
    ["Functional strength", "Renfo fonctionnel"],
    [
      "functional strength",
      "functional strength training",
      "functional training",
      "kettlebell",
      "kettlebells",
      "bodyweight training",
      "calisthenics",
      "trx",
    ],
    [
      "renfo fonctionnel",
      "renforcement fonctionnel",
      "entrainement fonctionnel",
      "kettlebell",
      "poids du corps",
      "callisthenie",
      "street workout",
      "trx",
    ],
    { persona: "lifter", strength: true },
  ),
  sport(
    "core",
    "strength",
    "coreTraining",
    "figure.core.training",
    false,
    4,
    ["Core training", "Gainage"],
    ["core", "core training", "core workout", "abs", "abs workout", "planks", "plank"],
    ["gainage", "abdos", "abdominaux", "sangle abdominale", "planche"],
    { persona: "lifter", strength: true },
  ),
  sport(
    "gymnastics",
    "strength",
    "gymnastics",
    "figure.gymnastics",
    false,
    4,
    ["Gymnastics", "Gymnastique"],
    ["gymnastics", "artistic gymnastics", "trampoline", "parkour"],
    ["gymnastique", "gym artistique", "gymnastique artistique", "trampoline", "parkour"],
    { impact: "high", strength: true },
  ),

  // Mind & body.
  sport(
    "pilates",
    "mind",
    "pilates",
    "figure.pilates",
    false,
    3,
    ["Pilates", "Pilates"],
    ["pilates", "reformer"],
    ["pilates", "reformer"],
    { persona: "yogi", impact: "low", strength: true },
  ),
  sport(
    "barre",
    "mind",
    "barre",
    "figure.barre",
    false,
    3.5,
    ["Barre", "Barre au sol"],
    ["barre", "barre class", "barre workout"],
    ["barre au sol", "barre", "cours de barre"],
    { persona: "dancer", impact: "low" },
  ),
  sport(
    "tai-chi",
    "mind",
    "taiChi",
    "figure.taichi",
    false,
    3,
    ["Tai chi", "Tai-chi"],
    ["tai chi", "taichi", "qi gong", "qigong"],
    ["tai chi", "taichi", "qi gong", "qigong"],
    { persona: "meditator", impact: "low" },
  ),
  sport(
    "mind-body",
    "mind",
    "mindAndBody",
    "figure.mind.and.body",
    false,
    2.5,
    ["Mind & body", "Corps & esprit"],
    ["mind and body", "mind body", "meditation", "meditate", "breathwork", "breathing exercises", "sophrology"],
    ["corps et esprit", "meditation", "mediter", "respiration", "sophrologie", "relaxation"],
    { persona: "meditator", impact: "low" },
  ),
  sport(
    "flexibility",
    "mind",
    "flexibility",
    "figure.flexibility",
    false,
    2.3,
    ["Flexibility", "Souplesse"],
    ["flexibility", "stretching", "stretch", "stretches", "mobility", "mobility work"],
    ["souplesse", "etirements", "etirement", "stretching", "mobilite"],
    { persona: "yogi", impact: "low" },
  ),
  sport(
    "cooldown",
    "mind",
    "cooldown",
    "figure.cooldown",
    false,
    2.5,
    ["Cooldown", "Retour au calme"],
    ["cooldown", "cool down", "cool down session"],
    ["retour au calme", "recuperation active"],
    { impact: "low" },
  ),
  sport(
    "recovery",
    "mind",
    "preparationAndRecovery",
    "figure.rolling",
    false,
    2.5,
    ["Prep & recovery", "Préparation & récupération"],
    ["recovery", "preparation and recovery", "warm up", "warmup", "foam rolling", "foam roller", "massage gun"],
    ["recuperation", "recup", "echauffement", "preparation et recuperation", "rouleau de massage"],
    { impact: "low" },
  ),

  // Dance.
  sport(
    "cardio-dance",
    "dance",
    "cardioDance",
    "figure.dance",
    false,
    6.5,
    ["Cardio dance", "Danse cardio"],
    ["cardio dance", "dance fitness", "zumba", "dance cardio", "dance workout"],
    ["danse cardio", "zumba", "fitness danse", "cardio danse", "danse fitness"],
    { persona: "dancer", impact: "high" },
  ),

  // Combat.
  sport(
    "kickboxing",
    "combat",
    "kickboxing",
    "figure.kickboxing",
    false,
    7.5,
    ["Kickboxing", "Kickboxing"],
    ["kickboxing", "kick boxing", "muay thai", "thai boxing", "cardio kickboxing"],
    ["kickboxing", "kick boxing", "boxe thai", "muay thai", "boxe francaise", "savate", "full contact"],
    { persona: "boxer", impact: "high", strength: true },
  ),
  sport(
    "martial-arts",
    "combat",
    "martialArts",
    "figure.martial.arts",
    false,
    6,
    ["Martial arts", "Arts martiaux"],
    ["martial arts", "karate", "judo", "taekwondo", "jiu jitsu", "jujitsu", "bjj", "kung fu", "aikido", "mma", "krav maga"],
    ["arts martiaux", "karate", "judo", "taekwondo", "jiu jitsu", "jujitsu", "kung fu", "aikido", "mma", "krav maga"],
    { persona: "martial", impact: "high", strength: true },
  ),
  sport(
    "wrestling",
    "combat",
    "wrestling",
    "figure.wrestling",
    false,
    6,
    ["Wrestling", "Lutte"],
    ["wrestling", "grappling"],
    ["lutte", "grappling"],
    { persona: "martial", impact: "high", strength: true },
  ),
  sport("fencing", "combat", "fencing", "figure.fencing", false, 6, ["Fencing", "Escrime"], ["fencing"], ["escrime"], { impact: "high" }),

  // Racket sports.
  sport("tennis", "racket", "tennis", "figure.tennis", true, 7, ["Tennis", "Tennis"], ["tennis"], ["tennis"], {
    persona: "racket",
    impact: "high",
  }),
  sport("badminton", "racket", "badminton", "figure.badminton", false, 5.5, ["Badminton", "Badminton"], ["badminton"], ["badminton"], {
    persona: "racket",
    impact: "high",
  }),
  sport(
    "table-tennis",
    "racket",
    "tableTennis",
    "figure.table.tennis",
    false,
    4,
    ["Table tennis", "Tennis de table"],
    ["table tennis", "ping pong"],
    ["tennis de table", "ping pong"],
    { persona: "racket" },
  ),
  sport(
    "pickleball",
    "racket",
    "pickleball",
    "figure.pickleball",
    true,
    4.5,
    ["Pickleball", "Pickleball"],
    ["pickleball"],
    ["pickleball"],
    { persona: "racket", impact: "high" },
  ),
  sport("squash", "racket", "squash", "figure.squash", false, 7.3, ["Squash", "Squash"], ["squash"], ["squash"], {
    persona: "racket",
    impact: "high",
  }),
  sport(
    "racquetball",
    "racket",
    "racquetball",
    "figure.racquetball",
    false,
    7,
    ["Racquetball", "Racquetball"],
    ["racquetball", "racketball"],
    ["racquetball", "racketball"],
    { persona: "racket", impact: "high" },
  ),

  // Team sports.
  sport(
    "soccer",
    "team",
    "soccer",
    "figure.soccer",
    true,
    7,
    ["Soccer", "Football"],
    ["soccer", "football", "futsal", "five a side", "5 a side"],
    ["foot", "football", "futsal", "foot a 5", "foot en salle"],
    { persona: "footballer", impact: "high" },
  ),
  sport(
    "basketball",
    "team",
    "basketball",
    "figure.basketball",
    false,
    6.5,
    ["Basketball", "Basket"],
    ["basketball", "basket", "hoops"],
    ["basket", "basketball", "basket ball"],
    { persona: "baller", impact: "high" },
  ),
  sport(
    "volleyball",
    "team",
    "volleyball",
    "figure.volleyball",
    false,
    4,
    ["Volleyball", "Volley"],
    ["volleyball", "volley", "beach volleyball", "beach volley"],
    ["volley", "volleyball", "volley ball", "beach volley"],
    { impact: "high" },
  ),
  sport(
    "hockey",
    "team",
    "hockey",
    "figure.hockey",
    false,
    8,
    ["Hockey", "Hockey"],
    ["hockey", "ice hockey", "field hockey", "roller hockey"],
    ["hockey", "hockey sur glace", "hockey sur gazon", "roller hockey"],
    { impact: "high" },
  ),
  sport("rugby", "team", "rugby", "figure.rugby", true, 8.3, ["Rugby", "Rugby"], ["rugby", "touch rugby"], ["rugby", "rugby a toucher"], {
    impact: "high",
  }),
  sport(
    "american-football",
    "team",
    "americanFootball",
    "figure.american.football",
    true,
    8,
    ["American football", "Football américain"],
    ["american football", "gridiron", "flag football"],
    ["football americain", "flag football"],
    { impact: "high" },
  ),
  sport(
    "australian-football",
    "team",
    "australianFootball",
    "figure.australian.football",
    true,
    8,
    ["Australian football", "Football australien"],
    ["australian football", "aussie rules", "afl"],
    ["football australien"],
    { impact: "high" },
  ),
  sport("baseball", "team", "baseball", "figure.baseball", true, 5, ["Baseball", "Baseball"], ["baseball"], ["baseball"]),
  sport("softball", "team", "softball", "figure.softball", true, 5, ["Softball", "Softball"], ["softball"], ["softball"]),
  sport("cricket", "team", "cricket", "figure.cricket", true, 4.8, ["Cricket", "Cricket"], ["cricket"], ["cricket"]),
  sport("lacrosse", "team", "lacrosse", "figure.lacrosse", true, 8, ["Lacrosse", "Crosse"], ["lacrosse"], ["crosse", "lacrosse"], {
    impact: "high",
  }),
  sport("handball", "team", "handball", "figure.handball", false, 8, ["Handball", "Handball"], ["handball"], ["handball", "hand ball"], {
    impact: "high",
  }),
  sport(
    "disc-sports",
    "team",
    "discSports",
    "figure.disc.sports",
    true,
    4,
    ["Disc sports", "Sports de disque"],
    ["ultimate", "ultimate frisbee", "frisbee", "disc golf", "disc sports"],
    ["ultimate", "frisbee", "disc golf", "sports de disque"],
    { impact: "high" },
  ),
  sport(
    "water-polo",
    "team",
    "waterPolo",
    "figure.waterpolo",
    false,
    10,
    ["Water polo", "Water-polo"],
    ["water polo", "waterpolo"],
    ["water polo", "waterpolo"],
    { persona: "swimmer", impact: "low" },
  ),

  // Water.
  sport(
    "open-water",
    "water",
    "swimming",
    "figure.open.water.swim",
    true,
    7,
    ["Open water swim", "Nage en eau libre"],
    ["open water swim", "open water swimming", "open water", "sea swim", "lake swim", "wild swimming"],
    ["eau libre", "nage en eau libre", "natation en eau libre", "nage en mer", "nage en lac"],
    { persona: "swimmer", ...GPS(8), impact: "low" },
  ),
  sport(
    "surf",
    "water",
    "surfingSports",
    "figure.surfing",
    true,
    3.5,
    ["Surfing", "Surf"],
    ["surfing", "surf", "bodyboarding", "bodyboard", "windsurfing", "kitesurfing", "kitesurf", "wing foil"],
    ["surf", "bodyboard", "planche a voile", "windsurf", "kitesurf", "kite", "wing foil"],
    { ...GPS(50, false), impact: "low" },
  ),
  sport(
    "paddle",
    "water",
    "paddleSports",
    "oar.2.crossed",
    true,
    5,
    ["Paddling", "Pagaie"],
    ["paddling", "kayaking", "kayak", "canoeing", "canoe", "paddleboarding", "paddle board", "paddleboard", "stand up paddle", "outrigger"],
    ["kayak", "canoe", "canoe kayak", "pagaie", "stand up paddle", "paddle board", "paddle", "pirogue"],
    { persona: "paddler", ...GPS(25), impact: "low" },
  ),
  sport(
    "sailing",
    "water",
    "sailing",
    "figure.sailing",
    true,
    3,
    ["Sailing", "Voile"],
    ["sailing", "sail", "dinghy sailing"],
    ["voile", "navigation a voile", "deriveur"],
    { ...GPS(60, false), impact: "low" },
  ),
  sport(
    "water-sports",
    "water",
    "waterSports",
    "water.waves",
    true,
    5,
    ["Water sports", "Sports nautiques"],
    ["water sports", "water skiing", "wakeboarding", "wakeboard", "snorkeling", "snorkelling"],
    ["sports nautiques", "ski nautique", "wakeboard", "snorkeling", "plongee en apnee"],
    { ...GPS(80, false), impact: "low" },
  ),
  sport(
    "water-fitness",
    "water",
    "waterFitness",
    "figure.water.fitness",
    false,
    5.5,
    ["Water fitness", "Aquagym"],
    ["water fitness", "aqua aerobics", "aquafit", "aqua fitness", "water aerobics", "aqua jogging"],
    ["aquagym", "aquafitness", "aqua fitness", "aquabike", "aquajogging"],
    { persona: "swimmer", impact: "low" },
  ),

  // Snow & ice.
  sport(
    "downhill-ski",
    "snow",
    "downhillSkiing",
    "figure.skiing.downhill",
    true,
    5.5,
    ["Downhill skiing", "Ski alpin"],
    ["skiing", "ski", "downhill skiing", "alpine skiing", "downhill ski"],
    ["ski", "ski alpin", "skier", "ski de piste", "ski de rando", "ski de randonnee"],
    { persona: "skier", ...GPS(120, false), impact: "high" },
  ),
  sport(
    "cross-country-ski",
    "snow",
    "crossCountrySkiing",
    "figure.skiing.crosscountry",
    true,
    9,
    ["Cross-country skiing", "Ski de fond"],
    ["cross country skiing", "cross country ski", "nordic skiing", "skate skiing", "classic skiing"],
    ["ski de fond", "ski nordique", "ski skating", "ski de fond skating"],
    { persona: "skier", ...GPS(40), impact: "low" },
  ),
  sport(
    "snowboard",
    "snow",
    "snowboarding",
    "figure.snowboarding",
    true,
    5,
    ["Snowboarding", "Snowboard"],
    ["snowboarding", "snowboard"],
    ["snowboard", "surf des neiges"],
    { persona: "skier", ...GPS(120, false), impact: "high" },
  ),
  sport(
    "snow-sports",
    "snow",
    "snowSports",
    "snowflake",
    true,
    6,
    ["Snow sports", "Sports de neige"],
    ["snow sports", "snowshoeing", "snowshoe", "snowshoes", "sledding", "sledging"],
    ["sports de neige", "raquettes", "raquettes a neige", "raquette a neige", "luge"],
    { ...GPS(120, false) },
  ),
  sport("curling", "snow", "curling", "figure.curling", false, 4, ["Curling", "Curling"], ["curling"], ["curling"], { game: true }),

  // Outdoors.
  sport(
    "climbing",
    "outdoor",
    "climbing",
    "figure.climbing",
    false,
    7,
    ["Climbing", "Escalade"],
    ["climbing", "climb", "rock climbing", "bouldering", "indoor climbing"],
    ["escalade", "grimpe", "grimper", "bloc", "escalade de bloc"],
    { persona: "climber", strength: true },
  ),
  sport(
    "equestrian",
    "outdoor",
    "equestrianSports",
    "figure.equestrian.sports",
    true,
    5.5,
    ["Equestrian", "Équitation"],
    ["horse riding", "horseback riding", "equestrian", "riding a horse", "show jumping", "dressage"],
    ["equitation", "cheval", "saut d obstacles", "dressage"],
    { ...GPS(70, false) },
  ),
  sport(
    "golf",
    "outdoor",
    "golf",
    "figure.golf",
    true,
    4.5,
    ["Golf", "Golf"],
    ["golf", "golfing", "driving range"],
    ["golf", "practice de golf"],
    { game: true },
  ),
  sport("archery", "outdoor", "archery", "figure.archery", true, 4.3, ["Archery", "Tir à l’arc"], ["archery"], ["tir a l arc"]),
  sport(
    "fishing",
    "outdoor",
    "fishing",
    "figure.fishing",
    true,
    3,
    ["Fishing", "Pêche"],
    ["fishing", "fly fishing"],
    ["peche", "peche a la mouche"],
  ),
  sport("hunting", "outdoor", "hunting", "figure.hunting", true, 5, ["Hunting", "Chasse"], ["hunting"], ["chasse"]),

  // Other.
  sport(
    "bowling",
    "other",
    "bowling",
    "figure.bowling",
    false,
    3.8,
    ["Bowling", "Bowling"],
    ["bowling", "ten pin bowling"],
    ["bowling", "petanque"],
    { game: true },
  ),
  sport(
    "play",
    "other",
    "play",
    "figure.play",
    true,
    5,
    ["Play", "Jeu libre"],
    ["free play", "playground", "playing outside"],
    ["jeu libre", "jeux", "jouer dehors", "parc de jeux"],
  ),
  sport(
    "other",
    "other",
    "other",
    "figure.mixed.cardio",
    false,
    4,
    ["Other", "Autre"],
    ["other sport", "other activity", "another sport"],
    ["autre sport", "autre activite", "un autre sport"],
  ),
];

const BY_KEY = new Map(SPORT_CATALOG.map((s) => [s.key, s]));

/** Every catalog sport id. */
export const SPORT_KEYS: readonly string[] = SPORT_CATALOG.map((s) => s.key);

/** True for a catalog sport id (not a custom one). */
export const isCatalogSport = (key: string): boolean => BY_KEY.has(key);

/**
 * Spoken word → sport key, per language (from the catalog): the words (nouns) first, then the verb forms; the first
 * sport listing a word keeps it, so a noun never goes to another sport's verb ("climb stairs" is stairs, "climb" climbing).
 */
export function sportWords(lang: "en" | "fr", catalog: readonly SportEntry[] = SPORT_CATALOG): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of catalog) for (const w of s.words[lang]) if (!(w in out)) out[w] = s.key;
  for (const s of catalog) for (const w of s.verbs?.[lang] ?? []) if (!(w in out)) out[w] = s.key;
  return out;
}

/** The words of the sports played as a game ("tennis", "foot"; nouns, not verbs) → sport key, for "play …" / "joue au …". */
export function sportGameWords(lang: "en" | "fr", catalog: readonly SportEntry[] = SPORT_CATALOG): Record<string, string> {
  const all = sportWords(lang, catalog);
  const games = new Set(catalog.filter((s) => s.game).map((s) => s.key));
  const out: Record<string, string> = {};
  for (const s of catalog) if (s.game) for (const w of s.words[lang]) if (games.has(all[w] ?? "")) out[w] = all[w]!;
  return out;
}

export const sportEntry = (key: string, catalog: readonly SportEntry[] = SPORT_CATALOG) =>
  catalog === SPORT_CATALOG ? BY_KEY.get(key) : catalog.find((s) => s.key === key);

/**
 * Old picker / planner keys (VVaker looks that weren't sports of their own) → the catalog sport they mean now:
 * a "footballer" plan session starts soccer, "roller" starts skating.
 */
export const LEGACY_SPORT_KEYS: Readonly<Record<string, string>> = {
  roller: "skate",
  skier: "downhill-ski",
  paddler: "paddle",
  footballer: "soccer",
  baller: "basketball",
  racket: "tennis",
  martial: "martial-arts",
  climber: "climbing",
  meditator: "mind-body",
  coder: "other",
};

// ── Custom sports (defined by the user, stored on the account) ─────────────────────────────────────────────

/** How a sport you add is measured: heart rate only (like yoga), or GPS too (distance, speed checks). */
export type CustomTracking = "hr" | "gps";

export interface CustomSport {
  /** `c_` + 10 lower-case letters or digits (the server picks it). */
  id: string;
  /** What you called it (English and French; one of them may repeat the other). */
  name: { en: string; fr: string };
  /** One of CUSTOM_SPORT_ICONS. */
  icon: string;
  tracking: CustomTracking;
}

export const CUSTOM_SPORT_ID = /^c_[a-z0-9]{10}$/;
export const isCustomSportId = (key: string): boolean => CUSTOM_SPORT_ID.test(key);
/** Sports one account can add. */
export const CUSTOM_SPORT_MAX = 20;
export const CUSTOM_SPORT_NAME_MAX = 32;
/** The average speed a GPS sport you added may reach (km/h): any faster is a vehicle (the prize checks use 3×). */
export const CUSTOM_GPS_SPEED_CAP_KMH = 60;
/** MET used for a sport you added (between walking and running: no guess beyond that). */
export const CUSTOM_SPORT_MET = 5;
/** Icons to pick from for a sport you add (SF Symbols the watch and the phone both draw). */
export const CUSTOM_SPORT_ICONS: readonly string[] = [
  "figure.mixed.cardio",
  "figure.run",
  "figure.walk",
  "figure.outdoor.cycle",
  "figure.hiking",
  "figure.strengthtraining.traditional",
  "figure.dance",
  "figure.boxing",
  "figure.yoga",
  "figure.pool.swim",
  "figure.climbing",
  "figure.skating",
  "figure.tennis",
  "figure.soccer",
  "figure.basketball",
  "figure.volleyball",
  "figure.skiing.downhill",
  "figure.surfing",
  "figure.golf",
  "figure.martial.arts",
  "figure.play",
  "oar.2.crossed",
  "sportscourt.fill",
  "trophy.fill",
  "flame.fill",
  "heart.fill",
  "bolt.fill",
  "star.fill",
  "leaf.fill",
  "mountain.2.fill",
];

/** What's wrong with a name for a new sport (null: fine). `taken`: one of your sports already has it. */
export type CustomSportNameProblem = "empty" | "too_long" | "catalog" | "taken";

/** The name as stored: no control or markup characters, single spaces, trimmed (may come back empty). */
export function cleanSportName(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069<>{}[\]\\`|^~$@#*_=]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lower case, no accents or punctuation (normalizeVoice's rule, repeated here so the catalog has no import cycle). */
export const normalizeSportWord = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const CATALOG_WORDS = new Set(
  SPORT_CATALOG.flatMap((s) => [
    ...s.words.en,
    ...s.words.fr,
    ...s.verbs.en,
    ...s.verbs.fr,
    normalizeSportWord(s.name.en),
    normalizeSportWord(s.name.fr),
  ]),
);

/** Checks a name for a sport you add (pure, tested): not empty, ≤ 32 characters, not a catalog sport, not one of yours. */
export function customSportNameProblem(name: string, mine: readonly Pick<CustomSport, "name">[] = []): CustomSportNameProblem | null {
  const clean = cleanSportName(name);
  const n = normalizeSportWord(clean);
  if (!n || !/\p{L}/u.test(n)) return "empty";
  if ([...clean].length > CUSTOM_SPORT_NAME_MAX) return "too_long";
  if (CATALOG_WORDS.has(n)) return "catalog";
  if (mine.some((c) => normalizeSportWord(c.name.en) === n || normalizeSportWord(c.name.fr) === n)) return "taken";
  return null;
}

/** A sport you added, as a catalog entry (pickers, voice, speed caps). Its planner key is its id. */
export function customSportEntry(c: CustomSport): SportEntry {
  const gps = c.tracking === "gps";
  const words = [...new Set([normalizeSportWord(c.name.en), normalizeSportWord(c.name.fr)].filter(Boolean))];
  return {
    key: c.id,
    vvaker: c.id,
    category: "other",
    hk: "other",
    icon: CUSTOM_SPORT_ICONS.includes(c.icon) ? c.icon : CUSTOM_SPORT_ICONS[0]!,
    outdoor: gps,
    gps,
    distance: gps,
    met: CUSTOM_SPORT_MET,
    ...(gps ? { speedCapKmh: CUSTOM_GPS_SPEED_CAP_KMH } : {}),
    name: { en: c.name.en || c.name.fr, fr: c.name.fr || c.name.en },
    words: { en: words, fr: words },
    // Its verbs come from its name only: "play padel", "do padel"; "jouer au padel", "faire du padel".
    game: true,
    verbs: verbForms({ en: words.map((w) => `do ${w}`), fr: words.map((w) => `faire du ${w}`) }, { en: words, fr: words }),
  };
}

/** The catalog entry for a sport id, a sport you added, or an old picker key ("footballer"). */
export function sportInfo(key: string, custom: readonly CustomSport[] = []): SportEntry | undefined {
  const e = BY_KEY.get(key) ?? BY_KEY.get(LEGACY_SPORT_KEYS[key] ?? "");
  if (e) return e;
  const c = custom.find((x) => x.id === key);
  return c ? customSportEntry(c) : undefined;
}

/** A sport's name in a language ("Tennis de table"); a sport you deleted or never had: "Workout" / "Séance". */
export function sportName(key: string, lang: "en" | "fr", custom: readonly CustomSport[] = []): string {
  return sportInfo(key, custom)?.name[lang] ?? (lang === "fr" ? "Séance" : "Workout");
}

/** The average speed cap (km/h) for a sport's distance, or undefined (no distance check). */
export function speedCapKmh(key: string, custom: readonly CustomSport[] = []): number | undefined {
  return sportInfo(key, custom)?.speedCapKmh;
}

/** Fastest a body moves between two 10-s samples for a sport (km/h): 3 × its average cap, at least 60. */
export function segmentSpeedCap(key: string, custom: readonly CustomSport[] = []): number | undefined {
  const cap = speedCapKmh(key, custom);
  return cap === undefined ? undefined : Math.max(60, 3 * cap);
}

/** Catalog sports measured over a distance (pace ghosts, distance goals). */
export const DISTANCE_SPORT_KEYS: readonly string[] = SPORT_CATALOG.filter((s) => s.distance).map((s) => s.key);

/** Search the catalog (and your sports) by name or word in either language, accents ignored; empty query: all. */
export function searchSports(query: string, custom: readonly CustomSport[] = []): SportEntry[] {
  const all = [...custom.map(customSportEntry), ...SPORT_CATALOG];
  const q = normalizeSportWord(query);
  if (!q) return all;
  const score = (s: SportEntry) => {
    const names = [s.name.en, s.name.fr].map(normalizeSportWord);
    const words = [...s.words.en, ...s.words.fr];
    if (names.some((n) => n === q)) return 0;
    if (names.some((n) => n.startsWith(q) || n.split(" ").some((w) => w.startsWith(q)))) return 1;
    if (words.some((w) => w.startsWith(q) || w.split(" ").some((x) => x.startsWith(q)))) return 2;
    if (names.some((n) => n.includes(q)) || words.some((w) => w.includes(q))) return 3;
    return 9;
  };
  return all
    .map((s, i) => ({ s, i, k: score(s) }))
    .filter((x) => x.k < 9)
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.s);
}
