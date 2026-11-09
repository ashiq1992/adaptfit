import { describe, expect, it } from 'vitest';
import { formatBytes, formatWhen, summariseDevice, summariseUserAgent, type DiagnosticsInput } from '../../src/features/admin/diagnostics';

const empty: DiagnosticsInput = { profiles: [], programmes: [], trainingWeeks: [], sessions: [], imports: [], bodyweights: [], noteRevisions: [] };

describe('summariseDevice', () => {
  it('returns zero counts and no dates for an empty device', () => {
    const s = summariseDevice(empty);
    expect(Object.values(s.counts).every((n) => n === 0)).toBe(true);
    expect(s.firstUse).toBeNull();
    expect(s.lastActivity).toBeNull();
  });

  it('counts each record type and splits weekly records by status', () => {
    const s = summariseDevice({
      ...empty,
      profiles: [{ createdAt: '2026-01-01T00:00:00.000Z' }],
      programmes: [{}, {}],
      trainingWeeks: [{ status: 'confirmed' }, { status: 'confirmed' }, { status: 'draft' }],
      sessions: [{}, {}, {}, {}],
      imports: [{}],
      bodyweights: [{}, {}],
      noteRevisions: [{}, {}, {}],
    });
    expect(s.counts).toEqual({ profiles: 1, programmes: 2, weeksConfirmed: 2, weeksDraft: 1, sessions: 4, imports: 1, bodyweights: 2, noteRevisions: 3 });
  });

  it('derives first use and last activity across all tables, ignoring missing or invalid dates', () => {
    const s = summariseDevice({
      ...empty,
      profiles: [{ createdAt: '2026-03-01T08:00:00.000Z', updatedAt: '2026-05-01T08:00:00.000Z' }],
      sessions: [{ startedAt: '2026-02-15T10:00:00.000Z', updatedAt: 'not a date', completedAt: null }],
      trainingWeeks: [{ status: 'confirmed', createdAt: '2026-04-01T00:00:00.000Z', confirmedAt: '2026-06-02T09:30:00.000Z' }],
      noteRevisions: [{ at: '2026-06-01T00:00:00.000Z' }],
      imports: [{ createdAt: '' }],
    });
    expect(s.firstUse).toBe('2026-02-15T10:00:00.000Z');
    expect(s.lastActivity).toBe('2026-06-02T09:30:00.000Z');
  });
});

describe('formatBytes', () => {
  it('formats sizes and handles unknowns', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(2.25 * 1024 ** 3)).toBe('2.3 GB');
    expect(formatBytes(null)).toBe('Unknown');
    expect(formatBytes(undefined)).toBe('Unknown');
    expect(formatBytes(-1)).toBe('Unknown');
  });
});

describe('summariseUserAgent', () => {
  it('recognises common phones and desktops', () => {
    expect(summariseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(summariseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148')).toBe('Safari (home-screen app) on iOS');
    expect(summariseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(summariseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge on Windows');
    expect(summariseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Firefox on macOS');
    expect(summariseUserAgent('')).toBe('Unknown browser on Unknown OS');
  });
});

describe('formatWhen', () => {
  it('shows a dash for missing or invalid dates', () => {
    expect(formatWhen(null)).toBe('—');
    expect(formatWhen('nope')).toBe('—');
    expect(formatWhen('2026-06-02T09:30:00.000Z', 'en-GB')).toMatch(/2026/);
  });
});
