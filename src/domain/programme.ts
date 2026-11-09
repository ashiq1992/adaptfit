import { EXERCISES_BY_ID } from '../content/exercises';
import type { LoadType, PlannedLoad, Programme, ProgrammeDay, ProgrammeExercise, TrainingGoal, WorkoutSession } from './types';

type IdFn = () => string;

export const WARMUP_SEC = 300;
export const TRANSITION_SEC = 60;
/** Assumed seconds of work per rep, used only for time estimates. */
export const SEC_PER_REP = 4;

export function programmeExercise(
  newId: IdFn,
  args: { exerciseId: string; name?: string; loadType?: LoadType; sets?: number; repMin?: number | null; repMax?: number | null; durationSec?: number | null; restSec?: number; priority?: boolean; notes?: string; plannedLoad?: PlannedLoad | null },
): ProgrammeExercise {
  const lib = EXERCISES_BY_ID.get(args.exerciseId);
  const loadType = args.loadType ?? lib?.loadType ?? 'unspecified';
  const timed = loadType === 'timed';
  return {
    id: newId(),
    exerciseId: args.exerciseId,
    name: args.name ?? lib?.name ?? args.exerciseId,
    loadType,
    sets: args.sets ?? 3,
    repMin: timed ? null : (args.repMin ?? 8),
    repMax: timed ? null : (args.repMax ?? 12),
    durationSec: timed ? (args.durationSec ?? lib?.defaultDurationSec ?? 60) : null,
    restSec: args.restSec ?? 90,
    priority: args.priority ?? false,
    notes: args.notes ?? '',
    plannedLoad: args.plannedLoad ?? null,
    uncertain: [],
  };
}

export function createProgramme(
  newId: IdFn,
  now: Date,
  args: { name: string; goal: TrainingGoal; days?: ProgrammeDay[]; daysPerWeek?: number; preferredWeekdays?: number[]; source?: Programme['source']; templateId?: string | null },
): Programme {
  const iso = now.toISOString();
  const days = args.days ?? [];
  return {
    id: newId(),
    name: args.name.trim() || 'My programme',
    goal: args.goal,
    days,
    daysPerWeek: args.daysPerWeek ?? Math.max(1, Math.min(7, days.length || 3)),
    preferredWeekdays: args.preferredWeekdays ?? [],
    isActive: true,
    source: args.source ?? 'created',
    templateId: args.templateId ?? null,
    notes: '',
    createdAt: iso,
    updatedAt: iso,
  };
}

/** Deep copy of a day with fresh IDs, named "… (copy)". */
export function duplicateDay(day: ProgrammeDay, newId: IdFn): ProgrammeDay {
  return {
    id: newId(),
    name: `${day.name} (copy)`,
    exercises: day.exercises.map((e) => ({ ...e, id: newId() })),
    notes: day.notes,
  };
}

export function exerciseSeconds(e: Pick<ProgrammeExercise, 'sets' | 'repMax' | 'repMin' | 'durationSec' | 'restSec'>): number {
  const reps = e.repMax ?? e.repMin ?? 10;
  const work = e.durationSec ?? reps * SEC_PER_REP;
  return e.sets * work + Math.max(0, e.sets - 1) * e.restSec;
}

/** Estimated minutes for a training day: warm-up + work + rest + transitions. */
export function estimateDayMinutes(day: Pick<ProgrammeDay, 'exercises'>): number {
  if (day.exercises.length === 0) return 0;
  const sec = WARMUP_SEC + day.exercises.reduce((n, e) => n + exerciseSeconds(e), 0) + (day.exercises.length - 1) * TRANSITION_SEC;
  return Math.ceil(sec / 60);
}

export interface ProgrammeIssue {
  path: string;
  message: string;
}

/** A programme is usable when every day has at least one exercise with sensible targets. */
export function validateProgramme(p: Programme): ProgrammeIssue[] {
  const issues: ProgrammeIssue[] = [];
  if (!p.name.trim()) issues.push({ path: 'name', message: 'Give the programme a name.' });
  if (p.days.length === 0) issues.push({ path: 'days', message: 'Add at least one training day.' });
  if (!Number.isInteger(p.daysPerWeek) || p.daysPerWeek < 1 || p.daysPerWeek > 7)
    issues.push({ path: 'daysPerWeek', message: 'Days per week must be between 1 and 7.' });
  p.days.forEach((d, di) => {
    if (!d.name.trim()) issues.push({ path: `days.${di}.name`, message: `Day ${di + 1} needs a name.` });
    if (d.exercises.length === 0) issues.push({ path: `days.${di}.exercises`, message: `${d.name || `Day ${di + 1}`} has no exercises.` });
    d.exercises.forEach((e, ei) => {
      const at = `days.${di}.exercises.${ei}`;
      if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20) issues.push({ path: `${at}.sets`, message: `${e.name}: sets must be 1–20.` });
      if (e.loadType !== 'timed' && !e.uncertain?.includes('reps')) {
        if (e.repMin === null || e.repMax === null) issues.push({ path: `${at}.reps`, message: `${e.name}: set a rep range.` });
        else if (!Number.isInteger(e.repMin) || !Number.isInteger(e.repMax) || e.repMin < 1 || e.repMax > 100 || e.repMin > e.repMax)
          issues.push({ path: `${at}.reps`, message: `${e.name}: rep range must be whole numbers with min ≤ max.` });
      } else if (e.durationSec === null || e.durationSec < 1) issues.push({ path: `${at}.duration`, message: `${e.name}: set a duration.` });
      if (!Number.isInteger(e.restSec) || e.restSec < 0 || e.restSec > 900) issues.push({ path: `${at}.rest`, message: `${e.name}: rest must be 0–900 s.` });
    });
  });
  return issues;
}

export function isUsableProgramme(p: Programme | undefined | null): p is Programme {
  return !!p && validateProgramme(p).length === 0;
}

/**
 * The next day in rotation: the day after the most recently completed session
 * of this programme, or the first day.
 */
export function nextDay(programme: Programme, sessions: readonly Pick<WorkoutSession, 'state' | 'programmeId' | 'dayId' | 'completedAt'>[]): ProgrammeDay | null {
  if (programme.days.length === 0) return null;
  const last = sessions
    .filter((s) => s.state === 'completed' && s.programmeId === programme.id && s.dayId && s.completedAt)
    .sort((a, b) => (b.completedAt! < a.completedAt! ? -1 : b.completedAt! > a.completedAt! ? 1 : 0))[0];
  const idx = last ? programme.days.findIndex((d) => d.id === last.dayId) : -1;
  return programme.days[(idx + 1) % programme.days.length] ?? programme.days[0]!;
}

export interface DayChange {
  kind: 'removed' | 'fewer-sets';
  name: string;
  from?: number;
  to?: number;
}

export interface ShortenedDay {
  day: ProgrammeDay;
  changes: DayChange[];
  estimatedMinutes: number;
  fits: boolean;
}

/**
 * Propose a shorter version of a day that fits the available time. Priority
 * exercises are kept as long as possible. Never applied without approval.
 */
export function shortenDay(day: ProgrammeDay, availableMinutes: number): ShortenedDay {
  let exercises = day.exercises.map((e) => ({ ...e }));
  const changes: DayChange[] = [];
  const fits = () => estimateDayMinutes({ exercises }) <= availableMinutes;

  if (fits()) return { day, changes, estimatedMinutes: estimateDayMinutes(day), fits: true };

  // 1. Trim non-priority exercises to 2 sets, from the end.
  for (let i = exercises.length - 1; i >= 0 && !fits(); i--) {
    const e = exercises[i]!;
    if (!e.priority && e.sets > 2) {
      changes.push({ kind: 'fewer-sets', name: e.name, from: e.sets, to: 2 });
      exercises[i] = { ...e, sets: 2 };
    }
  }
  // 2. Remove non-priority exercises, from the end.
  for (let i = exercises.length - 1; i >= 0 && !fits(); i--) {
    const e = exercises[i]!;
    if (!e.priority && exercises.length > 1) {
      changes.push({ kind: 'removed', name: e.name });
      exercises = exercises.filter((x) => x.id !== e.id);
    }
  }
  // 3. Trim priority exercises to 2 sets, from the end.
  for (let i = exercises.length - 1; i >= 0 && !fits(); i--) {
    const e = exercises[i]!;
    if (e.sets > 2) {
      changes.push({ kind: 'fewer-sets', name: e.name, from: e.sets, to: 2 });
      exercises[i] = { ...e, sets: 2 };
    }
  }
  // Merge repeated set changes for the same exercise into one entry.
  const merged = new Map<string, DayChange>();
  for (const c of changes) {
    const prev = merged.get(`${c.kind}:${c.name}`);
    merged.set(`${c.kind}:${c.name}`, prev && c.kind === 'fewer-sets' ? { ...prev, to: c.to } : c);
  }
  const removed = new Set(changes.filter((c) => c.kind === 'removed').map((c) => c.name));
  const finalChanges = [...merged.values()].filter((c) => !(c.kind === 'fewer-sets' && removed.has(c.name)));
  const shortened = { ...day, exercises };
  const estimatedMinutes = estimateDayMinutes(shortened);
  return { day: shortened, changes: finalChanges, estimatedMinutes, fits: estimatedMinutes <= availableMinutes };
}

/**
 * Example four-day upper/lower hypertrophy split. Offered only as a clearly
 * labelled starting point that the user edits; never applied silently.
 */
export function starterUpperLower(newId: IdFn, now: Date, goal: TrainingGoal = 'hypertrophy'): Programme {
  const pe = (exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, priority = false) =>
    programmeExercise(newId, { exerciseId, sets, repMin, repMax, restSec, priority });
  const days: ProgrammeDay[] = [
    { id: newId(), name: 'Upper Body A', notes: '', exercises: [pe('smith-bench-press', 3, 6, 10, 150, true), pe('lat-pulldown', 3, 8, 12, 120, true), pe('cable-row', 3, 8, 12, 90), pe('lateral-raise', 3, 12, 15, 60)] },
    { id: newId(), name: 'Lower Body A', notes: '', exercises: [pe('smith-squat', 3, 6, 10, 180, true), pe('db-rdl', 3, 8, 12, 120), pe('leg-curl', 3, 10, 15, 90), pe('calf-raise', 3, 10, 15, 60)] },
    { id: newId(), name: 'Upper Body B', notes: '', exercises: [pe('incline-db-press', 3, 8, 12, 120, true), pe('db-row', 3, 8, 12, 90), pe('db-shoulder-press', 3, 8, 12, 90), pe('triceps-pushdown', 2, 10, 15, 60), pe('db-curl', 2, 10, 15, 60)] },
    { id: newId(), name: 'Lower Body B', notes: '', exercises: [pe('leg-press', 3, 8, 12, 150, true), pe('hip-thrust', 3, 8, 12, 120), pe('leg-extension', 3, 10, 15, 90), pe('calf-raise', 3, 10, 15, 60)] },
  ];
  return createProgramme(newId, now, { name: 'Upper / Lower (example)', goal, days, daysPerWeek: 4, preferredWeekdays: [1, 2, 4, 5], source: 'starter' });
}

/**
 * The session to do next. An approved adjusted week (from Coach) takes
 * precedence; otherwise the normal rotation continues.
 */
export function nextPlannedSession(
  programme: Programme,
  sessions: readonly Pick<WorkoutSession, 'state' | 'programmeId' | 'dayId' | 'completedAt' | 'completedLocalDate'>[],
  weekPlans: readonly import('./types').WeekPlan[],
  weekStart: string,
): { day: ProgrammeDay; planKind: 'programme-day' | 'adjusted-week'; note: string | null } | null {
  const rotationDay = nextDay(programme, sessions);
  if (!rotationDay) return null;
  const approved = weekPlans.find((w) => w.weekStart === weekStart && w.status === 'approved' && w.programmeId === programme.id);
  if (!approved) return { day: rotationDay, planKind: 'programme-day', note: null };
  // Count-based matching so a day that appears twice in the week needs two completions.
  const done = new Map<string, number>();
  for (const s of sessions) {
    if (s.state === 'completed' && s.programmeId === programme.id && s.dayId && s.completedLocalDate && s.completedLocalDate >= weekStart) done.set(s.dayId, (done.get(s.dayId) ?? 0) + 1);
  }
  const pending = approved.sessions.find((p) => {
    const left = done.get(p.dayId) ?? 0;
    if (left > 0) {
      done.set(p.dayId, left - 1);
      return false;
    }
    return true;
  });
  if (!pending) return { day: rotationDay, planKind: 'programme-day', note: 'Your adjusted plan for this week is complete. Anything extra is optional.' };
  const base = programme.days.find((d) => d.id === pending.dayId);
  if (!base) return { day: rotationDay, planKind: 'programme-day', note: null };
  const all = programme.days.flatMap((d) => d.exercises);
  const added = pending.added
    .map((a) => {
      const src = all.find((e) => e.id === a.programmeExerciseId);
      return src ? { ...src, sets: a.sets } : null;
    })
    .filter((e): e is ProgrammeExercise => e !== null);
  return {
    day: { ...base, exercises: [...base.exercises, ...added] },
    planKind: added.length ? 'adjusted-week' : 'programme-day',
    note: added.length ? `Adjusted for this week: includes ${added.map((a) => a.name).join(', ')}.` : null,
  };
}
