import { EXERCISES_BY_ID } from '../content/exercises';
import { trim } from './loads';
import { type NoteEntry, parseNote, type ParseContext, parseValues, performanceSets, resolveEntry, splitNameAndValues } from './noteParser';
import { DEFAULT_REST_SEC, programmeExercise } from './programme';
import type { CustomExercise, ExercisePerformance, LoadType, NoteField, PerformanceSet, Programme, ProgrammeDay, ProgrammeExercise, WeightUnit } from './types';

type IdFn = () => string;

/**
 * Text rendering of workout notes and the reverse: turning edited note text
 * back into structured programme data while keeping IDs (and so history
 * links) stable, and keeping anything not understood as free text.
 */

/** "30 kg/side", "8 kg/dumbbell", "45 kg", "BW + 10 kg", "assisted 20 kg", "bodyweight". */
export function noteLoad(load: number | null, loadType: LoadType, unit: WeightUnit): string {
  if (loadType === 'bodyweight') return 'bodyweight';
  if (loadType === 'timed') return load === null ? '' : `${trim(load)} ${unit}`;
  if (load === null) return '';
  switch (loadType) {
    case 'per-side':
      return `${trim(load)} ${unit}/side`;
    case 'per-dumbbell':
      return `${trim(load)} ${unit}/dumbbell`;
    case 'bodyweight-plus':
      return `BW + ${trim(load)} ${unit}`;
    case 'assisted':
      return `assisted ${trim(load)} ${unit}`;
    default:
      return `${trim(load)} ${unit}`;
  }
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "3 sets × 8 reps", "3 sets × 8–12 reps", "3 sets × 45 s". */
export function setsReps(pe: Pick<ProgrammeExercise, 'sets' | 'repMin' | 'repMax' | 'durationSec' | 'loadType' | 'uncertain'>): string {
  const unknownSets = pe.uncertain.includes('sets');
  const unknownReps = pe.uncertain.includes('reps');
  const sets = unknownSets ? '' : `${plural(pe.sets, 'set')}`;
  let work = '';
  if (pe.loadType === 'timed' || (pe.durationSec !== null && pe.repMin === null)) work = pe.durationSec !== null ? `${pe.durationSec} s` : '';
  else if (!unknownReps && pe.repMin !== null && pe.repMax !== null) work = pe.repMin === pe.repMax ? plural(pe.repMin, 'rep') : `${pe.repMin}–${pe.repMax} reps`;
  return [sets, work].filter(Boolean).join(' × ');
}

/** The value line under an exercise name: "3 sets × 8 reps — 30 kg/side". */
export function prescription(pe: ProgrammeExercise, unitFallback: WeightUnit): string {
  const sr = setsReps(pe);
  const load = pe.plannedLoad ? noteLoad(pe.plannedLoad.value, pe.loadType === 'unspecified' ? 'total' : pe.loadType, pe.plannedLoad.unit) : pe.loadType === 'bodyweight' ? 'bodyweight' : '';
  void unitFallback;
  return [sr, load].filter(Boolean).join(' — ');
}

/** "Rest 1:30", "Rest 2 min", "Rest 45 s", "No rest": always written, so it can be changed in the text. */
export function restText(sec: number): string {
  if (sec <= 0) return 'No rest';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `Rest ${s} s`;
  return s ? `Rest ${m}:${String(s).padStart(2, '0')}` : `Rest ${m} min`;
}

const clampRest = (sec: number) => Math.min(900, Math.max(0, Math.round(sec)));

/** Seconds from a line that only states rest ("Rest 1:30", "rest 2 min", "No rest"); null otherwise. */
export function restLineSeconds(line: string): number | null {
  const t = line.trim();
  if (!/^(?:rest\b|no\s+rest\b)/i.test(t)) return null;
  const v = parseValues(t);
  if (v.restSec === null || v.sets !== null || v.load !== null || v.reps.length || v.durationSec !== null) return null;
  return clampRest(v.restSec);
}

/** Editable text for one exercise: name, values line, rest, then any notes. */
export function exerciseText(pe: ProgrammeExercise, unit: WeightUnit): string {
  return [pe.name, prescription(pe, unit), restText(pe.restSec), pe.notes].filter((x) => x.trim()).join('\n');
}

/** Editable text for a whole day. */
export function dayText(day: ProgrammeDay, unit: WeightUnit): string {
  const blocks = day.exercises.map((e) => exerciseText(e, unit));
  return [day.name, ...blocks, day.notes].filter((x) => x.trim()).join('\n\n');
}

/** The full note as plain text (for copying to the clipboard or another app). */
export function programmeText(p: Programme, unit: WeightUnit): string {
  return [p.name.toUpperCase(), p.notes, ...p.days.map((d) => dayText(d, unit).replace(/^[^\n]*/, (h) => h.toUpperCase()))].filter((x) => x.trim()).join('\n\n');
}

/** Human description of uncertain fields, for the amber markers. */
export const UNCERTAIN_LABEL: Record<NoteField, string> = {
  exercise: 'Which exercise is this?',
  loadType: 'Total weight, per side, or per dumbbell?',
  unit: 'kg or lb?',
  sets: 'How many sets?',
  reps: 'How many reps?',
};

// ─────────────────────────────────────────────────────────────────
// Text → structure
// ─────────────────────────────────────────────────────────────────

export interface ConvertContext extends ParseContext {
  newId: IdFn;
  unit: WeightUnit;
  /** Custom exercises created while converting (caller saves them). */
  created?: CustomExercise[];
  now?: Date;
}

/** Find or create the exercise ID for an entry (custom exercises for unknown names). */
function exerciseIdFor(entry: Pick<NoteEntry, 'exerciseId' | 'name' | 'loadType' | 'suggestedLoadType'>, ctx: ConvertContext): string {
  if (entry.exerciseId) return entry.exerciseId;
  const existing = [...(ctx.custom ?? []), ...(ctx.created ?? [])].find((c) => c.name.trim().toLowerCase() === entry.name.trim().toLowerCase());
  if (existing) return existing.id;
  const c: CustomExercise = {
    id: `custom-${ctx.newId()}`,
    name: entry.name.trim().slice(0, 80) || 'Exercise',
    loadType: entry.loadType ?? entry.suggestedLoadType ?? 'unspecified',
    tags: ['strength'],
    createdAt: (ctx.now ?? new Date()).toISOString(),
  };
  ctx.created?.push(c);
  return c.id;
}

/**
 * Build (or update) a programme exercise from a parsed entry. `previous` keeps
 * the ID, rest time and priority so history and coaching links survive edits.
 */
export function entryToExercise(entry: NoteEntry, ctx: ConvertContext, previous?: ProgrammeExercise): ProgrammeExercise {
  const v = entry.values;
  const uncertain = new Set<NoteField>(entry.uncertain);
  const exerciseId = previous && previous.exerciseId === entry.exerciseId ? previous.exerciseId : previous && !entry.exerciseId && previous.name.toLowerCase() === entry.name.toLowerCase() ? previous.exerciseId : exerciseIdFor(entry, ctx);
  const lib = EXERCISES_BY_ID.get(exerciseId);
  const loadType: LoadType = entry.loadType ?? (previous && previous.exerciseId === exerciseId && entry.uncertain.includes('loadType') ? previous.loadType : null) ?? entry.suggestedLoadType ?? 'unspecified';
  const timed = loadType === 'timed' || (v?.durationSec ?? null) !== null;

  // Sets: stated, else from a rep list, else the previous value (an edit that didn't mention sets).
  let sets = v?.sets ?? (v && v.reps.length > 1 ? v.reps.length : null);
  if (sets === null && previous && !previous.uncertain.includes('sets')) sets = previous.sets;
  if (sets === null) uncertain.add('sets');
  else uncertain.delete('sets');

  let repMin: number | null = null;
  let repMax: number | null = null;
  if (!timed) {
    if (v?.repMin != null) {
      repMin = v.repMin;
      repMax = v.repMax ?? v.repMin;
    } else if (v && v.reps.length) {
      repMin = Math.min(...v.reps);
      repMax = Math.max(...v.reps);
    } else if (previous && !previous.uncertain.includes('reps') && previous.repMin !== null) {
      repMin = previous.repMin;
      repMax = previous.repMax;
    }
    if (repMin === null) uncertain.add('reps');
    else uncertain.delete('reps');
  } else uncertain.delete('reps');

  const durationSec = timed ? (v?.durationSec ?? v?.durations[0] ?? previous?.durationSec ?? lib?.defaultDurationSec ?? null) : null;
  const load = v?.load ?? null;
  const plannedLoad = load !== null && loadType !== 'bodyweight' && loadType !== 'timed' ? { value: load, unit: v?.unit ?? ctx.unit } : null;
  if (load !== null && !v?.unit) uncertain.add('unit');
  else uncertain.delete('unit');
  if (entry.loadType) uncertain.delete('loadType');
  if (loadType !== 'unspecified' && previous && previous.exerciseId === exerciseId && entry.uncertain.includes('loadType')) uncertain.delete('loadType');

  const base = previous ?? programmeExercise(ctx.newId, { exerciseId });
  return {
    ...base,
    exerciseId,
    name: entry.name.trim().slice(0, 120) || base.name,
    loadType: timed ? 'timed' : loadType,
    sets: sets ?? base.sets ?? 3,
    repMin: timed ? null : repMin,
    repMax: timed ? null : repMax,
    durationSec,
    restSec: v?.restSec != null ? clampRest(v.restSec) : base.restSec,
    notes: entry.comments.join('\n').slice(0, 5000),
    plannedLoad,
    uncertain: [...uncertain],
  };
}

/**
 * Parse an exercise block edited inline: first line is the name (it may also
 * carry values, "Bench 30 kg/side × 9"), a values line follows, anything else
 * is kept as the exercise's notes.
 */
export function parseExerciseBlock(text: string, ctx: ConvertContext, previous?: ProgrammeExercise): ProgrammeExercise | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const split = splitNameAndValues(lines[0]!);
  let name = lines[0]!;
  const valueParts: string[] = [];
  const comments: string[] = [];
  let restSec: number | null = null;
  if (split && parseValues(split.values).understood) {
    name = split.name;
    valueParts.push(split.values);
  }
  for (const l of lines.slice(1)) {
    const r: number | null = restSec === null ? restLineSeconds(l) : null;
    if (r !== null) {
      restSec = r;
      continue;
    }
    const pv = parseValues(l);
    if (/^(\d|x\s*\d|×|@|bw\b|bodyweight\b|assist)/i.test(l) && pv.understood && valueParts.length === 0) valueParts.push(l);
    else comments.push(l);
  }
  const values = valueParts.length ? parseValues(valueParts.join(' ')) : null;
  // Rest is always shown in the text: what is written is what the timer uses (none written → the default).
  const rest = restSec ?? (values?.restSec != null ? clampRest(values.restSec) : DEFAULT_REST_SEC);
  const resolved = resolveEntry(name, values, { ...ctx, knownLoadType: (id) => (previous && previous.exerciseId === id ? previous.loadType : (ctx.knownLoadType?.(id) ?? null)) });
  // Keep an existing link when the user only changed values (or the name still means the same exercise).
  const keepId = previous && (resolved.exerciseId === previous.exerciseId || (!resolved.exerciseId && name.toLowerCase() === previous.name.toLowerCase()));
  const entry: NoteEntry = { ...resolved, exerciseId: keepId ? previous!.exerciseId : resolved.exerciseId, lineNos: [], raw: lines, comments };
  if (!values && previous) {
    // Only the name or notes changed: keep the existing numbers.
    return { ...entryToExercise({ ...entry, values: null }, ctx, previous), restSec: rest, sets: previous.sets, repMin: previous.repMin, repMax: previous.repMax, durationSec: previous.durationSec, plannedLoad: previous.plannedLoad, loadType: previous.exerciseId === entry.exerciseId ? previous.loadType : entry.loadType ?? 'unspecified', uncertain: previous.uncertain.filter((u) => u !== 'exercise') };
  }
  return { ...entryToExercise(entry, ctx, previous), restSec: rest };
}

/**
 * Parse a day's full text (edit-as-text mode). Exercises are matched to the
 * existing ones by name so their IDs — and history links — are kept.
 */
export function parseDayText(text: string, previous: ProgrammeDay, ctx: ConvertContext): ProgrammeDay {
  const parsed = parseNote(text, { ...ctx, singleDay: true, knownLoadType: (id) => previous.exercises.find((e) => e.exerciseId === id)?.loadType ?? null });
  const d = parsed.days[0];
  const unused = [...previous.exercises];
  const exercises = (d?.entries ?? []).map((entry) => {
    const idx = unused.findIndex((e) => (entry.exerciseId && e.exerciseId === entry.exerciseId) || e.name.toLowerCase() === entry.name.toLowerCase());
    const prev = idx >= 0 ? unused.splice(idx, 1)[0] : undefined;
    const ex = entryToExercise({ ...entry, exerciseId: prev && !entry.exerciseId ? prev.exerciseId : entry.exerciseId }, ctx, prev);
    // The day text shows every exercise's rest: a deleted rest line means the default.
    return { ...ex, restSec: entry.values?.restSec != null ? clampRest(entry.values.restSec) : DEFAULT_REST_SEC };
  });
  const notes = [...parsed.preamble, ...(d?.notes ?? [])].join('\n');
  return { ...previous, name: (d?.heading ?? previous.name).slice(0, 200) || previous.name, exercises, notes: notes.slice(0, 5000) };
}

/** Days for a brand-new programme from a parsed note (Paste from Notes → template). */
export function daysFromNote(text: string, ctx: ConvertContext): { days: ProgrammeDay[]; preamble: string } {
  const parsed = parseNote(text, ctx);
  const days = parsed.days.map((d) => ({
    id: ctx.newId(),
    name: d.heading.slice(0, 200),
    exercises: d.entries.map((e) => entryToExercise(e, ctx)),
    notes: d.notes.join('\n').slice(0, 5000),
  }));
  return { days, preamble: parsed.preamble.join('\n') };
}

// ─────────────────────────────────────────────────────────────────
// Weekly performance text
// ─────────────────────────────────────────────────────────────────

/** "30 kg/side × 9, 8, 8", "BW × 10, 10, 9", "45, 45, 40 s". */
export function performanceText(sets: readonly PerformanceSet[], loadType: LoadType, unit: WeightUnit): string {
  if (!sets.length) return '';
  if (loadType === 'timed' || sets.every((s) => s.durationSec !== null && s.reps === null)) {
    const ds = sets.map((s) => s.durationSec ?? 0);
    return ds.every((d) => d === ds[0]) ? `${sets.length} × ${ds[0]} s` : `${ds.join(', ')} s`;
  }
  const loads = [...new Set(sets.map((s) => s.load))];
  const reps = sets.map((s) => s.reps ?? 0).join(', ');
  if (loads.length > 1) return sets.map((s) => `${noteLoad(s.load, loadType, unit) || '—'} × ${s.reps ?? 0}`).join('; ');
  const load = loadType === 'bodyweight' ? 'BW' : noteLoad(loads[0] ?? null, loadType, unit);
  return load ? `${load} × ${reps}` : `× ${reps}`;
}

/** Parse a weekly performance line; per-set "a × 8; b × 6" lists are supported. */
export function parsePerformance(text: string, loadType: LoadType, unit: WeightUnit): { sets: PerformanceSet[]; uncertain: NoteField[]; understood: boolean } {
  const t = text.trim();
  if (!t) return { sets: [], uncertain: [], understood: false };
  const parts = t.split(';').map((p) => p.trim()).filter(Boolean);
  const sets: PerformanceSet[] = [];
  const uncertain = new Set<NoteField>();
  for (const part of parts) {
    // Weekly shorthand: "32.5 × 8, 8, 7" — the unit and convention come from the exercise.
    const bare = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:\s*[,/ ]\s*\d+)*)$/i.exec(part);
    if (bare && loadType !== 'timed' && loadType !== 'bodyweight') {
      const load = Number(bare[1]!.replace(',', '.'));
      for (const r of bare[2]!.split(/[,/ ]+/).filter(Boolean)) sets.push({ load, reps: Number(r), durationSec: null });
      continue;
    }
    const v = parseValues(part);
    if (!v.understood) return { sets: [], uncertain: ['reps'], understood: false };
    // The convention is fixed by the exercise; a bare number keeps it. A different explicit convention is flagged.
    if (v.loadType && v.loadType !== loadType && !(loadType === 'unspecified')) uncertain.add('loadType');
    const usedUnit = v.unit ?? unit;
    v.uncertain.filter((u) => u !== 'unit').forEach((u) => uncertain.add(u));
    let s = performanceSets(v, loadType);
    if (!s.length && v.sets !== null && v.repMin !== null && v.repMin !== v.repMax) uncertain.add('reps');
    if (usedUnit !== unit && v.load !== null) s = s.map((x) => ({ ...x, load: x.load === null ? null : Math.round((usedUnit === 'lb' ? x.load / 2.2046226218 : x.load * 2.2046226218) * 100) / 100 }));
    sets.push(...s);
  }
  if (!sets.length) uncertain.add('reps');
  return { sets: sets.slice(0, 30), uncertain: [...uncertain], understood: sets.length > 0 };
}

/** True when two performances are the same (load, reps and time per set). */
export function samePerformance(a: readonly PerformanceSet[], b: readonly PerformanceSet[]): boolean {
  return a.length === b.length && a.every((s, i) => s.load === b[i]!.load && s.reps === b[i]!.reps && s.durationSec === b[i]!.durationSec);
}

/** Indices of sets whose values differ from the reference (for change highlighting). */
export function changedSets(cur: readonly PerformanceSet[], prev: readonly PerformanceSet[] | null): number[] {
  if (!prev) return [];
  return cur.map((s, i) => (prev[i] && s.load === prev[i]!.load && s.reps === prev[i]!.reps && s.durationSec === prev[i]!.durationSec ? -1 : i)).filter((i) => i >= 0);
}

export function isPerformanceChanged(p: Pick<ExercisePerformance, 'sets' | 'previous'>): boolean {
  return !!p.previous && !samePerformance(p.sets, p.previous.sets);
}
