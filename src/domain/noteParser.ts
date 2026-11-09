import { AMBIGUOUS_NAMES, EXERCISES_BY_ID } from '../content/exercises';
import { exerciseKey, matchExercise, parseDateLine } from './notesImport';
import type { CustomExercise, LoadType, NoteField, PerformanceSet, WeightUnit } from './types';

/**
 * Deterministic workout-note parser (no AI, no network).
 *
 * It understands common gym notation and leaves everything else as preserved
 * text. It never guesses silently: a missing unit, an unclear loading
 * convention ("Bench 30 kg" — total or per side?) or an ambiguous exercise
 * name is reported in `uncertain`, and any interpretation of unusual notation
 * ("10x3" read as 3 sets of 10) is listed in `assumptions` for review.
 *
 * Kept free of UI and storage concerns so an optional interpretation layer can
 * be added later without changing callers.
 */

export interface ParsedValues {
  sets: number | null;
  repMin: number | null;
  repMax: number | null;
  /** Explicit per-set reps, e.g. "9, 8, 8". */
  reps: number[];
  /** Seconds per set for timed work. */
  durationSec: number | null;
  /** Explicit per-set durations, e.g. "45, 45, 40 s". */
  durations: number[];
  load: number | null;
  unit: WeightUnit | null;
  /** Loading convention stated in the text (null = not stated). */
  loadType: LoadType | null;
  uncertain: NoteField[];
  assumptions: string[];
  /** "Not completed", "skipped", … */
  skipped: boolean;
  /** Whether anything numeric was understood. */
  understood: boolean;
  /** Words left over after parsing (e.g. "felt easy"); kept as a comment by callers. */
  extraText: string;
  /** Rest between sets, from "Rest: 2 min" or "90 sec rest". */
  restSec: number | null;
  /** Short notes kept verbatim, e.g. "RIR 1". */
  notes: string[];
  /** The line describes what was done ("Did 8 reps", "27.5 kg for 7 reps"), not a plan. */
  performed: boolean;
  /** "with added 5 kg": weight added to a bar or machine whose own weight isn't stated. */
  added: boolean;
  /**
   * Per-set loads written with the reps ("60x8, 65x6, 70x5"), aligned with
   * `reps`; null where a set's load wasn't written. When present, `load` is
   * the heaviest of them (used as the plan's load).
   */
  loads?: (number | null)[];
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const UNIT_RE = '(kgs?|kilos?|lbs?|pounds?)';
const SIDE = '(?:\\s*/\\s*side|\\s+(?:per|each|a)\\s+side|\\s*/\\s*s\\b)';
const DB = '(?:\\s*/\\s*(?:dumbbell|db)|\\s+(?:per|each|a)\\s+(?:dumbbell|db|hand|arm)|\\s+dbs?\\b|\\s+each\\b)';
const TOTAL = '(?:\\s+(?:in\\s+)?total)';

function num(s: string): number {
  return Number(s.replace(',', '.'));
}

function unitOf(u: string | undefined): WeightUnit | null {
  if (!u) return null;
  return /^(lb|pound)/i.test(u) ? 'lb' : 'kg';
}

const SKIP_RE = /\b(not completed|not done|skipped|skip|missed|did not train|didn'?t train|rest day)\b/i;

function normalise(text: string): string {
  return ` ${text
    .replace(/[×✕✖]/g, 'x')
    .replace(/(\d)\s*\*\s*(?=\d)/g, '$1x')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function qualifierType(q: string): LoadType | null {
  const t = q.toLowerCase();
  if (!t.trim()) return null;
  return /side|\/\s*s\b/.test(t) ? 'per-side' : /total/.test(t) ? 'total' : 'per-dumbbell';
}

// ─────────────────────────────────────────────────────────────────
// Small notation rules. Each reads one way people write sets and
// returns null when the text doesn't match it exactly.
// ─────────────────────────────────────────────────────────────────

interface SetPair {
  load: number;
  unit: WeightUnit | null;
  qualifier: string;
  reps: number;
  /** Written with a unit or a decimal, or too heavy to be a set count. */
  clearlyLoad: boolean;
}

/** One "weight × reps" pair: "60x8", "65kg x 6", "27.5 kg for 7 reps". */
const PAIR = `(?<![\\d.,x])(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?(${SIDE}|${DB})?\\s*(?:x|for)\\s*(\\d{1,3})(?!\\d|\\.\\d|\\s*x\\s*\\d)(?:\\s*reps?\\b)?`;

function toPair(m: RegExpExecArray): SetPair {
  const load = num(m[1]!);
  return { load, unit: unitOf(m[2]), qualifier: m[3] ?? '', reps: Number(m[4]), clearlyLoad: !!m[2] || /[.,]/.test(m[1]!) || load > 10 };
}

/**
 * Rule: a list of weight × reps pairs is one entry per set —
 * "60x8, 65x6, 70x5", "60kg x 8 / 65kg x 6", "100 x 5 then 110 x 3".
 */
function readSetList(rest: string): { index: number; length: number; pairs: SetPair[] } | null {
  const first = new RegExp(PAIR, 'gi');
  const next = new RegExp(`\\s*(?:[,;/&|]|\\band\\b|\\bthen\\b)?\\s*${PAIR}`, 'iy');
  let m: RegExpExecArray | null;
  while ((m = first.exec(rest))) {
    const pairs = [toPair(m)];
    let end = m.index + m[0].length;
    for (;;) {
      next.lastIndex = end;
      const n = next.exec(rest);
      if (!n) break;
      pairs.push(toPair(n));
      end = next.lastIndex;
    }
    if (pairs.length >= 2 && pairs.some((p) => p.clearlyLoad)) return { index: m.index, length: end - m.index, pairs };
    first.lastIndex = m.index + 1;
  }
  return null;
}

/** Rule: "20/22.5/25kg x 10/8/6" — a weight per set, then a rep count per set (or one for all). */
const SLASH_LOADS = new RegExp(`(?<![\\d.,/])(\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+(?:[.,]\\d+)?)+)\\s*${UNIT_RE}?(${SIDE}|${DB})?\\s*(?:x|for)\\s*(\\d{1,3}(?:\\s*/\\s*\\d{1,3})*)(?![\\d.])`, 'i');

/** Rule: "3x5x100kg" (sets × reps × weight) or "100kg x 5 x 3" (weight × reps × sets). */
const TRIPLE = new RegExp(`(?<![\\d.,x])(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?\\s*x\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?\\s*x\\s*(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?(?![\\d.]|\\s*x\\s*\\d)`, 'i');

/** Which of three numbers is the weight: the one with a unit, else the only decimal, else the only one above 20. */
function tripleLoadIndex(nums: string[], units: (string | undefined)[]): number | null {
  const only = (pred: (i: number) => boolean) => {
    const hits = [0, 1, 2].filter(pred);
    return hits.length === 1 ? hits[0]! : null;
  };
  return only((i) => !!units[i]) ?? only((i) => /[.,]/.test(nums[i]!)) ?? only((i) => num(nums[i]!) > 20);
}

/** Rule: everything after "drop set" / "drop to" is a drop set — kept as a note, never recorded as a set. */
const DROP_TAIL = /(?:^|[\s,;+(])(?:then\s+)?(?:drop\s*-?\s*sets?|dropsets?|drop(?:ped)?(?:\s+to)?)\b.*$/i;

/** Rule: "2000m", "5 km", "1.5 mi" — a distance, kept as a note (never read as minutes). */
const DISTANCE = /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(km|kms|mi|miles?|metres?|meters?|m)\b/i;

/** Parse the numeric part of a line: load, convention, sets, reps or time. */
export function parseValues(input: string): ParsedValues {
  let rest = normalise(input);
  const out: ParsedValues = { sets: null, repMin: null, repMax: null, reps: [], durationSec: null, durations: [], load: null, unit: null, loadType: null, uncertain: [], assumptions: [], skipped: SKIP_RE.test(input), understood: false, extraText: '', restSec: null, notes: [], performed: false, added: false };
  const take = (m: RegExpExecArray) => {
    rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
  };
  let m: RegExpExecArray | null;
  const TIME_UNIT = '(s|sec|secs|seconds|m|min|mins|minutes)\\b';
  const secs = (v: number, u: string) => (/^m/i.test(u) ? v * 60 : v);

  // ── Drop sets: kept as a note, never recorded as extra sets ──
  if ((m = DROP_TAIL.exec(rest))) {
    const kept = m[0].replace(/^[\s,;+(]+/, '').trim();
    out.notes.push(kept);
    out.assumptions.push(`“${kept}”: drop set kept as a note, not recorded as a set.`);
    take(m);
  }

  // ── Rest ("Rest: 2-3 min", "90 sec rest", "rest 1:30") and effort ("1 RIR", "RPE 8") ──
  if ((m = new RegExp(`\\brest\\s*:?\\s*(\\d+(?:[.,]\\d+)?)(?:\\s*-\\s*(\\d+(?:[.,]\\d+)?))?\\s*${TIME_UNIT}`, 'i').exec(rest))) {
    out.restSec = Math.round(secs(num(m[1]!), m[3]!));
    if (m[2]) out.notes.push(`Rest ${m[1]}–${m[2]} ${m[3]}`);
    take(m);
  } else if ((m = new RegExp(`(\\d+(?:[.,]\\d+)?)(?:\\s*-\\s*(\\d+(?:[.,]\\d+)?))?\\s*${TIME_UNIT}\\s*(?:of\\s+)?rest\\b`, 'i').exec(rest))) {
    out.restSec = Math.round(secs(num(m[1]!), m[3]!));
    take(m);
  } else if ((m = /\brest\s*:?\s*(\d{1,2}):([0-5]\d)\b/i.exec(rest))) {
    out.restSec = Number(m[1]) * 60 + Number(m[2]);
    take(m);
  }
  let effort = false;
  if ((m = /\b(\d+)\s*rir\b|\brir\s*:?\s*(\d+)\b/i.exec(rest))) {
    out.notes.push(`RIR ${m[1] ?? m[2]}`);
    effort = true;
    take(m);
  }
  if ((m = /@?\s*\brpe\s*:?\s*(\d+(?:[.,]\d)?)\b|(?:^|\s|@)\s*(?<![\dx.,])(\d+(?:[.,]\d)?)\s*rpe\b/i.exec(rest))) {
    out.notes.push(`RPE ${m[1] ?? m[2]}`);
    take(m);
  }
  // ── Distance ("2000m", "5 km"): a note, not minutes ──
  if ((m = DISTANCE.exec(rest)) && (m[2]!.toLowerCase() !== 'm' || num(m[1]!) >= 100)) {
    out.notes.push(`${m[1]} ${m[2]}`);
    take(m);
  }
  // "2 plates a side": the plates' weight isn't known — kept as written, never converted.
  if ((m = /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:plates?|pl)\b(?:\s+(?:a|per|each)\s+side)?/i.exec(rest))) {
    out.notes.push(m[0].trim());
    out.assumptions.push(`“${m[0].trim()}”: plate weight isn’t written, so it was kept as a note.`);
    take(m);
  }
  // "with added 1" (no unit): unclear what was added — kept as written, not used as a load.
  if ((m = /\badded\s+(\d+(?:[.,]\d+)?)(?!\s*(?:kgs?|kilos?|lbs?|pounds?)\b|[.,]?\d)/i.exec(rest))) {
    out.notes.push(m[0].trim());
    take(m);
  }
  out.performed = /\b(did|done|got|managed|hit|achieved)\b|\d\s*(?:kgs?|lbs?)?\s*(?:for|at)\s+\d+\s*reps?\b/i.test(rest) || effort;
  out.added = /\badded\b/i.test(rest);

  // ── A weight for each set ("60x8, 65x6", "20/22.5/25kg x 10/8/6", "3x5x100kg") ──
  const list = readSetList(rest);
  if (list) {
    const units = new Set(list.pairs.map((p) => p.unit).filter((u): u is WeightUnit => !!u));
    const loads = list.pairs.map((p) => p.load);
    out.reps = list.pairs.map((p) => p.reps);
    out.loads = loads;
    out.load = Math.max(...loads);
    out.unit = units.size === 1 ? [...units][0]! : null;
    out.loadType = qualifierType(list.pairs.find((p) => p.qualifier)?.qualifier ?? '');
    out.performed = true;
    if (units.size === 0) out.assumptions.push(`Read “${rest.slice(list.index, list.index + list.length).trim()}” as weight × reps for each set.`);
    rest = rest.slice(0, list.index) + ' ' + rest.slice(list.index + list.length);
  } else if ((m = SLASH_LOADS.exec(rest))) {
    const loads = splitDecimals(m[1]!);
    const reps = splitList(m[4]!);
    const clear = !!m[2] || /[.,]/.test(m[1]!) || loads.some((l) => l > 10);
    if (clear && (reps.length === loads.length || reps.length === 1)) {
      out.reps = loads.map((_, i) => reps[reps.length === 1 ? 0 : i]!);
      out.loads = loads;
      out.load = Math.max(...loads);
      out.unit = unitOf(m[2]);
      out.loadType = qualifierType(m[3] ?? '');
      out.performed = true;
    } else {
      out.notes.push(m[0].trim());
      out.uncertain.push('reps');
      out.assumptions.push(`“${m[0].trim()}”: the weights and reps don’t pair up, so it was kept as a note.`);
    }
    take(m);
  } else if ((m = TRIPLE.exec(rest))) {
    const nums = [m[1]!, m[3]!, m[5]!];
    const at = tripleLoadIndex(nums, [m[2], m[4], m[6]]);
    if (at === 0 || at === 2) {
      const [sets, reps] = at === 2 ? [nums[0]!, nums[1]!] : [nums[2]!, nums[1]!];
      out.load = num(nums[at]!);
      out.unit = unitOf(m[2 + at * 2]);
      out.sets = Number(sets);
      out.repMin = out.repMax = Number(reps);
      out.assumptions.push(`Read “${m[0].trim()}” as ${sets} sets of ${reps} reps with ${nums[at]}${out.unit ? ` ${out.unit}` : ''}.`);
      take(m);
    }
  }

  // ── Load and loading convention ───────────────────────────────
  if (out.load !== null) {
    // Already read with the sets above.
  } else if ((m = new RegExp(`\\b(?:bw|bodyweight|body weight)\\s*\\+\\s*${NUM}\\s*${UNIT_RE}?`, 'i').exec(rest))) {
    out.loadType = 'bodyweight-plus';
    out.load = num(m[1]!);
    out.unit = unitOf(m[2]);
    take(m);
  } else if ((m = new RegExp(`(?:^|[\\s(])\\+\\s*${NUM}\\s*${UNIT_RE}`, 'i').exec(rest) ?? new RegExp(`^\\s*\\+\\s*${NUM}\\s*${UNIT_RE}?`, 'i').exec(rest))) {
    // "+10kg": weight added (to a bodyweight move, or to a bar whose weight isn't written).
    out.load = num(m[1]!);
    out.unit = unitOf(m[2]);
    out.added = true;
    take(m);
  } else if (
    (m = new RegExp(`\\bassist(?:ed|ance)?\\s*${NUM}\\s*${UNIT_RE}?`, 'i').exec(rest)) ??
    (m = new RegExp(`\\bbw\\s*-\\s*${NUM}\\s*${UNIT_RE}?\\s*(?:assist(?:ed|ance)?)?`, 'i').exec(rest)) ??
    (m = new RegExp(`${NUM}\\s*${UNIT_RE}?\\s*assist(?:ed|ance)?\\b`, 'i').exec(rest))
  ) {
    out.loadType = 'assisted';
    out.load = num(m[1]!);
    out.unit = unitOf(m[2]);
    take(m);
  } else if ((m = /\b(bw|bodyweight|body weight)\b/i.exec(rest))) {
    out.loadType = 'bodyweight';
    take(m);
  } else if ((m = new RegExp(`${NUM}\\s*${UNIT_RE}\\b(${SIDE}|${DB}|${TOTAL})?`, 'i').exec(rest))) {
    out.load = num(m[1]!);
    out.unit = unitOf(m[2]);
    const q = (m[3] ?? '').toLowerCase();
    if (q) out.loadType = /side|\/\s*s\b/.test(q) ? 'per-side' : /total/.test(q) ? 'total' : 'per-dumbbell';
    take(m);
  } else if ((m = /@\s*(\d+(?:[.,]\d+)?)/.exec(rest))) {
    out.load = num(m[1]!);
    out.uncertain.push('unit');
    take(m);
  }
  out.added = out.added && out.load !== null;
  if (out.load === null && (m = /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:at|for)\s+(\d+)\s*reps?\b/i.exec(rest))) {
    out.load = num(m[1]!);
    out.repMin = out.repMax = Number(m[2]);
    take(m);
  }
  if (out.load !== null && out.unit === null && !out.uncertain.includes('unit')) out.uncertain.push('unit');

  // "x3 sets", "3 sets" on their own, or a trailing "x3" after reps: the number of sets.
  if ((m = /(?:^|\s)x\s*(\d+)\s*sets?\b/i.exec(rest)) ?? (m = /(?<![\d.,x×]\s?)\b(\d+)\s*sets?\b(?!\s*(?:x|of)?\s*\d)/i.exec(rest))) {
    out.sets = Number(m[1]);
    take(m);
  } else if ((out.repMin !== null || /\b\d+\s*reps?\b/i.test(rest)) && (m = /(?:^|\s)x\s*(\d+)(?=\s*(?:,(?!\s*\d)|$))/i.exec(rest.trimEnd()))) {
    // A trailing "x3" after the reps ("Did 8 reps … x3"): the number of sets.
    out.sets = Number(m[1]);
    take(m);
  }

  // ── Sets, reps and time ────────────────────────────────────────
  const TIME = TIME_UNIT;
  const toSec = secs;
  const preSets = out.sets;
  const preRep = out.repMin;
  if (preRep !== null || out.reps.length > 0) {
    // Reps already read ("45 at 8 reps", "60x8, 65x6"): nothing more to take.
  } else if ((m = new RegExp(`(\\d+)\\s*(?:sets?\\s*)?(?:x|of)\\s*(\\d+)\\s*${TIME}`, 'i').exec(rest))) {
    out.sets = Number(m[1]);
    out.durationSec = toSec(Number(m[2]), m[3]!);
    if (m[3] === 'm' || m[3] === 'M') out.assumptions.push(`Read “${m[2]}m” as ${m[2]} minutes.`);
    take(m);
  } else if ((m = new RegExp(`(\\d+)\\s*sets?\\s*(?:x|of)?\\s*(\\d+)(?:\\s*-\\s*(\\d+))?\\s*(?:reps?)?`, 'i').exec(rest))) {
    out.sets = Number(m[1]);
    out.repMin = Number(m[2]);
    out.repMax = m[3] ? Number(m[3]) : Number(m[2]);
    take(m);
  } else if ((m = /(?<![\d.,])(\d+[.,]\d+|\d+)\s*x\s*(\d+(?:\s*[,/]\s*\d+)+|\d+)(?!\s*-)/i.exec(rest)) && (/[.,]/.test(m[1]!) || /[,/]/.test(m[2]!))) {
    // "32.5 x 8" or "30 x 9, 8, 8": a load (unit not stated) × reps.
    if (out.load === null) {
      out.load = num(m[1]!);
      if (!out.uncertain.includes('unit')) out.uncertain.push('unit');
    }
    out.reps = splitList(m[2]!);
    take(m);
  } else if ((m = /(?<![\d.,])(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?(?!\s*[,/]\s*\d)/i.exec(rest))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (m[3]) {
      out.sets = a;
      out.repMin = Math.min(b, Number(m[3]));
      out.repMax = Math.max(b, Number(m[3]));
    } else if (a > 20 && out.load === null && out.loadType === null) {
      // "60x8": more than 20 can't be a set count — it's the weight, then the reps of one set.
      out.load = a;
      out.reps = [b];
    } else if (a >= 6 && b <= 5) {
      // "10x3" is usually written as reps × sets in gym notes.
      out.sets = b;
      out.repMin = out.repMax = a;
      out.assumptions.push(`Read “${a}x${b}” as ${b} sets of ${a} reps.`);
    } else {
      out.sets = a;
      out.repMin = out.repMax = b;
      if (a >= 6 && b >= 6 && a !== b) {
        out.uncertain.push('sets');
        out.assumptions.push(`Read “${a}x${b}” as ${a} sets of ${b} reps — check this.`);
      }
    }
    take(m);
  } else if ((m = /(?:^|\s)x\s*(\d+(?:\s*[,/ ]\s*\d+)*)/i.exec(rest))) {
    // "30 kg x 9, 8, 8" or "× 8"
    out.reps = splitList(m[1]!);
    take(m);
  }

  if (preSets !== null && out.sets === null) out.sets = preSets;
  if (out.repMin === null && out.reps.length === 0 && out.durationSec === null) {
    const UNIT_ONLY = '(?:s|sec|secs|seconds|m|min|mins|minutes)\\b';
    if ((m = new RegExp(`(?<![\\d.,])\\d+\\s*${UNIT_ONLY}(?:\\s*[,/]\\s*\\d+\\s*${UNIT_ONLY})+`, 'i').exec(rest))) {
      // "60s, 45s, 30s": one time per set.
      out.durations = [...m[0].matchAll(new RegExp(`(\\d+)\\s*${TIME}`, 'gi'))].map((x) => toSec(Number(x[1]), x[2]!));
      take(m);
    } else if ((m = new RegExp(`(\\d+(?:\\s*[,/ ]\\s*\\d+)*)\\s*${TIME}`, 'i').exec(rest))) {
      const list = splitList(m[1]!).map((v) => toSec(v, m![2]!));
      if (list.length === 1) out.durationSec = list[0]!;
      else out.durations = list;
      if (m[2] === 'm' || m[2] === 'M') out.assumptions.push(`Read “${m[1]}m” as ${m[1]} minutes.`);
      take(m);
    } else if ((m = /(?<![\d:.])(\d{1,2}):([0-5]\d)(?![\d:])(?!\s*(?:am|pm)\b)/i.exec(rest))) {
      // "8:05": minutes and seconds.
      out.durationSec = Number(m[1]) * 60 + Number(m[2]);
      take(m);
    } else if ((m = /(\d+)\s*-\s*(\d+)\s*reps?\b/i.exec(rest))) {
      out.repMin = Math.min(Number(m[1]), Number(m[2]));
      out.repMax = Math.max(Number(m[1]), Number(m[2]));
      take(m);
    } else if ((m = /(\d+)\s*reps?\b/i.exec(rest))) {
      out.repMin = out.repMax = Number(m[1]);
      take(m);
    } else if ((m = /(?:^|\s)(\d+(?:\s*[,/ ]\s*\d+)+)(?=\s|$)/.exec(rest))) {
      out.reps = splitList(m[1]!);
      take(m);
    } else if ((m = /(?:^|\s)(\d+)(?=\s|$)/.exec(rest)) && out.load !== null) {
      // "Pulldown 45 kg 10" — one number after a load: reps of one set.
      out.reps = [Number(m[1])];
      take(m);
    }
  }

  if (out.performed && out.reps.length === 0 && out.repMin !== null && out.repMin === out.repMax) {
    out.reps = Array.from({ length: out.sets ?? 1 }, () => out.repMin!);
    out.repMin = out.repMax = null;
    out.sets = null;
  }
  // "Smith squat 20 a side 3x8": a number per side without a unit, once sets and reps are read.
  if (out.load === null && out.loadType === null && (m = new RegExp(`(?<![\\d.,x])${NUM}(${SIDE})`, 'i').exec(rest))) {
    out.load = num(m[1]!);
    out.loadType = 'per-side';
    take(m);
  }
  // "12 each leg", "each side" after the reps: how the reps were counted — kept as a note.
  if ((m = /\b(?:each|per|a)\s+(?:leg|arm|side)\b/i.exec(rest))) {
    out.notes.push(m[0]);
    take(m);
  }
  // "Squat 5x5 100": one number left after the sets and reps is the weight (said so, for review).
  if (
    out.load === null &&
    out.loadType === null &&
    (out.sets !== null || out.reps.length > 0) &&
    out.durationSec === null &&
    (m = /(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/.exec(rest)) &&
    !/[a-z0-9]/i.test((rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length)).replace(FILLER, ' '))
  ) {
    out.load = num(m[1]!);
    out.assumptions.push(`Read “${m[1]}” as the weight.`);
    take(m);
  }
  if (out.load !== null && out.unit === null && !out.uncertain.includes('unit')) out.uncertain.push('unit');

  // A trailing list of reps after "3 sets × …" is not expected; a list without sets gives the set count.
  if (out.reps.length) {
    if (out.loads) {
      const keep = out.reps.map((r) => r >= 1 && r <= 100);
      out.loads = out.loads.filter((_, i) => keep[i]);
    }
    out.reps = out.reps.filter((r) => r >= 1 && r <= 100);
    // One number ("× 8") gives the reps, not the number of sets.
    if (out.sets === null && out.reps.length > 1) out.sets = out.reps.length;
  }
  if (out.sets !== null && (out.sets < 1 || out.sets > 20)) {
    out.assumptions.push(`${out.sets} sets is outside 1–20 and was ignored.`);
    out.sets = null;
  }
  // Words (and any numbers) left over are kept as a comment, so nothing written is silently dropped.
  out.extraText = rest
    .replace(FILLER, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9?!(]+|[^a-z0-9?!)%]+$/gi, ''))
    .filter((w) => /[a-z0-9]/i.test(w))
    .join(' ')
    .trim();
  out.understood = out.sets !== null || out.reps.length > 0 || out.durationSec !== null || out.durations.length > 0 || out.load !== null || out.loadType !== null || out.repMin !== null || out.restSec !== null;
  return out;
}

/** Words that only connect values ("3 sets of 8 reps with 60 kg"); never kept as a comment. */
const FILLER = /\b(reps?|sets?|of|x|and|each|per|side|total|kgs?|lbs?|s|secs?|did|done|got|with|at|for|rest|rir|rpe|added|barbell|bar|then)\b|[@+]/gi;

/** "20/22.5/25" → [20, 22.5, 25]. */
function splitDecimals(s: string): number[] {
  return s
    .split('/')
    .map((x) => num(x.trim()))
    .filter((n) => Number.isFinite(n));
}

function splitList(s: string): number[] {
  return s
    .split(/[,/ ]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

// ─────────────────────────────────────────────────────────────────
// Line classification
// ─────────────────────────────────────────────────────────────────

const WEEKDAYS: [RegExp, number][] = [
  [/\bsun(day)?\b/i, 0],
  [/\bmon(day)?\b/i, 1],
  [/\btue(s|sday)?\b/i, 2],
  [/\bwed(nesday)?\b/i, 3],
  [/\bthu(r|rs|rsday)?\b/i, 4],
  [/\bfri(day)?\b/i, 5],
  [/\bsat(urday)?\b/i, 6],
];

/** Weekday named in a heading, e.g. "Tuesday — Upper" → 2. */
export function weekdayOf(text: string): number | null {
  for (const [re, d] of WEEKDAYS) if (re.test(text)) return d;
  return null;
}

const HEADING_WORDS = /\b(day|upper|lower|push|pull|legs?|full|body|chest|arms?|shoulders?|glutes|core|session|workout|week|cardio|conditioning|routine|plan|programme|program|split|training)\b/i;

export function isHeadingLike(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (/^#+\s/.test(t) || /:$/.test(t)) return true;
  if (weekdayOf(t) !== null) return true;
  if (/[a-z]/i.test(t) && t === t.toUpperCase()) return true;
  if (/^(day|week)\s*\d+\b/i.test(t)) return true;
  return HEADING_WORDS.test(t) && t.split(/\s+/).length <= 5;
}

/** Headings that are unmistakable even when followed by values: "Tuesday:", "# Upper", "DAY 2". */
export function isStrongHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  return /^#+\s/.test(t) || /:$/.test(t) || weekdayOf(t) !== null || /^(day|week)\s*\d+\b/i.test(t) || (/[a-z]/i.test(t) && t === t.toUpperCase() && t.split(/\s+/).length > 1);
}

/** A line that holds only values (no exercise name), e.g. "3 sets × 8 reps — 30 kg/side". */
export function isValuesLine(line: string): boolean {
  const t = stripBullet(line);
  return /^(\d|x\s*\d|×|@|\+\s*\d|bw\b|bodyweight\b|assist)/i.test(t);
}

/**
 * List markers people paste from Notes, Keep or chats: "1.", "2)", "-", "•",
 * "◦", "▪", "☐", "☑", "- [ ]", "[x]", "✅", emoji, and superset labels "A1.".
 */
const BULLET = /^\s*(?:(?:[-–—•*◦▪▫‣·●○■□→>]|\d{1,2}[.)]|[A-Ha-h][1-9][.):]?)\s+|\[[ xX✓✔]?\]\s*|[☐☑☒✅✔✓✗✘❌⬜🔲🔳]\s*|(?:\p{Extended_Pictographic}|️|‍)+\s*)+/u;

export function stripBullet(line: string): string {
  return line.replace(BULLET, '').trim();
}

/** "A1. DB curl" / "B2) Dips": the superset or pairing label, kept as written. */
function groupLabel(line: string): string | null {
  const m = /^\s*(?:[-•*]\s+)?([A-Ha-h][1-9])[.):]?\s+\S/.exec(line);
  return m ? m[1]!.toUpperCase() : null;
}

/** Split "Bench 30kg/side 8 8 7" into a name and a values part. */
export function splitNameAndValues(line: string): { name: string; values: string } | null {
  const t = stripBullet(line).replace(/[–—]/g, '-').replace(/\t/g, ' ');
  const m = /^(.*?[a-z)\]'’])\s*(?::|-|,)?\s+((?:bw\b|bodyweight\b|body weight\b|assist|@|\+\s*\d|x\s*\d|\d).*)$/i.exec(t);
  if (!m) return null;
  // "Bench press machine - did 3 sets of 10": "did" belongs to the values, not the name.
  const verb = /\s*[-:,]?\s*\b(did|done|got|managed|hit)$/i.exec(m[1]!);
  const name = verb ? m[1]!.slice(0, verb.index) : m[1]!;
  return { name: name.trim().replace(/[-:,]+$/, '').trim(), values: `${verb ? `${verb[1]} ` : ''}${m[2]!.trim()}` };
}

// ─────────────────────────────────────────────────────────────────
// Whole-note parsing
// ─────────────────────────────────────────────────────────────────

export interface NoteEntry {
  lineNos: number[];
  raw: string[];
  name: string;
  exerciseId: string | null;
  /** Possible variations when the name was ambiguous ("Bench"). */
  candidates: string[];
  /** Library or custom exercise was recognised. */
  known: boolean;
  values: ParsedValues | null;
  loadType: LoadType | null;
  /** Library default offered when the convention couldn't be confirmed. */
  suggestedLoadType: LoadType | null;
  unit: WeightUnit | null;
  comments: string[];
  uncertain: NoteField[];
  assumptions: string[];
}

export interface NoteDay {
  heading: string;
  lineNo: number;
  weekday: number | null;
  date: string | null;
  /** A date heading without a year (never completed automatically). */
  dateIncomplete: string | null;
  skipped: boolean;
  entries: NoteEntry[];
  /** Free text in this day that isn't an exercise. */
  notes: string[];
}

export interface ParsedNote {
  /** Text before the first day (e.g. a title). Preserved. */
  preamble: string[];
  days: NoteDay[];
  /** Lines that weren't understood at all, with their line numbers. */
  unparsed: { lineNo: number; raw: string }[];
}

export interface ParseContext {
  custom?: readonly CustomExercise[];
  /** Known loading convention for an exercise (from the existing note), by exercise ID. */
  knownLoadType?: (exerciseId: string) => LoadType | null;
  defaultUnit?: WeightUnit;
  /** Parsing one day's text: headings become comments instead of new days. */
  singleDay?: boolean;
}

/** Resolve the exercise, convention and unit for a name + values. */
export function resolveEntry(name: string, values: ParsedValues | null, ctx: ParseContext = {}): Omit<NoteEntry, 'lineNos' | 'raw' | 'comments'> {
  const custom = ctx.custom ?? [];
  let match = matchExercise(name, custom);
  let candidates: string[] = [];
  const uncertain: NoteField[] = [...(values?.uncertain ?? [])];
  const assumptions = [...(values?.assumptions ?? [])];
  const ambiguous = AMBIGUOUS_NAMES[exerciseKey(name)];
  if (!match && ambiguous) {
    const narrowed = values?.loadType === 'per-dumbbell' ? ambiguous.filter((id) => EXERCISES_BY_ID.get(id)?.loadType === 'per-dumbbell') : [];
    if (narrowed.length === 1) match = matchExercise(EXERCISES_BY_ID.get(narrowed[0]!)!.name, custom);
    else {
      candidates = [...ambiguous];
      uncertain.push('exercise');
    }
  }
  const lib = match?.loadType ?? null;
  const known = match ? (ctx.knownLoadType?.(match.id) ?? null) : null;
  let loadType: LoadType | null = values?.loadType ?? null;
  let suggestedLoadType: LoadType | null = null;
  const hasLoad = values?.load != null;
  const timed = (values?.durationSec ?? null) !== null || (values?.durations.length ?? 0) > 0;
  if (!loadType) {
    if (known && (!hasLoad || known !== 'bodyweight')) loadType = known;
    else if (hasLoad) {
      if (lib === 'total') loadType = 'total';
      else {
        suggestedLoadType = lib && lib !== 'bodyweight' && lib !== 'timed' ? lib : 'total';
        uncertain.push('loadType');
      }
    } else if (timed) loadType = 'timed';
    else if (lib) loadType = lib;
    else loadType = 'unspecified';
  }
  let unit = values?.unit ?? null;
  if (!unit && !hasLoad) unit = ctx.defaultUnit ?? null;
  return {
    name: match?.name ?? name,
    exerciseId: match?.id ?? null,
    candidates,
    known: !!match,
    values,
    loadType: uncertain.includes('loadType') ? null : loadType,
    suggestedLoadType,
    unit,
    uncertain: [...new Set(uncertain)],
    assumptions,
  };
}

/** Combine values from several lines of one exercise block; earlier lines win, nothing is invented. */
export function mergeValues(a: ParsedValues, b: ParsedValues): ParsedValues {
  // Two lines that each record sets ("60 x 8" then "65 x 6"): every set is kept, in order.
  const appendSets = a.reps.length > 0 && b.reps.length > 0;
  const appendTimes = !appendSets && a.sets === null && b.sets === null && (a.durationSec !== null || a.durations.length > 0) && (b.durationSec !== null || b.durations.length > 0);
  const hasLoadA = a.load !== null;
  let unit = hasLoadA ? a.unit : (b.unit ?? a.unit);
  let loads: (number | null)[] | undefined;
  let load = a.load ?? b.load;
  if (appendSets) {
    const per = (v: ParsedValues) => (v.loads && v.loads.length === v.reps.length ? v.loads : v.reps.map(() => v.load));
    const all = [...per(a), ...per(b)];
    const written = all.filter((l): l is number => l !== null);
    if (new Set(all).size > 1) {
      loads = all;
      load = written.length ? Math.max(...written) : null;
    }
    unit = a.unit ?? b.unit;
    if (a.unit && b.unit && a.unit !== b.unit) unit = null;
  }
  const uncertain = [...new Set([...a.uncertain, ...b.uncertain])].filter((u) => u !== 'unit' || (load !== null && unit === null));
  if (load !== null && unit === null && !uncertain.includes('unit')) uncertain.push('unit');
  const repPair = a.repMin !== null ? [a.repMin, a.repMax] : [b.repMin, b.repMax];
  const times = (v: ParsedValues) => (v.durations.length ? v.durations : v.durationSec !== null ? [v.durationSec] : []);
  return {
    sets: a.sets ?? b.sets,
    repMin: repPair[0] ?? null,
    repMax: repPair[1] ?? null,
    reps: appendSets ? [...a.reps, ...b.reps] : a.reps.length ? a.reps : b.reps,
    ...(loads ? { loads } : {}),
    durationSec: appendTimes ? null : (a.durationSec ?? b.durationSec),
    durations: appendTimes ? [...times(a), ...times(b)] : a.durations.length ? a.durations : b.durations,
    load,
    unit,
    loadType: a.loadType ?? b.loadType,
    uncertain,
    assumptions: [...new Set([...a.assumptions, ...b.assumptions])],
    skipped: a.skipped || b.skipped,
    understood: a.understood || b.understood,
    extraText: [a.extraText, b.extraText].filter(Boolean).join(' '),
    restSec: a.restSec ?? b.restSec,
    notes: [...a.notes, ...b.notes],
    performed: a.performed || b.performed,
    added: a.added || b.added,
  };
}

/** "lats pull down (Weighted if possible)" → name + kept notes. */
function splitParens(s: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const text = s
    .replace(/\s*\(([^)]*)\)\s*/g, (_, inner: string) => {
      if (inner.trim()) notes.push(inner.trim());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { text, notes };
}

/** "Bench press (barbell)": a word in brackets can name the variation — used only when it gives an exact library match. */
function hintedName(name: string, hints: readonly string[], custom: readonly CustomExercise[]): string {
  if (matchExercise(name, custom)) return name;
  for (const h of hints) for (const n of [`${h} ${name}`, `${name} ${h}`]) if (matchExercise(n, custom)) return n;
  return name;
}

/** Lines that only add detail to the exercise above: "Did 8 reps", "Rest: 2 min", "for 7 reps", "Set 2: 65x6", "warm-up 40x10". */
const DETAIL_START = /^(did|done|got|managed|hit|for|at|rest|rir|rpe|x\s*\d|set\s*\d|s\d)\b/i;

/** "SS", "Superset", "Giant set", "Circuit" at the start of a line. */
const SUPERSET = /^(?:ss|super\s*set|giant\s*set|tri-?set|circuit)\b\s*(?:\d+\b)?\s*[:.\-–—]?\s*(.*)$/i;
const WARMUP_LINE = /^(?:warm[\s-]?ups?|w\/u|wu)\b/i;
const WARMUP_ANY = /\bwarm[\s-]?ups?\b|\bw\/u\b/i;
const DROP_LINE = /^(?:drop\s*-?\s*sets?|dropsets?|drop)\b/i;

/**
 * A heading that carries a date: "12 Oct 2026", "Push – 2 Nov 2026",
 * "2026-11-02 Legs", "Monday 3/11" (no year → incomplete, never completed).
 * Returns the heading text without the date (null when the line is only a date).
 */
function headingDate(line: string): { heading: string | null; date: string | null; incomplete: string | null } | null {
  const whole = parseDateLine(line);
  if (whole) return { heading: null, date: 'date' in whole ? whole.date : null, incomplete: 'incomplete' in whole ? whole.incomplete : null };
  if (/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+\d{1,2}[/.]\d{1,2}$/i.test(line.trim())) return { heading: null, date: null, incomplete: line.trim() };
  const PATTERNS = [/\b\d{4}-\d{1,2}-\d{1,2}\b/, /\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/, /\b\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9}\.?(?:,?\s+\d{4})?\b/i, /\b[a-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i];
  for (const re of PATTERNS) {
    const m = re.exec(line);
    if (!m) continue;
    const found = parseDateLine(m[0].replace(/(\d)(?:st|nd|rd|th)\b/i, '$1'));
    if (!found) continue;
    const heading = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).replace(/\s+/g, ' ').replace(/^[\s\-–—:,|()]+|[\s\-–—:,|()]+$/g, '');
    if (!heading || heading.length > 40 || /\d/.test(heading.replace(/\b(?:day|week|wk|session)\s*\d+\b/gi, ''))) continue;
    if (parseValues(heading).understood) continue;
    return { heading, date: 'date' in found ? found.date : null, incomplete: 'incomplete' in found ? m[0] : null };
  }
  return null;
}

/**
 * Parse a whole note (pasted from Notes, or a day being edited as text) into
 * days and exercise entries. Every non-blank line ends up somewhere: an
 * exercise, a comment, a heading, or `unparsed`.
 *
 * An exercise can be one line ("Bench 30 kg 8 8 7") or a block: a name line
 * followed by detail lines ("27.5kg for 7 reps", "4 × 6", "Rest: 2 min") until
 * a blank line or the next exercise. Values from the block are combined.
 */
export function parseNote(text: string, ctx: ParseContext = {}): ParsedNote {
  const lines = text.split(/\r?\n/);
  const note: ParsedNote = { preamble: [], days: [], unparsed: [] };
  let day: NoteDay | null = null;
  let last: NoteEntry | null = null;
  /** A blank line ends an exercise block: text after it belongs to the day. */
  let gap = false;
  /** The current entry started as a name on its own line, so following lines describe it. */
  let blockOpen = false;

  const nextNonBlank = (i: number): string | null => {
    for (let j = i + 1; j < lines.length; j++) if (lines[j]!.trim()) return lines[j]!;
    return null;
  };
  const newDay = (heading: string, lineNo: number): NoteDay => {
    const d: NoteDay = { heading, lineNo, weekday: weekdayOf(heading), date: null, dateIncomplete: null, skipped: false, entries: [], notes: [] };
    note.days.push(d);
    day = d;
    last = null;
    blockOpen = false;
    return d;
  };
  const ensureDay = (lineNo: number): NoteDay => day ?? newDay('Workout', lineNo);
  const keepNotes = (e: NoteEntry, values: ParsedValues | null, extra: string[] = []) => {
    for (const c of [...extra, ...(values?.notes ?? []), ...(values?.extraText ? [values.extraText] : [])]) if (c && !e.comments.includes(c)) e.comments.push(c);
  };
  const addEntry = (name: string, values: ParsedValues | null, raw: string[], lineNos: number[], notes: string[] = []) => {
    const d = ensureDay(lineNos[0]!);
    const entry: NoteEntry = { ...resolveEntry(name, values, ctx), lineNos, raw, comments: [] };
    d.entries.push(entry);
    keepNotes(entry, values, notes);
    last = entry;
    gap = false;
    blockOpen = values === null;
  };
  /** Add a detail line's values to the current exercise. */
  const addDetail = (e: NoteEntry, values: ParsedValues, raw: string, lineNo: number) => {
    const merged = e.values ? mergeValues(e.values, values) : values;
    const resolved = resolveEntry(e.name, merged, ctx);
    Object.assign(e, { ...resolved, name: e.known ? resolved.name : e.name, lineNos: [...e.lineNos, lineNo], raw: [...e.raw, raw], comments: e.comments, assumptions: [...new Set([...e.assumptions, ...resolved.assumptions])] });
    keepNotes(e, values);
    gap = false;
  };
  const comment = (raw: string) => {
    const t = raw.trim();
    if (last && !gap) last.comments.push(t);
    else if (day) day.notes.push(t);
    else note.preamble.push(t);
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const lineNo = i + 1;
    const t = raw.trim();
    if (!t) {
      gap = true;
      blockOpen = false;
      continue;
    }
    const label = groupLabel(t);
    const lead: string[] = label ? [label] : [];
    // "Set 2: 65 x 6" → "65 x 6"; tabs and repeated spaces → one space.
    let body = stripBullet(t)
      .replace(/\s+/g, ' ')
      .replace(/^(?:set\s*\d{1,2}|s\d{1,2})\s*[:.)-]?\s+(?=\S)/i, '');

    const dated = headingDate(body);
    if (dated) {
      const cur = day as NoteDay | null;
      let d: NoteDay;
      if (dated.heading === null) d = cur && cur.entries.length === 0 ? cur : newDay(body, lineNo);
      else d = cur && cur.entries.length === 0 && cur.heading === 'Workout' ? cur : newDay(dated.heading, lineNo);
      if (dated.heading !== null) {
        d.heading = dated.heading;
        d.weekday = weekdayOf(body);
      }
      if (dated.date) d.date = dated.date;
      else d.dateIncomplete = dated.incomplete;
      if (d.heading === 'Workout') d.heading = body;
      continue;
    }

    const current = last as NoteEntry | null;
    const inBlock = !!current && !gap;

    // Supersets: "SS: Lateral raise 8kg x 15" is an exercise; "Superset:" alone is a note for the day.
    const ss = SUPERSET.exec(body);
    if (ss) {
      const after = ss[1]!.trim();
      if (/^with\b/i.test(after) && current && inBlock) {
        comment(raw);
        continue;
      }
      if (after.replace(/[^a-z]/gi, '').length <= 1) {
        if (day) (day as NoteDay).notes.push(t);
        else note.preamble.push(t);
        gap = true;
        continue;
      }
      body = after;
      lead.push('Superset');
    }

    // Warm-up and drop sets: kept with the exercise as written, never recorded as working sets.
    const warmUp = WARMUP_LINE.test(body) || (isValuesLine(body) && WARMUP_ANY.test(body));
    const drop = DROP_LINE.test(body);
    if (warmUp || drop) {
      if (current && inBlock) {
        current.comments.push(t);
        const why = warmUp ? 'Warm-up kept as a note, not recorded as a working set.' : 'Drop set kept as a note, not recorded as a set.';
        if (!current.assumptions.includes(why)) current.assumptions.push(why);
      } else comment(raw);
      continue;
    }

    if (isValuesLine(body) || (inBlock && DETAIL_START.test(body))) {
      const values = parseValues(body);
      if (current && current.values === null && values.understood) {
        addDetail(current, values, raw, lineNo);
      } else if (values.skipped && day) {
        (day as NoteDay).skipped = true;
        (day as NoteDay).notes.push(t);
      } else if (current && inBlock && values.understood) {
        addDetail(current, values, raw, lineNo);
      } else if (current && values.understood) {
        comment(raw);
      } else {
        note.unparsed.push({ lineNo, raw });
        comment(raw);
      }
      continue;
    }

    const split = splitNameAndValues(body);
    const splitParts = splitParens(split?.name ?? '');
    const splitName = hintedName(splitParts.text, splitParts.notes, ctx.custom ?? []);
    const recognised = !!split && (!!matchExercise(splitName, ctx.custom ?? []) || !!AMBIGUOUS_NAMES[exerciseKey(splitName)]);
    // "Tuesday 45 min" is a heading, not an exercise called "Tuesday".
    const weekdayName = !!split && !recognised && weekdayOf(split.name) !== null && split.name.split(/\s+/).length <= 3;
    if (split && /[a-z]/i.test(split.name) && !weekdayName) {
      const name = splitName;
      const notes = [...lead, ...splitParts.notes];
      const values = parseValues(split.values);
      // Inside a block, "Barbell with added 5 kg - 6 reps" describes the exercise above.
      if (current && inBlock && blockOpen && !recognised) {
        const whole = parseValues(body);
        if (whole.understood) {
          addDetail(current, whole, raw, lineNo);
          continue;
        }
      }
      // "Chest Supported Row — 8": a bare number after the name is the target reps.
      const bare = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/.exec(split.values.trim());
      if (!values.understood && bare && !isStrongHeading(body) && Number(bare[1]) <= 50) {
        values.repMin = Math.min(Number(bare[1]), Number(bare[2] ?? bare[1]));
        values.repMax = Math.max(Number(bare[1]), Number(bare[2] ?? bare[1]));
        values.understood = true;
        values.extraText = '';
        values.assumptions.push(`Read “${split.values.trim()}” after the name as ${bare[2] ? `${values.repMin}–${values.repMax}` : values.repMin} reps.`);
      }
      if (values.understood && (recognised || !values.extraText)) {
        addEntry(name, values, [raw], [lineNo], notes);
        continue;
      }
    }

    // A line without values: skipped marker, exercise name, heading, or comment.
    if (SKIP_RE.test(body) && day) {
      (day as NoteDay).skipped = true;
      (day as NoteDay).notes.push(t);
      continue;
    }
    const next = nextNonBlank(i);
    // The next line that describes sets (warm-up and drop-set lines in between are skipped over).
    let detail = next;
    for (let j = i + 1; detail !== null && j < lines.length; j++) {
      const s = stripBullet(lines[j]!);
      if (!s) continue;
      detail = s;
      if (!(WARMUP_LINE.test(s) || DROP_LINE.test(s))) break;
    }
    const nextIsDetail = detail !== null && (isValuesLine(detail) || DETAIL_START.test(stripBullet(detail.trim()))) && !parseDateLine(stripBullet(detail));
    const numbered = /^\s*\d+[.)]\s+\S/.test(t) || label !== null || lead.includes('Superset');
    const { text: plainName, notes: parens } = splitParens(body.replace(/^#+\s*/, '').replace(/:$/, '').trim());
    const cleanedName = hintedName(plainName, parens, ctx.custom ?? []);
    const notes = [...lead, ...parens];
    const known = matchExercise(cleanedName, ctx.custom ?? []) ?? (AMBIGUOUS_NAMES[exerciseKey(cleanedName)] ? true : null);
    if (nextIsDetail && /[a-z]/i.test(cleanedName) && (known || numbered || !isStrongHeading(body))) {
      addEntry(cleanedName, null, [raw], [lineNo], notes);
      continue;
    }
    if ((known || numbered) && day) {
      addEntry(cleanedName, null, [raw], [lineNo], notes);
      continue;
    }
    if (ctx.singleDay) {
      if (!day) newDay(cleanedName, lineNo);
      else comment(raw);
      continue;
    }
    if (isHeadingLike(body) || (!day && next !== null)) {
      const heading = body.replace(/^#+\s*/, '').replace(/:$/, '').trim();
      const cur = day as NoteDay | null;
      // "12 Oct 2026" then "Push day": one dated day called "Push day".
      if (cur && cur.entries.length === 0 && cur.notes.length === 0 && (cur.date || cur.dateIncomplete) && headingDate(cur.heading)?.heading === null) {
        cur.heading = heading;
        cur.weekday ??= weekdayOf(heading);
        continue;
      }
      newDay(heading, lineNo);
      continue;
    }
    comment(raw);
  }

  // A heading with nothing under it (e.g. a title line) is kept as preserved text, not an empty day.
  const kept: NoteDay[] = [];
  for (const d of note.days) {
    if (d.entries.length === 0 && !d.skipped && note.days.length > 1) {
      const target = kept[kept.length - 1];
      if (target) target.notes.push(d.heading, ...d.notes);
      else note.preamble.push(d.heading, ...d.notes);
    } else kept.push(d);
  }
  note.days = kept;

  const entries = note.days.flatMap((d) => d.entries);
  // A load written without a unit takes the note's unit when every other load agrees.
  const units = new Set(entries.map((e) => (e.values?.load != null ? e.values.unit : null)).filter((u): u is WeightUnit => !!u));
  if (units.size === 1) {
    const u = [...units][0]!;
    for (const e of entries)
      if (e.values && e.values.load != null && !e.values.unit) {
        e.values = { ...e.values, unit: u, uncertain: e.values.uncertain.filter((x) => x !== 'unit') };
        e.unit = u;
        e.uncertain = e.uncertain.filter((x) => x !== 'unit');
        const written = e.values.loads?.length ? e.values.loads.filter((l) => l !== null).join(', ') : String(e.values.load);
        e.assumptions = [...e.assumptions, `No unit written for ${written} — read as ${u}, like the rest of this note.`];
      }
  }
  for (const e of entries) {
    // "with added 5 kg": weight added to a bodyweight move, or to a bar whose weight isn't written.
    if (e.values?.added && e.values.load != null && !e.values.loadType) {
      const lib = e.exerciseId ? EXERCISES_BY_ID.get(e.exerciseId) : undefined;
      if ((lib && lib.equipment.length === 0) || /pull-?ups?|chin-?ups?|dips?/i.test(e.name)) {
        e.loadType = 'bodyweight-plus';
        e.uncertain = e.uncertain.filter((x) => x !== 'loadType');
      } else {
        if (!e.uncertain.includes('loadType')) e.uncertain = [...e.uncertain, 'loadType'];
        e.loadType = null;
        e.assumptions = [...e.assumptions, `“Added ${e.values.load} ${e.unit ?? ''}”: the bar or machine’s own weight isn’t written, so ${e.values.load} is kept as written. Check how you want it recorded.`.replace(/\s+”/, '”')];
      }
    }
  }
  // Entries that never received any values stay as exercises, flagged for review.
  for (const e of entries)
    if (!e.values) {
      e.uncertain = [...new Set<NoteField>([...e.uncertain, 'sets', 'reps'])];
    }
  return note;
}

// ─────────────────────────────────────────────────────────────────
// Converting values into performance sets
// ─────────────────────────────────────────────────────────────────

/**
 * Per-set performance from parsed values. Returns [] when nothing usable was
 * written — unknown performance is never filled in.
 */
export function performanceSets(values: ParsedValues | null, loadType: LoadType | null): PerformanceSet[] {
  if (!values) return [];
  const usesLoad = loadType !== 'bodyweight' && loadType !== 'timed';
  const load = usesLoad ? values.load : null;
  if (values.durations.length) return values.durations.map((d) => ({ load, reps: null, durationSec: d }));
  if (values.durationSec !== null) return Array.from({ length: values.sets ?? 1 }, () => ({ load, reps: null, durationSec: values.durationSec }));
  if (values.reps.length) {
    // A weight written for each set ("60x8, 65x6") is kept per set; a set without one stays without.
    const perSet = usesLoad && values.loads && values.loads.length === values.reps.length ? values.loads : null;
    return values.reps.map((r, i) => ({ load: perSet ? (perSet[i] ?? null) : load, reps: r, durationSec: null }));
  }
  if (values.sets !== null && values.repMin !== null && values.repMin === values.repMax) return Array.from({ length: values.sets }, () => ({ load, reps: values.repMin, durationSec: null }));
  return [];
}
