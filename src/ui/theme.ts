import { useSyncExternalStore } from 'react';

/**
 * Appearance is a per-device preference (like screen brightness), so it lives
 * in localStorage rather than in the profile or backups. index.html applies it
 * before the first paint to avoid a flash.
 */
export type Theme = 'paper' | 'night' | 'auto';
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'paper', label: 'Paper' },
  { id: 'night', label: 'Night' },
  { id: 'auto', label: 'Auto' },
];
const KEY = 'adaptfit:theme';
const BAR = { paper: '#f6f2ea', night: '#161513' } as const;
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'night' || t === 'auto' ? t : 'paper';
  } catch {
    return 'paper';
  }
}

function resolved(t: Theme): 'paper' | 'night' {
  if (t !== 'auto') return t;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
}

export function applyTheme(t: Theme = getTheme()): void {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BAR[resolved(t)]);
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode: still applies for this session */
  }
  applyTheme(t);
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
  );
}
