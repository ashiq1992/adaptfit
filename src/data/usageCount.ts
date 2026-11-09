import { useSyncExternalStore } from 'react';

/**
 * Opt-in anonymous usage count ("Help count active users").
 *
 * Off by default. When on, at most once per local day the app sends
 * { id, v, installed } to the owner's counter (server/pings). The ID is random,
 * made on this device and not linked to any person. No workout, profile, note or
 * body data is ever sent. Turning it off asks the server to delete this ID's rows
 * and forgets the ID locally.
 *
 * The feature only exists when the build sets VITE_PINGS_URL; otherwise the
 * switch is hidden and nothing here makes a request.
 */

declare const __APP_VERSION__: string;

const KEY_ON = 'adaptfit:usage-count';
const KEY_ID = 'adaptfit:install-id';
const KEY_DAY = 'adaptfit:usage-count-day';
const KEY_ADMIN = 'adaptfit:admin-key';

export function pingsUrl(): string {
  const raw = (import.meta.env.VITE_PINGS_URL as string | undefined) ?? '';
  return raw.trim().replace(/\/+$/, '');
}

export function usageCountAvailable(): boolean {
  return pingsUrl() !== '';
}

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function isUsageCountOn(): boolean {
  return usageCountAvailable() && store()?.getItem(KEY_ON) === 'on';
}

export function useUsageCountOn(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isUsageCountOn,
    () => false,
  );
}

/** 32 hex characters. getRandomValues works on plain-http LAN pages too (randomUUID does not). */
export function newInstallId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function isInstalled(): boolean {
  const mq = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return mq || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Exactly what is sent. Kept in one place so tests can pin it. */
export function pingPayload(id: string): { id: string; v: string; installed: boolean } {
  return { id, v: __APP_VERSION__, installed: isInstalled() };
}

/**
 * Send today's ping if the user opted in, is online and hasn't pinged today.
 * Never throws; a failed ping is simply retried on a later open.
 */
export async function maybePing(now: Date = new Date()): Promise<boolean> {
  const s = store();
  if (!s || !isUsageCountOn()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const today = localDay(now);
  if (s.getItem(KEY_DAY) === today) return false;
  let id = s.getItem(KEY_ID);
  if (!id || !/^[0-9a-f]{32}$/.test(id)) {
    id = newInstallId();
    s.setItem(KEY_ID, id);
  }
  // Mark the day before sending, so a reload or a second tab mid-request doesn't send again;
  // undone below if the ping fails, so it is retried on a later open.
  s.setItem(KEY_DAY, today);
  const undo = () => {
    if (s.getItem(KEY_DAY) === today) s.removeItem(KEY_DAY);
  };
  try {
    const res = await fetch(`${pingsUrl()}/ping`, {
      method: 'POST',
      // text/plain keeps this a "simple" request (no CORS preflight); the server parses JSON.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(pingPayload(id)),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) {
      undo();
      return false;
    }
    return true;
  } catch {
    undo();
    return false;
  }
}

export async function setUsageCount(on: boolean): Promise<void> {
  const s = store();
  if (!s || !usageCountAvailable()) return;
  if (on) {
    s.setItem(KEY_ON, 'on');
    emit();
    await maybePing();
    return;
  }
  const id = s.getItem(KEY_ID);
  s.removeItem(KEY_ON);
  s.removeItem(KEY_ID);
  s.removeItem(KEY_DAY);
  emit();
  if (id) {
    try {
      await fetch(`${pingsUrl()}/ping`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      // Offline: the rows expire on the server after 90 days anyway.
    }
  }
}

/** Ping on start and whenever the app comes back to the foreground. */
export function startUsageCount(): void {
  if (!usageCountAvailable()) return;
  void maybePing();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void maybePing();
  });
  window.addEventListener('online', () => void maybePing());
}

// ── Owner view (Admin page) ───────────────────────────────────────────────

export interface UsageStats {
  generatedAt: string;
  today: number;
  last7: number;
  last30: number;
  returning30: number;
  installed7: number;
  daily: { day: string; devices: number }[];
  versions7: { v: string; devices: number }[];
}

export function getAdminKey(): string {
  return store()?.getItem(KEY_ADMIN) ?? '';
}

export function setAdminKey(key: string): void {
  const s = store();
  if (!s) return;
  if (key) s.setItem(KEY_ADMIN, key);
  else s.removeItem(KEY_ADMIN);
}

export type StatsResult = { ok: true; stats: UsageStats } | { ok: false; reason: 'key' | 'network' | 'server' };

export async function fetchUsageStats(key: string): Promise<StatsResult> {
  try {
    const res = await fetch(`${pingsUrl()}/stats`, { headers: { Authorization: `Bearer ${key}` }, credentials: 'omit', cache: 'no-store' });
    if (res.status === 401) return { ok: false, reason: 'key' };
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true, stats: (await res.json()) as UsageStats };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
