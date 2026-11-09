import { newId, startSession } from '../../data/repo';
import type { Plan, Profile, Programme, ProgrammeDay, WorkoutSession, CheckIn } from '../../domain/types';
import * as W from '../../domain/workout';
import { clock } from '../../ui/clock';

/** Start a programme day (normal, shortened, or adjusted). Returns false if another workout is active. */
export async function startDay(args: {
  programme: Programme;
  day: ProgrammeDay;
  planKind: WorkoutSession['planKind'];
  history: readonly WorkoutSession[];
  profile: Profile;
  checkIn: CheckIn | null;
}): Promise<{ created: boolean }> {
  const { created } = await startSession(() =>
    W.sessionFromDay({ id: newId(), now: clock.now(), newId, programme: args.programme, day: args.day, planKind: args.planKind, history: args.history, unit: args.profile.weightUnit, checkIn: args.checkIn }),
  );
  return { created };
}

/** Start an explicitly chosen quick workout from the adaptive generator. */
export async function startQuick(args: { plan: Plan; history: readonly WorkoutSession[]; profile: Profile; checkIn: CheckIn | null }): Promise<{ created: boolean }> {
  const { created } = await startSession(() =>
    W.sessionFromPlan({ id: newId(), now: clock.now(), newId, plan: args.plan, history: args.history, unit: args.profile.weightUnit, checkIn: args.checkIn }),
  );
  return { created };
}

/** Repeat a saved workout's exercises as a new session (values prefilled from history). */
export async function repeatSession(args: { source: WorkoutSession; history: readonly WorkoutSession[]; profile: Profile; programmes: readonly Programme[] }): Promise<{ created: boolean }> {
  const programme = args.programmes.find((p) => p.id === args.source.programmeId);
  const day = programme?.days.find((d) => d.id === args.source.dayId);
  if (programme && day) return startDay({ programme, day, planKind: 'programme-day', history: args.history, profile: args.profile, checkIn: null });
  // No template any more: rebuild a one-off day from what was actually done.
  const adhoc: ProgrammeDay = {
    id: `repeat-${args.source.id}`,
    name: args.source.name,
    exercises: args.source.exercises
      .filter((e) => e.sets.length > 0)
      .map((e) => ({
        id: newId(),
        exerciseId: e.exerciseId,
        name: e.name,
        loadType: e.loadType,
        sets: e.sets.length,
        repMin: e.target.repMin ?? (e.loadType === 'timed' ? null : (e.sets[0]?.reps ?? 8)),
        repMax: e.target.repMax ?? (e.loadType === 'timed' ? null : (e.sets[0]?.reps ?? 8)),
        durationSec: e.loadType === 'timed' ? (e.sets[0]?.durationSec ?? 60) : null,
        restSec: e.target.restSec || 90,
        priority: e.priority,
        notes: '',
        plannedLoad: null,
        uncertain: [],
      })),
    notes: '',
  };
  const pseudo: Programme = { id: '', name: '', goal: args.profile.goal, days: [adhoc], daysPerWeek: 1, preferredWeekdays: [], isActive: false, source: 'created', templateId: null, notes: '', createdAt: '', updatedAt: '' };
  const { created } = await startSession(() => {
    const s = W.sessionFromDay({ id: newId(), now: clock.now(), newId, programme: pseudo, day: adhoc, history: args.history, unit: args.profile.weightUnit, checkIn: null });
    return { ...s, source: 'manual', programmeId: null, dayId: null };
  });
  return { created };
}
