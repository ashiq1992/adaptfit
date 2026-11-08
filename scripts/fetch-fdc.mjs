// Development-time only: regenerates src/content/fdcNutrients.ts from USDA
// FoodData Central (public domain, CC0 1.0). The app never calls this API.
//
// Usage:  FDC_API_KEY=your-free-key node scripts/fetch-fdc.mjs
//         (falls back to DEMO_KEY, which is heavily rate-limited)
// Get a free key at https://fdc.nal.usda.gov/api-key-signup
//
// Reads every fdcId referenced in src/content/ingredients.ts, fetches energy,
// protein, carbohydrate, and fat per 100 g, and prints each description so a
// human can confirm it matches the ingredient before committing.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const ingredientsSrc = readFileSync(new URL('src/content/ingredients.ts', root), 'utf8');
const ids = [...ingredientsSrc.matchAll(/ing\('[^']+', '[^']+', (\d+)/g)].map((m) => Number(m[1]));
const key = process.env.FDC_API_KEY || 'DEMO_KEY';

const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods?api_key=${key}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ fdcIds: ids, format: 'full' }),
});
if (!res.ok) {
  console.error(`FoodData Central returned ${res.status}. ${res.status === 429 ? 'Rate limited — use your own FDC_API_KEY.' : ''}`);
  process.exit(1);
}
const foods = await res.json();
const accessed = new Date().toISOString().slice(0, 10);
const rows = [];
for (const f of foods) {
  const n = (num) => f.foodNutrients.find((x) => x.nutrient?.number === num)?.amount;
  const rec = { fdcId: f.fdcId, description: f.description, kcal: n('208'), protein: n('203'), carbs: n('205'), fat: n('204') };
  if ([rec.kcal, rec.protein, rec.carbs, rec.fat].some((v) => typeof v !== 'number')) {
    console.warn(`SKIPPED ${f.fdcId} (${f.description}): incomplete nutrients`);
    continue;
  }
  console.log(`${f.fdcId} | ${f.description} | ${rec.kcal} kcal, P ${rec.protein}, C ${rec.carbs}, F ${rec.fat}`);
  rows.push(`  ${rec.fdcId}: { fdcId: ${rec.fdcId}, description: ${JSON.stringify(rec.description)}, kcal: ${rec.kcal}, protein: ${rec.protein}, carbs: ${rec.carbs}, fat: ${rec.fat}, accessed: '${accessed}' },`);
}
const header = readFileSync(new URL('src/content/fdcNutrients.ts', root), 'utf8').split('export const FDC_NUTRIENTS')[0];
writeFileSync(new URL('src/content/fdcNutrients.ts', root), `${header}export const FDC_NUTRIENTS: Readonly<Record<number, FdcRecord>> = {\n${rows.join('\n')}\n};\n`);
console.log(`Wrote ${rows.length} records. Review the descriptions above, then run npm test.`);
