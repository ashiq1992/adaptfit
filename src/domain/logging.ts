export const MAX_REPS = 500;
export const MAX_DURATION_SEC = 3600;
export const MAX_LOAD = 1000;

const INT_RE = /^\d+$/;
const DECIMAL_RE = /^\d+(\.\d+)?$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Positive whole number within [1, max]. */
export function parsePositiveInt(raw: string, max: number, label: string): Parsed<number> {
  const text = raw.trim();
  if (text === '') return { ok: false, error: `Enter ${label}.` };
  if (!INT_RE.test(text)) return { ok: false, error: `${capitalize(label)} must be a whole number.` };
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < 1) return { ok: false, error: `${capitalize(label)} must be at least 1.` };
  if (n > max) return { ok: false, error: `${capitalize(label)} must be ${max} or less.` };
  return { ok: true, value: n };
}

/**
 * Optional load. Blank → null (not recorded), which is distinct from "0".
 * Rejects negative, non-numeric, and non-finite values. Accepts a decimal comma.
 */
export function parseLoad(raw: string): Parsed<number | null> {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { ok: true, value: null };
  if (!DECIMAL_RE.test(text)) return { ok: false, error: 'Load must be a number of 0 or more (e.g. 12.5).' };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Load must be a number of 0 or more.' };
  if (n > MAX_LOAD) return { ok: false, error: `Load must be ${MAX_LOAD} or less.` };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** Optional reps in reserve, 0–10. */
export function parseRir(raw: string): Parsed<number | null> {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (!INT_RE.test(text) || Number(text) > 10) return { ok: false, error: 'RIR must be a whole number from 0 to 10.' };
  return { ok: true, value: Number(text) };
}

/** Whole minutes for manually entered durations. */
export function parseMinutes(raw: string): Parsed<number> {
  return parsePositiveInt(raw, 600, 'minutes');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
