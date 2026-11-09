import { newId, saveNote } from '../../data/repo';
import { createProgramme } from '../../domain/programme';
import type { Profile, Programme } from '../../domain/types';
import { clock } from '../../ui/clock';
import { navigate } from '../../ui/hooks';

/** Create an empty note ("Write my own") and open it ready to type. */
export async function createBlankNote(profile: Profile, hasActive: boolean): Promise<Programme> {
  const now = clock.now();
  const p = createProgramme(newId, now, {
    name: 'My training plan',
    goal: profile.goal,
    days: [{ id: newId(), name: 'Day 1', exercises: [], notes: '' }],
    daysPerWeek: profile.trainingPrefs.daysPerWeek ?? 3,
    preferredWeekdays: profile.lifestyle.training?.preferredDays ?? [],
    source: 'created',
  });
  await saveNote({ ...p, isActive: !hasActive }, 'Created', now, { activate: !hasActive });
  navigate(`/note/${encodeURIComponent(p.id)}/${encodeURIComponent(p.days[0]!.id)}?edit=text`);
  return p;
}
