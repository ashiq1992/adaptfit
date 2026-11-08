import { describe, expect, it } from 'vitest';
import { EXERCISES_BY_ID } from '../../src/content/exercises';
import { estimatePlanSeconds, TRANSITION_SEC } from '../../src/domain/catalog';
import { applySwap, type Catalog, recommend, type RecommendContext, swapOptions } from '../../src/domain/recommend';
import type { CheckIn, EquipmentMode, Recommendation, WorkoutTemplate } from '../../src/domain/types';
import type { Emphasis, Plan } from '../../src/domain/types';
import { T0 } from '../fixtures/factories';

/** Minimal completed session for the recent-emphasis rule. */
function makeCompletedSession(opts: { plan?: Pick<Plan, 'emphasis'>; completedAt: Date }) {
  return { state: 'completed' as const, completedAt: opts.completedAt.toISOString(), emphasis: (opts.plan?.emphasis ?? 'full') as Emphasis };
}

function ctx(over: Partial<RecommendContext['checkIn']> = {}, profile: Partial<RecommendContext['profile']> = {}, extra: Partial<RecommendContext> = {}): RecommendContext {
  return {
    checkIn: { availableMinutes: 20, energy: 'medium', soreness: 'none', equipment: ['bodyweight'], safetyConcern: null, ...over },
    profile: { goal: 'general', experience: 'beginner', ...profile },
    sessions: [],
    now: T0,
    ...extra,
  };
}

function workout(rec: Recommendation) {
  if (rec.kind !== 'workout') throw new Error(`expected workout, got rest (${rec.cause})`);
  return rec;
}

const codes = (rec: Recommendation) => rec.reasons.map((r) => r.code);

describe('AF-02 time bands', () => {
  it('returns a rest / check-in-later state below 5 minutes', () => {
    const rec = recommend(ctx({ availableMinutes: 4 }));
    expect(rec.kind).toBe('rest');
    expect(rec.kind === 'rest' && rec.cause).toBe('time');
    expect(codes(rec)).toContain('too-little-time');
  });

  it.each([5, 14, 15, 29, 30, 60])('at %i minutes the plan estimate fits the available time', (minutes) => {
    for (const equipment of [['bodyweight'], ['bodyweight', 'dumbbells'], ['bodyweight', 'gym']] as EquipmentMode[][]) {
      const rec = workout(recommend(ctx({ availableMinutes: minutes, equipment })));
      expect(rec.plan.estimatedMinutes).toBeLessThanOrEqual(minutes);
      expect(rec.plan.estimatedMinutes).toBeGreaterThan(0);
    }
  });

  it('classifies boundary minutes into the right bands', () => {
    expect(recommend(ctx({ availableMinutes: 14 })).inputs.timeBand).toBe('5-14');
    expect(recommend(ctx({ availableMinutes: 15 })).inputs.timeBand).toBe('15-29');
    expect(recommend(ctx({ availableMinutes: 29 })).inputs.timeBand).toBe('15-29');
    expect(recommend(ctx({ availableMinutes: 30 })).inputs.timeBand).toBe('30-60');
    expect(recommend(ctx({ availableMinutes: 60 })).inputs.timeBand).toBe('30-60');
  });

  it('prefers a plan in the user band when one exists (30 → 30–60 band)', () => {
    const rec = workout(recommend(ctx({ availableMinutes: 30 })));
    expect(rec.plan.estimatedMinutes).toBeGreaterThanOrEqual(30);
    expect(codes(rec)).toContain('time-band');
  });

  it('falls back to a shorter band when nothing in the band fits', () => {
    const rec = workout(recommend(ctx({ availableMinutes: 15 })));
    expect(rec.plan.estimatedMinutes).toBeLessThanOrEqual(15);
    expect(codes(rec)).toContain('time-band-fallback');
  });

  it('estimates include warm-up, work, rest between sets, and transitions', () => {
    const items = [
      { exerciseId: 'bw-squat', mode: 'reps' as const, reps: 10, durationSec: null, sets: 3, restSec: 60 },
      { exerciseId: 'plank', mode: 'timed' as const, reps: null, durationSec: 30, sets: 2, restSec: 30 },
    ];
    const sec = estimatePlanSeconds(120, items, () => 3);
    // warm-up 120 + squat (3×30 + 2×60) + transition + plank (2×30 + 1×30)
    expect(sec).toBe(120 + (90 + 120) + TRANSITION_SEC + (60 + 30));
  });
});

describe('AF-02 readiness rules', () => {
  it('low energy selects a gentle, reduced-volume plan with an explanation', () => {
    const normal = workout(recommend(ctx({ availableMinutes: 20 })));
    const low = workout(recommend(ctx({ availableMinutes: 20, energy: 'low' })));
    expect(low.plan.intensity).toBe('gentle');
    expect(codes(low)).toEqual(expect.arrayContaining(['low-energy', 'reduced-volume']));
    expect(low.rationale).toMatch(/You have 20 minutes and low energy today, so this plan uses fewer sets/);
    const sets = (r: typeof normal) => r.plan.items.reduce((n, i) => n + i.sets, 0);
    expect(sets(low)).toBeLessThan(sets(normal));
  });

  it('high ordinary soreness selects a gentle option', () => {
    const rec = workout(recommend(ctx({ soreness: 'high' })));
    expect(rec.plan.intensity).toBe('gentle');
    expect(codes(rec)).toContain('high-soreness');
  });

  it('offers rest when no gentle option fits', () => {
    const catalog: Catalog = { exercises: EXERCISES_BY_ID, templates: [tpl({ id: 'only-moderate', intensity: 'moderate' })] };
    const rec = recommend(ctx({ energy: 'low' }, {}, { catalog }));
    expect(rec.kind).toBe('rest');
    expect(rec.kind === 'rest' && rec.cause).toBe('no-fit');
  });

  it('hard plans need high energy and intermediate+ experience', () => {
    const gym: Partial<CheckIn> = { availableMinutes: 45, equipment: ['bodyweight', 'gym'] };
    expect(workout(recommend(ctx(gym, { experience: 'beginner', goal: 'strength' }))).plan.intensity).not.toBe('hard');
    expect(workout(recommend(ctx({ ...gym, energy: 'medium' }, { experience: 'intermediate', goal: 'strength' }))).plan.intensity).not.toBe('hard');
    expect(workout(recommend(ctx({ ...gym, energy: 'high' }, { experience: 'intermediate', goal: 'strength' }))).plan.intensity).toBe('hard');
  });

  it('never increases intensity because of a missed day', () => {
    const old = makeCompletedSession({ completedAt: new Date(T0.getTime() - 10 * 24 * 3600_000) });
    const fresh = recommend(ctx({ availableMinutes: 30 }));
    const afterGap = recommend(ctx({ availableMinutes: 30 }, {}, { sessions: [old] }));
    expect(afterGap).toEqual(fresh);
  });
});

describe('AF-02 safety precedence', () => {
  it.each(['pain', 'illness', 'unsafe'] as const)('%s returns rest with no plan', (concern) => {
    const rec = recommend(ctx({ safetyConcern: concern, energy: 'high', availableMinutes: 45 }));
    expect(rec.kind).toBe('rest');
    expect(rec.kind === 'rest' && rec.cause).toBe('safety');
    expect('plan' in rec).toBe(false);
    expect(codes(rec)).toEqual(['safety-rest']);
  });

  it('safety takes precedence over the time rule', () => {
    const rec = recommend(ctx({ safetyConcern: 'pain', availableMinutes: 2 }));
    expect(rec.kind === 'rest' && rec.cause).toBe('safety');
  });

  it('ordinary soreness is not a safety flag', () => {
    expect(recommend(ctx({ soreness: 'high' })).kind).toBe('workout');
  });
});

describe('AF-02 equipment and experience', () => {
  it('never includes exercises that need unavailable equipment', () => {
    for (const minutes of [5, 10, 20, 30, 45, 60]) {
      const rec = workout(recommend(ctx({ availableMinutes: minutes, equipment: ['bodyweight'] })));
      expect(rec.plan.equipment).toEqual([]);
      const db = workout(recommend(ctx({ availableMinutes: minutes, equipment: ['bodyweight', 'dumbbells'] })));
      expect(db.plan.equipment.every((e) => e === 'dumbbells')).toBe(true);
    }
  });

  it('never includes exercises above the user experience level', () => {
    for (const minutes of [10, 20, 30, 45, 60]) {
      for (const equipment of [['bodyweight'], ['bodyweight', 'gym']] as EquipmentMode[][]) {
        const rec = workout(recommend(ctx({ availableMinutes: minutes, equipment, energy: 'high' })));
        for (const item of rec.plan.items) expect(EXERCISES_BY_ID.get(item.exerciseId)!.minExperience).toBe('beginner');
      }
    }
  });

  it('substitutes for partial equipment when only a richer template exists', () => {
    const catalog: Catalog = { exercises: EXERCISES_BY_ID, templates: [tpl({ id: 'gym-only', mode: 'gym', blocks: [{ exerciseId: 'leg-press', sets: 2, reps: 10, restSec: 30 }] })] };
    const rec = workout(recommend(ctx({ equipment: ['bodyweight', 'dumbbells'] }, {}, { catalog })));
    expect(rec.plan.items[0]!.exerciseId).toBe('goblet-squat');
    expect(rec.plan.items[0]!.substitutedFrom).toBe('leg-press');
    expect(codes(rec)).toContain('equipment-substitution');
  });

  it('falls back to bodyweight when no equipment plan fits', () => {
    const catalog: Catalog = {
      exercises: EXERCISES_BY_ID,
      templates: [
        tpl({ id: 'bw', mode: 'bodyweight' }),
        tpl({ id: 'db-long', mode: 'dumbbells', blocks: [{ exerciseId: 'goblet-squat', sets: 20, reps: 20, restSec: 120 }] }),
      ],
    };
    const rec = workout(recommend(ctx({ equipment: ['bodyweight', 'dumbbells'] }, {}, { catalog })));
    expect(rec.plan.templateId).toBe('bw');
    expect(codes(rec)).toContain('bodyweight-fallback');
  });

  it('excludes templates whose exercises cannot be substituted', () => {
    const catalog: Catalog = { exercises: EXERCISES_BY_ID, templates: [tpl({ id: 'rower', mode: 'gym', blocks: [{ exerciseId: 'missing-exercise', sets: 1, durationSec: 60, restSec: 0 }] })] };
    expect(recommend(ctx({}, {}, { catalog })).kind).toBe('rest');
  });
});

describe('AF-02 recent training', () => {
  const dumbbells: Partial<CheckIn> = { availableMinutes: 20, equipment: ['bodyweight', 'dumbbells'] };

  it('prefers a different emphasis when the same one was trained in the last 24 hours', () => {
    const base = workout(recommend(ctx(dumbbells)));
    expect(base.plan.emphasis).toBe('upper');
    const recent = makeCompletedSession({ plan: base.plan, completedAt: new Date(T0.getTime() - 3 * 3600_000) });
    const rec = workout(recommend(ctx(dumbbells, {}, { sessions: [recent] })));
    expect(rec.plan.emphasis).not.toBe('upper');
    expect(codes(rec)).toContain('recent-emphasis-avoided');
  });

  it('ignores sessions older than 24 hours', () => {
    const base = workout(recommend(ctx(dumbbells)));
    const old = makeCompletedSession({ plan: base.plan, completedAt: new Date(T0.getTime() - 25 * 3600_000) });
    expect(workout(recommend(ctx(dumbbells, {}, { sessions: [old] }))).plan.templateId).toBe(base.plan.templateId);
  });

  it('uses a gentle full-body option when no alternative emphasis fits', () => {
    const catalog: Catalog = {
      exercises: EXERCISES_BY_ID,
      templates: [tpl({ id: 'upper-a', emphasis: 'upper' }), tpl({ id: 'upper-b', emphasis: 'upper' }), tpl({ id: 'gentle-full', emphasis: 'full', intensity: 'gentle' })],
    };
    const prev = workout(recommend(ctx({}, {}, { catalog })));
    const recent = makeCompletedSession({ plan: prev.plan, completedAt: new Date(T0.getTime() - 3600_000) });
    const rec = workout(recommend(ctx({}, {}, { catalog, sessions: [recent] })));
    expect(rec.plan.templateId).toBe('gentle-full');
    expect(codes(rec)).toContain('recent-emphasis-gentle');
  });

  it('offers rest when no alternative and no gentle full-body option exists', () => {
    const catalog: Catalog = { exercises: EXERCISES_BY_ID, templates: [tpl({ id: 'upper-a', emphasis: 'upper' })] };
    const prev = workout(recommend(ctx({}, {}, { catalog })));
    const recent = makeCompletedSession({ plan: prev.plan, completedAt: new Date(T0.getTime() - 3600_000) });
    expect(recommend(ctx({}, {}, { catalog, sessions: [recent] })).kind).toBe('rest');
  });
});

describe('AF-02 goal ranking and determinism', () => {
  it('ranks by goal fit first', () => {
    const catalog: Catalog = {
      exercises: EXERCISES_BY_ID,
      templates: [tpl({ id: 'a-general', goalFit: { strength: 1, consistency: 1, general: 3 } }), tpl({ id: 'b-strength', goalFit: { strength: 3, consistency: 1, general: 1 } })],
    };
    expect(workout(recommend(ctx({}, { goal: 'strength' }, { catalog }))).plan.templateId).toBe('b-strength');
    expect(workout(recommend(ctx({}, { goal: 'general' }, { catalog }))).plan.templateId).toBe('a-general');
  });

  it('breaks exact ties by stable template ID', () => {
    const catalog: Catalog = { exercises: EXERCISES_BY_ID, templates: [tpl({ id: 'zeta' }), tpl({ id: 'alpha' }), tpl({ id: 'mid' })] };
    expect(workout(recommend(ctx({}, {}, { catalog }))).plan.templateId).toBe('alpha');
  });

  it('same inputs, history, and clock produce the same result', () => {
    const history = [makeCompletedSession({ completedAt: new Date(T0.getTime() - 3600_000) })];
    const a = recommend(ctx({ availableMinutes: 25, equipment: ['bodyweight', 'gym'] }, {}, { sessions: history }));
    const b = recommend(ctx({ availableMinutes: 25, equipment: ['bodyweight', 'gym'] }, {}, { sessions: [...history] }));
    expect(b).toEqual(a);
  });
});

describe('AF-09 substitutions', () => {
  it('offers only substitutions that respect equipment, experience, and time', () => {
    const rec = workout(recommend(ctx({ availableMinutes: 20, equipment: ['bodyweight'] })));
    const swapCtx = { equipment: ['bodyweight'] as EquipmentMode[], experience: 'beginner' as const, availableMinutes: 20 };
    for (const item of rec.plan.items) {
      for (const opt of swapOptions(rec.plan, item.key, swapCtx)) {
        const ex = EXERCISES_BY_ID.get(opt.exerciseId)!;
        expect(ex.equipment).toEqual([]);
        expect(ex.minExperience).toBe('beginner');
        expect(opt.estimatedMinutes).toBeLessThanOrEqual(20);
      }
    }
  });

  it('recalculates duration after a swap and records the original', () => {
    const rec = workout(recommend(ctx({ availableMinutes: 20, equipment: ['bodyweight', 'dumbbells'] })));
    const item = rec.plan.items[0]!;
    const options = swapOptions(rec.plan, item.key, { equipment: ['bodyweight', 'dumbbells'], experience: 'beginner', availableMinutes: 60 });
    expect(options.length).toBeGreaterThan(0);
    const next = applySwap(rec.plan, item.key, options[0]!.exerciseId)!;
    expect(next.items[0]!.exerciseId).toBe(options[0]!.exerciseId);
    expect(next.items[0]!.substitutedFrom).toBe(item.exerciseId);
    expect(next.estimatedMinutes).toBe(options[0]!.estimatedMinutes);
    // Swapping back clears the substitution marker.
    const back = applySwap(next, item.key, item.exerciseId)!;
    expect(back.items[0]!.substitutedFrom).toBeNull();
  });

  it('rejects substitutions that need unavailable equipment', () => {
    const rec = workout(recommend(ctx({ availableMinutes: 20, equipment: ['bodyweight'] })));
    const pushup = rec.plan.items.find((i) => i.exerciseId === 'bw-pushup' || i.exerciseId === 'bw-squat')!;
    const opts = swapOptions(rec.plan, pushup.key, { equipment: ['bodyweight'], experience: 'beginner', availableMinutes: 20 }).map((o) => o.exerciseId);
    expect(opts).not.toContain('db-floor-press');
    expect(opts).not.toContain('goblet-squat');
  });
});

function tpl(over: Partial<WorkoutTemplate> & { id: string }): WorkoutTemplate {
  return {
    name: over.id,
    mode: 'bodyweight',
    emphasis: 'full',
    intensity: 'moderate',
    minExperience: 'beginner',
    goalFit: { strength: 2, consistency: 2, general: 2 },
    warmupSec: 60,
    optionalEquipment: [],
    blocks: [{ exerciseId: 'bw-squat', sets: 2, reps: 10, restSec: 30 }],
    ...over,
  };
}
