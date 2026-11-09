import { EXERCISES_BY_ID } from '../content/exercises';
import { comparableKey } from './loads';
import { type ConvertContext, entryToExercise, performanceText } from './noteFormat';
import { hashText, normalizeName } from './notesImport';
import { type NoteEntry, type ParsedNote, performanceSets } from './noteParser';
import type { CustomExercise, LoadType, NoteField, ProgrammeDay, ProgrammeExercise, SessionExercise, TrainingWeek, UndatedPerformance, WeightUnit, WorkoutSession } from './types';

/**
 * Paste-from-Notes import: resolving the user's answers, checking what still
 * needs review, and turning a reviewed note into a plan, historical records,
 * or this week's update. Dates are never invented.
 */

export type ImportMode = 'template' | 'history' | 'week';

export interface Resolution {
  loadType?: LoadType;
  unit?: WeightUnit;
  /** Chosen library variation, or null to keep the written name as a new exercise. */
  exerciseId?: string | null;
  /** Swap sets and reps (for "10x3"-style notation read the other way). */
  swap?: boolean;
}

export type Resolutions = Record<string, Resolution>;

export const entryKey = (dayIdx: number, entryIdx: number) => `${dayIdx}:${entryIdx}`;

/** Duplicate detection key: the same text imported the same way. Whitespace and case don't matter. */
export function importHash(text: string, mode: ImportMode): string {
  const normalised = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(Boolean)
    .join('\n');
  return `${mode}:${hashText(normalised)}`;
}

/** Apply the user's answers to the parsed note (pure). */
export function resolveNote(parsed: ParsedNote, res: Resolutions): ParsedNote {
  return {
    ...parsed,
    days: parsed.days.map((d, di) => ({
      ...d,
      entries: d.entries.map((e, ei) => {
        const r = res[entryKey(di, ei)];
        if (!r) return e;
        let next: NoteEntry = { ...e, uncertain: [...e.uncertain] };
        const drop = (f: NoteField) => (next.uncertain = next.uncertain.filter((u) => u !== f));
        if (r.exerciseId !== undefined) {
          if (r.exerciseId) {
            const lib = EXERCISES_BY_ID.get(r.exerciseId);
            next = { ...next, exerciseId: r.exerciseId, name: lib?.name ?? next.name, known: true, candidates: [] };
            if (!next.loadType && lib && !next.values?.load) next.loadType = lib.loadType;
            if (!next.loadType && lib && next.values?.load != null && !next.values.loadType) {
              if (lib.loadType === 'total') {
                next.loadType = 'total';
                drop('loadType');
              } else {
                next.suggestedLoadType = lib.loadType;
                if (!next.uncertain.includes('loadType')) next.uncertain.push('loadType');
              }
            }
          } else next = { ...next, candidates: [] };
          drop('exercise');
        }
        if (r.loadType) {
          next.loadType = r.loadType;
          drop('loadType');
        }
        if (r.unit && next.values) {
          next = { ...next, unit: r.unit, values: { ...next.values, unit: r.unit } };
          drop('unit');
        }
        if (r.swap && next.values && next.values.sets !== null && next.values.repMin !== null && next.values.repMin === next.values.repMax) {
          const v = next.values;
          next = { ...next, values: { ...v, sets: v.repMin, repMin: v.sets, repMax: v.sets, assumptions: [] }, assumptions: [] };
          drop('sets');
        }
        return next;
      }),
    })),
  };
}

export interface ImportIssue {
  key: string | null;
  message: string;
  blocking: boolean;
}

/** What still needs a decision. Historical and weekly imports need every value to be unambiguous. */
export function importIssues(parsed: ParsedNote, mode: ImportMode, opts: { date: string | null; undated: boolean }): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const strict = mode !== 'template';
  if (parsed.days.every((d) => d.entries.length === 0)) issues.push({ key: null, message: 'No exercises recognised yet.', blocking: true });
  parsed.days.forEach((d, di) =>
    d.entries.forEach((e, ei) => {
      const key = entryKey(di, ei);
      if (e.uncertain.includes('exercise')) issues.push({ key, message: `${e.name}: choose the exercise variation.`, blocking: true });
      if (e.uncertain.includes('loadType')) issues.push({ key, message: `${e.name}: is the load total, per side, or per dumbbell?`, blocking: strict });
      if (e.uncertain.includes('unit')) issues.push({ key, message: `${e.name}: kg or lb?`, blocking: strict });
      if (strict && e.values && performanceSets(e.values, e.loadType).length === 0) issues.push({ key, message: `${e.name}: no performed reps or time found (a range like 8–12 is a plan, not a result).`, blocking: false });
    }),
  );
  if (mode === 'history' && !opts.undated && !opts.date && parsed.days.some((d) => !d.date)) issues.push({ key: null, message: 'Choose the date these workouts were done, or mark them as undated.', blocking: true });
  return issues;
}

/**
 * What was logged, as a note line ("Logged: 60 kg × 8; 65 kg × 6"), when the
 * plan alone can't show it exactly (a different rep count, or a weight per set).
 * Only sets written as performed count — "3x8" is a plan, not a log.
 */
export function loggedNote(e: NoteEntry, pe: Pick<ProgrammeExercise, 'sets' | 'repMin' | 'repMax' | 'loadType' | 'plannedLoad'>, unit: WeightUnit): string | null {
  const v = e.values;
  if (!v || (v.reps.length === 0 && v.durations.length === 0)) return null;
  const loadType = e.loadType ?? pe.loadType;
  const sets = performanceSets(v, loadType);
  if (!sets.length) return null;
  const plannedLoad = pe.plannedLoad?.value ?? null;
  const shownByPlan = sets.length === pe.sets && pe.repMin !== null && pe.repMin === pe.repMax && sets.every((s) => s.reps === pe.repMin && (s.load ?? null) === plannedLoad);
  return shownByPlan ? null : `Logged: ${performanceText(sets, loadType, e.unit ?? unit)}`;
}

/** Programme days from a reviewed note. What was logged is kept with the exercise, separate from the plan. */
export function templateDays(parsed: ParsedNote, ctx: ConvertContext): ProgrammeDay[] {
  return parsed.days.map((d) => ({
    id: ctx.newId(),
    name: d.heading.slice(0, 200),
    exercises: d.entries.map((e) => {
      const pe = entryToExercise(e, ctx);
      const logged = loggedNote(e, pe, ctx.unit);
      return logged ? { ...pe, notes: [logged, pe.notes].filter(Boolean).join('\n').slice(0, 5000) } : pe;
    }),
    notes: d.notes.join('\n').slice(0, 5000),
  }));
}

function exerciseIdOf(e: NoteEntry, ctx: ConvertContext): string {
  return entryToExercise(e, ctx).exerciseId;
}

export interface HistoryResult {
  sessions: WorkoutSession[];
  undated: UndatedPerformance[];
  /** Entries without performed values (not imported). */
  skipped: string[];
}

/**
 * Historical records from a reviewed note. Each day uses the date in its
 * heading, else the date the user chose; with `undated`, nothing is dated and
 * the values are kept only as an undated reference (never in trends).
 */
export function historyRecords(parsed: ParsedNote, opts: { date: string | null; undated: boolean; hash: string; now: Date; unit: WeightUnit }, ctx: ConvertContext): HistoryResult {
  const sessions: WorkoutSession[] = [];
  const undated: UndatedPerformance[] = [];
  const skipped: string[] = [];
  parsed.days.forEach((d, di) => {
    const date = opts.undated ? null : (d.date ?? opts.date);
    const exercises: SessionExercise[] = [];
    d.entries.forEach((e, ei) => {
      const loadType = e.loadType ?? 'unspecified';
      const sets = performanceSets(e.values, loadType);
      if (!sets.length) {
        skipped.push(e.name);
        return;
      }
      const exerciseId = exerciseIdOf(e, ctx);
      const unit = e.unit ?? opts.unit;
      if (!date) {
        undated.push({ exerciseId, name: e.name, loadType, unit, sets });
        return;
      }
      const completedAt = new Date(`${date}T12:00:00`).toISOString();
      exercises.push({
        key: `import:${di}:${ei}:${exerciseId}`,
        exerciseId,
        name: e.name,
        loadType,
        unit,
        tags: EXERCISES_BY_ID.get(exerciseId)?.tags ? [...EXERCISES_BY_ID.get(exerciseId)!.tags] : ['strength'],
        priority: false,
        target: { sets: sets.length, repMin: null, repMax: null, durationSec: null, restSec: 0 },
        skipped: false,
        notes: e.comments.join('\n').slice(0, 500),
        sets: sets.map((s) => ({ id: ctx.newId(), load: loadType === 'bodyweight' || loadType === 'timed' ? null : s.load, reps: loadType === 'timed' ? null : s.reps, durationSec: loadType === 'timed' ? s.durationSec : null, rir: null, completed: true, completedAt, prefill: 'none' as const })),
      });
    });
    if (!date || !exercises.length) return;
    const completedAt = new Date(`${date}T12:00:00`).toISOString();
    sessions.push({
      id: ctx.newId(),
      schemaVersion: 3,
      state: 'completed',
      source: 'import',
      name: d.heading.slice(0, 200) || 'Imported workout',
      programmeId: null,
      dayId: null,
      planKind: 'import',
      emphasis: null,
      checkIn: null,
      exercises,
      position: 0,
      startedAt: completedAt,
      updatedAt: opts.now.toISOString(),
      completedAt,
      completedLocalDate: date,
      discardedAt: null,
      pausedAt: null,
      pausedMs: 0,
      durationSource: 'not-recorded',
      durationSec: null,
      restStartedAt: null,
      restDurationSec: null,
      substitutions: [],
      importHash: `${opts.hash}:${di}`.slice(0, 64),
      editedAt: null,
    });
  });
  return { sessions, undated, skipped };
}

/**
 * Fill this week's draft from a pasted note: matching exercises get the pasted
 * values (marked "imported"); sessions are NOT marked done — the user still
 * confirms them.
 */
export function fillWeek(week: TrainingWeek, parsed: ParsedNote, ctx: ConvertContext & { created?: CustomExercise[] }): { week: TrainingWeek; matched: number; unmatched: string[] } {
  let matched = 0;
  const unmatched: string[] = [];
  const sessions = week.sessions.map((r) => ({ ...r, exercises: r.exercises.map((x) => ({ ...x })) }));
  const used = new Set<string>();
  for (const d of parsed.days) {
    for (const e of d.entries) {
      const sets = performanceSets(e.values, e.loadType);
      if (!sets.length) continue;
      const id = e.exerciseId;
      const lt = e.loadType;
      let placed = false;
      // Prefer the session whose name or weekday matches the pasted day heading.
      const ordered = [...sessions].sort((a, b) => Number(sameDay(b.name, d.heading, d.weekday)) - Number(sameDay(a.name, d.heading, d.weekday)));
      for (const r of ordered) {
        if (r.live) continue;
        const idx = r.exercises.findIndex((x, i) => !used.has(`${r.id}:${i}`) && ((id && comparableKey(x.exerciseId, x.loadType) === comparableKey(id, lt ?? x.loadType)) || normalizeName(x.name) === normalizeName(e.name)));
        if (idx < 0) continue;
        const x = r.exercises[idx]!;
        if (lt && lt !== x.loadType) continue; // different convention: not the same record
        used.add(`${r.id}:${idx}`);
        r.exercises[idx] = { ...x, sets, text: performanceText(sets, x.loadType, e.unit ?? x.unit), source: 'imported', uncertain: [] };
        matched += 1;
        placed = true;
        break;
      }
      if (!placed) unmatched.push(e.name);
    }
  }
  void ctx;
  return { week: { ...week, sessions }, matched, unmatched };
}

function sameDay(recordName: string, heading: string, weekday: number | null): boolean {
  const a = normalizeName(recordName);
  const b = normalizeName(heading);
  if (a && b && (a.includes(b) || b.includes(a))) return true;
  return weekday !== null && new RegExp(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][weekday]!, 'i').test(recordName);
}
