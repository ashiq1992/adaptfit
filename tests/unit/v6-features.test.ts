import { describe, expect, it } from 'vitest';
import { applySameAnswer, sameAnswerOffer } from '../../src/domain/clarify';
import { parseNote } from '../../src/domain/noteParser';
import { weekShareText } from '../../src/domain/shareText';
import type { ExercisePerformance, Programme, ProgrammeExercise, TrainingWeek, WeeklySessionRecord } from '../../src/domain/types';
import { sharedTextFrom } from '../../src/features/importer/sharedText';

const pe = (id: string, exerciseId: string, uncertain: ProgrammeExercise['uncertain'] = ['loadType']): ProgrammeExercise =>
  ({ id, exerciseId, name: exerciseId, uncertain, loadType: 'unspecified' }) as unknown as ProgrammeExercise;

const programme = (exs: ProgrammeExercise[][]): Programme =>
  ({ id: 'p1', name: 'Note', days: exs.map((e, i) => ({ id: `d${i}`, name: `Day ${i}`, exercises: e })) }) as unknown as Programme;

describe('Same answer for all (loading question)', () => {
  const p = programme([
    [pe('a', 'smith-bench-press'), pe('b', 'db-bench-press'), pe('c', 'smith-squat')],
    [pe('d', 'smith-bench-press'), pe('e', 'smith-squat', [])],
  ]);

  it('offers only exercises still asking, loaded the same way (Smith machine ≠ dumbbells)', () => {
    const offer = sameAnswerOffer(p, p.days[0]!.exercises[0]!, 'per-side');
    expect(offer).toEqual({ loadType: 'per-side', family: 'machine', targets: ['c', 'd'] });
  });

  it('no offer when nothing else is asking, or for custom exercises', () => {
    expect(sameAnswerOffer(p, p.days[0]!.exercises[1]!, 'per-dumbbell')).toBeNull();
    expect(sameAnswerOffer(programme([[pe('x', 'custom-123'), pe('y', 'custom-456')]]), pe('x', 'custom-123'), 'total')).toBeNull();
  });

  it('applying changes exactly the offered exercises and clears their question', () => {
    const offer = sameAnswerOffer(p, p.days[0]!.exercises[0]!, 'per-side')!;
    const next = applySameAnswer(p, offer);
    const all = next.days.flatMap((d) => d.exercises);
    const by = (id: string) => all.find((x) => x.id === id)!;
    expect(by('c')).toMatchObject({ loadType: 'per-side', uncertain: [] });
    expect(by('d')).toMatchObject({ loadType: 'per-side', uncertain: [] });
    expect(by('b')).toMatchObject({ loadType: 'unspecified', uncertain: ['loadType'] }); // dumbbells untouched
    expect(by('a').uncertain).toEqual(['loadType']); // the answered one is patched by its own button, not here
  });
});

describe('Unitless "with added 1" leftover', () => {
  it('becomes a self-explaining note and is never used as weight', () => {
    const note = parseNote('Lat pulldown\nDid 8 reps with 1 rir with added 1\n4 × 6\n76kg', { defaultUnit: 'kg' });
    const e = note.days[0]!.entries[0]!;
    expect(e.values?.load).toBe(76);
    expect(e.values?.notes).toContain('Added 1 (no unit written, so not counted in the weight)');
  });
});

const perf = (name: string, text: string, status: 'done' | 'skipped' = 'done'): ExercisePerformance =>
  ({ programmeExerciseId: null, exerciseId: name, name, loadType: 'total', unit: 'kg', text, sets: [], status, source: 'manual', previous: null, uncertain: [] }) as unknown as ExercisePerformance;
const session = (s: Partial<WeeklySessionRecord>): WeeklySessionRecord =>
  ({ id: 's', dayId: null, name: 'Day', localDate: null, status: 'completed', sessionId: null, live: false, exercises: [], note: '', ...s }) as WeeklySessionRecord;

describe('Share a week as text', () => {
  const week = {
    weekStart: '2026-11-09',
    sessions: [
      session({ name: 'Upper Body A', localDate: '2026-11-10', exercises: [perf('Lat pulldown', '76 kg × 8, 8, 7'), perf('Seated cable row', '52.5 kg × 10, 10, 9'), perf('Lateral raise', '', 'skipped')], note: 'felt strong' }),
      session({ name: 'Lower Body A', status: 'partial', localDate: '2026-11-12', exercises: [perf('Leg press', '150 kg × 10, 10, 9')] }),
      session({ name: 'Upper Body B', status: 'skipped', exercises: [perf('Incline dumbbell press', '22 kg/dumbbell × 9, 9, 8')] }),
    ],
  } as unknown as TrainingWeek;

  it('reads like a note: week, each session with its day, what was done, skipped and notes', () => {
    expect(weekShareText(week, { currentYear: 2026, footer: 'Logged with AdaptFit' })).toBe(
      [
        'Week of 9 Nov',
        '',
        'Upper Body A — Tue 10 Nov',
        'Lat pulldown: 76 kg × 8, 8, 7',
        'Seated cable row: 52.5 kg × 10, 10, 9',
        'Lateral raise: skipped',
        'Note: felt strong',
        '',
        'Lower Body A — Thu 12 Nov, partly done',
        'Leg press: 150 kg × 10, 10, 9',
        '',
        'Upper Body B — skipped',
        '',
        'Logged with AdaptFit',
      ].join('\n'),
    );
  });

  it('pasted back into Import, the sessions and their exercises are recognised', () => {
    const parsed = parseNote(weekShareText(week, { currentYear: 2026 }), { defaultUnit: 'kg' });
    const upper = parsed.days.find((d) => d.heading.startsWith('Upper Body A'))!;
    expect(upper.entries.map((e) => e.name)).toEqual(expect.arrayContaining(['Lat pulldown', 'Seated cable row']));
    const lat = upper.entries.find((e) => e.name === 'Lat pulldown')!;
    expect(lat.values).toMatchObject({ load: 76, unit: 'kg', reps: [8, 8, 7] });
  });
});

describe('Text shared in from another app', () => {
  it('takes text, drops a title that repeats the first line, keeps a separate title', () => {
    expect(sharedTextFrom('?title=Push%20day&text=Push%20day%0ABench%2060kg%203x8')).toBe('Push day\nBench 60kg 3x8');
    expect(sharedTextFrom('?title=Monday&text=Bench%2060kg%203x8')).toBe('Monday\nBench 60kg 3x8');
    expect(sharedTextFrom('?text=%20%20')).toBeNull();
    expect(sharedTextFrom('')).toBeNull();
  });
});
