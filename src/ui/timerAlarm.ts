import { useSyncExternalStore } from 'react';

/**
 * The alarm when a timer ends (rest between sets, a timed hold, live-logging rest).
 *
 * - Rings: a loud three-beep pattern every 1.6 s, with vibration where the
 *   phone allows it (Android; iPhones don't let web apps vibrate), until the
 *   user taps anywhere or 30 s pass.
 * - In the background (another app, or the screen off on Android): a system
 *   notification instead, if the user switched that on and allowed it.
 *
 * Nothing leaves the phone: the notification is shown by this app's own
 * service worker, with no server involved.
 */

export interface AlarmPrefs {
  sound: boolean;
  vibrate: boolean;
  /** System notification when the timer ends while AdaptFit is in the background. */
  notify: boolean;
}

const KEY = 'adaptfit:timer-alarm';
const DEFAULTS: AlarmPrefs = { sound: true, vibrate: true, notify: false };
export const RING_MS = 30_000;
const ROUND_MS = 1600;

const listeners = new Set<() => void>();
let prefs: AlarmPrefs = loadPrefs();

function loadPrefs(): AlarmPrefs {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AlarmPrefs>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getAlarmPrefs(): AlarmPrefs {
  return prefs;
}

export function setAlarmPrefs(patch: Partial<AlarmPrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* not remembered */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAlarmPrefs(): AlarmPrefs {
  return useSyncExternalStore(subscribe, getAlarmPrefs, () => DEFAULTS);
}

// ── Ringing state (the bar shows "Tap to stop" while ringing) ──────────────
let ringTimer: number | null = null;
let stopAt = 0;
let ringingNow = false;
/** For tests and the UI: how many beep rounds have played since the last start. */
let rounds = 0;

function setRinging(v: boolean) {
  ringingNow = v;
  listeners.forEach((l) => l());
}

export function isRinging(): boolean {
  return ringingNow;
}

export function useRinging(): boolean {
  return useSyncExternalStore(subscribe, isRinging, () => false);
}

export function alarmRounds(): number {
  return rounds;
}

/** Start ringing (in the app) or, when the app is in the background, show a notification. */
export function timerAlarm(title: string, body: string): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    void notify(title, body);
    if (prefs.vibrate) vibrate([400, 150, 400, 150, 400]);
    return;
  }
  ring();
}

/** When a tap last stopped the alarm (so the same tap doesn't also start a test ring). */
let tapSilencedAt = 0;
export function silencedByTapJustNow(now = Date.now()): boolean {
  return now - tapSilencedAt < 700;
}
const onTap = () => {
  tapSilencedAt = Date.now();
  silenceAlarm();
};

export function ring(now = Date.now(), ms = RING_MS): void {
  silenceAlarm();
  if (!prefs.sound && !prefs.vibrate) return;
  rounds = 0;
  stopAt = now + ms;
  setRinging(true);
  // A tap anywhere stops it.
  window.addEventListener('pointerdown', onTap, { capture: true });
  playRound();
  ringTimer = window.setInterval(() => {
    if (Date.now() >= stopAt) silenceAlarm();
    else playRound();
  }, ROUND_MS);
}

export function silenceAlarm(): void {
  if (ringTimer !== null) window.clearInterval(ringTimer);
  ringTimer = null;
  window.removeEventListener('pointerdown', onTap, { capture: true });
  if (ringingNow) {
    vibrate(0);
    setRinging(false);
  }
}

function playRound() {
  rounds++;
  if (prefs.vibrate) vibrate([400, 150, 400]);
  if (prefs.sound) beeps();
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported (iPhone) */
  }
}

// ── Sound ─────────────────────────────────────────────────────────────────
// Phones only play web audio after a tap, so the audio is switched on by the
// first tap anywhere in the app (primeAlarmSound) and kept for the alarm.
let audio: AudioContext | null = null;

export function unlockSound(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    if (audio?.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

/** Unlock sound on taps, so an alarm can ring later without one. Call once at start-up. */
export function primeAlarmSound(): void {
  const opts = { capture: true, passive: true } as const;
  for (const type of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(type, unlockSound, opts);
}

/** Three loud, short beeps: high-low-high, easy to hear in a gym. */
function beeps() {
  try {
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();
    const t0 = audio.currentTime + 0.02;
    [1319, 988, 1319].forEach((f, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      const at = t0 + i * 0.25;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.015);
      gain.gain.setValueAtTime(0.35, at + 0.17);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + 0.21);
    });
  } catch {
    /* sound unavailable */
  }
}

// ── Background notification ───────────────────────────────────────────────
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/** Ask once, from the Settings switch. Returns whether notifications may be shown. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  let p = Notification.permission;
  if (p === 'default') p = await Notification.requestPermission();
  const ok = p === 'granted';
  setAlarmPrefs({ notify: ok });
  return ok;
}

async function notify(title: string, body: string): Promise<void> {
  try {
    if (!prefs.notify || !notificationsSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const options = { body, tag: 'adaptfit-timer', renotify: true, requireInteraction: true, vibrate: prefs.vibrate ? [400, 150, 400, 150, 400] : undefined, icon: 'icon-192.png', silent: !prefs.sound } as NotificationOptions;
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    /* blocked: the bar still shows the time is up when the app is opened */
  }
}

/** Clear a timer notification once the user is back in the app. */
export async function clearTimerNotification(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    (await reg?.getNotifications({ tag: 'adaptfit-timer' }))?.forEach((n) => n.close());
  } catch {
    /* nothing to clear */
  }
}
