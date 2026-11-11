import { useMemo } from 'react';
import { nextDay } from '../../domain/programme';
import { weekdayOf } from '../../domain/noteParser';
import type { Programme, ProgrammeDay } from '../../domain/types';
import { useApp } from '../../ui/DataContext';

/**
 * The day to suggest: "Today" only when a day is named for today's weekday
 * ("Monday Push") and isn't logged yet; otherwise "Next up", the day after the
 * last one logged (a rotation, so a missed weekday never leaves you behind).
 * It is only a suggestion: every day can be logged with one tap.
 */
export function useTodayTarget(programme: Programme): { day: ProgrammeDay; label: 'Today' | 'Next up' } | null {
  const { data, today } = useApp();
  return useMemo(() => {
    const weekday = new Date(`${today}T12:00:00`).getDay();
    const doneToday = new Set(data.completed.filter((s) => s.programmeId === programme.id && s.completedLocalDate === today).map((s) => s.dayId));
    const named = programme.days.find((d) => weekdayOf(d.name) === weekday && !doneToday.has(d.id));
    if (named) return { day: named, label: 'Today' as const };
    const next = nextDay(programme, data.sessions);
    return next ? { day: next, label: 'Next up' as const } : null;
  }, [programme, data.sessions, data.completed, today]);
}
