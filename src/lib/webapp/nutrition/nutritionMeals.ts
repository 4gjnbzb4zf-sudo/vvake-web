// Copied from VVFit packages/game-core/src/nutritionMeals.ts (bcd38837 2026-10-30) by scripts/sync-nutrition-core.ts. Do not edit: re-sync.
/**
 * Our own simple meals (ADR-0070): the safe fallback when the model is over its limit, down, or a generated meal was
 * dropped by the allergy filter; free users' week plans; the watch never needs them. Hand-written by VVake (no recipe
 * copied from anywhere), numbers from the local food table (USDA FoodData Central, public domain).
 *
 * Every template goes through the same hard filter as generated meals (`filterSafeMeals` on its EN and FR ingredient
 * names), so a vegan never gets the omelette and "no cinnamon" never gets the porridge with cinnamon.
 */
import type { MealKind } from "../coach/coachActions";
import { allergensIn, filterSafeMeals, foodWords, type MealBudget, type DayLoad, type MealIdea, type NutritionProfile } from "./nutrition";
import { foodById, type Aisle } from "./nutritionFoods";

type Lang = "en" | "fr";

export interface TemplateIngredient {
  /** A FOOD_TABLE id (numbers come from it), else words only. */
  food?: string;
  en: string;
  fr: string;
  /** Grams per serving (with a food id), else a quantity text. */
  g?: number;
  qty?: { en: string; fr: string };
  aisle: Aisle;
}

export interface MealTemplate {
  id: string;
  name: { en: string; fr: string };
  meals: readonly MealKind[];
  ingredients: readonly TemplateIngredient[];
  steps: { en: readonly string[]; fr: readonly string[] };
  cookMin: number;
  /** Months it fits (1–12); empty = all year. */
  months: readonly number[];
  carbLevel: "low" | "medium" | "high";
  budget: MealBudget;
  /** freezes, batch, no_cook, recovery, pre_long… */
  tags: readonly string[];
  /** Per serving, from the food table. */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** EU-14 keys found in its ingredients (both languages). */
  allergens: string[];
}

const SPICE: Aisle = "spices_sauces";
const f = (food: string, g: number): TemplateIngredient => {
  const row = foodById(food);
  if (!row) throw new Error(`unknown food ${food}`);
  return {
    food,
    en: row.en.replace(/, (cooked|dry|boiled|baked|drained|plain.*|whole|firm|unsweetened|canned.*)$/i, "").toLowerCase(),
    fr: row.fr.replace(/ (cuite?s?|crus?|entier|ferme|nature|égouttées|sans sucre ajouté|à l’eau|au four|au naturel)$/i, "").toLowerCase(),
    g,
    aisle: row.aisle,
  };
};
const x = (en: string, fr: string, qtyEn: string, qtyFr: string, aisle: Aisle = SPICE): TemplateIngredient => ({
  en,
  fr,
  qty: { en: qtyEn, fr: qtyFr },
  aisle,
});

type Raw = Omit<MealTemplate, "kcal" | "proteinG" | "carbsG" | "fatG" | "allergens">;

// prettier-ignore
const RAW: readonly Raw[] = [
  // Breakfasts
  { id: 'oats_banana', name: { en: 'Oats with banana and yogurt', fr: 'Flocons d’avoine, banane et yaourt' }, meals: ['breakfast'], ingredients: [f('oats', 60), f('milk_semi', 200), f('banana', 120), f('greek_yogurt', 100), x('cinnamon', 'cannelle', 'a pinch', 'une pincée')], steps: { en: ['Simmer the oats in the milk for 4 minutes.', 'Top with sliced banana, yogurt and a pinch of cinnamon.'], fr: ['Fais cuire les flocons dans le lait 4 minutes.', 'Ajoute la banane en rondelles, le yaourt et une pincée de cannelle.'] }, cookMin: 10, months: [], carbLevel: 'high', budget: 'low', tags: ['pre_long'] },
  { id: 'overnight_oats', name: { en: 'Overnight oats with berries', fr: 'Porridge de la veille aux fruits rouges' }, meals: ['breakfast'], ingredients: [f('oats', 50), f('skyr', 150), f('milk_semi', 100), f('frozen_berries', 100), f('chia_seeds', 10)], steps: { en: ['Mix oats, skyr, milk and chia in a jar.', 'Add the berries, close, fridge overnight.'], fr: ['Mélange flocons, skyr, lait et chia dans un bocal.', 'Ajoute les fruits rouges, ferme, au frigo pour la nuit.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: ['no_cook', 'batch'] },
  { id: 'eggs_toast', name: { en: 'Scrambled eggs on toast', fr: 'Œufs brouillés sur tartines' }, meals: ['breakfast', 'snack'], ingredients: [f('egg', 100), f('wholemeal_bread', 70), f('butter', 5), f('cherry_tomato', 80)], steps: { en: ['Whisk the eggs, cook gently in a pan with the butter.', 'Serve on toasted bread with the tomatoes.'], fr: ['Bats les œufs, fais-les cuire doucement à la poêle avec le beurre.', 'Sers sur le pain grillé avec les tomates.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: ['recovery'] },
  { id: 'yogurt_granola', name: { en: 'Greek yogurt, granola and fruit', fr: 'Yaourt grec, granola et fruits' }, meals: ['breakfast', 'snack'], ingredients: [f('greek_yogurt', 170), f('granola', 40), f('strawberries', 100), f('honey', 10)], steps: { en: ['Spoon the yogurt into a bowl.', 'Top with granola, fruit and a little honey.'], fr: ['Mets le yaourt dans un bol.', 'Ajoute le granola, les fruits et un peu de miel.'] }, cookMin: 10, months: [5, 6, 7, 8, 9], carbLevel: 'medium', budget: 'medium', tags: ['no_cook', 'recovery'] },
  { id: 'fromage_blanc_bowl', name: { en: 'Fromage blanc with apple and walnuts', fr: 'Fromage blanc, pomme et noix' }, meals: ['breakfast', 'snack'], ingredients: [f('fromage_blanc', 200), f('apple', 150), f('walnuts', 15), f('honey', 10)], steps: { en: ['Dice the apple.', 'Mix with the fromage blanc, top with walnuts and honey.'], fr: ['Coupe la pomme en dés.', 'Mélange au fromage blanc, ajoute les noix et le miel.'] }, cookMin: 10, months: [9, 10, 11, 12, 1, 2, 3], carbLevel: 'medium', budget: 'low', tags: ['no_cook'] },
  { id: 'tofu_scramble', name: { en: 'Tofu scramble with spinach', fr: 'Brouillade de tofu aux épinards' }, meals: ['breakfast', 'lunch'], ingredients: [f('tofu_firm', 150), f('spinach', 60), f('wholemeal_bread', 70), f('olive_oil', 5), x('turmeric', 'curcuma', 'a pinch', 'une pincée')], steps: { en: ['Crumble the tofu into a hot oiled pan with the turmeric.', 'Add the spinach until wilted; serve with toast.'], fr: ['Émiette le tofu dans une poêle huilée avec le curcuma.', 'Ajoute les épinards jusqu’à ce qu’ils tombent ; sers avec du pain grillé.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: [] },
  { id: 'banana_pb_toast', name: { en: 'Peanut butter and banana toast', fr: 'Tartines beurre de cacahuète et banane' }, meals: ['breakfast', 'snack'], ingredients: [f('wholemeal_bread', 70), f('peanut_butter', 20), f('banana', 120)], steps: { en: ['Toast the bread, spread the peanut butter.', 'Top with banana slices.'], fr: ['Fais griller le pain, tartine le beurre de cacahuète.', 'Ajoute la banane en rondelles.'] }, cookMin: 10, months: [], carbLevel: 'high', budget: 'low', tags: ['pre_long'] },
  { id: 'rice_cake_snack', name: { en: 'Rice cakes with jam and skyr', fr: 'Galettes de riz, confiture et skyr' }, meals: ['snack', 'breakfast'], ingredients: [f('rice_cake', 27), f('jam', 20), f('skyr', 150)], steps: { en: ['Spread jam on the rice cakes.', 'Eat with the skyr.'], fr: ['Tartine la confiture sur les galettes.', 'Mange avec le skyr.'] }, cookMin: 10, months: [], carbLevel: 'high', budget: 'low', tags: ['no_cook', 'pre_long'] },
  // Lunches and dinners
  { id: 'chicken_rice_bowl', name: { en: 'Chicken, rice and broccoli bowl', fr: 'Bol poulet, riz et brocoli' }, meals: ['lunch', 'dinner'], ingredients: [f('chicken_breast_cooked', 130), f('white_rice_cooked', 200), f('broccoli', 120), f('olive_oil', 10), f('soy_sauce', 10)], steps: { en: ['Cook the rice; steam the broccoli 5 minutes.', 'Pan-fry the sliced chicken in the oil, add the soy sauce.', 'Serve together.'], fr: ['Fais cuire le riz ; le brocoli 5 minutes à la vapeur.', 'Poêle le poulet en lamelles dans l’huile, ajoute la sauce soja.', 'Sers ensemble.'] }, cookMin: 20, months: [], carbLevel: 'high', budget: 'medium', tags: ['batch', 'recovery'] },
  { id: 'salmon_potatoes', name: { en: 'Salmon, potatoes and green beans', fr: 'Saumon, pommes de terre et haricots verts' }, meals: ['dinner', 'lunch'], ingredients: [f('salmon_cooked', 130), f('potato_boiled', 220), f('green_beans', 120), x('lemon', 'citron', '1/4', '1/4', 'produce')], steps: { en: ['Boil the potatoes 15 minutes, the beans 7.', 'Bake or pan-fry the salmon 10 minutes; a squeeze of lemon.'], fr: ['Fais cuire les pommes de terre 15 minutes à l’eau, les haricots 7.', 'Cuis le saumon 10 minutes au four ou à la poêle ; un filet de citron.'] }, cookMin: 30, months: [], carbLevel: 'medium', budget: 'high', tags: ['recovery'] },
  { id: 'lentil_curry', name: { en: 'Lentil and spinach curry with rice', fr: 'Curry de lentilles aux épinards et riz' }, meals: ['lunch', 'dinner'], ingredients: [f('lentils_cooked', 200), f('spinach', 80), f('tomato_sauce', 100), f('onion', 60), f('white_rice_cooked', 150), f('olive_oil', 10), x('curry powder', 'curry en poudre', '1 tsp', '1 c. à c.')], steps: { en: ['Soften the onion in the oil with the curry powder.', 'Add lentils and tomato sauce, simmer 10 minutes, stir in the spinach.', 'Serve with rice.'], fr: ['Fais revenir l’oignon dans l’huile avec le curry.', 'Ajoute lentilles et sauce tomate, laisse mijoter 10 minutes, ajoute les épinards.', 'Sers avec le riz.'] }, cookMin: 30, months: [], carbLevel: 'high', budget: 'low', tags: ['freezes', 'batch'] },
  { id: 'chickpea_salad', name: { en: 'Chickpea, cucumber and feta salad', fr: 'Salade pois chiches, concombre et feta' }, meals: ['lunch'], ingredients: [f('chickpeas_cooked', 160), f('cucumber', 100), f('cherry_tomato', 100), f('feta', 40), f('olive_oil', 10)], steps: { en: ['Rinse the chickpeas, dice cucumber and tomatoes.', 'Mix with crumbled feta and the oil.'], fr: ['Rince les pois chiches, coupe concombre et tomates.', 'Mélange avec la feta émiettée et l’huile.'] }, cookMin: 10, months: [5, 6, 7, 8, 9], carbLevel: 'medium', budget: 'low', tags: ['no_cook'] },
  { id: 'pasta_tomato_tuna', name: { en: 'Pasta with tomato and tuna', fr: 'Pâtes à la tomate et au thon' }, meals: ['lunch', 'dinner'], ingredients: [f('pasta_dry', 90), f('tomato_sauce', 150), f('tuna_canned_water', 100), f('olive_oil', 5), x('basil', 'basilic', 'a few leaves', 'quelques feuilles')], steps: { en: ['Cook the pasta.', 'Warm the sauce with the tuna; toss with the pasta and basil.'], fr: ['Fais cuire les pâtes.', 'Réchauffe la sauce avec le thon ; mélange aux pâtes avec le basilic.'] }, cookMin: 20, months: [], carbLevel: 'high', budget: 'low', tags: ['pre_long', 'recovery'] },
  { id: 'pasta_bolognese', name: { en: 'Spaghetti bolognese', fr: 'Spaghetti bolognaise' }, meals: ['lunch', 'dinner'], ingredients: [f('pasta_dry', 90), f('ground_beef_5_cooked', 110), f('tomato_sauce', 150), f('onion', 50), f('carrot', 60)], steps: { en: ['Brown the beef with chopped onion and carrot.', 'Add the sauce, simmer 15 minutes; serve on the pasta.'], fr: ['Fais dorer le bœuf avec l’oignon et la carotte hachés.', 'Ajoute la sauce, laisse mijoter 15 minutes ; sers sur les pâtes.'] }, cookMin: 30, months: [], carbLevel: 'high', budget: 'medium', tags: ['freezes', 'batch', 'pre_long'] },
  { id: 'veggie_chili', name: { en: 'Bean and vegetable chili', fr: 'Chili aux haricots et légumes' }, meals: ['lunch', 'dinner'], ingredients: [f('kidney_beans_cooked', 170), f('black_beans_cooked', 80), f('tomato_sauce', 150), f('bell_pepper', 100), f('onion', 60), f('sweetcorn', 60), f('white_rice_cooked', 150), x('cumin and paprika', 'cumin et paprika', '1 tsp each', '1 c. à c. de chaque')], steps: { en: ['Soften onion and pepper, add the spices.', 'Add beans, corn and sauce; simmer 20 minutes.', 'Serve with rice.'], fr: ['Fais revenir oignon et poivron, ajoute les épices.', 'Ajoute haricots, maïs et sauce ; laisse mijoter 20 minutes.', 'Sers avec le riz.'] }, cookMin: 30, months: [10, 11, 12, 1, 2, 3], carbLevel: 'high', budget: 'low', tags: ['freezes', 'batch'] },
  { id: 'turkey_wrap', name: { en: 'Turkey, hummus and salad wrap', fr: 'Wrap dinde, houmous et crudités' }, meals: ['lunch'], ingredients: [f('wheat_tortilla', 60), f('turkey_breast_cooked', 90), f('hummus', 40), f('lettuce', 30), f('carrot', 50)], steps: { en: ['Spread hummus on the wrap.', 'Add turkey, lettuce and grated carrot; roll up.'], fr: ['Tartine le houmous sur la galette.', 'Ajoute la dinde, la salade et la carotte râpée ; roule.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'medium', tags: ['no_cook'] },
  { id: 'omelette_salad', name: { en: 'Herb omelette with salad and bread', fr: 'Omelette aux herbes, salade et pain' }, meals: ['lunch', 'dinner'], ingredients: [f('egg', 150), f('lettuce', 60), f('baguette', 60), f('olive_oil', 5), x('chives', 'ciboulette', 'a handful', 'une poignée')], steps: { en: ['Beat the eggs with chopped chives, cook in the oiled pan.', 'Serve with the salad and bread.'], fr: ['Bats les œufs avec la ciboulette, fais cuire à la poêle huilée.', 'Sers avec la salade et le pain.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: [] },
  { id: 'cod_ratatouille', name: { en: 'Cod with ratatouille and couscous', fr: 'Cabillaud, ratatouille et semoule' }, meals: ['dinner'], ingredients: [f('cod_cooked', 150), f('ratatouille', 200), f('couscous_cooked', 160)], steps: { en: ['Warm the ratatouille; prepare the couscous with boiling water.', 'Pan-fry the cod 4 minutes a side.'], fr: ['Réchauffe la ratatouille ; prépare la semoule à l’eau bouillante.', 'Poêle le cabillaud 4 minutes de chaque côté.'] }, cookMin: 20, months: [6, 7, 8, 9], carbLevel: 'medium', budget: 'medium', tags: [] },
  { id: 'tofu_stirfry', name: { en: 'Tofu and vegetable stir-fry with noodles', fr: 'Wok de tofu et légumes aux nouilles' }, meals: ['lunch', 'dinner'], ingredients: [f('tofu_firm', 150), f('frozen_veg_mix', 200), f('pasta_cooked', 150), f('soy_sauce', 15), f('rapeseed_oil', 10), x('ginger', 'gingembre', '1 tsp grated', '1 c. à c. râpé')], steps: { en: ['Brown the tofu cubes in the oil.', 'Add the vegetables and ginger, then the noodles and soy sauce.'], fr: ['Fais dorer le tofu en dés dans l’huile.', 'Ajoute les légumes et le gingembre, puis les nouilles et la sauce soja.'] }, cookMin: 20, months: [], carbLevel: 'high', budget: 'low', tags: [] },
  { id: 'steak_sweet_potato', name: { en: 'Steak, sweet potato and green salad', fr: 'Steak, patate douce et salade verte' }, meals: ['dinner'], ingredients: [f('beef_steak_cooked', 140), f('sweet_potato_baked', 220), f('lettuce', 60), f('vinaigrette', 10)], steps: { en: ['Bake the sweet potato wedges 25 minutes at 200 °C.', 'Sear the steak 2–3 minutes a side; serve with the salad.'], fr: ['Fais cuire les quartiers de patate douce 25 minutes à 200 °C.', 'Saisis le steak 2–3 minutes par face ; sers avec la salade.'] }, cookMin: 30, months: [], carbLevel: 'medium', budget: 'high', tags: ['recovery'] },
  { id: 'chicken_couscous', name: { en: 'Chicken and vegetable couscous', fr: 'Couscous poulet et légumes' }, meals: ['lunch', 'dinner'], ingredients: [f('chicken_thigh_cooked', 130), f('couscous_cooked', 180), f('zucchini', 120), f('carrot', 80), f('chickpeas_cooked', 60), x('ras el hanout', 'ras el hanout', '1 tsp', '1 c. à c.')], steps: { en: ['Simmer chicken, carrots and zucchini with the spice in a little water, 25 minutes.', 'Add the chickpeas; serve on the couscous.'], fr: ['Fais mijoter poulet, carottes et courgettes avec l’épice dans un peu d’eau, 25 minutes.', 'Ajoute les pois chiches ; sers sur la semoule.'] }, cookMin: 45, months: [], carbLevel: 'high', budget: 'medium', tags: ['freezes', 'batch', 'pre_long'] },
  { id: 'pumpkin_soup', name: { en: 'Pumpkin soup with bread and cheese', fr: 'Soupe de potiron, pain et fromage' }, meals: ['dinner', 'lunch'], ingredients: [f('pumpkin', 300), f('onion', 60), f('potato_boiled', 100), f('wholemeal_bread', 70), f('comte', 30)], steps: { en: ['Simmer pumpkin, potato and onion in water 20 minutes.', 'Blend; serve with bread and cheese.'], fr: ['Fais cuire potiron, pomme de terre et oignon 20 minutes dans l’eau.', 'Mixe ; sers avec du pain et du fromage.'] }, cookMin: 30, months: [10, 11, 12, 1], carbLevel: 'medium', budget: 'low', tags: ['freezes', 'batch'] },
  { id: 'leek_potato_soup', name: { en: 'Leek and potato soup with an egg', fr: 'Soupe poireaux-pommes de terre et œuf' }, meals: ['dinner'], ingredients: [f('leek', 150), f('potato_boiled', 200), f('egg_boiled', 50), f('creme_fraiche', 15)], steps: { en: ['Simmer sliced leek and potato in water 20 minutes.', 'Blend with the crème fraîche; serve with a boiled egg.'], fr: ['Fais cuire poireaux et pommes de terre 20 minutes dans l’eau.', 'Mixe avec la crème fraîche ; sers avec un œuf dur.'] }, cookMin: 30, months: [10, 11, 12, 1, 2, 3], carbLevel: 'medium', budget: 'low', tags: ['freezes'] },
  { id: 'galette_complete', name: { en: 'Buckwheat galette with ham, egg and cheese', fr: 'Galette complète (jambon, œuf, fromage)' }, meals: ['lunch', 'dinner'], ingredients: [f('buckwheat_crepe', 60), f('ham', 40), f('egg', 50), f('emmental', 25), f('lettuce', 40)], steps: { en: ['Warm the galette in a pan, crack the egg in the middle.', 'Add ham and cheese, fold the edges; serve with salad.'], fr: ['Réchauffe la galette à la poêle, casse l’œuf au milieu.', 'Ajoute jambon et fromage, replie les bords ; sers avec la salade.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'medium', tags: [] },
  { id: 'quinoa_bowl', name: { en: 'Quinoa, black bean and avocado bowl', fr: 'Bol quinoa, haricots noirs et avocat' }, meals: ['lunch'], ingredients: [f('quinoa_cooked', 160), f('black_beans_cooked', 120), f('avocado', 70), f('sweetcorn', 60), f('cherry_tomato', 80), x('lime', 'citron vert', '1/2', '1/2', 'produce')], steps: { en: ['Cook the quinoa, rinse the beans.', 'Top with avocado, corn and tomatoes; squeeze the lime.'], fr: ['Fais cuire le quinoa, rince les haricots.', 'Ajoute avocat, maïs et tomates ; presse le citron vert.'] }, cookMin: 20, months: [], carbLevel: 'high', budget: 'medium', tags: ['batch'] },
  { id: 'sardine_toast', name: { en: 'Sardines on toast with tomato', fr: 'Tartines de sardines et tomate' }, meals: ['lunch', 'snack'], ingredients: [f('sardines_canned', 90), f('sourdough_bread', 80), f('tomato', 120), x('lemon', 'citron', '1/4', '1/4', 'produce')], steps: { en: ['Toast the bread, mash the sardines on it.', 'Add sliced tomato and lemon.'], fr: ['Fais griller le pain, écrase les sardines dessus.', 'Ajoute la tomate en tranches et le citron.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: ['no_cook'] },
  { id: 'pork_cabbage', name: { en: 'Pork loin with braised cabbage and potatoes', fr: 'Filet de porc, chou braisé et pommes de terre' }, meals: ['dinner'], ingredients: [f('pork_loin_cooked', 130), f('cabbage', 200), f('potato_boiled', 200), f('butter', 5)], steps: { en: ['Braise the sliced cabbage with the butter and a splash of water, 20 minutes.', 'Roast or pan-fry the pork; serve with boiled potatoes.'], fr: ['Fais braiser le chou émincé avec le beurre et un peu d’eau, 20 minutes.', 'Rôtis ou poêle le porc ; sers avec les pommes de terre.'] }, cookMin: 45, months: [10, 11, 12, 1, 2, 3], carbLevel: 'medium', budget: 'medium', tags: [] },
  { id: 'lamb_tagine_lite', name: { en: 'Lamb and vegetable stew with bulgur', fr: 'Ragoût d’agneau aux légumes et boulgour' }, meals: ['dinner'], ingredients: [f('lamb_cooked', 120), f('carrot', 100), f('zucchini', 100), f('chickpeas_cooked', 60), f('bulgur_cooked', 160), x('cumin', 'cumin', '1 tsp', '1 c. à c.')], steps: { en: ['Brown the lamb, add vegetables, spice and water; simmer 40 minutes.', 'Serve on bulgur.'], fr: ['Fais dorer l’agneau, ajoute légumes, épice et eau ; laisse mijoter 40 minutes.', 'Sers sur le boulgour.'] }, cookMin: 60, months: [10, 11, 12, 1, 2, 3], carbLevel: 'medium', budget: 'high', tags: ['freezes', 'batch'] },
  { id: 'shrimp_rice', name: { en: 'Garlic shrimp with rice and peas', fr: 'Crevettes à l’ail, riz et petits pois' }, meals: ['dinner', 'lunch'], ingredients: [f('shrimp_cooked', 120), f('white_rice_cooked', 180), f('peas', 100), f('garlic', 5), f('olive_oil', 10)], steps: { en: ['Cook the rice and peas.', 'Sauté the shrimp with garlic in the oil, 3 minutes.'], fr: ['Fais cuire le riz et les petits pois.', 'Fais sauter les crevettes à l’ail dans l’huile, 3 minutes.'] }, cookMin: 20, months: [], carbLevel: 'high', budget: 'high', tags: [] },
  { id: 'mussels_fries', name: { en: 'Mussels with bread', fr: 'Moules marinières et pain' }, meals: ['dinner'], ingredients: [f('mussels_cooked', 150), f('baguette', 80), f('onion', 40), x('parsley', 'persil', 'a handful', 'une poignée', 'produce')], steps: { en: ['Soften the onion, add the mussels, cover 6 minutes until open.', 'Add parsley; serve with bread.'], fr: ['Fais revenir l’oignon, ajoute les moules, couvre 6 minutes jusqu’à ouverture.', 'Ajoute le persil ; sers avec le pain.'] }, cookMin: 20, months: [9, 10, 11, 12, 1, 2], carbLevel: 'medium', budget: 'medium', tags: [] },
  { id: 'veggie_omelette_potato', name: { en: 'Potato and onion omelette', fr: 'Omelette pommes de terre et oignon' }, meals: ['dinner', 'lunch'], ingredients: [f('egg', 150), f('potato_boiled', 180), f('onion', 60), f('olive_oil', 10), f('lettuce', 50)], steps: { en: ['Fry sliced potato and onion in the oil until soft.', 'Pour in beaten eggs, cook gently; serve with salad.'], fr: ['Fais revenir pommes de terre et oignon en lamelles dans l’huile.', 'Verse les œufs battus, cuis doucement ; sers avec la salade.'] }, cookMin: 30, months: [], carbLevel: 'medium', budget: 'low', tags: [] },
  { id: 'tempeh_bowl', name: { en: 'Tempeh, brown rice and kale bowl', fr: 'Bol tempeh, riz complet et chou kale' }, meals: ['lunch', 'dinner'], ingredients: [f('tempeh', 120), f('brown_rice_cooked', 180), f('kale', 60), f('pumpkin_seeds', 10), f('soy_sauce', 10)], steps: { en: ['Cook the rice; brown sliced tempeh with the soy sauce.', 'Wilt the kale; top with seeds.'], fr: ['Fais cuire le riz ; dore le tempeh en tranches avec la sauce soja.', 'Fais tomber le kale ; parsème de graines.'] }, cookMin: 30, months: [], carbLevel: 'medium', budget: 'medium', tags: [] },
  { id: 'white_bean_stew', name: { en: 'White bean and vegetable stew', fr: 'Mijoté de haricots blancs et légumes' }, meals: ['dinner', 'lunch'], ingredients: [f('white_beans_cooked', 200), f('carrot', 80), f('tomato_sauce', 120), f('onion', 50), f('baguette', 60), f('olive_oil', 10)], steps: { en: ['Soften onion and carrot in the oil.', 'Add beans and sauce, simmer 15 minutes; serve with bread.'], fr: ['Fais revenir oignon et carotte dans l’huile.', 'Ajoute haricots et sauce, laisse mijoter 15 minutes ; sers avec du pain.'] }, cookMin: 30, months: [10, 11, 12, 1, 2, 3], carbLevel: 'high', budget: 'low', tags: ['freezes', 'batch'] },
  { id: 'summer_pasta_salad', name: { en: 'Pasta salad with mozzarella and tomato', fr: 'Salade de pâtes, mozzarella et tomate' }, meals: ['lunch'], ingredients: [f('pasta_dry', 80), f('mozzarella', 60), f('cherry_tomato', 120), f('olive_oil', 10), x('basil', 'basilic', 'a few leaves', 'quelques feuilles', 'produce')], steps: { en: ['Cook and cool the pasta.', 'Toss with mozzarella, tomatoes, oil and basil.'], fr: ['Fais cuire puis refroidir les pâtes.', 'Mélange avec mozzarella, tomates, huile et basilic.'] }, cookMin: 20, months: [6, 7, 8, 9], carbLevel: 'high', budget: 'medium', tags: ['batch'] },
  { id: 'asparagus_eggs', name: { en: 'Asparagus with soft eggs and bread', fr: 'Asperges, œufs mollets et pain' }, meals: ['lunch', 'dinner'], ingredients: [f('asparagus', 150), f('egg', 100), f('sourdough_bread', 70)], steps: { en: ['Steam the asparagus 6 minutes; boil the eggs 6 minutes.', 'Dip the asparagus and bread in the eggs.'], fr: ['Fais cuire les asperges 6 minutes à la vapeur ; les œufs 6 minutes.', 'Trempe asperges et pain dans les œufs.'] }, cookMin: 20, months: [4, 5, 6], carbLevel: 'medium', budget: 'medium', tags: [] },
  // Snacks and recovery
  { id: 'recovery_shake', name: { en: 'Milk, banana and oat shake', fr: 'Shake lait, banane et avoine' }, meals: ['snack'], ingredients: [f('milk_semi', 300), f('banana', 120), f('oats', 30)], steps: { en: ['Blend everything for 30 seconds.'], fr: ['Mixe le tout 30 secondes.'] }, cookMin: 10, months: [], carbLevel: 'high', budget: 'low', tags: ['recovery', 'no_cook'] },
  { id: 'soy_recovery_shake', name: { en: 'Soy, berry and banana shake', fr: 'Shake soja, fruits rouges et banane' }, meals: ['snack'], ingredients: [f('soy_drink', 300), f('frozen_berries', 100), f('banana', 120)], steps: { en: ['Blend everything for 30 seconds.'], fr: ['Mixe le tout 30 secondes.'] }, cookMin: 10, months: [], carbLevel: 'high', budget: 'low', tags: ['recovery', 'no_cook'] },
  { id: 'fruit_nuts', name: { en: 'Fruit and a handful of almonds', fr: 'Un fruit et une poignée d’amandes' }, meals: ['snack'], ingredients: [f('apple', 150), f('almonds', 25)], steps: { en: ['Ready to eat.'], fr: ['Prêt à manger.'] }, cookMin: 10, months: [], carbLevel: 'low', budget: 'low', tags: ['no_cook'] },
  { id: 'dates_yogurt', name: { en: 'Yogurt with dates', fr: 'Yaourt aux dattes' }, meals: ['snack'], ingredients: [f('yogurt_plain', 125), f('dates', 30)], steps: { en: ['Chop the dates into the yogurt.'], fr: ['Coupe les dattes dans le yaourt.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: ['no_cook', 'pre_long'] },
  { id: 'hummus_veg', name: { en: 'Hummus with carrot sticks and pita', fr: 'Houmous, bâtonnets de carotte et pita' }, meals: ['snack'], ingredients: [f('hummus', 50), f('carrot', 100), f('pita', 40)], steps: { en: ['Cut the carrots into sticks; dip.'], fr: ['Coupe les carottes en bâtonnets ; trempe.'] }, cookMin: 10, months: [], carbLevel: 'medium', budget: 'low', tags: ['no_cook'] },
  { id: 'banana_rice_cakes', name: { en: 'Banana and rice cakes before a long session', fr: 'Banane et galettes de riz avant une longue séance' }, meals: ['snack'], ingredients: [f('banana', 120), f('rice_cake', 18), f('honey', 10)], steps: { en: ['Drizzle honey on the rice cakes; eat with the banana 60–90 minutes before.'], fr: ['Un filet de miel sur les galettes ; mange avec la banane 60–90 minutes avant.'] }, cookMin: 10, months: [], carbLevel: 'high', budget: 'low', tags: ['no_cook', 'pre_long'] },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

function finish(t: Raw): MealTemplate {
  const ings = t.ingredients.filter((i) => i && (i.food ? !!foodById(i.food) : true));
  let kcal = 0;
  let p = 0;
  let c = 0;
  let fat = 0;
  for (const i of ings) {
    const row = i.food ? foodById(i.food) : undefined;
    if (!row || !i.g) continue;
    const k = i.g / 100;
    kcal += row.kcal * k;
    p += row.proteinG * k;
    c += row.carbsG * k;
    fat += row.fatG * k;
  }
  const names = ings.flatMap((i) => [i.en, i.fr]);
  return {
    ...t,
    ingredients: ings,
    kcal: Math.round(kcal),
    proteinG: r1(p),
    carbsG: r1(c),
    fatG: r1(fat),
    allergens: allergensIn([...names, t.name.en, t.name.fr]),
  };
}

export const MEAL_TEMPLATES: readonly MealTemplate[] = RAW.map(finish);

/** A template's ingredient names in both languages (what the hard filter checks). */
export const templateWords = (t: MealTemplate): string[] => t.ingredients.flatMap((i) => [i.en, i.fr]);

/** The filter's view of a template: name in both languages + every ingredient name + declared allergens. */
const asFilterable = (t: MealTemplate) => ({
  name: `${t.name.en} / ${t.name.fr}`,
  ingredients: templateWords(t),
  allergens: t.allergens,
  t,
});

const BUDGET_RANK: Readonly<Record<MealBudget, number>> = { low: 0, medium: 1, high: 2 };
const LOAD_CARB: Readonly<Record<DayLoad, MealTemplate["carbLevel"][]>> = {
  rest: ["low", "medium"],
  easy: ["medium", "low"],
  moderate: ["medium", "high"],
  hard: ["high", "medium"],
  long: ["high", "medium"],
};

/**
 * Safe local ideas for the profile and the day: the hard filter first (allergies, intolerances, diet, dislikes), then
 * the meal kind, cook time ≤ the profile's, budget ≤ the profile's, in season (or all year), carbs that suit the load;
 * `seed` rotates the picks (e.g. the day number) so a week doesn't repeat. Fewer than n when the profile excludes
 * most of them (never an unsafe one). Pure.
 */
export function fallbackMeals(
  p: NutritionProfile,
  ctx: { load: DayLoad; month: number; meal?: MealKind; n: number; seed?: number; exclude?: readonly string[] },
): MealTemplate[] {
  const safe = filterSafeMeals(MEAL_TEMPLATES.map(asFilterable), p).map((x) => x.t);
  const fits = (t: MealTemplate, strict: boolean) =>
    (!ctx.meal || t.meals.includes(ctx.meal)) &&
    !(ctx.exclude ?? []).includes(t.id) &&
    (!strict ||
      (t.cookMin <= p.cookMinutes && BUDGET_RANK[t.budget] <= BUDGET_RANK[p.budget] && (!t.months.length || t.months.includes(ctx.month))));
  let pool = safe.filter((t) => fits(t, true));
  if (pool.length < ctx.n) pool = [...pool, ...safe.filter((t) => fits(t, false) && !pool.includes(t))];
  const pref = LOAD_CARB[ctx.load];
  const score = (t: MealTemplate) =>
    (t.carbLevel === pref[0] ? 2 : t.carbLevel === pref[1] ? 1 : 0) + (ctx.load === "long" && t.tags.includes("pre_long") ? 1 : 0);
  const seed = Math.abs(Math.floor(ctx.seed ?? 0));
  const ordered = [...pool].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  if (!ordered.length) return [];
  // Rotate inside the best-scoring group so the same day load doesn't always give the same meal.
  const top = ordered.filter((t) => score(t) === score(ordered[0]!));
  const rest = ordered.filter((t) => !top.includes(t));
  const rot = top.length ? seed % top.length : 0;
  return [...top.slice(rot), ...top.slice(0, rot), ...rest].slice(0, Math.max(0, ctx.n));
}

/** A template as a MealIdea in a language (servings scale the quantities). Pure. */
export function mealIdeaOf(t: MealTemplate, lang: Lang, why: string, servings = 1, meal?: MealKind): MealIdea {
  const s = Math.min(8, Math.max(1, Math.round(servings)));
  return {
    id: `t:${t.id}`,
    name: t.name[lang],
    ingredients: t.ingredients.map((i) => ({ name: i[lang], qty: i.g ? `${Math.round(i.g * s)} g` : i.qty ? i.qty[lang] : "" })),
    steps: [...t.steps[lang]],
    cookMin: t.cookMin,
    kcal: t.kcal,
    proteinG: t.proteinG,
    carbsG: t.carbsG,
    fatG: t.fatG,
    allergens: [...t.allergens],
    tags: [...t.tags],
    why,
    ...(meal ? { meal } : {}),
  };
}

const QTY = /^\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cl|pc|pcs|x)?\s*$/i;

/**
 * One flat shopping list from meals: the same ingredient (folded, singular) merged; "120 g" + "80 g" = "200 g" (g/kg and
 * ml/cl/l normalised), other quantities joined with " + ". Pure.
 */
export function shoppingList(
  meals: readonly { ingredients: readonly { name: string; qty?: string }[] }[],
): { name: string; qty: string }[] {
  const by = new Map<string, { name: string; grams: number; ml: number; other: string[] }>();
  for (const m of meals)
    for (const i of m.ingredients) {
      const key = foodWords(i.name).join(" ");
      if (!key) continue;
      const cur = by.get(key) ?? { name: i.name, grams: 0, ml: 0, other: [] };
      const q = (i.qty ?? "").match(QTY);
      if (q) {
        const n = Number(q[1]!.replace(",", "."));
        const u = (q[2] ?? "g").toLowerCase();
        if (u === "g") cur.grams += n;
        else if (u === "kg") cur.grams += n * 1000;
        else if (u === "ml") cur.ml += n;
        else if (u === "cl") cur.ml += n * 10;
        else if (u === "l") cur.ml += n * 1000;
        else cur.other.push(`${n}`);
      } else if (i.qty?.trim() && !cur.other.includes(i.qty.trim())) cur.other.push(i.qty.trim());
      by.set(key, cur);
    }
  const fmt = (v: number, small: string, big: string) => (v >= 1000 ? `${Math.round(v / 100) / 10} ${big}` : `${Math.round(v)} ${small}`);
  return [...by.values()].map((v) => ({
    name: v.name,
    qty: [v.grams ? fmt(v.grams, "g", "kg") : "", v.ml ? fmt(v.ml, "ml", "l") : "", ...v.other].filter(Boolean).join(" + "),
  }));
}
