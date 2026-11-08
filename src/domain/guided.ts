import { EXERCISES_BY_ID } from '../content/exercises';
import {
  ACCESS_EQUIPMENT,
  EXERCISE_MUSCLES,
  MUSCLE_LABEL,
  type Muscle,
  NEEDS_PULLUP_BAR,
  PRIORITY_MUSCLES,
  PROGRAMME_TEMPLATES,
  type ProgrammeTemplate,
  type TemplateSlot,
} from '../content/programmeLibrary';
import { createProgramme, estimateDayMinutes, programmeExercise, shortenDay } from './programme';
import type { EquipmentAccess, EquipmentMode, Experience, MusclePriority, Profile, Programme, ProgrammeDay, TrainingGoal } from './types';

/**
 * Guided programme recommendation (V0.3). Deterministic and local: the same
 * answers always produce the same ranked shortlist, with reasons and
 * trade-offs. Nothing is saved until the user approves a programme.
 */

type IdFn = () => string;

export interface GuidedAnswers {
  goal: TrainingGoal;
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes: number;
  preferredWeekdays: number[];
  equipment: EquipmentAccess;
  priorities: MusclePriority[];
  avoidExerciseIds: string[];
}

const EXP_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Best guess at equipment access from the V0.1/V0.2 profile equipment modes. */
export function accessFromModes(modes: readonly EquipmentMode[]): EquipmentAccess {
  if (modes.includes('gym')) return 'full-gym';
  if (modes.includes('dumbbells')) return 'dumbbells-bench';
  return 'bodyweight';
}

/** Equipment modes implied by an access answer (keeps the quick-workout engine consistent). */
export function modesFromAccess(access: EquipmentAccess): EquipmentMode[] {
  if (access === 'full-gym') return ['bodyweight', 'dumbbells', 'gym'];
  if (access === 'bodyweight') return ['bodyweight'];
  return ['bodyweight', 'dumbbells'];
}

/** Defaults reused from what the user already told AdaptFit. */
export function defaultAnswers(profile: Profile, programme: Programme | null): GuidedAnswers {
  const prefs = profile.trainingPrefs;
  const minutes = [30, 45, 60, 75, 90].reduce((best, m) => (Math.abs(m - profile.preferredMinutes) < Math.abs(best - profile.preferredMinutes) ? m : best), 60);
  return {
    goal: profile.goal,
    experience: profile.experience,
    daysPerWeek: programme?.daysPerWeek ?? prefs.daysPerWeek ?? 3,
    sessionMinutes: minutes,
    preferredWeekdays: profile.lifestyle.training?.preferredDays.length ? [...profile.lifestyle.training.preferredDays] : (programme?.preferredWeekdays ?? []),
    equipment: prefs.equipmentAccess ?? accessFromModes(profile.equipment),
    priorities: [...prefs.priorities],
    avoidExerciseIds: [...prefs.avoidExerciseIds],
  };
}

export function exerciseAllowed(exerciseId: string, answers: Pick<GuidedAnswers, 'equipment' | 'experience' | 'avoidExerciseIds'>): boolean {
  const ex = EXERCISES_BY_ID.get(exerciseId);
  if (!ex) return false;
  if (answers.avoidExerciseIds.includes(exerciseId)) return false;
  if (EXP_RANK[ex.minExperience] > EXP_RANK[answers.experience]) return false;
  if (NEEDS_PULLUP_BAR.has(exerciseId) && answers.equipment !== 'full-gym') return false;
  const available = ACCESS_EQUIPMENT[answers.equipment];
  return ex.equipment.every((item) => available.includes(item));
}

/** Allowed options for a slot, in preference order. */
export function slotOptions(slot: TemplateSlot, answers: Pick<GuidedAnswers, 'equipment' | 'experience' | 'avoidExerciseIds'>): string[] {
  return slot.options.filter((id) => exerciseAllowed(id, answers));
}

export function musclesOf(exerciseId: string): readonly Muscle[] {
  return EXERCISE_MUSCLES[exerciseId] ?? [];
}

export interface GeneratedDay {
  day: ProgrammeDay;
  /** Allowed alternatives per programme-exercise ID (for swaps). */
  alternatives: Record<string, string[]>;
  droppedSlots: string[];
}

/** Build editable programme days from a template for the user's equipment and preferences. */
export function generateDays(template: ProgrammeTemplate, answers: GuidedAnswers, newId: IdFn): GeneratedDay[] {
  const priorityMuscles = new Set(answers.priorities.flatMap((p) => (p === 'full-body' ? [] : PRIORITY_MUSCLES[p])));
  return template.days.map((td) => {
    const used = new Set<string>();
    const alternatives: Record<string, string[]> = {};
    const droppedSlots: string[] = [];
    const exercises = td.slots.flatMap((slot) => {
      const options = slotOptions(slot, answers).filter((id) => !used.has(id));
      const chosen = options[0];
      if (!chosen) {
        droppedSlots.push(slot.pattern);
        return [];
      }
      used.add(chosen);
      const lib = EXERCISES_BY_ID.get(chosen)!;
      const timed = lib.mode === 'timed';
      const prioritised = slot.priority === true || musclesOf(chosen).some((m) => priorityMuscles.has(m));
      const pe = programmeExercise(newId, {
        exerciseId: chosen,
        sets: slot.sets,
        repMin: timed ? null : slot.repMin,
        repMax: timed ? null : slot.repMax,
        durationSec: timed ? (slot.durationSec ?? lib.defaultDurationSec) : null,
        restSec: slot.restSec,
        priority: prioritised,
      });
      alternatives[pe.id] = options.slice(1);
      return [pe];
    });
    return { day: { id: newId(), name: td.name, exercises }, alternatives, droppedSlots };
  });
}

/** Working sets per muscle per week (primary muscles only). */
export function weeklyDistribution(days: readonly ProgrammeDay[], daysPerWeek: number): { muscle: Muscle; label: string; sets: number }[] {
  const perCycle = new Map<Muscle, number>();
  for (const d of days) for (const e of d.exercises) for (const m of musclesOf(e.exerciseId)) perCycle.set(m, (perCycle.get(m) ?? 0) + e.sets);
  // A cycle of N days run `daysPerWeek` times a week.
  const factor = days.length ? daysPerWeek / days.length : 0;
  return [...perCycle.entries()]
    .map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABEL[muscle], sets: Math.round(sets * factor * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label));
}

export interface TemplateRecommendation {
  template: ProgrammeTemplate;
  score: number;
  /** True when the template needs more days than the user has. */
  dayMismatch: boolean;
  days: ProgrammeDay[];
  alternatives: Record<string, string[]>;
  /** Longest estimated session after fitting to the user's time. */
  estimatedMinutes: number;
  fitsTime: boolean;
  trimmed: boolean;
  reasons: string[];
  tradeoffs: string[];
  distribution: { muscle: Muscle; label: string; sets: number }[];
}

/** Evaluate one template against the answers. */
export function evaluateTemplate(template: ProgrammeTemplate, answers: GuidedAnswers, newId: IdFn): TemplateRecommendation {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];
  let score = 0;

  // Days per week — the most important practical constraint.
  const dayMismatch = template.daysPerWeek > answers.daysPerWeek;
  if (template.daysPerWeek === answers.daysPerWeek) {
    score += 30;
    reasons.push(`Matches the ${answers.daysPerWeek} days a week you can realistically train.`);
  } else if (!dayMismatch) {
    score += 20 - (answers.daysPerWeek - template.daysPerWeek) * 4;
    reasons.push(`Needs ${template.daysPerWeek} of your ${answers.daysPerWeek} available days, leaving room for rest or busy weeks.`);
  } else {
    score -= 40 * (template.daysPerWeek - answers.daysPerWeek);
    tradeoffs.push(
      `Needs ${template.daysPerWeek} days a week but you said ${answers.daysPerWeek}. Running it on fewer days would mean skipping sessions every week, so it is not recommended unless your availability changes.`,
    );
  }

  // Goal fit.
  const fit = template.goalFit[answers.goal];
  score += fit * 8;
  if (fit >= 3) reasons.push(`Well suited to your goal (${GOAL_TEXT[answers.goal]}).`);
  else if (fit <= 1) tradeoffs.push(`Less suited to ${GOAL_TEXT[answers.goal]} than other options.`);

  // Experience.
  if (EXP_RANK[template.minExperience] > EXP_RANK[answers.experience]) {
    score -= 30;
    tradeoffs.push(`Written for ${template.minExperience} lifters or above; the weekly volume may be a lot to recover from at first.`);
  } else if (template.suitedExperience.includes(answers.experience)) {
    score += 10;
    reasons.push(`Appropriate for ${answers.experience} lifters.`);
  }

  // Build the days for the user's equipment and preferences.
  const generated = generateDays(template, answers, newId);
  const dropped = [...new Set(generated.flatMap((g) => g.droppedSlots))];
  if (dropped.length) {
    score -= dropped.length * 5;
    tradeoffs.push(`No suitable exercise with your equipment for: ${dropped.join(', ')}. Those slots were left out.`);
  } else reasons.push('Every exercise works with the equipment you selected.');

  // Session length: estimates include a 5-minute warm-up, rest periods, and changeovers.
  let days = generated.map((g) => g.day);
  const untrimmedMax = Math.max(0, ...days.map((d) => estimateDayMinutes(d)));
  let trimmed = false;
  if (untrimmedMax <= answers.sessionMinutes) {
    score += 15;
    reasons.push(`Sessions take about ${untrimmedMax} minutes including warm-up and rest — within your ${answers.sessionMinutes} minutes.`);
  } else {
    const fitted = days.map((d) => shortenDay(d, answers.sessionMinutes));
    days = fitted.map((f) => f.day);
    trimmed = true;
    const changes = fitted.flatMap((f) => f.changes.map((c) => (c.kind === 'removed' ? `${c.name} removed` : `${c.name} ${c.from}→${c.to} sets`)));
    if (fitted.every((f) => f.fits)) {
      score += 5;
      tradeoffs.push(`Shortened to fit ${answers.sessionMinutes} minutes (full version ~${untrimmedMax} min): ${[...new Set(changes)].join('; ')}.`);
    } else {
      score -= 25;
      tradeoffs.push(`Even shortened, some sessions run over ${answers.sessionMinutes} minutes. Consider a template with fewer exercises per day.`);
    }
  }
  const estimatedMinutes = Math.max(0, ...days.map((d) => estimateDayMinutes(d)));

  // Muscle priorities.
  const distribution = weeklyDistribution(days, template.daysPerWeek);
  const focus = answers.priorities.filter((p) => p !== 'full-body') as Exclude<MusclePriority, 'full-body'>[];
  if (focus.length) {
    const perMuscle = new Map(distribution.map((d) => [d.muscle, d.sets]));
    const avg = distribution.length ? distribution.reduce((n, d) => n + d.sets, 0) / distribution.length : 0;
    const covered = focus.filter((p) => PRIORITY_MUSCLES[p].some((m) => (perMuscle.get(m) ?? 0) >= avg));
    score += covered.length * 4;
    if (covered.length) reasons.push(`Gives your priorities (${covered.join(', ')}) at least average weekly volume; their exercises are marked as priority.`);
    const missed = focus.filter((p) => !covered.includes(p));
    if (missed.length) tradeoffs.push(`Lower weekly volume for ${missed.join(', ')}; you can add a set or swap an exercise after previewing.`);
  }
  if (answers.priorities.includes('full-body') && template.days.every((d) => d.slots.length >= 5)) score += 3;

  return {
    template,
    score,
    dayMismatch,
    days,
    alternatives: Object.assign({}, ...generated.map((g) => g.alternatives)),
    estimatedMinutes,
    fitsTime: estimatedMinutes <= answers.sessionMinutes,
    trimmed,
    reasons,
    tradeoffs,
    distribution,
  };
}

const GOAL_TEXT: Record<TrainingGoal, string> = {
  hypertrophy: 'building muscle',
  strength: 'getting stronger',
  'fat-loss': 'losing fat while keeping muscle',
  recomposition: 'body recomposition',
  general: 'general fitness',
  consistency: 'training consistently',
};

/**
 * Ranked shortlist (best first). Templates needing more days than available
 * are never ranked above ones that fit; they stay visible for comparison with
 * the mismatch explained.
 */
export function recommendProgrammes(answers: GuidedAnswers, newId: IdFn): TemplateRecommendation[] {
  return PROGRAMME_TEMPLATES.map((t) => evaluateTemplate(t, answers, newId)).sort(
    (a, b) => Number(a.dayMismatch) - Number(b.dayMismatch) || b.score - a.score || a.template.daysPerWeek - b.template.daysPerWeek || a.template.id.localeCompare(b.template.id),
  );
}

/** Turn a reviewed recommendation into a programme record (not yet saved or activated). */
export function programmeFromRecommendation(rec: Pick<TemplateRecommendation, 'template' | 'days'>, answers: GuidedAnswers, newId: IdFn, now: Date): Programme {
  return {
    ...createProgramme(newId, now, {
      name: rec.template.name,
      goal: answers.goal,
      days: structuredClone(rec.days),
      daysPerWeek: rec.template.daysPerWeek,
      preferredWeekdays: [...answers.preferredWeekdays],
      source: 'template',
      templateId: rec.template.id,
    }),
    isActive: false,
  };
}

/** Swap an exercise in a day for an allowed alternative, keeping sets/reps/rest/planned load type rules. */
export function swapExercise(day: ProgrammeDay, programmeExerciseId: string, toExerciseId: string): ProgrammeDay {
  const lib = EXERCISES_BY_ID.get(toExerciseId);
  if (!lib) return day;
  return {
    ...day,
    exercises: day.exercises.map((e) => {
      if (e.id !== programmeExerciseId) return e;
      const timed = lib.mode === 'timed';
      return {
        ...e,
        exerciseId: lib.id,
        name: lib.name,
        loadType: lib.loadType,
        repMin: timed ? null : (e.repMin ?? 8),
        repMax: timed ? null : (e.repMax ?? 12),
        durationSec: timed ? (e.durationSec ?? lib.defaultDurationSec) : null,
        // A planned load belongs to the old exercise and loading convention.
        plannedLoad: null,
      };
    }),
  };
}
