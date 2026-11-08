import { useSyncExternalStore } from 'react';

export interface PwaState {
  /** Service workers are available in this browser/context. */
  supported: boolean;
  /** An active service worker has finished precaching the app shell. */
  offlineReady: boolean;
  /** A new version is waiting; applied only when the user chooses. */
  needRefresh: boolean;
  error: string | null;
}

let state: PwaState = {
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  offlineReady: false,
  needRefresh: false,
  error: null,
};
const listeners = new Set<() => void>();
let applyUpdate: (() => Promise<void>) | null = null;

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function refreshToUpdate(): void {
  void applyUpdate?.();
}

/** Register the production service worker. Called once from main.tsx. */
export async function initPwa(): Promise<void> {
  if (!state.supported || import.meta.env.DEV) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    const update = registerSW({
      immediate: true,
      onOfflineReady: () => set({ offlineReady: true }),
      onNeedRefresh: () => set({ needRefresh: true }),
      onRegisterError: (err: unknown) => set({ error: err instanceof Error ? err.message : 'Service worker registration failed' }),
    });
    applyUpdate = () => update(true);
    // `ready` resolves once a worker is active — i.e. its precache install succeeded.
    await navigator.serviceWorker.ready;
    set({ offlineReady: true });
  } catch (err) {
    set({ error: err instanceof Error ? err.message : 'Service worker registration failed' });
  }
}
