/**
 * V0.8: rest is part of the note text (default 1:30) and can be changed by
 * editing one exercise or the whole day. SYNTHETIC data only.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { dayText, daysFromNote, exerciseText, parseDayText, parseExerciseBlock, restLineSeconds, restText } from '../../src/domain/noteFormat';
import { parseValues } from '../../src/domain/noteParser';
import { DEFAULT_REST_SEC, programmeExercise } from '../../src/domain/programme';
import type { CustomExercise, ProgrammeDay } from '../../src/domain/types';
import { getRestTimer, startHold, startRest, stopRest } from '../../src/ui/restTimer';
import { newIdFn } from '../fixtures/factories';

const ctx = () => ({ newId: newIdFn, unit: 'kg' as const, created: [] as CustomExercise[], now: new Date('2026-11-08T10:00:00Z') });

describe('Rest in the note text', () => {
  it('typed exercises default to 1 min 30 s', () => {
    expect(DEFAULT_REST_SEC).toBe(90);
    const { days } = daysFromNote('Upper\nLat pulldown 45 kg 3x10\nCable row 40 kg 3x10', ctx());
    expect(days[0]!.exercises.map((e) => e.restSec)).toEqual([90, 90]);
    const added = parseExerciseBlock('Lat pulldown\n3 sets × 10 reps — 45 kg', ctx())!;
    expect(added.restSec).toBe(90);
  });

  it('is written as its own line, in a form the parser reads back', () => {
    expect([restText(90), restText(120), restText(45), restText(150), restText(0)]).toEqual(['Rest 1:30', 'Rest 2 min', 'Rest 45 s', 'Rest 2:30', 'No rest']);
    for (const sec of [90, 120, 45, 150, 0]) expect(restLineSeconds(restText(sec))).toBe(sec);
    const pe = programmeExercise(newIdFn, { exerciseId: 'lat-pulldown', sets: 3, repMin: 10, repMax: 10 });
    expect(exerciseText(pe, 'kg')).toBe('Lat pulldown\n3 sets × 10 reps\nRest 1:30');
  });

  it('understands the ways people write rest', () => {
    expect(parseValues('Rest 1 min 30 s').restSec).toBe(90);
    expect(parseValues('rest 1m30s').restSec).toBe(90);
    expect(parseValues('Rest: 2 min').restSec).toBe(120);
    expect(parseValues('rest 75 sec').restSec).toBe(75);
    expect(parseValues('No rest').restSec).toBe(0);
    // A rest line is not mistaken for sets, reps or a load.
    expect(restLineSeconds('Rest 1 min 30 s')).toBe(90);
    expect(restLineSeconds('3 sets × 10 reps')).toBeNull();
    expect(restLineSeconds('Resting heart rate high today')).toBeNull();
  });

  it('editing one exercise changes its rest, keeping everything else', () => {
    const pe = { ...programmeExercise(newIdFn, { exerciseId: 'lat-pulldown', sets: 3, repMin: 10, repMax: 10 }), plannedLoad: { value: 45, unit: 'kg' as const } };
    const text = exerciseText(pe, 'kg');
    const edited = parseExerciseBlock(text.replace('Rest 1:30', 'Rest 2 min'), ctx(), pe)!;
    expect(edited).toMatchObject({ id: pe.id, restSec: 120, sets: 3, repMin: 10, plannedLoad: { value: 45, unit: 'kg' } });
    // Unchanged text keeps it.
    expect(parseExerciseBlock(text, ctx(), pe)!.restSec).toBe(90);
    // Deleting the line goes back to the default; "No rest" turns the timer off.
    const two = { ...pe, restSec: 120 };
    expect(parseExerciseBlock(exerciseText(two, 'kg').replace('\nRest 2 min', ''), ctx(), two)!.restSec).toBe(90);
    expect(parseExerciseBlock(exerciseText(two, 'kg').replace('Rest 2 min', 'No rest'), ctx(), two)!.restSec).toBe(0);
    // Notes after the rest line stay notes.
    const withNote = parseExerciseBlock('Lat pulldown\n3 sets × 10 reps — 45 kg\nRest 2:30\nslow on the way up', ctx(), pe)!;
    expect(withNote).toMatchObject({ restSec: 150, notes: 'slow on the way up' });
  });

  it('editing the whole day changes rest per exercise and keeps IDs', () => {
    const a = programmeExercise(newIdFn, { exerciseId: 'lat-pulldown', sets: 3, repMin: 10, repMax: 10 });
    const b = programmeExercise(newIdFn, { exerciseId: 'cable-row', sets: 3, repMin: 10, repMax: 10, restSec: 60 });
    const day: ProgrammeDay = { id: 'd', name: 'Pull', exercises: [a, b], notes: '' };
    const text = dayText(day, 'kg');
    expect(text).toContain('Lat pulldown\n3 sets × 10 reps\nRest 1:30');
    expect(text).toContain('Rest 1 min');
    const next = parseDayText(text.replace('Rest 1:30', 'Rest 3 min').replace('Rest 1 min', 'Rest 45 s'), day, ctx());
    expect(next.exercises.map((e) => [e.id, e.restSec])).toEqual([
      [a.id, 180],
      [b.id, 45],
    ]);
    expect(next.notes).toBe('');
    // Round trip without changes keeps every rest.
    expect(parseDayText(text, day, ctx()).exercises.map((e) => e.restSec)).toEqual([90, 60]);
  });
});

describe('Timer for timed exercises', () => {
  afterEach(() => stopRest());
  it('a hold uses the same bar with its own kind', () => {
    startHold('Plank', 30, 1_000);
    expect(getRestTimer()).toMatchObject({ label: 'Plank', totalSec: 30, endsAt: 31_000, kind: 'hold' });
    startRest('Lat pulldown', 90, 1_000);
    expect(getRestTimer()).toMatchObject({ kind: 'rest' });
  });
});
