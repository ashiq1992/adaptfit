import { describe, expect, it } from 'vitest';
import { formatLoad, toKg } from '../../src/domain/loads';
import { compare, summarizeExercise } from '../../src/domain/progression';
import * as W from '../../src/domain/workout';
import { bench, completedSession, fourDayProgramme, makeCheckIn, newIdFn, sessionExercise, T0 } from '../fixtures/factories';

const programme = fourDayProgramme();
const upperA = programme.days[0]!;
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);

function start(history = [] as ReturnType<typeof completedSession>[]) {
  return W.sessionFromDay({ id: 's1', now: T0, newId: newIdFn, programme, day: upperA, history, unit: 'kg', checkIn: makeCheckIn() });
}

describe('Workout data', () => {
  it('T01 different exercises preserve different loads', () => {
    const prev = completedSession({
      date: '2026-03-03',
      exercises: [
        bench([{ load: 30, reps: 8 }]),
        sessionExercise({ exerciseId: 'lat-pulldown', loadType: 'total', sets: [{ load: 55, reps: 10 }] }),
        sessionExercise({ exerciseId: 'cable-row', loadType: 'total', sets: [{ load: 45, reps: 12 }] }),
      ],
    });
    const s = start([prev]);
    const loadOf = (id: string) => s.exercises.find((e) => e.exerciseId === id)!.sets[0]!.load;
    expect(loadOf('smith-bench-press')).toBe(30);
    expect(loadOf('lat-pulldown')).toBe(55);
    expect(loadOf('cable-row')).toBe(45);
    // Editing one exercise never changes another.
    let next = W.updateSetValues(s, s.exercises[0]!.key, s.exercises[0]!.sets[0]!.id, { load: 32.5 }, T0);
    expect(next.exercises[1]!.sets[0]!.load).toBe(55);
    next = W.completeSet(next, next.exercises[0]!.key, next.exercises[0]!.sets[0]!.id, T0);
    expect(next.exercises[1]!.sets.every((x) => !x.completed && x.load === 55)).toBe(true);
  });

  it('T02 per-side loads are not confused with total loads', () => {
    const perSide = summarizeExercise(bench([{ load: 30, reps: 8 }]))!;
    const total = summarizeExercise(sessionExercise({ exerciseId: 'smith-bench-press', loadType: 'total', sets: [{ load: 80, reps: 8 }] }))!;
    expect(perSide.key).not.toBe(total.key);
    expect(compare(total, perSide).kind).toBe('insufficient');
    expect(formatLoad(30, 'per-side', 'kg')).toBe('30 kg/side');
    expect(formatLoad(80, 'total', 'kg')).toBe('80 kg');
    // A per-side history never prefills a total-load programme exercise.
    const prev = completedSession({ date: '2026-03-03', exercises: [bench([{ load: 30, reps: 8 }])] });
    expect(W.previousPerformance([prev], 'smith-bench-press', 'total')).toBeNull();
    expect(W.previousPerformance([prev], 'smith-bench-press', 'per-side')!.sets[0]!.load).toBe(30);
  });

  it('T03 previous-session values prefill correctly per set', () => {
    const older = completedSession({ date: '2026-02-24', exercises: [bench([{ load: 25, reps: 10 }])] });
    const prev = completedSession({ date: '2026-03-03', exercises: [bench([{ load: 30, reps: 8 }, { load: 30, reps: 7 }, { load: 27.5, reps: 8 }])] });
    const s = start([older, prev]);
    const sets = s.exercises.find((e) => e.exerciseId === 'smith-bench-press')!.sets;
    expect(sets.map((x) => [x.load, x.reps, x.prefill])).toEqual([
      [30, 8, 'previous'],
      [30, 7, 'previous'],
      [27.5, 8, 'previous'],
    ]);
    // With no history, reps prefill from the target and load is left blank.
    const fresh = start([]).exercises[0]!.sets[0]!;
    expect(fresh).toMatchObject({ load: null, reps: upperA.exercises[0]!.repMin, prefill: 'target' });
  });

  it('T04 prefilled values are never automatically completed', () => {
    const prev = completedSession({ date: '2026-03-03', exercises: [bench([{ load: 30, reps: 8 }])] });
    const s = start([prev]);
    expect(s.exercises.flatMap((e) => e.sets).every((x) => !x.completed && x.completedAt === null)).toBe(true);
    expect(W.completedSetCount(s)).toBe(0);
    expect(() => W.finish(s, at(1800), { source: 'timer' })).toThrow(/at least one set/);
    // One tap confirms an unchanged prefilled set.
    const ex = s.exercises[0]!;
    const done = W.completeSet(s, ex.key, ex.sets[0]!.id, at(60));
    expect(done.exercises[0]!.sets[0]).toMatchObject({ completed: true, load: 30, reps: 8, completedAt: at(60).toISOString() });
    expect(W.completedSetCount(done)).toBe(1);
  });

  it('T05 weight changes save accurately (including zero vs blank)', () => {
    const s = start();
    const ex = s.exercises[0]!;
    let next = W.updateSetValues(s, ex.key, ex.sets[0]!.id, { load: 32.5 }, T0);
    expect(next.exercises[0]!.sets[0]!.load).toBe(32.5);
    next = W.updateSetValues(next, ex.key, ex.sets[1]!.id, { load: 0 }, T0);
    expect(next.exercises[0]!.sets[1]!.load).toBe(0);
    expect(next.exercises[0]!.sets[2]!.load).toBeNull();
    expect(() => W.completeSet(W.updateSetValues(next, ex.key, ex.sets[0]!.id, { load: -5 }, T0), ex.key, ex.sets[0]!.id, T0)).toThrow(/valid values/);
    expect(() => W.completeSet(W.updateSetValues(next, ex.key, ex.sets[0]!.id, { load: Number.POSITIVE_INFINITY }, T0), ex.key, ex.sets[0]!.id, T0)).toThrow();
  });

  it('T06 repetition changes save accurately', () => {
    const s = start();
    const ex = s.exercises[0]!;
    let next = W.updateSetValues(s, ex.key, ex.sets[0]!.id, { reps: 11, load: 30 }, T0);
    next = W.completeSet(next, ex.key, ex.sets[0]!.id, T0);
    expect(next.exercises[0]!.sets[0]).toMatchObject({ reps: 11, completed: true });
    // Editing a completed set to an invalid value is rejected.
    expect(() => W.updateSetValues(next, ex.key, ex.sets[0]!.id, { reps: 0 }, T0)).toThrow(/not valid/);
    expect(() => W.updateSetValues(next, ex.key, ex.sets[0]!.id, { reps: 2.5 }, T0)).toThrow();
  });

  it('T07 skipped exercises are handled correctly', () => {
    let s = start();
    const [a, b] = s.exercises;
    s = W.completeSet(W.updateSetValues(s, a!.key, a!.sets[0]!.id, { load: 30 }, T0), a!.key, a!.sets[0]!.id, T0);
    s = W.setSkipped(s, b!.key, true, T0);
    expect(W.isIncomplete(s)).toBe(true);
    const done = W.finish(s, at(1800), { source: 'timer' });
    const skipped = done.exercises.find((e) => e.key === b!.key)!;
    expect(skipped.skipped).toBe(true);
    expect(skipped.sets).toEqual([]);
    expect(W.completedExerciseCount(done)).toBe(1);
    // Completing a set on a skipped exercise un-skips it.
    let s2 = W.setSkipped(start(), b!.key, true, T0);
    s2 = W.completeSet(s2, b!.key, s2.exercises[1]!.sets[0]!.id, T0);
    expect(s2.exercises[1]!.skipped).toBe(false);
  });

  it('T08 add/delete sets and draft state are plain data that survive a reload', () => {
    let s = start();
    const ex = s.exercises[0]!;
    s = W.addSet(s, ex.key, newIdFn, T0);
    expect(s.exercises[0]!.sets).toHaveLength(ex.sets.length + 1);
    s = W.deleteSet(s, ex.key, s.exercises[0]!.sets[0]!.id, T0);
    s = W.setPosition(s, 2, T0);
    s = W.pause(s, at(100));
    const reloaded = JSON.parse(JSON.stringify(s));
    expect(reloaded).toEqual(s);
    expect(reloaded.position).toBe(2);
    expect(reloaded.pausedAt).toBe(at(100).toISOString());
  });

  it('T09 historical session duration is calculated from timestamps minus pauses', () => {
    let s = start();
    const ex = s.exercises[0]!;
    s = W.completeSet(W.updateSetValues(s, ex.key, ex.sets[0]!.id, { load: 30 }, T0), ex.key, ex.sets[0]!.id, at(120));
    s = W.pause(s, at(600));
    expect(W.activeElapsedSec(s, at(900))).toBe(600);
    s = W.resume(s, at(900)); // paused 5 min
    expect(W.activeElapsedSec(s, at(2700))).toBe(2400);
    const done = W.finish(s, at(2700), { source: 'timer' });
    expect(done).toMatchObject({ durationSource: 'timer', durationSec: 2400 });
    expect(W.describeDuration(done)).toBe('40 min');
    const manual = W.finish(s, at(2700), { source: 'manual', minutes: 55 });
    expect(W.describeDuration(manual)).toBe('55 min (entered)');
  });

  it('T10 unavailable duration is never fabricated', () => {
    let s = start();
    // 26 sets "logged" in about a minute is data entry, not a one-minute workout.
    for (const ex of s.exercises) for (const set of ex.sets) s = W.completeSet(W.updateSetValues(s, ex.key, set.id, { load: 30 }, T0), ex.key, set.id, at(2));
    expect(W.timerIsPlausible(s, at(60))).toBe(false);
    const done = W.finish(s, at(60), { source: 'not-recorded' });
    expect(done.durationSec).toBeNull();
    expect(W.describeDuration(done)).toBe('Duration not recorded');
    expect(W.describeDuration({ durationSource: 'legacy-entry-time', durationSec: 60 })).toBe('Duration not recorded');
  });

  it('finishing drops unconfirmed prefilled sets and is not repeatable', () => {
    let s = start([completedSession({ date: '2026-03-03', exercises: [bench([{ load: 30, reps: 8 }, { load: 30, reps: 8 }])] })]);
    const ex = s.exercises[0]!;
    s = W.completeSet(s, ex.key, ex.sets[0]!.id, T0);
    const done = W.finish(s, at(2000), { source: 'timer' });
    expect(done.exercises[0]!.sets).toHaveLength(1);
    expect(done.exercises.slice(1).every((e) => e.sets.length === 0)).toBe(true);
    expect(() => W.finish(done, at(2001), { source: 'timer' })).toThrow(/no longer active/);
  });

  it('suggested targets are justified by the previous session and never raise load', () => {
    const target = { sets: 3, repMin: 6, repMax: 10, durationSec: null, restSec: 120 };
    const prev = W.previousPerformance([completedSession({ date: '2026-03-03', exercises: [bench([{ load: 30, reps: 8 }, { load: 30, reps: 8 }, { load: 30, reps: 7 }])] })], 'smith-bench-press', 'per-side');
    expect(W.suggestTarget(target, prev, 'per-side')).toMatchObject({ kind: 'add-rep', reps: 9, load: 30 });
    const top = W.previousPerformance([completedSession({ date: '2026-03-03', exercises: [bench([{ load: 30, reps: 10 }, { load: 30, reps: 10 }, { load: 30, reps: 10 }])] })], 'smith-bench-press', 'per-side');
    expect(W.suggestTarget(target, top, 'per-side')).toMatchObject({ kind: 'consider-load', load: 30 });
    expect(W.suggestTarget(target, null, 'per-side').kind).toBe('none');
  });

  it('assisted and bodyweight conventions validate correctly', () => {
    const bw = { load: null, reps: 10, durationSec: null, rir: null };
    expect(W.setValuesValid(bw, 'bodyweight')).toBe(true);
    expect(W.setValuesValid({ ...bw, load: 10 }, 'bodyweight')).toBe(false);
    expect(W.setValuesValid({ ...bw, load: 20 }, 'assisted')).toBe(true);
    expect(W.setValuesValid({ load: null, reps: null, durationSec: 45, rir: null }, 'timed')).toBe(true);
    expect(toKg(22.0462262, 'lb')).toBeCloseTo(10, 4);
  });
});
