import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '../../src/domain/dates';
import { recentBest } from '../../src/domain/bests';
import { plateBreakdown, plateCalculable, platesForSide } from '../../src/domain/plates';
import type { ProgrammeExercise, TrainingWeek } from '../../src/domain/types';
import { summaryWeek } from '../../src/features/plan/WeekSummary';
import { addRest, getRestTimer, restLabel, restRemaining, startRest, stopRest } from '../../src/ui/restTimer';
import { improvingBench, stableBench, TODAY } from '../fixtures/factories';

const ex = (p: Partial<ProgrammeExercise>): ProgrammeExercise => ({ exerciseId: 'smith-bench-press', loadType: 'per-side', plannedLoad: { value: 30, unit: 'kg' }, ...p }) as ProgrammeExercise;

describe('Plate calculator', () => {
  it('fewest standard plates per side, exact in kg and lb', () => {
    expect(platesForSide(27.5, 'kg')).toEqual({ plates: [25, 2.5], remainder: 0 });
    expect(platesForSide(38.75, 'kg')).toEqual({ plates: [25, 10, 2.5, 1.25], remainder: 0 });
    expect(platesForSide(0, 'kg')).toEqual({ plates: [], remainder: 0 });
    expect(platesForSide(92.5, 'lb')).toEqual({ plates: [45, 45, 2.5], remainder: 0 });
  });

  it('says how far off when standard plates cannot make the weight', () => {
    expect(platesForSide(26, 'kg')).toEqual({ plates: [25], remainder: 1 });
  });

  it('per-side loads are the plates on each side; a barbell total needs the bar (never assumed)', () => {
    expect(plateBreakdown({ load: 30, loadType: 'per-side', unit: 'kg', bar: null })).toEqual({ ok: true, perSide: 30, plates: [25, 5], remainder: 0 });
    expect(plateBreakdown({ load: 100, loadType: 'total', unit: 'kg', bar: null })).toEqual({ ok: false, reason: 'needs-bar' });
    expect(plateBreakdown({ load: 100, loadType: 'total', unit: 'kg', bar: 20 })).toEqual({ ok: true, perSide: 40, plates: [25, 15], remainder: 0 });
    expect(plateBreakdown({ load: 15, loadType: 'total', unit: 'kg', bar: 20 })).toEqual({ ok: false, reason: 'below-bar' });
  });

  it('offered only where plates make sense', () => {
    expect(plateCalculable(ex({}))).toBe(true);
    expect(plateCalculable(ex({ exerciseId: 'barbell-bench-press', loadType: 'total' }))).toBe(true);
    expect(plateCalculable(ex({ exerciseId: 'lat-pulldown', loadType: 'total' }))).toBe(false); // weight stack
    expect(plateCalculable(ex({ exerciseId: 'db-bench-press', loadType: 'per-dumbbell' }))).toBe(false);
    // No weight written in the plan: still offered (the dialog starts from the last record).
    expect(plateCalculable(ex({ plannedLoad: null }))).toBe(true);
  });
});

describe('Rest timer', () => {
  afterEach(() => stopRest());

  it('counts down from an end time, can be extended and stopped', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    startRest('Lat pulldown', 120, 1_000_000);
    const t = getRestTimer()!;
    expect(t).toMatchObject({ label: 'Lat pulldown', totalSec: 120 });
    expect(restRemaining(t, 1_000_000 + 30_000)).toBe(90);
    expect(restRemaining(t, 1_000_000 + 200_000)).toBe(0);
    addRest(30);
    expect(restRemaining(getRestTimer()!, 1_000_000)).toBe(150);
    stopRest();
    expect(getRestTimer()).toBeNull();
  });

  it('labels', () => {
    expect(restLabel(120)).toBe('2 min');
    expect(restLabel(90)).toBe('1 min 30 s');
    expect(restLabel(45)).toBe('45 s');
  });
});

describe('New best highlight', () => {
  const pe = { exerciseId: 'smith-bench-press', loadType: 'per-side' } as const;

  it('shows when the latest record beat every earlier one, recently', () => {
    expect(recentBest(pe, improvingBench(4), TODAY)).toEqual({ localDate: TODAY });
  });

  it('not when the latest record only matched earlier ones', () => {
    expect(recentBest(pe, stableBench(4), TODAY)).toBeNull();
  });

  it('not when the best is more than two weeks old', () => {
    expect(recentBest(pe, improvingBench(4), addDays(TODAY, 15))).toBeNull();
  });

  it('a first-ever record is not called a best (nothing to compare with)', () => {
    expect(recentBest(pe, improvingBench(1), TODAY)).toBeNull();
  });
});

describe('Weekly summary week', () => {
  const w = (weekStart: string, status: 'confirmed' | 'draft' = 'confirmed') => ({ weekStart, status }) as TrainingWeek;
  it('the latest confirmed week, if it is this week or last week', () => {
    expect(summaryWeek([w('2026-11-02'), w('2026-11-09', 'draft')], '2026-11-09')?.weekStart).toBe('2026-11-02');
    expect(summaryWeek([w('2026-11-02'), w('2026-11-09')], '2026-11-09')?.weekStart).toBe('2026-11-09');
    expect(summaryWeek([w('2026-10-26')], '2026-11-09')).toBeNull();
  });
});
