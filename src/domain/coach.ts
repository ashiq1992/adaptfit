import { addDays } from './dates';
import { comparableKey } from './loads';
import type { PlateauFinding } from './plateau';
import { compare, exerciseHistory, filterRange, IMPROVING, weeklyConsistency, weekStartOf } from './progression';
import { plural, weekSchedule } from './schedule';
import type {
  CheckIn,
  CoachQuestion,
  CoachRecommendation,
  CoachRecType,
  Programme,
  ProgrammeChange,
  WeekPlan,
  WorkoutSession,
} from './types';

export interface RecommendationDraft {
  type: CoachRecType;
  title: string;
  explanation: string;
  proposedChange: ProgrammeChange | null;
}

/** Locate a programme exercise matching a comparable key in the active programme. */
export function findProgrammeExercise(programme: Programme | null, key: string) {
  if (!programme) return null;
  for (const day of programme.days) for (const e of day.exercises) if (comparableKey(e.exerciseId, e.loadType) === key) return { day, exercise: e };
  return null;
}

/**
 * Turn a possible-plateau finding (and any answers) into one recommendation.
 * Never modifies a programme: a proposed change is applied only if accepted.
 */
export function recommendForPlateau(finding: PlateauFinding, questions: readonly CoachQuestion[], programme: Programme | null, recentPainReports: number): RecommendationDraft {
  const yes = (id: CoachQuestion['id']) => questions.some((q) => q.id === id && q.answer === 'yes');
  const answered = questions.some((q) => q.answer !== null);

  if (recentPainReports >= 2) {
    return {
      type: 'seek-advice',
      title: 'Consider professional advice',
      explanation: 'You reported pain more than once recently. AdaptFit cannot assess that — if it continues, consider speaking with a qualified professional before pushing progression.',
      proposedChange: null,
    };
  }
  if (yes('missed')) {
    return {
      type: 'check-consistency',
      title: 'Check training consistency',
      explanation: `Missed sessions are a common reason for ${finding.name} to stall. Keeping the current plan and getting a few consistent weeks is usually the first step.`,
      proposedChange: { type: 'focus', text: `Prioritise attending planned sessions; keep ${finding.name} as programmed.` },
    };
  }
  if (yes('sleep') || yes('fatigue')) {
    return {
      type: 'review-recovery',
      title: 'Review recovery',
      explanation: 'You noted changes in sleep or fatigue. Recovery affects performance; keeping the plan while protecting sleep may help before changing the programme.',
      proposedChange: { type: 'focus', text: 'Aim for consistent sleep this week; keep loads as they are.' },
    };
  }
  if (yes('harder')) {
    const target = findProgrammeExercise(programme, finding.key);
    return {
      type: 'planned-reduction',
      title: 'Consider a lighter week',
      explanation: 'Sets have felt harder without progress. A planned lighter week (fewer sets on this lift) can help before trying to progress again.',
      proposedChange:
        target && target.exercise.sets > 2
          ? { type: 'sets', programmeId: programme!.id, dayId: target.day.id, programmeExerciseId: target.exercise.id, name: target.exercise.name, from: target.exercise.sets, to: target.exercise.sets - 1 }
          : { type: 'focus', text: `Use one fewer set on ${finding.name} for a week.` },
    };
  }
  if (answered) {
    const target = findProgrammeExercise(programme, finding.key);
    if (target && target.exercise.repMin !== null && target.exercise.repMax !== null) {
      const to: [number, number] = [target.exercise.repMin, target.exercise.repMax + 2];
      return {
        type: 'small-progression',
        title: 'Small progression adjustment',
        explanation: `Recovery and consistency look fine. Widening the rep range on ${finding.name} to ${to[0]}–${to[1]} lets you accumulate reps at the current load before adding weight.`,
        proposedChange: { type: 'rep-range', programmeId: programme!.id, dayId: target.day.id, programmeExerciseId: target.exercise.id, name: target.exercise.name, from: [target.exercise.repMin, target.exercise.repMax], to },
      };
    }
  }
  return {
    type: 'continue',
    title: 'Continue the current plan',
    explanation: answered
      ? `Keep ${finding.name} as programmed and aim for one more rep when technique allows.`
      : `Possible plateau — additional context needed. Answer the questions above to refine this suggestion; until then, keep the current plan.`,
    proposedChange: null,
  };
}

export function newPlateauRecommendation(args: {
  id: string;
  now: Date;
  today: string;
  finding: PlateauFinding;
  programme: Programme | null;
  recentPainReports: number;
}): CoachRecommendation {
  const draft = recommendForPlateau(args.finding, args.finding.questions, args.programme, args.recentPainReports);
  return {
    id: args.id,
    createdAt: args.now.toISOString(),
    kind: 'plateau',
    dedupeKey: `plateau:${args.finding.key}:${weekStartOf(args.today)}`,
    trigger: `Possible plateau on ${args.finding.name}`,
    exerciseKey: args.finding.key,
    supportingData: args.finding.evidence,
    missingData: args.finding.missingData,
    questions: args.finding.questions,
    ...draft,
    status: 'open',
    decidedAt: null,
    postponedUntil: null,
    appliedChange: null,
    followUp: null,
  };
}

/** Re-derive the suggestion after the user answers a question. */
export function answerQuestion(rec: CoachRecommendation, id: CoachQuestion['id'], answer: CoachQuestion['answer'], programme: Programme | null, recentPainReports: number): CoachRecommendation {
  const questions = rec.questions.map((q) => (q.id === id ? { ...q, answer } : q));
  if (rec.kind !== 'plateau' || rec.status !== 'open') return { ...rec, questions };
  const finding: PlateauFinding = { key: rec.exerciseKey ?? '', name: rec.trigger.replace(/^Possible plateau on /, ''), status: 'possible-plateau', sessionsConsidered: 0, evidence: rec.supportingData, missingData: rec.missingData, questions };
  return { ...rec, questions, ...recommendForPlateau(finding, questions, programme, recentPainReports) };
}

export type ProgrammeEdit = Extract<ProgrammeChange, { type: 'rep-range' | 'sets' }>;

/** True when a change edits a programme (as opposed to a focus note or nutrition target). */
export function isProgrammeEdit(change: ProgrammeChange | null): change is ProgrammeEdit {
  return !!change && (change.type === 'rep-range' || change.type === 'sets');
}

/** Apply an accepted change to a programme (pure). */
export function applyChange(programme: Programme, change: ProgrammeChange, now: Date): Programme {
  if (!isProgrammeEdit(change) || change.programmeId !== programme.id) return programme;
  return {
    ...programme,
    updatedAt: now.toISOString(),
    days: programme.days.map((d) =>
      d.id !== change.dayId
        ? d
        : {
            ...d,
            exercises: d.exercises.map((e) => {
              if (e.id !== change.programmeExerciseId) return e;
              if (change.type === 'sets') return { ...e, sets: change.to };
              return { ...e, repMin: change.to[0], repMax: change.to[1] };
            }),
          },
    ),
  };
}

export type Decision = 'accepted' | 'rejected' | 'postponed';

export function decide(rec: CoachRecommendation, decision: Decision, now: Date, today: string): CoachRecommendation {
  const iso = now.toISOString();
  if (decision === 'postponed') return { ...rec, status: 'postponed', decidedAt: iso, postponedUntil: addDays(today, 7) };
  if (decision === 'rejected') return { ...rec, status: 'rejected', decidedAt: iso, appliedChange: null, followUp: null };
  return { ...rec, status: 'accepted', decidedAt: iso, appliedChange: rec.proposedChange, followUp: { dueDate: addDays(today, 14), outcome: null } };
}

/** Follow-up outcome for an accepted plateau recommendation, from later sessions. */
export function followUpOutcome(rec: CoachRecommendation, sessions: readonly WorkoutSession[], today: string): string | null {
  if (rec.status !== 'accepted' || !rec.exerciseKey || !rec.decidedAt || !rec.followUp) return null;
  const pts = exerciseHistory(sessions, rec.exerciseKey);
  const before = pts.filter((p) => p.completedAt < rec.decidedAt!);
  const after = pts.filter((p) => p.completedAt >= rec.decidedAt!);
  if (after.length === 0) return today >= rec.followUp.dueDate ? 'No sessions of this exercise since accepting.' : null;
  const baseline = before[before.length - 1];
  if (!baseline) return null;
  const best = after.map((p) => compare(p.summary, baseline.summary)).find((c) => IMPROVING.has(c.kind));
  return best ? `Improved since accepting (${best.label}).` : `${after.length} session${after.length === 1 ? '' : 's'} since accepting; no improvement yet.`;
}

export interface WeeklyReview {
  weekStart: string;
  planned: number;
  completed: number;
  remaining: number;
  defaultFrequency: number;
  adjusted: boolean;
  status: 'on-track' | 'behind' | 'complete' | 'no-plan';
  headline: string;
  keyLifts: { name: string; label: string; kind: string }[];
  consistencyPct: number | null;
  recovery: { avgSleep: number | null; checkIns: number; highFatigueDays: number };
}

/** Planned sessions for a week: approved adjusted plan, else programme frequency (one model: weekSchedule). */
export function targetForWeek(programme: Programme | null, weekPlans: readonly WeekPlan[], weekStart: string): number {
  return weekSchedule(programme, weekPlans, [], weekStart).planned;
}

export function weeklyReview(args: {
  sessions: readonly WorkoutSession[];
  programme: Programme | null;
  weekPlans: readonly WeekPlan[];
  checkIns: readonly CheckIn[];
  today: string;
}): WeeklyReview {
  const { sessions, programme, weekPlans, checkIns, today } = args;
  const weekStart = weekStartOf(today);
  const targetFor = (ws: string) => targetForWeek(programme, weekPlans, ws);
  const weeks = weeklyConsistency(sessions, today, 4, targetFor);
  const schedule = weekSchedule(programme, weekPlans, sessions, weekStart);
  const thisWeek = { target: schedule.planned, completed: schedule.completed };
  const plannedWeeks = weeks.filter((w) => w.target > 0);
  const consistencyPct = plannedWeeks.length
    ? Math.round((plannedWeeks.reduce((n, w) => n + Math.min(w.completed, w.target), 0) / plannedWeeks.reduce((n, w) => n + w.target, 0)) * 100)
    : null;

  // Key lifts: priority programme exercises, compared over the last 4 weeks.
  const keys = new Set<string>();
  programme?.days.forEach((d) => d.exercises.forEach((e) => e.priority && keys.add(comparableKey(e.exerciseId, e.loadType))));
  const keyLifts: WeeklyReview['keyLifts'] = [];
  for (const key of keys) {
    const pts = filterRange(exerciseHistory(sessions, key), '4w', today);
    if (pts.length < 2) continue;
    const c = compare(pts[pts.length - 1]!.summary, pts[0]!.summary);
    keyLifts.push({ name: pts[pts.length - 1]!.summary.name, label: c.label, kind: c.kind });
  }

  const recent = checkIns.filter((c) => c.localDate >= addDays(today, -6) && c.localDate <= today);
  const sleeps = recent.map((c) => c.sleepHours).filter((h): h is number => h !== null);
  const recovery = {
    avgSleep: sleeps.length ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null,
    checkIns: recent.length,
    highFatigueDays: recent.filter((c) => c.fatigue === 'high').length,
  };

  let status: WeeklyReview['status'];
  let headline: string;
  if (thisWeek.target === 0) {
    status = 'no-plan';
    headline = thisWeek.completed ? `${thisWeek.completed} workout${thisWeek.completed === 1 ? '' : 's'} completed this week.` : 'No planned sessions this week. Set up a programme to track consistency.';
  } else if (thisWeek.completed >= thisWeek.target) {
    status = 'complete';
    headline = `You completed ${thisWeek.completed} of ${thisWeek.target} planned ${plural(thisWeek.target, 'workout')} this week.`;
  } else {
    // Behind only if there are fewer days left than sessions remaining.
    const dow = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000;
    const daysLeft = 7 - dow;
    status = thisWeek.target - thisWeek.completed > daysLeft ? 'behind' : 'on-track';
    headline = `${thisWeek.completed} of ${thisWeek.target} planned ${plural(thisWeek.target, 'workout')} done this week — ${schedule.remaining} to go.`;
  }
  return {
    weekStart,
    planned: thisWeek.target,
    completed: thisWeek.completed,
    remaining: schedule.remaining,
    defaultFrequency: schedule.defaultFrequency,
    adjusted: schedule.source === 'adjusted',
    status,
    headline,
    keyLifts,
    consistencyPct,
    recovery,
  };
}
