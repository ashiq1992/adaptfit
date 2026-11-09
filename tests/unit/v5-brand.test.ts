import { afterEach, describe, expect, it } from 'vitest';
import { formatLocalDate } from '../../src/domain/dates';
import { dayDate, shortDate } from '../../src/features/format';
import { applyTheme, getTheme, setTheme } from '../../src/ui/theme';

describe('Ink & Paper: one date format', () => {
  it('writes "23 Oct", adding the year only when it is not the current year', () => {
    expect(formatLocalDate('2026-10-23', 2026)).toBe('23 Oct');
    expect(formatLocalDate('2025-10-23', 2026)).toBe('23 Oct 2025');
    expect(formatLocalDate('2026-01-05', 2026)).toBe('5 Jan');
    expect(formatLocalDate('not a date', 2026)).toBe('not a date');
  });
  it('short dates and day dates use day-before-month everywhere', () => {
    expect(shortDate('2026-11-06')).toBe('6 Nov');
    expect(dayDate('2026-11-09')).toBe('Mon 9 Nov');
  });
});

describe('Ink & Paper: theme preference', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to Paper, including when the stored value is unknown', () => {
    expect(getTheme()).toBe('paper');
    localStorage.setItem('adaptfit:theme', 'neon');
    expect(getTheme()).toBe('paper');
  });

  it('stores the choice on this device and applies it to the page', () => {
    setTheme('night');
    expect(localStorage.getItem('adaptfit:theme')).toBe('night');
    expect(getTheme()).toBe('night');
    expect(document.documentElement.dataset.theme).toBe('night');
    setTheme('auto');
    expect(getTheme()).toBe('auto');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('auto');
  });

  it('keeps the browser bar colour in step with the theme', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    setTheme('night');
    expect(meta.getAttribute('content')).toBe('#161513');
    setTheme('paper');
    expect(meta.getAttribute('content')).toBe('#f6f2ea');
    meta.remove();
  });
});
