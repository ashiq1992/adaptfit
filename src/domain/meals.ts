import { type Contains, INGREDIENTS_BY_ID, nutrientRecord } from '../content/ingredients';
import { type Meal, MEALS, MEALS_BY_ID } from '../content/meals';
import { normalizeName } from './notesImport';
import type { MealPlan, MealPlanItem, MealSlot, NutritionProfile } from './types';

/**
 * Meal suggestions for AdaptFit Fuel (V0.3). Deterministic and local.
 * Dietary requirements, allergens, intolerances, and exclusions are HARD
 * filters — swaps and "another suggestion" never relax them. Nutrition is only
 * shown where it can be computed from sourced ingredient data.
 */

export interface MealNutrition {
  /** complete = every non-seasoning ingredient is sourced; partial = some aren't; unavailable = none/eating out. */
  quality: 'complete' | 'partial' | 'unavailable';
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Ingredients whose nutrition isn't included. */
  excluded: string[];
  sources: number[];
}

const r = (n: number) => Math.round(n);

/** Nutrition for a meal at a portion multiplier. Eating-out dishes are always unavailable. */
export function mealNutrition(meal: Meal, portion = 1): MealNutrition {
  if (meal.kind === 'out') return { quality: 'unavailable', kcal: null, protein: null, carbs: null, fat: null, excluded: [], sources: [] };
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  const excluded: string[] = [];
  const sources = new Set<number>();
  for (const i of meal.ingredients) {
    const rec = nutrientRecord(i.ingredientId);
    if (!rec) {
      excluded.push(INGREDIENTS_BY_ID.get(i.ingredientId)?.name ?? i.ingredientId);
      continue;
    }
    const f = (i.grams * portion) / 100;
    kcal += rec.kcal * f;
    protein += rec.protein * f;
    carbs += rec.carbs * f;
    fat += rec.fat * f;
    sources.add(rec.fdcId);
  }
  if (sources.size === 0) return { quality: 'unavailable', kcal: null, protein: null, carbs: null, fat: null, excluded, sources: [] };
  return { quality: excluded.length ? 'partial' : 'complete', kcal: r(kcal), protein: r(protein), carbs: r(carbs), fat: r(fat), excluded, sources: [...sources] };
}

export interface DailyTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Meals included in the totals (complete nutrition only). */
  counted: number;
  total: number;
  notCounted: string[];
}

/** Totals only from meals with complete, sourced nutrition; others are listed, never guessed. */
export function dailyTotals(items: readonly MealPlanItem[]): DailyTotals {
  const t: DailyTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, counted: 0, total: items.length, notCounted: [] };
  for (const item of items) {
    const meal = MEALS_BY_ID.get(item.mealId);
    if (!meal) continue;
    const n = mealNutrition(meal, item.portion);
    if (n.quality !== 'complete') {
      t.notCounted.push(meal.name);
      continue;
    }
    t.kcal += n.kcal!;
    t.protein += n.protein!;
    t.carbs += n.carbs!;
    t.fat += n.fat!;
    t.counted += 1;
  }
  return t;
}

const MEAT: Contains[] = ['pork', 'beef', 'mutton', 'chicken', 'fish', 'shellfish', 'other-meat'];

export type FuelPrefs = Pick<NutritionProfile, 'diet' | 'allergens' | 'intolerances' | 'dislikes' | 'exclusions' | 'cuisines' | 'habits' | 'fasting'>;

/** Why a meal is excluded for these preferences, or null if it's allowed. Hard filter. */
export function exclusionReason(meal: Meal, prefs: FuelPrefs): string | null {
  const c = new Set(meal.contains);
  const d = new Set(prefs.diet);
  if ((d.has('vegetarian') || d.has('vegan')) && MEAT.some((m) => c.has(m))) return 'contains meat or seafood';
  if (d.has('vegan') && (c.has('egg') || c.has('dairy'))) return 'contains egg or dairy';
  if ((d.has('halal') || d.has('no-pork')) && c.has('pork')) return 'contains pork';
  if ((d.has('halal') || d.has('no-alcohol')) && c.has('alcohol')) return 'may contain alcohol (e.g. mirin)';
  if (d.has('no-beef') && c.has('beef')) return 'contains beef';
  const avoid = new Set([...prefs.allergens, ...prefs.intolerances]);
  const hit = meal.allergens.find((a) => avoid.has(a));
  if (hit) return `contains ${hit}`;
  // Contents vary by stall: not suitable to suggest when allergies or a vegan/vegetarian diet must be guaranteed.
  if (meal.variable && (avoid.size > 0 || d.has('vegan'))) return 'contents vary by stall';
  const words = [...prefs.dislikes, ...prefs.exclusions].map(normalizeName).filter(Boolean);
  const text = normalizeName([meal.name, ...(meal.kind === 'home' ? meal.ingredients.map((i) => i.label) : [])].join(' '));
  const word = words.find((w) => text.includes(w));
  if (word) return `you excluded "${word}"`;
  return null;
}

/** Dietary notes to show with a suggestion (never a certification claim). */
export function dietaryNotes(meal: Meal, prefs: FuelPrefs): string[] {
  const notes: string[] = [];
  const d = new Set(prefs.diet);
  if (d.has('halal')) {
    const hasMeat = meal.contains.some((x) => MEAT.includes(x));
    notes.push(
      meal.kind === 'out'
        ? 'Halal: choose a halal-certified stall or outlet. AdaptFit does not verify certification.'
        : hasMeat
          ? 'Halal: use halal-certified meat and sauces.'
          : 'Halal: check sauces and other ingredients for halal certification.',
    );
  }
  if (meal.variable) notes.push('Contents vary — check each dish for your requirements.');
  if (meal.allergens.length) notes.push(`Contains or may contain: ${meal.allergens.join(', ')}.`);
  return notes;
}

/** Meal slots for the day from meals per day (fasting users typically choose 2). */
export function slotsFor(mealsPerDay: number | null): MealSlot[] {
  switch (mealsPerDay) {
    case 1:
      return ['dinner'];
    case 2:
      return ['lunch', 'dinner'];
    case 4:
      return ['breakfast', 'lunch', 'dinner', 'snack'];
    case 5:
      return ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];
    default:
      return ['breakfast', 'lunch', 'dinner'];
  }
}

/** Cook or buy for a slot, from the eating pattern. */
export function modeFor(slot: MealSlot, prefs: FuelPrefs): 'cook' | 'buy' {
  const s = prefs.habits.source;
  if (s === 'home') return 'cook';
  if (s === 'out') return 'buy';
  if (s === 'mixed') return prefs.habits.cookedSlots.includes(slot) ? 'cook' : 'buy';
  return 'buy';
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface CandidateContext {
  prefs: FuelPrefs;
  /** Prefer higher-protein meals when a protein range is set. */
  proteinFocus: boolean;
  favourites: readonly string[];
}

/**
 * Ranked candidates for a slot and mode. Restrictions always apply; cuisine,
 * budget, and cooking time are preferences that relax only if nothing fits.
 */
export function candidates(slot: MealSlot, mode: 'cook' | 'buy', ctx: CandidateContext): Meal[] {
  const kind = mode === 'cook' ? 'home' : 'out';
  const allowed = MEALS.filter((m) => m.kind === kind && m.slots.includes(slot) && exclusionReason(m, ctx.prefs) === null);
  const cuisines: string[] = ctx.prefs.cuisines.filter((c) => c !== 'other');
  const lowBudget = ctx.prefs.habits.budgetPerMealSgd !== null && ctx.prefs.habits.budgetPerMealSgd <= 6;
  const maxCook = ctx.prefs.habits.cookingMinutes;
  const score = (m: Meal) => {
    let s = 0;
    if (cuisines.length && cuisines.includes(m.cuisine)) s += 10;
    if (ctx.prefs.cuisines.includes('other') && (m.cuisine === 'other' || !cuisines.includes(m.cuisine))) s += 2;
    if (lowBudget && m.costBand === 'low') s += 3;
    if (lowBudget && m.costBand === 'high') s -= 4;
    if (m.kind === 'home' && maxCook !== null && m.cookMinutes > maxCook) s -= 8;
    if (ctx.favourites.includes(m.id)) s += 4;
    if (ctx.proteinFocus) {
      const n = mealNutrition(m);
      if (n.protein !== null && n.protein >= 25) s += 3;
    }
    return s;
  };
  return [...allowed].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

/** A practical one-day suggestion. Deterministic for a given date and preferences. */
export function suggestDay(localDate: string, ctx: CandidateContext, now: Date, variant = 0): MealPlan {
  const slots = slotsFor(ctx.prefs.habits.mealsPerDay);
  const used = new Set<string>();
  const items: MealPlanItem[] = [];
  slots.forEach((slot, i) => {
    const mode = modeFor(slot, ctx.prefs);
    const list = candidates(slot, mode, ctx).filter((m) => !used.has(m.id));
    if (!list.length) return;
    // Pick among the top few so days vary, without leaving the best matches.
    const top = list.slice(0, Math.min(3, list.length));
    const meal = top[(hash(`${localDate}:${slot}:${i}`) + variant) % top.length]!;
    used.add(meal.id);
    items.push({ slot, mealId: meal.id, mode, portion: 1 });
  });
  return { localDate, items, updatedAt: now.toISOString() };
}

/** Replace one item with the next allowed candidate (restrictions preserved). */
export function swapMeal(plan: MealPlan, index: number, ctx: CandidateContext, now: Date, mode?: 'cook' | 'buy'): MealPlan {
  const item = plan.items[index];
  if (!item) return plan;
  const m = mode ?? item.mode;
  const others = new Set(plan.items.filter((_, i) => i !== index).map((x) => x.mealId));
  const list = candidates(item.slot, m, ctx).filter((x) => !others.has(x.id));
  if (!list.length) return plan;
  const pos = list.findIndex((x) => x.id === item.mealId);
  const next = mode && mode !== item.mode ? list[0]! : list[(pos + 1) % list.length]!;
  const items = plan.items.map((x, i) => (i === index ? { ...x, mealId: next.id, mode: m } : x));
  return { ...plan, items, updatedAt: now.toISOString() };
}

export function setPortion(plan: MealPlan, index: number, portion: number, now: Date): MealPlan {
  const p = Math.max(0.5, Math.min(2, Math.round(portion * 4) / 4));
  return { ...plan, items: plan.items.map((x, i) => (i === index ? { ...x, portion: p } : x)), updatedAt: now.toISOString() };
}

/** Is a stored plan still valid for current preferences? (Preferences may have changed since.) */
export function planRespectsPrefs(plan: MealPlan, prefs: FuelPrefs): boolean {
  return plan.items.every((i) => {
    const meal = MEALS_BY_ID.get(i.mealId);
    return !!meal && exclusionReason(meal, prefs) === null;
  });
}
