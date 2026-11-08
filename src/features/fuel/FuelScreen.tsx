import { useEffect, useId, useMemo, useState } from 'react';
import { CUISINE_LABEL, type Meal, MEALS_BY_ID } from '../../content/meals';
import { SOURCES_BY_ID } from '../../content/sources';
import { newId, saveBodyweight, saveMealPlan, saveNutrition } from '../../data/repo';
import { latestEntry, toUnit } from '../../domain/bodyweight';
import { type CandidateContext, dailyTotals, dietaryNotes, mealNutrition, planRespectsPrefs, setPortion, suggestDay, swapMeal } from '../../domain/meals';
import {
  ACTIVITY_LABEL,
  defaultNutritionGoal,
  emptyNutritionProfile,
  estimateEnergy,
  hasSafetyFlag,
  macroSplit,
  NUTRITION_GOAL_LABEL,
  SAFETY_MESSAGE,
  seedFromLifestyle,
  targetFromEstimate,
  validateField,
} from '../../domain/nutrition';
import {
  ACTIVITY_LEVELS,
  ALLERGENS,
  CUISINES,
  DIET_FLAGS,
  MEAL_SLOTS,
  type MealPlan,
  NUTRITION_GOALS,
  type NutritionProfile,
} from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { CheckboxGroup, RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { Switch } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { IconInfo, IconMinus, IconPlus, IconRepeat, IconStar, IconUtensils } from '../../ui/icons';

const STEPS = ['About you', 'Activity', 'Targets', 'Eating habits', 'Food preferences', 'Meal ideas'] as const;
const DIET_LABEL: Record<(typeof DIET_FLAGS)[number], string> = { halal: 'Halal', vegetarian: 'Vegetarian', vegan: 'Vegan', 'no-pork': 'No pork', 'no-beef': 'No beef', 'no-alcohol': 'No alcohol' };
const ALLERGEN_LABEL: Record<(typeof ALLERGENS)[number], string> = { peanut: 'Peanuts', 'tree-nut': 'Tree nuts', egg: 'Egg', dairy: 'Dairy', soy: 'Soy', gluten: 'Gluten', fish: 'Fish', shellfish: 'Shellfish', sesame: 'Sesame' };
const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' } as const;
const KITCHEN = ['Stove', 'Rice cooker', 'Microwave', 'Oven', 'Air fryer'] as const;

/** AdaptFit Fuel: optional. Opt-in, resumable, skippable — never required to train. */
export function FuelScreen() {
  const { data } = useApp();
  const announce = useAnnounce();
  const n = data.nutrition;
  const [editing, setEditing] = useState<number | null>(null);

  const start = async () => {
    const now = clock.now();
    const base = seedFromLifestyle(n ?? emptyNutritionProfile(now), data.profile.lifestyle);
    await saveNutrition({ ...base, status: 'in-progress', goal: base.goal ?? defaultNutritionGoal(data.profile.goal), updatedAt: now.toISOString() });
    announce('AdaptFit Fuel setup started. You can stop at any step.');
  };

  if (!n || n.status === 'not-asked' || n.status === 'declined') {
    return (
      <section className="card card-glow" data-testid="fuel-intro">
        <span className="eyebrow">
          <IconUtensils size={16} /> AdaptFit Fuel · optional
        </span>
        <h2 className="card-title">Calorie and protein estimates, plus Singapore meal ideas</h2>
        <p className="small muted">AdaptFit can estimate your energy and protein needs from what you share, and suggest practical meals — home-cooked or from hawker centres — that fit your training. You never have to log meals.</p>
        {n?.status === 'declined' && <p className="xs muted">You chose “Not now” earlier. Start whenever you like.</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={start}>
          Personalise my nutrition
        </button>
      </section>
    );
  }

  if (n.status === 'in-progress' || editing !== null) {
    return <FuelSetup profile={n} startStep={editing ?? n.step} editingComplete={n.status === 'complete'} onDone={() => setEditing(null)} />;
  }
  return <FuelDashboard profile={n} onEdit={(step) => setEditing(step)} />;
}

// ── Setup wizard ────────────────────────────────────────────────────

function FuelSetup({ profile, startStep, editingComplete, onDone }: { profile: NutritionProfile; startStep: number; editingComplete: boolean; onDone: () => void }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const [step, setStep] = useState(Math.min(startStep, STEPS.length - 1));
  const [draft, setDraft] = useState<NutritionProfile>(profile);
  const [error, setError] = useState<string | null>(null);
  const unit = data.profile.weightUnit;
  const latest = latestEntry(data.bodyweights, today);
  const latestKg = latest ? Math.round(toUnit(latest.value, latest.unit, 'kg') * 10) / 10 : null;
  const [weightText, setWeightText] = useState('');
  const set = (patch: Partial<NutritionProfile>) => setDraft((d) => ({ ...d, ...patch }));
  const sessionsPerWeek = data.activeProgramme?.daysPerWeek ?? 3;
  const minutes = data.profile.preferredMinutes;

  const estimate = useMemo(
    () => estimateEnergy({ profile: draft, weightKg: latestKg, sessionsPerWeek, minutesPerSession: minutes }),
    [draft, latestKg, sessionsPerWeek, minutes],
  );

  const persist = async (next: NutritionProfile, nextStep: number) => {
    const now = clock.now();
    const saved: NutritionProfile = { ...next, step: nextStep, status: editingComplete ? 'complete' : next.status, updatedAt: now.toISOString() };
    await saveNutrition(saved);
    setDraft(saved);
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      return validateField('age', draft.ageYears) ?? validateField('heightCm', draft.heightCm);
    }
    if (step === 1) {
      return validateField('steps', draft.avgSteps) ?? (draft.knownMaintenanceKcal !== null ? validateField('manualKcal', draft.knownMaintenanceKcal) : null);
    }
    if (step === 2 && draft.target?.kcal != null) return validateField('manualKcal', draft.target.kcal);
    return null;
  };

  const next = async () => {
    setError(null);
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    // Bodyweight typed here is saved to the bodyweight log so it's reused everywhere.
    if (step === 1 && weightText.trim()) {
      const v = Number(weightText.replace(',', '.'));
      const kg = toUnit(v, unit, 'kg');
      if (!Number.isFinite(v) || kg < 25 || kg > 350) {
        setError(`Enter a bodyweight between ${unit === 'kg' ? '25 and 350 kg' : '55 and 772 lb'}.`);
        return;
      }
      const iso = clock.now().toISOString();
      await saveBodyweight({ id: newId(), localDate: today, value: Math.round(v * 10) / 10, unit, note: 'Added during Fuel setup', createdAt: iso, updatedAt: iso });
      setWeightText('');
    }
    let updated = draft;
    if (step === 2 && !draft.target) {
      // Accepting the estimate as shown.
      updated = { ...draft, target: targetFromEstimate(estimate, clock.now()) ?? { kcal: null, proteinG: estimate.protein, carbsG: null, fatG: null, source: 'manual', updatedAt: clock.now().toISOString() } };
    }
    if (step === STEPS.length - 1) {
      await persist({ ...updated, status: 'complete' }, step);
      announce('Nutrition profile saved.');
      onDone();
      return;
    }
    await persist(updated, step + 1);
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  };

  const finishLater = async () => {
    await persist(draft, step);
    announce('Progress saved. Pick up where you left off any time in Coach → Fuel.');
    if (editingComplete) onDone();
  };

  return (
    <section className="card" aria-labelledby="fuel-step-title" data-testid="fuel-setup">
      <div className="row between wrap">
        <span className="eyebrow">AdaptFit Fuel setup</span>
        <span className="xs muted num">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>
      <h2 id="fuel-step-title" className="card-title">
        {STEPS[step]}
      </h2>

      {step === 0 && (
        <>
          <p className="xs muted">Used only for the energy estimate, stored on this device. Skip anything — you can set targets manually instead.</p>
          <div className="form-grid">
            <NumInput label="Age (years)" value={draft.ageYears} onChange={(v) => set({ ageYears: v, safety: { ...draft.safety, under18: v !== null && v < 18 } })} />
            <NumInput label="Height (cm)" value={draft.heightCm} decimal onChange={(v) => set({ heightCm: v })} />
          </div>
          <RadioGroup
            legend="Which equation should the estimate use?"
            name="fuel-sex"
            description="Resting energy equations differ for male and female physiology. Choose the one that best fits your body, or skip it and set a target yourself."
            choices={[
              { value: 'male', label: 'Male equation' },
              { value: 'female', label: 'Female equation' },
              { value: 'unspecified', label: 'Prefer not to say — I’ll set targets manually' },
            ]}
            value={draft.equationSex}
            onChange={(v) => set({ equationSex: v })}
          />
          <fieldset className="field">
            <legend className="field-label">Does any of these apply? (optional)</legend>
            <p className="field-hint">If so, AdaptFit won't suggest a calorie deficit or target and will recommend professional guidance.</p>
            <div className="stack-sm">
              <Check label="Pregnant or breastfeeding" checked={draft.safety.pregnantOrBreastfeeding} onChange={(c) => set({ safety: { ...draft.safety, pregnantOrBreastfeeding: c } })} />
              <Check label="Current or past eating disorder" checked={draft.safety.eatingDisorderHistory} onChange={(c) => set({ safety: { ...draft.safety, eatingDisorderHistory: c } })} />
              <Check label="A medical condition that needs specialised nutrition (e.g. kidney disease, diabetes on medication)" checked={draft.safety.medicalCondition} onChange={(c) => set({ safety: { ...draft.safety, medicalCondition: c } })} />
            </div>
          </fieldset>
          {draft.safety.under18 && <p className="small amber">AdaptFit's estimates are designed for adults, so no calorie target will be suggested.</p>}
        </>
      )}

      {step === 1 && (
        <>
          {latest ? (
            <p className="small" data-testid="reused-bodyweight">
              Bodyweight: <strong className="num">{latestKg} kg</strong> <span className="muted">(from your bodyweight log, {latest.localDate})</span>
            </p>
          ) : (
            <TextInput label={`Current bodyweight (${unit})`} value={weightText} onChange={setWeightText} hint="Saved to Progress → Bodyweight so you won't be asked again." numeric />
          )}
          <p className="xs muted">
            Training: <span className="num">{sessionsPerWeek} × {minutes} min</span> per week, from your programme and settings. It's added separately so it isn't counted twice.
          </p>
          <RadioGroup
            legend="Outside training, how active is a typical day?"
            name="fuel-act"
            layout="cards"
            choices={ACTIVITY_LEVELS.map((a) => ({ value: a, label: ACTIVITY_LABEL[a].split(' (')[0]!, hint: ACTIVITY_LABEL[a].match(/\((.*)\)/)?.[1] }))}
            value={draft.activity ?? 'mostly-seated'}
            onChange={(v) => set({ activity: v })}
          />
          <div className="form-grid">
            <NumInput label="Average daily steps (optional)" value={draft.avgSteps} onChange={(v) => set({ avgSteps: v })} />
            <NumInput label="Known maintenance calories (optional)" value={draft.knownMaintenanceKcal} onChange={(v) => set({ knownMaintenanceKcal: v })} />
          </div>
          <Switch label="My job is physically demanding" checked={draft.physicalWork === true} onChange={(c) => set({ physicalWork: c })} />
          <RadioGroup legend="Nutrition goal" name="fuel-goal" choices={NUTRITION_GOALS.map((g) => ({ value: g, label: NUTRITION_GOAL_LABEL[g] }))} value={draft.goal ?? defaultNutritionGoal(data.profile.goal)} onChange={(v) => set({ goal: v, target: null })} />
        </>
      )}

      {step === 2 && <TargetsStep draft={draft} estimate={estimate} onChange={(target) => set({ target })} />}

      {step === 3 && (
        <>
          <RadioGroup
            legend="How do you usually get your meals?"
            name="fuel-src"
            layout="cards"
            choices={[
              { value: 'home', label: 'Mostly home-cooked' },
              { value: 'out', label: 'Mostly eating out' },
              { value: 'mixed', label: 'A mixture of both' },
            ]}
            value={draft.habits.source ?? 'mixed'}
            onChange={(v) => set({ habits: { ...draft.habits, source: v } })}
          />
          {(draft.habits.source ?? 'mixed') === 'mixed' && (
            <CheckboxGroup
              legend="Which meals do you usually cook? (optional)"
              name="fuel-cooked"
              description="The others are suggested as hawker or food-court options."
              choices={MEAL_SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] }))}
              values={draft.habits.cookedSlots}
              onChange={(v) => set({ habits: { ...draft.habits, source: 'mixed', cookedSlots: v } })}
            />
          )}
          <RadioGroup legend="Meals per day" name="fuel-mpd" choices={[1, 2, 3, 4, 5].map((m) => ({ value: m, label: String(m) }))} value={draft.habits.mealsPerDay ?? 3} onChange={(v) => set({ habits: { ...draft.habits, mealsPerDay: v } })} />
          <div className="form-grid">
            <NumInput label="Budget per meal (SGD, optional)" value={draft.habits.budgetPerMealSgd} decimal onChange={(v) => set({ habits: { ...draft.habits, budgetPerMealSgd: v } })} />
            <NumInput label="Cooking time available (min, optional)" value={draft.habits.cookingMinutes} onChange={(v) => set({ habits: { ...draft.habits, cookingMinutes: v } })} />
          </div>
          <TextInput label="Typical eating times (optional)" value={draft.habits.eatingTimes} onChange={(v) => set({ habits: { ...draft.habits, eatingTimes: v } })} hint="e.g. lunch 12:30, dinner 20:00" />
          <CheckboxGroup legend="Kitchen equipment (optional)" name="fuel-kit" choices={KITCHEN.map((k) => ({ value: k, label: k }))} values={draft.habits.kitchen as (typeof KITCHEN)[number][]} onChange={(v) => set({ habits: { ...draft.habits, kitchen: v } })} />
        </>
      )}

      {step === 4 && (
        <>
          <CheckboxGroup legend="Which cuisines do you enjoy?" name="fuel-cuisine" choices={CUISINES.map((c) => ({ value: c, label: CUISINE_LABEL[c] }))} values={draft.cuisines} onChange={(v) => set({ cuisines: v })} />
          <CheckboxGroup
            legend="Dietary requirements"
            name="fuel-diet"
            description="Applied strictly to every suggestion. Cuisine choices never imply halal status or religion."
            choices={DIET_FLAGS.map((d) => ({ value: d, label: DIET_LABEL[d] }))}
            values={draft.diet}
            onChange={(v) => set({ diet: v })}
          />
          <CheckboxGroup legend="Food allergies" name="fuel-allergy" choices={ALLERGENS.map((a) => ({ value: a, label: ALLERGEN_LABEL[a] }))} values={draft.allergens} onChange={(v) => set({ allergens: v })} />
          <CheckboxGroup legend="Food intolerances" name="fuel-intol" choices={ALLERGENS.map((a) => ({ value: a, label: ALLERGEN_LABEL[a] }))} values={draft.intolerances} onChange={(v) => set({ intolerances: v })} />
          <TextInput label="Foods you dislike (comma-separated)" value={draft.dislikes.join(', ')} onChange={(v) => set({ dislikes: splitList(v) })} />
          <TextInput label="Other ingredients to exclude (religious, ethical, or other)" value={draft.exclusions.join(', ')} onChange={(v) => set({ exclusions: splitList(v) })} />
          <TextInput label="Fasting schedule (optional)" value={draft.fasting ?? ''} onChange={(v) => set({ fasting: v.trim() ? v : null })} hint="e.g. Ramadan, 16:8. Set meals per day to match." />
        </>
      )}

      {step === 5 && <MealPreview draft={draft} />}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row wrap">
        {step > 0 && (
          <button type="button" className="btn btn-tertiary" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary btn-grow" onClick={next} data-testid="fuel-next">
          {step === STEPS.length - 1 ? 'Save nutrition profile' : step === 2 ? 'Use these targets' : 'Save and continue'}
        </button>
      </div>
      <button type="button" className="link-btn" onClick={finishLater}>
        {editingComplete ? 'Done editing' : 'Finish later'}
      </button>
    </section>
  );
}

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function TargetsStep({ draft, estimate, onChange }: { draft: NutritionProfile; estimate: ReturnType<typeof estimateEnergy>; onChange: (t: NutritionProfile['target']) => void }) {
  const now = () => clock.now().toISOString();
  const t = draft.target;
  const shown = t ?? targetFromEstimate(estimate, clock.now());
  const edit = (patch: Partial<NonNullable<NutritionProfile['target']>>) =>
    onChange({ kcal: shown?.kcal ?? null, proteinG: shown?.proteinG ?? (estimate.protein ?? null), carbsG: shown?.carbsG ?? null, fatG: shown?.fatG ?? null, ...patch, source: 'manual', updatedAt: now() });
  return (
    <>
      {estimate.kind === 'estimate' ? (
        <div className="stack-sm" data-testid="energy-estimate">
          <div className="metric-grid">
            <Metric label="Resting energy (est.)" value={estimate.restingKcal !== null ? `${estimate.restingKcal} kcal` : '—'} />
            <Metric label="Maintenance range (est.)" value={estimate.maintenance[0] === estimate.maintenance[1] ? `${estimate.maintenance[0]} kcal` : `${estimate.maintenance[0]}–${estimate.maintenance[1]} kcal`} />
            <Metric label="Suggested daily target" value={estimate.targetKcal !== null ? `${estimate.targetKcal} kcal` : '—'} />
            <Metric label="Protein" value={`${estimate.protein[0]}–${estimate.protein[1]} g`} />
          </div>
          <p className="small">{estimate.adjustment}</p>
        </div>
      ) : (
        <div className="status-banner amber" data-testid="manual-only">
          <IconInfo />
          <div>
            <span className="strong">Set targets manually</span>
            <p className="small muted">{estimate.reason}</p>
          </div>
        </div>
      )}
      <span className="section-label">Your targets (editable starting points)</span>
      <div className="form-grid">
        <NumInput label="Daily calories (kcal)" value={shown?.kcal ?? null} onChange={(v) => edit({ kcal: v })} testId="target-kcal" />
        <NumInput label="Protein from (g)" value={shown?.proteinG?.[0] ?? null} onChange={(v) => edit({ proteinG: v === null ? null : [v, Math.max(v, shown?.proteinG?.[1] ?? v)] })} />
        <NumInput label="Protein to (g)" value={shown?.proteinG?.[1] ?? null} onChange={(v) => edit({ proteinG: v === null ? null : [Math.min(v, shown?.proteinG?.[0] ?? v), v] })} />
        <NumInput label="Carbohydrates (g, optional)" value={shown?.carbsG ?? null} onChange={(v) => edit({ carbsG: v })} />
        <NumInput label="Fat (g, optional)" value={shown?.fatG ?? null} onChange={(v) => edit({ fatG: v })} />
      </div>
      {shown?.kcal && shown.proteinG && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit(macroSplit(shown.kcal!, Math.round((shown.proteinG![0] + shown.proteinG![1]) / 2)))}>
          Recalculate carbs and fat from calories
        </button>
      )}
      {t?.source === 'manual' && <p className="xs teal">Using your edited targets.</p>}
      <details className="disclosure">
        <summary>How this was calculated</summary>
        <ul className="bullet-list xs">
          {estimate.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="xs faint">Sources: {['mifflin-1990', 'issn-protein-2017', 'compendium-met'].map((id) => SOURCES_BY_ID.get(id)?.short).join('; ')}.</p>
      </details>
      <p className="xs muted">These are estimates, not a measurement of your metabolism. Revise them after 2–4 weeks based on your bodyweight trend.</p>
      {hasSafetyFlag(draft.safety) && <p className="xs amber">{SAFETY_MESSAGE}</p>}
    </>
  );
}

function MealPreview({ draft }: { draft: NutritionProfile }) {
  const { today } = useApp();
  const ctx = useMemo<CandidateContext>(() => ({ prefs: draft, proteinFocus: draft.target?.proteinG != null, favourites: draft.favourites }), [draft]);
  const plan = useMemo(() => suggestDay(today, ctx, clock.now()), [today, ctx]);
  return (
    <>
      <p className="small muted">A sample day from your preferences. After saving, you can swap meals, change portions, switch cook/buy, and save favourites.</p>
      <ul className="stack-sm" data-testid="meal-preview">
        {plan.items.map((i, idx) => {
          const meal = MEALS_BY_ID.get(i.mealId)!;
          return (
            <li key={`${i.slot}-${idx}`} className="row between small">
              <span>
                <span className="muted">{SLOT_LABEL[i.slot]}:</span> {meal.name}
              </span>
              <span className="pill">{i.mode === 'cook' ? 'Cook' : 'Buy'}</span>
            </li>
          );
        })}
      </ul>
      {plan.items.length === 0 && <p className="small amber">No meals in the catalogue match all your requirements. Try relaxing a preference (not an allergy) or add cuisines.</p>}
    </>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────

function FuelDashboard({ profile, onEdit }: { profile: NutritionProfile; onEdit: (step: number) => void }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const [variant, setVariant] = useState(0);
  const ctx = useMemo<CandidateContext>(() => ({ prefs: profile, proteinFocus: profile.target?.proteinG != null, favourites: profile.favourites }), [profile]);
  const stored = data.mealPlans.find((p) => p.localDate === today);
  const valid = stored && planRespectsPrefs(stored, profile) ? stored : null;
  const plan: MealPlan = useMemo(() => valid ?? suggestDay(today, ctx, clock.now(), variant), [valid, today, ctx, variant]);

  // Keep today's suggestion (and swaps) on the device; regenerate if preferences changed.
  useEffect(() => {
    if (!valid) void saveMealPlan(plan);
  }, [valid, plan]);

  const update = async (next: MealPlan, message: string) => {
    await saveMealPlan(next);
    announce(message);
  };
  const totals = dailyTotals(plan.items);
  const t = profile.target;

  const toggleFavourite = async (mealId: string) => {
    const has = profile.favourites.includes(mealId);
    await saveNutrition({ ...profile, favourites: has ? profile.favourites.filter((f) => f !== mealId) : [...profile.favourites, mealId], updatedAt: clock.now().toISOString() });
    announce(has ? 'Removed from favourites.' : 'Saved to favourites.');
  };

  return (
    <div className="grid-2">
      <div className="stack">
        <section className="card" aria-labelledby="targets-title" data-testid="fuel-targets">
          <div className="row between">
            <h2 id="targets-title" className="card-title">
              Daily targets
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(2)}>
              Edit
            </button>
          </div>
          <div className="metric-grid">
            <Metric label="Calories" value={t?.kcal ? `${t.kcal} kcal` : 'Not set'} />
            <Metric label="Protein" value={t?.proteinG ? `${t.proteinG[0]}–${t.proteinG[1]} g` : 'Not set'} />
            <Metric label="Carbs" value={t?.carbsG ? `${t.carbsG} g` : '—'} />
            <Metric label="Fat" value={t?.fatG ? `${t.fatG} g` : '—'} />
          </div>
          <p className="xs muted">{t?.source === 'manual' ? 'Set by you.' : 'Estimated starting point.'} You don't need to track meals — use these as a guide.</p>
          {hasSafetyFlag(profile.safety) && <p className="xs amber">{SAFETY_MESSAGE}</p>}
        </section>

        <section className="card" aria-labelledby="meals-title">
          <div className="row between wrap">
            <h2 id="meals-title" className="card-title">
              Today's meal ideas
            </h2>
            <button
              type="button"
              className="btn btn-tertiary btn-sm"
              onClick={async () => {
                const v = variant + 1;
                setVariant(v);
                await update(suggestDay(today, ctx, clock.now(), v), 'New suggestions ready.');
              }}
            >
              <IconRepeat size={16} /> Another suggestion
            </button>
          </div>
          {plan.items.length === 0 ? (
            <p className="small amber">No meals in the catalogue match all your requirements. Try adding cuisines or adjusting non-allergy preferences.</p>
          ) : (
            <ul className="stack" data-testid="meal-plan">
              {plan.items.map((item, idx) => (
                <MealCard
                  key={`${item.slot}-${idx}`}
                  meal={MEALS_BY_ID.get(item.mealId)!}
                  slot={item.slot}
                  mode={item.mode}
                  portion={item.portion}
                  favourite={profile.favourites.includes(item.mealId)}
                  notes={dietaryNotes(MEALS_BY_ID.get(item.mealId)!, profile)}
                  onSwap={() => update(swapMeal(plan, idx, ctx, clock.now()), 'Meal swapped.')}
                  onMode={(m) => update(swapMeal(plan, idx, ctx, clock.now(), m), m === 'cook' ? 'Switched to a home-cooked option.' : 'Switched to an eating-out option.')}
                  onPortion={(p) => update(setPortion(plan, idx, p, clock.now()), `Portion set to ${p}×.`)}
                  onFavourite={() => toggleFavourite(item.mealId)}
                />
              ))}
            </ul>
          )}
          <div className="totals" data-testid="daily-totals">
            <span className="section-label">Estimated total</span>
            {totals.counted === 0 ? (
              <p className="small muted">Nutrition estimate unavailable for today's suggestions.</p>
            ) : (
              <p className="small">
                <span className="num">
                  {totals.kcal} kcal · {totals.protein} g protein · {totals.carbs} g carbs · {totals.fat} g fat
                </span>{' '}
                <span className="muted">
                  (covers {totals.counted} of {totals.total} {totals.total === 1 ? 'meal' : 'meals'})
                </span>
              </p>
            )}
            {totals.notCounted.length > 0 && <p className="xs muted">Not included — no sourced estimate: {totals.notCounted.join(', ')}.</p>}
          </div>
        </section>
      </div>

      <div className="stack sticky-col">
        <section className="card">
          <div className="row between">
            <h2 className="card-title">Preferences</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(3)}>
              Edit
            </button>
          </div>
          <ul className="bullet-list small">
            <li>{profile.habits.source === 'home' ? 'Mostly home-cooked' : profile.habits.source === 'out' ? 'Mostly eating out' : 'Mix of cooking and eating out'}</li>
            <li>Cuisines: {profile.cuisines.length ? profile.cuisines.map((c) => CUISINE_LABEL[c]).join(', ') : 'any'}</li>
            <li>Requirements: {profile.diet.length ? profile.diet.map((d) => DIET_LABEL[d]).join(', ') : 'none'}</li>
            <li>Avoiding: {[...profile.allergens, ...profile.intolerances].length ? [...new Set([...profile.allergens, ...profile.intolerances])].map((a) => ALLERGEN_LABEL[a]).join(', ') : 'nothing listed'}</li>
          </ul>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onEdit(0)}>
            Recalculate targets
          </button>
        </section>
        {profile.favourites.length > 0 && (
          <section className="card">
            <h2 className="card-title row">
              <IconStar size={18} /> Favourites
            </h2>
            <ul className="bullet-list small">
              {profile.favourites.map((id) => (
                <li key={id}>{MEALS_BY_ID.get(id)?.name ?? 'Removed meal'}</li>
              ))}
            </ul>
          </section>
        )}
        <p className="xs faint">
          Home-recipe estimates use USDA FoodData Central ingredient data (public domain). Hawker dishes vary by stall and show “Nutrition estimate unavailable” rather than a guess. AdaptFit never states that a dish or outlet is halal-certified. No XP is ever given for eating less or skipping meals.
        </p>
      </div>
    </div>
  );
}

function MealCard(props: {
  meal: Meal;
  slot: keyof typeof SLOT_LABEL;
  mode: 'cook' | 'buy';
  portion: number;
  favourite: boolean;
  notes: string[];
  onSwap: () => void;
  onMode: (m: 'cook' | 'buy') => void;
  onPortion: (p: number) => void;
  onFavourite: () => void;
}) {
  const { meal, slot, mode, portion, favourite, notes } = props;
  const n = mealNutrition(meal, portion);
  return (
    <li className="meal-card" data-testid="meal-card" data-meal={meal.id}>
      <div className="row between wrap">
        <span className="eyebrow">
          {SLOT_LABEL[slot]} · {CUISINE_LABEL[meal.cuisine]}
        </span>
        <div className="tabs tabs-sm" role="group" aria-label={`${SLOT_LABEL[slot]}: cook or buy`}>
          <button type="button" className="tab" aria-pressed={mode === 'cook'} onClick={() => mode !== 'cook' && props.onMode('cook')}>
            Cook
          </button>
          <button type="button" className="tab" aria-pressed={mode === 'buy'} onClick={() => mode !== 'buy' && props.onMode('buy')}>
            Buy
          </button>
        </div>
      </div>
      <h3 className="meal-name">{meal.name}</h3>
      <p className="xs muted">
        {meal.portion}
        {meal.kind === 'home' ? ` · ~${meal.cookMinutes} min` : ''}
      </p>
      <p className="small" data-testid="meal-nutrition">
        {n.quality === 'unavailable' ? (
          <span className="muted">Nutrition estimate unavailable</span>
        ) : (
          <span className="num">
            ~{n.kcal} kcal · {n.protein} g protein · {n.carbs} g carbs · {n.fat} g fat
            {n.quality === 'partial' && <span className="muted"> (partial: excludes {n.excluded.join(', ')})</span>}
          </span>
        )}
      </p>
      {notes.map((x) => (
        <p key={x} className="xs muted">
          {x}
        </p>
      ))}
      <details className="disclosure">
        <summary>{meal.kind === 'home' ? 'Ingredients and steps' : 'Ordering tips'}</summary>
        {meal.kind === 'home' ? (
          <>
            <ul className="bullet-list xs">
              {meal.ingredients.map((i) => (
                <li key={i.ingredientId}>
                  {portion === 1 ? i.label : `${i.label} × ${portion}`}
                </li>
              ))}
              {meal.seasonings.length > 0 && <li className="muted">To taste (not counted): {meal.seasonings.join(', ')}</li>}
            </ul>
            <ol className="bullet-list xs">
              {meal.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {meal.substitutions.length > 0 && <p className="xs muted">Swaps: {meal.substitutions.join(' · ')}</p>}
          </>
        ) : (
          <>
            {meal.proteinAdditions.length > 0 && <p className="xs">More protein: {meal.proteinAdditions.join(' · ')}</p>}
            {meal.modifications.length > 0 && <p className="xs">Tweaks: {meal.modifications.join(' · ')}</p>}
            {meal.notes.map((x) => (
              <p key={x} className="xs muted">
                {x}
              </p>
            ))}
          </>
        )}
      </details>
      <div className="row wrap">
        <div className="row" role="group" aria-label={`Portion for ${meal.name}`}>
          <button type="button" className="step-btn" aria-label="Smaller portion" disabled={portion <= 0.5} onClick={() => props.onPortion(portion - 0.25)}>
            <IconMinus size={16} />
          </button>
          <span className="small num" style={{ minWidth: 48, textAlign: 'center' }} aria-live="polite">
            {portion}×
          </span>
          <button type="button" className="step-btn" aria-label="Larger portion" disabled={portion >= 2} onClick={() => props.onPortion(portion + 0.25)}>
            <IconPlus size={16} />
          </button>
        </div>
        <button type="button" className="btn btn-tertiary btn-sm" onClick={props.onSwap}>
          <IconRepeat size={16} /> Swap
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={favourite} onClick={props.onFavourite}>
          <IconStar size={16} /> {favourite ? 'Saved' : 'Favourite'}
        </button>
      </div>
    </li>
  );
}

// ── Small inputs ────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="xs muted">{label}</span>
      <span className="metric-val num">{value}</span>
    </div>
  );
}

function NumInput({ label, value, onChange, decimal, testId }: { label: string; value: number | null; onChange: (v: number | null) => void; decimal?: boolean; testId?: string }) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    setText((prev) => (Number(prev.replace(',', '.')) === value ? prev : value === null ? '' : String(value)));
  }, [value]);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input input-num"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={text}
        data-testid={testId}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const clean = t.trim().replace(',', '.');
          if (clean === '') return onChange(null);
          if ((decimal ? /^\d+(\.\d*)?$/ : /^\d+$/).test(clean)) onChange(Number(clean));
        }}
      />
    </div>
  );
}

function TextInput({ label, value, onChange, hint, numeric }: { label: string; value: string; onChange: (v: string) => void; hint?: string; numeric?: boolean }) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="input" inputMode={numeric ? 'decimal' : undefined} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? hintId : undefined} />
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="small">{label}</span>
    </label>
  );
}

