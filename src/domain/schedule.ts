import { estimateDayMinutes, exerciseSeconds } from './programme';
import { addDays } from './dates';
import type { Lifestyle, Programme, ProgrammeDay, ProgrammeExercise, WeekPlan, WeekPlanSession, WorkoutSession } from './types';

/** At most this many exercises are carried into a kept session. */
export const MAX_ADDED_PER_SESSION = 2;
/** Carried-over exercises use this many sets, to avoid cramming. */
export const CARRIED_SETS = 2;

export interface WeekProposalInput {
  programme: Programme;
  weekStart: string;
  availableSessions: number;
  /** Day the rotation would do next; kept first so the cycle continues. */
  nextDayId: string | null;
  sessionLengthMin: number;
}

function priorityScore(day: ProgrammeDay): number {
  return day.exercises.filter((e) => e.priority).length * 10 + day.exercises.length;
}

/**
 * Propose a reduced week that preserves priority exercises where feasible.
 * Dropped days' priority exercises are carried into kept days only if the
 * session stays within the preferred length; everything else is reported as a
 * trade-off. The result is a proposal — nothing changes until approved.
 */
export function proposeWeek(input: WeekProposalInput): WeekPlan {
  const { programme, availableSessions } = input;
  // Default frequency is the programme's sessions per week, even when it has fewer distinct days (they repeat).
  const planned = programme.days.length ? programme.daysPerWeek : 0;
  const n = Math.max(0, Math.min(availableSessions, planned));
  const base: Omit<WeekPlan, 'sessions' | 'tradeoffs'> = {
    weekStart: input.weekStart,
    programmeId: programme.id,
    plannedSessions: planned,
    availableSessions: n,
    status: 'pending',
    decidedAt: null,
  };
  // The week's rotation starting at the next day, repeating days if the programme has fewer days than sessions.
  const start = Math.max(0, programme.days.findIndex((d) => d.id === input.nextDayId));
  const rotation = Array.from({ length: planned }, (_, i) => programme.days[(start + i) % programme.days.length]!);

  if (n >= planned) {
    return { ...base, sessions: rotation.map((d) => ({ dayId: d.id, name: d.name, added: [], estimatedMinutes: estimateDayMinutes(d) })), tradeoffs: [] };
  }
  if (n === 0) {
    return { ...base, sessions: [], tradeoffs: ['No sessions this week. Your programme continues where you left off next week — nothing is lost.'] };
  }

  // Keep the next day, then the highest-priority remaining slots, in rotation order (by index, so repeated days work).
  const restIdx = rotation.map((_, i) => i).slice(1);
  const keptIdx = new Set([0, ...[...restIdx].sort((a, b) => priorityScore(rotation[b]!) - priorityScore(rotation[a]!) || a - b).slice(0, n - 1)]);
  const kept = rotation.filter((_, i) => keptIdx.has(i));
  const dropped = rotation.filter((_, i) => !keptIdx.has(i));

  const sessions: (WeekPlanSession & { exercises: ProgrammeExercise[] })[] = kept.map((d) => ({ dayId: d.id, name: d.name, added: [], estimatedMinutes: estimateDayMinutes(d), exercises: [...d.exercises] }));
  const tradeoffs: string[] = [];

  for (const day of dropped) {
    const carried: string[] = [];
    const left: string[] = [];
    const alsoKept = kept.some((k) => k.id === day.id);
    for (const ex of day.exercises.filter((e) => e.priority)) {
      const reduced = { ...ex, sets: Math.min(ex.sets, CARRIED_SETS) };
      if (sessions.some((s) => s.exercises.some((e) => e.exerciseId === ex.exerciseId && e.loadType === ex.loadType))) continue;
      const target = sessions
        .filter((s) => s.added.length < MAX_ADDED_PER_SESSION)
        .map((s) => ({ s, minutes: estimateDayMinutes({ exercises: [...s.exercises, reduced] }) }))
        .filter((x) => x.minutes <= input.sessionLengthMin)
        .sort((a, b) => a.minutes - b.minutes)[0];
      if (target) {
        target.s.exercises.push(reduced);
        target.s.added.push({ programmeExerciseId: ex.id, name: ex.name, sets: reduced.sets, fromDay: day.name });
        target.s.estimatedMinutes = target.minutes;
        carried.push(`${ex.name} (${reduced.sets} sets → ${target.s.name})`);
      } else left.push(ex.name);
    }
    const others = day.exercises.filter((e) => !e.priority).map((e) => e.name);
    let line = alsoKept ? `One ${day.name} session is skipped this week.` : `${day.name} is skipped this week.`;
    if (carried.length) line += ` Moved: ${carried.join(', ')}.`;
    if (left.length) line += ` Not scheduled: ${left.join(', ')} (would make a session too long).`;
    if (others.length && !alsoKept) line += ` Accessory work skipped: ${others.join(', ')}.`;
    tradeoffs.push(line);
  }
  tradeoffs.push(`Total weekly volume is lower than usual (${n} of ${planned} ${plural(planned, 'session')}). This is a temporary adjustment, not extra work crammed into fewer days.`);

  return { ...base, sessions: sessions.map(({ exercises: _e, ...s }) => s), tradeoffs };
}

export function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/**
 * The single scheduling model used by Train, Coach, and Progress:
 * - defaultFrequency: the programme's sessions per week;
 * - adjusted: an approved temporary plan for this week, if any;
 * - planned: what this week is measured against (adjusted, else default);
 * - completed and remaining: completed workouts this week and what's left.
 */
export interface WeekSchedule {
  weekStart: string;
  defaultFrequency: number;
  adjusted: WeekPlan | null;
  planned: number;
  completed: number;
  remaining: number;
  source: 'programme' | 'adjusted' | 'none';
}

export function weekSchedule(
  programme: Programme | null,
  weekPlans: readonly WeekPlan[],
  sessions: readonly Pick<WorkoutSession, 'state' | 'completedLocalDate'>[],
  weekStart: string,
): WeekSchedule {
  const defaultFrequency = programme && programme.days.length ? programme.daysPerWeek : 0;
  const adjusted = programme ? (weekPlans.find((w) => w.weekStart === weekStart && w.status === 'approved' && w.programmeId === programme.id) ?? null) : null;
  const planned = adjusted ? adjusted.availableSessions : defaultFrequency;
  const weekEnd = addDays(weekStart, 6);
  const completed = sessions.filter((s) => s.state === 'completed' && s.completedLocalDate && s.completedLocalDate >= weekStart && s.completedLocalDate <= weekEnd).length;
  return { weekStart, defaultFrequency, adjusted, planned, completed, remaining: Math.max(0, planned - completed), source: adjusted ? 'adjusted' : programme ? 'programme' : 'none' };
}

/** Sessions the user can realistically fit, based on optional lifestyle data. Never required. */
export function suggestedAvailability(lifestyle: Lifestyle, planned: number): { sessions: number; reason: string } | null {
  if (!lifestyle.work && !lifestyle.training) return null;
  const minDays = lifestyle.training?.minDays ?? null;
  if (lifestyle.work?.overtime === 'often' && minDays) {
    return { sessions: Math.min(planned, minDays), reason: `You noted frequent overtime; your minimum is ${minDays} sessions.` };
  }
  return null;
}

export function exerciseMinutes(e: ProgrammeExercise): number {
  return Math.ceil(exerciseSeconds(e) / 60);
}
