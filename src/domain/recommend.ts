import { EXERCISES_BY_ID } from '../content/exercises';
import { TEMPLATES } from '../content/templates';
import {
  availableItems,
  estimatePlanSeconds,
  EXPERIENCE_RANK,
  experienceAllows,
  hasEquipment,
  planEquipment,
  secondsToMinutesCeil,
  TIME_BANDS,
  timeBandOf,
} from './catalog';
import type {
  CheckIn,
  Emphasis,
  EquipmentItem,
  EquipmentMode,
  Exercise,
  Experience,
  Goal,
  TrainingGoal,
  Plan,
  PlanItem,
  Profile,
  Reason,
  ReasonCode,
  Recommendation,
  RecommendationInputs,
  TemplateBlock,
  TimeBand,
  WorkoutSession,
  WorkoutTemplate,
} from './types';

export interface Catalog {
  exercises: ReadonlyMap<string, Exercise>;
  templates: readonly WorkoutTemplate[];
}

export const DEFAULT_CATALOG: Catalog = { exercises: EXERCISES_BY_ID, templates: TEMPLATES };

export interface RecommendContext {
  checkIn: Pick<CheckIn, 'availableMinutes' | 'energy' | 'soreness' | 'equipment' | 'safetyConcern'>;
  profile: { goal: Goal | TrainingGoal; experience: Profile['experience'] };
  /** Sessions used for the recent-emphasis rule; only completed ones count. */
  sessions: readonly Pick<WorkoutSession, 'state' | 'completedAt' | 'emphasis'>[];
  now: Date;
  catalog?: Catalog;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const REASON_LABEL: Record<ReasonCode, string> = {
  'safety-rest': 'Safety check: rest today',
  'too-little-time': 'Under 5 minutes available',
  'time-band': 'Fits your time',
  'time-band-fallback': 'Shorter plan that fits',
  'low-energy': 'Low energy',
  'high-soreness': 'High soreness',
  'reduced-volume': 'Fewer sets, gentler pace',
  'gentle-fallback': 'Gentle option',
  'high-energy': 'High energy',
  'equipment-substitution': 'Swapped for your equipment',
  'experience-substitution': 'Adjusted for your experience',
  'bodyweight-fallback': 'Bodyweight fallback',
  'recent-emphasis-avoided': 'Different focus from your last session',
  'recent-emphasis-gentle': 'Gentle option after recent training',
  'goal-fit': 'Matches your goal',
  'no-fitting-template': 'No plan fits today',
};

function reason(code: ReasonCode, label?: string): Reason {
  return { code, label: label ?? REASON_LABEL[code] };
}

export const EMPHASIS_LABEL: Record<Emphasis, string> = {
  upper: 'upper-body',
  lower: 'lower-body',
  full: 'full-body',
  conditioning: 'conditioning',
};

/** Map V0.2 training goals onto the quick-workout templates' goal fit. */
export function templateGoal(goal: Goal | TrainingGoal): Goal {
  if (goal === 'hypertrophy' || goal === 'recomposition') return 'strength';
  if (goal === 'fat-loss') return 'general';
  return goal;
}

export const GOAL_LABEL: Record<Goal, string> = {
  strength: 'build strength',
  consistency: 'build consistency',
  general: 'general fitness',
};

interface ResolvedTemplate {
  template: WorkoutTemplate;
  plan: Plan;
  minutes: number;
  equipmentSubs: number;
  experienceSubs: number;
}

function exerciseUsable(ex: Exercise, available: ReadonlySet<EquipmentItem>, experience: Experience): boolean {
  return hasEquipment(ex, available) && experienceAllows(ex.minExperience, experience);
}

export function buildPlanItem(
  key: string,
  ex: Exercise,
  prescription: { sets: number; restSec: number; reps?: number | null; durationSec?: number | null; mode?: Exercise['mode'] },
  substitutedFrom: string | null,
): PlanItem {
  const sameMode = prescription.mode === undefined || prescription.mode === ex.mode;
  return {
    key,
    exerciseId: ex.id,
    name: ex.name,
    mode: ex.mode,
    tags: [...ex.tags],
    loadable: ex.loadable,
    equipment: [...ex.equipment],
    sets: prescription.sets,
    reps: ex.mode === 'reps' ? ((sameMode ? prescription.reps : null) ?? ex.defaultReps) : null,
    durationSec: ex.mode === 'timed' ? ((sameMode ? prescription.durationSec : null) ?? ex.defaultDurationSec) : null,
    restSec: prescription.restSec,
    cue: ex.cue,
    substitutedFrom,
  };
}

export function estimateMinutes(warmupSec: number, items: readonly PlanItem[], exercises: ReadonlyMap<string, Exercise>): number {
  return secondsToMinutesCeil(
    estimatePlanSeconds(warmupSec, items, (id) => exercises.get(id)?.secondsPerRep ?? 3),
  );
}

function blockPrescription(block: TemplateBlock, original: Exercise) {
  return {
    sets: block.sets,
    restSec: block.restSec,
    reps: block.reps ?? null,
    durationSec: block.durationSec ?? null,
    mode: original.mode,
  };
}

/** Resolve a template against available equipment and experience, applying safe substitutions. */
export function resolveTemplate(
  template: WorkoutTemplate,
  equipment: readonly EquipmentMode[],
  experience: Experience,
  exercises: ReadonlyMap<string, Exercise>,
): ResolvedTemplate | null {
  if (!experienceAllows(template.minExperience, experience)) return null;
  const available = availableItems(equipment);
  let equipmentSubs = 0;
  let experienceSubs = 0;
  const items: PlanItem[] = [];

  for (const [index, block] of template.blocks.entries()) {
    const original = exercises.get(block.exerciseId);
    if (!original) return null;
    const key = `${template.id}:${index}`;
    if (exerciseUsable(original, available, experience)) {
      items.push(buildPlanItem(key, original, blockPrescription(block, original), null));
      continue;
    }
    const sub = original.substitutions
      .map((id) => exercises.get(id))
      .find((candidate): candidate is Exercise => !!candidate && exerciseUsable(candidate, available, experience));
    if (!sub) return null;
    if (!hasEquipment(original, available)) equipmentSubs += 1;
    else experienceSubs += 1;
    items.push(buildPlanItem(key, sub, blockPrescription(block, original), original.id));
  }

  const minutes = estimateMinutes(template.warmupSec, items, exercises);
  const plan: Plan = {
    templateId: template.id,
    name: template.name,
    emphasis: template.emphasis,
    intensity: template.intensity,
    warmupSec: template.warmupSec,
    estimatedMinutes: minutes,
    equipment: planEquipment(items),
    optionalEquipment: [...template.optionalEquipment],
    items,
  };
  return { template, plan, minutes, equipmentSubs, experienceSubs };
}

export function recentEmphases(
  sessions: RecommendContext['sessions'],
  now: Date,
): Emphasis[] {
  const nowMs = now.getTime();
  const set = new Set<Emphasis>();
  for (const s of sessions) {
    if (s.state !== 'completed' || !s.completedAt) continue;
    const t = Date.parse(s.completedAt);
    if (s.emphasis && t <= nowMs && nowMs - t < DAY_MS) set.add(s.emphasis);
  }
  return [...set].sort();
}

function describeInputs(inputs: RecommendationInputs): string {
  const parts = [`${inputs.availableMinutes} minute${inputs.availableMinutes === 1 ? '' : 's'}`];
  if (inputs.energy !== 'medium') parts.push(`${inputs.energy} energy`);
  if (inputs.soreness === 'high') parts.push('high soreness');
  else if (inputs.soreness === 'mild') parts.push('mild soreness');
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `You have ${joined} today`;
}

function workoutRationale(inputs: RecommendationInputs, plan: Plan, codes: Set<ReasonCode>): string {
  const lead = describeInputs(inputs);
  let consequence: string;
  if (codes.has('reduced-volume')) consequence = 'so this plan uses fewer sets and a gentler pace.';
  else if (codes.has('recent-emphasis-gentle'))
    consequence = 'and you trained this focus in the last 24 hours, so this is a gentle full-body option.';
  else if (codes.has('recent-emphasis-avoided'))
    consequence = `so this ${plan.estimatedMinutes}-minute plan focuses on ${EMPHASIS_LABEL[plan.emphasis]} work, different from your last session.`;
  else if (codes.has('gentle-fallback')) consequence = 'so this is a gentler plan that fits.';
  else consequence = `so this ${plan.estimatedMinutes}-minute ${EMPHASIS_LABEL[plan.emphasis]} plan fits your goal to ${GOAL_LABEL[inputs.goal]}.`;
  const extras: string[] = [];
  if (codes.has('bodyweight-fallback')) extras.push('It uses bodyweight because no equipment plan fit.');
  else if (codes.has('equipment-substitution')) extras.push('Some exercises were swapped to match your equipment.');
  if (codes.has('experience-substitution')) extras.push('Some exercises were adjusted for your experience level.');
  return [`${lead}, ${consequence}`, ...extras].join(' ');
}

const SAFETY_TEXT = { pain: 'pain', illness: 'feeling ill', unsafe: 'not feeling safe to train' } as const;

function rest(
  cause: 'safety' | 'time' | 'no-fit',
  reasons: Reason[],
  rationale: string,
  inputs: RecommendationInputs,
): Recommendation {
  return { kind: 'rest', cause, reasons, rationale, inputs };
}

const BAND_ORDER: Record<TimeBand, number> = { '5-14': 0, '15-29': 1, '30-60': 2 };
const MODE_RANK: Record<EquipmentMode, number> = { bodyweight: 0, dumbbells: 1, gym: 2 };
const BODYWEIGHT_FALLBACK_TIER = 3;

/**
 * Deterministic rules engine. Rules apply in order:
 * safety → time → energy/soreness → equipment/experience → recent emphasis → goal & tie-break.
 */
export function recommend(ctx: RecommendContext): Recommendation {
  const catalog = ctx.catalog ?? DEFAULT_CATALOG;
  const { checkIn, profile, now } = ctx;
  const equipment: EquipmentMode[] = checkIn.equipment.includes('bodyweight')
    ? [...checkIn.equipment]
    : ['bodyweight', ...checkIn.equipment];
  const availableMinutes = Math.floor(checkIn.availableMinutes);
  const band = timeBandOf(availableMinutes);
  const recent = recentEmphases(ctx.sessions, now);
  const inputs: RecommendationInputs = {
    availableMinutes,
    timeBand: band,
    energy: checkIn.energy,
    soreness: checkIn.soreness,
    equipment: [...equipment].sort(),
    experience: profile.experience,
    goal: templateGoal(profile.goal),
    recentEmphasis: recent,
  };

  // 1. Safety flag takes precedence over everything.
  if (checkIn.safetyConcern) {
    return rest(
      'safety',
      [reason('safety-rest')],
      `You noted ${SAFETY_TEXT[checkIn.safetyConcern]}, so today is a rest day. Take it easy, and if it persists or worries you, consider checking in with a qualified health professional.`,
      inputs,
    );
  }

  // 2. Time.
  if (!band) {
    return rest(
      'time',
      [reason('too-little-time')],
      'Under 5 minutes is too short for a useful session. Rest today, or check in again later if more time opens up.',
      inputs,
    );
  }

  const reasons: Reason[] = [];
  const reduced = checkIn.energy === 'low' || checkIn.soreness === 'high';
  if (checkIn.energy === 'low') reasons.push(reason('low-energy'));
  if (checkIn.soreness === 'high') reasons.push(reason('high-soreness'));

  const resolved = catalog.templates
    .map((t) => resolveTemplate(t, equipment, profile.experience, catalog.exercises))
    .filter((r): r is ResolvedTemplate => r !== null && r.minutes <= availableMinutes);

  const noFit = (): Recommendation =>
    rest(
      'no-fit',
      [...reasons, reason('no-fitting-template')],
      `${describeInputs(inputs)}, and no suitable plan fits that right now, so rest is the best choice. You can edit your check-in if anything changes.`,
      inputs,
    );

  // 3. Energy and soreness.
  let pool: ResolvedTemplate[];
  if (reduced) {
    pool = resolved.filter((r) => r.template.intensity === 'gentle');
    if (pool.length === 0) return noFit();
    reasons.push(reason('reduced-volume'));
  } else {
    const allowHard = checkIn.energy === 'high' && EXPERIENCE_RANK[profile.experience] >= EXPERIENCE_RANK.intermediate;
    pool = resolved.filter((r) => r.template.intensity === 'moderate' || (allowHard && r.template.intensity === 'hard'));
    if (pool.length === 0) {
      pool = resolved.filter((r) => r.template.intensity === 'gentle');
      if (pool.length === 0) return noFit();
      reasons.push(reason('gentle-fallback'));
    }
  }

  // 4. Equipment & experience — already filtered by resolveTemplate. Prefer
  // plans written for the user's richest equipment, then other equipment they
  // have, then plans needing substitutions, then the bodyweight fallback.
  const userMaxRank = Math.max(...equipment.map((m) => MODE_RANK[m]));
  const tierOf = (r: ResolvedTemplate): number => {
    if (userMaxRank > 0 && r.template.mode === 'bodyweight') return BODYWEIGHT_FALLBACK_TIER;
    if (r.equipmentSubs > 0) return 2;
    return userMaxRank - MODE_RANK[r.template.mode] > 0 ? 1 : 0;
  };

  // 5. Recent training.
  if (recent.length > 0) {
    const recentSet = new Set(recent);
    const fresh = pool.filter((r) => !recentSet.has(r.template.emphasis));
    if (fresh.length > 0 && fresh.length < pool.length) {
      pool = fresh;
      reasons.push(reason('recent-emphasis-avoided'));
    } else if (fresh.length === 0) {
      const gentleFull = resolved.filter((r) => r.template.intensity === 'gentle' && r.template.emphasis === 'full');
      if (gentleFull.length === 0) return noFit();
      pool = gentleFull;
      reasons.push(reason('recent-emphasis-gentle'));
    }
  }

  // Time band: prefer plans in the user's band, falling back to shorter bands.
  const userBandIdx = BAND_ORDER[band];
  let chosenBand: TimeBand | null = null;
  for (let i = userBandIdx; i >= 0; i--) {
    const b = TIME_BANDS[i]!;
    if (pool.some((r) => (timeBandOf(r.minutes) ?? '5-14') === b)) {
      chosenBand = b;
      break;
    }
  }
  if (!chosenBand) return noFit();
  pool = pool.filter((r) => (timeBandOf(r.minutes) ?? '5-14') === chosenBand);

  // Within the chosen band, prefer the best equipment tier.
  const minTier = Math.min(...pool.map(tierOf));
  pool = pool.filter((r) => tierOf(r) === minTier);

  // 6. Goal fit, then time fit, then stable template ID.
  const goal = templateGoal(profile.goal);
  pool.sort(
    (a, b) =>
      b.template.goalFit[goal] - a.template.goalFit[goal] ||
      b.minutes - a.minutes ||
      (a.template.id < b.template.id ? -1 : a.template.id > b.template.id ? 1 : 0),
  );
  const best = pool[0]!;

  reasons.push(
    chosenBand === band
      ? reason('time-band', `Fits ${availableMinutes} min`)
      : reason('time-band-fallback'),
  );
  if (checkIn.energy === 'high' && best.template.intensity === 'hard') reasons.push(reason('high-energy'));
  if (minTier === BODYWEIGHT_FALLBACK_TIER) reasons.push(reason('bodyweight-fallback'));
  else if (best.equipmentSubs > 0) reasons.push(reason('equipment-substitution'));
  if (best.experienceSubs > 0) reasons.push(reason('experience-substitution'));
  if (best.template.goalFit[goal] >= 2) reasons.push(reason('goal-fit', `Fits goal: ${GOAL_LABEL[goal]}`));

  const codes = new Set(reasons.map((r) => r.code));
  return {
    kind: 'workout',
    plan: best.plan,
    reasons,
    rationale: workoutRationale(inputs, best.plan, codes),
    inputs,
  };
}

export interface SwapOption {
  exerciseId: string;
  name: string;
  estimatedMinutes: number;
  equipment: EquipmentItem[];
}

export interface SwapContext {
  equipment: readonly EquipmentMode[];
  experience: Experience;
  availableMinutes: number;
  catalog?: Catalog;
}

function withBodyweight(modes: readonly EquipmentMode[]): EquipmentMode[] {
  return modes.includes('bodyweight') ? [...modes] : ['bodyweight', ...modes];
}

/** Safe alternatives for a plan slot, with recalculated duration that still fits. */
export function swapOptions(plan: Plan, itemKey: string, ctx: SwapContext): SwapOption[] {
  const catalog = ctx.catalog ?? DEFAULT_CATALOG;
  const item = plan.items.find((i) => i.key === itemKey);
  if (!item) return [];
  const available = availableItems(withBodyweight(ctx.equipment));
  const originalId = item.substitutedFrom ?? item.exerciseId;
  const candidateIds = new Set<string>([originalId]);
  for (const id of catalog.exercises.get(originalId)?.substitutions ?? []) candidateIds.add(id);
  for (const id of catalog.exercises.get(item.exerciseId)?.substitutions ?? []) candidateIds.add(id);
  candidateIds.delete(item.exerciseId);

  const options: SwapOption[] = [];
  for (const id of candidateIds) {
    const ex = catalog.exercises.get(id);
    if (!ex || !exerciseUsable(ex, available, ctx.experience)) continue;
    const next = applySwap(plan, itemKey, id, catalog);
    if (!next || next.estimatedMinutes > ctx.availableMinutes) continue;
    options.push({ exerciseId: id, name: ex.name, estimatedMinutes: next.estimatedMinutes, equipment: [...ex.equipment] });
  }
  return options;
}

/** Replace one slot's exercise, recalculating the estimate and equipment. */
export function applySwap(plan: Plan, itemKey: string, exerciseId: string, catalog: Catalog = DEFAULT_CATALOG): Plan | null {
  const ex = catalog.exercises.get(exerciseId);
  const item = plan.items.find((i) => i.key === itemKey);
  if (!ex || !item) return null;
  const originalId = item.substitutedFrom ?? item.exerciseId;
  const replacement = buildPlanItem(
    item.key,
    ex,
    { sets: item.sets, restSec: item.restSec, reps: item.reps, durationSec: item.durationSec, mode: item.mode },
    exerciseId === originalId ? null : originalId,
  );
  const items = plan.items.map((i) => (i.key === itemKey ? replacement : i));
  return {
    ...plan,
    items,
    equipment: planEquipment(items),
    estimatedMinutes: estimateMinutes(plan.warmupSec, items, catalog.exercises),
  };
}

/** Validate that a swap is allowed in the given context. */
export function isValidSwap(plan: Plan, itemKey: string, exerciseId: string, ctx: SwapContext): boolean {
  return swapOptions(plan, itemKey, ctx).some((o) => o.exerciseId === exerciseId);
}
