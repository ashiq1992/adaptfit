import { useEffect, useRef } from 'react';
import { clockTime } from '../features/format';
import { useAnnounce } from './Announcer';
import { useNow } from './hooks';
import { addRest, restRemaining, signalRestOver, stopRest, useRestTimer } from './restTimer';

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
  useEffect(() => {
    if (remaining === 0 && signalled.current !== timer.endsAt) {
      signalled.current = timer.endsAt;
      signalRestOver();
      announce(`Rest over. Next set of ${timer.label}.`);
    }
  }, [remaining, timer.endsAt, timer.label, announce]);
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
    <div className={`rest-bar ${done ? 'is-done' : ''}`} role="timer" aria-label={`Rest timer for ${timer.label}`} data-testid="rest-bar">
      <span className="rest-bar-fill" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <span className="rest-bar-text">
        <span className="rest-bar-label">{done ? 'Rest over' : `Rest · ${timer.label}`}</span>
        <span className="rest-bar-time" data-testid="rest-bar-time">
          {done ? 'Go' : clockTime(remaining)}
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
