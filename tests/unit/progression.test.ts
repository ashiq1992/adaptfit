import { describe, expect, it } from 'vitest';
import { comparableKey } from '../../src/domain/loads';
import * as P from '../../src/domain/progression';
import * as W from '../../src/domain/workout';
import { bench, completedSession, improvingBench, sessionExercise, stableBench, TODAY } from '../fixtures/factories';

const BENCH = comparableKey('smith-bench-press', 'per-side');
const sum = (sets: Parameters<typeof bench>[0], extra = {}) => P.summarizeExercise(bench(sets, extra))!;

describe('Progression engine', () => {
  it('T11 increased repetitions are identified', () => {
    const c = P.compare(sum([{ load: 30, reps: 9 }]), sum([{ load: 30, reps: 8 }]));
    expect(c).toEqual({ kind: 'reps-up', label: '+1 rep' });
  });

  it('T12 increased loads are identified (with units and direction)', () => {
    expect(P.compare(sum([{ load: 32.5, reps: 8 }]), sum([{ load: 30, reps: 8 }]))).toEqual({ kind: 'load-up', label: '+2.5 kg/side' });
    // Assisted: less assistance is harder, so it is an improvement.
    const assisted = (load: number) => P.summarizeExercise(sessionExercise({ exerciseId: 'pull-up', loadType: 'assisted', sets: [{ load, reps: 8 }] }))!;
    expect(P.compare(assisted(20), assisted(30)).kind).toBe('load-up');
    expect(P.compare(assisted(30), assisted(20)).kind).toBe('regression');
    // Converted units still compare.
    const lb = sum([{ load: 70, reps: 8 }], { unit: 'lb' });
    expect(P.compare(lb, sum([{ load: 30, reps: 8 }])).kind).toBe('load-up');
  });

  it('T13 stable performance is correctly classified (and other outcomes)', () => {
    expect(P.compare(sum([{ load: 30, reps: 8 }, { load: 30, reps: 8 }]), sum([{ load: 30, reps: 8 }, { load: 30, reps: 8 }])).kind).toBe('stable');
    expect(P.compare(sum([{ load: 30, reps: 8 }, { load: 30, reps: 8 }, { load: 30, reps: 8 }]), sum([{ load: 30, reps: 8 }, { load: 30, reps: 8 }])).kind).toBe('sets-up');
    expect(P.compare(sum([{ load: 30, reps: 8, rir: 3 }]), sum([{ load: 30, reps: 8, rir: 1 }])).kind).toBe('effort-down');
    expect(P.compare(sum([{ load: 30, reps: 6 }]), sum([{ load: 30, reps: 8 }]))).toEqual({ kind: 'regression', label: '-2 reps' });
    expect(P.compare(sum([{ load: 27.5, reps: 10 }]), sum([{ load: 30, reps: 8 }])).kind).toBe('mixed');
  });

  it('T14 different exercise variations are not compared', () => {
    const smith = sum([{ load: 30, reps: 8 }]);
    const barbell = P.summarizeExercise(sessionExercise({ exerciseId: 'barbell-bench-press', loadType: 'total', sets: [{ load: 60, reps: 8 }] }))!;
    expect(P.compare(barbell, smith).kind).toBe('insufficient');
    const history = [
      completedSession({ date: '2026-03-01', exercises: [bench([{ load: 30, reps: 8 }])] }),
      completedSession({ date: '2026-03-05', exercises: [sessionExercise({ exerciseId: 'barbell-bench-press', loadType: 'total', sets: [{ load: 80, reps: 8 }] })] }),
    ];
    expect(P.exerciseHistory(history, BENCH)).toHaveLength(1);
    expect(P.sessionPRs(history, history[1]!)).toEqual([]);
  });

  it('T15 insufficient data does not produce false progression', () => {
    const one = [completedSession({ date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])] })];
    expect(P.trend(P.exerciseHistory(one, BENCH))).toBeNull();
    expect(P.sessionChanges(one, one[0]!)[0]!.comparison).toEqual({ kind: 'insufficient', label: 'First record' });
    expect(P.sessionPRs(one, one[0]!)).toEqual([]); // first record is a baseline, not a PR
    const noLoad = P.summarizeExercise(bench([{ load: null, reps: 8 }]))!;
    expect(P.compare(sum([{ load: 30, reps: 8 }]), noLoad).kind).toBe('insufficient');
  });

  it('T16 training volume calculations are correct and convention-specific', () => {
    expect(sum([{ load: 30, reps: 8 }, { load: 30, reps: 7 }, { load: 25, reps: 10 }]).volume).toBe(30 * 8 + 30 * 7 + 25 * 10);
    expect(P.summarizeExercise(sessionExercise({ exerciseId: 'pull-up', loadType: 'bodyweight', sets: [{ load: null, reps: 10 }] }))!.volume).toBeNull();
    expect(sum([{ load: 30, reps: 8 }, { load: null, reps: 8 }]).volume).toBeNull(); // never guess a missing load
    const sessions = [...improvingBench(3)];
    expect(P.periodSummary(sessions, '4w', TODAY)).toMatchObject({ sessions: 3, completedSets: 6, strengthSets: 6 });
  });

  it('T17 historical corrections recalculate trends and PRs', () => {
    const sessions = stableBench(3);
    const last = sessions[2]!;
    expect(P.sessionChanges(sessions, last)[0]!.comparison.kind).toBe('stable');
    const corrected = W.editCompleted(last, { exercises: [bench([{ load: 30, reps: 10 }, { load: 30, reps: 8 }, { load: 30, reps: 8 }])] }, new Date());
    const updated = [sessions[0]!, sessions[1]!, corrected];
    expect(P.sessionChanges(updated, corrected)[0]!.comparison).toEqual({ kind: 'reps-up', label: '+2 reps' });
    expect(P.sessionPRs(updated, corrected)).toEqual([BENCH]);
    expect(P.trend(P.exerciseHistory(updated, BENCH))!.kind).toBe('reps-up');
  });

  it('ranges, e1RM labelling, and weekly consistency', () => {
    const pts = P.exerciseHistory(improvingBench(10), BENCH);
    expect(P.filterRange(pts, '4w', TODAY)).toHaveLength(4);
    expect(P.filterRange(pts, 'all', TODAY)).toHaveLength(10);
    expect(P.estimated1RM(30, 8, 'per-side')).toBe(38);
    expect(P.estimated1RM(30, 15, 'per-side')).toBeNull();
    expect(P.estimated1RM(null, 8, 'bodyweight')).toBeNull();
    expect(P.weekStartOf('2026-03-10')).toBe('2026-03-09'); // Tuesday → Monday
    const weeks = P.weeklyConsistency(stableBench(3, TODAY, 7), TODAY, 3, () => 1);
    expect(weeks.map((w) => w.met)).toEqual([true, true, true]);
  });
});
