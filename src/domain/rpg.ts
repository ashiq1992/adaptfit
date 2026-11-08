import { addDays } from './dates';
import { targetForWeek } from './coach';
import { sessionPRs, weekStartOf } from './progression';
import type { CheckIn, CoachRecommendation, Programme, WeekPlan, WorkoutSession } from './types';
import { completedSets, completedSetCount } from './workout';

/**
 * Game statistics derived entirely from recorded history. They describe
 * behaviour logged in AdaptFit — they are not fitness or medical measurements.
 * Nothing is stored, so edits, deletions, and restores always reconcile.
 */

export interface RpgInput {
  sessions: readonly WorkoutSession[];
  checkIns: readonly CheckIn[];
  recommendations: readonly CoachRecommendation[];
  weekPlans: readonly WeekPlan[];
  programme: Programme | null;
  /** Week starts (YYYY-MM-DD) for which the weekly review was opened. */
  reviewedWeeks: readonly string[];
  today: string;
}

export const XP = { workout: 20, planned: 10, pr: 15, maxPrPerSession: 3, week: 25, recovery: 5, maxRecoveryPerWeek: 3, review: 5, defaultWeeklyCap: 4 } as const;

export interface XpEvent {
  key: string;
  xp: number;
  label: string;
  date: string;
  kind: 'workout' | 'planned' | 'pr' | 'week' | 'recovery' | 'review';
}

function completedSessions(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  const seen = new Set<string>();
  return sessions
    .filter((s) => {
      if (s.state !== 'completed' || !s.completedAt || !s.completedLocalDate || seen.has(s.id)) return false;
      seen.add(s.id);
      return completedSetCount(s) > 0;
    })
    .sort((a, b) => (a.completedAt! < b.completedAt! ? -1 : a.completedAt! > b.completedAt! ? 1 : a.id < b.id ? -1 : 1));
}

function isRecoveryCheckIn(c: CheckIn): boolean {
  return c.sleepHours !== null || c.sleepQuality !== null || c.fatigue !== null || c.stress !== null;
}

function weekTarget(input: RpgInput, ws: string): number {
  if (!input.programme) return 0;
  const created = input.programme.createdAt.slice(0, 10);
  if (addDays(ws, 6) < created) return 0;
  return targetForWeek(input.programme, input.weekPlans, ws);
}

/** All XP events, each with a unique key so nothing is ever awarded twice. */
export function xpEvents(input: RpgInput): XpEvent[] {
  const events = new Map<string, XpEvent>();
  const add = (e: XpEvent) => {
    if (!events.has(e.key)) events.set(e.key, e);
  };
  const sessions = completedSessions(input.sessions);
  const perWeek = new Map<string, number>();
  const weeks = new Set<string>();

  for (const s of sessions) {
    const ws = weekStartOf(s.completedLocalDate!);
    weeks.add(ws);
    const target = weekTarget(input, ws);
    const cap = target > 0 ? target : XP.defaultWeeklyCap;
    const n = (perWeek.get(ws) ?? 0) + 1;
    perWeek.set(ws, n);
    if (n <= cap) {
      add({ key: `workout:${s.id}`, xp: XP.workout, label: `Completed ${s.name}`, date: s.completedLocalDate!, kind: 'workout' });
      if (s.source === 'programme') add({ key: `planned:${s.id}`, xp: XP.planned, label: 'Planned workout', date: s.completedLocalDate!, kind: 'planned' });
    }
    for (const key of sessionPRs(input.sessions, s).slice(0, XP.maxPrPerSession)) {
      const name = s.exercises.find((e) => `${e.exerciseId}|${e.loadType}` === key)?.name ?? 'Exercise';
      add({ key: `pr:${s.id}:${key}`, xp: XP.pr, label: `Personal record: ${name}`, date: s.completedLocalDate!, kind: 'pr' });
    }
  }

  for (const ws of weeks) {
    const target = weekTarget(input, ws);
    if (target > 0 && (perWeek.get(ws) ?? 0) >= target) add({ key: `week:${ws}`, xp: XP.week, label: 'Planned week completed', date: addDays(ws, 6) < input.today ? addDays(ws, 6) : input.today, kind: 'week' });
  }

  const recoveryPerWeek = new Map<string, number>();
  for (const c of [...input.checkIns].sort((a, b) => (a.localDate < b.localDate ? -1 : 1))) {
    if (!isRecoveryCheckIn(c) || c.localDate > input.today) continue;
    const ws = weekStartOf(c.localDate);
    const n = (recoveryPerWeek.get(ws) ?? 0) + 1;
    recoveryPerWeek.set(ws, n);
    if (n <= XP.maxRecoveryPerWeek) add({ key: `recovery:${c.localDate}`, xp: XP.recovery, label: 'Recovery check-in', date: c.localDate, kind: 'recovery' });
  }

  for (const ws of new Set(input.reviewedWeeks)) add({ key: `review:${ws}`, xp: XP.review, label: 'Weekly review', date: ws, kind: 'review' });

  return [...events.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1));
}

/** XP needed to go from `level` to `level + 1`. */
export function xpForNext(level: number): number {
  return 100 + 50 * (level - 1);
}

export interface LevelInfo {
  level: number;
  totalXP: number;
  xpIntoLevel: number;
  xpForNext: number;
}

export function levelFromXp(totalXP: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXP));
  while (remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level += 1;
  }
  return { level, totalXP: Math.max(0, Math.floor(totalXP)), xpIntoLevel: remaining, xpForNext: xpForNext(level) };
}

export const TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: 'The Novice Lifter' },
  { minLevel: 3, title: 'The Steady Lifter' },
  { minLevel: 6, title: 'The Consistent Lifter' },
  { minLevel: 10, title: 'The Iron Adept' },
  { minLevel: 15, title: 'The Seasoned Champion' },
  { minLevel: 20, title: 'Legend of the Rack' },
];

export function titleFor(level: number): string {
  return [...TITLES].reverse().find((t) => level >= t.minLevel)!.title;
}

export const UNLOCKS: { level: number; id: UnlockId; name: string }[] = [
  { level: 1, id: 'tunic', name: 'Adventurer tunic' },
  { level: 3, id: 'scarf', name: 'Red scarf' },
  { level: 5, id: 'pack', name: 'Travel pack' },
  { level: 10, id: 'cape', name: 'Training cape' },
  { level: 15, id: 'armour', name: 'Iron armour' },
  { level: 20, id: 'gilded', name: 'Gilded trim' },
];
export type UnlockId = 'tunic' | 'scarf' | 'pack' | 'cape' | 'armour' | 'gilded';

export function unlockedParts(level: number): Set<UnlockId> {
  return new Set(UNLOCKS.filter((u) => level >= u.level).map((u) => u.id));
}

export function nextUnlock(level: number) {
  return UNLOCKS.find((u) => u.level > level) ?? null;
}

export interface Stat {
  id: 'str' | 'end' | 'rec' | 'cons';
  abbr: 'STR' | 'END' | 'REC' | 'CONS';
  name: string;
  value: number;
  basis: string;
  contributors: string[];
}

export interface RpgState {
  events: XpEvent[];
  level: LevelInfo;
  title: string;
  stats: Stat[];
  achievements: Achievement[];
  missions: Mission[];
  prCount: number;
  weeksMet: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare';
  icon: 'star' | 'dumbbell' | 'calendar' | 'crown' | 'shield' | 'moon' | 'gem' | 'scroll';
  current: number;
  target: number;
  earned: boolean;
}

export interface Mission {
  id: string;
  name: string;
  current: number;
  target: number;
  done: boolean;
}

export function computeRpg(input: RpgInput): RpgState {
  const events = xpEvents(input);
  const totalXP = events.reduce((n, e) => n + e.xp, 0);
  const level = levelFromXp(totalXP);
  const sessions = completedSessions(input.sessions);

  const prEvents = events.filter((e) => e.kind === 'pr');
  const allPrs = sessions.reduce((n, s) => n + sessionPRs(input.sessions, s).length, 0);
  const fullVolume = sessions.filter((s) => s.exercises.length > 0 && s.exercises.every((e) => !e.skipped && completedSets(e).length >= e.target.sets)).length;
  const enduranceSessions = sessions.filter((s) => s.exercises.some((e) => e.tags.includes('endurance') && completedSets(e).length > 0)).length;
  const recoveryDays = new Set(input.checkIns.filter((c) => isRecoveryCheckIn(c) && c.localDate <= input.today).map((c) => c.localDate)).size;
  const recoveryRecs = input.recommendations.filter((r) => r.status === 'accepted' && (r.type === 'review-recovery' || r.type === 'planned-reduction')).length;
  const weekEvents = events.filter((e) => e.kind === 'week');

  const stats: Stat[] = [
    { id: 'str', abbr: 'STR', name: 'Strength', value: 1 + allPrs, basis: 'Verified personal records on comparable lifts.', contributors: [`${allPrs} personal record${allPrs === 1 ? '' : 's'}`] },
    {
      id: 'end',
      abbr: 'END',
      name: 'Endurance',
      value: 1 + fullVolume + enduranceSessions,
      basis: 'Workouts where every planned set was completed, plus endurance sessions.',
      contributors: [`${fullVolume} full-volume workout${fullVolume === 1 ? '' : 's'}`, `${enduranceSessions} endurance session${enduranceSessions === 1 ? '' : 's'}`],
    },
    {
      id: 'rec',
      abbr: 'REC',
      name: 'Recovery',
      value: 1 + recoveryDays + recoveryRecs,
      basis: 'Recovery check-ins you recorded and recovery advice you chose to follow. Not a physiological measurement.',
      contributors: [`${recoveryDays} recovery check-in day${recoveryDays === 1 ? '' : 's'}`, `${recoveryRecs} recovery recommendation${recoveryRecs === 1 ? '' : 's'} accepted`],
    },
    { id: 'cons', abbr: 'CONS', name: 'Consistency', value: 1 + weekEvents.length, basis: 'Weeks where you completed your planned (or approved adjusted) sessions.', contributors: [`${weekEvents.length} planned week${weekEvents.length === 1 ? '' : 's'} completed`] },
  ];

  // Longest run of consecutive weeks met.
  const metWeeks = weekEvents.map((e) => e.key.slice(5)).sort();
  let bestRun = 0;
  let run = 0;
  metWeeks.forEach((w, i) => {
    run = i > 0 && addDays(metWeeks[i - 1]!, 7) === w ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
  });

  const hasProgramme = !!input.programme && input.programme.days.some((d) => d.exercises.length > 0);
  const a = (id: string, name: string, description: string, rarity: Achievement['rarity'], icon: Achievement['icon'], current: number, target: number): Achievement => ({
    id,
    name,
    description,
    rarity,
    icon,
    current: Math.min(current, target),
    target,
    earned: current >= target,
  });
  const achievements: Achievement[] = [
    a('first-workout', 'First Workout', 'Complete your first workout.', 'common', 'star', sessions.length, 1),
    a('programme-builder', 'Programme Builder', 'Set up your own training programme.', 'common', 'scroll', hasProgramme ? 1 : 0, 1),
    a('first-pr', 'First PR', 'Set a personal record on a comparable lift.', 'common', 'crown', allPrs, 1),
    a('planned-week', 'Planned Week', 'Complete every planned session in a week.', 'common', 'calendar', weekEvents.length, 1),
    a('ten-workouts', 'First 10 Workouts', 'Complete ten workouts.', 'common', 'dumbbell', sessions.length, 10),
    a('recovery-aware', 'Recovery Aware', 'Record recovery check-ins on seven days.', 'common', 'moon', recoveryDays, 7),
    a('level-5', 'Level 5', 'Reach level 5.', 'common', 'shield', level.level, 5),
    a('ten-prs', 'Strength Milestone', 'Set ten personal records.', 'rare', 'crown', allPrs, 10),
    a('four-week-consistency', '4-Week Consistency', 'Complete your planned sessions four weeks in a row.', 'rare', 'calendar', bestRun, 4),
    a('fifty-workouts', 'Fifty Workouts', 'Complete fifty workouts.', 'rare', 'dumbbell', sessions.length, 50),
    a('level-10', 'Level 10', 'Reach level 10.', 'rare', 'gem', level.level, 10),
  ];

  // Optional weekly missions.
  const ws = weekStartOf(input.today);
  const inWeek = sessions.filter((s) => s.completedLocalDate! >= ws && s.completedLocalDate! <= input.today);
  const target = weekTarget(input, ws);
  const missions: Mission[] = [];
  if (target > 0) missions.push({ id: 'planned', name: 'Complete planned workouts', current: Math.min(inWeek.length, target), target, done: inWeek.length >= target });
  const approved = input.weekPlans.find((w) => w.weekStart === ws && w.status === 'approved');
  if (approved && approved.availableSessions > 0) {
    const doneAdjusted = inWeek.filter((s) => approved.sessions.some((p) => p.dayId === s.dayId)).length;
    missions.push({ id: 'adjusted', name: 'Follow your adjusted plan', current: Math.min(doneAdjusted, approved.availableSessions), target: approved.availableSessions, done: doneAdjusted >= approved.availableSessions });
  }
  const prsThisWeek = prEvents.filter((e) => e.date >= ws).length;
  missions.push({ id: 'milestone', name: 'Reach a personal milestone', current: Math.min(prsThisWeek, 1), target: 1, done: prsThisWeek > 0 });
  const reviewed = input.reviewedWeeks.includes(ws);
  missions.push({ id: 'review', name: 'Review weekly progress', current: reviewed ? 1 : 0, target: 1, done: reviewed });

  return { events, level, title: titleFor(level.level), stats, achievements, missions, prCount: allPrs, weeksMet: weekEvents.length };
}
