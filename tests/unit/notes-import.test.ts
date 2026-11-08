import { describe, expect, it } from 'vitest';
import { buildImportSessions, matchExercise, parseDateLine, parseNotes, rowIssues } from '../../src/domain/notesImport';
import { newIdFn, T0 } from '../fixtures/factories';

describe('Notes import', () => {
  it('parses the documented examples without inventing values', () => {
    const { rows, ignored } = parseNotes(['4 Nov 2026', 'Smith Bench 30 kg/side 3x8', 'Squat 35 kg/side 4x6', 'Pull-ups BW 10, 9, 8', 'RDL 20 kg each hand 3x10'].join('\n'));
    expect(ignored).toEqual([]);
    expect(rows.map((r) => [r.exerciseId, r.loadType, r.unit, r.sets.length, r.sets[0]])).toEqual([
      ['smith-bench-press', 'per-side', 'kg', 3, { reps: 8, durationSec: null, load: 30 }],
      [null, 'per-side', 'kg', 4, { reps: 6, durationSec: null, load: 35 }],
      ['pull-up', 'bodyweight', null, 3, { reps: 10, durationSec: null, load: null }],
      ['db-rdl', 'per-dumbbell', 'kg', 3, { reps: 10, durationSec: null, load: 20 }],
    ]);
    // "Squat" doesn't say barbell, Smith, or goblet — the user chooses.
    expect(rows[1]!.candidates).toEqual(['barbell-back-squat', 'smith-squat', 'goblet-squat']);
    expect(rowIssues(rows[1]!)).toEqual(['Choose the exercise variation']);
    expect(rows.map((r) => r.sets.map((s) => s.reps))[2]).toEqual([10, 9, 8]);
    expect(rows.every((r) => r.date === '2026-11-04')).toBe(true);
    expect([0, 2, 3].every((i) => rowIssues(rows[i]!).length === 0)).toBe(true);
  });

  it('leaves missing dates, conventions, units, and unknown exercises unresolved', () => {
    const { rows, ignored } = parseNotes(['Bench 60 kg 5x5', 'Zercher carry 40 kg 3x8', 'Smith bench 30 3x8', 'Nov 6', 'Leg press 100 kg total 3x10'].join('\n'));
    expect(rowIssues(rows[0]!)).toEqual(['Date missing', 'Choose the exercise variation', 'Loading convention unclear']);
    expect(rowIssues(rows[1]!)).toContain('Exercise not recognised');
    expect(rows[2]!.unit).toBeNull();
    expect(rowIssues(rows[2]!)).toEqual(expect.arrayContaining(['Date missing', 'Loading convention unclear']));
    expect(ignored.some((i) => /without a year/.test(i.reason))).toBe(true);
    expect(rows[3]!).toMatchObject({ date: null, loadType: 'total', unit: 'kg' });
  });

  it('parses dates, weighted and assisted bodyweight, and timed sets', () => {
    expect(parseDateLine('2026-11-04')).toEqual({ date: '2026-11-04' });
    expect(parseDateLine('Tue 4 Nov 2026')).toEqual({ date: '2026-11-04' });
    expect(parseDateLine('4/11/2026')).toEqual({ date: '2026-11-04' }); // D/M/YYYY
    expect(parseDateLine('November 4, 2026')).toEqual({ date: '2026-11-04' });
    expect(parseDateLine('31/02/2026')).toEqual({ incomplete: '31/02/2026' });
    expect(parseDateLine('Smith bench 30kg')).toBeNull();
    const { rows } = parseNotes('2026-11-04\nUpper Body A\nChin-ups BW+10kg 3x6\nPull-ups assisted 20 kg 3x8\nPlank 3x45s');
    expect(rows.map((r) => [r.loadType, r.sets[0]!.load, r.sets[0]!.durationSec, r.sessionName])).toEqual([
      ['bodyweight-plus', 10, null, 'Upper Body A'],
      ['assisted', 20, null, 'Upper Body A'],
      ['timed', null, 45, 'Upper Body A'],
    ]);
  });

  it('matches only exact names or aliases', () => {
    expect(matchExercise('Lat Pulldown')!.id).toBe('lat-pulldown');
    expect(matchExercise('lateral raises')!.id).toBe('lateral-raise');
    expect(matchExercise('lat raise thing')).toBeNull();
  });

  it('builds completed sessions with no fabricated duration, grouped by date', () => {
    const { rows } = parseNotes('2026-11-03\nSmith Bench 30 kg/side 3x8\n2026-11-05\nPull-ups BW 10, 9, 8');
    const { sessions } = buildImportSessions({ rows, existing: [], newId: newIdFn, now: T0, defaultUnit: 'kg' });
    expect(sessions.map((s) => [s.completedLocalDate, s.source, s.durationSource, s.durationSec])).toEqual([
      ['2026-11-03', 'import', 'not-recorded', null],
      ['2026-11-05', 'import', 'not-recorded', null],
    ]);
    expect(sessions[0]!.exercises[0]!.sets.every((s) => s.completed)).toBe(true);
    // Unresolved rows are never saved.
    const partial = parseNotes('Smith Bench 30 kg/side 3x8').rows;
    expect(buildImportSessions({ rows: partial, existing: [], newId: newIdFn, now: T0, defaultUnit: 'kg' }).sessions).toEqual([]);
  });
});
