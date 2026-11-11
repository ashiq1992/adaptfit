import { useSyncExternalStore } from 'react';
import { silenceAlarm, unlockSound } from './timerAlarm';

/**
 * App-wide rest timer started from a note ("Rest: 2 min"). It stores the end
 * time, not a countdown, so it stays right if the phone sleeps or the app is in
 * the background, and it survives a reload (session storage).
 */
export interface RestTimer {
  label: string;
  endsAt: number;
  totalSec: number;
  /** "rest" between sets, or "hold" for a timed exercise (plank 30 s). Missing on older saved timers = rest. */
  kind?: 'rest' | 'hold';
}

const KEY = 'adaptfit:rest-timer';
const listeners = new Set<() => void>();
let current: RestTimer | null = load();

function load(): RestTimer | null {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestTimer) : null;
  } catch {
    return null;
  }
}

function set(next: RestTimer | null) {
  current = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the timer still works for this page */
  }
  listeners.forEach((l) => l());
}

export function getRestTimer(): RestTimer | null {
  return current;
}

export function useRestTimer(): RestTimer | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getRestTimer,
    () => null,
  );
}

export function startRest(label: string, seconds: number, now = Date.now()): void {
  unlockSound();
  set({ label, totalSec: seconds, endsAt: now + seconds * 1000, kind: 'rest' });
}

/** Countdown for a timed exercise (a plank, a hold): same bar, its own wording. */
export function startHold(label: string, seconds: number, now = Date.now()): void {
  unlockSound();
  set({ label, totalSec: seconds, endsAt: now + seconds * 1000, kind: 'hold' });
}

export function addRest(seconds: number): void {
  silenceAlarm();
  if (current) set({ ...current, endsAt: Math.max(current.endsAt, Date.now()) + seconds * 1000, totalSec: current.totalSec + seconds });
}

export function stopRest(): void {
  silenceAlarm();
  set(null);
}

export function restRemaining(t: RestTimer, now = Date.now()): number {
  return Math.max(0, Math.ceil((t.endsAt - now) / 1000));
}

/** "2 min", "90 s", "2 min 30 s" */
export function restLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

// ── Keep the screen on while counting ─────────────────────────────────────
// A locked phone pauses the page, so the beep could not play. While a timer is
// running the app asks the browser to keep the screen awake (Screen Wake Lock,
// where supported); it lets go when the timer ends or is stopped.
type Sentinel = { release: () => Promise<void>; released?: boolean };
let lock: Sentinel | null = null;

export async function keepAwake(on: boolean): Promise<void> {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
  try {
    if (on && wl && (!lock || lock.released) && document.visibilityState === 'visible') lock = await wl.request('screen');
    else if (!on && lock) {
      const l = lock;
      lock = null;
      await l.release();
    }
  } catch {
    /* not allowed (battery saver, unsupported): the timer still works */
  }
}
