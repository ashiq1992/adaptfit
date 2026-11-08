import { liveQuery } from 'dexie';
import { type DependencyList, useEffect, useState, useSyncExternalStore } from 'react';
import { localDateOf } from '../domain/dates';
import { clock } from './clock';

export interface LiveResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Subscribe to an IndexedDB query. Dexie re-runs it whenever the underlying
 * tables change — including changes made in other tabs.
 */
export function useLive<T>(query: () => Promise<T>, deps: DependencyList): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: undefined, error: null, loading: true });
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (data) => setState({ data, error: null, loading: false }),
      error: (error: unknown) => setState((s) => ({ data: s.data, error, loading: false })),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Current time, refreshed on an interval and whenever the tab becomes visible. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const tick = () => setNow(clock.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}

/** Today's local calendar date; changes at local midnight. */
export function useLocalToday(): string {
  const now = useNow(30_000);
  return localDateOf(now);
}

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHash(): string {
  return useSyncExternalStore(subscribeHash, () => window.location.hash);
}

export function navigate(path: string): void {
  const hash = `#${path}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      mq?.addEventListener?.('change', cb);
      return () => mq?.removeEventListener?.('change', cb);
    },
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
}
