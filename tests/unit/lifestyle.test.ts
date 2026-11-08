import { describe, expect, it } from 'vitest';
import { assessExercise } from '../../src/domain/plateau';
import { comparableKey } from '../../src/domain/loads';
import { estimateDayMinutes, shortenDay } from '../../src/domain/programme';
import { proposeWeek } from '../../src/domain/schedule';
import { decide, newPlateauRecommendation, weeklyReview } from '../../src/domain/coach';
import { profileSchema } from '../../src/data/schemas';
import { EMPTY_LIFESTYLE } from '../../src/domain/types';
import { fourDayProgramme, makeCheckIn, makeProfile, stableBench, T0, TODAY } from '../fixtures/factories';

describe('Lifestyle-aware training', () => {
  it('T29 missing sleep data is supported everywhere', () => {
    const f = assessExercise(stableBench(4), comparableKey('smith-bench-press', 'per-side'), 'Bench', TODAY, { checkIns: [], profile: makeProfile() });
    expect(f.status).toBe('possible-plateau');
    const review = weeklyReview({ sessions: stableBench(2), programme: fourDayProgramme(), weekPlans: [], checkIns: [makeCheckIn()], today: TODAY });
    expect(review.recovery.avgSleep).toBeNull();
    expect(review.headline).toMatch(/planned workouts/);
  });

  it('T30 work schedule changes are saved in a valid profile', () => {
    const profile = makeProfile({
      lifestyle: { ...EMPTY_LIFESTYLE, work: { days: [1, 2, 3, 4, 5], start: '09:00', end: '19:30', overtime: 'often', trainingWindows: ['evening'] } },
    });
    const parsed = profileSchema.parse(JSON.parse(JSON.stringify(profile)));
    expect(parsed.lifestyle.work).toEqual(profile.lifestyle.work);
    expect(profileSchema.safeParse({ ...profile, lifestyle: { ...profile.lifestyle, work: { ...profile.lifestyle.work!, start: '25:00' } } }).success).toBe(false);
  });

  it('T31 weekly adaptation preserves priority exercises without cramming', () => {
    const programme = fourDayProgramme(); // 4 days, 1 priority-heavy exercise per day
    const plan = proposeWeek({ programme, weekStart: '2026-03-09', availableSessions: 2, nextDayId: programme.days[0]!.id, sessionLengthMin: 75 });
    expect(plan.status).toBe('pending');
    expect(plan.sessions).toHaveLength(2);
    expect(plan.sessions[0]!.dayId).toBe(programme.days[0]!.id); // rotation continues
    const priorityNames = programme.days.flatMap((d) => d.exercises.filter((e) => e.priority).map((e) => e.name));
    const scheduled = new Set([
      ...plan.sessions.flatMap((s) => programme.days.find((d) => d.id === s.dayId)!.exercises.map((e) => e.name)),
      ...plan.sessions.flatMap((s) => s.added.map((a) => a.name)),
    ]);
    const tradeoffText = plan.tradeoffs.join(' ');
    for (const n of priorityNames) expect(scheduled.has(n) || tradeoffText.includes(n)).toBe(true);
    for (const s of plan.sessions) {
      expect(s.estimatedMinutes).toBeLessThanOrEqual(75);
      expect(s.added.length).toBeLessThanOrEqual(2);
      for (const a of s.added) expect(a.sets).toBeLessThanOrEqual(2);
    }
    expect(plan.tradeoffs.at(-1)).toMatch(/not extra work crammed/);
    // Enough availability → no changes.
    expect(proposeWeek({ programme, weekStart: '2026-03-09', availableSessions: 4, nextDayId: null, sessionLengthMin: 75 }).tradeoffs).toEqual([]);
  });

  it('shortened sessions keep priority exercises and report every change', () => {
    const day = fourDayProgramme().days[2]!; // Upper Body B: 5 exercises
    const full = estimateDayMinutes(day);
    const short = shortenDay(day, 30);
    expect(full).toBeGreaterThan(30);
    expect(short.fits).toBe(true);
    expect(short.day.exercises.some((e) => e.priority)).toBe(true);
    expect(short.changes.length).toBeGreaterThan(0);
    expect(shortenDay(day, 200).changes).toEqual([]);
  });

  it('T32 recommendations require user approval', () => {
    const programme = fourDayProgramme();
    const f = assessExercise(stableBench(4), comparableKey('smith-bench-press', 'per-side'), 'Bench', TODAY, { checkIns: [], profile: makeProfile() });
    const rec = newPlateauRecommendation({ id: 'r', now: T0, today: TODAY, finding: f, programme, recentPainReports: 0 });
    expect(rec.status).toBe('open');
    expect(rec.appliedChange).toBeNull();
    const postponed = decide(rec, 'postponed', T0, TODAY);
    expect(postponed).toMatchObject({ status: 'postponed', appliedChange: null, postponedUntil: '2026-03-17' });
    const accepted = decide(rec, 'accepted', T0, TODAY);
    expect(accepted.followUp).toEqual({ dueDate: '2026-03-24', outcome: null });
  });

  it('T33 optional dietary preferences are retained', () => {
    const profile = makeProfile({
      timezone: 'Asia/Singapore',
      lifestyle: {
        ...EMPTY_LIFESTYLE,
        nutrition: { pattern: '3 meals, hawker lunch', objective: 'lean-gain', restrictions: ['halal', 'no-pork'], proteinTargetG: 140, energyKcal: null, fasting: 'Ramadan' },
      },
    });
    const round = profileSchema.parse(JSON.parse(JSON.stringify(profile)));
    expect(round.lifestyle.nutrition).toEqual(profile.lifestyle.nutrition);
    expect(round.timezone).toBe('Asia/Singapore');
  });
});
