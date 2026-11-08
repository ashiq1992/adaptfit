import { addDays, isLocalDate } from './dates';
import { LB_PER_KG } from './loads';
import { type Range, rangeStart, weekStartOf } from './progression';
import type { BodyweightEntry, WeightUnit } from './types';

/**
 * Personal bodyweight log (V0.3). Separate from lifted loads. Entries keep the
 * value and unit exactly as entered; conversion happens only for display.
 * AdaptFit never infers body fat, muscle gain, or fat loss from bodyweight.
 */

export const MIN_BODYWEIGHT_KG = 25;
export const MAX_BODYWEIGHT_KG = 350;

export function toUnit(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return to === 'kg' ? value / LB_PER_KG : value * LB_PER_KG;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** An entry's value in the display unit, rounded to 0.1. */
export function displayValue(e: Pick<BodyweightEntry, 'value' | 'unit'>, unit: WeightUnit): number {
  return round1(toUnit(e.value, e.unit, unit));
}

export interface BodyweightInput {
  localDate: string;
  value: string;
  unit: WeightUnit;
  note: string;
}

/** Validate user input. Returns an error message or the parsed value. */
export function parseBodyweight(input: BodyweightInput, today: string): { ok: true; value: number } | { ok: false; error: string } {
  if (!input.localDate || !isLocalDate(input.localDate)) return { ok: false, error: 'Enter a valid date.' };
  if (input.localDate > today) return { ok: false, error: "The date can't be in the future." };
  const text = input.value.trim().replace(',', '.');
  if (!text) return { ok: false, error: 'Enter your bodyweight.' };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: 'Bodyweight must be a number.' };
  const value = Number(text);
  const kg = toUnit(value, input.unit, 'kg');
  if (!Number.isFinite(value) || kg < MIN_BODYWEIGHT_KG || kg > MAX_BODYWEIGHT_KG) {
    const lo = input.unit === 'kg' ? MIN_BODYWEIGHT_KG : Math.round(MIN_BODYWEIGHT_KG * LB_PER_KG);
    const hi = input.unit === 'kg' ? MAX_BODYWEIGHT_KG : Math.round(MAX_BODYWEIGHT_KG * LB_PER_KG);
    return { ok: false, error: `Enter a bodyweight between ${lo} and ${hi} ${input.unit}.` };
  }
  if (input.note.length > 200) return { ok: false, error: 'Keep the note under 200 characters.' };
  return { ok: true, value: round1(value) };
}

export function sortEntries(entries: readonly BodyweightEntry[]): BodyweightEntry[] {
  return [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate) || a.createdAt.localeCompare(b.createdAt));
}

export function entriesInRange(entries: readonly BodyweightEntry[], range: Range, today: string): BodyweightEntry[] {
  const start = rangeStart(range, today);
  return sortEntries(entries).filter((e) => (start === null || e.localDate >= start) && e.localDate <= today);
}

export interface WeeklyAverage {
  weekStart: string;
  average: number;
  entries: number;
}

/** Average per Monday-starting week. Weeks without entries are omitted, never filled in. */
export function weeklyAverages(entries: readonly BodyweightEntry[], unit: WeightUnit): WeeklyAverage[] {
  const byWeek = new Map<string, number[]>();
  for (const e of sortEntries(entries)) {
    const ws = weekStartOf(e.localDate);
    byWeek.set(ws, [...(byWeek.get(ws) ?? []), toUnit(e.value, e.unit, unit)]);
  }
  return [...byWeek.entries()].map(([weekStart, vals]) => ({ weekStart, average: round1(vals.reduce((a, b) => a + b, 0) / vals.length), entries: vals.length }));
}

export interface BodyweightTrend {
  status: 'insufficient' | 'stable' | 'up' | 'down';
  /** Change per week in the display unit (linear fit), when status isn't insufficient. */
  perWeek: number | null;
  text: string;
  needed: string | null;
}

/**
 * Optional trend from weekly averages. Needs at least 3 weeks with entries
 * spanning 14+ days; otherwise it says what's missing instead of guessing.
 */
export function bodyweightTrend(entries: readonly BodyweightEntry[], unit: WeightUnit): BodyweightTrend {
  const weeks = weeklyAverages(entries, unit);
  const span = weeks.length ? (Date.parse(`${weeks[weeks.length - 1]!.weekStart}T00:00:00Z`) - Date.parse(`${weeks[0]!.weekStart}T00:00:00Z`)) / 86_400_000 : 0;
  if (weeks.length < 3 || span < 14) {
    const more = Math.max(0, 3 - weeks.length);
    return {
      status: 'insufficient',
      perWeek: null,
      text: 'Not enough data for a trend yet.',
      needed: more > 0 ? `Record bodyweight in ${more} more week${more === 1 ? '' : 's'} (once a week is enough).` : 'Keep recording for at least two weeks.',
    };
  }
  // Least-squares slope of weekly averages against weeks elapsed.
  const xs = weeks.map((w) => (Date.parse(`${w.weekStart}T00:00:00Z`) - Date.parse(`${weeks[0]!.weekStart}T00:00:00Z`)) / (7 * 86_400_000));
  const ys = weeks.map((w) => w.average);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((n, x, i) => n + (x - mx) * (ys[i]! - my), 0) / xs.reduce((n, x) => n + (x - mx) ** 2, 0);
  const perWeek = Math.round(slope * 100) / 100;
  // Treat changes under ~0.1 kg/week as stable: daily fluctuations are larger than that.
  const threshold = unit === 'kg' ? 0.1 : 0.2;
  const status = Math.abs(perWeek) < threshold ? 'stable' : perWeek > 0 ? 'up' : 'down';
  const text =
    status === 'stable'
      ? `Roughly stable over ${weeks.length} weeks.`
      : `Trending ${status} about ${Math.abs(perWeek)} ${unit} per week over ${weeks.length} weeks.`;
  return { status, perWeek, text, needed: null };
}

/** Most recent entry on or before a date (for reuse in nutrition setup). */
export function latestEntry(entries: readonly BodyweightEntry[], onOrBefore?: string): BodyweightEntry | null {
  const sorted = sortEntries(entries).filter((e) => !onOrBefore || e.localDate <= onOrBefore);
  return sorted[sorted.length - 1] ?? null;
}

/** Whether a recent weigh-in exists (within `days`). */
export function hasRecentEntry(entries: readonly BodyweightEntry[], today: string, days = 30): boolean {
  const last = latestEntry(entries, today);
  return !!last && last.localDate >= addDays(today, -days);
}
