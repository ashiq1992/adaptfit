import type { Allergen, Cuisine, MealSlot } from '../domain/types';
import { type Contains, INGREDIENTS_BY_ID } from './ingredients';

/**
 * AdaptFit Fuel meal catalogue (V0.3): a small, curated, local-first list of
 * common Singapore meals. Written for AdaptFit; no third-party nutrition
 * database is copied.
 *
 * - Home recipes list quantified ingredients. Nutrition is computed only from
 *   ingredients with a retrieved FoodData Central record; anything else is
 *   reported as not included.
 * - Eating-out dishes vary by stall, and no licensed per-dish dataset is
 *   bundled, so they show "Nutrition estimate unavailable".
 * - No stall names, prices, opening hours, or halal certifications are stated.
 */

export interface RecipeIngredient {
  ingredientId: string;
  grams: number;
  /** Shown to the user, e.g. "2 eggs". */
  label: string;
}

interface MealBase {
  id: string;
  name: string;
  cuisine: Cuisine;
  slots: MealSlot[];
  /** Rough relative cost category; AdaptFit doesn't know current prices. */
  costBand: 'low' | 'medium' | 'high';
  contains: Contains[];
  allergens: Allergen[];
  /** Contents vary a lot between stalls or choices. */
  variable?: boolean;
  /** Typical serving description. */
  portion: string;
}

export interface HomeMeal extends MealBase {
  kind: 'home';
  ingredients: RecipeIngredient[];
  /** Small amounts not counted in nutrition (salt, pepper, herbs, a dash of sauce). */
  seasonings: string[];
  steps: string[];
  cookMinutes: number;
  substitutions: string[];
}

export interface OutMeal extends MealBase {
  kind: 'out';
  proteinAdditions: string[];
  modifications: string[];
  notes: string[];
}

export type Meal = HomeMeal | OutMeal;

const R = (ingredientId: string, grams: number, label: string): RecipeIngredient => ({ ingredientId, grams, label });

/** Derive dietary metadata for a home recipe from its ingredients. */
function home(m: Omit<HomeMeal, 'kind' | 'contains' | 'allergens'> & { extraAllergens?: Allergen[] }): HomeMeal {
  const ings = m.ingredients.map((i) => INGREDIENTS_BY_ID.get(i.ingredientId)!);
  const contains = [...new Set(ings.flatMap((i) => i.contains))];
  const allergens = [...new Set([...ings.flatMap((i) => i.allergens), ...(m.extraAllergens ?? [])])];
  const rest: Omit<HomeMeal, 'kind' | 'contains' | 'allergens'> & { extraAllergens?: Allergen[] } = { ...m };
  delete rest.extraAllergens;
  return { ...rest, kind: 'home', contains, allergens };
}

const out = (m: Omit<OutMeal, 'kind'>): OutMeal => ({ ...m, kind: 'out' });

export const MEALS: readonly Meal[] = [
  // ── Home-cooked ─────────────────────────────────────────────────
  home({
    id: 'h-chicken-rice-bowl', name: 'Ginger chicken rice bowl with greens', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 bowl',
    ingredients: [R('chicken-breast', 150, '150 g chicken breast'), R('rice-white', 200, '200 g cooked rice (about 1 cup)'), R('leafy-greens', 100, '100 g bok choy or kai lan'), R('cooking-oil', 5, '1 tsp oil')],
    seasonings: ['ginger', 'garlic', 'a dash of light soy sauce'], extraAllergens: ['soy', 'gluten'], cookMinutes: 20,
    steps: ['Slice the chicken and season with ginger, garlic, and a little soy sauce.', 'Stir-fry in the oil for 6–8 minutes until cooked through.', 'Blanch the greens for 1–2 minutes.', 'Serve over rice.'],
    substitutions: ['Firm tofu instead of chicken (vegetarian)', 'Brown rice instead of white rice', 'Tamari for a gluten-free soy sauce'],
  }),
  home({
    id: 'h-steamed-fish', name: 'Steamed fish with ginger, rice, and vegetables', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 plate',
    ingredients: [R('white-fish', 180, '180 g white fish fillet'), R('rice-white', 180, '180 g cooked rice'), R('leafy-greens', 100, '100 g leafy greens')],
    seasonings: ['ginger', 'spring onion', 'a dash of light soy sauce'], extraAllergens: ['soy', 'gluten'], cookMinutes: 20,
    steps: ['Place the fish on a plate with sliced ginger.', 'Steam for 8–10 minutes until it flakes easily.', 'Top with spring onion and a little soy sauce.', 'Serve with rice and blanched greens.'],
    substitutions: ['Salmon instead of white fish', 'Brown rice instead of white rice'],
  }),
  home({
    id: 'h-tofu-egg-stirfry', name: 'Tofu and egg stir-fry with brown rice', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate',
    ingredients: [R('tofu-firm', 150, '150 g firm tofu'), R('egg', 100, '2 eggs'), R('rice-brown', 180, '180 g cooked brown rice'), R('broccoli', 100, '100 g broccoli'), R('cooking-oil', 5, '1 tsp oil')],
    seasonings: ['garlic', 'a dash of soy sauce'], extraAllergens: ['gluten'], cookMinutes: 15,
    steps: ['Cube the tofu and pan-fry in the oil until golden.', 'Add broccoli and a splash of water; cover for 3 minutes.', 'Push aside, scramble the eggs, then combine.', 'Season and serve with brown rice.'],
    substitutions: ['Leave out the eggs and add more tofu (vegan)', 'White rice instead of brown rice'],
  }),
  home({
    id: 'h-prawn-egg-fried-rice', name: 'Prawn and egg fried rice', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 plate',
    ingredients: [R('prawns', 120, '120 g prawns'), R('egg', 100, '2 eggs'), R('rice-white', 200, '200 g cooked rice (day-old works best)'), R('mixed-veg', 80, '80 g mixed vegetables'), R('cooking-oil', 10, '2 tsp oil')],
    seasonings: ['garlic', 'white pepper', 'a dash of soy sauce'], extraAllergens: ['soy', 'gluten'], cookMinutes: 15,
    steps: ['Cook the prawns in half the oil; set aside.', 'Scramble the eggs, then add rice and vegetables.', 'Stir-fry on high heat for 3–4 minutes.', 'Return the prawns, season, and serve.'],
    substitutions: ['Chicken breast instead of prawns (shellfish allergy)', 'Tofu instead of prawns (vegetarian)'],
  }),
  home({
    id: 'h-ayam-kicap', name: 'Ayam masak kicap-style chicken with rice', cuisine: 'malay', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate',
    ingredients: [R('chicken-thigh', 180, '180 g chicken thigh'), R('rice-white', 180, '180 g cooked rice'), R('kicap-manis', 20, '1 tbsp kicap manis'), R('leafy-greens', 100, '100 g greens'), R('cooking-oil', 5, '1 tsp oil')],
    seasonings: ['shallots', 'garlic', 'chilli', 'star anise'], cookMinutes: 30,
    steps: ['Brown the chicken in the oil with shallots and garlic.', 'Add kicap manis, chilli, star anise, and a little water.', 'Simmer 15–20 minutes until cooked and glossy.', 'Serve with rice and greens.'],
    substitutions: ['Chicken breast for a leaner version', 'Use halal-certified chicken if you need halal'],
  }),
  home({
    id: 'h-chicken-dhal', name: 'Chicken curry with dhal and rice', cuisine: 'indian', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate',
    ingredients: [R('chicken-thigh', 150, '150 g chicken thigh'), R('lentils', 150, '150 g cooked lentils'), R('rice-white', 150, '150 g cooked rice'), R('tomatoes', 80, '1 tomato'), R('curry-paste', 15, '1 tbsp curry spices'), R('cooking-oil', 10, '2 tsp oil')],
    seasonings: ['onion', 'garlic', 'ginger'], cookMinutes: 40,
    steps: ['Fry onion, garlic, ginger, and curry spices in the oil.', 'Add chicken and tomato; cook 5 minutes.', 'Add water and simmer 20 minutes.', 'Warm the lentils separately with a little cumin and serve with rice.'],
    substitutions: ['Chickpeas instead of chicken (vegetarian)', 'Use halal-certified chicken if you need halal'],
  }),
  home({
    id: 'h-salmon-teriyaki', name: 'Salmon teriyaki rice bowl', cuisine: 'japanese', slots: ['lunch', 'dinner'], costBand: 'high', portion: '1 bowl',
    ingredients: [R('salmon', 150, '150 g salmon'), R('rice-white', 180, '180 g cooked rice'), R('broccoli', 100, '100 g broccoli'), R('teriyaki-sauce', 20, '1 tbsp teriyaki sauce')],
    seasonings: ['sesame seeds (optional)'], cookMinutes: 20,
    steps: ['Pan-sear the salmon skin-side down for 4 minutes, flip, cook 2–3 more.', 'Brush with teriyaki sauce for the last minute.', 'Steam the broccoli.', 'Serve over rice.'],
    substitutions: ['White fish instead of salmon', 'Tamari-based sauce for gluten-free'],
  }),
  home({
    id: 'h-tofu-bibimbap', name: 'Tofu bibimbap-style bowl', cuisine: 'korean', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 bowl',
    ingredients: [R('tofu-firm', 150, '150 g firm tofu'), R('egg', 50, '1 egg'), R('rice-white', 180, '180 g cooked rice'), R('leafy-greens', 80, '80 g spinach'), R('mixed-veg', 80, '80 g carrots and bean sprouts'), R('gochujang', 15, '1 tbsp gochujang'), R('sesame-oil', 5, '1 tsp sesame oil')],
    seasonings: ['garlic'], cookMinutes: 25,
    steps: ['Pan-fry the tofu until golden.', 'Blanch the vegetables separately and season lightly.', 'Fry the egg.', 'Arrange over rice; add gochujang and sesame oil.'],
    substitutions: ['Leave out the egg (vegan)', 'Chicken breast instead of tofu'],
  }),
  home({
    id: 'h-thai-basil-chicken', name: 'Thai basil chicken with rice and egg', cuisine: 'thai', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate',
    ingredients: [R('chicken-breast', 150, '150 g minced chicken breast'), R('rice-white', 200, '200 g cooked rice'), R('egg', 50, '1 egg'), R('fish-sauce', 10, '2 tsp fish sauce'), R('cooking-oil', 10, '2 tsp oil')],
    seasonings: ['Thai basil', 'garlic', 'chilli'], cookMinutes: 15,
    steps: ['Fry garlic and chilli in half the oil.', 'Add the chicken and cook through.', 'Season with fish sauce; stir in basil.', 'Fry the egg and serve on rice.'],
    substitutions: ['Tofu instead of chicken (use soy sauce instead of fish sauce for vegetarian)'],
  }),
  home({
    id: 'h-chickpea-stew', name: 'Chickpea and tomato stew with rice', cuisine: 'mediterranean', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 bowl',
    ingredients: [R('chickpeas', 200, '200 g cooked chickpeas'), R('tomatoes', 200, '200 g tomatoes'), R('rice-brown', 150, '150 g cooked brown rice'), R('olive-oil', 10, '2 tsp olive oil')],
    seasonings: ['onion', 'garlic', 'cumin', 'paprika'], cookMinutes: 30,
    steps: ['Soften onion and garlic in the olive oil.', 'Add spices, tomatoes, and chickpeas.', 'Simmer 15–20 minutes.', 'Serve with brown rice.'],
    substitutions: ['Add Greek yogurt on top for extra protein (not vegan)', 'Lentils instead of chickpeas'],
  }),
  home({
    id: 'h-overnight-oats', name: 'Overnight oats with Greek yogurt and banana', cuisine: 'western', slots: ['breakfast'], costBand: 'low', portion: '1 jar',
    ingredients: [R('oats', 50, '50 g rolled oats'), R('yogurt-greek', 150, '150 g plain Greek yogurt'), R('milk', 100, '100 ml milk'), R('banana', 100, '1 small banana')],
    seasonings: ['cinnamon'], extraAllergens: ['gluten'], cookMinutes: 5,
    steps: ['Mix oats, yogurt, and milk in a jar.', 'Refrigerate overnight.', 'Top with sliced banana in the morning.'],
    substitutions: ['Soy yogurt and soy milk (dairy-free)', 'Certified gluten-free oats if needed'],
  }),
  home({
    id: 'h-eggs-toast', name: 'Scrambled eggs on wholemeal toast', cuisine: 'western', slots: ['breakfast'], costBand: 'low', portion: '1 plate',
    ingredients: [R('egg', 150, '3 eggs'), R('wholemeal-bread', 60, '2 slices wholemeal bread'), R('tomatoes', 80, '1 tomato')],
    seasonings: ['salt', 'pepper'], cookMinutes: 10,
    steps: ['Whisk the eggs and cook gently in a non-stick pan.', 'Toast the bread.', 'Serve with sliced tomato.'],
    substitutions: ['Tofu scramble instead of eggs (vegan)'],
  }),
  home({
    id: 'h-boiled-eggs', name: 'Boiled eggs', cuisine: 'other', slots: ['snack', 'breakfast'], costBand: 'low', portion: '2 eggs',
    ingredients: [R('egg', 100, '2 eggs')],
    seasonings: ['pinch of salt'], cookMinutes: 10,
    steps: ['Boil for 8–10 minutes.', 'Cool in cold water and peel.'],
    substitutions: ['Plain Greek yogurt instead (egg allergy)'],
  }),
  home({
    id: 'h-yogurt-banana', name: 'Greek yogurt with banana', cuisine: 'other', slots: ['snack'], costBand: 'low', portion: '1 bowl',
    ingredients: [R('yogurt-greek', 170, '170 g plain Greek yogurt'), R('banana', 100, '1 small banana')],
    seasonings: [], cookMinutes: 2,
    steps: ['Slice the banana over the yogurt.'],
    substitutions: ['Soy yogurt (dairy-free)'],
  }),

  // ── Eating out ──────────────────────────────────────────────────
  out({ id: 'o-fish-soup', name: 'Sliced fish soup', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 bowl, with rice or bee hoon', contains: ['fish'], allergens: ['fish'],
    proteinAdditions: ['Extra fish slices', 'Add an egg if offered'], modifications: ['Choose clear soup rather than milk-based', 'Rice or bee hoon on the side; ask for more vegetables'], notes: ['Some stalls add evaporated milk or fried fish — ask if avoiding dairy.'] }),
  out({ id: 'o-chicken-rice', name: 'Steamed chicken rice', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate', contains: ['chicken'], allergens: ['soy', 'gluten'],
    proteinAdditions: ['Extra chicken', 'Add a braised egg'], modifications: ['Remove the skin to lower fat', 'Ask for plain rice instead of chicken-fat rice', 'Add a side of vegetables'], notes: ['Sauces usually contain soy.'] }),
  out({ id: 'o-yong-tau-foo', name: 'Yong tau foo (clear soup)', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'low', portion: '6–8 items with soup', contains: ['fish'], allergens: ['soy', 'fish', 'gluten'], variable: true,
    proteinAdditions: ['Choose tofu, fish balls, and egg-based items'], modifications: ['Pick more vegetables and fewer fried items', 'Choose clear soup over laksa gravy'], notes: ['Items vary by stall; many contain fish paste.'] }),
  out({ id: 'o-economy-rice', name: 'Economy (mixed) rice: 1 protein + 2 vegetables', cuisine: 'chinese', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate', contains: [], allergens: [], variable: true,
    proteinAdditions: ['Choose steamed fish, tofu, egg, or lean chicken as the protein'], modifications: ['Pick non-fried dishes', 'Ask for less gravy'], notes: ['Contents vary completely — check each dish for your restrictions.'] }),
  out({ id: 'o-nasi-lemak', name: 'Nasi lemak with chicken and egg', cuisine: 'malay', slots: ['breakfast', 'lunch', 'dinner'], costBand: 'low', portion: '1 plate', contains: ['chicken', 'egg', 'fish'], allergens: ['egg', 'fish', 'peanut'],
    proteinAdditions: ['Add an extra egg', 'Choose grilled or ayam bakar chicken if available'], modifications: ['Ask for less rice and sambal', 'Add cucumber'], notes: ['Usually includes ikan bilis and peanuts.'] }),
  out({ id: 'o-mee-soto', name: 'Mee soto', cuisine: 'malay', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 bowl', contains: ['chicken'], allergens: ['gluten'],
    proteinAdditions: ['Extra shredded chicken', 'Add a boiled egg'], modifications: ['Bee hoon instead of yellow noodles', 'Go easy on the fried shallots'], notes: [] }),
  out({ id: 'o-nasi-padang', name: 'Nasi padang with grilled fish or chicken', cuisine: 'malay', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 plate', contains: [], allergens: [], variable: true,
    proteinAdditions: ['Choose ikan bakar or ayam bakar as the main'], modifications: ['Add a vegetable dish', 'Ask for less gravy over the rice'], notes: ['Dishes vary — check for your restrictions.'] }),
  out({ id: 'o-chapati-dhal', name: 'Chapati with dhal and chicken curry', cuisine: 'indian', slots: ['lunch', 'dinner'], costBand: 'low', portion: '2 chapati + curries', contains: ['chicken'], allergens: ['gluten', 'dairy'],
    proteinAdditions: ['Extra dhal', 'Add an egg or tandoori chicken'], modifications: ['Chapati rather than prata', 'Choose dry over oily curries'], notes: ['Ghee may be used — ask if avoiding dairy.'] }),
  out({ id: 'o-thosai-sambar', name: 'Thosai with sambar and chutney', cuisine: 'indian', slots: ['breakfast', 'lunch'], costBand: 'low', portion: '1–2 thosai', contains: [], allergens: [], variable: true,
    proteinAdditions: ['Egg thosai', 'Extra sambar (lentils)'], modifications: ['Plain thosai rather than masala if lighter is preferred'], notes: ['Usually vegetarian; ghee or ingredients may vary by stall.'] }),
  out({ id: 'o-tandoori', name: 'Tandoori chicken with naan and salad', cuisine: 'indian', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 set', contains: ['chicken', 'dairy'], allergens: ['dairy', 'gluten'],
    proteinAdditions: ['Extra tandoori chicken', 'Raita'], modifications: ['Plain naan instead of butter or cheese naan'], notes: ['Tandoori marinade normally contains yogurt.'] }),
  out({ id: 'o-saba-set', name: 'Grilled saba (mackerel) set', cuisine: 'japanese', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 set', contains: ['fish'], allergens: ['fish', 'soy', 'gluten'],
    proteinAdditions: ['Add tamagoyaki or edamame'], modifications: ['Swap fried sides for salad or miso soup'], notes: [] }),
  out({ id: 'o-oyakodon', name: 'Oyakodon (chicken and egg rice bowl)', cuisine: 'japanese', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 bowl', contains: ['chicken', 'egg', 'alcohol'], allergens: ['egg', 'soy', 'gluten'],
    proteinAdditions: ['Extra chicken'], modifications: ['Ask for less rice', 'Add a side salad'], notes: ['Sauce may contain mirin (rice wine).'] }),
  out({ id: 'o-bibimbap', name: 'Bibimbap', cuisine: 'korean', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 bowl', contains: ['egg'], allergens: ['egg', 'soy', 'sesame', 'gluten'], variable: true,
    proteinAdditions: ['Choose beef, chicken, or tofu topping', 'Extra egg'], modifications: ['Go lighter on the gochujang if watching sugar'], notes: ['Toppings vary.'] }),
  out({ id: 'o-kra-pao', name: 'Basil chicken rice with fried egg', cuisine: 'thai', slots: ['lunch', 'dinner'], costBand: 'low', portion: '1 plate', contains: ['chicken', 'egg', 'fish'], allergens: ['egg', 'fish', 'soy'],
    proteinAdditions: ['Extra chicken'], modifications: ['Ask for less oil', 'Add vegetables'], notes: ['Usually seasoned with fish sauce and oyster sauce.'] }),
  out({ id: 'o-grilled-chicken', name: 'Grilled chicken chop with vegetables', cuisine: 'western', slots: ['lunch', 'dinner'], costBand: 'medium', portion: '1 plate', contains: ['chicken'], allergens: [],
    proteinAdditions: ['Add an egg'], modifications: ['Swap fries for salad or mashed potato', 'Sauce on the side'], notes: ['Sauces may contain dairy or gluten — ask.'] }),
  out({ id: 'o-grain-bowl', name: 'Grain bowl with grilled chicken or falafel', cuisine: 'mediterranean', slots: ['lunch', 'dinner'], costBand: 'high', portion: '1 bowl', contains: [], allergens: ['sesame', 'gluten'], variable: true,
    proteinAdditions: ['Double protein', 'Add hummus or Greek yogurt'], modifications: ['Dressing on the side'], notes: ['Falafel versions are usually vegetarian; tahini contains sesame.'] }),
  out({ id: 'o-kaya-toast', name: 'Kaya toast with soft-boiled eggs', cuisine: 'chinese', slots: ['breakfast'], costBand: 'low', portion: '1 set', contains: ['egg', 'dairy'], allergens: ['egg', 'gluten', 'dairy'],
    proteinAdditions: ['Add a third egg'], modifications: ['Less butter or kaya', 'Kopi or teh kosong (no sugar)'], notes: [] }),
  out({ id: 'o-prata-egg', name: 'Roti prata with egg and dhal', cuisine: 'indian', slots: ['breakfast'], costBand: 'low', portion: '1 egg prata', contains: ['egg'], allergens: ['egg', 'gluten', 'dairy'],
    proteinAdditions: ['Extra dhal'], modifications: ['One prata with dhal rather than two with curry'], notes: ['Ghee or margarine is common.'] }),
  out({ id: 'o-soy-milk', name: 'Unsweetened soy milk', cuisine: 'chinese', slots: ['snack', 'breakfast'], costBand: 'low', portion: '1 cup', contains: [], allergens: ['soy'],
    proteinAdditions: [], modifications: ['Ask for no or less sugar'], notes: [] }),
  out({ id: 'o-convenience-eggs', name: 'Convenience-store boiled eggs or onsen eggs', cuisine: 'other', slots: ['snack'], costBand: 'low', portion: '2 eggs', contains: ['egg'], allergens: ['egg'],
    proteinAdditions: [], modifications: [], notes: [] }),
  out({ id: 'o-fruit', name: 'Fresh fruit (cup or whole)', cuisine: 'other', slots: ['snack'], costBand: 'low', portion: '1 cup', contains: [], allergens: [],
    proteinAdditions: ['Pair with soy milk or yogurt for protein'], modifications: [], notes: [] }),
];

export const MEALS_BY_ID: ReadonlyMap<string, Meal> = new Map(MEALS.map((m) => [m.id, m]));

export const CUISINE_LABEL: Record<Cuisine, string> = {
  malay: 'Malay',
  chinese: 'Chinese',
  indian: 'Indian',
  mediterranean: 'Mediterranean',
  western: 'Western',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  other: 'Other',
};
