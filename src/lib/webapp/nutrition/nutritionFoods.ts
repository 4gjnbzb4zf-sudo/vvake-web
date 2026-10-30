// Copied from VVFit packages/game-core/src/nutritionFoods.ts (bcd38837 2026-10-30) by scripts/sync-nutrition-core.ts. Do not edit: re-sync.
/**
 * The local food table (ADR-0070): ~150 common foods, French staples included, per 100 g + a typical portion. Used for
 * manual entry ("Search food"), the photo fallback (limit, no key, model down) and our own meal templates' numbers.
 *
 * Values: USDA FoodData Central (SR Legacy / Foundation Foods), public domain (CC0), rounded; a few French staples
 * (comté, baguette, crème fraîche…) use the closest FDC entry. Estimates, not lab values.
 * Source: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. fdc.nal.usda.gov.
 */
import { foodWords, foldFood, type BiasFamily } from "./nutrition";

export const AISLES = ["produce", "bakery", "meat_fish", "dairy_eggs", "pantry", "frozen", "spices_sauces", "drinks", "other"] as const;
export type Aisle = (typeof AISLES)[number];

export interface FoodRow {
  id: string;
  en: string;
  fr: string;
  /** Per 100 g (or 100 ml for drinks). */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** A typical portion in grams and its words. */
  portionG: number;
  portion: { en: string; fr: string };
  family: BiasFamily;
  aisle: Aisle;
}

type Row = [
  id: string,
  en: string,
  fr: string,
  kcal: number,
  p: number,
  c: number,
  f: number,
  portionG: number,
  portionEn: string,
  portionFr: string,
  family: BiasFamily,
  aisle: Aisle,
];

// prettier-ignore
const ROWS: readonly Row[] = [
  // Grains, bread, cereals
  ['white_rice_cooked', 'White rice, cooked', 'Riz blanc cuit', 130, 2.7, 28.2, 0.3, 180, '1 cup', '1 bol', 'rice', 'pantry'],
  ['brown_rice_cooked', 'Brown rice, cooked', 'Riz complet cuit', 123, 2.7, 25.6, 1.0, 180, '1 cup', '1 bol', 'rice', 'pantry'],
  ['basmati_rice_dry', 'Basmati rice, dry', 'Riz basmati cru', 356, 7.9, 78.0, 0.6, 75, '1 portion', '1 portion', 'rice', 'pantry'],
  ['pasta_cooked', 'Pasta, cooked', 'Pâtes cuites', 158, 5.8, 30.9, 0.9, 200, '1 plate', '1 assiette', 'pasta', 'pantry'],
  ['pasta_dry', 'Pasta, dry', 'Pâtes crues', 371, 13.0, 74.7, 1.5, 85, '1 portion', '1 portion', 'pasta', 'pantry'],
  ['wholewheat_pasta_cooked', 'Whole-wheat pasta, cooked', 'Pâtes complètes cuites', 149, 6.0, 30.1, 1.7, 200, '1 plate', '1 assiette', 'pasta', 'pantry'],
  ['couscous_cooked', 'Couscous, cooked', 'Semoule de couscous cuite', 112, 3.8, 23.2, 0.2, 180, '1 bowl', '1 bol', 'rice', 'pantry'],
  ['quinoa_cooked', 'Quinoa, cooked', 'Quinoa cuit', 120, 4.4, 21.3, 1.9, 180, '1 cup', '1 bol', 'rice', 'pantry'],
  ['bulgur_cooked', 'Bulgur, cooked', 'Boulgour cuit', 83, 3.1, 18.6, 0.2, 180, '1 cup', '1 bol', 'rice', 'pantry'],
  ['oats', 'Rolled oats', 'Flocons d’avoine', 379, 13.2, 67.7, 6.5, 50, '1/2 cup', '1/2 tasse', 'bread', 'pantry'],
  ['muesli', 'Muesli', 'Muesli', 362, 9.7, 66.0, 5.9, 50, '1 bowl', '1 bol', 'bread', 'pantry'],
  ['granola', 'Granola', 'Granola', 471, 10.0, 64.0, 20.0, 50, '1/2 cup', '1/2 tasse', 'bread', 'pantry'],
  ['cornflakes', 'Corn flakes', 'Pétales de maïs', 357, 7.5, 84.1, 0.4, 30, '1 bowl', '1 bol', 'bread', 'pantry'],
  ['baguette', 'Baguette (French bread)', 'Baguette', 274, 10.8, 51.9, 2.4, 60, '1/4 baguette', '1/4 de baguette', 'bread', 'bakery'],
  ['white_bread', 'White bread', 'Pain de mie', 266, 8.9, 49.4, 3.3, 30, '1 slice', '1 tranche', 'bread', 'bakery'],
  ['wholemeal_bread', 'Whole-wheat bread', 'Pain complet', 252, 12.5, 42.7, 3.5, 35, '1 slice', '1 tranche', 'bread', 'bakery'],
  ['sourdough_bread', 'Sourdough bread', 'Pain au levain', 272, 10.8, 51.9, 2.4, 50, '1 slice', '1 tranche', 'bread', 'bakery'],
  ['rye_bread', 'Rye bread', 'Pain de seigle', 259, 8.5, 48.3, 3.3, 35, '1 slice', '1 tranche', 'bread', 'bakery'],
  ['croissant', 'Croissant', 'Croissant', 406, 8.2, 45.8, 21.0, 60, '1 croissant', '1 croissant', 'bread', 'bakery'],
  ['pain_au_chocolat', 'Pain au chocolat', 'Pain au chocolat', 414, 7.5, 45.0, 22.0, 70, '1 piece', '1 pièce', 'dessert', 'bakery'],
  ['bagel', 'Bagel', 'Bagel', 257, 10.0, 50.5, 1.6, 100, '1 bagel', '1 bagel', 'bread', 'bakery'],
  ['wheat_tortilla', 'Flour tortilla', 'Tortilla de blé', 306, 8.0, 50.0, 8.0, 60, '1 wrap', '1 galette', 'bread', 'bakery'],
  ['corn_tortilla', 'Corn tortilla', 'Tortilla de maïs', 218, 5.7, 44.6, 2.9, 30, '1 tortilla', '1 tortilla', 'bread', 'bakery'],
  ['pita', 'Pita bread', 'Pain pita', 275, 9.1, 55.7, 1.2, 60, '1 pita', '1 pita', 'bread', 'bakery'],
  ['rice_cake', 'Rice cake', 'Galette de riz', 387, 8.2, 81.5, 2.8, 9, '1 cake', '1 galette', 'bread', 'pantry'],
  ['buckwheat_crepe', 'Buckwheat galette', 'Galette de sarrasin', 160, 5.0, 30.0, 2.0, 60, '1 galette', '1 galette', 'bread', 'bakery'],
  ['crepe', 'Crêpe', 'Crêpe', 227, 6.4, 28.3, 9.7, 60, '1 crêpe', '1 crêpe', 'dessert', 'bakery'],
  ['pizza_margherita', 'Pizza margherita', 'Pizza margherita', 250, 10.6, 30.7, 9.6, 300, '1 pizza (small)', '1 petite pizza', 'bread', 'frozen'],
  ['potato_boiled', 'Potato, boiled', 'Pomme de terre cuite à l’eau', 87, 1.9, 20.1, 0.1, 200, '2 medium', '2 moyennes', 'veg', 'produce'],
  ['sweet_potato_baked', 'Sweet potato, baked', 'Patate douce au four', 90, 2.0, 20.7, 0.2, 200, '1 medium', '1 moyenne', 'veg', 'produce'],
  ['fries', 'French fries', 'Frites', 312, 3.4, 41.4, 14.7, 120, '1 portion', '1 portion', 'veg', 'frozen'],
  ['mashed_potato', 'Mashed potatoes', 'Purée de pommes de terre', 113, 2.0, 15.9, 4.6, 200, '1 portion', '1 portion', 'veg', 'produce'],
  // Meat, fish, eggs, plant protein
  ['chicken_breast_cooked', 'Chicken breast, cooked', 'Blanc de poulet cuit', 165, 31.0, 0, 3.6, 130, '1 breast', '1 filet', 'meat', 'meat_fish'],
  ['chicken_thigh_cooked', 'Chicken thigh, cooked', 'Cuisse de poulet cuite', 209, 26.0, 0, 10.9, 120, '1 thigh', '1 cuisse', 'meat', 'meat_fish'],
  ['turkey_breast_cooked', 'Turkey breast, cooked', 'Escalope de dinde cuite', 147, 30.1, 0, 2.1, 120, '1 cutlet', '1 escalope', 'meat', 'meat_fish'],
  ['beef_steak_cooked', 'Beef steak, cooked', 'Steak de bœuf cuit', 217, 26.1, 0, 11.8, 150, '1 steak', '1 steak', 'meat', 'meat_fish'],
  ['ground_beef_5_cooked', 'Ground beef 5 % fat, cooked', 'Steak haché 5 % cuit', 164, 26.0, 0, 6.0, 125, '1 patty', '1 steak haché', 'meat', 'meat_fish'],
  ['ground_beef_15_cooked', 'Ground beef 15 % fat, cooked', 'Steak haché 15 % cuit', 250, 26.0, 0, 15.0, 125, '1 patty', '1 steak haché', 'meat', 'meat_fish'],
  ['pork_loin_cooked', 'Pork loin, cooked', 'Filet de porc cuit', 196, 27.3, 0, 8.9, 130, '1 chop', '1 côte', 'meat', 'meat_fish'],
  ['ham', 'Cooked ham', 'Jambon blanc', 145, 21.0, 1.5, 6.0, 40, '1 slice', '1 tranche', 'meat', 'meat_fish'],
  ['bacon_cooked', 'Bacon, cooked', 'Bacon cuit', 541, 37.0, 1.4, 42.0, 15, '2 slices', '2 tranches', 'meat', 'meat_fish'],
  ['sausage_pork', 'Pork sausage', 'Saucisse de porc', 301, 12.0, 1.5, 27.0, 100, '2 sausages', '2 saucisses', 'meat', 'meat_fish'],
  ['merguez', 'Merguez sausage', 'Merguez', 300, 15.0, 2.0, 26.0, 100, '2 sausages', '2 merguez', 'meat', 'meat_fish'],
  ['lamb_cooked', 'Lamb, cooked', 'Agneau cuit', 258, 25.5, 0, 16.5, 130, '1 portion', '1 portion', 'meat', 'meat_fish'],
  ['duck_breast_cooked', 'Duck breast, cooked', 'Magret de canard cuit', 201, 23.5, 0, 11.2, 150, '1/2 breast', '1/2 magret', 'meat', 'meat_fish'],
  ['salmon_cooked', 'Salmon, cooked', 'Saumon cuit', 206, 22.1, 0, 12.4, 130, '1 fillet', '1 pavé', 'fish', 'meat_fish'],
  ['smoked_salmon', 'Smoked salmon', 'Saumon fumé', 117, 18.3, 0, 4.3, 50, '2 slices', '2 tranches', 'fish', 'meat_fish'],
  ['tuna_canned_water', 'Tuna, canned in water', 'Thon au naturel', 116, 25.5, 0, 0.8, 100, '1 can', '1 boîte', 'fish', 'pantry'],
  ['cod_cooked', 'Cod, cooked', 'Cabillaud cuit', 105, 22.8, 0, 0.9, 150, '1 fillet', '1 filet', 'fish', 'meat_fish'],
  ['sardines_canned', 'Sardines in oil, drained', 'Sardines à l’huile égouttées', 208, 24.6, 0, 11.5, 90, '1 can', '1 boîte', 'fish', 'pantry'],
  ['mackerel_cooked', 'Mackerel, cooked', 'Maquereau cuit', 262, 23.9, 0, 17.8, 120, '1 fillet', '1 filet', 'fish', 'meat_fish'],
  ['shrimp_cooked', 'Shrimp, cooked', 'Crevettes cuites', 99, 24.0, 0.2, 0.3, 100, '1 portion', '1 portion', 'fish', 'meat_fish'],
  ['mussels_cooked', 'Mussels, cooked', 'Moules cuites', 172, 23.8, 7.4, 4.5, 150, '1 bowl (meat)', '1 bol (chair)', 'fish', 'meat_fish'],
  ['egg', 'Egg, whole', 'Œuf entier', 143, 12.6, 0.7, 9.5, 50, '1 egg', '1 œuf', 'meat', 'dairy_eggs'],
  ['egg_boiled', 'Egg, hard-boiled', 'Œuf dur', 155, 12.6, 1.1, 10.6, 50, '1 egg', '1 œuf', 'meat', 'dairy_eggs'],
  ['tofu_firm', 'Tofu, firm', 'Tofu ferme', 144, 17.3, 2.8, 8.7, 125, '1/2 block', '1/2 bloc', 'meat', 'dairy_eggs'],
  ['tempeh', 'Tempeh', 'Tempeh', 192, 20.3, 7.6, 10.8, 100, '1 portion', '1 portion', 'meat', 'dairy_eggs'],
  ['lentils_cooked', 'Lentils, cooked', 'Lentilles cuites', 116, 9.0, 20.1, 0.4, 180, '1 cup', '1 bol', 'veg', 'pantry'],
  ['chickpeas_cooked', 'Chickpeas, cooked', 'Pois chiches cuits', 164, 8.9, 27.4, 2.6, 160, '1 cup', '1 bol', 'veg', 'pantry'],
  ['black_beans_cooked', 'Black beans, cooked', 'Haricots noirs cuits', 132, 8.9, 23.7, 0.5, 170, '1 cup', '1 bol', 'veg', 'pantry'],
  ['kidney_beans_cooked', 'Kidney beans, cooked', 'Haricots rouges cuits', 127, 8.7, 22.8, 0.5, 170, '1 cup', '1 bol', 'veg', 'pantry'],
  ['white_beans_cooked', 'White beans, cooked', 'Haricots blancs cuits', 139, 9.7, 25.1, 0.4, 170, '1 cup', '1 bol', 'veg', 'pantry'],
  ['edamame', 'Edamame', 'Edamame', 121, 11.9, 8.9, 5.2, 100, '1 bowl', '1 bol', 'veg', 'frozen'],
  ['hummus', 'Hummus', 'Houmous', 166, 7.9, 14.3, 9.6, 50, '3 tbsp', '3 c. à s.', 'sauce', 'dairy_eggs'],
  // Dairy
  ['milk_semi', 'Milk, 2 %', 'Lait demi-écrémé', 50, 3.3, 4.8, 2.0, 250, '1 glass', '1 verre', 'drink', 'dairy_eggs'],
  ['milk_whole', 'Milk, whole', 'Lait entier', 61, 3.2, 4.8, 3.3, 250, '1 glass', '1 verre', 'drink', 'dairy_eggs'],
  ['soy_drink', 'Soy drink', 'Boisson au soja', 43, 3.3, 2.9, 1.8, 250, '1 glass', '1 verre', 'drink', 'dairy_eggs'],
  ['oat_drink', 'Oat drink', 'Boisson à l’avoine', 46, 1.0, 6.7, 1.5, 250, '1 glass', '1 verre', 'drink', 'dairy_eggs'],
  ['greek_yogurt', 'Greek yogurt, plain 2 %', 'Yaourt grec nature', 73, 9.9, 3.9, 2.0, 170, '1 pot', '1 pot', 'other', 'dairy_eggs'],
  ['yogurt_plain', 'Yogurt, plain', 'Yaourt nature', 61, 3.5, 4.7, 3.3, 125, '1 pot', '1 pot', 'other', 'dairy_eggs'],
  ['fromage_blanc', 'Fromage blanc 3 %', 'Fromage blanc 3 %', 75, 7.5, 4.0, 3.0, 100, '1 pot', '1 pot', 'cheese', 'dairy_eggs'],
  ['skyr', 'Skyr', 'Skyr', 63, 11.0, 4.0, 0.2, 150, '1 pot', '1 pot', 'other', 'dairy_eggs'],
  ['cottage_cheese', 'Cottage cheese', 'Cottage cheese', 98, 11.1, 3.4, 4.3, 100, '1/2 cup', '1/2 pot', 'cheese', 'dairy_eggs'],
  ['cheddar', 'Cheddar', 'Cheddar', 403, 24.9, 1.3, 33.1, 30, '1 slice', '1 tranche', 'cheese', 'dairy_eggs'],
  ['comte', 'Comté / Gruyère', 'Comté / Gruyère', 413, 29.8, 0.4, 32.3, 30, '1 piece', '1 morceau', 'cheese', 'dairy_eggs'],
  ['emmental', 'Emmental (Swiss)', 'Emmental', 380, 27.0, 1.5, 29.0, 30, '1 slice', '1 tranche', 'cheese', 'dairy_eggs'],
  ['camembert', 'Camembert', 'Camembert', 300, 19.8, 0.5, 24.3, 30, '1 wedge', '1 portion', 'cheese', 'dairy_eggs'],
  ['brie', 'Brie', 'Brie', 334, 20.8, 0.5, 27.7, 30, '1 wedge', '1 portion', 'cheese', 'dairy_eggs'],
  ['goat_cheese', 'Goat cheese, soft', 'Fromage de chèvre frais', 264, 18.5, 0.9, 21.1, 30, '1 piece', '1 morceau', 'cheese', 'dairy_eggs'],
  ['mozzarella', 'Mozzarella', 'Mozzarella', 280, 27.5, 3.1, 17.1, 60, '1/2 ball', '1/2 boule', 'cheese', 'dairy_eggs'],
  ['feta', 'Feta', 'Feta', 264, 14.2, 4.1, 21.3, 40, '1 piece', '1 morceau', 'cheese', 'dairy_eggs'],
  ['parmesan', 'Parmesan', 'Parmesan', 431, 38.5, 4.1, 28.6, 10, '1 tbsp grated', '1 c. à s. râpé', 'cheese', 'dairy_eggs'],
  ['butter', 'Butter', 'Beurre', 717, 0.9, 0.1, 81.1, 10, '1 pat', '1 noisette', 'sauce', 'dairy_eggs'],
  ['creme_fraiche', 'Crème fraîche', 'Crème fraîche', 292, 2.4, 2.8, 30.0, 30, '2 tbsp', '2 c. à s.', 'sauce', 'dairy_eggs'],
  ['cream_cheese', 'Cream cheese', 'Fromage à tartiner', 342, 5.9, 4.1, 34.2, 30, '2 tbsp', '2 c. à s.', 'cheese', 'dairy_eggs'],
  // Vegetables
  ['lettuce', 'Lettuce', 'Salade verte', 15, 1.4, 2.9, 0.2, 50, '1 bowl', '1 bol', 'veg', 'produce'],
  ['spinach', 'Spinach', 'Épinards', 23, 2.9, 3.6, 0.4, 80, '2 handfuls', '2 poignées', 'veg', 'produce'],
  ['tomato', 'Tomato', 'Tomate', 18, 0.9, 3.9, 0.2, 120, '1 tomato', '1 tomate', 'veg', 'produce'],
  ['cherry_tomato', 'Cherry tomatoes', 'Tomates cerises', 18, 0.9, 3.9, 0.2, 100, '1 handful', '1 poignée', 'veg', 'produce'],
  ['cucumber', 'Cucumber', 'Concombre', 15, 0.7, 3.6, 0.1, 100, '1/3 cucumber', '1/3 de concombre', 'veg', 'produce'],
  ['carrot', 'Carrot', 'Carotte', 41, 0.9, 9.6, 0.2, 80, '1 carrot', '1 carotte', 'veg', 'produce'],
  ['broccoli', 'Broccoli', 'Brocoli', 34, 2.8, 6.6, 0.4, 100, '1 cup', '1 bol', 'veg', 'produce'],
  ['cauliflower', 'Cauliflower', 'Chou-fleur', 25, 1.9, 5.0, 0.3, 100, '1 cup', '1 bol', 'veg', 'produce'],
  ['zucchini', 'Zucchini', 'Courgette', 17, 1.2, 3.1, 0.3, 150, '1 zucchini', '1 courgette', 'veg', 'produce'],
  ['eggplant', 'Eggplant', 'Aubergine', 25, 1.0, 5.9, 0.2, 150, '1/2 eggplant', '1/2 aubergine', 'veg', 'produce'],
  ['bell_pepper', 'Bell pepper', 'Poivron', 26, 1.0, 6.0, 0.3, 120, '1 pepper', '1 poivron', 'veg', 'produce'],
  ['onion', 'Onion', 'Oignon', 40, 1.1, 9.3, 0.1, 80, '1 onion', '1 oignon', 'veg', 'produce'],
  ['garlic', 'Garlic', 'Ail', 149, 6.4, 33.1, 0.5, 5, '1 clove', '1 gousse', 'veg', 'produce'],
  ['mushroom', 'Mushrooms', 'Champignons', 22, 3.1, 3.3, 0.3, 100, '1 cup', '1 bol', 'veg', 'produce'],
  ['green_beans', 'Green beans', 'Haricots verts', 31, 1.8, 7.0, 0.2, 120, '1 portion', '1 portion', 'veg', 'produce'],
  ['peas', 'Green peas', 'Petits pois', 81, 5.4, 14.5, 0.4, 100, '1 portion', '1 portion', 'veg', 'frozen'],
  ['sweetcorn', 'Sweet corn', 'Maïs doux', 86, 3.3, 18.7, 1.4, 80, '1/2 can', '1/2 boîte', 'veg', 'pantry'],
  ['leek', 'Leek', 'Poireau', 61, 1.5, 14.2, 0.3, 100, '1 leek', '1 poireau', 'veg', 'produce'],
  ['cabbage', 'Cabbage', 'Chou', 25, 1.3, 5.8, 0.1, 100, '1 cup', '1 bol', 'veg', 'produce'],
  ['kale', 'Kale', 'Chou kale', 49, 4.3, 8.8, 0.9, 60, '1 cup', '1 bol', 'veg', 'produce'],
  ['avocado', 'Avocado', 'Avocat', 160, 2.0, 8.5, 14.7, 100, '1/2 avocado', '1/2 avocat', 'veg', 'produce'],
  ['butternut', 'Butternut squash', 'Courge butternut', 45, 1.0, 11.7, 0.1, 150, '1 portion', '1 portion', 'veg', 'produce'],
  ['pumpkin', 'Pumpkin', 'Potiron', 26, 1.0, 6.5, 0.1, 150, '1 portion', '1 portion', 'veg', 'produce'],
  ['beetroot', 'Beetroot, cooked', 'Betterave cuite', 44, 1.7, 10.0, 0.2, 100, '1 beet', '1 betterave', 'veg', 'produce'],
  ['celeriac', 'Celeriac', 'Céleri-rave', 42, 1.5, 9.2, 0.3, 100, '1 portion', '1 portion', 'veg', 'produce'],
  ['asparagus', 'Asparagus', 'Asperges', 20, 2.2, 3.9, 0.1, 100, '5 spears', '5 asperges', 'veg', 'produce'],
  ['radish', 'Radishes', 'Radis', 16, 0.7, 3.4, 0.1, 50, '1 handful', '1 poignée', 'veg', 'produce'],
  ['frozen_veg_mix', 'Frozen mixed vegetables', 'Mélange de légumes surgelés', 65, 2.9, 13.1, 0.5, 150, '1 portion', '1 portion', 'veg', 'frozen'],
  ['ratatouille', 'Ratatouille', 'Ratatouille', 60, 1.2, 6.5, 3.2, 200, '1 portion', '1 portion', 'veg', 'pantry'],
  ['vegetable_soup', 'Vegetable soup', 'Soupe de légumes', 35, 1.2, 6.0, 0.8, 300, '1 bowl', '1 bol', 'veg', 'pantry'],
  // Fruit
  ['apple', 'Apple', 'Pomme', 52, 0.3, 13.8, 0.2, 180, '1 apple', '1 pomme', 'fruit', 'produce'],
  ['banana', 'Banana', 'Banane', 89, 1.1, 22.8, 0.3, 120, '1 banana', '1 banane', 'fruit', 'produce'],
  ['orange', 'Orange', 'Orange', 47, 0.9, 11.8, 0.1, 150, '1 orange', '1 orange', 'fruit', 'produce'],
  ['clementine', 'Clementine', 'Clémentine', 47, 0.9, 12.0, 0.2, 75, '1 clementine', '1 clémentine', 'fruit', 'produce'],
  ['pear', 'Pear', 'Poire', 57, 0.4, 15.2, 0.1, 170, '1 pear', '1 poire', 'fruit', 'produce'],
  ['strawberries', 'Strawberries', 'Fraises', 32, 0.7, 7.7, 0.3, 150, '1 cup', '1 barquette (1/2)', 'fruit', 'produce'],
  ['blueberries', 'Blueberries', 'Myrtilles', 57, 0.7, 14.5, 0.3, 100, '2/3 cup', '1 barquette', 'fruit', 'produce'],
  ['raspberries', 'Raspberries', 'Framboises', 52, 1.2, 11.9, 0.7, 100, '1 cup', '1 barquette', 'fruit', 'produce'],
  ['grapes', 'Grapes', 'Raisin', 69, 0.7, 18.1, 0.2, 120, '1 bunch', '1 grappe', 'fruit', 'produce'],
  ['kiwi', 'Kiwi', 'Kiwi', 61, 1.1, 14.7, 0.5, 75, '1 kiwi', '1 kiwi', 'fruit', 'produce'],
  ['mango', 'Mango', 'Mangue', 60, 0.8, 15.0, 0.4, 150, '1/2 mango', '1/2 mangue', 'fruit', 'produce'],
  ['pineapple', 'Pineapple', 'Ananas', 50, 0.5, 13.1, 0.1, 150, '2 slices', '2 tranches', 'fruit', 'produce'],
  ['peach', 'Peach', 'Pêche', 39, 0.9, 9.5, 0.3, 150, '1 peach', '1 pêche', 'fruit', 'produce'],
  ['melon', 'Melon (cantaloupe)', 'Melon', 34, 0.8, 8.2, 0.2, 200, '1/4 melon', '1/4 de melon', 'fruit', 'produce'],
  ['watermelon', 'Watermelon', 'Pastèque', 30, 0.6, 7.6, 0.2, 250, '1 slice', '1 tranche', 'fruit', 'produce'],
  ['dates', 'Dates, dried', 'Dattes', 282, 2.5, 75.0, 0.4, 30, '3 dates', '3 dattes', 'fruit', 'pantry'],
  ['raisins', 'Raisins', 'Raisins secs', 299, 3.1, 79.2, 0.5, 30, '1 small box', '1 petite poignée', 'fruit', 'pantry'],
  ['dried_apricots', 'Dried apricots', 'Abricots secs', 241, 3.4, 62.6, 0.5, 30, '4 apricots', '4 abricots', 'fruit', 'pantry'],
  ['frozen_berries', 'Frozen mixed berries', 'Fruits rouges surgelés', 50, 0.8, 12.0, 0.3, 100, '1 cup', '1 bol', 'fruit', 'frozen'],
  ['apple_compote', 'Apple sauce, unsweetened', 'Compote de pomme sans sucre ajouté', 42, 0.2, 11.3, 0.1, 100, '1 pot', '1 pot', 'fruit', 'pantry'],
  // Nuts, seeds, fats
  ['almonds', 'Almonds', 'Amandes', 579, 21.2, 21.6, 49.9, 30, '1 handful', '1 poignée', 'other', 'pantry'],
  ['walnuts', 'Walnuts', 'Noix', 654, 15.2, 13.7, 65.2, 30, '1 handful', '1 poignée', 'other', 'pantry'],
  ['hazelnuts', 'Hazelnuts', 'Noisettes', 628, 15.0, 16.7, 60.8, 30, '1 handful', '1 poignée', 'other', 'pantry'],
  ['cashews', 'Cashews', 'Noix de cajou', 553, 18.2, 30.2, 43.9, 30, '1 handful', '1 poignée', 'other', 'pantry'],
  ['peanuts', 'Peanuts', 'Cacahuètes', 567, 25.8, 16.1, 49.2, 30, '1 handful', '1 poignée', 'other', 'pantry'],
  ['peanut_butter', 'Peanut butter', 'Beurre de cacahuète', 588, 25.1, 20.0, 50.4, 16, '1 tbsp', '1 c. à s.', 'sauce', 'pantry'],
  ['chia_seeds', 'Chia seeds', 'Graines de chia', 486, 16.5, 42.1, 30.7, 15, '1 tbsp', '1 c. à s.', 'other', 'pantry'],
  ['pumpkin_seeds', 'Pumpkin seeds', 'Graines de courge', 559, 30.2, 10.7, 49.1, 15, '1 tbsp', '1 c. à s.', 'other', 'pantry'],
  ['olive_oil', 'Olive oil', 'Huile d’olive', 884, 0, 0, 100, 10, '1 tbsp', '1 c. à s.', 'sauce', 'pantry'],
  ['rapeseed_oil', 'Canola (rapeseed) oil', 'Huile de colza', 884, 0, 0, 100, 10, '1 tbsp', '1 c. à s.', 'sauce', 'pantry'],
  // Sauces, spreads, sweets
  ['mayonnaise', 'Mayonnaise', 'Mayonnaise', 680, 1.0, 0.6, 75.0, 15, '1 tbsp', '1 c. à s.', 'sauce', 'spices_sauces'],
  ['ketchup', 'Ketchup', 'Ketchup', 101, 1.0, 27.4, 0.1, 15, '1 tbsp', '1 c. à s.', 'sauce', 'spices_sauces'],
  ['vinaigrette', 'Vinaigrette', 'Vinaigrette', 449, 0.2, 5.0, 48.0, 15, '1 tbsp', '1 c. à s.', 'sauce', 'spices_sauces'],
  ['pesto', 'Pesto', 'Pesto', 418, 5.0, 6.0, 42.0, 20, '1 tbsp', '1 c. à s.', 'sauce', 'spices_sauces'],
  ['tomato_sauce', 'Tomato sauce', 'Sauce tomate', 29, 1.3, 5.3, 0.2, 100, '1/2 cup', '1/2 bol', 'sauce', 'pantry'],
  ['soy_sauce', 'Soy sauce', 'Sauce soja', 53, 8.1, 4.9, 0.6, 15, '1 tbsp', '1 c. à s.', 'sauce', 'spices_sauces'],
  ['honey', 'Honey', 'Miel', 304, 0.3, 82.4, 0, 20, '1 tbsp', '1 c. à s.', 'sauce', 'pantry'],
  ['jam', 'Jam', 'Confiture', 278, 0.4, 68.9, 0.1, 20, '1 tbsp', '1 c. à s.', 'sauce', 'pantry'],
  ['hazelnut_spread', 'Chocolate hazelnut spread', 'Pâte à tartiner chocolat-noisette', 539, 6.3, 57.5, 30.9, 20, '1 tbsp', '1 c. à s.', 'dessert', 'pantry'],
  ['dark_chocolate', 'Dark chocolate 70 %', 'Chocolat noir 70 %', 598, 7.8, 45.9, 42.6, 20, '2 squares', '2 carrés', 'dessert', 'pantry'],
  ['milk_chocolate', 'Milk chocolate', 'Chocolat au lait', 535, 7.7, 59.4, 29.7, 20, '2 squares', '2 carrés', 'dessert', 'pantry'],
  ['ice_cream', 'Ice cream, vanilla', 'Glace vanille', 207, 3.5, 23.6, 11.0, 70, '1 scoop', '1 boule', 'dessert', 'frozen'],
  ['cookie', 'Chocolate chip cookie', 'Cookie aux pépites', 488, 5.4, 64.3, 24.0, 25, '1 cookie', '1 cookie', 'dessert', 'pantry'],
  ['muffin', 'Muffin', 'Muffin', 377, 5.4, 54.0, 16.0, 110, '1 muffin', '1 muffin', 'dessert', 'bakery'],
  ['flan', 'Custard flan', 'Flan pâtissier', 230, 5.0, 33.0, 9.0, 100, '1 slice', '1 part', 'dessert', 'bakery'],
  ['cereal_bar', 'Cereal bar', 'Barre de céréales', 400, 6.0, 70.0, 11.0, 25, '1 bar', '1 barre', 'dessert', 'pantry'],
  ['energy_gel', 'Energy gel', 'Gel énergétique', 250, 0, 63.0, 0, 40, '1 gel', '1 gel', 'drink', 'pantry'],
  // Drinks
  ['orange_juice', 'Orange juice', 'Jus d’orange', 45, 0.7, 10.4, 0.2, 200, '1 glass', '1 verre', 'drink', 'drinks'],
  ['apple_juice', 'Apple juice', 'Jus de pomme', 46, 0.1, 11.3, 0.1, 200, '1 glass', '1 verre', 'drink', 'drinks'],
  ['cola', 'Cola', 'Soda au cola', 42, 0, 10.6, 0, 330, '1 can', '1 canette', 'drink', 'drinks'],
  ['coffee_black', 'Coffee, black', 'Café noir', 1, 0.1, 0, 0, 150, '1 cup', '1 tasse', 'drink', 'drinks'],
  ['cappuccino', 'Cappuccino', 'Cappuccino', 40, 2.2, 3.4, 1.9, 240, '1 cup', '1 tasse', 'drink', 'drinks'],
  ['tea', 'Tea, unsweetened', 'Thé sans sucre', 1, 0, 0.3, 0, 250, '1 cup', '1 tasse', 'drink', 'drinks'],
  ['sports_drink', 'Sports drink', 'Boisson de l’effort', 26, 0, 6.4, 0, 500, '1 bottle', '1 bidon', 'drink', 'drinks'],
  ['beer', 'Beer', 'Bière', 43, 0.5, 3.6, 0, 330, '1 bottle', '1 bouteille', 'drink', 'drinks'],
  ['wine_red', 'Red wine', 'Vin rouge', 85, 0.1, 2.6, 0, 150, '1 glass', '1 verre', 'drink', 'drinks'],
  ['smoothie', 'Fruit smoothie', 'Smoothie aux fruits', 55, 0.6, 13.0, 0.2, 250, '1 glass', '1 verre', 'drink', 'drinks'],
  ['protein_shake', 'Whey protein powder', 'Protéine en poudre (whey)', 380, 78.0, 8.0, 5.0, 30, '1 scoop', '1 dose', 'drink', 'pantry'],
  // Ready dishes (common estimates)
  ['quiche_lorraine', 'Quiche lorraine', 'Quiche lorraine', 270, 10.0, 18.0, 18.0, 150, '1 slice', '1 part', 'bread', 'bakery'],
  ['croque_monsieur', 'Croque-monsieur', 'Croque-monsieur', 260, 14.0, 22.0, 13.0, 150, '1 sandwich', '1 croque', 'bread', 'bakery'],
  ['ham_butter_sandwich', 'Ham & butter baguette sandwich', 'Jambon-beurre', 260, 12.0, 32.0, 9.0, 220, '1 sandwich', '1 sandwich', 'bread', 'bakery'],
  ['burger', 'Cheeseburger', 'Cheeseburger', 263, 13.0, 25.0, 12.0, 200, '1 burger', '1 burger', 'meat', 'other'],
  ['sushi', 'Sushi (salmon nigiri / maki)', 'Sushis (saumon)', 150, 6.0, 25.0, 2.5, 200, '8 pieces', '8 pièces', 'rice', 'other'],
  ['lasagna', 'Beef lasagna', 'Lasagnes à la bolognaise', 135, 8.0, 12.0, 6.0, 300, '1 portion', '1 portion', 'pasta', 'frozen'],
  ['spaghetti_bolognese', 'Spaghetti bolognese', 'Spaghetti bolognaise', 135, 7.0, 17.0, 4.0, 350, '1 plate', '1 assiette', 'pasta', 'other'],
  ['chili_con_carne', 'Chili con carne', 'Chili con carne', 105, 8.0, 9.0, 4.0, 300, '1 bowl', '1 bol', 'meat', 'other'],
  ['caesar_salad', 'Chicken caesar salad', 'Salade César au poulet', 127, 9.0, 6.0, 7.5, 300, '1 bowl', '1 saladier', 'veg', 'other'],
  ['falafel', 'Falafel', 'Falafels', 333, 13.3, 31.8, 17.8, 100, '4 balls', '4 boulettes', 'veg', 'other'],
  ['omelette', 'Plain omelette', 'Omelette nature', 154, 10.6, 0.6, 11.7, 120, '2 eggs', '2 œufs', 'meat', 'dairy_eggs'],
  ['pancakes', 'Pancakes', 'Pancakes', 227, 6.4, 28.3, 9.7, 120, '2 pancakes', '2 pancakes', 'dessert', 'bakery'],
];

export const FOOD_TABLE: readonly FoodRow[] = ROWS.map(([id, en, fr, kcal, proteinG, carbsG, fatG, portionG, pe, pf, family, aisle]) => ({
  id,
  en,
  fr,
  kcal,
  proteinG,
  carbsG,
  fatG,
  portionG,
  portion: { en: pe, fr: pf },
  family,
  aisle,
}));

export const foodById = (id: string): FoodRow | undefined => FOOD_TABLE.find((f) => f.id === id);

/**
 * Foods matching a query in a language (folded, plurals ignored): names starting with the query first, then whole-word
 * matches, then substrings; the other language's name counts too. Pure.
 */
export function searchFoods(q: string, lang: "en" | "fr", limit = 10): FoodRow[] {
  const query = foldFood(q);
  if (!query) return [];
  const qWords = foodWords(q);
  const scored: { f: FoodRow; s: number }[] = [];
  for (const f of FOOD_TABLE) {
    const own = foldFood(lang === "fr" ? f.fr : f.en);
    const other = foldFood(lang === "fr" ? f.en : f.fr);
    const ownWords = foodWords(lang === "fr" ? f.fr : f.en);
    let s = 0;
    if (own.startsWith(query)) s = 100;
    else if (qWords.every((w) => ownWords.includes(w))) s = 80;
    else if (own.includes(query)) s = 60;
    else if (other.startsWith(query)) s = 40;
    else if (other.includes(query)) s = 20;
    if (s) scored.push({ f, s: s - own.length / 100 });
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(1, limit))
    .map((x) => x.f);
}

/** A table food as a meal item at a weight (portion by default), confidence 0.9 (the athlete picked it). Pure. */
export function foodItem(f: FoodRow, lang: "en" | "fr", grams = f.portionG) {
  const k = grams / 100;
  return {
    name: lang === "fr" ? f.fr : f.en,
    grams: Math.round(grams),
    kcal: Math.round(f.kcal * k),
    proteinG: Math.round(f.proteinG * k * 10) / 10,
    carbsG: Math.round(f.carbsG * k * 10) / 10,
    fatG: Math.round(f.fatG * k * 10) / 10,
    confidence: 0.9,
    family: f.family,
  };
}
