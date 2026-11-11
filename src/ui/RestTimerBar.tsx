import { useEffect, useRef } from 'react';
import { clockTime } from '../features/format';
import { useAnnounce } from './Announcer';
import { useNow } from './hooks';
import { addRest, keepAwake, restRemaining, stopRest, useRestTimer } from './restTimer';
import { clearTimerNotification, silenceAlarm, timerAlarm, useRinging } from './timerAlarm';

/** The running rest timer, above the tab bar on every screen. */
export function RestTimerBar() {
  const timer = useRestTimer();
  if (!timer) return null;
  return <Running />;
}

function Running() {
  const timer = useRestTimer()!;
  const now = useNow(250);
  const remaining = restRemaining(timer, now.getTime());
  const announce = useAnnounce();
  const signalled = useRef<number | null>(null);
  const hold = timer.kind === 'hold';
  useEffect(() => {
    if (remaining === 0 && signalled.current !== timer.endsAt) {
      signalled.current = timer.endsAt;
      timerAlarm(hold ? 'Time’s up' : 'Rest over', hold ? `${timer.label} done.` : `Next set of ${timer.label}.`);
      announce(hold ? `Time. ${timer.label} done.` : `Rest over. Next set of ${timer.label}.`);
    }
  }, [remaining, timer.endsAt, timer.label, hold, announce]);
  // Ringing: a tap anywhere stops the sound (the bar stays until Close).
  const ringing = useRinging();
  // Back in the app: the notification has done its job.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === 'visible') void clearTimerNotification();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      silenceAlarm();
    };
  }, []);
  // Keep the screen on while counting, so the phone doesn't lock before the beep.
  const counting = remaining > 0;
  useEffect(() => {
    if (!counting) return;
    void keepAwake(true);
    const again = () => void keepAwake(true);
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      void keepAwake(false);
    };
  }, [counting]);
  // Lift toasts (Undo, questions) above the bar while it is showing.
  useEffect(() => {
    document.documentElement.style.setProperty('--rest-h', '64px');
    return () => {
      document.documentElement.style.removeProperty('--rest-h');
    };
  }, []);
  const done = remaining === 0;
  const progress = timer.totalSec ? Math.min(1, 1 - remaining / timer.totalSec) : 1;
  return (
    <div className={`rest-bar ${done ? 'is-done' : ''} ${ringing ? 'is-ringing' : ''}`} data-ringing={ringing || undefined} role="timer" aria-label={`${hold ? 'Timer' : 'Rest timer'} for ${timer.label}`} data-testid="rest-bar">
      <span className="rest-bar-fill" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <span className="rest-bar-text">
        <span className="rest-bar-label">{done ? (hold ? 'Time' : 'Rest over') : `${hold ? 'Timer' : 'Rest'} · ${timer.label}`}</span>
        <span className="rest-bar-time" data-testid="rest-bar-time">
          {done ? (ringing ? 'Tap to stop' : 'Go') : clockTime(remaining)}
        </span>
      </span>
      {!done && (
        <button type="button" className="btn btn-sm" onClick={() => addRest(30)}>
          +30 s
        </button>
      )}
      <button type="button" className="btn btn-sm" onClick={stopRest}>
        {done ? 'Close' : 'Stop'}
      </button>
    </div>
  );
}
