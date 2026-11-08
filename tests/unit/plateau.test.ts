import { describe, expect, it } from 'vitest';
import { answerQuestion, applyChange, decide, newPlateauRecommendation, recommendForPlateau } from '../../src/domain/coach';
import { comparableKey } from '../../src/domain/loads';
import { assessExercise, detectPlateaus } from '../../src/domain/plateau';
import { addDays } from '../../src/domain/dates';
import { bench, completedSession, fourDayProgramme, improvingBench, makeCheckIn, makeProfile, reducedSleepCheckIns, stableBench, T0, TODAY } from '../fixtures/factories';

const BENCH = comparableKey('smith-bench-press', 'per-side');
const ctx = { checkIns: [], profile: makeProfile() };

describe('Plateau detection', () => {
  it('T18 sustained comparable stagnation may trigger a check-in', () => {
    const f = assessExercise(stableBench(4), BENCH, 'Smith bench', TODAY, ctx);
    expect(f.status).toBe('possible-plateau');
    expect(f.evidence[0]).toMatch(/4 comparable sessions/);
    expect(f.evidence[1]).toContain('30 kg/side × 8');
    expect(f.questions.length).toBeGreaterThan(0);
    expect(f.questions.length).toBeLessThanOrEqual(2);
  });

  it('T19 one bad workout does not trigger a plateau', () => {
    const sessions = improvingBench(4);
    // Make only the last session worse.
    const bad = completedSession({ date: addDays(TODAY, 0), exercises: [bench([{ load: 30, reps: 5 }])] });
    const withDip = [...sessions.slice(0, 3), bad];
    expect(assessExercise(withDip, BENCH, 'Smith bench', TODAY, ctx).status).toBe('progressing');
    // Too few sessions → insufficient, never a plateau.
    expect(assessExercise(stableBench(3), BENCH, 'Smith bench', TODAY, ctx).status).toBe('insufficient-data');
    // Four sessions in a few days is too short a span to judge.
    expect(assessExercise(stableBench(4, TODAY, 2), BENCH, 'Smith bench', TODAY, ctx).status).toBe('insufficient-data');
  });

  it('T20 missing RIR is handled honestly', () => {
    const f = assessExercise(stableBench(4, TODAY, 5), BENCH, 'Smith bench', TODAY, ctx);
    expect(f.missingData).toContain('Effort (RIR) was not recorded for these sessions.');
    expect(f.questions.map((q) => q.id)).toContain('harder');
    const withRir = stableBench(4, TODAY, 5).map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, rir: 2 })) })) }));
    expect(assessExercise(withRir, BENCH, 'Smith bench', TODAY, ctx).missingData).not.toContain('Effort (RIR) was not recorded for these sessions.');
    // No nutrition or sleep data → listed as missing, not assumed.
    expect(f.missingData).toEqual(expect.arrayContaining(['No recent sleep information.', 'No nutrition preferences recorded.']));
  });

  it('T21 training interruption is considered', () => {
    const sessions = [...stableBench(3, addDays(TODAY, -20)), ...stableBench(1, TODAY)]; // 20-day gap inside the window
    const f = assessExercise(sessions, BENCH, 'Smith bench', TODAY, ctx);
    expect(f.status).toBe('interrupted');
    // A long time since the last session is also an interruption.
    expect(assessExercise(stableBench(4, addDays(TODAY, -20)), BENCH, 'Smith bench', TODAY, ctx).status).toBe('interrupted');
    // Low weekly frequency prompts the "missed sessions" question.
    expect(assessExercise(stableBench(4, TODAY, 12), BENCH, 'Smith bench', TODAY, ctx).questions[0]!.id).toBe('missed');
  });

  it('T22 recommendations never modify programmes automatically', () => {
    const programme = fourDayProgramme();
    const snapshot = structuredClone(programme);
    const f = assessExercise(stableBench(4), BENCH, 'Smith bench', TODAY, { checkIns: reducedSleepCheckIns(), profile: makeProfile() });
    const rec = newPlateauRecommendation({ id: 'r1', now: T0, today: TODAY, finding: f, programme, recentPainReports: 0 });
    const answered = answerQuestion(answerQuestion(rec, 'sleep', 'no', programme, 0), 'harder', 'no', programme, 0);
    expect(answered.type).toBe('small-progression');
    expect(answered.proposedChange).toMatchObject({ type: 'rep-range', from: [6, 10], to: [6, 12] });
    expect(programme).toEqual(snapshot); // proposing changed nothing
    const rejected = decide(answered, 'rejected', T0, TODAY);
    expect(rejected.appliedChange).toBeNull();
    const accepted = decide(answered, 'accepted', T0, TODAY);
    const changed = applyChange(programme, accepted.appliedChange!, T0);
    expect(changed.days[0]!.exercises[0]!).toMatchObject({ repMin: 6, repMax: 12 });
    expect(programme).toEqual(snapshot); // pure
  });

  it('recommendations follow the answers and have explanations', () => {
    const f = { ...assessExercise(stableBench(4), BENCH, 'Smith bench', TODAY, ctx) };
    const q = (id: 'sleep' | 'missed' | 'harder', answer: 'yes' | 'no') => [{ id, text: '', answer }];
    expect(recommendForPlateau(f, q('missed', 'yes'), null, 0).type).toBe('check-consistency');
    expect(recommendForPlateau(f, q('sleep', 'yes'), null, 0).type).toBe('review-recovery');
    expect(recommendForPlateau(f, q('harder', 'yes'), fourDayProgramme(), 0).type).toBe('planned-reduction');
    expect(recommendForPlateau(f, [], null, 0)).toMatchObject({ type: 'continue', explanation: expect.stringContaining('Possible plateau — additional context needed') });
    expect(recommendForPlateau(f, [], null, 2).type).toBe('seek-advice');
    for (const t of ['missed', 'sleep', 'harder'] as const) expect(recommendForPlateau(f, q(t, 'yes'), null, 0).explanation.length).toBeGreaterThan(20);
  });

  it('detectPlateaus orders priority exercises first and reports insufficient data', () => {
    const findings = detectPlateaus([...stableBench(4), completedSession({ date: TODAY, exercises: [bench([{ load: 30, reps: 8 }])].map((e) => ({ ...e, exerciseId: 'lat-pulldown', name: 'Lat pulldown', loadType: 'total' as const })) })], TODAY, { checkIns: [makeCheckIn()], profile: null, priorityKeys: new Set([comparableKey('lat-pulldown', 'total')]) });
    expect(findings[0]!.name).toBe('Lat pulldown');
    expect(findings[0]!.status).toBe('insufficient-data');
    expect(findings[1]!.status).toBe('possible-plateau');
  });
});
