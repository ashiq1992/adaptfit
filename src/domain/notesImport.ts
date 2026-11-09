import { AMBIGUOUS_NAMES, EXERCISES, EXERCISES_BY_ID } from '../content/exercises';
import { isLocalDate } from './dates';
import { usesLoad } from './loads';
import type { CustomExercise, ExerciseTag, LoadType, SessionExercise, WeightUnit, WorkoutSession } from './types';

/**
 * Parse free-text training notes into reviewable rows. Nothing is guessed:
 * missing dates, unknown exercises, unclear loading conventions, and loads
 * without units are flagged for the user to resolve on the review screen.
 *
 * Supported examples:
 *   Smith Bench 30 kg/side 3x8
 *   Pull-ups BW 10, 9, 8
 *   RDL 20 kg each hand 3x10
 *   Dips BW+10kg 3x6
 *   Plank 3x45s
 */

export interface ImportSet {
  reps: number | null;
  durationSec: number | null;
  load: number | null;
}

export interface ImportRow {
  id: string;
  lineNo: number;
  raw: string;
  date: string | null;
  sessionName: string | null;
  exerciseId: string | null;
  /** Possible variations when the name was ambiguous (user must choose). */
  candidates: string[];
  name: string;
  loadType: LoadType | null;
  /** Library default offered on the review screen; must be confirmed. */
  suggestedLoadType: LoadType | null;
  unit: WeightUnit | null;
  sets: ImportSet[];
  include: boolean;
}

export interface IgnoredLine {
  lineNo: number;
  raw: string;
  reason: string;
}

export interface ImportParseResult {
  rows: ImportRow[];
  ignored: IgnoredLine[];
}

interface LibraryEntry {
  id: string;
  name: string;
  loadType: LoadType;
  tags: ExerciseTag[];
  keys: string[];
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gym shorthand → full words, so "db flat press" finds "Dumbbell bench press". */
const SHORTHAND: [RegExp, string][] = [
  [/\bdbs?\b/g, 'dumbbell'],
  [/\bbb\b/g, 'barbell'],
  [/\binc\b/g, 'incline'],
  [/\bpd\b/g, 'pulldown'],
  [/\bext\b/g, 'extension'],
  [/\bexts\b/g, 'extensions'],
  [/\bdl\b/g, 'deadlift'],
  [/\blats\b/g, 'lat'],
  [/\bpull downs?\b/g, 'pulldown'],
  [/\bpulldowns\b/g, 'pulldown'],
  [/\bflat bench press\b/g, 'bench press'],
  [/\bflat press\b/g, 'bench press'],
  [/\bflat bench\b/g, 'bench'],
  [/\bdumbbell flat\b/g, 'dumbbell'],
];

/** Normalised exercise name with common gym shorthand expanded. */
export function exerciseKey(s: string): string {
  let k = normalizeName(s);
  for (const [re, to] of SHORTHAND) k = k.replace(re, to);
  return k.replace(/\s+/g, ' ').trim();
}

function library(custom: readonly CustomExercise[]): LibraryEntry[] {
  const builtIn = EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    loadType: e.loadType,
    tags: [...e.tags],
    keys: [e.name, e.id.replace(/-/g, ' '), ...(e.aliases ?? [])].map(exerciseKey),
  }));
  const own = custom.map((c) => ({ id: c.id, name: c.name, loadType: c.loadType, tags: c.tags, keys: [exerciseKey(c.name)] }));
  return [...own, ...builtIn];
}

/** Exact (normalised) name or alias match; no fuzzy guessing. */
export function matchExercise(name: string, custom: readonly CustomExercise[] = []): LibraryEntry | null {
  const n = exerciseKey(name);
  const singular = n.replace(/s$/, '');
  for (const e of library(custom)) if (e.keys.includes(n) || e.keys.includes(singular)) return e;
  return null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Parse a date heading. Returns the date, or `incomplete` when the year is
 * missing (never assumed), or null when the line isn't a date.
 */
export function parseDateLine(line: string): { date: string } | { incomplete: string } | null {
  const t = line.trim().replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*,?\s+/i, '').replace(/[:,]$/, '');
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return finish(Number(m[1]), Number(m[2]), Number(m[3]), line);
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(t); // D/M/YYYY (Singapore convention)
  if (m) return finish(Number(m[3]), Number(m[2]), Number(m[1]), line);
  m = /^(\d{1,2})\s+([a-z]{3,9})\.?,?\s*(\d{4})?$/i.exec(t);
  if (m && monthOf(m[2]!)) {
    return m[3] ? finish(Number(m[3]), monthOf(m[2]!)!, Number(m[1]), line) : { incomplete: line.trim() };
  }
  m = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?$/i.exec(t);
  if (m && monthOf(m[1]!)) {
    return m[3] ? finish(Number(m[3]), monthOf(m[1]!)!, Number(m[2]), line) : { incomplete: line.trim() };
  }
  return null;
}

function monthOf(word: string): number | undefined {
  const w = word.toLowerCase();
  const full = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const idx = full.findIndex((f) => f === w || (w.length >= 3 && f.startsWith(w)));
  return idx >= 0 ? idx + 1 : MONTHS[w];
}

function finish(y: number, mo: number, d: number, raw: string): { date: string } | { incomplete: string } {
  const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isLocalDate(iso) ? { date: iso } : { incomplete: raw.trim() };
}

const UNIT = '(kg|kgs|lb|lbs)';
const QUALIFIER = '(\\s*(?:/\\s*side|per\\s+side|each\\s+side|a\\s+side|each\\s+hand|per\\s+hand|per\\s+dumbbell|/\\s*db|each|total))?';

function unitOf(u: string | undefined): WeightUnit | null {
  if (!u) return null;
  return u.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
}

function qualifierType(q: string | undefined): LoadType | null {
  if (!q) return null;
  const t = q.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/side/.test(t)) return 'per-side';
  if (/hand|dumbbell|db|each/.test(t)) return 'per-dumbbell';
  if (/total/.test(t)) return 'total';
  return null;
}

let rowCounter = 0;

/** Parse one exercise line into a row (without date context). */
export function parseExerciseLine(raw: string, lineNo: number, custom: readonly CustomExercise[] = []): ImportRow | IgnoredLine {
  const line = raw.trim().replace(/[–—]/g, '-');
  const split = /^(.*?[a-z)])\s*[:-]?\s+((?:bw\b|assist|\d).*)$/i.exec(line);
  if (!split) return { lineNo, raw, reason: 'Not recognised as an exercise line.' };
  const name = split[1]!.trim();
  let rest = ` ${split[2]!.trim()} `;
  let loadType: LoadType | null = null;
  let load: number | null = null;
  let unit: WeightUnit | null = null;
  let unitMissing = false;

  // Loading convention and load.
  let m = new RegExp(`\\bbw\\s*\\+\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?`, 'i').exec(rest);
  if (m) {
    loadType = 'bodyweight-plus';
    load = Number(m[1]);
    unit = unitOf(m[2]);
    unitMissing = !unit;
    rest = rest.replace(m[0], ' ');
  } else if ((m = new RegExp(`\\bassist(?:ed|ance)?\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?`, 'i').exec(rest))) {
    loadType = 'assisted';
    load = Number(m[1]);
    unit = unitOf(m[2]);
    unitMissing = !unit;
    rest = rest.replace(m[0], ' ');
  } else if ((m = /\bbw\b/i.exec(rest))) {
    loadType = 'bodyweight';
    rest = rest.replace(m[0], ' ');
  } else if ((m = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}${QUALIFIER}`, 'i').exec(rest))) {
    load = Number(m[1]);
    unit = unitOf(m[2]);
    loadType = qualifierType(m[3]);
    rest = rest.replace(m[0], ' ');
  } else if ((m = /@\s*(\d+(?:\.\d+)?)(?!\s*[x×])/i.exec(rest))) {
    load = Number(m[1]);
    unitMissing = true;
    rest = rest.replace(m[0], ' ');
  }

  // Sets.
  const sets: ImportSet[] = [];
  if ((m = /(\d+)\s*[x×]\s*(\d+)\s*(?:s|sec|secs|seconds)\b/i.exec(rest))) {
    loadType = loadType ?? 'timed';
    for (let i = 0; i < Number(m[1]); i++) sets.push({ reps: null, durationSec: Number(m[2]), load: null });
  } else if ((m = /(\d+)\s*[x×]\s*(\d+)/i.exec(rest))) {
    const count = Number(m[1]);
    for (let i = 0; i < Math.min(count, 20); i++) sets.push({ reps: Number(m[2]), durationSec: null, load });
  } else if ((m = /(\d+(?:\s*,\s*\d+)+|\b\d+\b)/.exec(rest.trim()))) {
    for (const r of m[0].split(',')) sets.push({ reps: Number(r.trim()), durationSec: null, load });
  }

  let match = matchExercise(name, custom);
  let candidates: string[] = [];
  const ambiguous = AMBIGUOUS_NAMES[normalizeName(name)];
  if (!match && ambiguous) {
    // "each hand / per dumbbell" is evidence of dumbbells; other conventions don't settle the variation.
    const narrowed = loadType === 'per-dumbbell' ? ambiguous.filter((id) => EXERCISES_BY_ID.get(id)?.loadType === 'per-dumbbell') : [];
    if (narrowed.length === 1) match = matchExercise(EXERCISES_BY_ID.get(narrowed[0]!)!.name, custom);
    else candidates = [...ambiguous];
  }
  rowCounter += 1;
  const row: ImportRow = {
    id: `import-row-${lineNo}-${rowCounter}`,
    lineNo,
    raw,
    date: null,
    sessionName: null,
    exerciseId: match?.id ?? null,
    candidates,
    name: match?.name ?? name,
    loadType,
    suggestedLoadType: loadType ? null : (match?.loadType ?? null),
    unit: unitMissing ? null : (unit ?? (loadType === 'bodyweight' || loadType === 'timed' ? null : unit)),
    sets: sets.map((s) => ({ ...s, load: usesLoad(loadType ?? 'total') ? s.load : null })),
    include: true,
  };
  return row;
}

/** Parse a whole block of notes. Date headings apply to following lines. */
export function parseNotes(text: string, custom: readonly CustomExercise[] = []): ImportParseResult {
  const rows: ImportRow[] = [];
  const ignored: IgnoredLine[] = [];
  let date: string | null = null;
  let dateRaw: string | null = null;
  let sessionName: string | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    if (!raw.trim()) return;
    const d = parseDateLine(raw);
    if (d) {
      if ('date' in d) {
        date = d.date;
        dateRaw = null;
      } else {
        date = null;
        dateRaw = d.incomplete;
        ignored.push({ lineNo, raw, reason: 'Date without a year — choose the date on the review screen.' });
      }
      sessionName = null;
      return;
    }
    if (!/\d|\bbw\b/i.test(raw)) {
      sessionName = raw.trim().replace(/[:\-–]+$/, '').slice(0, 60);
      return;
    }
    const parsed = parseExerciseLine(raw, lineNo, custom);
    if ('reason' in parsed) {
      ignored.push(parsed);
      return;
    }
    rows.push({ ...parsed, date, sessionName });
  });
  void dateRaw;
  return { rows, ignored };
}

/** Problems that must be resolved before a row can be saved. Empty = ready. */
export function rowIssues(row: ImportRow): string[] {
  const issues: string[] = [];
  if (!row.date) issues.push('Date missing');
  if (!row.exerciseId) issues.push(row.candidates.length ? 'Choose the exercise variation' : 'Exercise not recognised');
  if (!row.loadType) issues.push('Loading convention unclear');
  if (row.loadType && usesLoad(row.loadType) && row.loadType !== 'unspecified' && row.sets.some((s) => s.load !== null) && !row.unit) issues.push('Load unit missing');
  if (row.sets.length === 0) issues.push('No sets found');
  if (row.loadType === 'timed' ? row.sets.some((s) => !s.durationSec || s.durationSec < 1) : row.sets.some((s) => !s.reps || s.reps < 1)) issues.push('Invalid reps or duration');
  return issues;
}

/** FNV-1a 32-bit hash; stable across runs. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface ImportBuildResult {
  sessions: WorkoutSession[];
  duplicates: { date: string; name: string }[];
}

/**
 * Build completed sessions (one per date and heading) from resolved rows.
 * Duration is never invented. Sessions identical to an earlier import are skipped.
 */
export function buildImportSessions(args: {
  rows: readonly ImportRow[];
  existing: readonly WorkoutSession[];
  newId: () => string;
  now: Date;
  defaultUnit: WeightUnit;
  custom?: readonly CustomExercise[];
}): ImportBuildResult {
  const ready = args.rows.filter((r) => r.include && rowIssues(r).length === 0);
  const groups = new Map<string, ImportRow[]>();
  for (const r of ready) {
    const k = `${r.date}|${r.sessionName ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const existingHashes = new Set(args.existing.filter((s) => s.state !== 'discarded').map((s) => s.importHash).filter(Boolean));
  const sessions: WorkoutSession[] = [];
  const duplicates: ImportBuildResult['duplicates'] = [];
  const lib = library(args.custom ?? []);

  for (const [k, rows] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const [date, heading] = k.split('|') as [string, string];
    const name = heading || 'Imported workout';
    const canonical = JSON.stringify(rows.map((r) => [r.exerciseId, r.loadType, r.unit, r.sets]));
    const importHash = hashText(`${date}|${name}|${canonical}`);
    if (existingHashes.has(importHash)) {
      duplicates.push({ date, name });
      continue;
    }
    existingHashes.add(importHash);
    const completedAt = new Date(`${date}T12:00:00`).toISOString();
    const exercises: SessionExercise[] = rows.map((r, i) => {
      const entry = lib.find((e) => e.id === r.exerciseId);
      const loadType = r.loadType!;
      return {
        key: `import:${i}:${r.exerciseId}`,
        exerciseId: r.exerciseId!,
        name: entry?.name ?? r.name,
        loadType,
        unit: r.unit ?? args.defaultUnit,
        tags: entry?.tags ?? ['strength'],
        priority: false,
        target: { sets: r.sets.length, repMin: null, repMax: null, durationSec: null, restSec: 0 },
        skipped: false,
        notes: '',
        sets: r.sets.map((s) => ({
          id: args.newId(),
          load: usesLoad(loadType) ? s.load : null,
          reps: loadType === 'timed' ? null : s.reps,
          durationSec: loadType === 'timed' ? s.durationSec : null,
          rir: null,
          completed: true,
          completedAt,
          prefill: 'none' as const,
        })),
      };
    });
    sessions.push({
      id: args.newId(),
      schemaVersion: 3,
      state: 'completed',
      source: 'import',
      name,
      programmeId: null,
      dayId: null,
      planKind: 'import',
      emphasis: null,
      checkIn: null,
      exercises,
      position: 0,
      startedAt: completedAt,
      updatedAt: args.now.toISOString(),
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
      importHash,
      editedAt: null,
    });
  }
  return { sessions, duplicates };
}

export interface RoutineLine {
  raw: string;
  name: string;
  exerciseId: string | null;
  candidates: string[];
  loadType: LoadType | null;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  durationSec: number | null;
}

export interface RoutineDay {
  name: string;
  lines: RoutineLine[];
}

/**
 * Parse a pasted routine ("Upper Body A" headings, then lines like
 * "Smith bench 3x6-10", "Lateral raises 3x12-15", "Plank 3x45s").
 * Unknown or ambiguous exercises are left for the user to choose.
 */
export function parseRoutine(text: string, custom: readonly CustomExercise[] = []): { days: RoutineDay[]; ignored: string[] } {
  const days: RoutineDay[] = [];
  const ignored: string[] = [];
  let current: RoutineDay | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/[–—]/g, '-');
    if (!line) continue;
    if (!/\d/.test(line)) {
      current = { name: line.replace(/[:-]+$/, '').slice(0, 60), lines: [] };
      days.push(current);
      continue;
    }
    const m = /^(.*?[a-z)])\s*[:-]?\s+(\d+)\s*[x×]\s*(\d+)(?:\s*-\s*(\d+))?\s*(s|sec|secs|seconds)?\b/i.exec(line);
    if (!m) {
      ignored.push(raw);
      continue;
    }
    if (!current) {
      current = { name: 'Day 1', lines: [] };
      days.push(current);
    }
    const name = m[1]!.trim();
    const match = matchExercise(name, custom);
    const ambiguous = AMBIGUOUS_NAMES[normalizeName(name)];
    const candidates = !match && ambiguous ? [...ambiguous] : [];
    const timed = !!m[5];
    const a = Number(m[3]);
    const b = m[4] ? Number(m[4]) : a;
    current.lines.push({
      raw,
      name: match?.name ?? name,
      exerciseId: match?.id ?? null,
      candidates,
      loadType: timed ? 'timed' : (match?.loadType ?? null),
      sets: Math.min(20, Math.max(1, Number(m[2]))),
      repMin: timed ? null : Math.min(a, b),
      repMax: timed ? null : Math.max(a, b),
      durationSec: timed ? a : null,
    });
  }
  return { days: days.filter((d) => d.lines.length > 0), ignored };
}
