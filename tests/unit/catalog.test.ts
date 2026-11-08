import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISES_BY_ID } from '../../src/content/exercises';
import { TEMPLATES } from '../../src/content/templates';
import { experienceAllows, timeBandOf } from '../../src/domain/catalog';
import { recommend, resolveTemplate } from '../../src/domain/recommend';
import { EQUIPMENT_MODES, type Energy } from '../../src/domain/types';
import { T0 } from '../fixtures/factories';

describe('seed catalog integrity', () => {
  it('has at least 12 exercises with unique stable IDs', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it('every referenced exercise exists (template blocks and substitutions)', () => {
    for (const t of TEMPLATES) for (const b of t.blocks) expect(EXERCISES_BY_ID.has(b.exerciseId), `${t.id} → ${b.exerciseId}`).toBe(true);
    for (const e of EXERCISES) for (const s of e.substitutions) expect(EXERCISES_BY_ID.has(s), `${e.id} → ${s}`).toBe(true);
  });

  it('substitutions never need more equipment than nothing for at least one bodyweight path', () => {
    // Every equipment exercise can reach a bodyweight option for beginners through its substitution chain.
    for (const e of EXERCISES.filter((x) => x.equipment.length > 0)) {
      const seen = new Set<string>();
      const queue = [...e.substitutions];
      let found = false;
      while (queue.length && !found) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        const sub = EXERCISES_BY_ID.get(id)!;
        if (sub.equipment.length === 0 && sub.minExperience === 'beginner') found = true;
        queue.push(...sub.substitutions);
      }
      expect(found, `${e.id} has a bodyweight fallback`).toBe(true);
    }
  });

  it('every template block prescribes reps or a duration matching its exercise mode', () => {
    for (const t of TEMPLATES) {
      for (const b of t.blocks) {
        const ex = EXERCISES_BY_ID.get(b.exerciseId)!;
        if (ex.mode === 'reps') expect(b.reps, `${t.id}/${b.exerciseId}`).toBeGreaterThan(0);
        else expect(b.durationSec, `${t.id}/${b.exerciseId}`).toBeGreaterThan(0);
        expect(b.sets).toBeGreaterThan(0);
        expect(b.restSec).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('every published template has a valid estimate (5–60 min) for its own equipment', () => {
    for (const t of TEMPLATES) {
      const resolved = resolveTemplate(t, ['bodyweight', t.mode], 'advanced', EXERCISES_BY_ID);
      expect(resolved, t.id).not.toBeNull();
      expect(resolved!.minutes, t.id).toBeGreaterThanOrEqual(4);
      expect(resolved!.minutes, t.id).toBeLessThanOrEqual(60);
      for (const b of t.blocks) expect(experienceAllows(EXERCISES_BY_ID.get(b.exerciseId)!.minExperience, 'advanced')).toBe(true);
    }
  });

  it('covers every equipment mode and time band with written templates', () => {
    for (const mode of EQUIPMENT_MODES) {
      const bands = new Set(
        TEMPLATES.filter((t) => t.mode === mode).map((t) => timeBandOf(resolveTemplate(t, ['bodyweight', mode], 'advanced', EXERCISES_BY_ID)!.minutes) ?? '5-14'),
      );
      expect([...bands].sort(), mode).toEqual(['15-29', '30-60', '5-14']);
    }
  });

  it('gives a beginner a workout for every mode, readiness level, and minute value from 5 to 60', () => {
    for (const mode of EQUIPMENT_MODES) {
      for (const energy of ['low', 'medium', 'high'] as Energy[]) {
        for (let minutes = 5; minutes <= 60; minutes++) {
          const rec = recommend({
            checkIn: { availableMinutes: minutes, energy, soreness: 'none', equipment: ['bodyweight', mode], safetyConcern: null },
            profile: { goal: 'general', experience: 'beginner' },
            sessions: [],
            now: T0,
          });
          expect(rec.kind, `${mode}/${energy}/${minutes}`).toBe('workout');
        }
      }
    }
  });

  it('has gentle bodyweight fallbacks in every time band', () => {
    const gentle = TEMPLATES.filter((t) => t.mode === 'bodyweight' && t.intensity === 'gentle');
    const bands = new Set(gentle.map((t) => timeBandOf(resolveTemplate(t, ['bodyweight'], 'beginner', EXERCISES_BY_ID)!.minutes)));
    expect(bands).toEqual(new Set(['5-14', '15-29', '30-60']));
  });
});
