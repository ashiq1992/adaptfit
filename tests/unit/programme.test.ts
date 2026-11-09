import { describe, expect, it } from 'vitest';
import { duplicateDay, estimateDayMinutes, nextDay, validateProgramme } from '../../src/domain/programme';
import * as W from '../../src/domain/workout';
import { completedSession, fourDayProgramme, newIdFn, pe, T0 } from '../fixtures/factories';

describe('Programmes', () => {
  it('validates names, days, sets, rep ranges, and rest', () => {
    const p = fourDayProgramme();
    expect(validateProgramme(p)).toEqual([]);
    const bad = { ...p, name: ' ', days: [{ ...p.days[0]!, exercises: [{ ...p.days[0]!.exercises[0]!, repMin: 12, repMax: 8, sets: 0 }] }, { id: 'x', name: 'Empty', exercises: [], notes: '' }] };
    const issues = validateProgramme(bad).map((i) => i.message);
    expect(issues).toEqual(expect.arrayContaining(['Give the programme a name.', 'Empty has no exercises.']));
    expect(issues.some((m) => /rep range/.test(m))).toBe(true);
    expect(issues.some((m) => /sets must be/.test(m))).toBe(true);
  });

  it('duplicates a day with fresh IDs and identical exercises', () => {
    const day = fourDayProgramme().days[0]!;
    const copy = duplicateDay(day, newIdFn);
    expect(copy.name).toBe('Upper Body A (copy)');
    expect(copy.id).not.toBe(day.id);
    expect(copy.exercises.map((e) => e.exerciseId)).toEqual(day.exercises.map((e) => e.exerciseId));
    expect(copy.exercises.every((e, i) => e.id !== day.exercises[i]!.id)).toBe(true);
  });

  it('rotates to the next day after the last completed session of this programme', () => {
    const p = fourDayProgramme();
    expect(nextDay(p, [])!.id).toBe(p.days[0]!.id);
    const s = (dayIdx: number, date: string) => completedSession({ date, exercises: [], programmeId: p.id, dayId: p.days[dayIdx]!.id });
    expect(nextDay(p, [s(0, '2026-03-01'), s(1, '2026-03-03')])!.id).toBe(p.days[2]!.id);
    expect(nextDay(p, [s(3, '2026-03-05')])!.id).toBe(p.days[0]!.id); // wraps
    expect(nextDay(p, [{ ...s(2, '2026-03-06'), programmeId: 'other' }])!.id).toBe(p.days[0]!.id);
  });

  it('estimates include warm-up, sets, rest, and transitions', () => {
    const day = { exercises: [pe('lat-pulldown', { sets: 3, repMin: 8, repMax: 10, restSec: 90 })] };
    // 300 warm-up + 3×(10×4) + 2×90 = 600 s
    expect(estimateDayMinutes(day)).toBe(10);
    expect(estimateDayMinutes({ exercises: [] })).toBe(0);
  });

  it('workout history is unchanged when the template changes', () => {
    const p = fourDayProgramme();
    let s = W.sessionFromDay({ id: 's', now: T0, newId: newIdFn, programme: p, day: p.days[0]!, history: [], unit: 'kg', checkIn: null });
    const ex = s.exercises[0]!;
    s = W.completeSet(W.updateSetValues(s, ex.key, ex.sets[0]!.id, { load: 30 }, T0), ex.key, ex.sets[0]!.id, T0);
    const done = W.finish(s, new Date(T0.getTime() + 3_600_000), { source: 'timer' });
    const snapshot = structuredClone(done);
    p.days[0]!.exercises[0]!.name = 'Renamed';
    p.days[0]!.exercises.splice(1, 2);
    expect(done).toEqual(snapshot);
    expect(done.exercises[0]!.name).toBe('Smith machine bench press');
  });
});
