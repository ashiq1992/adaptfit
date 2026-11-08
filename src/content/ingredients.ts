import type { Allergen } from '../domain/types';
import { FDC_NUTRIENTS, type FdcRecord } from './fdcNutrients';

/** Animal and other sources tracked for dietary filtering. */
export type Contains = 'pork' | 'beef' | 'mutton' | 'chicken' | 'fish' | 'shellfish' | 'egg' | 'dairy' | 'alcohol' | 'other-meat';

export interface Ingredient {
  id: string;
  name: string;
  /** FoodData Central ID; nutrition is available only when this record exists in FDC_NUTRIENTS. */
  fdcId: number | null;
  contains: Contains[];
  allergens: Allergen[];
}

const ing = (id: string, name: string, fdcId: number | null, contains: Contains[] = [], allergens: Allergen[] = []): Ingredient => ({ id, name, fdcId, contains, allergens });

/**
 * Ingredients used by AdaptFit home recipes. `fdcId` values point to SR Legacy
 * records; ingredients whose record hasn't been retrieved show "Nutrition
 * estimate unavailable" rather than a guessed value.
 */
export const INGREDIENTS: readonly Ingredient[] = [
  ing('chicken-breast', 'Chicken breast, skinless (raw weight)', 171077, ['chicken']),
  ing('chicken-thigh', 'Chicken thigh, skinless (raw weight)', 173627, ['chicken']),
  ing('egg', 'Egg', 171287, ['egg'], ['egg']),
  ing('rice-white', 'White rice (cooked)', 168878),
  ing('rice-brown', 'Brown rice (cooked)', 169704),
  ing('tofu-firm', 'Firm tofu', 172475, [], ['soy']),
  ing('salmon', 'Salmon (raw weight)', 175167, ['fish'], ['fish']),
  ing('white-fish', 'White fish, e.g. tilapia (raw weight)', 175176, ['fish'], ['fish']),
  ing('prawns', 'Prawns (raw weight)', 175179, ['shellfish'], ['shellfish']),
  ing('leafy-greens', 'Leafy greens (e.g. bok choy, kai lan, spinach)', 170390),
  ing('broccoli', 'Broccoli', 170379),
  ing('mixed-veg', 'Mixed vegetables', null),
  ing('oats', 'Rolled oats (dry)', 173904),
  ing('milk', 'Milk', null, ['dairy'], ['dairy']),
  ing('yogurt-greek', 'Plain Greek yogurt', 170903, ['dairy'], ['dairy']),
  ing('banana', 'Banana', 173944),
  ing('lentils', 'Lentils (cooked)', 172421),
  ing('chickpeas', 'Chickpeas (cooked)', 173757),
  ing('tomatoes', 'Tomatoes', 170457),
  ing('wholemeal-bread', 'Wholemeal bread', null, [], ['gluten']),
  ing('cooking-oil', 'Cooking oil', 172336),
  ing('olive-oil', 'Olive oil', 171413),
  ing('coconut-milk', 'Coconut milk', null),
  ing('soy-sauce', 'Soy sauce', null, [], ['soy', 'gluten']),
  ing('kicap-manis', 'Kicap manis (sweet soy sauce)', null, [], ['soy', 'gluten']),
  ing('teriyaki-sauce', 'Teriyaki sauce (often contains mirin)', null, ['alcohol'], ['soy', 'gluten']),
  ing('fish-sauce', 'Fish sauce', null, ['fish'], ['fish']),
  ing('gochujang', 'Gochujang', null, [], ['soy', 'gluten']),
  ing('sesame-oil', 'Sesame oil', null, [], ['sesame']),
  ing('curry-paste', 'Curry spices or paste', null),
  ing('peanut-butter', 'Peanut butter', null, [], ['peanut']),
];

export const INGREDIENTS_BY_ID: ReadonlyMap<string, Ingredient> = new Map(INGREDIENTS.map((i) => [i.id, i]));

export function nutrientRecord(ingredientId: string): FdcRecord | null {
  const i = INGREDIENTS_BY_ID.get(ingredientId);
  if (!i || i.fdcId === null) return null;
  return FDC_NUTRIENTS[i.fdcId] ?? null;
}
