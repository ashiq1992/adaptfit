import { addDays, formatLocalDate } from './dates';
import { formatLoad } from './loads';
import { compare, exerciseHistory, type HistoryPoint, IMPROVING, trainedExercises } from './progression';
import type { CheckIn, CoachQuestion, CoachQuestionId, Profile, WorkoutSession } from './types';

export interface PlateauOptions {
  /** Comparable sessions required in the observation window. */
  minSessions: number;
  /** Observation window in weeks. */
  windowWeeks: number;
  /** Minimum days between the first and last session considered. */
  minSpanDays: number;
  /** A longer gap between sessions counts as a training interruption. */
  maxGapDays: number;
}

export const DEFAULT_PLATEAU_OPTIONS: PlateauOptions = { minSessions: 4, windowWeeks: 6, minSpanDays: 14, maxGapDays: 14 };

/**
 * - progressing: improved within the last two comparable sessions.
 * - stable: enough history; improved earlier in the run and has held that level since.
 * - possible-plateau: enough history and no improvement over the best earlier performance.
 * - insufficient-data / interrupted: not enough consistent history to judge.
 */
export type PlateauStatus = 'possible-plateau' | 'progressing' | 'stable' | 'insufficient-data' | 'interrupted';

export interface PlateauFinding {
  key: string;
  name: string;
  status: PlateauStatus;
  sessionsConsidered: number;
  evidence: string[];
  missingData: string[];
  questions: CoachQuestion[];
}

const QUESTION_TEXT: Record<CoachQuestionId, string> = {
  missed: 'Have you missed training sessions recently?',
  sleep: 'Has your sleep changed recently?',
  harder: 'Have recent sets felt harder than usual?',
  fatigue: 'Are you experiencing unusual fatigue?',
  food: 'Has your food intake changed?',
  intake: 'Have you been eating less than usual, or skipping meals?',
  busy: 'Has work or life been unusually busy lately?',
};

function describePoint(p: HistoryPoint): string {
  const s = p.summary;
  if (s.loadType === 'timed') return `${s.bestDurationSec ?? 0} s`;
  const load = s.loadType === 'bodyweight' ? 'BW' : formatLoad(s.topLoad, s.loadType, s.unit);
  return `${load} × ${s.repsAtTop ?? 0}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Assess one exercise. A single bad session can never trigger a plateau: it
 * requires `minSessions` comparable sessions spanning `minSpanDays` with no
 * improvement over the best earlier performance, and no long interruption.
 */
export function assessExercise(
  sessions: readonly WorkoutSession[],
  key: string,
  name: string,
  today: string,
  context: { checkIns: readonly CheckIn[]; profile: Pick<Profile, 'lifestyle'> | null },
  opts: PlateauOptions = DEFAULT_PLATEAU_OPTIONS,
): PlateauFinding {
  const windowStart = addDays(today, -opts.windowWeeks * 7 + 1);
  const all = exerciseHistory(sessions, key);
  const pts = all.filter((p) => p.localDate >= windowStart && p.localDate <= today);
  const base = { key, name, sessionsConsidered: pts.length, missingData: [] as string[], questions: [] as CoachQuestion[] };

  if (pts.length < opts.minSessions) {
    const more = opts.minSessions - pts.length;
    return {
      ...base,
      status: 'insufficient-data',
      evidence: [`${pts.length} comparable session${pts.length === 1 ? '' : 's'} in the last ${opts.windowWeeks} weeks — at least ${opts.minSessions} are needed.`],
      missingData: [`Log ${more} more session${more === 1 ? '' : 's'} of this exercise with the same loading, over at least ${opts.minSpanDays} days.`],
    };
  }

  const recent = pts.slice(-opts.minSessions);
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) gaps.push(daysBetween(recent[i - 1]!.localDate, recent[i]!.localDate));
  const sinceLast = daysBetween(recent[recent.length - 1]!.localDate, today);
  if (gaps.some((g) => g > opts.maxGapDays) || sinceLast > opts.maxGapDays) {
    return {
      ...base,
      status: 'interrupted',
      evidence: [`Training on this exercise was interrupted (a gap of more than ${opts.maxGapDays} days). Progress is assessed again after a few consistent sessions.`],
    };
  }

  const span = daysBetween(recent[0]!.localDate, recent[recent.length - 1]!.localDate);
  if (span < opts.minSpanDays) {
    return {
      ...base,
      status: 'insufficient-data',
      evidence: [`Recent sessions span ${span} days; at least ${opts.minSpanDays} are needed to judge a trend.`],
      missingData: [`Keep training this exercise; a trend can be judged once sessions cover ${opts.minSpanDays}+ days.`],
    };
  }

  // Best performance before the observation run, then look for any improvement on it.
  let best = recent[0]!.summary;
  const beforeRun = all.filter((p) => p.completedAt < recent[0]!.completedAt);
  for (const p of beforeRun) if (IMPROVING.has(compare(p.summary, best).kind)) best = p.summary;
  let lastImprovement = -1;
  for (let i = 1; i < recent.length; i++) {
    if (IMPROVING.has(compare(recent[i]!.summary, best).kind)) {
      lastImprovement = i;
      best = recent[i]!.summary;
    }
  }
  if (lastImprovement >= 0) {
    const c = compare(recent[recent.length - 1]!.summary, recent[0]!.summary);
    if (lastImprovement >= recent.length - 2) return { ...base, status: 'progressing', evidence: [`Improving over the last ${recent.length} sessions (${c.label}).`] };
    const held = recent.length - 1 - lastImprovement;
    return { ...base, status: 'stable', evidence: [`Improved earlier in this run and has held that level for the last ${held} sessions — stable, not a plateau yet.`] };
  }

  const evidence = [
    `${recent.length} comparable sessions from ${formatLocalDate(recent[0]!.localDate)} to ${formatLocalDate(recent[recent.length - 1]!.localDate)} without beating ${describePoint(recent[0]!)}.`,
    `Sessions: ${recent.map(describePoint).join(' → ')}.`,
  ];

  // Missing context — stated honestly rather than guessed.
  const missing: string[] = [];
  const rirRecorded = recent.some((p) => p.summary.avgRir !== null);
  if (!rirRecorded) missing.push('Effort (RIR) was not recorded for these sessions.');
  const windowCheckIns = context.checkIns.filter((c) => c.localDate >= recent[0]!.localDate && c.localDate <= today);
  const sleeps = windowCheckIns.map((c) => c.sleepHours).filter((h): h is number => h !== null);
  if (sleeps.length === 0) missing.push('No recent sleep information.');
  if (!context.profile?.lifestyle.nutrition) missing.push('No nutrition preferences recorded.');

  // Up to two relevant questions.
  const candidates: CoachQuestionId[] = [];
  const allSessions = sessions.filter((s) => s.state === 'completed' && s.completedLocalDate && s.completedLocalDate >= recent[0]!.localDate);
  const perWeek = allSessions.length / Math.max(1, span / 7);
  if (perWeek < 1.5) candidates.push('missed');
  const avgSleep = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;
  if (avgSleep === null || avgSleep < 7) candidates.push('sleep');
  if (!rirRecorded) candidates.push('harder');
  if (windowCheckIns.some((c) => c.fatigue === 'high' || c.energy === 'low')) candidates.push('fatigue');
  if (context.profile?.lifestyle.nutrition?.objective === 'fat-loss') candidates.push('food');
  const questions = candidates.slice(0, 2).map((id) => ({ id, text: QUESTION_TEXT[id], answer: null }));

  return { ...base, status: 'possible-plateau', evidence, missingData: missing, questions };
}

/** Assess every exercise with recent comparable history, priority exercises first. */
export function detectPlateaus(
  sessions: readonly WorkoutSession[],
  today: string,
  context: { checkIns: readonly CheckIn[]; profile: Pick<Profile, 'lifestyle'> | null; priorityKeys?: ReadonlySet<string> },
  opts: PlateauOptions = DEFAULT_PLATEAU_OPTIONS,
): PlateauFinding[] {
  const prio = context.priorityKeys ?? new Set<string>();
  return trainedExercises(sessions)
    .map((e) => assessExercise(sessions, e.key, e.name, today, context, opts))
    .sort((a, b) => Number(prio.has(b.key)) - Number(prio.has(a.key)) || a.name.localeCompare(b.name));
}

export { QUESTION_TEXT };
