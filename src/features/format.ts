import { formatLoad } from '../domain/loads';
import type { ExerciseSummary } from '../domain/progression';
import type { LoadType, SessionSet, WeightUnit } from '../domain/types';

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "30 kg/side × 8", "BW × 10", "BW + 10 kg × 6", "45 s". */
export function setLabel(set: Pick<SessionSet, 'load' | 'reps' | 'durationSec'>, loadType: LoadType, unit: WeightUnit): string {
  if (loadType === 'timed') return `${set.durationSec ?? '—'} s`;
  const load = formatLoad(set.load, loadType, unit);
  return `${load} × ${set.reps ?? '—'}`;
}

export function summaryLabel(s: ExerciseSummary): string {
  if (s.loadType === 'timed') return `${s.bestDurationSec ?? 0} s`;
  return `${formatLoad(s.topLoad, s.loadType, s.unit)} × ${s.repsAtTop ?? 0}`;
}

export function repRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return '';
  if (min === max || max === null) return `${min} reps`;
  if (min === null) return `${max} reps`;
  return `${min}–${max} reps`;
}

export function restLabel(sec: number): string {
  if (sec <= 0) return 'no rest';
  if (sec < 60) return `${sec} s rest`;
  const m = sec / 60;
  return `${Number.isInteger(m) ? m : m.toFixed(1)} min rest`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "6 Nov" */
export function shortDate(localDate: string): string {
  const [, m, d] = localDate.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

/** "Fri, 6 Nov 2026" */
export function longDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[dow]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function greeting(now: Date, timeZone?: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(now));
  if (hour < 5) return 'Late session?';
  if (hour < 12) return 'Good morning!';
  if (hour < 18) return 'Good afternoon!';
  return 'Good evening!';
}

export function clockTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Week of 9 November" */
export function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-').map(Number) as [number, number, number];
  return `Week of ${d} ${MONTHS_LONG[m - 1]}`;
}

/** "Tue 10 Nov" */
export function dayDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY_LABELS[dow]} ${d} ${MONTHS_LONG[m - 1]!.slice(0, 3)}`;
}

/** Query parameters after "?" in the hash route. */
export function hashParams(): URLSearchParams {
  const i = window.location.hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? window.location.hash.slice(i + 1) : '');
}
