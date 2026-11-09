const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? '__local__';
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(key, f);
  }
  return f;
}

/** Local calendar date (YYYY-MM-DD) of an instant, in the given or device time zone. */
export function localDateOf(instant: Date, timeZone?: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Calendar arithmetic on a YYYY-MM-DD string (time-zone independent). */
export function addDays(localDate: string, days: number): string {
  const m = DATE_RE.exec(localDate);
  if (!m) throw new Error(`Invalid local date: ${localDate}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "23 Oct" (this year) or "23 Oct 2025". Locale-independent, so text is the same on every device. */
export function formatLocalDate(localDate: string, currentYear: number = new Date().getFullYear()): string {
  const m = DATE_RE.exec(localDate);
  if (!m) return localDate;
  const base = `${Number(m[3])} ${MONTHS_SHORT[Number(m[2]) - 1]}`;
  return Number(m[1]) === currentYear ? base : `${base} ${m[1]}`;
}

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
