import { useMemo } from 'react';
import { nextDay } from '../../domain/programme';
import { weekStartOf } from '../../domain/progression';
import type { Programme, ProgrammeDay } from '../../domain/types';
import { plannedSlots, suggestedDate } from '../../domain/weekly';
import { useApp } from '../../ui/DataContext';

/** Today's planned day of this programme, else the next one to do. */
export function useTodayTarget(programme: Programme): { day: ProgrammeDay; label: 'Today' | 'Next' } | null {
  const { data, today } = useApp();
  const weekStart = weekStartOf(today);
  return useMemo(() => {
    const slots = plannedSlots(programme, data.weekPlans, weekStart);
    const todays = slots.map((s, i) => ({ s, date: suggestedDate(programme, programme.days.find((d) => d.id === s.dayId)!.name, i, weekStart) })).find((x) => x.date === today);
    if (todays) return { day: programme.days.find((d) => d.id === todays.s.dayId)!, label: 'Today' as const };
    const next = nextDay(programme, data.sessions);
    return next ? { day: next, label: 'Next' as const } : null;
  }, [programme, data.weekPlans, data.sessions, weekStart, today]);
}
