/**
 * Nutrient values per 100 g retrieved from USDA FoodData Central (SR Legacy)
 * via its public API during development. FoodData Central data are public
 * domain (CC0 1.0); source: U.S. Department of Agriculture, Agricultural
 * Research Service. FoodData Central. https://fdc.nal.usda.gov/
 *
 * Regenerate with `node scripts/fetch-fdc.mjs` (needs network). Only foods
 * listed here have nutrition values in AdaptFit; nothing is estimated by hand.
 */

export interface FdcRecord {
  fdcId: number;
  description: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  accessed: string;
}

export const FDC_NUTRIENTS: Readonly<Record<number, FdcRecord>> = {
  171077: { fdcId: 171077, description: 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw', kcal: 120, protein: 22.5, carbs: 0, fat: 2.62, accessed: '2026-11-06' },
  173627: { fdcId: 173627, description: 'Chicken, broilers or fryers, dark meat, thigh, meat only, raw', kcal: 121, protein: 19.7, carbs: 0, fat: 4.12, accessed: '2026-11-06' },
  171287: { fdcId: 171287, description: 'Egg, whole, raw, fresh', kcal: 143, protein: 12.6, carbs: 0.72, fat: 9.51, accessed: '2026-11-06' },
  168878: { fdcId: 168878, description: 'Rice, white, long-grain, regular, enriched, cooked', kcal: 130, protein: 2.69, carbs: 28.2, fat: 0.28, accessed: '2026-11-06' },
  169704: { fdcId: 169704, description: "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)", kcal: 123, protein: 2.74, carbs: 25.6, fat: 0.97, accessed: '2026-11-06' },
  172475: { fdcId: 172475, description: 'Tofu, raw, firm, prepared with calcium sulfate', kcal: 144, protein: 17.3, carbs: 2.78, fat: 8.72, accessed: '2026-11-06' },
  175167: { fdcId: 175167, description: 'Fish, salmon, Atlantic, farmed, raw', kcal: 208, protein: 20.4, carbs: 0, fat: 13.4, accessed: '2026-11-06' },
  175176: { fdcId: 175176, description: 'Fish, tilapia, raw', kcal: 96, protein: 20.1, carbs: 0, fat: 1.7, accessed: '2026-11-06' },
  175179: { fdcId: 175179, description: 'Crustaceans, shrimp, raw', kcal: 85, protein: 20.1, carbs: 0, fat: 0.51, accessed: '2026-11-06' },
};
