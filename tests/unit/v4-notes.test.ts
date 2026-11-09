/**
 * V0.4 notes parser, note formatting and inline editing (SYNTHETIC data only).
 * Test IDs refer to Sprint4.MD §20.
 */
import { describe, expect, it } from 'vitest';
import { dayText, daysFromNote, exerciseText, parseDayText, parseExerciseBlock, parsePerformance, performanceText, prescription } from '../../src/domain/noteFormat';
import { parseNote, parseValues } from '../../src/domain/noteParser';
import { programmeExercise } from '../../src/domain/programme';
import type { CustomExercise, ProgrammeDay } from '../../src/domain/types';
import { newIdFn } from '../fixtures/factories';

const BRIEF_NOTE = `Tuesday Upper
Bench 30kg/side 8 8 7
Pulldown 45kg 10 10 9
Rows 40kg 10x3

Saturday Lower
Squat 35kg/side 6x4
RDL 20kg each hand 10x3`;

const ctx = () => ({ newId: newIdFn, unit: 'kg' as const, created: [] as CustomExercise[], now: new Date('2026-11-08T10:00:00Z') });

describe('Notes import parser', () => {
  it('T19 recognises day headings (with weekdays)', () => {
    const n = parseNote(BRIEF_NOTE);
    expect(n.days.map((d) => d.heading)).toEqual(['Tuesday Upper', 'Saturday Lower']);
    expect(n.days.map((d) => d.weekday)).toEqual([2, 6]);
    const caps = parseNote('TUESDAY — UPPER BODY\n\nSmith Bench Press\n3 sets × 8 reps — 30 kg/side\n\nSATURDAY — LOWER BODY\n\nLeg Press\n3 sets × 12 reps — 100 kg');
    expect(caps.days.map((d) => d.heading)).toEqual(['TUESDAY — UPPER BODY', 'SATURDAY — LOWER BODY']);
  });

  it('T20 recognises exercise names (library, alias, and new names)', () => {
    const n = parseNote(BRIEF_NOTE);
    const names = n.days[0]!.entries.map((e) => e.exerciseId);
    expect(names[1]).toBe('lat-pulldown');
    expect(n.days[1]!.entries[1]!.exerciseId).toBe('db-rdl'); // "each hand" settles the RDL variation
    const custom = parseNote('Push\nCable crossover 15kg 3x12');
    expect(custom.days[0]!.entries[0]!.name).toBe('Cable crossover');
    expect(custom.days[0]!.entries[0]!.known).toBe(false);
  });

  it('T21 kg total is handled (explicit "total", or machines that are total by default)', () => {
    expect(parseValues('60kg total 3x5').loadType).toBe('total');
    const n = parseNote('Day\nPulldown 45kg 10 10 9');
    const e = n.days[0]!.entries[0]!;
    expect(e.loadType).toBe('total');
    expect(e.values!.load).toBe(45);
    expect(e.uncertain).not.toContain('loadType');
  });

  it('T22 kg per side is handled', () => {
    for (const s of ['30kg/side 3x8', '30 kg per side 3x8', '30kg a side 3x8', '30 kg each side 3x8']) {
      const v = parseValues(s);
      expect(v.loadType, s).toBe('per-side');
      expect(v.load).toBe(30);
      expect(v.unit).toBe('kg');
    }
  });

  it('T23 kg per dumbbell is handled', () => {
    for (const s of ['20kg each hand 10x3', '20 kg per dumbbell 3x10', '20kg dbs 3x10', '8 kg/dumbbell 3x12', '20 kg each 3x10']) expect(parseValues(s).loadType, s).toBe('per-dumbbell');
    expect(parseValues('45 lb each hand 3x10').unit).toBe('lb');
  });

  it('T24 interprets different rep formats', () => {
    expect(parseValues('8 8 7').reps).toEqual([8, 8, 7]);
    expect(parseValues('9, 8, 8').reps).toEqual([9, 8, 8]);
    expect(parseValues('8/8/7').reps).toEqual([8, 8, 7]);
    expect(parseValues('3x8')).toMatchObject({ sets: 3, repMin: 8, repMax: 8 });
    expect(parseValues('3 x 8-12')).toMatchObject({ sets: 3, repMin: 8, repMax: 12 });
    expect(parseValues('3 sets × 8 reps')).toMatchObject({ sets: 3, repMin: 8 });
    expect(parseValues('4 sets of 6')).toMatchObject({ sets: 4, repMin: 6 });
    const r = parseValues('10x3');
    expect(r).toMatchObject({ sets: 3, repMin: 10 });
    expect(r.assumptions[0]).toMatch(/3 sets of 10/);
    expect(parseValues('6x4')).toMatchObject({ sets: 4, repMin: 6 });
    expect(parseValues('3x45s')).toMatchObject({ sets: 3, durationSec: 45 });
    expect(parseValues('BW 10, 9, 8')).toMatchObject({ loadType: 'bodyweight', reps: [10, 9, 8] });
    expect(parseValues('BW+10kg 3x6')).toMatchObject({ loadType: 'bodyweight-plus', load: 10, sets: 3 });
    expect(parseValues('30 kg/side × 9, 8, 8')).toMatchObject({ load: 30, loadType: 'per-side', reps: [9, 8, 8] });
  });

  it('T25 ambiguous entries require review: "30 kg bench" is not assumed to be per side', () => {
    const n = parseNote('Day 1\nSmith bench 30kg 3x8');
    const e = n.days[0]!.entries[0]!;
    expect(e.exerciseId).toBe('smith-bench-press');
    expect(e.loadType).toBeNull();
    expect(e.uncertain).toContain('loadType');
    expect(e.suggestedLoadType).toBe('per-side');
    // An ambiguous name lists candidates instead of guessing.
    const b = parseNote('Day\nBench 30kg/side 8 8 7').days[0]!.entries[0]!;
    expect(b.exerciseId).toBeNull();
    expect(b.candidates.length).toBeGreaterThan(1);
    expect(b.uncertain).toContain('exercise');
    // A load without a unit is flagged.
    expect(parseValues('@ 30 3x8').uncertain).toContain('unit');
    // An unusual order is interpreted but flagged.
    expect(parseValues('8x12').uncertain).toContain('sets');
  });

  it('T26 unrecognised text is preserved', () => {
    const text = 'My plan (from Notes)\nTuesday Upper\nBench 30kg/side 8 8 7\nkeep elbows tucked\n???\nSaturday Lower\nSquat 35kg/side 6x4';
    const n = parseNote(text);
    const all = [...n.preamble, ...n.days.flatMap((d) => [d.heading, ...d.notes, ...d.entries.flatMap((e) => [...e.raw, ...e.comments])])].join('\n');
    for (const line of text.split('\n')) expect(all).toContain(line.trim());
    expect(n.days[0]!.entries[0]!.comments).toEqual(['keep elbows tucked', '???']);
  });
});

describe('Workout notes: display and inline editing', () => {
  const bench = () => ({ ...programmeExercise(newIdFn, { exerciseId: 'smith-bench-press', sets: 3, repMin: 8, repMax: 8 }), plannedLoad: { value: 30, unit: 'kg' as const } });

  it('T02 programmes display as readable note lines', () => {
    expect(prescription(bench(), 'kg')).toBe('3 sets × 8 reps — 30 kg/side');
    const raise = { ...programmeExercise(newIdFn, { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 15 }), plannedLoad: { value: 8, unit: 'kg' as const } };
    expect(prescription(raise, 'kg')).toBe('3 sets × 12–15 reps — 8 kg/dumbbell');
    const plank = programmeExercise(newIdFn, { exerciseId: 'plank', sets: 3, durationSec: 45 });
    expect(prescription(plank, 'kg')).toBe('3 sets × 45 s');
    const day: ProgrammeDay = { id: 'd', name: 'Tuesday — Upper body', exercises: [bench()], notes: 'Warm up first' };
    expect(dayText(day, 'kg')).toBe('Tuesday — Upper body\n\nSmith machine bench press\n3 sets × 8 reps — 30 kg/side\n\nWarm up first');
  });

  it('T03 inline editing updates the correct exercise and keeps its identity', () => {
    const prev = bench();
    const text = exerciseText(prev, 'kg').replace('8 reps', '9 reps');
    const next = parseExerciseBlock(text, ctx(), prev)!;
    expect(next.id).toBe(prev.id);
    expect(next.exerciseId).toBe('smith-bench-press');
    expect(next.repMin).toBe(9);
    expect(next.loadType).toBe('per-side');
    expect(next.plannedLoad).toEqual({ value: 30, unit: 'kg' });
    // "30 kg/side × 9" style edits also work.
    const quick = parseExerciseBlock('Smith machine bench press — 32.5 kg/side × 8', ctx(), prev)!;
    expect(quick.plannedLoad).toEqual({ value: 32.5, unit: 'kg' });
    expect(quick.sets).toBe(3); // sets weren't mentioned: unchanged
    // A bare number keeps the established convention instead of guessing.
    const bare = parseExerciseBlock('Smith machine bench press\n3 sets × 8 reps — 35 kg', ctx(), prev)!;
    expect(bare.loadType).toBe('per-side');
    expect(bare.uncertain).not.toContain('loadType');
  });

  it('T04 free-form text in a note remains intact', () => {
    const prev = bench();
    const next = parseExerciseBlock('Smith machine bench press\n3 sets × 8 reps — 30 kg/side\nPause on chest, seat at notch 4\n(new bar is heavier?)', ctx(), prev)!;
    expect(next.notes).toBe('Pause on chest, seat at notch 4\n(new bar is heavier?)');
    const day: ProgrammeDay = { id: 'd1', name: 'Upper', exercises: [prev], notes: '' };
    const edited = parseDayText('Upper\n\nWarm-up: 5 min bike\n\nSmith machine bench press\n3 sets × 8 reps — 30 kg/side\nfelt good\n\nLat pulldown\n3 × 10 — 45 kg', day, ctx());
    expect(edited.exercises.map((e) => e.name)).toEqual(['Smith machine bench press', 'Lat pulldown']);
    expect(edited.exercises[0]!.id).toBe(prev.id); // kept → history links survive
    expect(edited.exercises[0]!.notes).toBe('felt good');
    expect(edited.notes).toContain('Warm-up: 5 min bike');
  });

  it('round-trips every exercise shape through text without losing data', () => {
    const shapes = [
      bench(),
      { ...programmeExercise(newIdFn, { exerciseId: 'lat-pulldown', sets: 3, repMin: 10, repMax: 12 }), plannedLoad: { value: 45, unit: 'kg' as const } },
      programmeExercise(newIdFn, { exerciseId: 'plank', sets: 3, durationSec: 45 }),
      programmeExercise(newIdFn, { exerciseId: 'bw-pushup', sets: 3, repMin: 10, repMax: 10 }),
      { ...programmeExercise(newIdFn, { exerciseId: 'pull-up', loadType: 'bodyweight-plus', sets: 3, repMin: 6, repMax: 8 }), plannedLoad: { value: 10, unit: 'kg' as const } },
      { ...programmeExercise(newIdFn, { exerciseId: 'lateral-raise', sets: 3, repMin: 12, repMax: 12 }), plannedLoad: { value: 20, unit: 'lb' as const } },
    ];
    for (const pe of shapes) {
      const back = parseExerciseBlock(exerciseText(pe, 'kg'), ctx(), pe)!;
      expect({ ...back, uncertain: [] }, pe.name).toEqual({ ...pe, uncertain: [] });
      expect(back.uncertain, pe.name).toEqual([]);
    }
  });

  it('builds a programme draft from a pasted note, creating custom exercises for new names', () => {
    const c = ctx();
    const { days } = daysFromNote('Push day\nSmith bench 30kg/side 3x8\nCable crossover 15kg 3x12', c);
    expect(days).toHaveLength(1);
    expect(days[0]!.exercises[1]!.exerciseId).toMatch(/^custom-/);
    expect(c.created).toHaveLength(1);
    expect(days[0]!.exercises[0]!.plannedLoad).toEqual({ value: 30, unit: 'kg' });
  });
});

describe('Weekly performance text', () => {
  it('formats and parses "30 kg/side × 9, 8, 8"', () => {
    const sets = [30, 30, 30].map((load, i) => ({ load, reps: [9, 8, 8][i]!, durationSec: null }));
    expect(performanceText(sets, 'per-side', 'kg')).toBe('30 kg/side × 9, 8, 8');
    expect(parsePerformance('30 kg/side × 9, 8, 8', 'per-side', 'kg').sets).toEqual(sets);
    // Only the numbers need typing; the convention comes from the exercise.
    expect(parsePerformance('32.5 × 8, 8, 7', 'per-side', 'kg').sets.map((s) => s.load)).toEqual([32.5, 32.5, 32.5]);
    expect(parsePerformance('BW × 10, 9', 'bodyweight', 'kg').sets).toEqual([
      { load: null, reps: 10, durationSec: null },
      { load: null, reps: 9, durationSec: null },
    ]);
    expect(parsePerformance('3 × 45 s', 'timed', 'kg').sets).toHaveLength(3);
    // Different loads per set.
    expect(parsePerformance('30 kg/side × 8; 27.5 kg/side × 10', 'per-side', 'kg').sets.map((s) => s.load)).toEqual([30, 27.5]);
    // Unreadable text is reported, not turned into data.
    expect(parsePerformance('felt heavy', 'per-side', 'kg')).toMatchObject({ sets: [], understood: false });
  });
});
