import { bodyweightTrend } from './bodyweight';
import { addDays, formatLocalDate } from './dates';
import { comparableKey, formatLoad, trim } from './loads';
import { noteLoad } from './noteFormat';
import { assessExercise, type PlateauOptions, DEFAULT_PLATEAU_OPTIONS } from './plateau';
import {
  compare,
  type Comparison,
  exerciseHistory,
  type HistoryPoint,
  IMPROVING,
  previousSummary,
  sessionPRs,
  summarizeExercise,
  trainedExercises,
  weekStartOf,
} from './progression';
import type { BodyweightEntry, CheckIn, CoachRecommendation, Profile, Programme, SessionExercise, TrainingWeek, WorkoutSession } from './types';
import { isCounted, weekCounts } from './weekly';
import { completedSets } from './workout';

/**
 * Performance intelligence for V0.4: per-exercise status, concise weekly
 * reviews, and real training milestones. Everything is derived from confirmed
 * records, so editing or deleting a record changes the results.
 *
 * Only the same exercise recorded with the same loading convention is ever
 * compared (comparableKey). Machines, Smith bars and dumbbells are never
 * treated as equivalent, and no bar weight is assumed.
 */

export type ProgressStatus = 'improving' | 'stable' | 'possible-decline' | 'possible-plateau' | 'insufficient-data';

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  improving: 'Improving',
  stable: 'Stable',
  'possible-decline': 'Possible decline',
  'possible-plateau': 'Possible plateau',
  'insufficient-data': 'Not enough data',
};

export interface ExerciseStatus {
  key: string;
  name: string;
  status: ProgressStatus;
  /** One short, evidence-based sentence. */
  reason: string;
  points: HistoryPoint[];
  latest: HistoryPoint | null;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/**
 * A plain-language description of the change between two performances of
 * the same exercise and convention, e.g. "1 more rep in the first set at the
 * same recorded load (30 kg/side)". Returns null when they aren't comparable.
 */
export function describeChange(prev: SessionExercise, cur: SessionExercise): string | null {
  if (comparableKey(prev.exerciseId, prev.loadType) !== comparableKey(cur.exerciseId, cur.loadType)) return null;
  const a = completedSets(prev);
  const b = completedSets(cur);
  if (!a.length || !b.length) return null;
  const ps = summarizeExercise(prev)!;
  const cs = summarizeExercise(cur)!;
  const c = compare(cs, ps);
  const sameLoad = a.every((s) => s.load === a[0]!.load) && b.every((s) => s.load === a[0]!.load) && prev.unit === cur.unit;
  if (cur.loadType !== 'timed' && sameLoad && a.length === b.length) {
    const diffs = b.map((s, i) => (s.reps ?? 0) - (a[i]!.reps ?? 0));
    const changed = diffs.map((d, i) => [d, i] as const).filter(([d]) => d !== 0);
    const at = cur.loadType === 'bodyweight' ? 'at bodyweight' : `at the same recorded load (${noteLoad(a[0]!.load, cur.loadType, cur.unit)})`;
    if (!changed.length) return `Same reps ${at}.`;
    if (changed.length === 1) {
      const [d, i] = changed[0]!;
      const where = `in the ${ORDINAL[i] ?? `#${i + 1}`} set`;
      return d > 0 ? `${d} more rep${d === 1 ? '' : 's'} ${where} ${at}.` : `${-d} fewer rep${d === -1 ? '' : 's'} ${where} ${at}.`;
    }
    const total = diffs.reduce((x, y) => x + y, 0);
    if (total > 0) return `${total} more rep${total === 1 ? '' : 's'} across ${changed.length} sets ${at}.`;
    if (total < 0) return `${-total} fewer rep${total === -1 ? '' : 's'} across ${changed.length} sets ${at}.`;
    return `Reps shifted between sets ${at}; the total is unchanged.`;
  }
  if (c.kind === 'load-up') return `Load up: ${c.label}.`;
  if (c.kind === 'regression') return `Lower than last time (${c.label}).`;
  if (c.kind === 'reps-up') return `${c.label}.`;
  if (c.kind === 'sets-up') return `${c.label} at the top load.`;
  if (c.kind === 'mixed') return `Lighter load but more reps (${c.label}).`;
  return c.kind === 'stable' ? 'Same as last time.' : null;
}

/**
 * Progress status for one exercise. A single lower session is never called a
 * decline or a plateau: a decline needs the last two comparable sessions below
 * the earlier best; a plateau needs several sessions over weeks (see plateau.ts).
 */
export function exerciseStatus(
  sessions: readonly WorkoutSession[],
  key: string,
  name: string,
  today: string,
  context: { checkIns: readonly CheckIn[]; profile: Pick<Profile, 'lifestyle'> | null },
  opts: PlateauOptions = DEFAULT_PLATEAU_OPTIONS,
): ExerciseStatus {
  const points = exerciseHistory(sessions, key).filter((p) => p.localDate <= today);
  const latest = points[points.length - 1] ?? null;
  const base = { key, name, points, latest };
  if (points.length < 2) return { ...base, status: 'insufficient-data', reason: points.length ? 'One record so far — the next one gives a comparison.' : 'No records yet.' };
  const last = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  const step = compare(last.summary, prev.summary);
  if (IMPROVING.has(step.kind)) return { ...base, status: 'improving', reason: `${step.label} since ${formatLocalDate(prev.localDate)}.` };

  if (points.length >= 3) {
    let best = points[0]!.summary;
    for (const p of points.slice(1, -2)) if (IMPROVING.has(compare(p.summary, best).kind)) best = p.summary;
    const lastVsBest = compare(last.summary, best);
    const prevVsBest = compare(prev.summary, best);
    if (lastVsBest.kind === 'regression' && prevVsBest.kind === 'regression')
      return { ...base, status: 'possible-decline', reason: `The last two sessions were below your earlier best (${lastVsBest.label}). One more session will show whether this continues.` };
  }

  const plateau = assessExercise(sessions, key, name, today, context, opts);
  if (plateau.status === 'possible-plateau') return { ...base, status: 'possible-plateau', reason: plateau.evidence[0] ?? 'No improvement across several sessions.' };
  if (step.kind === 'regression') return { ...base, status: 'stable', reason: `Lower than the previous session (${step.label}). One session isn't a trend.` };
  if (step.kind === 'insufficient') return { ...base, status: 'insufficient-data', reason: step.label === 'Load not recorded' ? 'The load wasn’t recorded in one of the last two sessions.' : 'Not comparable with the previous record.' };
  return { ...base, status: 'stable', reason: `Same as ${formatLocalDate(prev.localDate)}.` };
}

/** Status for every exercise trained in the last `weeks` weeks. */
export function allExerciseStatuses(
  sessions: readonly WorkoutSession[],
  today: string,
  context: { checkIns: readonly CheckIn[]; profile: Pick<Profile, 'lifestyle'> | null },
  weeks = 12,
): ExerciseStatus[] {
  const since = addDays(today, -weeks * 7);
  return trainedExercises(sessions)
    .filter((e) => e.lastDate >= since)
    .map((e) => exerciseStatus(sessions, e.key, e.name, today, context));
}

// ─────────────────────────────────────────────────────────────────
// Weekly review
// ─────────────────────────────────────────────────────────────────

export interface ReviewLine {
  key: string;
  name: string;
  /** "+1 rep", "Stable", "First record", … */
  label: string;
  kind: Comparison['kind'];
  detail: string | null;
  isPR: boolean;
}

export interface WeekReview {
  weekStart: string;
  planned: number;
  completed: number;
  partial: number;
  skipped: number;
  notRecorded: number;
  lines: ReviewLine[];
  improved: ReviewLine[];
  stable: ReviewLine[];
  attention: string[];
  /** Concise coach summary (2–4 sentences). */
  summary: string[];
  /** Whether a programme change is justified by the evidence. */
  adjustmentJustified: boolean;
}

function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Review of one confirmed week, built only from its confirmed records and the
 * comparable records before it. Reproducible: the same data gives the same review.
 */
export function reviewWeek(args: {
  week: TrainingWeek;
  sessions: readonly WorkoutSession[];
  recommendations?: readonly CoachRecommendation[];
}): WeekReview {
  const { week, sessions } = args;
  const counts = weekCounts(week);
  const ids = new Set(week.sessions.filter(isCounted).map((r) => r.sessionId).filter(Boolean) as string[]);
  const weekSessions = sessions.filter((s) => ids.has(s.id) && s.state === 'completed').sort((a, b) => (a.completedAt! < b.completedAt! ? -1 : 1));
  const lines = new Map<string, ReviewLine>();
  for (const s of weekSessions) {
    const prs = new Set(sessionPRs(sessions, s));
    for (const ex of s.exercises) {
      const summary = summarizeExercise(ex);
      if (!summary) continue;
      const prevSummary = previousSummary(sessions, s, ex);
      const c = compare(summary, prevSummary);
      // Find the previous comparable exercise record for a detailed sentence.
      let detail: string | null = null;
      if (prevSummary) {
        const before = sessions
          .filter((o) => o.state === 'completed' && o.id !== s.id && o.completedAt! < s.completedAt!)
          .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
        for (const o of before) {
          const pe = o.exercises.find((e) => comparableKey(e.exerciseId, e.loadType) === summary.key && completedSets(e).length);
          if (pe) {
            detail = describeChange(pe, ex);
            break;
          }
        }
      }
      lines.set(summary.key, { key: summary.key, name: ex.name, label: c.kind === 'insufficient' ? c.label : c.label, kind: c.kind, detail, isPR: prs.has(summary.key) });
    }
  }
  const all = [...lines.values()];
  const improved = all.filter((l) => IMPROVING.has(l.kind));
  const stable = all.filter((l) => l.kind === 'stable');
  const lower = all.filter((l) => l.kind === 'regression');
  const attention: string[] = [];
  const openPlateaus = (args.recommendations ?? []).filter((r) => r.kind === 'plateau' && r.status === 'open' && r.exerciseKey && lines.has(r.exerciseKey));
  for (const r of openPlateaus) attention.push(`Possible plateau on ${lines.get(r.exerciseKey!)!.name}.`);
  if (lower.length) attention.push(`${listNames(lower.map((l) => l.name))} ${lower.length === 1 ? 'was' : 'were'} lower than last time — one session isn't a trend.`);

  const done = counts.completed + counts.partial;
  const missed = Math.max(0, counts.planned - done);
  const summary: string[] = [];
  if (done === 0) {
    summary.push(counts.skipped ? 'No sessions were completed this week.' : 'No sessions were recorded as completed this week.');
  } else {
    if (improved.length) summary.push(`${listNames(improved.slice(0, 3).map((l) => l.name))} improved this week.`);
    if (stable.length) summary.push(`${listNames(stable.slice(0, 3).map((l) => l.name))} ${stable.length === 1 ? 'is' : 'are'} stable.`);
  }
  if (counts.planned > 0) summary.push(`You completed ${done} of ${counts.planned} planned session${counts.planned === 1 ? '' : 's'}${counts.partial ? ` (${counts.partial} partly)` : ''}.`);
  const adjustmentJustified = openPlateaus.length > 0;
  if (adjustmentJustified) summary.push('There is a suggestion below for the possible plateau — nothing changes unless you accept it.');
  else if (done > 0 && missed > 0) summary.push(`Since ${missed === 1 ? 'one session was' : `${missed} sessions were`} missed, continue the programme before considering a change.`);
  else if (done > 0) summary.push(improved.length && !lower.length ? 'Keep following your programme.' : "There isn't enough evidence to recommend changing your programme yet.");

  return {
    weekStart: week.weekStart,
    planned: counts.planned,
    completed: counts.completed,
    partial: counts.partial,
    skipped: counts.skipped,
    notRecorded: counts.notRecorded,
    lines: all,
    improved,
    stable,
    attention,
    summary: summary.map((s, i) => (i === 0 ? s : s)).map((s) => s.replace(/^./, (c) => c.toUpperCase())),
    adjustmentJustified,
  };
}

export { lowerFirst };

// ─────────────────────────────────────────────────────────────────
// Milestones (real training achievements — no points, no streak penalties)
// ─────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  localDate: string;
  kind: 'pr' | 'load' | 'reps' | 'consistency' | 'block' | 'bodyweight';
  title: string;
  detail: string;
}

export function milestones(args: {
  sessions: readonly WorkoutSession[];
  weeks: readonly TrainingWeek[];
  programme: Programme | null;
  bodyweights: readonly BodyweightEntry[];
  profile: Pick<Profile, 'goal' | 'weightUnit'>;
  today: string;
  sinceWeeks?: number;
}): Milestone[] {
  const since = addDays(args.today, -(args.sinceWeeks ?? 12) * 7);
  const out: Milestone[] = [];
  const done = args.sessions.filter((s) => s.state === 'completed' && s.completedLocalDate && s.completedLocalDate >= since && s.completedLocalDate <= args.today);
  for (const s of done) {
    const prs = new Set(sessionPRs(args.sessions, s));
    for (const ex of s.exercises) {
      const sum = summarizeExercise(ex);
      if (!sum) continue;
      const prev = previousSummary(args.sessions, s, ex);
      const c = compare(sum, prev);
      const top = sum.loadType === 'timed' ? `${sum.bestDurationSec ?? 0} s` : `${sum.loadType === 'bodyweight' ? 'BW' : formatLoad(sum.topLoad, sum.loadType, sum.unit)} × ${sum.repsAtTop ?? 0}`;
      if (prs.has(sum.key)) out.push({ id: `pr:${s.id}:${sum.key}`, localDate: s.completedLocalDate!, kind: 'pr', title: `New best: ${ex.name}`, detail: top });
      else if (c.kind === 'load-up') out.push({ id: `load:${s.id}:${sum.key}`, localDate: s.completedLocalDate!, kind: 'load', title: `Heavier ${ex.name}`, detail: c.label });
      else if (c.kind === 'reps-up') out.push({ id: `reps:${s.id}:${sum.key}`, localDate: s.completedLocalDate!, kind: 'reps', title: `More reps on ${ex.name}`, detail: c.label });
    }
  }
  // Weeks where every planned session was completed (counted, never a streak).
  const confirmed = args.weeks.filter((w) => w.status === 'confirmed' && w.weekStart >= weekStartOf(since));
  const full = confirmed.filter((w) => {
    const c = weekCounts(w);
    return c.planned > 0 && c.completed >= c.planned;
  });
  if (full.length >= 2) {
    const last = full.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0]!;
    out.push({ id: `consistency:${last.weekStart}:${full.length}`, localDate: addDays(last.weekStart, 6) > args.today ? args.today : addDays(last.weekStart, 6), kind: 'consistency', title: 'Consistent training', detail: `Every planned session completed in ${full.length} of the last ${confirmed.length} recorded weeks.` });
  }
  // Training blocks: every 4 confirmed weeks on the current programme.
  if (args.programme) {
    const onProgramme = args.weeks.filter((w) => w.status === 'confirmed' && w.programmeId === args.programme!.id && w.sessions.some(isCounted)).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
    for (let n = 4; n <= onProgramme.length; n += 4) {
      const w = onProgramme[n - 1]!;
      const date = addDays(w.weekStart, 6) > args.today ? args.today : addDays(w.weekStart, 6);
      if (date >= since) out.push({ id: `block:${args.programme.id}:${n}`, localDate: date, kind: 'block', title: `${n}-week block completed`, detail: `${n} weeks of ${args.programme.name} recorded.` });
    }
  }
  // Bodyweight, only when it supports the stated goal.
  const t = bodyweightTrend(args.bodyweights.filter((b) => b.localDate <= args.today), args.profile.weightUnit);
  if (t.perWeek !== null) {
    const goalDown = args.profile.goal === 'fat-loss';
    const goalUp = args.profile.goal === 'hypertrophy';
    const rate = t.perWeek;
    if ((goalDown && t.status === 'down') || (goalUp && t.status === 'up'))
      out.push({ id: `bw:${args.today}`, localDate: args.today, kind: 'bodyweight', title: 'Bodyweight trend matches your goal', detail: `${rate > 0 ? '+' : '−'}${trim(Math.abs(rate))} ${args.profile.weightUnit}/week on average.` });
  }
  return out.sort((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : a.id.localeCompare(b.id)));
}

/** Completed sessions per week for the last `weeks` weeks (training frequency chart). */
export function weeklyFrequency(sessions: readonly WorkoutSession[], today: string, weeks: number): { weekStart: string; sessions: number }[] {
  const start = weekStartOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(start, -7 * (weeks - 1 - i));
    const we = addDays(ws, 6);
    return { weekStart: ws, sessions: sessions.filter((s) => s.state === 'completed' && s.completedLocalDate && s.completedLocalDate >= ws && s.completedLocalDate <= we).length };
  });
}
