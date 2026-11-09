import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../../src/content/ingredients';
import { MEALS, MEALS_BY_ID } from '../../src/content/meals';
import { FDC_NUTRIENTS } from '../../src/content/fdcNutrients';
import { createBackup, parseBackupText, restoreBackup } from '../../src/data/backup';
import { createDb, setDb } from '../../src/data/db';
import * as repo from '../../src/data/repo';
import { bodyweightTrend, displayValue, entriesInRange, latestEntry, parseBodyweight, weeklyAverages } from '../../src/domain/bodyweight';
import { dailyTotals, dietaryNotes, exclusionReason, type FuelPrefs, mealNutrition, setPortion, suggestDay, swapMeal } from '../../src/domain/meals';
import { activityFactor, estimateEnergy, type EnergyInputs, goalTarget, macroSplit, mifflinStJeor, proteinRange, seedFromLifestyle, trainingEnergy, validateField } from '../../src/domain/nutrition';
import { milestones } from '../../src/domain/performance';
import { bench, bodyweightEntry, completedSession, makeProfile, nutritionProfile, T0, TODAY, weeklyBodyweights } from '../fixtures/factories';

const prefs = (over: Partial<FuelPrefs> = {}): FuelPrefs => ({ ...nutritionProfile(), ...over });
const ctx = (over: Partial<FuelPrefs> = {}) => ({ prefs: prefs(over), proteinFocus: true, favourites: [] });

describe('V0.3 bodyweight', () => {
  it('T14 a new bodyweight entry saves', async () => {
    setDb(createDb(`v3-t14-${Math.random()}`));
    const parsed = parseBodyweight({ localDate: TODAY, value: '78.4', unit: 'kg', note: 'morning' }, TODAY);
    expect(parsed).toEqual({ ok: true, value: 78.4 });
    await repo.saveBodyweight(bodyweightEntry(TODAY, 78.4, 'kg', 'morning'));
    expect(await repo.listBodyweights()).toMatchObject([{ localDate: TODAY, value: 78.4, unit: 'kg', note: 'morning' }]);
    setDb(null);
  });

  it('T15 editing an entry works and keeps its ID', async () => {
    setDb(createDb(`v3-t15-${Math.random()}`));
    const e = bodyweightEntry(TODAY, 78.4);
    await repo.saveBodyweight(e);
    await repo.saveBodyweight({ ...e, value: 172.5, unit: 'lb', updatedAt: T0.toISOString() });
    const all = await repo.listBodyweights();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: e.id, value: 172.5, unit: 'lb' });
    setDb(null);
  });

  it('T16 deleting an entry works', async () => {
    setDb(createDb(`v3-t16-${Math.random()}`));
    const e = bodyweightEntry(TODAY, 78.4);
    await repo.saveBodyweight(e);
    await repo.deleteBodyweight(e.id);
    expect(await repo.listBodyweights()).toEqual([]);
    setDb(null);
  });

  it('T17 weekly averages calculate correctly (and mixed units convert for display only)', () => {
    // 2026-03-02 is a Monday.
    const entries = [bodyweightEntry('2026-03-02', 80), bodyweightEntry('2026-03-04', 81), bodyweightEntry('2026-03-10', 79), bodyweightEntry('2026-03-11', 176.4, 'lb')];
    const weeks = weeklyAverages(entries, 'kg');
    expect(weeks).toEqual([
      { weekStart: '2026-03-02', average: 80.5, entries: 2 },
      { weekStart: '2026-03-09', average: 79.5, entries: 2 },
    ]);
    expect(displayValue(entries[3]!, 'kg')).toBe(80);
    expect(entries[3]!.value).toBe(176.4); // stored exactly as entered
    // Range filtering for 4W / All.
    expect(entriesInRange(weeklyBodyweights(10, 80, 0), '4w', TODAY)).toHaveLength(4);
    expect(entriesInRange(weeklyBodyweights(10, 80, 0), 'all', TODAY)).toHaveLength(10);
  });

  it('T18 missing dates and invalid weights are rejected', () => {
    const base = { localDate: TODAY, value: '80', unit: 'kg' as const, note: '' };
    expect(parseBodyweight({ ...base, localDate: '' }, TODAY)).toMatchObject({ ok: false, error: 'Enter a valid date.' });
    expect(parseBodyweight({ ...base, localDate: '2026-13-40' }, TODAY)).toMatchObject({ ok: false });
    expect(parseBodyweight({ ...base, localDate: '2026-03-11' }, TODAY)).toMatchObject({ ok: false, error: "The date can't be in the future." });
    expect(parseBodyweight({ ...base, value: '' }, TODAY)).toMatchObject({ ok: false, error: 'Enter your bodyweight.' });
    expect(parseBodyweight({ ...base, value: 'abc' }, TODAY)).toMatchObject({ ok: false });
    expect(parseBodyweight({ ...base, value: '-70' }, TODAY)).toMatchObject({ ok: false });
    expect(parseBodyweight({ ...base, value: '900' }, TODAY)).toMatchObject({ ok: false });
    expect(parseBodyweight({ ...base, value: '20', unit: 'lb' }, TODAY)).toMatchObject({ ok: false });
    // Trend needs enough data and says what's missing.
    const t = bodyweightTrend([bodyweightEntry(TODAY, 80)], 'kg');
    expect(t.status).toBe('insufficient');
    expect(t.needed).toMatch(/2 more weeks/);
    expect(bodyweightTrend(weeklyBodyweights(4, 80, 0.5), 'kg')).toMatchObject({ status: 'up', perWeek: 0.5 });
    expect(bodyweightTrend(weeklyBodyweights(4, 80, 0), 'kg').status).toBe('stable');
  });

  it('T19 bodyweight data persists across database reopen (refresh)', async () => {
    const name = `v3-t19-${Math.random()}`;
    const db = createDb(name);
    setDb(db);
    await repo.saveBodyweight(bodyweightEntry(TODAY, 77.7));
    db.close();
    const reopened = createDb(name);
    setDb(reopened);
    expect((await repo.listBodyweights())[0]!.value).toBe(77.7);
    setDb(null);
  });

  it('T20 bodyweight records survive backup and restore', async () => {
    setDb(createDb(`v3-t20-${Math.random()}`));
    await repo.saveProfile(makeProfile());
    await repo.saveBodyweight(bodyweightEntry('2026-03-01', 80.2, 'kg', 'note'));
    await repo.saveBodyweight(bodyweightEntry('2026-03-08', 176, 'lb'));
    const backup = await createBackup(T0);
    const parsed = parseBackupText(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    setDb(createDb(`v3-t20b-${Math.random()}`));
    await restoreBackup(parsed.ok ? parsed.backup : (null as never));
    expect((await repo.listBodyweights()).map((b) => [b.localDate, b.value, b.unit, b.note])).toEqual([
      ['2026-03-01', 80.2, 'kg', 'note'],
      ['2026-03-08', 176, 'lb', ''],
    ]);
    setDb(null);
  });
});

describe('V0.3 nutrition estimates', () => {
  const inputs = (over: Partial<EnergyInputs['profile']> = {}, weightKg: number | null = 80, sessions = 4): EnergyInputs => ({
    profile: { ...nutritionProfile({ heightCm: 180, ageYears: 30, knownMaintenanceKcal: null, avgSteps: null, physicalWork: null }), ...over },
    weightKg,
    sessionsPerWeek: sessions,
    minutesPerSession: 60,
  });

  it('T23 existing bodyweight is reused for nutrition', () => {
    const entries = [bodyweightEntry('2026-02-01', 82), bodyweightEntry('2026-03-01', 80.5)];
    expect(latestEntry(entries, TODAY)).toMatchObject({ value: 80.5 });
    const e = estimateEnergy(inputs({}, 80.5));
    expect(e.kind).toBe('estimate');
    expect(e.assumptions.join(' ')).toContain('80.5 kg');
  });

  it('T24 Mifflin–St Jeor matches worked reference examples', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780 (male equation)
    expect(mifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male' })).toBe(1780);
    // 10×60 + 6.25×165 − 5×25 − 161 = 1345.25 (female equation)
    expect(mifflinStJeor({ weightKg: 60, heightCm: 165, ageYears: 25, sex: 'female' })).toBeCloseTo(1345.25, 2);
    // 10×95 + 6.25×190 − 5×45 + 5 = 1917.5
    expect(mifflinStJeor({ weightKg: 95, heightCm: 190, ageYears: 45, sex: 'male' })).toBeCloseTo(1917.5, 2);
    const e = estimateEnergy(inputs());
    expect(e.kind === 'estimate' && e.restingKcal).toBe(1780);
  });

  it('T25 invalid inputs are rejected', () => {
    expect(validateField('age', 15)).toMatch(/Age must be between 18 and 100/);
    expect(validateField('age', 30)).toBeNull();
    expect(validateField('heightCm', 90)).toMatch(/Height/);
    expect(validateField('manualKcal', 400)).toMatch(/Calorie target/);
    expect(validateField('steps', -1)).toMatch(/Daily steps/);
    // Under 18: no equation-based target at all.
    const minor = estimateEnergy(inputs({ ageYears: 16, safety: { under18: true, pregnantOrBreastfeeding: false, eatingDisorderHistory: false, medicalCondition: false } }));
    expect(minor.kind).toBe('manual-only');
    // Missing inputs are requested, never invented.
    const missing = estimateEnergy(inputs({ heightCm: null, equationSex: 'unspecified' }));
    expect(missing).toMatchObject({ kind: 'manual-only', missing: ['height', 'equation input (male or female equation)'] });
    expect(estimateEnergy(inputs({}, null))).toMatchObject({ kind: 'manual-only', protein: null });
  });

  it('T26 activity estimates avoid double-counting exercise', () => {
    // The daily-life factor does not depend on training at all.
    expect(activityFactor({ activity: 'mostly-seated', avgSteps: null, physicalWork: null }).factor).toBe(1.2);
    const withTraining = estimateEnergy(inputs({}, 80, 4));
    const without = estimateEnergy(inputs({}, 80, 0));
    if (withTraining.kind !== 'estimate' || without.kind !== 'estimate') throw new Error('expected estimates');
    const [lo, hi] = trainingEnergy(80, 4, 60);
    expect(lo).toBeCloseTo(120, 5); // 240 min × (2.5 × 3.5 × 80 / 200) / 7
    expect(hi).toBeCloseTo(240, 5);
    expect(without.maintenance).toEqual([2140, 2140]); // 1780 × 1.2, no training
    expect(withTraining.maintenance).toEqual([2260, 2380]); // + training once
    // Steps override the self-reported level, and physical work raises the floor.
    expect(activityFactor({ activity: 'mostly-seated', avgSteps: 11_000, physicalWork: null }).factor).toBe(1.5);
    expect(activityFactor({ activity: 'mostly-seated', avgSteps: null, physicalWork: true }).factor).toBe(1.4);
  });

  it('T27 manual calorie targets are supported, including a known maintenance', () => {
    const e = estimateEnergy(inputs({ knownMaintenanceKcal: 2600, goal: 'maintain' }));
    expect(e).toMatchObject({ kind: 'estimate', maintenance: [2600, 2600], targetKcal: 2600 });
    const safety = estimateEnergy(inputs({ safety: { under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: true, medicalCondition: false } }));
    expect(safety.kind).toBe('manual-only'); // no automatic restrictive target
  });

  it('T28 protein targets use g/day from g/kg, within 1.4–2.0 g/kg', () => {
    expect(proteinRange(80, 'muscle-gain')).toEqual({ grams: [130, 160], perKg: [1.6, 2.0] });
    expect(proteinRange(80, 'maintain')).toEqual({ grams: [110, 145], perKg: [1.4, 1.8] });
    for (const g of ['maintain', 'muscle-gain', 'fat-loss', 'recomposition'] as const) {
      const { perKg } = proteinRange(70, g);
      expect(perKg[0]).toBeGreaterThanOrEqual(1.4);
      expect(perKg[1]).toBeLessThanOrEqual(2.0);
    }
  });

  it('T29 goal adjustments are cautious and targets are editable starting points', () => {
    expect(goalTarget(2500, 'fat-loss', 1700).kcal).toBe(2130); // −15%, capped at 500
    expect(goalTarget(4000, 'fat-loss', 1700).kcal).toBe(3500); // cap applies
    expect(goalTarget(1800, 'fat-loss', 1700).kcal).toBe(1700); // never below resting energy
    expect(goalTarget(2500, 'muscle-gain', null).kcal).toBeLessThanOrEqual(2800);
    expect(macroSplit(2500, 150)).toEqual({ fatG: 70, carbsG: 318 + 2 });
  });

  it('T21 T22 T42 the setup can be skipped, started later, and never touches workouts', async () => {
    const db = createDb(`v3-t21-${Math.random()}`);
    setDb(db);
    const s = completedSession({ id: 'w1', date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])] });
    await db.sessions.put(s);
    await repo.saveNutrition({ ...nutritionProfile(), status: 'declined' });
    expect((await repo.getNutrition())!.status).toBe('declined');
    await repo.saveNutrition({ ...(await repo.getNutrition())!, status: 'in-progress', step: 2 });
    expect(await repo.getNutrition()).toMatchObject({ status: 'in-progress', step: 2 });
    expect(await db.sessions.toArray()).toEqual([s]);
    setDb(null);
  });

  it('reuses V0.2 lifestyle nutrition notes when Fuel starts', () => {
    const seeded = seedFromLifestyle({ ...nutritionProfile(), diet: [], intolerances: [], goal: null, target: null }, {
      work: null,
      sleep: null,
      training: null,
      nutrition: { pattern: '', objective: 'lean-gain', restrictions: ['halal', 'lactose-free'], proteinTargetG: 140, energyKcal: null, fasting: 'Ramadan' },
    });
    expect(seeded).toMatchObject({ diet: ['halal'], intolerances: ['dairy'], fasting: 'Ramadan', goal: 'muscle-gain', target: { kcal: null, proteinG: [140, 140], source: 'manual' } });
  });
});

describe('V0.3 meals', () => {
  it('T30 T31 cooking preferences persist and mixed cook/buy is reflected per meal', async () => {
    setDb(createDb(`v3-t30-${Math.random()}`));
    await repo.saveNutrition(nutritionProfile());
    expect((await repo.getNutrition())!.habits).toMatchObject({ source: 'mixed', cookedSlots: ['dinner'] });
    const plan = suggestDay(TODAY, ctx(), T0);
    expect(plan.items.map((i) => [i.slot, i.mode])).toEqual([
      ['breakfast', 'buy'],
      ['lunch', 'buy'],
      ['dinner', 'cook'],
    ]);
    expect(plan.items.every((i) => MEALS_BY_ID.get(i.mealId)!.kind === (i.mode === 'cook' ? 'home' : 'out'))).toBe(true);
    setDb(null);
  });

  it('T32 multiple cuisines can be selected and are preferred', () => {
    const plan = suggestDay(TODAY, ctx({ cuisines: ['malay', 'indian'], habits: { ...nutritionProfile().habits, source: 'out' } }), T0);
    const lunchDinner = plan.items.filter((i) => i.slot !== 'breakfast').map((i) => MEALS_BY_ID.get(i.mealId)!.cuisine);
    expect(lunchDinner.every((c) => c === 'malay' || c === 'indian')).toBe(true);
  });

  it('T33 allergens are filtered correctly', () => {
    const p = prefs({ allergens: ['peanut', 'shellfish'], intolerances: ['dairy'] });
    for (const m of MEALS) {
      const reason = exclusionReason(m, p);
      if (m.allergens.some((a) => ['peanut', 'shellfish', 'dairy'].includes(a))) expect(reason).toMatch(/contains/);
      if (m.variable) expect(reason).not.toBeNull(); // can't be guaranteed allergen-free
    }
    for (let v = 0; v < 6; v++) {
      for (const i of suggestDay(TODAY, { prefs: p, proteinFocus: false, favourites: [] }, T0, v).items) {
        const m = MEALS_BY_ID.get(i.mealId)!;
        expect(m.allergens).not.toContain('peanut');
        expect(m.allergens).not.toContain('shellfish');
        expect(m.allergens).not.toContain('dairy');
      }
    }
  });

  it('T34 dietary restrictions are respected', () => {
    const veg = prefs({ diet: ['vegetarian'] });
    const vegan = prefs({ diet: ['vegan'] });
    const meat = ['pork', 'beef', 'mutton', 'chicken', 'fish', 'shellfish', 'other-meat'];
    for (const m of MEALS) {
      if (m.contains.some((c) => meat.includes(c))) expect(exclusionReason(m, veg)).not.toBeNull();
      if (m.contains.some((c) => c === 'egg' || c === 'dairy')) expect(exclusionReason(m, vegan)).not.toBeNull();
    }
    const halal = prefs({ diet: ['halal'] });
    expect(exclusionReason(MEALS_BY_ID.get('o-oyakodon')!, halal)).toMatch(/alcohol/);
    expect(exclusionReason(MEALS_BY_ID.get('h-salmon-teriyaki')!, halal)).toMatch(/alcohol/);
    // Exclusions by keyword.
    expect(exclusionReason(MEALS_BY_ID.get('h-prawn-egg-fried-rice')!, prefs({ exclusions: ['prawns'] }))).toMatch(/excluded/);
  });

  it('T35 halal certification is never claimed', () => {
    const halal = prefs({ diet: ['halal'] });
    for (const m of MEALS) {
      // Advice ("choose a halal-certified stall") is fine; a claim about a dish or outlet is not.
      expect(m.name).not.toMatch(/halal/i);
      expect(dietaryNotes(m, halal).join(' ')).not.toMatch(/\b(is|are) halal\b|certified halal\b|halal[- ]certified (dish|meal|recipe)\b/i);
      if (exclusionReason(m, halal) === null) expect(dietaryNotes(m, halal).join(' ')).toMatch(/halal-certified|halal certification|does not verify/);
    }
    // Choosing a cuisine never implies halal: Malay cuisine alone adds no halal note.
    expect(dietaryNotes(MEALS_BY_ID.get('o-nasi-lemak')!, prefs({ cuisines: ['malay'], diet: [] })).join(' ')).not.toMatch(/halal/i);
  });

  it('T36 unsupported macro values remain unavailable', () => {
    for (const m of MEALS.filter((x) => x.kind === 'out')) expect(mealNutrition(m)).toMatchObject({ quality: 'unavailable', kcal: null });
    // Ingredients without a retrieved FDC record are excluded and reported, never estimated.
    for (const i of INGREDIENTS) if (i.fdcId === null || !FDC_NUTRIENTS[i.fdcId]) {
      const meal = MEALS.find((m) => m.kind === 'home' && m.ingredients.some((x) => x.ingredientId === i.id));
      if (meal) expect(mealNutrition(meal).excluded).toContain(i.name);
    }
  });

  it('T37 meal swaps preserve dietary restrictions', () => {
    const c = { prefs: prefs({ diet: ['vegetarian'], allergens: ['egg'] }), proteinFocus: false, favourites: [] };
    let plan = suggestDay(TODAY, c, T0);
    for (let k = 0; k < 10; k++) {
      plan = swapMeal(plan, k % plan.items.length, c, T0, k % 3 === 0 ? 'cook' : undefined);
      for (const i of plan.items) expect(exclusionReason(MEALS_BY_ID.get(i.mealId)!, c.prefs)).toBeNull();
    }
  });

  it('T38 portion changes recalculate supported values', () => {
    const meal = MEALS_BY_ID.get('h-boiled-eggs')!; // 100 g egg, FDC 171287
    expect(mealNutrition(meal, 1)).toMatchObject({ quality: 'complete', kcal: 143, protein: 13 });
    expect(mealNutrition(meal, 2)).toMatchObject({ kcal: 286, protein: 25 });
    const plan = { localDate: TODAY, items: [{ slot: 'snack' as const, mealId: 'h-boiled-eggs', mode: 'cook' as const, portion: 1 }], updatedAt: T0.toISOString() };
    expect(setPortion(plan, 0, 1.5, T0).items[0]!.portion).toBe(1.5);
    expect(setPortion(plan, 0, 5, T0).items[0]!.portion).toBe(2); // clamped
  });

  it('T39 daily totals use only meals with complete sourced data', () => {
    const items = [
      { slot: 'snack' as const, mealId: 'h-boiled-eggs', mode: 'cook' as const, portion: 1 },
      { slot: 'lunch' as const, mealId: 'o-chicken-rice', mode: 'buy' as const, portion: 1 },
    ];
    expect(dailyTotals(items)).toEqual({ kcal: 143, protein: 13, carbs: 1, fat: 10, counted: 1, total: 2, notCounted: ['Steamed chicken rice'] });
  });

  it('T40 missing meals never trigger penalties (nutrition is not an input to milestones)', () => {
    const sessions = [completedSession({ id: 'x', date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])] })];
    const m = milestones({ sessions, weeks: [], programme: null, bodyweights: [], profile: { goal: 'general', weightUnit: 'kg' }, today: TODAY });
    expect(m.some((e) => /meal|calorie|food/i.test(`${e.title} ${e.detail}`))).toBe(false);
  });

  it('T41 nutrition preferences and meal plans survive backup and restore', async () => {
    setDb(createDb(`v3-t41-${Math.random()}`));
    await repo.saveProfile(makeProfile());
    const n = nutritionProfile({ diet: ['halal'], allergens: ['peanut'], favourites: ['h-boiled-eggs'], cuisines: ['malay', 'chinese'] });
    await repo.saveNutrition(n);
    const plan = suggestDay(TODAY, { prefs: n, proteinFocus: true, favourites: [] }, T0);
    await repo.saveMealPlan(plan);
    const parsed = parseBackupText(JSON.stringify(await createBackup(T0)));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.summary.hasNutrition).toBe(true);
    setDb(createDb(`v3-t41b-${Math.random()}`));
    await restoreBackup(parsed.backup);
    expect(await repo.getNutrition()).toEqual(n);
    expect(await repo.getMealPlan(TODAY)).toEqual(plan);
    setDb(null);
  });
});
