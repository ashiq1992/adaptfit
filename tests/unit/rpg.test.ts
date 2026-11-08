import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/dates';
import { computeRpg, levelFromXp, type RpgInput, XP, xpEvents, xpForNext } from '../../src/domain/rpg';
import { bench, completedSession, fourDayProgramme, improvingBench, makeCheckIn, stableBench, TODAY } from '../fixtures/factories';

function input(over: Partial<RpgInput> = {}): RpgInput {
  return { sessions: [], checkIns: [], recommendations: [], weekPlans: [], programme: null, reviewedWeeks: [], today: TODAY, ...over };
}

describe('Gamification', () => {
  it('T23 XP is awarded correctly for workouts, planned sessions, and PRs', () => {
    const s1 = completedSession({ id: 'a', date: '2026-03-02', exercises: [bench([{ load: 30, reps: 8 }])], source: 'programme' });
    const s2 = completedSession({ id: 'b', date: '2026-03-09', exercises: [bench([{ load: 30, reps: 9 }])], source: 'quick' });
    const events = xpEvents(input({ sessions: [s1, s2] }));
    expect(events.map((e) => [e.key, e.xp])).toEqual([
      ['planned:a', XP.planned],
      ['workout:a', XP.workout],
      ['pr:b:smith-bench-press|per-side', XP.pr],
      ['workout:b', XP.workout],
    ]);
    // Sessions with no completed sets earn nothing.
    const empty = { ...s2, id: 'c', exercises: [{ ...s2.exercises[0]!, sets: [] }] };
    expect(xpEvents(input({ sessions: [empty] }))).toEqual([]);
  });

  it('T24 duplicate XP is prevented (duplicate records, repeated imports, extra sessions)', () => {
    const s = completedSession({ id: 'dup', date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])] });
    expect(xpEvents(input({ sessions: [s, s, structuredClone(s)] })).filter((e) => e.kind === 'workout')).toHaveLength(1);
    // No reward for unnecessary extra sessions beyond the week's plan.
    const programme = { ...fourDayProgramme(), daysPerWeek: 2, createdAt: '2026-01-01T00:00:00.000Z' };
    const week = ['2026-03-09', '2026-03-09', '2026-03-10'].map((d, i) => completedSession({ id: `w${i}`, date: d, exercises: [bench([{ load: 30, reps: 8 }])] }));
    expect(xpEvents(input({ sessions: week, programme })).filter((e) => e.kind === 'workout')).toHaveLength(2);
  });

  it('T25 level calculation is correct', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, totalXP: 0, xpIntoLevel: 0, xpForNext: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 150 });
    expect(levelFromXp(249).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
    expect(xpForNext(8)).toBe(450);
    expect(levelFromXp(-5).level).toBe(1);
  });

  it('T26 character stats use valid recorded events only', () => {
    const programme = { ...fourDayProgramme(), daysPerWeek: 1, createdAt: '2026-01-01T00:00:00.000Z' };
    const rpg = computeRpg(input({ sessions: improvingBench(3), programme, checkIns: [makeCheckIn({ sleepHours: 7.5 }), makeCheckIn({ localDate: addDays(TODAY, -1) })] }));
    const stat = (id: string) => rpg.stats.find((s) => s.id === id)!;
    expect(stat('str').value).toBe(1 + 2); // two PRs (sessions 2 and 3)
    expect(stat('rec').value).toBe(1 + 1); // only the check-in with recovery data counts
    expect(stat('cons').value).toBe(1 + 3); // three weeks with the planned session
    expect(stat('end').value).toBe(1 + 3); // three full-volume sessions
    for (const s of rpg.stats) expect(s.basis.length).toBeGreaterThan(10);
  });

  it('T27 deleted sessions reconcile related rewards', () => {
    const sessions = improvingBench(3);
    const before = computeRpg(input({ sessions }));
    const after = computeRpg(input({ sessions: sessions.slice(0, 2) }));
    expect(before.level.totalXP - after.level.totalXP).toBe(XP.workout + XP.planned + XP.pr);
    expect(after.prCount).toBe(1);
    expect(computeRpg(input()).level.totalXP).toBe(0);
  });

  it('T28 gamification state is optional — workout data is unaffected', () => {
    // RPG is a pure projection: computing it never changes sessions, and it is
    // safe to skip entirely when the user disables gamification.
    const sessions = stableBench(2);
    const copy = structuredClone(sessions);
    computeRpg(input({ sessions }));
    expect(sessions).toEqual(copy);
  });

  it('achievements and missions are derived', () => {
    const programme = { ...fourDayProgramme(), daysPerWeek: 1, createdAt: '2026-01-01T00:00:00.000Z' };
    const rpg = computeRpg(input({ sessions: improvingBench(4), programme, reviewedWeeks: ['2026-03-09'] }));
    const ach = (id: string) => rpg.achievements.find((a) => a.id === id)!;
    expect(ach('first-workout').earned).toBe(true);
    expect(ach('programme-builder').earned).toBe(true);
    expect(ach('first-pr').earned).toBe(true);
    expect(ach('four-week-consistency')).toMatchObject({ earned: true, rarity: 'rare' });
    expect(ach('ten-workouts')).toMatchObject({ earned: false, current: 4, target: 10 });
    expect(rpg.missions.find((m) => m.id === 'review')!.done).toBe(true);
    expect(rpg.missions.find((m) => m.id === 'planned')).toMatchObject({ current: 1, target: 1, done: true });
  });
});
