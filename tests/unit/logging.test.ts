import { describe, expect, it } from 'vitest';
import { parseLoad, parseMinutes, parsePositiveInt, parseRir } from '../../src/domain/logging';
import { formatLoad, loadStep, loadSuffix } from '../../src/domain/loads';

describe('Input validation', () => {
  it('distinguishes a blank optional load from a load of zero', () => {
    expect(parseLoad('')).toEqual({ ok: true, value: null });
    expect(parseLoad('   ')).toEqual({ ok: true, value: null });
    expect(parseLoad('0')).toEqual({ ok: true, value: 0 });
    expect(parseLoad('22.5')).toEqual({ ok: true, value: 22.5 });
    expect(parseLoad('22,5')).toEqual({ ok: true, value: 22.5 });
  });

  it.each(['-1', '-0.5', 'Infinity', '-Infinity', 'NaN', '1e400', 'ten', '5kg', '1001'])('rejects load %j', (v) => {
    expect(parseLoad(v).ok).toBe(false);
  });

  it.each([
    ['0', 'at least 1'],
    ['-3', 'whole number'],
    ['2.5', 'whole number'],
    ['', 'Enter reps'],
    ['Infinity', 'whole number'],
    ['1e3', 'whole number'],
    ['501', '500 or less'],
  ])('rejects reps %j', (v, msg) => {
    const r = parsePositiveInt(v, 500, 'reps');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain(msg);
  });

  it('parses RIR and minutes', () => {
    expect(parseRir('')).toEqual({ ok: true, value: null });
    expect(parseRir('2')).toEqual({ ok: true, value: 2 });
    expect(parseRir('11').ok).toBe(false);
    expect(parseMinutes('45')).toEqual({ ok: true, value: 45 });
    expect(parseMinutes('0').ok).toBe(false);
  });

  it('formats loads with an explicit interpretation', () => {
    expect(formatLoad(30, 'per-side', 'kg')).toBe('30 kg/side');
    expect(formatLoad(20, 'per-dumbbell', 'kg')).toBe('20 kg each');
    expect(formatLoad(null, 'bodyweight', 'kg')).toBe('BW');
    expect(formatLoad(10, 'bodyweight-plus', 'kg')).toBe('BW + 10 kg');
    expect(formatLoad(20, 'assisted', 'lb')).toBe('BW − 20 lb assist');
    expect(formatLoad(null, 'total', 'kg')).toBe('—');
    expect(loadSuffix('per-side', 'lb')).toBe('lb/side');
    expect(loadStep('per-side', 'kg')).toBe(1.25);
    expect(loadStep('total', 'kg')).toBe(2.5);
  });
});
