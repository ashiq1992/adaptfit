import type { ActivityLevel, Lifestyle, NutritionGoal, NutritionProfile, NutritionSafety, NutritionTarget, TrainingGoal } from './types';

/**
 * AdaptFit Fuel energy engine (V0.3). Transparent, conservative estimates —
 * not a measurement of metabolism. Every number comes with its assumptions.
 *
 * Method
 * 1. Resting energy: Mifflin–St Jeor (Mifflin et al., 1990), adults only:
 *      10 × weight(kg) + 6.25 × height(cm) − 5 × age(y) + 5   (male equation)
 *      10 × weight(kg) + 6.25 × height(cm) − 5 × age(y) − 161 (female equation)
 * 2. Daily-life activity factor that EXCLUDES planned training
 *    (1.2 / 1.3 / 1.4 / 1.5), chosen from steps when given, else self-report.
 * 3. Training energy added separately from the user's schedule, using net
 *    MET values for resistance training (3.5–6.0 METs, minus 1 MET of rest
 *    already counted in step 1), so exercise is not counted twice.
 */

export const LIMITS = {
  age: [18, 100] as const,
  heightCm: [120, 230] as const,
  weightKg: [25, 350] as const,
  manualKcal: [1000, 6000] as const,
  steps: [0, 60_000] as const,
};

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  'mostly-seated': 1.2,
  'lightly-active': 1.3,
  active: 1.4,
  'very-active': 1.5,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  'mostly-seated': 'Mostly seated (desk job, little walking)',
  'lightly-active': 'Lightly active (some walking, on your feet sometimes)',
  active: 'Active (on your feet most of the day)',
  'very-active': 'Very active (physical job or lots of walking)',
};

/** Net METs above rest for resistance training (Compendium of Physical Activities range). */
export const TRAINING_NET_MET: [number, number] = [2.5, 5.0];

export function defaultNutritionGoal(goal: TrainingGoal): NutritionGoal {
  if (goal === 'hypertrophy') return 'muscle-gain';
  if (goal === 'fat-loss') return 'fat-loss';
  if (goal === 'recomposition') return 'recomposition';
  return 'maintain';
}

export const NUTRITION_GOAL_LABEL: Record<NutritionGoal, string> = {
  maintain: 'Maintain bodyweight',
  'muscle-gain': 'Build muscle (modest surplus)',
  'fat-loss': 'Lose fat (moderate deficit)',
  recomposition: 'Recomposition (around maintenance)',
};

export function hasSafetyFlag(s: NutritionSafety): boolean {
  return s.under18 || s.pregnantOrBreastfeeding || s.eatingDisorderHistory || s.medicalCondition;
}

export const SAFETY_MESSAGE =
  'Because of what you shared, AdaptFit will not suggest a calorie target or deficit. Energy and protein needs in this situation are best set with a doctor or registered dietitian. You can still enter a target they give you, and use meal ideas and preferences.';

export function mifflinStJeor(args: { weightKg: number; heightCm: number; ageYears: number; sex: 'male' | 'female' }): number {
  const base = 10 * args.weightKg + 6.25 * args.heightCm - 5 * args.ageYears;
  return base + (args.sex === 'male' ? 5 : -161);
}

/** Activity factor: steps take precedence; physical work raises the floor to "active". */
export function activityFactor(p: Pick<NutritionProfile, 'activity' | 'avgSteps' | 'physicalWork'>): { factor: number; basis: string } {
  let factor: number;
  let basis: string;
  if (p.avgSteps !== null) {
    factor = p.avgSteps < 5000 ? 1.2 : p.avgSteps < 7500 ? 1.3 : p.avgSteps < 10_000 ? 1.4 : 1.5;
    basis = `${p.avgSteps.toLocaleString('en-SG')} average daily steps`;
  } else if (p.activity) {
    factor = ACTIVITY_FACTOR[p.activity];
    basis = ACTIVITY_LABEL[p.activity].split(' (')[0]!.toLowerCase();
  } else {
    factor = 1.2;
    basis = 'no activity information (lowest level assumed)';
  }
  if (p.physicalWork && factor < 1.4) {
    factor = 1.4;
    basis += ', physically demanding work';
  }
  return { factor, basis };
}

/** Average daily training energy (kcal/day) from the schedule, as a [low, high] range. */
export function trainingEnergy(weightKg: number, sessionsPerWeek: number, minutesPerSession: number): [number, number] {
  const perMin = (met: number) => (met * 3.5 * weightKg) / 200;
  const weekly = sessionsPerWeek * minutesPerSession;
  return [(weekly * perMin(TRAINING_NET_MET[0])) / 7, (weekly * perMin(TRAINING_NET_MET[1])) / 7];
}

const r10 = (n: number) => Math.round(n / 10) * 10;
const r5 = (n: number) => Math.round(n / 5) * 5;

export interface EnergyInputs {
  profile: Pick<NutritionProfile, 'ageYears' | 'heightCm' | 'equationSex' | 'activity' | 'avgSteps' | 'physicalWork' | 'knownMaintenanceKcal' | 'goal' | 'safety'>;
  weightKg: number | null;
  sessionsPerWeek: number;
  minutesPerSession: number;
}

export type EnergyEstimate =
  | {
      kind: 'estimate';
      restingKcal: number | null;
      maintenance: [number, number];
      targetKcal: number | null;
      adjustment: string;
      protein: [number, number];
      fatG: number | null;
      carbsG: number | null;
      assumptions: string[];
    }
  | { kind: 'manual-only'; reason: string; missing: string[]; protein: [number, number] | null; assumptions: string[] };

/** What's missing before an equation-based estimate is possible. */
export function missingInputs(i: EnergyInputs): string[] {
  const missing: string[] = [];
  if (i.profile.ageYears === null) missing.push('age');
  if (i.profile.heightCm === null) missing.push('height');
  if (i.weightKg === null) missing.push('current bodyweight');
  if (i.profile.equationSex === 'unspecified') missing.push('equation input (male or female equation)');
  return missing;
}

/** Validate a single numeric field. Returns an error message or null. */
export function validateField(field: 'age' | 'heightCm' | 'weightKg' | 'manualKcal' | 'steps', value: number | null): string | null {
  if (value === null) return null;
  const [lo, hi] = LIMITS[field];
  const names = { age: 'Age', heightCm: 'Height', weightKg: 'Bodyweight', manualKcal: 'Calorie target', steps: 'Daily steps' } as const;
  const units = { age: 'years', heightCm: 'cm', weightKg: 'kg', manualKcal: 'kcal', steps: 'steps' } as const;
  if (!Number.isFinite(value) || value < lo || value > hi) return `${names[field]} must be between ${lo.toLocaleString('en-SG')} and ${hi.toLocaleString('en-SG')} ${units[field]}.`;
  return null;
}

/** Protein range in g/day (rounded to 5 g) — within the 1.4–2.0 g/kg reference range for resistance-trained adults. */
export function proteinRange(weightKg: number, goal: NutritionGoal): { grams: [number, number]; perKg: [number, number] } {
  const perKg: [number, number] = goal === 'maintain' ? [1.4, 1.8] : [1.6, 2.0];
  return { grams: [r5(weightKg * perKg[0]), r5(weightKg * perKg[1])], perKg };
}

/** Cautious goal adjustment around maintenance; never below resting energy. */
export function goalTarget(maintenanceMid: number, goal: NutritionGoal, restingKcal: number | null): { kcal: number; adjustment: string } {
  let kcal = maintenanceMid;
  let adjustment = 'Set at estimated maintenance.';
  if (goal === 'muscle-gain') {
    const add = Math.min(300, maintenanceMid * 0.1, Math.max(150, maintenanceMid * 0.08));
    kcal = maintenanceMid + add;
    adjustment = `About +${r10(add)} kcal above maintenance — a modest surplus to support muscle gain while limiting fat gain.`;
  } else if (goal === 'fat-loss') {
    const cut = Math.min(500, maintenanceMid * 0.15);
    kcal = maintenanceMid - cut;
    adjustment = `About −${r10(cut)} kcal below maintenance (≈15%, capped at 500) — a moderate deficit, not an aggressive one.`;
  } else if (goal === 'recomposition') {
    const cut = Math.min(250, maintenanceMid * 0.05);
    kcal = maintenanceMid - cut;
    adjustment = `About −${r10(cut)} kcal (≈5%) — close to maintenance, with high protein and consistent training doing most of the work.`;
  }
  if (restingKcal !== null && kcal < restingKcal) {
    kcal = restingKcal;
    adjustment += ' Raised to your estimated resting energy: AdaptFit never suggests eating below it.';
  }
  return { kcal: r10(kcal), adjustment };
}

/** Starting fat and carbohydrate targets once calories and protein are set (editable). */
export function macroSplit(kcal: number, proteinG: number): { fatG: number; carbsG: number } {
  const fatG = r5((kcal * 0.25) / 9);
  const carbsG = Math.max(0, r5((kcal - proteinG * 4 - fatG * 9) / 4));
  return { fatG, carbsG };
}

export function estimateEnergy(i: EnergyInputs): EnergyEstimate {
  const goal = i.profile.goal ?? 'maintain';
  const p = i.profile;
  const assumptions: string[] = [];
  const protein = i.weightKg !== null ? proteinRange(i.weightKg, goal) : null;
  if (protein) assumptions.push(`Protein: ${protein.perKg[0]}–${protein.perKg[1]} g per kg of bodyweight per day, within the 1.4–2.0 g/kg range commonly recommended for people who lift.`);

  if (hasSafetyFlag(p.safety)) {
    return { kind: 'manual-only', reason: SAFETY_MESSAGE, missing: [], protein: p.safety.under18 || p.safety.pregnantOrBreastfeeding || p.safety.medicalCondition ? null : (protein?.grams ?? null), assumptions };
  }

  const weightKg = i.weightKg;
  const [trainLow, trainHigh] = weightKg !== null ? trainingEnergy(weightKg, i.sessionsPerWeek, i.minutesPerSession) : [0, 0];

  // A maintenance estimate the user already trusts takes precedence.
  if (p.knownMaintenanceKcal !== null) {
    const mid = p.knownMaintenanceKcal;
    const { kcal, adjustment } = goalTarget(mid, goal, null);
    const split = protein ? macroSplit(kcal, Math.round((protein.grams[0] + protein.grams[1]) / 2)) : null;
    return {
      kind: 'estimate',
      restingKcal: null,
      maintenance: [mid, mid],
      targetKcal: kcal,
      adjustment,
      protein: protein?.grams ?? [0, 0],
      fatG: split?.fatG ?? null,
      carbsG: split?.carbsG ?? null,
      assumptions: [`Maintenance uses the estimate you provided (${mid} kcal).`, ...assumptions, 'Fat starts at 25% of calories; carbohydrates fill the rest. Both are editable starting points.'],
    };
  }

  const missing = missingInputs(i);
  if (missing.length || weightKg === null || p.ageYears === null || p.heightCm === null || p.equationSex === 'unspecified') {
    return {
      kind: 'manual-only',
      reason: `An estimate needs your ${missing.join(', ')}. You can add ${missing.length === 1 ? 'it' : 'them'}, or set a calorie target yourself.`,
      missing,
      protein: protein?.grams ?? null,
      assumptions,
    };
  }

  const resting = mifflinStJeor({ weightKg, heightCm: p.heightCm, ageYears: p.ageYears, sex: p.equationSex });
  const act = activityFactor(p);
  const daily = resting * act.factor;
  const maintenance: [number, number] = [r10(daily + trainLow), r10(daily + trainHigh)];
  const mid = (maintenance[0] + maintenance[1]) / 2;
  const { kcal, adjustment } = goalTarget(mid, goal, r10(resting));
  const split = macroSplit(kcal, Math.round((protein!.grams[0] + protein!.grams[1]) / 2));
  return {
    kind: 'estimate',
    restingKcal: r10(resting),
    maintenance,
    targetKcal: kcal,
    adjustment,
    protein: protein!.grams,
    fatG: split.fatG,
    carbsG: split.carbsG,
    assumptions: [
      `Resting energy uses the Mifflin–St Jeor equation (${p.equationSex} equation) with ${weightKg} kg, ${p.heightCm} cm, age ${p.ageYears}.`,
      `Daily-life activity factor ${act.factor} (${act.basis}). It excludes your planned training.`,
      `Training adds about ${r10(trainLow)}–${r10(trainHigh)} kcal/day on average (${i.sessionsPerWeek} × ${i.minutesPerSession} min per week of resistance training), counted once.`,
      ...assumptions,
      'Fat starts at 25% of calories; carbohydrates fill the rest. Both are editable starting points.',
      'These are estimates. Your bodyweight trend over 2–4 weeks is a better guide; revise the target if it moves differently than expected.',
    ],
  };
}

/** Turn an estimate into a stored target (source: estimate). */
export function targetFromEstimate(e: EnergyEstimate, now: Date): NutritionTarget | null {
  if (e.kind !== 'estimate' || e.targetKcal === null) return null;
  return { kcal: e.targetKcal, proteinG: e.protein, carbsG: e.carbsG, fatG: e.fatG, source: 'estimate', updatedAt: now.toISOString() };
}

export function emptyNutritionProfile(now: Date): NutritionProfile {
  return {
    id: 'me',
    status: 'not-asked',
    step: 0,
    ageYears: null,
    heightCm: null,
    equationSex: 'unspecified',
    activity: null,
    avgSteps: null,
    physicalWork: null,
    knownMaintenanceKcal: null,
    goal: null,
    safety: { under18: false, pregnantOrBreastfeeding: false, eatingDisorderHistory: false, medicalCondition: false },
    target: null,
    habits: { source: null, cookedSlots: [], mealsPerDay: null, eatingTimes: '', budgetPerMealSgd: null, cookingMinutes: null, kitchen: [] },
    cuisines: [],
    diet: [],
    allergens: [],
    intolerances: [],
    dislikes: [],
    exclusions: [],
    fasting: null,
    favourites: [],
    updatedAt: now.toISOString(),
  };
}

/**
 * Reuse V0.2 lifestyle nutrition notes when Fuel is first set up, so the user
 * isn't asked again. Only fills fields that are still empty.
 */
export function seedFromLifestyle(n: NutritionProfile, lifestyle: Lifestyle): NutritionProfile {
  const old = lifestyle.nutrition;
  if (!old) return n;
  const diet = new Set(n.diet);
  const intolerances = new Set(n.intolerances);
  for (const r of old.restrictions) {
    if (r === 'halal' || r === 'vegetarian' || r === 'vegan' || r === 'no-pork' || r === 'no-beef') diet.add(r);
    if (r === 'lactose-free') intolerances.add('dairy');
    if (r === 'gluten-free') intolerances.add('gluten');
  }
  return {
    ...n,
    diet: n.diet.length ? n.diet : [...diet],
    intolerances: n.intolerances.length ? n.intolerances : [...intolerances],
    fasting: n.fasting ?? old.fasting,
    goal: n.goal ?? (old.objective === 'lean-gain' ? 'muscle-gain' : old.objective === 'fat-loss' ? 'fat-loss' : old.objective === 'maintain' ? 'maintain' : null),
    target:
      n.target ??
      (old.energyKcal || old.proteinTargetG
        ? { kcal: old.energyKcal, proteinG: old.proteinTargetG ? [old.proteinTargetG, old.proteinTargetG] : null, carbsG: null, fatG: null, source: 'manual', updatedAt: n.updatedAt }
        : null),
  };
}
