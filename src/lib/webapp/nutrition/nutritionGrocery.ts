// Copied from VVFit packages/game-core/src/nutritionGrocery.ts (bcd38837 2026-10-30) by scripts/sync-nutrition-core.ts. Do not edit: re-sync.
/**
 * The weekly grocery list (founder addition 2026-10-30, ADR-0070 §Grocery): from the week's meal plan, quantities merged
 * and scaled to the household, grouped by store aisle, pantry items pre-ticked, and every item that hits the athlete's
 * allergies / intolerances / diet / dislikes DROPPED (second net: the meals were already filtered). A proposed shopping
 * slot (`bestShopSlot`, always confirmed by the athlete), money-saving tips by COARSE region (country + region code,
 * never coordinates) and plain links to the chains' own public weekly flyers (no scraping, no API, no affiliate or
 * tracking parameters; affiliate links would need the founder's OK). Pure.
 */
import { containsTerm, foodWords, ingredientHits, type MealIdea, type NutritionProfile, type NutritionRegion } from "./nutrition";
import { AISLES, FOOD_TABLE, type Aisle } from "./nutritionFoods";

type Lang = "en" | "fr";

export { AISLES, type Aisle };

export const AISLE_NAMES: Readonly<Record<Aisle, { en: string; fr: string }>> = {
  produce: { en: "Fruit & vegetables", fr: "Fruits et légumes" },
  bakery: { en: "Bakery", fr: "Boulangerie" },
  meat_fish: { en: "Meat & fish", fr: "Boucherie et poissonnerie" },
  dairy_eggs: { en: "Dairy, eggs & chilled", fr: "Crèmerie, œufs et frais" },
  pantry: { en: "Pantry", fr: "Épicerie" },
  frozen: { en: "Frozen", fr: "Surgelés" },
  spices_sauces: { en: "Spices & sauces", fr: "Épices et sauces" },
  drinks: { en: "Drinks", fr: "Boissons" },
  other: { en: "Other", fr: "Autres" },
};

/** Keywords → aisle for ingredients that aren't in the food table (EN + FR, folded). */
const AISLE_WORDS: ReadonlyArray<readonly [Aisle, readonly string[]]> = [
  [
    "spices_sauces",
    [
      "spice",
      "pepper",
      "salt",
      "cumin",
      "paprika",
      "curry",
      "turmeric",
      "cinnamon",
      "ras el hanout",
      "oregano",
      "thyme",
      "herbes de provence",
      "sauce",
      "vinegar",
      "mustard",
      "stock cube",
      "epice",
      "poivre",
      "sel",
      "curcuma",
      "cannelle",
      "origan",
      "thym",
      "vinaigre",
      "moutarde",
      "bouillon",
      "ginger",
      "gingembre",
    ],
  ],
  [
    "produce",
    [
      "lemon",
      "lime",
      "herb",
      "basil",
      "parsley",
      "chive",
      "coriander",
      "mint",
      "citron",
      "basilic",
      "persil",
      "ciboulette",
      "coriandre",
      "menthe",
      "salad",
      "salade",
      "fruit",
      "legume",
      "vegetable",
    ],
  ],
  ["meat_fish", ["chicken", "beef", "pork", "fish", "salmon", "poulet", "boeuf", "porc", "poisson", "saumon", "meat", "viande"]],
  ["dairy_eggs", ["milk", "cheese", "yogurt", "egg", "butter", "cream", "tofu", "lait", "fromage", "yaourt", "oeuf", "beurre", "creme"]],
  ["bakery", ["bread", "pain", "baguette", "wrap", "tortilla", "pita"]],
  ["frozen", ["frozen", "surgele"]],
  ["drinks", ["juice", "jus", "water", "eau", "soda"]],
  [
    "pantry",
    [
      "rice",
      "pasta",
      "flour",
      "oat",
      "lentil",
      "bean",
      "can",
      "oil",
      "sugar",
      "honey",
      "riz",
      "pate",
      "farine",
      "avoine",
      "lentille",
      "haricot",
      "conserve",
      "huile",
      "sucre",
      "miel",
      "quinoa",
      "couscous",
      "semoule",
    ],
  ],
];

/** The aisle of an ingredient: the food table's when its name matches (EN or FR), else by keyword, else other. Pure. */
export function aisleOf(name: string): Aisle {
  const w = foodWords(name).join(" ");
  for (const f of FOOD_TABLE) {
    const en = foodWords(f.en.split(",")[0]!).join(" ");
    const fr = foodWords(f.fr.split(",")[0]!).join(" ");
    if (w === en || w === fr) return f.aisle;
  }
  for (const [aisle, words] of AISLE_WORDS) if (words.some((k) => containsTerm(name, k))) return aisle;
  for (const f of FOOD_TABLE) {
    const en = foodWords(f.en.split(",")[0]!).join(" ");
    const fr = foodWords(f.fr.split(",")[0]!).join(" ");
    if ((en && containsTerm(name, en)) || (fr && containsTerm(name, fr))) return f.aisle;
  }
  return "other";
}

export type GroceryUnit = "g" | "kg" | "ml" | "l" | "pc" | "";
export interface GroceryItem {
  name: string;
  /** 0 when only words are known (`note`, e.g. "a pinch"). */
  qty: number;
  unit: GroceryUnit;
  /** Words that don't add up ("a pinch", "1 tsp"), joined. */
  note?: string;
  /** In the pantry list ("I already have it"): pre-ticked. */
  have: boolean;
  /** The meals it comes from (names). */
  fromMeals: string[];
}
export interface GroceryList {
  aisles: { aisle: Aisle; items: GroceryItem[] }[];
  /** Items dropped by the allergy / diet / dislike net (should be none: the meals were filtered first). */
  dropped: number;
}

type PlanLike =
  { days: readonly { meals: readonly Pick<MealIdea, "name" | "ingredients">[] }[] } | readonly Pick<MealIdea, "name" | "ingredients">[];

const NUM = /^\s*(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(g|gr|grams?|kg|ml|cl|l|liters?|litres?|pc|pcs|pieces?|x)?\s*$/i;
const num = (s: string) => (s.includes("/") ? Number(s.split("/")[0]) / Number(s.split("/")[1]) : Number(s.replace(",", ".")));

/** A quantity text as an amount in base units (g, ml, pieces) or words. Pure. */
export function parseQty(q: string | undefined): { n: number; base: "g" | "ml" | "pc" } | { text: string } | null {
  if (!q || !q.trim()) return null;
  const m = q.match(NUM);
  if (!m) return { text: q.trim() };
  const n = num(m[1]!);
  if (!Number.isFinite(n) || n <= 0) return { text: q.trim() };
  const u = (m[2] ?? "pc").toLowerCase();
  if (u.startsWith("g")) return { n, base: "g" };
  if (u === "kg") return { n: n * 1000, base: "g" };
  if (u === "ml") return { n, base: "ml" };
  if (u === "cl") return { n: n * 10, base: "ml" };
  if (u === "l" || u.startsWith("lit")) return { n: n * 1000, base: "ml" };
  return { n, base: "pc" };
}

const inPantry = (name: string, pantry: readonly string[]) => pantry.some((p) => containsTerm(name, p) || containsTerm(p, name));

/**
 * The grocery list of a plan (or a list of meals). Quantities are per serving in the plan; `servings` (1–8, the
 * household) scales them. Pure.
 */
export function buildGroceryList(
  plan: PlanLike,
  opts: {
    servings?: number;
    pantry?: readonly string[];
    profile?: Pick<NutritionProfile, "allergies" | "intolerances" | "dislikes" | "diet"> | null;
  },
): GroceryList {
  const servings = Math.min(8, Math.max(1, Math.round(opts.servings ?? 1)));
  const meals = Array.isArray(plan)
    ? (plan as readonly Pick<MealIdea, "name" | "ingredients">[])
    : (plan as { days: readonly { meals: readonly Pick<MealIdea, "name" | "ingredients">[] }[] }).days.flatMap((d) => d.meals);
  const by = new Map<string, { name: string; g: number; ml: number; pc: number; notes: string[]; from: Set<string> }>();
  let dropped = 0;
  const droppedKeys = new Set<string>();
  for (const m of meals)
    for (const i of m.ingredients) {
      const key = foodWords(i.name).join(" ");
      if (!key) continue;
      if (opts.profile && ingredientHits([i.name], opts.profile).length) {
        if (!droppedKeys.has(key)) {
          droppedKeys.add(key);
          dropped++;
        }
        continue;
      }
      const cur = by.get(key) ?? { name: i.name, g: 0, ml: 0, pc: 0, notes: [], from: new Set<string>() };
      const q = parseQty(i.qty);
      if (q && "n" in q) cur[q.base] += q.n * servings;
      else if (q && !cur.notes.includes(q.text)) cur.notes.push(q.text);
      cur.from.add(m.name);
      by.set(key, cur);
    }
  const pantry = opts.pantry ?? [];
  const groups = new Map<Aisle, GroceryItem[]>();
  for (const v of by.values()) {
    let qty = 0;
    let unit: GroceryUnit = "";
    const extra: string[] = [];
    if (v.g) {
      qty = v.g >= 1000 ? Math.round(v.g / 100) / 10 : Math.round(v.g / 5) * 5 || Math.round(v.g);
      unit = v.g >= 1000 ? "kg" : "g";
    }
    if (v.ml) {
      const t = v.ml >= 1000 ? { q: Math.round(v.ml / 100) / 10, u: "l" as const } : { q: Math.round(v.ml / 10) * 10, u: "ml" as const };
      if (unit) extra.push(`${t.q} ${t.u}`);
      else {
        qty = t.q;
        unit = t.u;
      }
    }
    if (v.pc) {
      const q = Math.ceil(v.pc * 2) / 2;
      if (unit) extra.push(`${q}`);
      else {
        qty = q;
        unit = "pc";
      }
    }
    const note = [...extra, ...v.notes].join(" + ");
    const item: GroceryItem = {
      name: v.name,
      qty,
      unit,
      ...(note ? { note } : {}),
      have: inPantry(v.name, pantry),
      fromMeals: [...v.from],
    };
    const aisle = aisleOf(v.name);
    groups.set(aisle, [...(groups.get(aisle) ?? []), item]);
  }
  const aisles = AISLES.filter((a) => groups.has(a)).map((aisle) => ({
    aisle,
    items: groups.get(aisle)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));
  return { aisles, dropped };
}

/** "1.2 kg", "3 pieces · a pinch" (EN) / « 1,2 kg » (FR). Pure. */
export function groceryQtyText(i: Pick<GroceryItem, "qty" | "unit" | "note">, lang: Lang): string {
  const n = lang === "fr" ? String(i.qty).replace(".", ",") : String(i.qty);
  const main = !i.qty ? "" : i.unit === "pc" ? n : `${n} ${i.unit}`;
  return [main, i.note ?? ""].filter(Boolean).join(" + ");
}

/** The flat list as text for share / copy ("Fruit & vegetables\n- banana: 3\n…"); ticked items left out. Pure. */
export function groceryText(list: GroceryList, lang: Lang): string {
  const out: string[] = [];
  for (const a of list.aisles) {
    const items = a.items.filter((i) => !i.have);
    if (!items.length) continue;
    out.push(AISLE_NAMES[a.aisle][lang]);
    for (const i of items) {
      const q = groceryQtyText(i, lang);
      out.push(`- ${i.name}${q ? `: ${q}` : ""}`);
    }
    out.push("");
  }
  return out.join("\n").trim();
}

// ── The shopping slot ───────────────────────────────────────────────────────────────────────────────────────

export interface ShopSlotInput {
  /** Calendar free/busy (ms) when the calendar is linked. */
  busy?: readonly { start: number; end: number }[];
  /** When the athlete usually opens the app (local day of week 0 = Sunday, hour 0–23). */
  appOpens?: readonly { dow: number; hour: number }[];
  /** Shops they confirmed before (local dow + hour): the strongest signal. */
  pastShops?: readonly { dow: number; hour: number }[];
  /** Quiet hours, minutes from local midnight [start, end) (default 21:30–07:00). */
  quiet?: { start: number; end: number };
  now: number;
  /** Local time = UTC + this many minutes (default 0). */
  tzOffsetMin?: number;
}
export interface ShopSlot {
  start: number;
  durationMin: 45;
  reason: "calendar" | "habit" | "weekend_default";
}

const inQuiet = (m: number, q: { start: number; end: number }) => {
  const x = ((m % 1440) + 1440) % 1440;
  return q.start > q.end ? x >= q.start || x < q.end : x >= q.start && x < q.end;
};

/**
 * The proposed shopping slot in the next 7 days: a weekly window they already used (past confirmed shops), else the
 * hours they tend to have the app open, else Saturday 10:00 / a weekday 18:00; never inside Quiet hours or a busy
 * calendar block, at least an hour from now. Always a PROPOSAL: the athlete confirms or changes it. Pure.
 */
export function bestShopSlot(input: ShopSlotInput): ShopSlot {
  const tz = (input.tzOffsetMin ?? 0) * 60_000;
  const quiet = input.quiet ?? { start: 21 * 60 + 30, end: 7 * 60 };
  const localNow = input.now + tz;
  const dayStart = Math.floor(localNow / 86_400_000) * 86_400_000;
  const DUR = 45 * 60_000;
  const count = (list: readonly { dow: number; hour: number }[] | undefined, dow: number, hour: number) =>
    (list ?? []).filter((x) => x.dow === dow && x.hour === hour).length;
  let best: { start: number; score: number; habit: boolean } | null = null;
  for (let d = 0; d < 8; d++)
    for (let h = 7; h <= 21; h++) {
      const localStart = dayStart + d * 86_400_000 + h * 3_600_000;
      const start = localStart - tz;
      if (start < input.now + 3_600_000 || start > input.now + 7 * 86_400_000) continue;
      if (inQuiet(h * 60, quiet) || inQuiet(h * 60 + 44, quiet)) continue;
      if ((input.busy ?? []).some((b) => b.start < start + DUR && b.end > start)) continue;
      const dow = new Date(localStart).getUTCDay();
      const past = count(input.pastShops, dow, h);
      const app = count(input.appOpens, dow, h) * 2 + count(input.appOpens, dow, h - 1) + count(input.appOpens, dow, h + 1);
      const weekend = dow === 0 || dow === 6;
      const dflt =
        (dow === 6 && h === 10 ? 30 : 0) +
        (weekend && h >= 9 && h <= 12 ? 10 : 0) +
        (!weekend && h === 18 ? 20 : 0) +
        (!weekend && h >= 17 && h <= 19 ? 5 : 0);
      const score = past * 100 + Math.min(app, 30) * 3 + dflt - d;
      if (!best || score > best.score) best = { start, score, habit: past > 0 || app >= 3 };
    }
  if (!best) return { start: input.now + 86_400_000, durationMin: 45, reason: "weekend_default" };
  return { start: best.start, durationMin: 45, reason: best.habit ? "habit" : input.busy ? "calendar" : "weekend_default" };
}

// ── Saving tips ─────────────────────────────────────────────────────────────────────────────────────────────

const P = (en: string, fr: string) => ({ en, fr });
const PRODUCE = {
  leek: P("leeks", "poireaux"),
  cabbage: P("cabbage", "chou"),
  carrot: P("carrots", "carottes"),
  celeriac: P("celeriac", "céleri-rave"),
  pumpkin: P("pumpkin", "potiron"),
  squash: P("squash", "courges"),
  apple: P("apples", "pommes"),
  pear: P("pears", "poires"),
  clementine: P("clementines", "clémentines"),
  orange: P("oranges", "oranges"),
  kiwi: P("kiwis", "kiwis"),
  spinach: P("spinach", "épinards"),
  radish: P("radishes", "radis"),
  asparagus: P("asparagus", "asperges"),
  strawberry: P("strawberries", "fraises"),
  peas: P("peas", "petits pois"),
  lettuce: P("lettuce", "salade"),
  cherry: P("cherries", "cerises"),
  zucchini: P("zucchini", "courgettes"),
  cucumber: P("cucumber", "concombre"),
  tomato: P("tomatoes", "tomates"),
  eggplant: P("eggplant", "aubergines"),
  pepper: P("bell peppers", "poivrons"),
  peach: P("peaches", "pêches"),
  melon: P("melon", "melon"),
  raspberry: P("raspberries", "framboises"),
  apricot: P("apricots", "abricots"),
  plum: P("plums", "prunes"),
  blueberry: P("blueberries", "myrtilles"),
  grape: P("grapes", "raisin"),
  mushroom: P("mushrooms", "champignons"),
  potato: P("potatoes", "pommes de terre"),
  onion: P("onions", "oignons"),
  sweetPotato: P("sweet potatoes", "patates douces"),
  rhubarb: P("rhubarb", "rhubarbe"),
  corn: P("sweet corn", "maïs"),
  cranberry: P("cranberries", "canneberges"),
  beet: P("beets", "betteraves"),
} as const;
type ProduceKey = keyof typeof PRODUCE;

/** What's in season by month, Europe (France) and North America (Canada / northern US), a small built-in table. */
export const SEASONAL: Readonly<Record<"eu" | "na", Readonly<Record<number, readonly ProduceKey[]>>>> = {
  eu: {
    1: ["leek", "cabbage", "carrot", "celeriac", "squash", "apple", "pear", "clementine", "orange", "kiwi"],
    2: ["leek", "cabbage", "carrot", "celeriac", "apple", "pear", "orange", "kiwi"],
    3: ["leek", "cabbage", "carrot", "spinach", "radish", "apple", "kiwi"],
    4: ["asparagus", "radish", "spinach", "carrot", "lettuce"],
    5: ["asparagus", "radish", "strawberry", "spinach", "peas", "lettuce"],
    6: ["strawberry", "cherry", "zucchini", "peas", "lettuce", "cucumber", "tomato"],
    7: ["tomato", "zucchini", "eggplant", "pepper", "cucumber", "peach", "melon", "raspberry", "apricot"],
    8: ["tomato", "zucchini", "eggplant", "pepper", "peach", "melon", "plum", "blueberry"],
    9: ["tomato", "pepper", "zucchini", "grape", "apple", "pear", "plum", "pumpkin"],
    10: ["pumpkin", "squash", "mushroom", "apple", "pear", "grape", "leek", "cabbage"],
    11: ["pumpkin", "squash", "leek", "cabbage", "carrot", "apple", "pear", "clementine", "kiwi"],
    12: ["leek", "cabbage", "carrot", "celeriac", "squash", "apple", "pear", "clementine", "orange"],
  },
  na: {
    1: ["cabbage", "carrot", "potato", "onion", "apple", "orange", "sweetPotato"],
    2: ["cabbage", "carrot", "potato", "onion", "apple", "orange"],
    3: ["cabbage", "carrot", "potato", "apple", "orange", "spinach"],
    4: ["asparagus", "spinach", "radish", "rhubarb"],
    5: ["asparagus", "rhubarb", "spinach", "radish", "lettuce"],
    6: ["strawberry", "lettuce", "peas", "spinach", "zucchini"],
    7: ["blueberry", "raspberry", "corn", "zucchini", "cucumber", "tomato", "cherry"],
    8: ["corn", "tomato", "peach", "blueberry", "pepper", "zucchini", "melon"],
    9: ["apple", "corn", "tomato", "squash", "pear", "grape", "beet"],
    10: ["apple", "pumpkin", "squash", "sweetPotato", "cabbage", "carrot", "beet"],
    11: ["squash", "sweetPotato", "cabbage", "carrot", "apple", "cranberry"],
    12: ["squash", "cabbage", "carrot", "potato", "apple", "orange"],
  },
};

const EU = ["FR", "BE", "CH", "LU", "MC", "DE", "NL", "AT", "IT", "ES", "PT", "GB", "IE", "DK", "SE", "NO", "FI", "PL", "CZ"];
const NA = ["CA", "US"];
export const seasonZoneOf = (r: NutritionRegion | null | undefined): "eu" | "na" | null =>
  !r ? null : EU.includes(r.country) ? "eu" : NA.includes(r.country) ? "na" : null;

export interface FlyerLink {
  chain: string;
  url: string;
  /** The French page when the chain has one (Quebec). */
  urlFr?: string;
}

/**
 * The chains' OWN public weekly-flyer pages, plain links only (no scraping, no API, no affiliate / tracking params).
 * Checked 2026-10-30; a chain whose page we weren't sure of is left out. Region '*' = everywhere in the country.
 */
export const GROCERY_FLYERS: Readonly<Record<string, Readonly<Record<string, readonly FlyerLink[]>>>> = {
  FR: {
    "*": [
      { chain: "E.Leclerc", url: "https://www.e.leclerc/catalogues" },
      { chain: "Aldi", url: "https://www.aldi.fr/catalogues.html" },
    ],
  },
  CA: {
    "*": [
      { chain: "Walmart", url: "https://www.walmart.ca/en/flyer" },
      { chain: "Costco", url: "https://www.costco.ca/online-offers.html" },
    ],
    QC: [
      { chain: "Metro", url: "https://www.metro.ca/en/flyer", urlFr: "https://www.metro.ca/circulaire" },
      { chain: "Super C", url: "https://www.superc.ca/en/flyer", urlFr: "https://www.superc.ca/circulaire" },
      { chain: "Maxi", url: "https://www.maxi.ca/fr/print-flyer" },
      { chain: "Provigo", url: "https://www.provigo.ca/fr/print-flyer" },
    ],
    ON: [
      { chain: "Metro", url: "https://www.metro.ca/en/flyer" },
      { chain: "Food Basics", url: "https://www.foodbasics.ca/flyer" },
      { chain: "Loblaws", url: "https://www.loblaws.ca/en/print-flyer" },
      { chain: "No Frills", url: "https://www.nofrills.ca/en/print-flyer" },
    ],
  },
  US: {
    "*": [
      { chain: "Target", url: "https://www.target.com/weekly-ad" },
      { chain: "Aldi", url: "https://www.aldi.us/weekly-specials/our-weekly-ads/" },
    ],
    TX: [{ chain: "H-E-B", url: "https://www.heb.com/weekly-ad" }],
    FL: [{ chain: "Publix", url: "https://www.publix.com/savings/weekly-ad" }],
    GA: [{ chain: "Publix", url: "https://www.publix.com/savings/weekly-ad" }],
    CA: [{ chain: "Safeway", url: "https://www.safeway.com/weeklyad" }],
    WA: [{ chain: "Safeway", url: "https://www.safeway.com/weeklyad" }],
    OR: [{ chain: "Safeway", url: "https://www.safeway.com/weeklyad" }],
    CO: [{ chain: "Safeway", url: "https://www.safeway.com/weeklyad" }],
    AZ: [{ chain: "Safeway", url: "https://www.safeway.com/weeklyad" }],
  },
};

/** The flyer links for a coarse region: the region's own chains first, then the country's. Pure. */
export function flyersFor(r: NutritionRegion | null | undefined): FlyerLink[] {
  if (!r) return [];
  const c = GROCERY_FLYERS[r.country];
  if (!c) return [];
  const out = [...(r.region ? (c[r.region] ?? []) : []), ...(c["*"] ?? [])];
  return out.filter((l, i) => out.findIndex((x) => x.chain === l.chain) === i);
}

export type TipKind = "seasonal" | "store_brand" | "bulk" | "freeze" | "batch" | "leftovers" | "flyer";
export interface SavingTip {
  kind: TipKind;
  text: string;
  links?: FlyerLink[];
}

const BULK = [
  "oat",
  "rice",
  "lentil",
  "pasta",
  "bean",
  "chickpea",
  "frozen",
  "quinoa",
  "couscous",
  "avoine",
  "riz",
  "lentille",
  "pate",
  "haricot",
  "pois chiche",
  "surgele",
  "semoule",
];

type PlanMeals = { days: readonly { meals: readonly Pick<MealIdea, "name" | "ingredients" | "tags">[] }[] } | null | undefined;

/**
 * Money-saving tips for the week: what's in season in the athlete's zone this month, store brands, bulk staples from
 * the plan, meals that freeze (cook twice, eat twice), a leftovers night and the region's flyer links. Pure.
 */
export function savingTips(region: NutritionRegion | null, month: number, lang: Lang, plan: PlanMeals): SavingTip[] {
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const tips: SavingTip[] = [];
  const zone = seasonZoneOf(region);
  const m = ((Math.round(month) - 1 + 12) % 12) + 1;
  if (zone) {
    const items = SEASONAL[zone][m]!.slice(0, 6).map((k) => PRODUCE[k][lang]);
    tips.push({
      kind: "seasonal",
      text: L(
        `In season now: ${items.join(", ")}. Usually cheaper and tastier.`,
        `De saison en ce moment : ${items.join(", ")}. Souvent moins cher et meilleur.`,
      ),
    });
  }
  tips.push({
    kind: "store_brand",
    text: L(
      "Store brands of oats, rice, pasta, canned beans and frozen vegetables are usually just as good for less.",
      "Les marques de distributeur pour l’avoine, le riz, les pâtes, les légumineuses en conserve et les légumes surgelés sont souvent aussi bonnes, pour moins cher.",
    ),
  });
  const meals = plan?.days.flatMap((d) => d.meals) ?? [];
  const staples = [
    ...new Set(meals.flatMap((x) => x.ingredients.map((i) => i.name)).filter((n) => BULK.some((b) => containsTerm(n, b)))),
  ].slice(0, 4);
  if (staples.length)
    tips.push({
      kind: "bulk",
      text: L(
        `Buy bigger bags of ${staples.join(", ")}: they keep and cost less per kilo.`,
        `Prends ${staples.join(", ")} en grand format : ça se garde et ça coûte moins cher au kilo.`,
      ),
    });
  const freezes = [...new Set(meals.filter((x) => x.tags?.includes("freezes")).map((x) => x.name))].slice(0, 3);
  if (freezes.length)
    tips.push({
      kind: "freeze",
      text: L(
        `Cook ${freezes.join(", ")} twice and freeze a portion for a busy day.`,
        `Cuisine ${freezes.join(", ")} en double et congèle une portion pour un jour chargé.`,
      ),
    });
  const counts = new Map<string, number>();
  for (const x of meals) counts.set(x.name, (counts.get(x.name) ?? 0) + 1);
  const twice = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([k]) => k)
    .slice(0, 2);
  if (twice.length)
    tips.push({
      kind: "batch",
      text: L(
        `Cook once, eat twice: ${twice.join(", ")} come back this week.`,
        `Cuisine une fois, mange deux fois : ${twice.join(", ")} reviennent cette semaine.`,
      ),
    });
  if (meals.length >= 7)
    tips.push({
      kind: "leftovers",
      text: L(
        "Keep one evening for leftovers: less waste, one less shop.",
        "Garde une soirée pour les restes : moins de gaspillage, une course en moins.",
      ),
    });
  const links = flyersFor(region);
  if (links.length) tips.push({ kind: "flyer", text: L("Check this week’s flyer", "Voir le prospectus de la semaine"), links });
  return tips;
}
