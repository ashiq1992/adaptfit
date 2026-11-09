import { describe, expect, it } from 'vitest';
import { EXERCISES_BY_ID } from '../../src/content/exercises';
import { ACCESS_EQUIPMENT, NEEDS_PULLUP_BAR, PROGRAMME_TEMPLATES } from '../../src/content/programmeLibrary';
import { createDb, setDb } from '../../src/data/db';
import * as repo from '../../src/data/repo';
import { programmeSchema } from '../../src/data/schemas';
import { defaultAnswers, evaluateTemplate, generateDays, type GuidedAnswers, programmeFromRecommendation, recommendProgrammes, swapExercise } from '../../src/domain/guided';
import { convertLoad } from '../../src/domain/loads';
import { estimateDayMinutes, validateProgramme } from '../../src/domain/programme';
import { exerciseHistory } from '../../src/domain/progression';
import * as W from '../../src/domain/workout';
import { bench, completedSession, fourDayProgramme, makeProfile, newIdFn, pe, T0, TODAY } from '../fixtures/factories';

const answers = (over: Partial<GuidedAnswers> = {}): GuidedAnswers => ({
  goal: 'hypertrophy',
  experience: 'intermediate',
  daysPerWeek: 4,
  sessionMinutes: 60,
  preferredWeekdays: [1, 2, 4, 5],
  equipment: 'full-gym',
  priorities: [],
  avoidExerciseIds: [],
  ...over,
});

describe('V0.3 guided programmes', () => {
  it('T01 the questionnaire produces a ranked, explained shortlist', () => {
    const recs = recommendProgrammes(answers(), newIdFn);
    expect(recs).toHaveLength(PROGRAMME_TEMPLATES.length);
    expect(recs[0]!.template.daysPerWeek).toBe(4);
    for (const r of recs) {
      expect(r.reasons.length + r.tradeoffs.length).toBeGreaterThan(0);
      expect(r.days.length).toBe(r.template.days.length);
      expect(r.distribution.length).toBeGreaterThan(0);
    }
    // Deterministic: the same answers give the same ranking.
    expect(recommendProgrammes(answers(), newIdFn).map((r) => r.template.id)).toEqual(recs.map((r) => r.template.id));
  });

  it('T02 existing preferences are reused as defaults', () => {
    const profile = makeProfile({
      goal: 'strength',
      experience: 'advanced',
      preferredMinutes: 45,
      equipment: ['bodyweight', 'dumbbells'],
      lifestyle: { work: null, sleep: null, nutrition: null, training: { minDays: null, preferredDays: [2, 4] } },
      trainingPrefs: { equipmentAccess: 'basic-home', priorities: ['back'], avoidExerciseIds: ['deadlift'], restrictionNote: '', daysPerWeek: 5 },
    });
    const a = defaultAnswers(profile, { ...fourDayProgramme(), daysPerWeek: 3 });
    expect(a).toMatchObject({ goal: 'strength', experience: 'advanced', sessionMinutes: 45, daysPerWeek: 3, preferredWeekdays: [2, 4], equipment: 'basic-home', priorities: ['back'], avoidExerciseIds: ['deadlift'] });
    // Without a programme, the days-per-week answer from onboarding is reused.
    expect(defaultAnswers(profile, null).daysPerWeek).toBe(5);
    // Without saved questionnaire answers, equipment comes from the profile's equipment modes.
    expect(defaultAnswers(makeProfile({ equipment: ['gym'] }), null).equipment).toBe('full-gym');
  });

  it('T03 suggestions match available days; mismatches are explained, never ranked above a fit', () => {
    const two = recommendProgrammes(answers({ daysPerWeek: 2 }), newIdFn);
    expect(two[0]!.template.daysPerWeek).toBe(2);
    const five = two.find((r) => r.template.daysPerWeek === 5)!;
    expect(five.dayMismatch).toBe(true);
    expect(five.tradeoffs.join(' ')).toMatch(/Needs 5 days a week but you said 2/);
    const firstMismatch = two.findIndex((r) => r.dayMismatch);
    expect(two.slice(firstMismatch).every((r) => r.dayMismatch)).toBe(true);
    expect(recommendProgrammes(answers({ daysPerWeek: 5 }), newIdFn)[0]!.template.daysPerWeek).toBe(5);
  });

  it('T04 suggestions respect session duration, with honest estimates', () => {
    // Every template day estimates at or under its nominal length (warm-up and rest included).
    for (const t of PROGRAMME_TEMPLATES) {
      for (const d of generateDays(t, answers({ experience: 'advanced' }), newIdFn)) expect(estimateDayMinutes(d.day)).toBeLessThanOrEqual(t.sessionMinutes);
    }
    const r = evaluateTemplate(PROGRAMME_TEMPLATES.find((t) => t.id === 'af-upper-lower-4')!, answers({ sessionMinutes: 30 }), newIdFn);
    expect(r.trimmed).toBe(true);
    expect(r.estimatedMinutes).toBeLessThanOrEqual(30);
    expect(r.days.every((d) => estimateDayMinutes(d) <= 30)).toBe(true);
    expect(r.tradeoffs.join(' ')).toMatch(/Shortened to fit 30 minutes/);
    // Priority lifts survive trimming (non-priority accessories are cut first).
    const before = generateDays(r.template, answers({ sessionMinutes: 30 }), newIdFn);
    before.forEach((g, i) => {
      const prio = g.day.exercises.filter((e) => e.priority).map((e) => e.exerciseId);
      expect(r.days[i]!.exercises.map((e) => e.exerciseId)).toEqual(expect.arrayContaining(prio));
    });
  });

  it('T05 equipment restrictions are applied', () => {
    for (const access of ['bodyweight', 'basic-home', 'dumbbells-bench'] as const) {
      const recs = recommendProgrammes(answers({ equipment: access, daysPerWeek: 3 }), newIdFn);
      for (const r of recs)
        for (const d of r.days)
          for (const e of d.exercises) {
            const lib = EXERCISES_BY_ID.get(e.exerciseId)!;
            expect(lib.equipment.every((item) => ACCESS_EQUIPMENT[access].includes(item))).toBe(true);
            expect(NEEDS_PULLUP_BAR.has(e.exerciseId)).toBe(false);
          }
    }
    // Avoided exercises are replaced by an allowed alternative.
    const avoid = recommendProgrammes(answers({ avoidExerciseIds: ['barbell-back-squat', 'barbell-bench-press'] }), newIdFn);
    expect(avoid.flatMap((r) => r.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))).not.toContain('barbell-back-squat');
    // Bodyweight-only users are told what couldn't be included.
    const bw = recommendProgrammes(answers({ equipment: 'bodyweight', daysPerWeek: 3 }), newIdFn)[0]!;
    expect(bw.tradeoffs.join(' ')).toMatch(/No suitable exercise with your equipment/);
  });

  it('T06 recommended templates are editable and produce valid programmes', () => {
    const rec = recommendProgrammes(answers(), newIdFn)[0]!;
    const programme = programmeFromRecommendation(rec, answers(), newIdFn, T0);
    expect(programme).toMatchObject({ source: 'template', templateId: rec.template.id, isActive: false, daysPerWeek: 4, preferredWeekdays: [1, 2, 4, 5] });
    expect(validateProgramme(programme)).toEqual([]);
    expect(programmeSchema.safeParse(programme).success).toBe(true);
    const day = programme.days[0]!;
    const target = day.exercises[0]!;
    const swapped = swapExercise({ ...day, exercises: [{ ...target, plannedLoad: { value: 30, unit: 'kg' } }, ...day.exercises.slice(1)] }, target.id, 'db-bench-press');
    expect(swapped.exercises[0]).toMatchObject({ exerciseId: 'db-bench-press', loadType: 'per-dumbbell', sets: target.sets, plannedLoad: null });
  });

  it('T07 saving a recommended programme never overwrites an existing one', async () => {
    const db = createDb(`v3-t07-${Math.random()}`);
    setDb(db);
    const existing = fourDayProgramme();
    await repo.saveProgramme(existing, { activate: true });
    const programme = programmeFromRecommendation(recommendProgrammes(answers({ daysPerWeek: 3 }), newIdFn)[0]!, answers(), newIdFn, T0);
    await repo.saveProgramme(programme, { activate: false });
    const all = await repo.listProgrammes();
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.id === existing.id)).toMatchObject({ isActive: true, days: existing.days });
    expect((await repo.getActiveProgramme())!.id).toBe(existing.id);
    setDb(null);
  });
});

describe('V0.3 planned versus actual loads', () => {
  const day = (planned: { value: number; unit: 'kg' | 'lb' } | null) => ({ id: 'd1', name: 'Upper', notes: '', exercises: [{ ...pe('smith-bench-press', { sets: 3, repMin: 6, repMax: 10 }), plannedLoad: planned }] });

  it('T08 planned working loads save and validate', async () => {
    const db = createDb(`v3-t08-${Math.random()}`);
    setDb(db);
    const p = { ...fourDayProgramme(), days: [day({ value: 30, unit: 'kg' })] };
    expect(programmeSchema.safeParse(p).success).toBe(true);
    await repo.saveProgramme(p);
    expect((await repo.listProgrammes())[0]!.days[0]!.exercises[0]!.plannedLoad).toEqual({ value: 30, unit: 'kg' });
    expect(programmeSchema.safeParse({ ...p, days: [day({ value: -5, unit: 'kg' })] }).success).toBe(false);
    setDb(null);
  });

  it('T09 actual completed loads are recorded separately from the plan', () => {
    const programme = { ...fourDayProgramme(), days: [day({ value: 30, unit: 'kg' })] };
    let s = W.sessionFromDay({ id: 's', now: T0, newId: newIdFn, programme, day: programme.days[0]!, history: [], unit: 'kg', checkIn: null });
    const key = s.exercises[0]!.key;
    const setId = s.exercises[0]!.sets[0]!.id;
    expect(s.exercises[0]!.sets[0]).toMatchObject({ load: 30, prefill: 'planned', completed: false });
    s = W.updateSetValues(s, key, setId, { load: 32.5, reps: 8 }, T0);
    s = W.completeSet(s, key, setId, T0);
    expect(s.exercises[0]!.sets[0]).toMatchObject({ load: 32.5, reps: 8, completed: true });
    // The programme's plan is untouched.
    expect(programme.days[0]!.exercises[0]!.plannedLoad).toEqual({ value: 30, unit: 'kg' });
  });

  it('T10 per-side and total weights remain distinct', () => {
    const perSide = W.prefillSets(newIdFn, { sets: 1, repMin: 8, repMax: 10, durationSec: null, restSec: 90 }, 'per-side', 'kg', null, { value: 30, unit: 'kg' });
    const total = W.prefillSets(newIdFn, { sets: 1, repMin: 8, repMax: 10, durationSec: null, restSec: 90 }, 'total', 'kg', null, { value: 45, unit: 'kg' });
    expect([perSide[0]!.load, total[0]!.load]).toEqual([30, 45]);
    // History recorded total is never used to prefill a per-side exercise.
    const totalHistory = completedSession({ date: TODAY, exercises: [bench([{ load: 90, reps: 8 }], { loadType: 'total' })] });
    expect(W.previousPerformance([totalHistory], 'smith-bench-press', 'per-side')).toBeNull();
    // Bodyweight and timed exercises never get a planned load.
    expect(W.prefillSets(newIdFn, { sets: 1, repMin: 8, repMax: 10, durationSec: null, restSec: 90 }, 'bodyweight', 'kg', null, { value: 10, unit: 'kg' })[0]!.load).toBeNull();
    // Units: a planned lb load is converted (rounded) only for prefill; recorded history is never converted.
    expect(convertLoad(45, 'lb', 'kg')).toBe(20.5);
  });

  it('T11 previous-session values take precedence over the planned load', () => {
    const programme = { ...fourDayProgramme(), days: [day({ value: 30, unit: 'kg' })] };
    const prev = completedSession({ date: TODAY, exercises: [bench([{ load: 35, reps: 9 }, { load: 35, reps: 8 }])] });
    const s = W.sessionFromDay({ id: 's', now: T0, newId: newIdFn, programme, day: programme.days[0]!, history: [prev], unit: 'kg', checkIn: null });
    expect(s.exercises[0]!.sets.map((x) => [x.load, x.reps, x.prefill])).toEqual([
      [35, 9, 'previous'],
      [35, 8, 'previous'],
      [35, 8, 'previous'],
    ]);
    // No history and no plan: load stays blank.
    const blank = W.sessionFromDay({ id: 's2', now: T0, newId: newIdFn, programme, day: day(null), history: [], unit: 'kg', checkIn: null });
    expect(blank.exercises[0]!.sets[0]).toMatchObject({ load: null, reps: 6, prefill: 'target' });
  });

  it('T12 no prefilled set is automatically completed', () => {
    const programme = { ...fourDayProgramme(), days: [day({ value: 30, unit: 'kg' })] };
    const s = W.sessionFromDay({ id: 's', now: T0, newId: newIdFn, programme, day: programme.days[0]!, history: [], unit: 'kg', checkIn: null });
    expect(s.exercises.flatMap((e) => e.sets).every((x) => !x.completed && x.completedAt === null)).toBe(true);
    expect(W.completedSetCount(s)).toBe(0);
  });

  it('T13 programme modifications preserve historical workouts', async () => {
    const db = createDb(`v3-t13-${Math.random()}`);
    setDb(db);
    const p = fourDayProgramme();
    await repo.saveProgramme(p, { activate: true });
    const past = completedSession({ id: 'past', date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])], programmeId: p.id, dayId: p.days[0]!.id });
    await db.sessions.put(past);
    const edited = { ...p, days: p.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, sets: 5, plannedLoad: { value: 40, unit: 'kg' as const } })) })) };
    await repo.saveProgramme(edited, { activate: true });
    await repo.deleteProgramme(p.id);
    const stored = await db.sessions.get('past');
    expect(stored).toEqual(past);
    expect(exerciseHistory([stored!], 'smith-bench-press|per-side')).toHaveLength(1);
    setDb(null);
  });
});
