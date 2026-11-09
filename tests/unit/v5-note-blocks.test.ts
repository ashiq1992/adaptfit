import { describe, expect, it } from 'vitest';
import { daysFromNote } from '../../src/domain/noteFormat';
import { matchExercise } from '../../src/domain/notesImport';
import { parseNote, parseValues, performanceSets } from '../../src/domain/noteParser';
import type { CustomExercise } from '../../src/domain/types';
import { newIdFn } from '../fixtures/factories';

/**
 * A real-world note format (reported by the user, 2026-11-09): numbered
 * exercises, each followed by detail lines — what was done, the plan, rest.
 */
const NOTE = `1. db flat press
27.5kg for 7 reps
4 × 6
Rest: 2–3 min

2. lats pull down (Weighted if possible)
Did 8 reps  with 1 rir with added 1
4 × 6
76kg
Rest: 2 min

Chest Supported Row — 8
Did 45 at 8 reps with 1 rir x3 , 90 sec rest

Military press
Barbell with added 5 kg - 6 reps
X3 sets
Rest: 90 sec

Smith machine bench press
17.5 kg, 3x10 reps`;

const ctx = () => ({ newId: newIdFn, unit: 'kg' as const, created: [] as CustomExercise[], now: new Date('2026-11-09T10:00:00Z') });

describe('Exercise blocks: a name line followed by detail lines', () => {
  const note = parseNote(NOTE, { defaultUnit: 'kg' });
  const entries = note.days.flatMap((d) => d.entries);

  it('finds five exercises in one workout; rest lines and "Did…" lines never become exercises or days', () => {
    expect(note.days).toHaveLength(1);
    expect(entries.map((e) => e.name)).toEqual(['Dumbbell bench press', 'Lat pulldown', 'Chest Supported Row', 'Barbell overhead press', 'Smith machine bench press']);
    expect(note.unparsed).toEqual([]);
  });

  it('understands gym shorthand in names', () => {
    expect(matchExercise('db flat press')?.id).toBe('db-bench-press');
    expect(matchExercise('lats pull down')?.id).toBe('lat-pulldown');
    expect(matchExercise('DB shoulder press')?.id).toBe('db-shoulder-press');
    expect(matchExercise('BB bench')?.id).toBe('barbell-bench-press');
  });

  it('combines the plan ("4 × 6") with what was done ("27.5kg for 7 reps") and the rest', () => {
    const db = entries[0]!;
    expect(db.values).toMatchObject({ sets: 4, repMin: 6, repMax: 6, load: 27.5, unit: 'kg', reps: [7], restSec: 120 });
    expect(db.comments).toContain('Rest 2–3 min');
    // Dumbbell exercise, bare kg: per dumbbell is suggested, never assumed.
    expect(db.uncertain).toContain('loadType');
    expect(db.suggestedLoadType).toBe('per-dumbbell');
    expect(performanceSets(db.values, 'per-dumbbell')).toEqual([{ load: 27.5, reps: 7, durationSec: null }]);
  });

  it('keeps notes in brackets and effort (RIR) as text; the load on its own line belongs to the exercise above', () => {
    const lat = entries[1]!;
    expect(lat.values).toMatchObject({ sets: 4, repMin: 6, load: 76, reps: [8], restSec: 120 });
    expect(lat.comments).toEqual(expect.arrayContaining(['Weighted if possible', 'RIR 1']));
    expect(lat.loadType).toBe('total');
  });

  it('reads "— 8" after a name as target reps, "45 at 8 reps … x3" as three sets of 8, and takes kg from the rest of the note (saying so)', () => {
    const row = entries[2]!;
    expect(row.values).toMatchObject({ sets: 3, repMin: 8, repMax: 8, load: 45, unit: 'kg', reps: [8, 8, 8], restSec: 90 });
    expect(row.uncertain).not.toContain('unit');
    expect(row.assumptions.join(' ')).toMatch(/read as kg/);
    expect(row.assumptions.join(' ')).toMatch(/“8” after the name as 8 reps/);
  });

  it('"Barbell with added 5 kg" stays with the exercise, and the missing bar weight is flagged — never assumed', () => {
    const ohp = entries[3]!;
    expect(ohp.values).toMatchObject({ sets: 3, repMin: 6, load: 5, restSec: 90 });
    expect(ohp.loadType).toBeNull();
    expect(ohp.uncertain).toContain('loadType');
    expect(ohp.assumptions.join(' ')).toMatch(/own weight isn’t written/);
  });

  it('"with added 10 kg" on a bodyweight move is recorded as bodyweight plus load', () => {
    const n = parseNote('Pull-ups\nDid 6 reps with added 10 kg x3');
    expect(n.days[0]!.entries[0]!.loadType).toBe('bodyweight-plus');
    expect(n.days[0]!.entries[0]!.values).toMatchObject({ load: 10, reps: [6, 6, 6] });
  });

  it('builds a workout note with sets, reps, load and rest from the blocks', () => {
    const { days } = daysFromNote(NOTE, ctx());
    const ex = days[0]!.exercises;
    expect(ex.map((e) => [e.name, e.sets, e.repMin, e.restSec])).toEqual([
      ['Dumbbell bench press', 4, 6, 120],
      ['Lat pulldown', 4, 6, 120],
      ['Chest Supported Row', 3, 8, 90],
      ['Barbell overhead press', 3, 6, 90],
      ['Smith machine bench press', 3, 10, expect.any(Number)],
    ]);
    expect(ex[1]!.plannedLoad).toEqual({ value: 76, unit: 'kg' });
  });

  it('does not change one-line notation or separate exercises written one per line', () => {
    const n = parseNote('Push day\nSmith bench 30kg/side 3x8\nCable crossover 15kg 3x12');
    expect(n.days[0]!.entries.map((e) => e.name)).toEqual(['Smith machine bench press', 'Cable crossover']);
    expect(parseValues('3 sets × 8 reps — 30 kg/side')).toMatchObject({ sets: 3, repMin: 8, load: 30, loadType: 'per-side', performed: false });
    expect(parseValues('X3 sets')).toMatchObject({ sets: 3, reps: [] });
    expect(parseValues('Rest: 90 sec')).toMatchObject({ restSec: 90, understood: true });
  });
});

describe('Exercise name keys', () => {
  it('expand shorthand without damaging other names', async () => {
    const { exerciseKey } = await import('../../src/domain/notesImport');
    expect(exerciseKey('Squats')).toBe('squats');
    expect(exerciseKey('Seated cable row')).toBe('seated cable row');
    expect(exerciseKey('DB  flat   press')).toBe('dumbbell bench press');
    expect(matchExercise('Bodyweight squat')?.id).toBe('bw-squat');
  });
});
