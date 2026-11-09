/**
 * V0.4 weekly update, performance analysis and coaching rules (SYNTHETIC data only).
 * Test IDs refer to Sprint4.MD §20.
 */
import { describe, expect, it } from 'vitest';
import * as repo from '../../src/data/repo';
import { addDays } from '../../src/domain/dates';
import { describeChange, exerciseStatus, milestones, reviewWeek } from '../../src/domain/performance';
import { exerciseHistory } from '../../src/domain/progression';
import type { Programme, TrainingWeek, WorkoutSession } from '../../src/domain/types';
import {
  buildWeekDraft,
  confirmWeekRecord,
  dedupeSessions,
  editExercise,
  markRemaining,
  noteLoadUpdates,
  sessionsFromWeek,
  setSessionDate,
  setSessionStatus,
  weekIssues,
} from '../../src/domain/weekly';
import { completedSession, makeCheckIn, newIdFn, sessionExercise, twoDayProgramme, useFreshDb } from '../fixtures/factories';

const NOW = new Date('2026-11-12T10:00:00Z');
const W1 = '2026-11-02';
const W2 = '2026-11-09';

/** Two-day programme whose day names carry weekdays, with planned loads. */
function programme(): Programme {
  const p = twoDayProgramme();
  p.daysPerWeek = 2;
  p.days[0]!.name = 'Tuesday — Upper body';
  p.days[1]!.name = 'Saturday — Lower body';
  for (const d of p.days) for (const e of d.exercises) if (e.loadType !== 'bodyweight' && e.loadType !== 'timed') e.plannedLoad = { value: 30, unit: 'kg' };
  return p;
}

function draft(p: Programme, weekStart: string, prev: TrainingWeek | null, sessions: WorkoutSession[] = [], copy = true) {
  return buildWeekDraft({ weekStart, programme: p, previousWeek: prev, sessions, now: NOW, unit: 'kg', copy });
}

/** Confirm a week the way the app does (pure), returning the week and generated sessions. */
function confirm(week: TrainingWeek, p: Programme, existing: WorkoutSession[] = []) {
  const { upserts, removeIds } = sessionsFromWeek(week, p, newIdFn, NOW);
  const confirmed = confirmWeekRecord(week, upserts, NOW);
  const sessions = [...existing.filter((s) => !upserts.some((u) => u.id === s.id) && !removeIds.includes(s.id)), ...upserts];
  return { week: confirmed, sessions, upserts, removeIds };
}

function doneWeek(p: Programme, weekStart: string, prev: TrainingWeek | null, sessions: WorkoutSession[] = []) {
  let w = draft(p, weekStart, prev, sessions);
  w = markRemaining(w, 'completed', NOW);
  return confirm(w, p, sessions);
}

describe('Weekly update', () => {
  it('T09 the previous week can be copied into a draft', () => {
    const p = programme();
    const first = doneWeek(p, W1, null);
    const d = draft(p, W2, first.week, first.sessions);
    const row = d.sessions[0]!.exercises[0]!;
    expect(row.source).toBe('copied');
    expect(row.previous?.weekStart).toBe(W1);
    expect(row.sets).toEqual(first.week.sessions[0]!.exercises[0]!.sets);
    expect(d.copiedFrom).toBe(W1);
  });

  it('T10 copied values stay unconfirmed until explicitly confirmed', () => {
    const p = programme();
    const first = doneWeek(p, W1, null);
    const d = draft(p, W2, first.week, first.sessions);
    expect(d.status).toBe('draft');
    expect(d.sessions.every((r) => r.status === 'not-recorded')).toBe(true);
    // Nothing is written for an untouched copied draft.
    expect(sessionsFromWeek(d, p, newIdFn, NOW).upserts).toEqual([]);
  });

  it('T11 unchanged completed performance is recorded as performance', () => {
    const p = programme();
    const first = doneWeek(p, W1, null);
    let d = draft(p, W2, first.week, first.sessions);
    d = setSessionStatus(d, d.sessions[0]!.id, 'completed', NOW);
    const { upserts } = sessionsFromWeek(d, p, newIdFn, NOW);
    expect(upserts).toHaveLength(1);
    const ex = upserts[0]!.exercises[0]!;
    expect(ex.sets.map((s) => [s.load, s.reps, s.completed])).toEqual(first.upserts[0]!.exercises[0]!.sets.map((s) => [s.load, s.reps, true]));
    expect(ex.sets[0]!.prefill).toBe('previous');
    expect(upserts[0]!.completedLocalDate).toBe('2026-11-10'); // Tuesday of that week, from the day name
  });

  it('T12 skipped sessions do not become completed', () => {
    const p = programme();
    let d = draft(p, W1, null);
    d = setSessionStatus(d, d.sessions[0]!.id, 'skipped', NOW);
    d = setSessionStatus(d, d.sessions[1]!.id, 'completed', NOW);
    const { upserts } = sessionsFromWeek(d, p, newIdFn, NOW);
    expect(upserts.map((s) => s.dayId)).toEqual([p.days[1]!.id]);
  });

  it('T13 not-recorded sessions do not become completed, and blank rows are never assumed', () => {
    const p = programme();
    let d = draft(p, W1, null, [], false);
    expect(sessionsFromWeek(d, p, newIdFn, NOW).upserts).toEqual([]);
    // A blank row in a completed session is not recorded as "unchanged".
    d = editExercise(d, d.sessions[0]!.id, 1, '', NOW);
    d = setSessionStatus(d, d.sessions[0]!.id, 'completed', NOW);
    const s = sessionsFromWeek(d, p, newIdFn, NOW).upserts[0]!;
    expect(s.exercises.find((e) => e.name === d.sessions[0]!.exercises[1]!.name)).toBeUndefined();
  });

  it('T14 several exercise values can be edited in one draft, and changes are tracked', () => {
    const p = programme();
    const first = doneWeek(p, W1, null);
    let d = draft(p, W2, first.week, first.sessions);
    const sid = d.sessions[0]!.id;
    d = editExercise(d, sid, 0, '30 kg/side × 9, 8, 8', NOW);
    d = editExercise(d, sid, 1, '32.5 × 8, 8, 8', NOW);
    expect(d.sessions[0]!.exercises[0]!.sets.map((s) => s.reps)).toEqual([9, 8, 8]);
    expect(d.sessions[0]!.exercises[1]!.sets.map((s) => s.load)).toEqual([32.5, 32.5, 32.5]);
    expect(d.sessions[0]!.exercises.slice(0, 2).every((e) => e.source === 'edited')).toBe(true);
  });

  it('T15 confirmation saves the actual dates, and blocks dates outside the week', () => {
    const p = programme();
    let d = draft(p, W1, null);
    d = setSessionStatus(d, d.sessions[0]!.id, 'completed', NOW);
    d = setSessionDate(d, d.sessions[0]!.id, '2026-11-04', NOW);
    expect(sessionsFromWeek(d, p, newIdFn, NOW).upserts[0]!.completedLocalDate).toBe('2026-11-04');
    d = setSessionDate(d, d.sessions[0]!.id, '2026-11-20', NOW);
    expect(weekIssues(d).map((i) => i.message).join(' ')).toMatch(/must be in this week/);
    d = setSessionDate(d, d.sessions[0]!.id, null, NOW);
    expect(weekIssues(d).map((i) => i.message).join(' ')).toMatch(/choose the day/);
  });

  it('T16/T17 earlier weeks stay unchanged and one record per week prevents duplicates (database)', async () => {
    useFreshDb();
    const p = programme();
    await repo.saveProgramme(p);
    const first = doneWeek(p, W1, null);
    await repo.confirmWeek(first.week, first.upserts, first.removeIds, null);
    const snapshot = structuredClone(await repo.getTrainingWeek(W1));
    const second = doneWeek(p, W2, first.week, first.sessions);
    await repo.confirmWeek(second.week, second.upserts, second.removeIds, null);
    expect(await repo.getTrainingWeek(W1)).toEqual(snapshot);
    // Confirming the same week again updates it in place: no duplicate sessions.
    const again = confirm(second.week, p, second.sessions);
    await repo.confirmWeek(again.week, again.upserts, again.removeIds, null);
    const all = (await repo.listAllSessions()).filter((s) => s.completedLocalDate! >= W2);
    expect(all).toHaveLength(2);
    expect((await repo.getTrainingWeek(W2))!.revision).toBe(2);
    expect((await repo.getTrainingWeek(W2))!.history).toHaveLength(1);
  });

  it('T18 editing a confirmed week recalculates analytics', () => {
    const p = programme();
    const first = doneWeek(p, W1, null);
    let second = doneWeek(p, W2, first.week, first.sessions);
    const key = `${p.days[0]!.exercises[0]!.exerciseId}|${p.days[0]!.exercises[0]!.loadType}`;
    expect(exerciseHistory(second.sessions, key).at(-1)!.summary.repsAtTop).toBe(first.week.sessions[0]!.exercises[0]!.sets[0]!.reps);
    let edit = editExercise(second.week, second.week.sessions[0]!.id, 0, '30 kg/side × 12, 12, 12', NOW);
    second = confirm(edit, p, second.sessions);
    expect(exerciseHistory(second.sessions, key).at(-1)!.summary.repsAtTop).toBe(12);
    // Changing the session to skipped removes its record.
    edit = setSessionStatus(second.week, second.week.sessions[0]!.id, 'skipped', NOW);
    const third = confirm(edit, p, second.sessions);
    expect(third.removeIds).toHaveLength(1);
    expect(exerciseHistory(third.sessions, key).every((pt) => pt.localDate < W2)).toBe(true);
  });

  it('copying never fabricates values: the first week starts from the plan, else blank', () => {
    const p = programme();
    const d = draft(p, W1, null);
    expect(d.sessions[0]!.exercises[0]!.source).toBe('planned');
    const noPlan = { ...p, days: p.days.map((day) => ({ ...day, exercises: day.exercises.map((e) => ({ ...e, plannedLoad: null })) })) };
    const blank = draft(noPlan, W1, null);
    const loaded = blank.sessions[0]!.exercises.filter((e) => e.loadType !== 'bodyweight' && e.loadType !== 'timed');
    expect(loaded.every((e) => e.source === 'blank' && e.sets.length === 0)).toBe(true);
  });

  it('a live-logged session is used as-is and never duplicated', () => {
    const p = programme();
    const live = completedSession({ id: 'live-1', date: '2026-11-03', programmeId: p.id, dayId: p.days[0]!.id, exercises: [sessionExercise({ exerciseId: p.days[0]!.exercises[0]!.exerciseId, loadType: p.days[0]!.exercises[0]!.loadType, sets: [{ load: 30, reps: 9 }] })] });
    const d = draft(p, W1, null, [live]);
    expect(d.sessions[0]!.live).toBe(true);
    expect(d.sessions[0]!.sessionId).toBe('live-1');
    const done = markRemaining(d, 'completed', NOW);
    const { upserts } = sessionsFromWeek(done, p, newIdFn, NOW);
    expect(upserts.map((s) => s.dayId)).toEqual([p.days[1]!.id]);
    // If a weekly record and a live log exist for the same day and week, analysis counts one.
    const weeklyDup = { ...upserts[0]!, id: 'weekly-dup', dayId: p.days[0]!.id };
    expect(dedupeSessions([live, weeklyDup]).map((s) => s.id)).toEqual(['live-1']);
  });

  it('offers to update note weights from a confirmed week, without applying them itself', () => {
    const p = programme();
    let d = draft(p, W1, null);
    d = editExercise(d, d.sessions[0]!.id, 0, '32.5 kg/side × 8, 8, 8', NOW);
    d = setSessionStatus(d, d.sessions[0]!.id, 'completed', NOW);
    const ups = noteLoadUpdates(d, p);
    expect(ups).toEqual([expect.objectContaining({ from: 30, to: 32.5 })]);
    expect(p.days[0]!.exercises[0]!.plannedLoad!.value).toBe(30);
  });
});

// ── Performance analysis ───────────────────────────────────────────

const bench = (date: string, reps: number[], load = 30, loadType: 'per-side' | 'per-dumbbell' = 'per-side', exerciseId = 'smith-bench-press') =>
  completedSession({ date, exercises: [sessionExercise({ exerciseId, loadType, sets: reps.map((r) => ({ load, reps: r })) })] });
const KEY = 'smith-bench-press|per-side';
const ctx = { checkIns: [], profile: null };

describe('Performance analysis', () => {
  it('T29 increased repetitions are identified with a specific explanation', () => {
    const a = bench('2026-11-03', [8, 8, 8]);
    const b = bench('2026-11-10', [9, 8, 8]);
    expect(describeChange(a.exercises[0]!, b.exercises[0]!)).toBe('1 more rep in the first set at the same recorded load (30 kg/side).');
    expect(exerciseStatus([a, b], KEY, 'Bench', '2026-11-12', ctx).status).toBe('improving');
    // 9,8,8 → 9,9,8 is progress too (not "stable").
    const c = bench('2026-11-17', [9, 9, 8]);
    expect(exerciseStatus([a, b, c], KEY, 'Bench', '2026-11-18', ctx).status).toBe('improving');
  });

  it('T30 increased loads are identified', () => {
    const s = exerciseStatus([bench('2026-11-03', [8, 8, 8]), bench('2026-11-10', [8, 8, 8], 32.5)], KEY, 'Bench', '2026-11-12', ctx);
    expect(s.status).toBe('improving');
    expect(s.reason).toMatch(/\+2\.5 kg\/side/);
  });

  it('T31 stable performance is identified (and one lower session is not a decline)', () => {
    const same = exerciseStatus([bench('2026-11-03', [8, 8, 8]), bench('2026-11-10', [8, 8, 8])], KEY, 'Bench', '2026-11-12', ctx);
    expect(same.status).toBe('stable');
    const oneBad = exerciseStatus([bench('2026-10-27', [8, 8, 8]), bench('2026-11-03', [8, 8, 8]), bench('2026-11-10', [7, 7, 6])], KEY, 'Bench', '2026-11-12', ctx);
    expect(oneBad.status).toBe('stable');
    expect(oneBad.reason).toMatch(/One session isn't a trend/);
    const twoBad = exerciseStatus([bench('2026-10-27', [8, 8, 8]), bench('2026-11-03', [7, 7, 7]), bench('2026-11-10', [7, 7, 6])], KEY, 'Bench', '2026-11-12', ctx);
    expect(twoBad.status).toBe('possible-decline');
  });

  it('T32 missing records do not create false progression', () => {
    expect(exerciseStatus([bench('2026-11-10', [9, 9, 9])], KEY, 'Bench', '2026-11-12', ctx).status).toBe('insufficient-data');
    const noLoad = completedSession({ date: '2026-11-10', exercises: [sessionExercise({ exerciseId: 'smith-bench-press', loadType: 'per-side', sets: [{ load: null, reps: 12 }] })] });
    const s = exerciseStatus([bench('2026-11-03', [8, 8, 8]), noLoad], KEY, 'Bench', '2026-11-12', ctx);
    expect(s.status).not.toBe('improving');
  });

  it('T33/T34 incompatible variations and loading conventions are never compared', () => {
    const smith = bench('2026-11-03', [8, 8, 8], 30);
    const dbBench = bench('2026-11-10', [12, 12, 12], 30, 'per-dumbbell', 'db-bench-press');
    expect(describeChange(smith.exercises[0]!, dbBench.exercises[0]!)).toBeNull();
    expect(exerciseStatus([smith, dbBench], KEY, 'Bench', '2026-11-12', ctx).status).toBe('insufficient-data');
    // Same exercise, different convention (per side vs total): separate histories.
    const total = completedSession({ date: '2026-11-10', exercises: [sessionExercise({ exerciseId: 'smith-bench-press', loadType: 'total', sets: [{ load: 80, reps: 8 }] })] });
    expect(exerciseHistory([smith, total], KEY)).toHaveLength(1);
  });

  it('T36 historical corrections update trends', () => {
    const a = bench('2026-11-03', [8, 8, 8]);
    const b = bench('2026-11-10', [9, 8, 8]);
    expect(exerciseStatus([a, b], KEY, 'Bench', '2026-11-12', ctx).status).toBe('improving');
    const corrected = { ...b, exercises: [{ ...b.exercises[0]!, sets: b.exercises[0]!.sets.map((s) => ({ ...s, reps: 8 })) }] };
    expect(exerciseStatus([a, corrected], KEY, 'Bench', '2026-11-12', ctx).status).toBe('stable');
  });
});

describe('Weekly review and coaching', () => {
  it('T37/T43 the review uses confirmed records and its numbers match them', () => {
    const p = programme();
    let w1 = editExercise(draft(p, W1, null), p.days[0]!.id, 0, '30 kg/side × 8, 8, 8', NOW);
    w1 = markRemaining(w1, 'completed', NOW);
    const first = confirm(w1, p);
    let d = draft(p, W2, first.week, first.sessions);
    d = editExercise(d, d.sessions[0]!.id, 0, '30 kg/side × 9, 8, 8', NOW);
    d = setSessionStatus(d, d.sessions[0]!.id, 'completed', NOW);
    d = setSessionStatus(d, d.sessions[1]!.id, 'skipped', NOW);
    const second = confirm(d, p, first.sessions);
    const r = reviewWeek({ week: second.week, sessions: second.sessions });
    expect(r.planned).toBe(2);
    expect(r.completed).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.summary.join(' ')).toMatch(/You completed 1 of 2 planned sessions/);
    const line = r.lines.find((l) => l.name === p.days[0]!.exercises[0]!.name)!;
    expect(line.kind).toBe('reps-up');
    expect(line.detail).toBe('1 more rep in the first set at the same recorded load (30 kg/side).');
    // T42 a missed session: continue before changing anything.
    expect(r.summary.join(' ')).toMatch(/continue the programme before considering a change/);
    expect(r.adjustmentJustified).toBe(false);
  });

  it('T38 insufficient data produces an honest message', () => {
    const p = programme();
    const d = setSessionStatus(draft(p, W1, null), p.days[0]!.id, 'skipped', NOW);
    const r = reviewWeek({ week: confirm(d, p).week, sessions: [] });
    expect(r.summary[0]).toMatch(/No sessions were completed/);
    expect(r.improved).toEqual([]);
  });

  it('T39 one bad session does not indicate a plateau; T40 sustained stagnation raises questions', async () => {
    const { assessExercise } = await import('../../src/domain/plateau');
    const oneBad = [bench('2026-10-20', [8, 8, 8]), bench('2026-10-27', [9, 8, 8]), bench('2026-11-03', [9, 9, 8]), bench('2026-11-10', [6, 6, 6])];
    expect(assessExercise(oneBad, KEY, 'Bench', '2026-11-12', ctx).status).not.toBe('possible-plateau');
    const stuck = [0, 1, 2, 3, 4].map((i) => bench(addDays('2026-10-13', i * 7), [8, 8, 8]));
    const f = assessExercise(stuck, KEY, 'Bench', '2026-11-12', { checkIns: [makeCheckIn({ localDate: '2026-11-10', sleepHours: 5 })], profile: null });
    expect(f.status).toBe('possible-plateau');
    expect(f.questions.length).toBeGreaterThan(0);
    expect(f.questions.length).toBeLessThanOrEqual(2);
  });

  it('milestones are real training events only', () => {
    const p = programme();
    const sessions = [bench('2026-11-03', [8, 8, 8]), bench('2026-11-10', [8, 8, 8], 32.5)];
    const m = milestones({ sessions, weeks: [], programme: p, bodyweights: [], profile: { goal: 'hypertrophy', weightUnit: 'kg' }, today: '2026-11-12' });
    expect(m.map((x) => x.kind)).toEqual(['pr']);
    expect(m[0]!.detail).toBe('32.5 kg/side × 8');
    expect(milestones({ sessions: [], weeks: [], programme: p, bodyweights: [], profile: { goal: 'general', weightUnit: 'kg' }, today: '2026-11-12' })).toEqual([]);
  });
});
