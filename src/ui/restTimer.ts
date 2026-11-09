import { useSyncExternalStore } from 'react';

/**
 * App-wide rest timer started from a note ("Rest: 2 min"). It stores the end
 * time, not a countdown, so it stays right if the phone sleeps or the app is in
 * the background, and it survives a reload (session storage).
 */
export interface RestTimer {
  label: string;
  endsAt: number;
  totalSec: number;
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
  set({ label, totalSec: seconds, endsAt: now + seconds * 1000 });
}

export function addRest(seconds: number): void {
  if (current) set({ ...current, endsAt: Math.max(current.endsAt, Date.now()) + seconds * 1000, totalSec: current.totalSec + seconds });
}

export function stopRest(): void {
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

// ── End-of-rest signal ────────────────────────────────────────────────────
// iOS only plays Web Audio started from a tap, so the context is created when
// the timer is started (a tap) and reused for the beep.
let audio: AudioContext | null = null;

function unlockSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    void audio?.resume();
  } catch {
    audio = null;
  }
}

export function signalRestOver(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* not supported (iPhone) */
  }
  try {
    if (!audio) return;
    const t0 = audio.currentTime;
    for (const [i, f] of [880, 1175].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.2);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0 + i * 0.22);
      osc.stop(t0 + i * 0.22 + 0.21);
    }
  } catch {
    /* sound unavailable */
  }
}
