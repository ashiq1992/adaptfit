import { formatLocalDate } from './dates';
import type { TrainingWeek, WeeklySessionRecord } from './types';

/**
 * A week as plain text, for Notes, WhatsApp or a coach. It reads like the note
 * it came from, so it can be pasted straight back into AdaptFit's import.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(localDate: string, year: number): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${formatLocalDate(localDate, year)}`;
}

const STATUS_TEXT: Record<WeeklySessionRecord['status'], string> = {
  completed: '',
  partial: 'partly done',
  skipped: 'skipped',
  'not-recorded': 'not recorded',
};

export function weekShareText(week: TrainingWeek, opts: { footer?: string; currentYear?: number } = {}): string {
  const year = opts.currentYear ?? new Date().getFullYear();
  const lines: string[] = [`Week of ${formatLocalDate(week.weekStart, year)}`];
  for (const s of week.sessions) {
    // A date only for sessions that happened; a skipped or unrecorded day has just a planned date.
    const happened = s.status === 'completed' || s.status === 'partial';
    const bits = [happened && s.localDate ? dayLabel(s.localDate, year) : null, STATUS_TEXT[s.status] || null].filter(Boolean);
    lines.push('', bits.length ? `${s.name} — ${bits.join(', ')}` : s.name);
    if (s.status === 'skipped' || s.status === 'not-recorded') continue;
    for (const e of s.exercises) {
      if (e.status === 'skipped') lines.push(`${e.name}: skipped`);
      else if (e.text.trim()) lines.push(`${e.name}: ${e.text.trim()}`);
    }
    if (s.note.trim()) lines.push(`Note: ${s.note.trim()}`);
  }
  if (opts.footer) lines.push('', opts.footer);
  return lines.join('\n');
}
