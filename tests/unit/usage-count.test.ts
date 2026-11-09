import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUsageStats, isUsageCountOn, maybePing, newInstallId, pingPayload, setUsageCount, usageCountAvailable } from '../../src/data/usageCount';

const URL_ = 'https://adaptfit-pings.example.workers.dev';

function mockFetch(status = 204, body?: unknown) {
  const fn = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_PINGS_URL', `${URL_}/`);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('anonymous usage count (client)', () => {
  it('does not exist when the build has no counter URL', async () => {
    vi.stubEnv('VITE_PINGS_URL', '');
    const f = mockFetch();
    localStorage.setItem('adaptfit:usage-count', 'on');
    expect(usageCountAvailable()).toBe(false);
    expect(isUsageCountOn()).toBe(false);
    await setUsageCount(true);
    expect(await maybePing()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('is off by default and sends nothing', async () => {
    const f = mockFetch();
    expect(isUsageCountOn()).toBe(false);
    expect(await maybePing()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('when switched on, sends one ping per day with only id, version and installed', async () => {
    const f = mockFetch();
    await setUsageCount(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_}/ping`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['id', 'installed', 'v']);
    expect(sent.id).toMatch(/^[0-9a-f]{32}$/);
    expect(sent.v).toMatch(/^\d+\.\d+\.\d+$/);

    // Same day: no second ping. Next day: one more, same ID.
    expect(await maybePing()).toBe(false);
    const tomorrow = new Date(Date.now() + 86_400_000);
    expect(await maybePing(tomorrow)).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body)).id).toBe(sent.id);
  });

  it('a failed ping is retried later the same day', async () => {
    const f = mockFetch(500);
    await setUsageCount(true);
    mockFetch(204);
    expect(await maybePing()).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('does not ping while offline', async () => {
    const f = mockFetch();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await setUsageCount(true);
    expect(f).not.toHaveBeenCalled();
  });

  it('never throws when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(setUsageCount(true)).resolves.toBeUndefined();
    await expect(setUsageCount(false)).resolves.toBeUndefined();
  });

  it('switching off asks the server to delete this ID and forgets it locally', async () => {
    mockFetch();
    await setUsageCount(true);
    const id = localStorage.getItem('adaptfit:install-id');
    const f = mockFetch();
    await setUsageCount(false);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_}/ping`);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ id });
    expect(isUsageCountOn()).toBe(false);
    expect(localStorage.getItem('adaptfit:install-id')).toBeNull();
    expect(await maybePing()).toBe(false);
  });

  it('install IDs are random 32-hex strings', () => {
    const a = newInstallId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newInstallId()).not.toBe(a);
    expect(Object.keys(pingPayload(a)).sort()).toEqual(['id', 'installed', 'v']);
  });

  it('owner stats: sends the key as a bearer token and reports a wrong key', async () => {
    const f = mockFetch(200, { today: 3 });
    const ok = await fetchUsageStats('k1');
    expect(ok).toEqual({ ok: true, stats: { today: 3 } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_}/stats`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k1');
    mockFetch(401);
    expect(await fetchUsageStats('bad')).toEqual({ ok: false, reason: 'key' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('x'))));
    expect(await fetchUsageStats('k1')).toEqual({ ok: false, reason: 'network' });
  });
});
