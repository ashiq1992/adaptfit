import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alarmRounds, getAlarmPrefs, isRinging, ring, RING_MS, setAlarmPrefs, silenceAlarm, silencedByTapJustNow, timerAlarm } from '../../src/ui/timerAlarm';

describe('Timer alarm', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    setAlarmPrefs({ sound: true, vibrate: true, notify: false });
  });
  afterEach(() => {
    silenceAlarm();
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('rings repeatedly (sound and vibration rounds) until 30 s have passed', () => {
    ring();
    expect(isRinging()).toBe(true);
    expect(alarmRounds()).toBe(1);
    expect(vibrate).toHaveBeenCalledWith([400, 150, 400]);
    vi.advanceTimersByTime(5000);
    expect(alarmRounds()).toBe(4);
    vi.advanceTimersByTime(RING_MS);
    expect(isRinging()).toBe(false);
    const after = alarmRounds();
    vi.advanceTimersByTime(10_000);
    expect(alarmRounds()).toBe(after);
  });

  it('a tap anywhere stops it, and that tap is not taken as a new start', () => {
    ring();
    window.dispatchEvent(new Event('pointerdown'));
    expect(isRinging()).toBe(false);
    expect(vibrate).toHaveBeenLastCalledWith(0);
    expect(silencedByTapJustNow()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(silencedByTapJustNow()).toBe(false);
    // Later taps do nothing special.
    window.dispatchEvent(new Event('pointerdown'));
    expect(isRinging()).toBe(false);
  });

  it('respects the settings: silent when sound and vibration are both off; no vibration when off', () => {
    setAlarmPrefs({ sound: false, vibrate: false });
    ring();
    expect(isRinging()).toBe(false);
    setAlarmPrefs({ sound: true, vibrate: false });
    ring();
    expect(isRinging()).toBe(true);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('settings are kept on this device', () => {
    setAlarmPrefs({ sound: false });
    expect(JSON.parse(localStorage.getItem('adaptfit:timer-alarm')!)).toMatchObject({ sound: false, vibrate: true, notify: false });
    expect(getAlarmPrefs().sound).toBe(false);
  });

  it('in the background it does not ring in the page (a notification is used instead, if allowed)', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    timerAlarm('Rest over', 'Next set of Lat pulldown.');
    expect(isRinging()).toBe(false);
    expect(vibrate).toHaveBeenCalledWith([400, 150, 400, 150, 400]);
  });
});
