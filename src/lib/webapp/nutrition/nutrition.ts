// Copied from VVFit packages/game-core/src/nutrition.ts (bcd38837 2026-10-30) by scripts/sync-nutrition-core.ts. Do not edit: re-sync.
/**
 * VVake Nutrition (ADR-0070, docs/02-product/nutrition.md): OPTIONAL, opt-in through Tailor ("Your VVake" feature
 * `nutrition`, default off, never inferred from use).
 *
 * This file is the shared, pure core used by the API, the phone, the web and (through a golden file) the watches:
 * - the athlete's nutrition profile (goal, diet style, allergies, intolerances, dislikes, cook time, budget…), cleaned
 *   the same way everywhere and synced newest-at-wins in `prefs.nutrition`;
 * - allergen / ingredient matching (EN + FR synonyms, accents and plurals folded). Allergies, intolerances, diet style
 *   and dislikes are HARD constraints: every generated meal goes through `mealConflicts` / `filterSafeMeals`; an unsure
 *   ingredient on an allergy counts as a hit;
 * - day targets from body weight, goal and training load (ISSN / ACSM numbers, floors, minors and ED-safe rules);
 * - a qualitative day status (never shaming, never kcal when numbers are hidden);
 * - copy safety (`nutritionCopyIssues`) and red-flag detection (`redFlagText`);
 * - the per-user correction model (portion bias per food family);
 * - per-plan limits (server vars override these defaults) and the estimate shapes.
 *
 * Evidence: Jäger 2017 (ISSN protein), Thomas 2016 (ACSM/AND/DC), Mountjoy 2023 (IOC REDs), Aragon 2017 (ISSN diets),
 * Kerksick 2017 (ISSN timing), Sawka 2007 (ACSM fluids). Full citations in docs/decisions/0070-nutrition.md.
 */
import type { MealKind } from "../coach/coachActions";
import { suggestAllowed, type SuggestLevel } from "../suggest/suggest";
import {
  notificationAllowed,
  notifyKindOff,
  TAILOR_NOTIFY_BUDGET,
  tailorQuiet,
  type TailorNotifyDecision,
  type TailorProfile,
} from "../tailor/tailor";

type Lang = "en" | "fr";

// ── Vocabulary ──────────────────────────────────────────────────────────────────────────────────────────────

export const NUTRITION_GOALS = ["muscle", "lean", "performance", "health"] as const;
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];
export const DIET_STYLES = ["omnivore", "flexitarian", "pescatarian", "vegetarian", "vegan", "halal", "kosher"] as const;
export type DietStyle = (typeof DIET_STYLES)[number];
/** The EU 14 (covers the US 9 too). */
export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const INTOLERANCES = ["lactose", "gluten_sensitivity", "fructose", "fodmap", "histamine", "caffeine", "alcohol"] as const;
export type Intolerance = (typeof INTOLERANCES)[number];
/** Minutes per meal, at most. */
export const COOK_TIMES = [10, 20, 30, 45, 60] as const;
export type CookTime = (typeof COOK_TIMES)[number];
export const BUDGETS = ["low", "medium", "high"] as const;
export type MealBudget = (typeof BUDGETS)[number];
export const MEALS_PER_DAY = [2, 3, 4, 5] as const;

/** A coarse region (country + region / province code), derived on the device; never coordinates. */
export interface NutritionRegion {
  country: string;
  region?: string;
}

export interface NutritionProfile {
  v: 1;
  on: boolean;
  goal: NutritionGoal;
  diet: DietStyle;
  /** ALLERGENS keys and/or free text ("cinnamon"), normalised lower-case, ≤ 20, each ≤ 40 chars. */
  allergies: string[];
  /** INTOLERANCES keys and/or free text. */
  intolerances: string[];
  /** Free-text ingredients ("cinnamon", "coriander"), also excluded from suggestions. */
  dislikes: string[];
  cookMinutes: CookTime;
  budget: MealBudget;
  mealsPerDay: 2 | 3 | 4 | 5;
  /** null = not asked yet (minor rules apply to 'lean' and any deficit). */
  adult: boolean | null;
  hideNumbers: boolean;
  /** ED-safe mode: forces hideNumbers, no deficit. */
  flagged: boolean;
  healthWrite: boolean;
  keepPhotos: boolean;
  askPhotos: boolean;
  askPhotosInQuiet: boolean;
  /** People eating the planned meals (grocery list), 1–8. */
  servings: number;
  /** "I already have it" items (grocery list), ≤ 60. */
  pantry: string[];
  /** Coarse region for saving tips and flyer links (country + region code only). */
  region?: NutritionRegion;
  /** ms, newest-at-wins sync (like prefs.tailor). */
  at: number;
}

export const NUTRITION_LIST_MAX = 20;
export const NUTRITION_TERM_MAX = 40;
export const NUTRITION_PANTRY_MAX = 60;

export function defaultNutritionProfile(): NutritionProfile {
  return {
    v: 1,
    on: false,
    goal: "health",
    diet: "omnivore",
    allergies: [],
    intolerances: [],
    dislikes: [],
    cookMinutes: 30,
    budget: "medium",
    mealsPerDay: 3,
    adult: null,
    hideNumbers: false,
    flagged: false,
    healthWrite: false,
    keepPhotos: false,
    askPhotos: false,
    askPhotosInQuiet: false,
    servings: 1,
    pantry: [],
    at: 0,
  };
}

const pick = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : fallback;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

/** A list of terms: trimmed, lower-case, control characters dropped, de-duplicated, capped. Pure. */
export function cleanTerms(v: unknown, max = NUTRITION_LIST_MAX): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x
      .replace(/[\u0000-\u001f<>{}[\]"\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, NUTRITION_TERM_MAX)
      .trim();
    if (t.length < 2 || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

const REGION_CODE = /^[A-Z]{2}$/;
const SUBREGION_CODE = /^[A-Z0-9]{1,3}$/;

/** A coarse region or undefined (country ISO-2, optional region code ≤ 3; anything else dropped). Pure. */
export function cleanRegion(v: unknown): NutritionRegion | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const country = typeof r.country === "string" ? r.country.trim().toUpperCase() : "";
  if (!REGION_CODE.test(country)) return undefined;
  const region = typeof r.region === "string" ? r.region.trim().toUpperCase() : "";
  return SUBREGION_CODE.test(region) ? { country, region } : { country };
}

/**
 * A profile as stored: unknown values back to defaults, lists capped, the ED-safe rules applied (flagged forces
 * hideNumbers; a minor or unknown age can't keep goal 'lean'). Pure.
 */
export function cleanNutritionProfile(raw: unknown): NutritionProfile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = defaultNutritionProfile();
  const adult = r.adult === true ? true : r.adult === false ? false : null;
  const flagged = bool(r.flagged, false);
  let goal = pick(r.goal, NUTRITION_GOALS, d.goal);
  if (goal === "lean" && adult !== true) goal = "health";
  const servingsN = typeof r.servings === "number" && Number.isFinite(r.servings) ? Math.round(r.servings) : 1;
  const region = cleanRegion(r.region);
  const at = typeof r.at === "number" && Number.isFinite(r.at) && r.at >= 0 ? Math.floor(r.at) : 0;
  return {
    v: 1,
    on: bool(r.on, false),
    goal,
    diet: pick(r.diet, DIET_STYLES, d.diet),
    allergies: cleanTerms(r.allergies),
    intolerances: cleanTerms(r.intolerances),
    dislikes: cleanTerms(r.dislikes),
    cookMinutes: pick(r.cookMinutes, COOK_TIMES, d.cookMinutes),
    budget: pick(r.budget, BUDGETS, d.budget),
    mealsPerDay: pick(r.mealsPerDay, MEALS_PER_DAY, d.mealsPerDay),
    adult,
    // Numbers are hidden by default for a minor (contract rule 3), always when flagged.
    hideNumbers: flagged || bool(r.hideNumbers, adult === false),
    flagged,
    healthWrite: bool(r.healthWrite, false),
    keepPhotos: bool(r.keepPhotos, false),
    askPhotos: bool(r.askPhotos, false),
    askPhotosInQuiet: bool(r.askPhotosInQuiet, false),
    servings: Math.min(8, Math.max(1, servingsN)),
    pantry: cleanTerms(r.pantry, NUTRITION_PANTRY_MAX),
    ...(region ? { region } : {}),
    at,
  };
}

/** The newer of two profiles (either may be missing): newest `at` wins (ties: b, the incoming). Pure. */
export function newerNutritionProfile(
  a: NutritionProfile | null | undefined,
  b: NutritionProfile | null | undefined,
): NutritionProfile | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.at >= a.at ? b : a;
}

/**
 * Nutrition is on for this account: the profile says on AND (when a Tailor profile exists) its `nutrition` feature is
 * on. Unlike other features, no profile does NOT mean on: nutrition is opt-in. Pure.
 */
export function nutritionOn(np: Pick<NutritionProfile, "on"> | null | undefined, tailorFeatures?: { nutrition?: boolean } | null): boolean {
  if (!np?.on) return false;
  return tailorFeatures ? tailorFeatures.nutrition !== false : true;
}

// ── Matching (EN + FR, accents and plurals folded) ──────────────────────────────────────────────────────────

/** Lower-case, accents and ligatures folded, punctuation to spaces. Pure. */
export function foldFood(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One word's singular (English and French plurals): berries → berry, tomatoes → tomato, noix → noi (both sides fold alike). */
const singular = (w: string): string => {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("aux") && w.length > 4) return `${w.slice(0, -3)}al`;
  if (w.endsWith("s") || w.endsWith("x")) return w.slice(0, -1);
  return w;
};

/** The folded words of a text, plurals made singular. Pure. */
export function foodWords(s: string): string[] {
  const f = foldFood(s);
  return f ? f.split(" ").map(singular) : [];
}

const has = (words: readonly string[], term: readonly string[]): number => {
  if (!term.length || term.length > words.length) return -1;
  outer: for (let i = 0; i + term.length <= words.length; i++) {
    for (let j = 0; j < term.length; j++) if (words[i + j] !== term[j]) continue outer;
    return i;
  }
  return -1;
};

/** Does the text contain this term as whole words (folded, singular)? Pure. */
export function containsTerm(text: string, term: string): boolean {
  return has(foodWords(text), foodWords(term)) >= 0;
}

interface TermSet {
  terms: string[];
  /** Phrases that look like a hit but aren't (coconut milk is not milk; blé noir is buckwheat). */
  except?: string[];
}

const MEAT = [
  "beef",
  "steak",
  "chicken",
  "turkey",
  "pork",
  "ham",
  "bacon",
  "lamb",
  "mutton",
  "veal",
  "duck",
  "goose",
  "sausage",
  "mince",
  "minced meat",
  "meatball",
  "meat",
  "salami",
  "chorizo",
  "prosciutto",
  "pepperoni",
  "pancetta",
  "lard",
  "gelatin",
  "gelatine",
  "chicken stock",
  "beef stock",
  "bone broth",
  "liver",
  "venison",
  "rabbit",
  "hot dog",
  "burger patty",
  "jerky",
  "kebab",
  "boeuf",
  "poulet",
  "dinde",
  "porc",
  "jambon",
  "lardon",
  "agneau",
  "veau",
  "canard",
  "oie",
  "saucisse",
  "saucisson",
  "viande",
  "viande hachee",
  "steak hache",
  "merguez",
  "rillette",
  "foie",
  "lapin",
  "gesier",
  "magret",
  "boulette de viande",
  "bouillon de poulet",
  "bouillon de boeuf",
  "pate de campagne",
  "andouille",
  "boudin",
  "cordon bleu",
  "nugget",
];
const PORK = [
  "pork",
  "ham",
  "bacon",
  "lard",
  "gelatin",
  "gelatine",
  "prosciutto",
  "pepperoni",
  "pancetta",
  "salami",
  "chorizo",
  "porc",
  "jambon",
  "lardon",
  "saucisson",
  "rillette",
  "andouille",
  "boudin",
  "pate de campagne",
  "speck",
  "coppa",
  "mortadella",
  "mortadelle",
];
const ALCOHOL = [
  "wine",
  "beer",
  "rum",
  "vodka",
  "whisky",
  "whiskey",
  "brandy",
  "cognac",
  "sake",
  "mirin",
  "liqueur",
  "cider",
  "kirsch",
  "gin",
  "vin",
  "biere",
  "rhum",
  "cidre",
  "calvados",
  "porto",
  "marsala",
  "champagne",
  "prosecco",
];

const FISH = [
  "fish",
  "fish sauce",
  "anchovy",
  "tuna",
  "salmon",
  "cod",
  "sardine",
  "mackerel",
  "trout",
  "haddock",
  "hake",
  "pollock",
  "tilapia",
  "halibut",
  "sea bass",
  "herring",
  "worcestershire",
  "surimi",
  "caesar dressing",
  "caesar salad",
  "nuoc mam",
  "bonito",
  "dashi",
  "poisson",
  "anchois",
  "thon",
  "saumon",
  "cabillaud",
  "maquereau",
  "truite",
  "colin",
  "merlu",
  "lieu",
  "dorade",
  "hareng",
  "loup de mer",
  "sauce poisson",
  "sauce de poisson",
  "tarama",
  "rillettes de thon",
];
const CRUSTACEANS = [
  "shrimp",
  "prawn",
  "crab",
  "lobster",
  "crayfish",
  "langoustine",
  "krill",
  "shellfish",
  "seafood",
  "crevette",
  "crabe",
  "homard",
  "langouste",
  "ecrevisse",
  "fruits de mer",
  "fruit de mer",
  "gambas",
];
const MOLLUSCS = [
  "mussel",
  "oyster",
  "clam",
  "scallop",
  "squid",
  "octopus",
  "snail",
  "calamari",
  "cuttlefish",
  "whelk",
  "shellfish",
  "seafood",
  "oyster sauce",
  "moule",
  "huitre",
  "palourde",
  "coquille saint jacques",
  "saint jacques",
  "calmar",
  "encornet",
  "poulpe",
  "pieuvre",
  "escargot",
  "seiche",
  "bulot",
  "bigorneau",
  "fruits de mer",
  "fruit de mer",
  "sauce huitre",
];
const EGGS = [
  "egg",
  "mayonnaise",
  "mayo",
  "aioli",
  "meringue",
  "hollandaise",
  "bearnaise",
  "custard",
  "brioche",
  "omelette",
  "omelet",
  "frittata",
  "quiche",
  "carbonara",
  "tiramisu",
  "egg pasta",
  "oeuf",
  "pate aux oeufs",
  "creme brulee",
  "flan",
  "pancake",
  "crepe",
  "eggnog",
];
const MILK = [
  "milk",
  "cheese",
  "butter",
  "cream",
  "yogurt",
  "yoghurt",
  "whey",
  "casein",
  "ghee",
  "parmesan",
  "mozzarella",
  "cheddar",
  "feta",
  "ricotta",
  "mascarpone",
  "brie",
  "camembert",
  "emmental",
  "gruyere",
  "comte",
  "halloumi",
  "paneer",
  "kefir",
  "lactose",
  "buttermilk",
  "custard",
  "ice cream",
  "quark",
  "skyr",
  "latte",
  "cappuccino",
  "milk chocolate",
  "bechamel",
  "tzatziki",
  "raita",
  "labneh",
  "cottage cheese",
  "cream cheese",
  "sour cream",
  "lait",
  "fromage",
  "beurre",
  "creme",
  "yaourt",
  "yogourt",
  "fromage blanc",
  "petit suisse",
  "raclette",
  "reblochon",
  "chevre",
  "creme fraiche",
  "chocolat au lait",
  "faisselle",
  "tomme",
  "roquefort",
  "cantal",
  "gratin",
  "croque monsieur",
  "croissant",
  "pain au chocolat",
  "brioche",
];
const GLUTEN = [
  "gluten",
  "wheat",
  "flour",
  "bread",
  "pasta",
  "spaghetti",
  "penne",
  "macaroni",
  "fusilli",
  "lasagna",
  "lasagne",
  "noodle",
  "couscous",
  "bulgur",
  "seitan",
  "barley",
  "rye",
  "spelt",
  "tempura",
  "breadcrumb",
  "panko",
  "soy sauce",
  "beer",
  "semolina",
  "durum",
  "farro",
  "kamut",
  "croissant",
  "baguette",
  "pizza",
  "tortilla",
  "wrap",
  "bagel",
  "cracker",
  "biscuit",
  "cookie",
  "cake",
  "pastry",
  "pie",
  "oat",
  "oatmeal",
  "porridge",
  "granola",
  "muesli",
  "crouton",
  "gnocchi",
  "dumpling",
  "pita",
  "naan",
  "brioche",
  "malt",
  "teriyaki",
  "udon",
  "ramen",
  "sandwich",
  "toast",
  "burger bun",
  "bun",
  "pancake",
  "crepe",
  "waffle",
  "muffin",
  "scone",
  "cereal",
  "ble",
  "farine",
  "pain",
  "pate",
  "orge",
  "seigle",
  "epeautre",
  "semoule",
  "avoine",
  "flocon d avoine",
  "chapelure",
  "gateau",
  "boulgour",
  "nouille",
  "galette de ble",
  "pain de mie",
  "biscotte",
  "tarte",
  "quiche",
  "gaufre",
  "croque monsieur",
  "pain au chocolat",
];
const TREE_NUTS = [
  "nut",
  "mixed nut",
  "almond",
  "hazelnut",
  "walnut",
  "cashew",
  "pistachio",
  "pecan",
  "macadamia",
  "brazil nut",
  "marzipan",
  "praline",
  "nutella",
  "pesto",
  "pine nut",
  "gianduja",
  "frangipane",
  "nougat",
  "nut butter",
  "almond milk",
  "almond flour",
  "amande",
  "noisette",
  "noix",
  "cajou",
  "noix de cajou",
  "pistache",
  "noix de pecan",
  "massepain",
  "pignon",
  "pate d amande",
  "poudre d amande",
  "lait d amande",
  "puree d amande",
];

const ALLERGEN_TERMS: Readonly<Record<Allergen, TermSet>> = {
  gluten: {
    terms: GLUTEN,
    except: [
      "buckwheat",
      "ble noir",
      "sarrasin",
      "rice noodle",
      "rice flour",
      "corn flour",
      "cornflour",
      "chickpea flour",
      "almond flour",
      "coconut flour",
      "buckwheat flour",
      "farine de riz",
      "farine de sarrasin",
      "farine de pois chiche",
      "farine de mai",
      "nouille de riz",
      "vermicelle de riz",
      "corn tortilla",
      "tortilla de mai",
      "rice cake",
      "galette de riz",
      "galette de sarrasin",
      "pain de riz",
      "pate de fruit",
      "pate d amande",
      "pate de campagne",
      "pate a tartiner",
    ],
  },
  crustaceans: { terms: CRUSTACEANS },
  eggs: { terms: EGGS, except: ["eggplant", "egg free", "vegan mayo", "vegan mayonnaise"] },
  fish: { terms: FISH },
  peanuts: {
    terms: [
      "peanut",
      "groundnut",
      "monkey nut",
      "peanut butter",
      "satay",
      "arachide",
      "cacahuete",
      "beurre de cacahuete",
      "beurre d arachide",
      "huile d arachide",
      "peanut oil",
    ],
  },
  soy: {
    terms: [
      "soy",
      "soya",
      "tofu",
      "tempeh",
      "edamame",
      "miso",
      "soy sauce",
      "tamari",
      "natto",
      "textured vegetable protein",
      "tvp",
      "soja",
      "sauce soja",
      "lait de soja",
      "yaourt au soja",
    ],
  },
  milk: {
    terms: MILK,
    except: [
      "coconut milk",
      "coconut cream",
      "lait de coco",
      "creme de coco",
      "almond milk",
      "lait d amande",
      "oat milk",
      "lait d avoine",
      "soy milk",
      "lait de soja",
      "rice milk",
      "lait de riz",
      "peanut butter",
      "beurre de cacahuete",
      "beurre d arachide",
      "cocoa butter",
      "beurre de cacao",
      "nut butter",
      "almond butter",
      "butternut",
      "cream of tartar",
      "creme de tartre",
      "vegan cheese",
      "dairy free",
      "lactose free milk",
    ],
  },
  tree_nuts: {
    terms: TREE_NUTS,
    except: [
      "coconut",
      "noix de coco",
      "nutmeg",
      "noix de muscade",
      "muscade",
      "butternut",
      "peanut",
      "nut free",
      "donut",
      "doughnut",
      "chestnut",
    ],
  },
  celery: { terms: ["celery", "celeriac", "celery salt", "celeri", "celeri rave", "sel de celeri"] },
  mustard: { terms: ["mustard", "dijon", "moutarde", "mustard seed", "graine de moutarde"] },
  sesame: {
    terms: ["sesame", "tahini", "tahina", "hummus", "houmous", "halva", "gomasio", "za atar", "zaatar", "sesame oil", "huile de sesame"],
  },
  sulphites: {
    terms: [
      "sulphite",
      "sulfite",
      "wine",
      "dried apricot",
      "wine vinegar",
      "balsamic",
      "vin",
      "abricot sec",
      "vinaigre de vin",
      "vinaigre balsamique",
      "cidre",
      "cider",
      "champagne",
      "prosecco",
    ],
  },
  lupin: { terms: ["lupin", "lupine", "lupin flour", "farine de lupin"] },
  molluscs: { terms: MOLLUSCS },
};

/** Words the athlete may type for an allergen as a whole ("dairy", "shellfish", « fruits à coque »). */
const ALLERGEN_ALIASES: Readonly<Record<Allergen, string[]>> = {
  gluten: ["gluten", "coeliac", "celiac", "coeliaque", "celiaque"],
  crustaceans: ["crustacean", "crustace", "shellfish"],
  eggs: ["egg", "oeuf"],
  fish: ["fish", "poisson"],
  peanuts: ["peanut", "arachide", "cacahuete"],
  soy: ["soy", "soya", "soja"],
  milk: ["milk", "dairy", "lait", "produit laitier", "laitage", "cow milk", "lait de vache"],
  tree_nuts: ["nut", "tree nut", "fruit a coque", "noix"],
  celery: ["celery", "celeri"],
  mustard: ["mustard", "moutarde"],
  sesame: ["sesame"],
  sulphites: ["sulphite", "sulfite", "sulfite", "sulphur dioxide", "anhydride sulfureux"],
  lupin: ["lupin", "lupine"],
  molluscs: ["mollusc", "mollusk", "mollusque", "shellfish"],
};

const INTOLERANCE_TERMS: Readonly<Record<Intolerance, TermSet>> = {
  lactose: { terms: MILK, except: [...(ALLERGEN_TERMS.milk.except ?? []), "lactose free"] },
  gluten_sensitivity: ALLERGEN_TERMS.gluten,
  fructose: {
    terms: [
      "honey",
      "agave",
      "apple",
      "pear",
      "mango",
      "fruit juice",
      "apple juice",
      "high fructose corn syrup",
      "watermelon",
      "dried fruit",
      "date",
      "fig",
      "miel",
      "pomme",
      "poire",
      "mangue",
      "jus de fruit",
      "jus de pomme",
      "pasteque",
      "fruit sec",
      "datte",
      "figue",
      "sirop d agave",
    ],
    except: ["pomme de terre", "pommes de terre", "pineapple", "apple cider vinegar"],
  },
  fodmap: {
    terms: [
      "onion",
      "garlic",
      "shallot",
      "leek",
      "wheat",
      "rye",
      "apple",
      "pear",
      "honey",
      "bean",
      "lentil",
      "chickpea",
      "cauliflower",
      "mushroom",
      "milk",
      "hummus",
      "oignon",
      "ail",
      "echalote",
      "poireau",
      "ble",
      "seigle",
      "pomme",
      "poire",
      "miel",
      "haricot",
      "lentille",
      "pois chiche",
      "chou fleur",
      "champignon",
      "lait",
      "houmous",
    ],
    except: ["pomme de terre", "pommes de terre", "green bean", "haricot vert", "garlic oil", "huile a l ail"],
  },
  histamine: {
    terms: [
      "aged cheese",
      "parmesan",
      "wine",
      "beer",
      "sauerkraut",
      "salami",
      "smoked fish",
      "smoked salmon",
      "tuna",
      "mackerel",
      "anchovy",
      "spinach",
      "vinegar",
      "soy sauce",
      "kombucha",
      "kimchi",
      "choucroute",
      "saucisson",
      "saumon fume",
      "thon",
      "maquereau",
      "anchois",
      "epinard",
      "vinaigre",
      "sauce soja",
      "vin",
      "biere",
    ],
  },
  caffeine: {
    terms: [
      "coffee",
      "espresso",
      "tea",
      "green tea",
      "black tea",
      "matcha",
      "cola",
      "energy drink",
      "guarana",
      "mate",
      "yerba mate",
      "cafe",
      "the vert",
      "the noir",
      "boisson energisante",
      "latte",
      "cappuccino",
    ],
    except: [
      "decaf coffee",
      "decaffeinated coffee",
      "cafe decafeine",
      "decaf tea",
      "decaf",
      "decaffeinated",
      "decafeine",
      "herbal tea",
      "tisane",
    ],
  },
  alcohol: { terms: ALCOHOL },
};

const DIET_TERMS: Readonly<Record<DietStyle, TermSet>> = {
  omnivore: { terms: [] },
  flexitarian: { terms: [] },
  pescatarian: {
    terms: MEAT,
    except: [
      "meat free",
      "sans viande",
      "vegetable stock",
      "bouillon de legume",
      "veggie burger",
      "plant based",
      "vegan sausage",
      "saucisse vegetale",
      "agar",
    ],
  },
  vegetarian: {
    terms: [...MEAT, ...FISH, ...CRUSTACEANS, ...MOLLUSCS, "rennet", "presure"],
    except: [
      "meat free",
      "sans viande",
      "vegetable stock",
      "bouillon de legume",
      "veggie burger",
      "plant based",
      "vegan sausage",
      "saucisse vegetale",
      "vegan fish sauce",
      "agar",
    ],
  },
  vegan: {
    terms: [
      ...MEAT,
      ...FISH,
      ...CRUSTACEANS,
      ...MOLLUSCS,
      ...EGGS,
      ...MILK,
      "honey",
      "miel",
      "rennet",
      "presure",
      "beeswax",
      "royal jelly",
      "gelee royale",
      "carmine",
    ],
    except: [
      ...(ALLERGEN_TERMS.milk.except ?? []),
      "eggplant",
      "meat free",
      "sans viande",
      "vegetable stock",
      "bouillon de legume",
      "veggie burger",
      "plant based",
      "vegan sausage",
      "saucisse vegetale",
      "vegan cheese",
      "vegan mayo",
      "vegan mayonnaise",
      "agar",
      "vegan butter",
      "margarine vegetale",
      "egg free",
      "dairy free",
      "vegan",
    ],
  },
  halal: {
    terms: [...PORK, ...ALCOHOL],
    except: [
      "halal gelatin",
      "gelatine halal",
      "beef gelatin",
      "gelatine de boeuf",
      "fish gelatin",
      "agar",
      "halal sausage",
      "saucisse halal",
      "beef bacon",
      "turkey bacon",
      "turkey ham",
      "jambon de dinde",
      "chicken ham",
    ],
  },
  kosher: {
    terms: [...PORK, ...CRUSTACEANS, ...MOLLUSCS],
    except: [
      "kosher gelatin",
      "gelatine casher",
      "fish gelatin",
      "agar",
      "turkey bacon",
      "beef bacon",
      "turkey ham",
      "jambon de dinde",
      "chicken ham",
    ],
  },
};

/** Ingredients the meal doesn't name clearly: with an allergy listed, they count as a hit (conservative). */
const UNSURE = [
  "unknown",
  "unknown sauce",
  "inconnu",
  "sauce inconnue",
  "various",
  "divers",
  "mystery",
  "secret sauce",
  "house sauce",
  "sauce maison",
  "spice mix",
  "melange d epice",
  "not sure",
  "pas sur",
];

/** Common free-text words and their other-language twins, so "cinnamon" also matches « cannelle ». */
const TWINS: readonly (readonly string[])[] = [
  ["cinnamon", "cannelle"],
  ["coriander", "cilantro", "coriandre"],
  ["garlic", "ail"],
  ["onion", "oignon"],
  ["mushroom", "champignon"],
  ["chili", "chilli", "piment"],
  ["tomato", "tomate"],
  ["banana", "banane"],
  ["strawberry", "fraise"],
  ["pineapple", "ananas"],
  ["avocado", "avocat"],
  ["coconut", "noix de coco", "coco"],
  ["peach", "peche"],
  ["apple", "pomme"],
  ["cucumber", "concombre"],
  ["ginger", "gingembre"],
  ["pork", "porc"],
  ["beef", "boeuf"],
  ["chicken", "poulet"],
  ["honey", "miel"],
  ["chocolate", "chocolat"],
  ["coffee", "cafe"],
  ["corn", "mai", "sweetcorn"],
  ["rice", "riz"],
  ["potato", "pomme de terre"],
  ["carrot", "carotte"],
  ["pea", "petit poi"],
  ["bean", "haricot"],
  ["lentil", "lentille"],
  ["chickpea", "pois chiche"],
  ["spinach", "epinard"],
  ["broccoli", "brocoli"],
  ["cabbage", "chou"],
  ["eggplant", "aubergine"],
  ["zucchini", "courgette"],
  ["lamb", "agneau"],
  ["liver", "foie"],
  ["beetroot", "beet", "betterave"],
  ["fennel", "fenouil"],
  ["anise", "aniseed", "ani", "anis"],
  ["licorice", "liquorice", "reglisse"],
  ["basil", "basilic"],
  ["parsley", "persil"],
  ["mint", "menthe"],
  ["vanilla", "vanille"],
  ["nutmeg", "muscade"],
  ["raspberry", "framboise"],
  ["cherry", "cerise"],
  ["lemon", "citron"],
  ["grapefruit", "pamplemousse"],
  ["watermelon", "pasteque"],
  ["mango", "mangue"],
  ["pear", "poire"],
  ["grape", "raisin"],
  ["oat", "avoine"],
  ["salmon", "saumon"],
  ["tuna", "thon"],
  ["shrimp", "prawn", "crevette"],
  ["olive", "olive"],
  ["pepper", "poivron"],
  ["kiwi", "kiwi"],
  ["cumin", "cumin"],
  ["curry", "curry"],
  ["celery", "celeri"],
  ["turkey", "dinde"],
  ["duck", "canard"],
  ["pumpkin", "squash", "courge", "potiron"],
  ["leek", "poireau"],
  ["radish", "radis"],
  ["blue cheese", "fromage bleu", "roquefort"],
  ["goat cheese", "fromage de chevre", "chevre"],
  ["tofu", "tofu"],
  ["quinoa", "quinoa"],
  ["sardine", "sardine"],
  ["dill", "aneth"],
  ["thyme", "thym"],
  ["rosemary", "romarin"],
  ["oregano", "origan"],
  ["sesame", "sesame"],
  ["soy", "soja"],
  ["milk", "lait"],
  ["cheese", "fromage"],
  ["egg", "oeuf"],
  ["cream", "creme"],
  ["butter", "beurre"],
];

/** The allergen keys a typed allergy stands for ("shellfish" = crustaceans + molluscs); [] = free text. */
const allergenKeysOf = (term: string): Allergen[] => {
  if ((ALLERGENS as readonly string[]).includes(term)) return [term as Allergen];
  const w = foodWords(term).join(" ");
  return ALLERGENS.filter((k) => ALLERGEN_ALIASES[k].some((a) => foodWords(a).join(" ") === w));
};
const intoleranceKeyOf = (term: string): Intolerance | null => {
  if ((INTOLERANCES as readonly string[]).includes(term)) return term as Intolerance;
  const w = foodWords(term).join(" ");
  if (w === "lactose" || w === "lactose intolerance" || w === "intolerance au lactose") return "lactose";
  if (w === "caffeine" || w === "cafeine") return "caffeine";
  if (w === "alcohol" || w === "alcool") return "alcohol";
  if (w === "fodmap") return "fodmap";
  if (w === "histamine") return "histamine";
  if (w === "fructose") return "fructose";
  return null;
};

/** The words a free-text term stands for: itself and its other-language twins. */
const freeTermVariants = (term: string): string[] => {
  const w = foodWords(term).join(" ");
  const twin = TWINS.find((g) => g.some((x) => foodWords(x).join(" ") === w));
  return twin ? [...new Set([w, ...twin.map((x) => foodWords(x).join(" "))])] : [w];
};

/** Does the text hit the term set (an exception phrase is removed first; "X-free" / « sans X » never hit X)? */
const hitsSet = (ingredient: string, set: TermSet): string | null => {
  let words = foodWords(ingredient);
  if (!words.length) return null;
  for (const ex of set.except ?? []) {
    const e = foodWords(ex);
    let i = has(words, e);
    while (i >= 0) {
      words = [...words.slice(0, i), "·", ...words.slice(i + e.length)];
      i = has(words, e);
    }
  }
  // "peanut-free", "gluten-free bread", « sans gluten », "without nuts": labelled free of this set → no hit from it.
  const heads = new Set(set.terms.map((t) => foodWords(t)[0]));
  for (let i = 0; i < words.length; i++) {
    if (words[i + 1] === "free" && heads.has(words[i]!)) return null;
    if ((words[i] === "sans" || words[i] === "without") && words[i + 1] && heads.has(words[i + 1]!)) return null;
  }
  // Other "X free" / « sans X »: the named thing is absent, the rest still counts.
  const cleaned: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i + 1] === "free" && words[i] !== "·") {
      i++;
      cleaned.push("·");
      continue;
    }
    if ((words[i] === "sans" || words[i] === "without") && words[i + 1]) {
      // drop the next word (and a following "de"/"d" + word: « sans fruits à coque » stays conservative: only one word)
      i++;
      cleaned.push("·");
      continue;
    }
    cleaned.push(words[i]!);
  }
  for (const t of set.terms) if (has(cleaned, foodWords(t)) >= 0) return t;
  return null;
};

export type ConstraintKind = "allergy" | "intolerance" | "dislike" | "diet";
export interface ConstraintHit {
  /** The allergen / intolerance key, the free-text term, or the diet style (kosher's meat-with-milk: 'kosher'). */
  term: string;
  kind: ConstraintKind;
  /** The ingredient (or the meal name) that hit. */
  ingredient: string;
}

type ConstraintProfile = Pick<NutritionProfile, "allergies" | "intolerances" | "dislikes" | "diet">;

const MEAT_SET: TermSet = { terms: MEAT, except: DIET_TERMS.vegetarian.except ?? [] };

/**
 * Every hard-constraint hit of these ingredients for the profile: allergies (EU-14 keys with their hidden forms, or free
 * text), intolerances, diet style (vegan ← honey, gelatin, eggs, milk…; halal / kosher ← pork…; kosher ← meat with
 * milk) and dislikes. With any allergy listed, an unsure ingredient ("unknown sauce") is a hit. Pure.
 */
export function ingredientHits(ingredients: readonly string[], profile: ConstraintProfile): ConstraintHit[] {
  const out: ConstraintHit[] = [];
  const add = (h: ConstraintHit) => {
    if (!out.some((x) => x.term === h.term && x.kind === h.kind && x.ingredient === h.ingredient)) out.push(h);
  };
  const list = ingredients.filter((x) => typeof x === "string" && x.trim());
  for (const a of profile.allergies) {
    const keys = allergenKeysOf(a);
    for (const ing of list) {
      if (keys.length) {
        for (const key of keys) if (hitsSet(ing, ALLERGEN_TERMS[key])) add({ term: key, kind: "allergy", ingredient: ing });
      } else if (freeTermVariants(a).some((v) => hitsSet(ing, { terms: [v] }))) add({ term: a, kind: "allergy", ingredient: ing });
      if (UNSURE.some((u) => foodWords(ing).join(" ") === foodWords(u).join(" ")))
        add({ term: keys[0] ?? a, kind: "allergy", ingredient: ing });
    }
  }
  for (const t of profile.intolerances) {
    const key = intoleranceKeyOf(t);
    for (const ing of list) {
      if (key) {
        if (hitsSet(ing, INTOLERANCE_TERMS[key])) add({ term: key, kind: "intolerance", ingredient: ing });
      } else if (freeTermVariants(t).some((v) => hitsSet(ing, { terms: [v] }))) add({ term: t, kind: "intolerance", ingredient: ing });
    }
  }
  const diet = DIET_TERMS[profile.diet];
  if (diet?.terms.length) for (const ing of list) if (hitsSet(ing, diet)) add({ term: profile.diet, kind: "diet", ingredient: ing });
  if (profile.diet === "kosher") {
    const meat = list.find((ing) => hitsSet(ing, MEAT_SET) && !hitsSet(ing, { terms: FISH }));
    const milk = list.find((ing) => hitsSet(ing, ALLERGEN_TERMS.milk));
    if (meat && milk) add({ term: "kosher", kind: "diet", ingredient: `${meat} + ${milk}` });
  }
  for (const d of profile.dislikes)
    for (const ing of list)
      if (freeTermVariants(d).some((v) => hitsSet(ing, { terms: [v] }))) add({ term: d, kind: "dislike", ingredient: ing });
  return out;
}

/** A meal's hits: its name, ingredients and declared allergens (keys) all count. Pure. */
export function mealConflicts(
  meal: { name: string; ingredients: readonly string[]; allergens?: readonly string[] },
  p: ConstraintProfile,
): ConstraintHit[] {
  const out = ingredientHits([meal.name, ...meal.ingredients], p);
  const keys = new Set<string>();
  for (const a of p.allergies) for (const k of allergenKeysOf(a)) keys.add(k);
  for (const t of p.intolerances) {
    const k = intoleranceKeyOf(t);
    if (k === "lactose") keys.add("milk");
    if (k === "gluten_sensitivity") keys.add("gluten");
  }
  for (const a of meal.allergens ?? []) {
    if (!keys.has(a) || out.some((h) => h.term === a)) continue;
    const kind: ConstraintKind = p.allergies.some((x) => allergenKeysOf(x).includes(a as Allergen)) ? "allergy" : "intolerance";
    out.push({ term: a, kind, ingredient: meal.name });
  }
  return out;
}

/** Only the meals with no hit at all (a hit is dropped, never shown). Pure. */
export function filterSafeMeals<T extends { name: string; ingredients: readonly string[]; allergens?: readonly string[] }>(
  meals: readonly T[],
  p: ConstraintProfile,
): T[] {
  return meals.filter((m) => mealConflicts(m, p).length === 0);
}

/** The allergens (EU-14 keys) named in these ingredients, whatever the profile: for tagging. Pure. */
export function allergensIn(ingredients: readonly string[]): Allergen[] {
  return ALLERGENS.filter((k) => ingredients.some((i) => hitsSet(i, ALLERGEN_TERMS[k])));
}

/** The calm note for a logged meal that hits the profile ("Contains peanuts, which you listed."). Pure. */
export function constraintNote(hits: readonly ConstraintHit[], lang: Lang): string | null {
  const terms = [...new Set(hits.filter((h) => h.kind !== "dislike").map((h) => h.term))];
  if (!terms.length) return null;
  const names = terms.map(
    (t) =>
      (ALLERGEN_NAMES as Record<string, { en: string; fr: string }>)[t]?.[lang] ??
      (INTOLERANCE_NAMES as Record<string, { en: string; fr: string }>)[t]?.[lang] ??
      (DIET_NAMES as Record<string, { en: string; fr: string }>)[t]?.[lang] ??
      t,
  );
  const list = names.join(", ");
  return lang === "fr" ? `Contient ${list}, que tu as indiqué.` : `Contains ${list}, which you listed.`;
}

// ── Training load and targets ───────────────────────────────────────────────────────────────────────────────

export type DayLoad = "rest" | "easy" | "moderate" | "hard" | "long";
export const DAY_LOADS: readonly DayLoad[] = ["rest", "easy", "moderate", "hard", "long"];

/**
 * The day's training load from today's plan and what's done: ≥ 120 min = long; hard intensity (planned or done) = hard;
 * ≥ 45 min or moderate = moderate; anything else under way = easy; nothing = rest. Pure.
 */
export function dayLoadOf(input: {
  plannedMin?: number;
  plannedIntensity?: "easy" | "moderate" | "hard";
  doneMin?: number;
  doneHard?: boolean;
}): DayLoad {
  const min = Math.max(0, input.plannedMin ?? 0, input.doneMin ?? 0);
  if (min >= 120) return "long";
  if (input.doneHard || input.plannedIntensity === "hard") return "hard";
  if (min >= 45 || input.plannedIntensity === "moderate") return "moderate";
  if (min > 0) return "easy";
  return "rest";
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
export interface Range {
  min: number;
  max: number;
}
export interface NutritionTargets {
  kcal: Range | null;
  proteinG: Range | null;
  carbsG: Range | null;
  fatG: Range | null;
  waterMl: number | null;
  carbTiming: "normal" | "around_session" | "fuel_during";
  floorKcal: number | null;
  /** The deficit applied (0 unless goal lean, adult, not flagged), % of maintenance, ≤ 15. */
  deficitPct: number;
  /** The surplus applied (muscle goal), % of maintenance, 5–10. */
  surplusPct: number;
}

export interface TargetInput {
  kg: number | null;
  heightCm?: number | null;
  age?: number | null;
  sex?: "f" | "m" | null;
  goal: NutritionGoal;
  load: DayLoad;
  trainingMin: number;
  adult: boolean | null;
  flagged: boolean;
}

/** Protein g/kg/day by goal (ISSN, Jäger 2017: 1.4–2.0 for most exercising people; a little higher in a deficit). */
export const PROTEIN_G_PER_KG: Readonly<Record<NutritionGoal, readonly [number, number]>> = {
  health: [1.2, 1.6],
  performance: [1.4, 1.8],
  muscle: [1.6, 2.0],
  lean: [1.8, 2.2],
};
/** Carbs g/kg/day by load (Thomas 2016, ACSM/AND/DC: 3–5 light, 5–7 moderate ~1 h, 6–10 high 1–3 h, 8–12 very high > 4 h). */
export const CARBS_G_PER_KG: Readonly<Record<DayLoad, readonly [number, number]>> = {
  rest: [3, 5],
  easy: [3, 5],
  moderate: [5, 7],
  hard: [6, 10],
  long: [6, 10],
};
/** Very long days (> 4 h): 8–12 g/kg. */
export const CARBS_VERY_LONG: readonly [number, number] = [8, 12];
/** Energy floor: never below max(25 kcal/kg, 1500 kcal) (IOC REDs, Mountjoy 2023: protect energy availability). */
export const KCAL_FLOOR_PER_KG = 25;
export const KCAL_FLOOR_MIN = 1500;
export const DEFICIT_MAX_PCT = 15;
/** Exercise cost, kcal per minute for 70 kg, by load (a modest, conservative estimate). */
const EX_KCAL_PER_MIN_70: Readonly<Record<DayLoad, number>> = { rest: 4, easy: 6, moderate: 8, hard: 11, long: 9 };

const r5 = (n: number) => Math.round(n / 5) * 5;
const r10 = (n: number) => Math.round(n / 10) * 10;
const r50 = (n: number) => Math.round(n / 50) * 50;

/** Who may get a deficit: goal lean AND an adult AND not flagged (contract rule 3). Pure. */
export const deficitAllowed = (i: Pick<TargetInput, "goal" | "adult" | "flagged">): boolean =>
  i.goal === "lean" && i.adult === true && !i.flagged;

/**
 * The day's targets. No body weight: everything null (qualitative only) but the carb timing. Maintenance = resting
 * energy (Mifflin–St Jeor when height, age and sex are known; else 22 kcal/kg) × 1.35 for daily life + the session.
 * Lean (adults, not flagged): a 12 % deficit on rest/easy days, 8 % on moderate, none on hard/long days (fuel the work).
 * Muscle: +5–10 %. The floor always wins. Pure.
 */
export function nutritionTargets(i: TargetInput): NutritionTargets {
  const trainingMin = Math.max(0, Math.min(720, Number.isFinite(i.trainingMin) ? i.trainingMin : 0));
  const carbTiming: NutritionTargets["carbTiming"] =
    i.load === "long" || trainingMin >= 75 ? "fuel_during" : i.load === "hard" || i.load === "moderate" ? "around_session" : "normal";
  const kg = typeof i.kg === "number" && Number.isFinite(i.kg) && i.kg >= 25 && i.kg <= 300 ? i.kg : null;
  const goal: NutritionGoal = i.goal === "lean" && i.adult !== true ? "health" : i.goal;
  if (kg === null)
    return {
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      waterMl: null,
      carbTiming,
      floorKcal: null,
      deficitPct: 0,
      surplusPct: 0,
    };
  const bmr =
    i.heightCm && i.age && i.sex && i.heightCm >= 120 && i.heightCm <= 230 && i.age >= 10 && i.age <= 100
      ? 10 * kg + 6.25 * i.heightCm - 5 * i.age + (i.sex === "m" ? 5 : -161)
      : 22 * kg;
  const exercise = trainingMin * EX_KCAL_PER_MIN_70[i.load === "rest" && trainingMin > 0 ? "easy" : i.load] * (kg / 70);
  const maintenance = bmr * 1.35 + exercise;
  const floor = Math.max(KCAL_FLOOR_PER_KG * kg, KCAL_FLOOR_MIN);
  const deficitPct = deficitAllowed({ goal, adult: i.adult, flagged: i.flagged })
    ? i.load === "rest" || i.load === "easy"
      ? 12
      : i.load === "moderate"
        ? 8
        : 0
    : 0;
  const surplusPct = goal === "muscle" ? 7.5 : 0;
  let lo: number;
  let hi: number;
  if (surplusPct) {
    lo = maintenance * 1.05;
    hi = maintenance * 1.1;
  } else {
    const mid = maintenance * (1 - Math.min(DEFICIT_MAX_PCT, deficitPct) / 100);
    lo = mid * 0.95;
    hi = mid * 1.05;
  }
  lo = Math.max(lo, floor);
  hi = Math.max(hi, lo + 100);
  const p = PROTEIN_G_PER_KG[goal];
  const c = i.load === "long" && trainingMin >= 240 ? CARBS_VERY_LONG : CARBS_G_PER_KG[i.load];
  const midKcal = (lo + hi) / 2;
  return {
    kcal: { min: r10(lo), max: r10(hi) },
    proteinG: { min: r5(p[0] * kg), max: r5(p[1] * kg) },
    carbsG: { min: r5(c[0] * kg), max: r5(c[1] * kg) },
    fatG: { min: r5((midKcal * 0.2) / 9), max: r5((midKcal * 0.35) / 9) },
    // ~30–35 ml/kg a day + ~400–800 ml per hour of exercise (Sawka 2007): 35 ml/kg + 600 ml/h.
    waterMl: r50(kg * 35 + (trainingMin / 60) * 600),
    carbTiming,
    floorKcal: r10(floor),
    deficitPct,
    surplusPct,
  };
}

/** During long sessions (> 60–90 min): carbs per hour (Thomas 2016): 30–60 g/h, up to 90 g/h past 2.5 h. Pure. */
export function carbsPerHour(sessionMin: number): Range | null {
  if (sessionMin < 60) return null;
  return sessionMin > 150 ? { min: 60, max: 90 } : { min: 30, max: 60 };
}

/** Recovery for quick refuelling (Thomas 2016, Kerksick 2017): 1.0–1.2 g/kg carbs in the first hour + ~0.3 g/kg protein. Pure. */
export function recoveryTargets(kg: number | null): { carbsG: Range; proteinG: number } | null {
  if (!kg || kg < 25) return null;
  return { carbsG: { min: r5(kg * 1.0), max: r5(kg * 1.2) }, proteinG: r5(kg * 0.3) };
}

/** Protein per meal (Jäger 2017: 0.25–0.4 g/kg every 3–4 h). Pure. */
export function proteinPerMeal(kg: number | null): Range | null {
  if (!kg || kg < 25) return null;
  return { min: r5(kg * 0.25), max: r5(kg * 0.4) };
}

export type StatusLevel = "low" | "ok" | "high";
export interface NutritionDayStatus {
  energy: StatusLevel | null;
  protein: StatusLevel | null;
  /** A NUTRITION_TEXT key: never shaming, never a number. */
  lineKey: string;
}

/**
 * The day's status, qualitative: energy and protein vs the targets and one calm line key. Hidden numbers: "plenty"
 * is never said (no comment on eating a lot), the line stays encouraging. No meal yet: the "nothing logged" line. Pure.
 */
export function nutritionDayStatus(
  totals: MacroTotals,
  t: Pick<NutritionTargets, "kcal" | "proteinG" | "carbTiming">,
  hideNumbers: boolean,
): NutritionDayStatus {
  const logged = totals.kcal > 0 || totals.proteinG > 0 || totals.carbsG > 0 || totals.fatG > 0;
  if (!logged) return { energy: null, protein: null, lineKey: "nutrition.status.none" };
  const lvl = (v: number, r: Range | null): StatusLevel | null => (r ? (v < r.min * 0.9 ? "low" : v > r.max * 1.15 ? "high" : "ok") : null);
  let energy = lvl(totals.kcal, t.kcal);
  let protein = lvl(totals.proteinG, t.proteinG);
  if (hideNumbers) {
    if (energy === "high") energy = "ok";
    if (protein === "high") protein = "ok";
  }
  let lineKey = "nutrition.status.logged";
  if (energy === "low" && t.carbTiming !== "normal") lineKey = "nutrition.status.fuel_up";
  else if (protein === "low") lineKey = "nutrition.status.protein_light";
  else if (energy === "low") lineKey = "nutrition.status.energy_light";
  else if (energy === "ok" && t.carbTiming === "fuel_during") lineKey = "nutrition.status.fuelled_long";
  else if (energy === "ok" && protein === "ok") lineKey = "nutrition.status.on_track";
  else if (energy === "high") lineKey = "nutrition.status.plenty";
  return { energy, protein, lineKey };
}

// ── Copy safety ─────────────────────────────────────────────────────────────────────────────────────────────

/** Words and phrases nutrition copy (ours, the coach's, the model's) never uses. */
export const NUTRITION_BANNED_WORDS: { en: string[]; fr: string[] } = {
  en: [
    "cheat meal",
    "cheat day",
    "cheat",
    "junk food",
    "junk",
    "guilty",
    "guilt",
    "guilt free",
    "bad food",
    "good food",
    "bad foods",
    "good foods",
    "burn off",
    "burn it off",
    "earn your food",
    "earn your meal",
    "earned your",
    "sin",
    "sinful",
    "clean eating",
    "eat clean",
    "punish",
    "punishment",
    "naughty",
    "indulgence",
    "forbidden food",
    "skinny",
    "fat burning",
    "detox",
    "compensate",
    "make up for",
    "work it off",
    "beach body",
    "bikini body",
    "starve",
  ],
  fr: [
    "cheat meal",
    "repas triche",
    "tricher",
    "malbouffe",
    "coupable",
    "culpabilite",
    "sans culpabilite",
    "mauvais aliment",
    "bon aliment",
    "aliments interdits",
    "bruler les calories",
    "eliminer ce repas",
    "meriter ton repas",
    "merite ton repas",
    "peche",
    "manger propre",
    "punir",
    "punition",
    "ecart",
    "compenser",
    "rattraper",
    "detox",
    "maigrir vite",
    "corps de plage",
    "affamer",
  ],
};

/** The banned words found in a text (folded, whole words). Pure. */
export function nutritionCopyIssues(text: string, lang: Lang): string[] {
  const words = foldFood(text).split(" ");
  const out: string[] = [];
  for (const b of NUTRITION_BANNED_WORDS[lang]) if (has(words, foldFood(b).split(" ")) >= 0 && !out.includes(b)) out.push(b);
  // "sin" alone in FR folds from « péché »: also check English list on French text for borrowed words like "cheat".
  if (lang === "fr") for (const b of ["cheat", "junk", "detox"]) if (has(words, [b]) >= 0 && !out.includes(b)) out.push(b);
  return out;
}

const RED_FLAG_PATTERNS: readonly RegExp[] = [
  /\bstarv(e|ing|ed) (myself|me|to (lose|drop|get))\b/,
  /\bstarv(e|ing|ed) (until|till|before)\b/,
  /\bpurg(e|ing|ed) (after|meals?|food|it|myself|everything)\b/,
  /\b(binge|bingeing|binging) and purg/,
  /\b(make myself|making myself|made myself) (sick|throw up|vomit)\b/,
  /\b(vomit|throw up|throwing up|threw up)\b.*\b(after|eating|meal|ate)\b/,
  /\b(after|eating|meal|ate)\b.*\b(vomit|throw up|throwing up|threw up)\b/,
  /\bskip(ping)? (meals?|breakfast|lunch|dinner) to (lose|drop|get thin)/,
  /\blaxatives?\b/,
  /\bdiuretics? to (lose|drop)/,
  /\b(not eating|stop eating|stopped eating|eat nothing|ate nothing)\b/,
  /\bonly eat(ing)? [1-7]\d{2} (kcal|calories|cal)\b/,
  /\b([1-7]\d{2}) (kcal|calories|cal)( a| per)? day\b/,
  /\b(hate|disgusted by) my body\b/,
  /\b(binge|binging|bingeing)\b/,
  /\bpro ?ana\b/,
  /\bthinspo\b/,
  /\b(m'affamer|m affamer|affamee?|jeuner pour maigrir)\b/,
  /\b(me faire vomir|je me fais vomir|vomir apres|vomi apres)\b/,
  /\bsaut(e|es|er|ais|ait) (des|les|mes) repas pour (maigrir|perdre)\b/,
  /\blaxatifs?\b/,
  /\b(ne plus manger|arrete de manger|je ne mange plus|je mange rien|je ne mange rien)\b/,
  /\b([1-7]\d{2}) (kcal|calories) par jour\b/,
  /\b(je deteste|degoutee? de) mon corps\b/,
  /\b(crise de boulimie|hyperphagie|boulimie|anorexie)\b/,
];

/** Does the text sound like disordered eating (EN + FR)? Then: numbers hidden, no deficit, a gentle referral. Pure. */
export function redFlagText(text: string): boolean {
  const t = foldFood(text.replace(/[’']/g, "'")).replace(/\s+/g, " ");
  // keep the apostrophe-free form too (foldFood turns apostrophes into spaces)
  return RED_FLAG_PATTERNS.some((re) => re.test(t));
}

/** The referral line, once (doctor / registered dietitian). Pure. */
export const referralLine = (lang: Lang): string => NUTRITION_TEXT["nutrition.referral"]![lang];

// ── Per-user correction model ───────────────────────────────────────────────────────────────────────────────

export const BIAS_FAMILIES = [
  "pasta",
  "rice",
  "bread",
  "meat",
  "fish",
  "cheese",
  "sauce",
  "veg",
  "fruit",
  "drink",
  "dessert",
  "other",
] as const;
export type BiasFamily = (typeof BIAS_FAMILIES)[number];

const FAMILY_WORDS: ReadonlyArray<readonly [BiasFamily, readonly string[]]> = [
  [
    "dessert",
    [
      "cake",
      "cookie",
      "ice cream",
      "chocolate",
      "pastry",
      "pie",
      "brownie",
      "muffin",
      "donut",
      "dessert",
      "tiramisu",
      "mousse",
      "gateau",
      "glace",
      "chocolat",
      "tarte",
      "patisserie",
      "creme brulee",
      "flan",
      "crepe",
      "biscuit",
    ],
  ],
  [
    "sauce",
    [
      "sauce",
      "dressing",
      "mayonnaise",
      "mayo",
      "ketchup",
      "pesto",
      "gravy",
      "vinaigrette",
      "aioli",
      "hummus",
      "houmous",
      "oil",
      "huile",
      "butter",
      "beurre",
    ],
  ],
  [
    "cheese",
    ["cheese", "fromage", "mozzarella", "parmesan", "cheddar", "feta", "brie", "camembert", "emmental", "comte", "raclette", "chevre"],
  ],
  [
    "pasta",
    [
      "pasta",
      "spaghetti",
      "penne",
      "macaroni",
      "fusilli",
      "lasagna",
      "lasagne",
      "noodle",
      "ramen",
      "udon",
      "gnocchi",
      "pate",
      "nouille",
      "tagliatelle",
      "ravioli",
    ],
  ],
  ["rice", ["rice", "riz", "risotto", "paella", "sushi", "couscous", "quinoa", "bulgur", "boulgour", "semoule"]],
  [
    "bread",
    [
      "bread",
      "toast",
      "baguette",
      "bagel",
      "bun",
      "wrap",
      "tortilla",
      "pita",
      "naan",
      "croissant",
      "brioche",
      "pain",
      "sandwich",
      "pizza",
      "cereal",
      "oat",
      "granola",
      "muesli",
      "porridge",
      "avoine",
      "cracker",
    ],
  ],
  [
    "fish",
    [
      "fish",
      "salmon",
      "tuna",
      "cod",
      "sardine",
      "mackerel",
      "trout",
      "shrimp",
      "prawn",
      "poisson",
      "saumon",
      "thon",
      "cabillaud",
      "crevette",
      "moule",
      "mussel",
    ],
  ],
  [
    "meat",
    [
      "beef",
      "steak",
      "chicken",
      "turkey",
      "pork",
      "ham",
      "bacon",
      "lamb",
      "sausage",
      "meat",
      "burger",
      "boeuf",
      "poulet",
      "dinde",
      "porc",
      "jambon",
      "agneau",
      "saucisse",
      "viande",
      "egg",
      "oeuf",
      "tofu",
      "tempeh",
    ],
  ],
  [
    "drink",
    [
      "juice",
      "smoothie",
      "soda",
      "cola",
      "coffee",
      "tea",
      "latte",
      "milk",
      "beer",
      "wine",
      "water",
      "jus",
      "cafe",
      "lait",
      "biere",
      "vin",
      "eau",
      "shake",
    ],
  ],
  [
    "fruit",
    [
      "apple",
      "banana",
      "orange",
      "berry",
      "strawberry",
      "grape",
      "pear",
      "mango",
      "pineapple",
      "kiwi",
      "peach",
      "melon",
      "fruit",
      "pomme",
      "banane",
      "fraise",
      "raisin",
      "poire",
      "mangue",
      "ananas",
      "peche",
      "compote",
    ],
  ],
  [
    "veg",
    [
      "salad",
      "lettuce",
      "tomato",
      "carrot",
      "broccoli",
      "spinach",
      "pepper",
      "cucumber",
      "zucchini",
      "bean",
      "pea",
      "lentil",
      "chickpea",
      "potato",
      "fries",
      "vegetable",
      "veg",
      "soup",
      "avocado",
      "salade",
      "tomate",
      "carotte",
      "brocoli",
      "epinard",
      "poivron",
      "concombre",
      "courgette",
      "haricot",
      "lentille",
      "pois chiche",
      "pomme de terre",
      "frite",
      "legume",
      "soupe",
      "avocat",
      "ratatouille",
    ],
  ],
];

/** The food family of an item (for the portion bias): pasta, rice, bread, meat, fish, cheese, sauce, veg, fruit, drink, dessert, other. Pure. */
export function biasKey(itemName: string): BiasFamily {
  const words = foodWords(itemName);
  // "pomme de terre" first: a potato, not an apple.
  if (has(words, foodWords("pomme de terre")) >= 0) return "veg";
  for (const [fam, list] of FAMILY_WORDS) if (list.some((w) => has(words, foodWords(w)) >= 0)) return fam;
  return "other";
}

export interface Bias {
  factor: number;
  n: number;
}
export const BIAS_ALPHA = 0.3;
export const BIAS_MIN = 0.5;
export const BIAS_MAX = 2;

/** One correction folded in: user grams / AI grams as an EMA (α 0.3), clamped 0.5–2. Pure. */
export function updateBias(prev: Bias | null, aiGrams: number, userGrams: number): Bias {
  if (!(aiGrams > 0) || !(userGrams > 0)) return prev ?? { factor: 1, n: 0 };
  const ratio = Math.min(BIAS_MAX, Math.max(BIAS_MIN, userGrams / aiGrams));
  const factor = prev && prev.n > 0 ? prev.factor * (1 - BIAS_ALPHA) + ratio * BIAS_ALPHA : ratio;
  return { factor: Math.round(Math.min(BIAS_MAX, Math.max(BIAS_MIN, factor)) * 1000) / 1000, n: (prev?.n ?? 0) + 1 };
}

/** Grams with the athlete's bias for that family (only after 2 corrections). Pure. */
export function applyBias(grams: number, b: Bias | null): number {
  if (!b || b.n < 2) return grams;
  return Math.min(2000, Math.max(1, Math.round(grams * b.factor)));
}

// ── Limits (defaults; the server's [vars.NUTRITION] overrides them) ─────────────────────────────────────────

export type NutritionTier = "free" | "plus" | "premium";
export interface NutritionLimit {
  photosPerWeek: number;
  textPerDay: number;
  suggestPerWeek: number;
  plansPerWeek: number;
}
/**
 * Per plan, from the measured cost under the margin rule (ADR-0070 §Cost): Free stays cheap (a taste of photo logging,
 * local plans), Plus and Premium cover daily use. Testers and early testers get Premium. Over a limit: manual entry with
 * the local food table, local meal ideas and plans (never an error).
 */
export const NUTRITION_LIMITS: Readonly<Record<NutritionTier, NutritionLimit>> = {
  free: { photosPerWeek: 3, textPerDay: 3, suggestPerWeek: 2, plansPerWeek: 0 },
  plus: { photosPerWeek: 21, textPerDay: 10, suggestPerWeek: 7, plansPerWeek: 1 },
  premium: { photosPerWeek: 42, textPerDay: 20, suggestPerWeek: 14, plansPerWeek: 2 },
};

/** Limits from the server var (JSON `{ "free": {...}, ... }`, partial ok), the defaults filling gaps. Pure. */
export function nutritionLimitsFrom(raw: unknown): Record<NutritionTier, NutritionLimit> {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const src = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown> | undefined>;
  const out = {} as Record<NutritionTier, NutritionLimit>;
  for (const t of ["free", "plus", "premium"] as const) {
    const d = NUTRITION_LIMITS[t];
    const s = src[t] ?? {};
    const n = (k: keyof NutritionLimit) => {
      const x = Number(s[k]);
      return Number.isFinite(x) && x >= 0 && x <= 1000 ? Math.floor(x) : d[k];
    };
    out[t] = {
      photosPerWeek: n("photosPerWeek"),
      textPerDay: n("textPerDay"),
      suggestPerWeek: n("suggestPerWeek"),
      plansPerWeek: n("plansPerWeek"),
    };
  }
  return out;
}

// ── Estimates ───────────────────────────────────────────────────────────────────────────────────────────────

export interface MealItem {
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** 0..1 */
  confidence: number;
  family?: string;
}
export type MealSource = "photo" | "text" | "manual" | "table";
export const MEAL_SOURCES: readonly MealSource[] = ["photo", "text", "manual", "table"];
export interface MealEstimate {
  items: MealItem[];
  totals: MacroTotals;
  confidence: number;
  portionHint?: string;
  notes?: string[];
  hits: ConstraintHit[];
  source: MealSource;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const fin = (v: unknown, d = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : d;

/**
 * One item made safe (the model is never trusted): name trimmed (≤ 60), grams 1–2000, kcal ≤ 3000, macros ≥ 0 and
 * consistent: when 4·P + 4·C + 9·F is more than 25 % off the kcal, the kcal follow the macros. null when unusable. Pure.
 */
export function cleanMealItem(raw: unknown): MealItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name =
    typeof r.name === "string"
      ? r.name
          .replace(/[\u0000-\u001f<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60)
      : "";
  if (!name) return null;
  const grams = Math.round(clamp(fin(r.grams, 100), 1, 2000));
  const proteinG = round1(clamp(fin(r.proteinG), 0, 400));
  const carbsG = round1(clamp(fin(r.carbsG), 0, 600));
  const fatG = round1(clamp(fin(r.fatG), 0, 300));
  let kcal = Math.round(clamp(fin(r.kcal), 0, 3000));
  const fromMacros = 4 * proteinG + 4 * carbsG + 9 * fatG;
  if (fromMacros > 0 && (kcal === 0 || Math.abs(fromMacros - kcal) > 0.25 * Math.max(kcal, fromMacros)))
    kcal = Math.round(clamp(fromMacros, 0, 3000));
  const confidence = Math.round(clamp(fin(r.confidence, 0.5), 0, 1) * 100) / 100;
  const family = typeof r.family === "string" && (BIAS_FAMILIES as readonly string[]).includes(r.family) ? r.family : biasKey(name);
  return { name, grams, kcal, proteinG, carbsG, fatG, confidence, family };
}

/** An item at another weight (its macros scaled). Pure. */
export function scaleItem(item: MealItem, grams: number): MealItem {
  const g = Math.round(clamp(grams, 1, 2000));
  const f = item.grams > 0 ? g / item.grams : 1;
  return {
    ...item,
    grams: g,
    kcal: Math.round(clamp(item.kcal * f, 0, 3000)),
    proteinG: round1(item.proteinG * f),
    carbsG: round1(item.carbsG * f),
    fatG: round1(item.fatG * f),
  };
}

/** The items' totals. Pure. */
export function totalsOf(items: readonly Pick<MealItem, "kcal" | "proteinG" | "carbsG" | "fatG">[]): MacroTotals {
  const t = items.reduce(
    (a, i) => ({ kcal: a.kcal + i.kcal, proteinG: a.proteinG + i.proteinG, carbsG: a.carbsG + i.carbsG, fatG: a.fatG + i.fatG }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return { kcal: Math.round(t.kcal), proteinG: round1(t.proteinG), carbsG: round1(t.carbsG), fatG: round1(t.fatG) };
}

/** An estimate from cleaned items: totals, an item-weighted confidence, the profile's hits. Pure. */
export function estimateOf(
  items: readonly MealItem[],
  source: MealSource,
  p: ConstraintProfile | null,
  extra: { portionHint?: string; notes?: string[] } = {},
): MealEstimate {
  const totals = totalsOf(items);
  const w = items.reduce((a, i) => a + Math.max(1, i.kcal), 0);
  const confidence = items.length ? Math.round((items.reduce((a, i) => a + i.confidence * Math.max(1, i.kcal), 0) / w) * 100) / 100 : 0;
  const hits = p
    ? ingredientHits(
        items.map((i) => i.name),
        p,
      )
    : [];
  return {
    items: [...items],
    totals,
    confidence,
    ...(extra.portionHint ? { portionHint: extra.portionHint } : {}),
    ...(extra.notes?.length ? { notes: extra.notes } : {}),
    hits,
    source,
  };
}

/** A meal idea as the API sends it (suggest / plan / swap). */
export interface MealIdea {
  id: string;
  name: string;
  ingredients: { name: string; qty: string }[];
  steps: string[];
  cookMin: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  allergens: string[];
  tags: string[];
  why: string;
  meal?: MealKind;
}

// ── Watch summary ───────────────────────────────────────────────────────────────────────────────────────────

/** Phone → watch Companion context key 'nutrition' (absent when nutrition is off). The watch only renders it. */
export interface NutritionWatchSummary {
  on: true;
  hideNumbers: boolean;
  statusKey: string;
  energyPct?: number;
  proteinPct?: number;
  kcal?: number;
  kcalTarget?: number;
  proteinG?: number;
  proteinTarget?: number;
  waterMl?: number;
  lastMeal?: { name: string; at: number };
  tipKey?: string;
  /** "Groceries: Sat 10:00" when a shop slot is confirmed (ms). */
  groceryAt?: number;
}

/** The watch summary from the day's numbers: no number at all when hidden. Pure. */
export function nutritionWatchSummary(input: {
  hideNumbers: boolean;
  totals: MacroTotals;
  targets: Pick<NutritionTargets, "kcal" | "proteinG" | "carbTiming">;
  waterMl?: number;
  lastMeal?: { name: string; at: number };
  tipKey?: string;
  groceryAt?: number;
}): NutritionWatchSummary {
  const s = nutritionDayStatus(input.totals, input.targets, input.hideNumbers);
  const base: NutritionWatchSummary = {
    on: true,
    hideNumbers: input.hideNumbers,
    statusKey: s.lineKey,
    ...(input.lastMeal ? { lastMeal: input.lastMeal } : {}),
    ...(input.tipKey ? { tipKey: input.tipKey } : {}),
    ...(input.groceryAt ? { groceryAt: input.groceryAt } : {}),
  };
  if (input.hideNumbers) return base;
  const pct = (v: number, r: Range | null) => (r ? Math.min(150, Math.round((v / ((r.min + r.max) / 2)) * 100)) : undefined);
  const kcalTarget = input.targets.kcal ? Math.round((input.targets.kcal.min + input.targets.kcal.max) / 2) : undefined;
  const proteinTarget = input.targets.proteinG ? Math.round((input.targets.proteinG.min + input.targets.proteinG.max) / 2) : undefined;
  const e = pct(input.totals.kcal, input.targets.kcal);
  const p = pct(input.totals.proteinG, input.targets.proteinG);
  return {
    ...base,
    ...(e !== undefined ? { energyPct: e } : {}),
    ...(p !== undefined ? { proteinPct: p } : {}),
    kcal: Math.round(input.totals.kcal),
    ...(kcalTarget ? { kcalTarget } : {}),
    proteinG: Math.round(input.totals.proteinG),
    ...(proteinTarget ? { proteinTarget } : {}),
    ...(input.waterMl !== undefined ? { waterMl: Math.round(input.waterMl) } : {}),
  };
}

// ── Coach memory → constraint proposals ─────────────────────────────────────────────────────────────────────

/**
 * A food constraint the athlete just said ("I'm allergic to peanuts", « je ne supporte pas la coriandre », "I'm
 * vegan now"): the update_nutrition proposal the coach offers (memory alone never changes constraints). null: none. Pure.
 */
export function foodConstraintFromText(
  text: string,
): { allergies?: string[]; intolerances?: string[]; dislikes?: string[]; diet?: DietStyle } | null {
  const t = foldFood(text);
  const grab = (re: RegExp): string | null => {
    const m = t.match(re);
    if (!m?.[1]) return null;
    const w = m[1]
      .split(/\b(and|but|so|because|et|mais|donc|car|parce)\b/)[0]!
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");
    return w.length >= 2 ? w : null;
  };
  const allergy =
    grab(/\b(?:i m|i am|im)? ?allergic to (?:the |a |an )?([a-z ]+)/) ??
    grab(/\b(?:je suis )?allergique (?:aux|au|a la|a l|a) ?([a-z ]+)/) ??
    grab(/\ballergy to ([a-z ]+)/) ??
    grab(/\ballergie (?:aux|au|a) ([a-z ]+)/);
  if (allergy) return { allergies: cleanTerms([allergy.replace(/^(la|le|les|l) /, "")]) };
  const intol =
    grab(/\b(?:i m|i am|im) ([a-z]+) intolerant\b/) ?? grab(/\bintolerant to ([a-z ]+)/) ?? grab(/\bintolerante? (?:aux|au|a) ([a-z ]+)/);
  if (intol) return { intolerances: cleanTerms([intol.replace(/^(la|le|les|l) /, "")]) };
  const diet = DIET_STYLES.find(
    (d) =>
      d !== "omnivore" &&
      (new RegExp(`\\b(i m|i am|im|now|je suis|je mange) ${d}\\b`).test(t) ||
        new RegExp(
          `\\b(je suis|je mange) ${{ vegetarian: "vegetarien", vegan: "vegan", pescatarian: "pescetarien", flexitarian: "flexitarien", halal: "halal", kosher: "casher" }[d as "vegan"] ?? d}`,
        ).test(t)),
  );
  if (diet) return { diet };
  const dislike =
    grab(/\b(?:i hate|i can t stand|i don t like|i dont like|i dislike|no more) ([a-z ]+)/) ??
    grab(/\b(?:je deteste|je ne supporte pas|je n aime pas|j aime pas|pas de) (?:la |le |les |l )?([a-z ]+)/);
  if (
    dislike &&
    dislike.length <= NUTRITION_TERM_MAX &&
    !/\b(run|running|course|training|workout|seance|courir|interval|it|that|this|ca|cela)\b/.test(dislike)
  )
    return { dislikes: cleanTerms([dislike.replace(/^(la|le|les|l) /, "")]) };
  return null;
}

/** A proposal applied to a profile (the athlete confirmed the card): lists merged, `at` bumped. Pure. */
export function applyNutritionUpdate(
  p: NutritionProfile,
  u: { allergies?: string[]; intolerances?: string[]; dislikes?: string[]; diet?: DietStyle; goal?: NutritionGoal },
  at: number,
): NutritionProfile {
  return cleanNutritionProfile({
    ...p,
    allergies: [...p.allergies, ...(u.allergies ?? [])],
    intolerances: [...p.intolerances, ...(u.intolerances ?? [])],
    dislikes: [...p.dislikes, ...(u.dislikes ?? [])],
    ...(u.diet ? { diet: u.diet } : {}),
    ...(u.goal ? { goal: u.goal } : {}),
    at,
  });
}

// ── Words (EN + FR; the apps copy these into their catalogs) ────────────────────────────────────────────────

export const ALLERGEN_NAMES: Readonly<Record<Allergen, { en: string; fr: string }>> = {
  gluten: { en: "gluten", fr: "gluten" },
  crustaceans: { en: "crustaceans", fr: "crustacés" },
  eggs: { en: "eggs", fr: "œufs" },
  fish: { en: "fish", fr: "poisson" },
  peanuts: { en: "peanuts", fr: "arachides" },
  soy: { en: "soy", fr: "soja" },
  milk: { en: "milk", fr: "lait" },
  tree_nuts: { en: "tree nuts", fr: "fruits à coque" },
  celery: { en: "celery", fr: "céleri" },
  mustard: { en: "mustard", fr: "moutarde" },
  sesame: { en: "sesame", fr: "sésame" },
  sulphites: { en: "sulphites", fr: "sulfites" },
  lupin: { en: "lupin", fr: "lupin" },
  molluscs: { en: "molluscs", fr: "mollusques" },
};
export const INTOLERANCE_NAMES: Readonly<Record<Intolerance, { en: string; fr: string }>> = {
  lactose: { en: "lactose", fr: "lactose" },
  gluten_sensitivity: { en: "gluten (sensitivity)", fr: "gluten (sensibilité)" },
  fructose: { en: "fructose", fr: "fructose" },
  fodmap: { en: "FODMAPs", fr: "FODMAP" },
  histamine: { en: "histamine", fr: "histamine" },
  caffeine: { en: "caffeine", fr: "caféine" },
  alcohol: { en: "alcohol", fr: "alcool" },
};
export const DIET_NAMES: Readonly<Record<DietStyle, { en: string; fr: string }>> = {
  omnivore: { en: "Everything", fr: "De tout" },
  flexitarian: { en: "Flexitarian", fr: "Flexitarien" },
  pescatarian: { en: "Pescatarian", fr: "Pescétarien" },
  vegetarian: { en: "Vegetarian", fr: "Végétarien" },
  vegan: { en: "Vegan", fr: "Végétalien (vegan)" },
  halal: { en: "Halal", fr: "Halal" },
  kosher: { en: "Kosher", fr: "Casher" },
};
export const NUTRITION_GOAL_NAMES: Readonly<Record<NutritionGoal, { en: string; fr: string }>> = {
  muscle: { en: "Build muscle", fr: "Prendre du muscle" },
  lean: { en: "Get leaner, gently", fr: "M’affiner, en douceur" },
  performance: { en: "Fuel my training", fr: "Bien alimenter mon entraînement" },
  health: { en: "Eat well, feel good", fr: "Bien manger, me sentir bien" },
};

/** Status lines, notes and fallbacks (no number, no judgement). */
export const NUTRITION_TEXT: Readonly<Record<string, { en: string; fr: string }>> = {
  "nutrition.title": { en: "Nutrition", fr: "Nutrition" },
  "nutrition.status.none": { en: "Nothing logged yet today", fr: "Rien de noté aujourd’hui pour l’instant" },
  "nutrition.status.logged": { en: "Meals logged today", fr: "Repas notés aujourd’hui" },
  "nutrition.status.on_track": { en: "Nicely fuelled today", fr: "Bien alimenté aujourd’hui" },
  "nutrition.status.fuelled_long": { en: "Good fuel for a long session", fr: "Du bon carburant pour une longue séance" },
  "nutrition.status.fuel_up": { en: "A bit more fuel would help your training", fr: "Un peu plus d’énergie aiderait ton entraînement" },
  "nutrition.status.protein_light": { en: "Protein a bit light today", fr: "Un peu peu de protéines aujourd’hui" },
  "nutrition.status.energy_light": { en: "A little light on energy today", fr: "Un peu léger en énergie aujourd’hui" },
  "nutrition.status.plenty": { en: "Plenty of fuel today", fr: "Bien rechargé aujourd’hui" },
  "nutrition.tip.recovery": {
    en: "Recovery: some carbs and protein within the hour helps",
    fr: "Récup : des glucides et des protéines dans l’heure, ça aide",
  },
  "nutrition.tip.fuel_during": { en: "Long session: bring carbs for the way", fr: "Longue séance : prends des glucides pour la route" },
  "nutrition.tip.water": { en: "Keep water close today", fr: "Garde de l’eau à portée aujourd’hui" },
  "nutrition.estimate": { en: "Estimate", fr: "Estimation" },
  "nutrition.hint.plate": {
    en: "Put a fork or your hand next to the plate for a better portion guess",
    fr: "Pose une fourchette ou ta main à côté de l’assiette pour mieux estimer la portion",
  },
  "nutrition.fallback.photo": {
    en: "Couldn’t read the photo now – add it by hand",
    fr: "Impossible de lire la photo pour l’instant – ajoute-le à la main",
  },
  "nutrition.fallback.limit": {
    en: "You’ve used this week’s photo estimates – add it by hand",
    fr: "Tu as utilisé les estimations photo de la semaine – ajoute-le à la main",
  },
  "nutrition.fallback.ideas": { en: "Here are a few of our own ideas", fr: "Voici quelques idées de chez nous" },
  "nutrition.hideNumbers": { en: "Hide numbers", fr: "Masquer les chiffres" },
  "nutrition.referral": {
    en: "If food feels stressful lately, a doctor or a registered dietitian can really help. I’ll keep numbers out of our chats.",
    fr: "Si l’alimentation te pèse en ce moment, un médecin ou un·e diététicien·ne peut vraiment t’aider. Je laisse les chiffres de côté dans nos échanges.",
  },
  "nutrition.medical": {
    en: "For that, talk to a doctor or a registered dietitian: they can tailor it to you.",
    fr: "Pour ça, parle à un médecin ou à un·e diététicien·ne : ils pourront l’adapter à toi.",
  },
  "nutrition.adult.ask": { en: "Are you 18 or older?", fr: "As-tu 18 ans ou plus ?" },
  "nutrition.photoAsk": {
    en: "Snap your next meal? It helps your coach tune your fuel.",
    fr: "Une photo de ton prochain repas ? Ça aide ton coach à ajuster ton énergie.",
  },
  "nutrition.grocery.title": { en: "Grocery list", fr: "Liste de courses" },
  "nutrition.grocery.flyer": { en: "Check this week’s flyer", fr: "Voir le prospectus de la semaine" },
};

export const nutritionText = (key: string, lang: Lang): string => NUTRITION_TEXT[key]?.[lang] ?? key;

// ── Photo asks and the recovery tip (Quiet + notification budget) ───────────────────────────────────────────

/** The coach asks for a meal photo at most this many times a week. */
export const MEAL_PHOTO_ASK_WEEKLY_MAX = 2;

/**
 * May the coach ask for a meal photo now? Only with Nutrition on and the athlete's "coach photo asks" switch, never in
 * a workout, never at the Quiet suggestion level unless they allowed it there, ≤ 2 a week, and through the Tailor
 * notification gate (budget, quiet hours, the kind switched off). Pure.
 */
export function mealPhotoAskAllowed(
  np: Pick<NutritionProfile, "on" | "askPhotos" | "askPhotosInQuiet"> | null | undefined,
  s: {
    tailor: TailorProfile | null | undefined;
    suggestLevel: SuggestLevel;
    inWorkout: boolean;
    sentThisWeek: number;
    sentToday: number;
    localMinute?: number;
    notifyOff?: readonly string[] | null;
  },
): TailorNotifyDecision {
  if (!nutritionOn(np, s.tailor?.features ?? null) || !np?.askPhotos) return "drop";
  if (s.inWorkout) return "drop";
  if (s.suggestLevel === "quiet" && !np.askPhotosInQuiet) return "drop";
  if (s.sentThisWeek >= MEAL_PHOTO_ASK_WEEKLY_MAX) return "drop";
  if (notifyKindOff(s.notifyOff, "meal_photo_ask")) return "drop";
  if (!s.tailor)
    return s.localMinute !== undefined && tailorQuiet(s.localMinute) ? "drop" : s.sentToday < TAILOR_NOTIFY_BUDGET.few ? "send" : "drop";
  return notificationAllowed(s.tailor, "meal_photo_ask", s.sentToday, s.localMinute !== undefined ? { localMinute: s.localMinute } : {});
}

/**
 * The recovery-meal tip after a session: Nutrition on, a hard or long session, and the suggestion level allows it
 * (never during a workout). Pure.
 */
export function recoveryTipAllowed(
  np: Pick<NutritionProfile, "on"> | null | undefined,
  s: { tailor?: TailorProfile | null; load: DayLoad; suggestLevel: SuggestLevel; inWorkout: boolean },
): boolean {
  if (!nutritionOn(np, s.tailor?.features ?? null)) return false;
  if (s.load !== "hard" && s.load !== "long") return false;
  return suggestAllowed("recovery_meal", s.suggestLevel, { inWorkout: s.inWorkout });
}
