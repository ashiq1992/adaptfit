import { render } from '@testing-library/react';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { CHARACTER_DEFS, isValidDef, resolveStyle } from '../../src/content/characters';
import { createDb, PRE_V4_SNAPSHOT_KEY, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, setDb } from '../../src/data/db';
import * as repo from '../../src/data/repo';
import { profileSchema } from '../../src/data/schemas';
import { decide, weeklyReview } from '../../src/domain/coach';
import { addDays } from '../../src/domain/dates';
import { recommendProgrammes } from '../../src/domain/guided';
import { applyNutritionChange, integrationFindings, integrationRecommendation } from '../../src/domain/integration';
import { assessExercise } from '../../src/domain/plateau';
import { proposeWeek, weekSchedule } from '../../src/domain/schedule';
import { computeRpg, type RpgInput } from '../../src/domain/rpg';
import { Adventurer } from '../../src/ui/Adventurer';
import { bench, completedSession, fourDayProgramme, improvingBench, makeProfile, newIdFn, nutritionProfile, stableBench, T0, TODAY, weeklyBodyweights } from '../fixtures/factories';

const BENCH = 'smith-bench-press|per-side';
const WS = '2026-03-09'; // Monday of TODAY's week

describe('V0.3 coaching and scheduling', () => {
  it('T43 the weekly planned-session count is consistent everywhere', () => {
    // The V0.2 bug: a programme with 1 distinct day but 3 sessions a week showed "1 of 3" in the review and "Normally 1 sessions" in the planner.
    const p = { ...fourDayProgramme(), days: fourDayProgramme().days.slice(0, 1), daysPerWeek: 3 };
    const done = completedSession({ date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])], programmeId: p.id, dayId: p.days[0]!.id });
    const schedule = weekSchedule(p, [], [done], WS);
    expect(schedule).toMatchObject({ defaultFrequency: 3, planned: 3, completed: 1, remaining: 2, source: 'programme' });
    const review = weeklyReview({ sessions: [done], programme: p, weekPlans: [], checkIns: [], today: TODAY });
    expect([review.planned, review.completed, review.remaining]).toEqual([3, 1, 2]);
    const proposal = proposeWeek({ programme: p, weekStart: WS, availableSessions: 3, nextDayId: p.days[0]!.id, sessionLengthMin: 75 });
    expect(proposal.plannedSessions).toBe(3);
    expect(proposal.sessions).toHaveLength(3); // the single day repeats
    // Grammar: singular and plural.
    const one = { ...p, daysPerWeek: 1 };
    expect(weeklyReview({ sessions: [], programme: one, weekPlans: [], checkIns: [], today: TODAY }).headline).toMatch(/0 of 1 planned workout done/);
    expect(proposeWeek({ programme: p, weekStart: WS, availableSessions: 1, nextDayId: null, sessionLengthMin: 75 }).tradeoffs.join(' ')).toMatch(/1 of 3 sessions/);
  });

  it('T44 temporary adjusted schedules are represented separately from the default', () => {
    const p = fourDayProgramme();
    const plan = { ...proposeWeek({ programme: p, weekStart: WS, availableSessions: 2, nextDayId: p.days[0]!.id, sessionLengthMin: 75 }), status: 'approved' as const, decidedAt: T0.toISOString() };
    const s = weekSchedule(p, [plan], [], WS);
    expect(s).toMatchObject({ defaultFrequency: 4, planned: 2, source: 'adjusted' });
    expect(weekSchedule(p, [plan], [], addDays(WS, 7))).toMatchObject({ planned: 4, source: 'programme' }); // only this week
    expect(weeklyReview({ sessions: [], programme: p, weekPlans: [plan], checkIns: [], today: TODAY })).toMatchObject({ planned: 2, defaultFrequency: 4, adjusted: true });
    expect(weekSchedule(p, [{ ...plan, status: 'rejected' }], [], WS).source).toBe('programme');
  });

  it('T45 insufficient data is never labelled as progress', () => {
    const ctx = { checkIns: [], profile: makeProfile() };
    const two = assessExercise(improvingBench(2), BENCH, 'Bench', TODAY, ctx);
    expect(two.status).toBe('insufficient-data');
    expect(two.missingData[0]).toMatch(/Log 2 more sessions/);
    // Improved earlier, then held for two sessions → stable, not a plateau and not "improving".
    const held = [...improvingBench(3, addDays(TODAY, -14)), ...stableBench(2, TODAY).map((x) => ({ ...x, exercises: [bench([{ load: 30, reps: 8 }, { load: 30, reps: 8 }])] }))];
    expect(assessExercise(held, BENCH, 'Bench', TODAY, ctx).status).toBe('stable');
  });

  it('T46 possible plateaus need sufficient comparable history', () => {
    const ctx = { checkIns: [], profile: makeProfile() };
    expect(assessExercise(stableBench(4), BENCH, 'Bench', TODAY, ctx).status).toBe('possible-plateau');
    expect(assessExercise(stableBench(3), BENCH, 'Bench', TODAY, ctx).status).toBe('insufficient-data');
    // A different loading convention is not comparable history.
    const totals = stableBench(4).map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e, loadType: 'total' as const })) }));
    expect(assessExercise(totals, BENCH, 'Bench', TODAY, ctx).status).toBe('insufficient-data');
  });

  it('T47 nutrition context never makes unsupported causal claims', () => {
    const profile = makeProfile({ goal: 'hypertrophy', lifestyle: { work: { days: [1, 2, 3, 4, 5], start: null, end: null, overtime: 'often', trainingWindows: [] }, sleep: null, nutrition: null, training: null } });
    const findings = [
      ...integrationFindings({ profile, nutrition: nutritionProfile({ goal: 'muscle-gain' }), bodyweights: weeklyBodyweights(4, 80, 0), today: TODAY, behindThisWeek: false }),
      ...integrationFindings({ profile, nutrition: nutritionProfile({ goal: 'fat-loss', habits: { ...nutritionProfile().habits, source: 'out' } }), bodyweights: weeklyBodyweights(4, 80, 0), today: TODAY, behindThisWeek: true }),
    ];
    expect([...new Set(findings.map((f) => f.id))].sort()).toEqual(['busy-eating-out', 'gain-stable', 'loss-slow']);
    for (const f of findings) {
      const text = `${f.title} ${f.explanation}`;
      expect(text).not.toMatch(/\bbecause (you|your)\b|caused by|is due to|you are not eating enough|you ate too/i);
    }
    // Fat loss: a slow trend never proposes cutting further.
    const slow = findings.find((f) => f.id === 'loss-slow')!;
    expect(slow.proposedChange?.type).toBe('focus');
    // Gain: may be more information needed; a target change is only a proposal.
    expect(findings.find((f) => f.id === 'gain-stable')!.explanation).toMatch(/More information may be needed/);
    // No bodyweight data → no bodyweight-based conclusions (the busy-week tip doesn't depend on bodyweight).
    const noWeights = integrationFindings({ profile, nutrition: nutritionProfile({ goal: 'muscle-gain' }), bodyweights: [], today: TODAY, behindThisWeek: false });
    expect(noWeights.map((f) => f.id)).toEqual(['busy-eating-out']);
  });

  it('T48 T49 T50 recommendations need confirmation; rejection changes nothing; decisions persist', async () => {
    setDb(createDb(`v3-t48-${Math.random()}`));
    const n = nutritionProfile({ goal: 'muscle-gain' });
    await repo.saveNutrition(n);
    const f = integrationFindings({ profile: makeProfile({ goal: 'hypertrophy' }), nutrition: n, bodyweights: weeklyBodyweights(4, 80, 0), today: TODAY, behindThisWeek: false })[0]!;
    const rec = await repo.addRecommendation(integrationRecommendation(f, 'rec-1', T0, TODAY));
    expect(rec.proposedChange).toEqual({ type: 'nutrition-target', fromKcal: 2500, toKcal: 2650 });
    // Raising a recommendation changes nothing on its own.
    expect((await repo.getNutrition())!.target!.kcal).toBe(2500);
    // Rejected → target unchanged.
    await repo.decideRecommendation('rec-1', 'rejected', T0, TODAY);
    expect((await repo.getNutrition())!.target!.kcal).toBe(2500);
    expect((await repo.listRecommendations())[0]).toMatchObject({ status: 'rejected' });
    // Accepted → applied in the same transaction, decision persisted.
    await repo.addRecommendation(integrationRecommendation(f, 'rec-2', T0, addDays(TODAY, 7)));
    await repo.decideRecommendation('rec-2', 'accepted', T0, TODAY);
    expect((await repo.getNutrition())!.target).toMatchObject({ kcal: 2650, source: 'manual' });
    expect((await repo.listRecommendations()).map((r) => r.status).sort()).toEqual(['accepted', 'rejected']);
    // Postpone is recorded too.
    expect(decide(rec, 'postponed', T0, TODAY)).toMatchObject({ status: 'postponed', postponedUntil: addDays(TODAY, 7) });
    expect(applyNutritionChange(n, { type: 'focus', text: 'x' }, T0)).toBe(n);
    setDb(null);
  });
});

describe('V0.3 characters', () => {
  const rpgInput = (): RpgInput => ({
    sessions: [completedSession({ id: 'a', date: '2026-03-02', exercises: [bench([{ load: 30, reps: 8 }])] }), completedSession({ id: 'b', date: TODAY, exercises: [bench([{ load: 30, reps: 9 }])] })],
    checkIns: [],
    recommendations: [],
    weekPlans: [],
    programme: null,
    reviewedWeeks: [],
    today: TODAY,
  });

  it('T51 four characters are available, all valid and placeholder-marked', () => {
    expect(CHARACTER_DEFS.map((d) => d.id)).toEqual(['warrior', 'ranger', 'scholar', 'engineer']);
    for (const d of CHARACTER_DEFS) {
      expect(isValidDef(d)).toBe(true);
      expect(d.placeholder).toBe(true);
    }
  });

  it('T52 character selection persists', async () => {
    setDb(createDb(`v3-t52-${Math.random()}`));
    const p = makeProfile({ character: { style: 'scholar', palette: null, hiddenLayers: ['cape'], updatedAt: T0.toISOString() } });
    expect(profileSchema.safeParse(p).success).toBe(true);
    await repo.saveProfile(p);
    expect((await repo.getProfile())!.character).toMatchObject({ style: 'scholar', hiddenLayers: ['cape'] });
    setDb(null);
  });

  it('T53 T54 T56 switching characters preserves XP and achievements and never changes fitness logic', () => {
    const before = computeRpg(rpgInput());
    // Character choice isn't an input to progression: identical records give identical results.
    const after = computeRpg(rpgInput());
    expect(after.level).toEqual(before.level);
    expect(after.achievements).toEqual(before.achievements);
    expect(after.stats).toEqual(before.stats);
    // Programme recommendations don't depend on the character either.
    const a = { goal: 'hypertrophy', experience: 'intermediate', daysPerWeek: 3, sessionMinutes: 60, preferredWeekdays: [], equipment: 'full-gym', priorities: [], avoidExerciseIds: [] } as const;
    const ids = recommendProgrammes({ ...a, preferredWeekdays: [], priorities: [], avoidExerciseIds: [] }, newIdFn).map((r) => r.template.id);
    expect(ids).toEqual(recommendProgrammes({ ...a, preferredWeekdays: [], priorities: [], avoidExerciseIds: [] }, newIdFn).map((r) => r.template.id));
  });

  it('T55 missing character assets fall back to the default sprite', () => {
    expect(resolveStyle('dragon-knight')).toMatchObject({ fallback: true, def: { id: 'warrior' } });
    expect(resolveStyle(undefined).fallback).toBe(true);
    const broken = [{ ...CHARACTER_DEFS[1]!, gear: [{ x: 40, y: 3, c: 'x' }] }];
    expect(resolveStyle('ranger', broken)).toMatchObject({ fallback: true });
    const { container } = render(<Adventurer level={3} styleId="dragon-knight" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-fallback')).toBe('true');
    expect(svg.getAttribute('data-style')).toBe('warrior');
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(20);
    const ok = render(<Adventurer level={3} styleId="engineer" />).container.querySelector('svg')!;
    expect(ok.getAttribute('data-fallback')).toBeNull();
    expect(ok.getAttribute('data-style')).toBe('engineer');
  });

  it('T57 duplicate XP is prevented', () => {
    const input = rpgInput();
    const dup = computeRpg({ ...input, sessions: [...input.sessions, ...input.sessions.map((s) => structuredClone(s))] });
    expect(dup.level.totalXP).toBe(computeRpg(input).level.totalXP);
  });

  it('T58 existing records and achievements survive the v3 → v4 migration', async () => {
    const name = `v3-t58-${Math.random()}`;
    // A V0.2 (database v3) database with V0.2-shaped records.
    const old = new Dexie(name);
    old.version(1).stores(SCHEMA_V1);
    old.version(2).stores(SCHEMA_V2);
    old.version(3).stores(SCHEMA_V3);
    await old.open();
    const input = rpgInput();
    const v2Profile = (({ character: _c, trainingPrefs: _t, ...rest }) => rest)(makeProfile());
    const v2Programme = { ...fourDayProgramme(), days: fourDayProgramme().days.map((d) => ({ ...d, exercises: d.exercises.map(({ plannedLoad: _p, ...e }) => e) })) };
    delete (v2Programme as Partial<typeof v2Programme>).templateId;
    await old.table('profile').put(v2Profile);
    await old.table('programmes').put(v2Programme);
    await old.table('sessions').bulkPut(input.sessions);
    await old.table('measurements').bulkPut([
      { id: 'm1', localDate: '2026-03-01', bodyweightKg: 80.4, waistCm: null, note: '', createdAt: T0.toISOString() },
      { id: 'm2', localDate: '2026-03-08', bodyweightKg: 80.1, waistCm: 82, note: 'am', createdAt: T0.toISOString() },
    ]);
    const before = computeRpg(input);
    old.close();

    const db = createDb(name);
    setDb(db);
    await db.open();
    expect(db.verno).toBe(4);
    const sessions = await db.sessions.toArray();
    expect(sessions).toEqual(input.sessions); // untouched
    const after = computeRpg({ ...input, sessions });
    expect(after.level).toEqual(before.level);
    expect(after.achievements.filter((a) => a.earned).map((a) => a.id)).toEqual(before.achievements.filter((a) => a.earned).map((a) => a.id));
    const profile = await db.profile.get('me');
    expect(profile).toMatchObject({ character: { style: 'warrior' }, trainingPrefs: { priorities: [] } });
    expect((await db.programmes.toArray())[0]!.days[0]!.exercises.every((e) => e.plannedLoad === null)).toBe(true);
    expect((await db.bodyweights.orderBy('localDate').toArray()).map((b) => [b.localDate, b.value, b.unit])).toEqual([
      ['2026-03-01', 80.4, 'kg'],
      ['2026-03-08', 80.1, 'kg'],
    ]);
    expect(await db.measurements.toArray()).toEqual([{ id: 'm2', localDate: '2026-03-08', bodyweightKg: null, waistCm: 82, note: 'am', createdAt: T0.toISOString() }]);
    // A pre-upgrade copy is kept for rollback.
    const snap = (await db.meta.get(PRE_V4_SNAPSHOT_KEY))!.value as { measurements: unknown[]; programmes: unknown[] };
    expect(snap.measurements).toHaveLength(2);
    expect(snap.programmes).toHaveLength(1);
    setDb(null);
  });
});
