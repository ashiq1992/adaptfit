/**
 * V0.10: log a whole workout in one go from the home screen. SYNTHETIC data only.
 */
import { describe, expect, it } from 'vitest';
import { daysFromNote } from '../../src/domain/noteFormat';
import { createProgramme, nextDay } from '../../src/domain/programme';
import { editLogRow, loggableCount, loggedOn, loggedSession, logRows, toggleLogRowSkipped } from '../../src/domain/quickLog';
import type { CustomExercise } from '../../src/domain/types';
import { buildWeekDraft, dedupeSessions } from '../../src/domain/weekly';
import { newIdFn } from '../fixtures/factories';

const now = new Date('2026-11-11T18:00:00Z');
const ctx = () => ({ newId: newIdFn, unit: 'kg' as const, created: [] as CustomExercise[], now });

function note() {
  const { days } = daysFromNote('Upper\nLat pulldown 45kg 3x10\nPlank 3 x 30 s\n\nLower\nLeg press 100kg 3x12\nLeg curl 3x12', ctx());
  return createProgramme(newIdFn, now, { name: 'My programme', goal: 'hypertrophy', days, daysPerWeek: 3 });
}

describe('Log a workout in one go', () => {
  it('starts from the plan when there is no history, and leaves unknown loads blank (never invented)', () => {
    const p = note();
    const rows = logRows(p.days[1]!, [], [], '2026-11-11', 'kg');
    expect(rows.map((r) => r.text)).toEqual(['100 kg × 12, 12, 12', '']);
    expect(rows[1]!.source).toBe('blank');
    expect(loggableCount(rows)).toBe(1);
  });

  it('saves a completed workout for the chosen date that history, rotation and the weekly update all see once', () => {
    const p = note();
    const lower = p.days[1]!;
    let rows = logRows(lower, [], [], '2026-11-11', 'kg');
    rows = [editLogRow(rows[0]!, '110 kg × 12, 12, 10'), rows[1]!];
    const s = loggedSession({ programme: p, day: lower, rows, localDate: '2026-11-10', id: 'log-1', newId: newIdFn, now })!;
    expect(s.state).toBe('completed');
    expect(s.source).toBe('manual');
    expect(s.completedLocalDate).toBe('2026-11-10');
    expect(s.dayId).toBe(lower.id);
    expect(s.exercises).toHaveLength(1);
    expect(s.exercises[0]!.sets.map((x) => [x.load, x.reps])).toEqual([[110, 12], [110, 12], [110, 10]]);

    // Rotation: after Lower comes Upper.
    expect(nextDay(p, [s])!.name).toBe('Upper');
    // Next time, the form starts from what was really done.
    expect(logRows(lower, [s], [], '2026-11-12', 'kg')[0]!.text).toBe('110 kg × 12, 12, 10');
    // The weekly update shows it as already logged, not as a second session.
    const week = buildWeekDraft({ weekStart: '2026-11-09', programme: p, previousWeek: null, sessions: [s], now, unit: 'kg', copy: true });
    const lowerRecords = week.sessions.filter((r) => r.dayId === lower.id);
    expect(lowerRecords).toHaveLength(1);
    expect(lowerRecords[0]!.live).toBe(true);
    expect(dedupeSessions([s])).toHaveLength(1);
    expect(loggedOn([s], p.id, '2026-11-10')).toHaveLength(1);
    expect(loggedOn([s], p.id, '2026-11-11')).toHaveLength(0);
  });

  it('skipped exercises and empty rows are not recorded; nothing done means nothing saved', () => {
    const p = note();
    const upper = p.days[0]!;
    const rows = logRows(upper, [], [], '2026-11-11', 'kg');
    const skipped = rows.map(toggleLogRowSkipped);
    expect(loggableCount(skipped)).toBe(0);
    expect(loggedSession({ programme: p, day: upper, rows: skipped, localDate: '2026-11-11', id: 'x', newId: newIdFn, now })).toBeNull();
    const oneSkipped = [toggleLogRowSkipped(rows[0]!), rows[1]!];
    const s = loggedSession({ programme: p, day: upper, rows: oneSkipped, localDate: '2026-11-11', id: 'y', newId: newIdFn, now })!;
    expect(s.exercises.filter((e) => e.sets.length).map((e) => e.name)).toEqual(['Plank']);
  });
});
