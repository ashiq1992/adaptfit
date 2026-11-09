import { EXERCISES_BY_ID } from '../content/exercises';
import { addDays } from './dates';
import { comparableKey } from './loads';
import { parsePerformance, performanceText } from './noteFormat';
import { weekdayOf } from './noteParser';
import { weekStartOf } from './progression';
import type {
  ExercisePerformance,
  PerformanceSet,
  Programme,
  ProgrammeExercise,
  SessionExercise,
  TrainingWeek,
  WeekPlan,
  WeeklySessionRecord,
  WeeklySessionStatus,
  WorkoutImportRecord,
  WorkoutSession,
} from './types';
import { completedSets } from './workout';

type IdFn = () => string;

/**
 * Weekly update: the primary way to record training in V0.4.
 *
 * Rules (each is tested):
 * - Copying last week only creates a draft. Nothing counts until a session is
 *   explicitly marked completed (or partial) and the week is confirmed.
 * - Skipped and not-recorded sessions never become completed workouts.
 * - Unknown performance (an empty row) is never treated as unchanged.
 * - Confirming writes one workout record per completed session, with a stable
 *   ID, so re-confirming an edited week updates rather than duplicates it.
 * - A session logged set by set (live) is used as-is and never duplicated.
 */

export const SESSION_STATUS_LABEL: Record<WeeklySessionStatus, string> = {
  completed: 'Done',
  partial: 'Partly done',
  skipped: 'Skipped',
  'not-recorded': 'Not recorded',
};

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Date in the week for a weekday (0 = Sunday); the week runs Monday → Sunday. */
export function dateForWeekday(weekStart: string, weekday: number): string {
  return addDays(weekStart, (weekday + 6) % 7);
}

/**
 * Suggested date for a planned session: the weekday in the day's name
 * ("Tuesday — Upper"), else the programme's preferred weekdays in order, else
 * none (the user picks). The user always confirms it.
 */
export function suggestedDate(programme: Programme | null, dayName: string, slot: number, weekStart: string): string | null {
  const named = weekdayOf(dayName);
  if (named !== null) return dateForWeekday(weekStart, named);
  const prefs = [...(programme?.preferredWeekdays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const wd = prefs[slot];
  return wd === undefined ? null : dateForWeekday(weekStart, wd);
}

/** Planned sessions for a week, repeating days when frequency exceeds the number of days. */
export function plannedSlots(programme: Programme | null, weekPlans: readonly WeekPlan[], weekStart: string): { id: string; dayId: string; name: string }[] {
  if (!programme || programme.days.length === 0) return [];
  const adjusted = weekPlans.find((w) => w.weekStart === weekStart && w.status === 'approved' && w.programmeId === programme.id);
  const dayIds = adjusted ? adjusted.sessions.map((s) => s.dayId) : Array.from({ length: Math.max(1, programme.daysPerWeek) }, (_, i) => programme.days[i % programme.days.length]!.id);
  const seen = new Map<string, number>();
  return dayIds
    .map((dayId) => {
      const day = programme.days.find((d) => d.id === dayId);
      if (!day) return null;
      const n = (seen.get(dayId) ?? 0) + 1;
      seen.set(dayId, n);
      return { id: n === 1 ? dayId : `${dayId}#${n}`, dayId, name: n === 1 ? day.name : `${day.name} (${n})` };
    })
    .filter((x): x is { id: string; dayId: string; name: string } => x !== null);
}

function toPerf(ex: SessionExercise): PerformanceSet[] {
  return completedSets(ex).map((s) => ({ load: s.load, reps: s.reps, durationSec: s.durationSec }));
}

/** Completed sessions not generated from a weekly update (i.e. logged live, imported, legacy). */
function isLive(s: WorkoutSession): boolean {
  return s.state === 'completed' && s.source !== 'weekly';
}

/**
 * Remove weekly-generated workouts that a live-logged workout of the same
 * programme day in the same week supersedes. Stored records are untouched;
 * this only prevents double counting in analysis.
 */
export function dedupeSessions(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  const live = new Set<string>();
  for (const s of sessions) if (isLive(s) && s.programmeId && s.dayId && s.completedLocalDate) live.add(`${s.programmeId}|${s.dayId}|${weekStartOf(s.completedLocalDate)}`);
  if (!live.size) return [...sessions];
  return sessions.filter((s) => !(s.source === 'weekly' && s.state === 'completed' && s.programmeId && s.dayId && s.completedLocalDate && live.has(`${s.programmeId}|${s.dayId}|${weekStartOf(s.completedLocalDate)}`)));
}

/**
 * Most recent real performance of an exercise before a week: a completed
 * workout first, then an undated imported note. Never invented.
 */
export function latestReference(
  pe: Pick<ProgrammeExercise, 'exerciseId' | 'loadType'>,
  sessions: readonly WorkoutSession[],
  imports: readonly WorkoutImportRecord[],
  beforeDate: string,
): { weekStart: string | null; sets: PerformanceSet[]; unit: string } | null {
  const key = comparableKey(pe.exerciseId, pe.loadType);
  const done = sessions
    .filter((s) => s.state === 'completed' && s.completedLocalDate && s.completedLocalDate < beforeDate)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
  for (const s of done) {
    const ex = s.exercises.find((e) => comparableKey(e.exerciseId, e.loadType) === key);
    const sets = ex ? toPerf(ex) : [];
    if (ex && sets.length) return { weekStart: weekStartOf(s.completedLocalDate!), sets, unit: ex.unit };
  }
  for (const imp of [...imports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
    const u = imp.undated.find((x) => comparableKey(x.exerciseId, x.loadType) === key);
    if (u && u.sets.length) return { weekStart: null, sets: u.sets, unit: u.unit };
  }
  return null;
}

/** Values implied by the plan (planned load × target reps), clearly marked as planned. */
function plannedSets(pe: ProgrammeExercise): PerformanceSet[] {
  if (pe.uncertain.includes('sets')) return [];
  if (pe.loadType === 'timed') return pe.durationSec ? Array.from({ length: pe.sets }, () => ({ load: null, reps: null, durationSec: pe.durationSec })) : [];
  if (pe.uncertain.includes('reps') || pe.repMin === null) return [];
  const load = pe.loadType === 'bodyweight' ? null : (pe.plannedLoad?.value ?? null);
  if (load === null && pe.loadType !== 'bodyweight') return [];
  return Array.from({ length: pe.sets }, () => ({ load, reps: pe.repMin, durationSec: null }));
}

function row(pe: ProgrammeExercise, unit: ExercisePerformance['unit'], sets: PerformanceSet[], source: ExercisePerformance['source'], previous: ExercisePerformance['previous']): ExercisePerformance {
  return {
    programmeExerciseId: pe.id,
    exerciseId: pe.exerciseId,
    name: pe.name,
    loadType: pe.loadType,
    unit,
    text: performanceText(sets, pe.loadType, unit),
    sets,
    status: 'done',
    source,
    previous,
    uncertain: [],
  };
}

function liveRecord(s: WorkoutSession, id: string): WeeklySessionRecord {
  return {
    id,
    dayId: s.dayId,
    name: s.name,
    localDate: s.completedLocalDate,
    status: 'completed',
    sessionId: s.id,
    live: true,
    exercises: s.exercises
      .filter((e) => completedSets(e).length > 0)
      .map((e) => {
        const sets = toPerf(e);
        return { programmeExerciseId: null, exerciseId: e.exerciseId, name: e.name, loadType: e.loadType, unit: e.unit, text: performanceText(sets, e.loadType, e.unit), sets, status: 'done' as const, source: 'live' as const, previous: null, uncertain: [] };
      }),
    note: '',
  };
}

/**
 * A new weekly draft. With `copy`, each exercise starts from the last
 * confirmed value (previous week, else latest history, else undated import),
 * otherwise from the plan. Every session starts as "Not recorded".
 */
export function buildWeekDraft(args: {
  weekStart: string;
  programme: Programme | null;
  weekPlans?: readonly WeekPlan[];
  previousWeek: TrainingWeek | null;
  sessions: readonly WorkoutSession[];
  imports?: readonly WorkoutImportRecord[];
  now: Date;
  unit: ExercisePerformance['unit'];
  copy: boolean;
}): TrainingWeek {
  const { weekStart, programme } = args;
  const weekEnd = addDays(weekStart, 6);
  const inWeekLive = args.sessions.filter((s) => isLive(s) && s.completedLocalDate && s.completedLocalDate >= weekStart && s.completedLocalDate <= weekEnd);
  const usedLive = new Set<string>();
  const slots = plannedSlots(programme, args.weekPlans ?? [], weekStart);
  const prevByExercise = new Map<string, ExercisePerformance>();
  if (args.previousWeek)
    for (const r of args.previousWeek.sessions)
      if (r.status === 'completed' || r.status === 'partial') for (const e of r.exercises) if (e.status === 'done' && e.sets.length) prevByExercise.set(e.programmeExerciseId ?? comparableKey(e.exerciseId, e.loadType), e);

  const records: WeeklySessionRecord[] = slots.map((slot, i) => {
    const live = inWeekLive.find((s) => s.programmeId === programme!.id && s.dayId === slot.dayId && !usedLive.has(s.id));
    if (live) {
      usedLive.add(live.id);
      return liveRecord(live, slot.id);
    }
    const day = programme!.days.find((d) => d.id === slot.dayId)!;
    const exercises = day.exercises.map((pe) => {
      const unit = pe.plannedLoad?.unit ?? args.unit;
      if (args.copy) {
        const fromWeek = prevByExercise.get(pe.id) ?? prevByExercise.get(comparableKey(pe.exerciseId, pe.loadType));
        if (fromWeek && fromWeek.loadType === pe.loadType) return row(pe, fromWeek.unit, fromWeek.sets, 'copied', { weekStart: args.previousWeek!.weekStart, text: fromWeek.text, sets: fromWeek.sets });
        const ref = latestReference(pe, args.sessions, args.imports ?? [], weekStart);
        if (ref) {
          const refUnit = ref.unit === 'lb' ? 'lb' : 'kg';
          return row(pe, refUnit, ref.sets, 'copied', { weekStart: ref.weekStart, text: performanceText(ref.sets, pe.loadType, refUnit), sets: ref.sets });
        }
      }
      const planned = plannedSets(pe);
      return planned.length ? row(pe, unit, planned, 'planned', null) : row(pe, unit, [], 'blank', null);
    });
    return { id: slot.id, dayId: slot.dayId, name: slot.name, localDate: suggestedDate(programme, day.name, i, weekStart), status: 'not-recorded' as const, sessionId: null, live: false, exercises, note: '' };
  });
  // Live-logged workouts that don't match a planned slot are included as extra sessions.
  for (const s of inWeekLive) if (!usedLive.has(s.id)) records.push(liveRecord(s, `live-${s.id}`));

  const iso = args.now.toISOString();
  return {
    weekStart,
    programmeId: programme?.id ?? null,
    status: 'draft',
    sessions: records,
    copiedFrom: args.copy ? (args.previousWeek?.weekStart ?? null) : null,
    createdAt: iso,
    updatedAt: iso,
    confirmedAt: null,
    revision: 0,
    reviewDismissed: false,
    history: [],
  };
}

/** Bring live-logged workouts into an existing week (e.g. logged after the draft was made). */
export function reconcileLive(week: TrainingWeek, sessions: readonly WorkoutSession[]): TrainingWeek {
  const weekEnd = addDays(week.weekStart, 6);
  const live = sessions.filter((s) => isLive(s) && s.completedLocalDate && s.completedLocalDate >= week.weekStart && s.completedLocalDate <= weekEnd);
  let changed = false;
  const used = new Set(week.sessions.filter((r) => r.live).map((r) => r.sessionId));
  const next = week.sessions.map((r) => {
    if (r.live) {
      const still = live.find((s) => s.id === r.sessionId);
      if (still) return r;
      changed = true; // the live workout was deleted: back to an empty record
      return { ...r, live: false, sessionId: null, status: 'not-recorded' as const, exercises: [] };
    }
    const match = live.find((s) => !used.has(s.id) && s.programmeId === week.programmeId && s.dayId === r.dayId);
    if (!match) return r;
    used.add(match.id);
    changed = true;
    return { ...liveRecord(match, r.id), name: r.name };
  });
  for (const s of live) if (!used.has(s.id) && !next.some((r) => r.sessionId === s.id)) {
    next.push(liveRecord(s, `live-${s.id}`));
    changed = true;
  }
  return changed ? { ...week, sessions: next } : week;
}

// ── Editing a draft (pure) ─────────────────────────────────────────

function mapSession(week: TrainingWeek, id: string, fn: (r: WeeklySessionRecord) => WeeklySessionRecord, now: Date): TrainingWeek {
  return { ...week, updatedAt: now.toISOString(), sessions: week.sessions.map((r) => (r.id === id && !r.live ? fn(r) : r)) };
}

export function setSessionStatus(week: TrainingWeek, id: string, status: WeeklySessionStatus, now: Date): TrainingWeek {
  return mapSession(week, id, (r) => ({ ...r, status }), now);
}

export function setSessionDate(week: TrainingWeek, id: string, localDate: string | null, now: Date): TrainingWeek {
  return mapSession(week, id, (r) => ({ ...r, localDate }), now);
}

export function setSessionNote(week: TrainingWeek, id: string, note: string, now: Date): TrainingWeek {
  return mapSession(week, id, (r) => ({ ...r, note: note.slice(0, 1000) }), now);
}

/** Mark every editable session that is still "Not recorded" as done. */
export function markRemaining(week: TrainingWeek, status: WeeklySessionStatus, now: Date): TrainingWeek {
  return { ...week, updatedAt: now.toISOString(), sessions: week.sessions.map((r) => (!r.live && r.status === 'not-recorded' ? { ...r, status } : r)) };
}

/** Update one exercise from its edited text. */
export function editExercise(week: TrainingWeek, sessionId: string, index: number, text: string, now: Date): TrainingWeek {
  return mapSession(
    week,
    sessionId,
    (r) => ({
      ...r,
      exercises: r.exercises.map((e, i) => {
        if (i !== index) return e;
        const parsed = parsePerformance(text, e.loadType, e.unit);
        const source = e.previous && text.trim() === e.previous.text.trim() ? 'copied' : text.trim() ? 'edited' : 'blank';
        return { ...e, text: text.slice(0, 300), sets: parsed.sets, uncertain: parsed.uncertain, source };
      }),
    }),
    now,
  );
}

export function toggleExerciseSkipped(week: TrainingWeek, sessionId: string, index: number, now: Date): TrainingWeek {
  return mapSession(week, sessionId, (r) => ({ ...r, exercises: r.exercises.map((e, i) => (i === index ? { ...e, status: e.status === 'done' ? 'skipped' : 'done' } : e)) }), now);
}

// ── Validation and confirmation ────────────────────────────────────

export interface WeekIssue {
  sessionId: string;
  index: number | null;
  message: string;
}

export function isCounted(r: Pick<WeeklySessionRecord, 'status'>): boolean {
  return r.status === 'completed' || r.status === 'partial';
}

/** Problems that block confirmation. Empty = ready. */
export function weekIssues(week: TrainingWeek): WeekIssue[] {
  const issues: WeekIssue[] = [];
  const end = addDays(week.weekStart, 6);
  for (const r of week.sessions) {
    if (r.live || !isCounted(r)) continue;
    if (!r.localDate) issues.push({ sessionId: r.id, index: null, message: `${r.name}: choose the day you trained.` });
    else if (r.localDate < week.weekStart || r.localDate > end) issues.push({ sessionId: r.id, index: null, message: `${r.name}: the date must be in this week.` });
    r.exercises.forEach((e, i) => {
      if (e.status !== 'done' || !e.text.trim()) return;
      if (!e.sets.length) issues.push({ sessionId: r.id, index: i, message: `${e.name}: couldn't read “${e.text}”.` });
    });
    if (!r.exercises.some((e) => e.status === 'done' && e.sets.length)) issues.push({ sessionId: r.id, index: null, message: `${r.name}: no values to record. Enter at least one exercise, or mark it skipped.` });
  }
  return issues;
}

export interface WeekCounts {
  planned: number;
  completed: number;
  partial: number;
  skipped: number;
  notRecorded: number;
  /** Rows in counted sessions that will be recorded. */
  recordedExercises: number;
  /** Rows in counted sessions with no values (not recorded, never assumed). */
  blankExercises: number;
  changed: number;
}

export function weekCounts(week: TrainingWeek): WeekCounts {
  const planned = week.sessions.filter((r) => !r.id.startsWith('live-')).length;
  const c: WeekCounts = { planned, completed: 0, partial: 0, skipped: 0, notRecorded: 0, recordedExercises: 0, blankExercises: 0, changed: 0 };
  for (const r of week.sessions) {
    if (r.status === 'completed') c.completed += 1;
    else if (r.status === 'partial') c.partial += 1;
    else if (r.status === 'skipped') c.skipped += 1;
    else c.notRecorded += 1;
    for (const e of r.exercises) {
      if (e.source === 'edited' || (e.previous && e.text.trim() !== e.previous.text.trim() && e.source !== 'blank')) c.changed += 1;
      if (!isCounted(r) || e.status !== 'done') continue;
      if (e.sets.length) c.recordedExercises += 1;
      else c.blankExercises += 1;
    }
  }
  return c;
}

export function generatedSessionId(weekStart: string, recordId: string): string {
  return `weekly-${weekStart}-${recordId}`.slice(0, 120);
}

/**
 * Workout records for a confirmed week. Returns records to write and IDs of
 * previously generated records that no longer apply (status changed to
 * skipped / not recorded).
 */
export function sessionsFromWeek(week: TrainingWeek, programme: Programme | null, newId: IdFn, now: Date): { upserts: WorkoutSession[]; removeIds: string[] } {
  const upserts: WorkoutSession[] = [];
  const removeIds: string[] = [];
  const iso = now.toISOString();
  for (const r of week.sessions) {
    if (r.live) continue;
    const id = r.sessionId ?? generatedSessionId(week.weekStart, r.id);
    if (!isCounted(r) || !r.localDate) {
      if (r.sessionId) removeIds.push(r.sessionId);
      continue;
    }
    const completedAt = new Date(`${r.localDate}T12:00:00`).toISOString();
    const day = programme?.days.find((d) => d.id === r.dayId);
    const exercises: SessionExercise[] = r.exercises
      .map((e, i): SessionExercise | null => {
        const pe = day?.exercises.find((x) => x.id === e.programmeExerciseId);
        const lib = EXERCISES_BY_ID.get(e.exerciseId);
        const recorded = e.status === 'done' ? e.sets : [];
        if (!recorded.length && e.status !== 'skipped') return null;
        return {
          key: `weekly:${i}:${e.programmeExerciseId ?? e.exerciseId}`,
          exerciseId: e.exerciseId,
          name: e.name,
          loadType: e.loadType,
          unit: e.unit,
          tags: lib?.tags ? [...lib.tags] : ['strength'],
          priority: pe?.priority ?? false,
          target: { sets: pe?.sets ?? recorded.length, repMin: pe?.repMin ?? null, repMax: pe?.repMax ?? null, durationSec: pe?.durationSec ?? null, restSec: pe?.restSec ?? 0 },
          skipped: e.status === 'skipped',
          notes: '',
          sets: recorded.map((s) => ({
            id: newId(),
            load: e.loadType === 'bodyweight' || e.loadType === 'timed' ? null : s.load,
            reps: e.loadType === 'timed' ? null : s.reps,
            durationSec: e.loadType === 'timed' ? s.durationSec : null,
            rir: null,
            completed: true,
            completedAt,
            prefill: e.source === 'copied' ? ('previous' as const) : e.source === 'planned' ? ('planned' as const) : ('none' as const),
          })),
        };
      })
      .filter((x): x is SessionExercise => x !== null);
    if (!exercises.some((e) => e.sets.length)) {
      if (r.sessionId) removeIds.push(r.sessionId);
      continue;
    }
    upserts.push({
      id,
      schemaVersion: 3,
      state: 'completed',
      source: 'weekly',
      name: r.name,
      programmeId: week.programmeId,
      dayId: r.dayId,
      planKind: 'weekly',
      emphasis: null,
      checkIn: null,
      exercises,
      position: 0,
      startedAt: completedAt,
      updatedAt: iso,
      completedAt,
      completedLocalDate: r.localDate,
      discardedAt: null,
      pausedAt: null,
      pausedMs: 0,
      durationSource: 'not-recorded',
      durationSec: null,
      restStartedAt: null,
      restDurationSec: null,
      substitutions: [],
      importHash: null,
      editedAt: week.status === 'confirmed' ? iso : null,
    });
  }
  return { upserts, removeIds };
}

/** Confirm (or re-confirm) a week. Earlier confirmed versions are kept in `history`. */
export function confirmWeekRecord(week: TrainingWeek, upserts: readonly WorkoutSession[], now: Date): TrainingWeek {
  const iso = now.toISOString();
  const ids = new Map(upserts.map((s) => [s.id, s]));
  const history = week.status === 'confirmed' && week.confirmedAt ? [...week.history, { revision: week.revision, confirmedAt: week.confirmedAt, sessions: week.sessions }].slice(-10) : week.history;
  return {
    ...week,
    status: 'confirmed',
    confirmedAt: iso,
    updatedAt: iso,
    revision: week.revision + 1,
    reviewDismissed: false,
    history,
    sessions: week.sessions.map((r) => {
      if (r.live) return r;
      const id = r.sessionId ?? generatedSessionId(week.weekStart, r.id);
      return { ...r, sessionId: ids.has(id) ? id : null };
    }),
  };
}

/** Planned-load updates suggested after a confirmed week (applied only if the user keeps the option on). */
export function noteLoadUpdates(week: TrainingWeek, programme: Programme | null): { dayId: string; exerciseId: string; name: string; from: number | null; to: number; unit: ExercisePerformance['unit'] }[] {
  if (!programme) return [];
  const out: { dayId: string; exerciseId: string; name: string; from: number | null; to: number; unit: ExercisePerformance['unit'] }[] = [];
  for (const r of week.sessions) {
    if (!isCounted(r) || r.live) continue;
    const day = programme.days.find((d) => d.id === r.dayId);
    for (const e of r.exercises) {
      const pe = day?.exercises.find((x) => x.id === e.programmeExerciseId);
      if (!pe || e.status !== 'done' || !e.sets.length || pe.loadType !== e.loadType) continue;
      if (pe.loadType === 'bodyweight' || pe.loadType === 'timed' || pe.loadType === 'unspecified') continue;
      const loads = e.sets.map((s) => s.load).filter((l): l is number => l !== null);
      if (!loads.length) continue;
      const top = pe.loadType === 'assisted' ? Math.min(...loads) : Math.max(...loads);
      const from = pe.plannedLoad ? pe.plannedLoad.value : null;
      if (from !== null && pe.plannedLoad!.unit === e.unit && Math.abs(from - top) < 0.001) continue;
      if (out.some((o) => o.exerciseId === pe.id)) continue;
      out.push({ dayId: day!.id, exerciseId: pe.id, name: pe.name, from: pe.plannedLoad?.unit === e.unit ? from : null, to: top, unit: e.unit });
    }
  }
  return out;
}

export function applyLoadUpdates(programme: Programme, updates: ReturnType<typeof noteLoadUpdates>, now: Date): Programme {
  if (!updates.length) return programme;
  return {
    ...programme,
    updatedAt: now.toISOString(),
    days: programme.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        const u = updates.find((x) => x.dayId === d.id && x.exerciseId === e.id);
        return u ? { ...e, plannedLoad: { value: u.to, unit: u.unit }, uncertain: e.uncertain.filter((f) => f !== 'unit') } : e;
      }),
    })),
  };
}

/** The confirmed week before `weekStart`, if any. */
export function previousConfirmedWeek(weeks: readonly TrainingWeek[], weekStart: string): TrainingWeek | null {
  return [...weeks].filter((w) => w.status === 'confirmed' && w.weekStart < weekStart).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0] ?? null;
}

export { weekStartOf };
