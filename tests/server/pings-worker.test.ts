import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanup, handle, parsePing, sameSecret, type D1Like, type D1Statement, type Env } from '../../server/pings/src/logic';

/** Real SQLite (Node's built-in) behind the small D1 surface the Worker uses, so the SQL itself is tested. */
function fakeD1(): { db: D1Like; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(resolve(process.cwd(), 'server/pings/schema.sql'), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []): D1Statement => ({
    bind: (...v) => stmt(sql, v),
    run: async () => raw.prepare(sql).run(...(args as never[])),
    all: async <T,>() => ({ results: raw.prepare(sql).all(...(args as never[])) as T[] }),
    first: async <T,>() => (raw.prepare(sql).get(...(args as never[])) as T | undefined) ?? null,
  });
  return { db: { prepare: (sql) => stmt(sql) }, raw };
}

const APP = 'https://ashiq1992.github.io';
const ID_A = 'a'.repeat(32);
const ID_B = 'b'.repeat(32);

function setup() {
  const { db, raw } = fakeD1();
  const env: Env = { DB: db, ADMIN_KEY: 'owner-secret-key-123', ALLOWED_ORIGINS: `${APP}, http://127.0.0.1:4173` };
  const rows = () => raw.prepare('SELECT id, day, v, installed FROM pings ORDER BY day, id').all() as { id: string; day: string; v: string; installed: number }[];
  return { env, rows };
}

const ping = (body: unknown, origin: string | null = APP, method = 'POST') =>
  new Request('https://adaptfit-pings.example.workers.dev/ping', {
    method,
    headers: { 'Content-Type': 'text/plain', ...(origin ? { Origin: origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const stats = (key?: string) => new Request('https://adaptfit-pings.example.workers.dev/stats', { headers: { Origin: APP, ...(key ? { Authorization: `Bearer ${key}` } : {}) } });

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('pings worker', () => {
  it('stores one row per device per day and ignores repeats the same day', async () => {
    const { env, rows } = setup();
    const r1 = await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-11-09'));
    expect(r1.status).toBe(204);
    expect(r1.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-11-09'));
    await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-11-10'));
    expect(rows()).toEqual([
      { id: ID_A, day: '2026-11-09', v: '0.5.0', installed: 1 },
      { id: ID_A, day: '2026-11-10', v: '0.5.0', installed: 1 },
    ]);
  });

  it('stores only id, day, version and installed — extra fields are dropped', async () => {
    const { env, rows } = setup();
    await handle(ping({ id: ID_A, v: '0.5.0', installed: false, name: 'Ashiq', email: 'x@y.z', workouts: [1] }), env, day('2026-11-09'));
    expect(Object.keys(rows()[0]!)).toEqual(['id', 'day', 'v', 'installed']);
    expect(JSON.stringify(rows())).not.toMatch(/Ashiq|x@y|workouts/);
  });

  it('rejects other websites, missing Origin, and malformed bodies', async () => {
    const { env, rows } = setup();
    expect((await handle(ping({ id: ID_A, v: '0.5.0', installed: true }, 'https://evil.example'), env)).status).toBe(403);
    expect((await handle(ping({ id: ID_A, v: '0.5.0', installed: true }, null), env)).status).toBe(403);
    expect((await handle(ping('not json'), env)).status).toBe(400);
    expect((await handle(ping({ id: 'short', v: '0.5.0', installed: true }), env)).status).toBe(400);
    expect((await handle(ping({ id: ID_A, v: '<script>', installed: true }), env)).status).toBe(400);
    expect((await handle(ping({ id: ID_A, v: '0.5.0', installed: 'yes' }), env)).status).toBe(400);
    expect((await handle(ping('x'.repeat(2000)), env)).status).toBe(400);
    expect(rows()).toEqual([]);
  });

  it('answers the CORS preflight only for allowed origins', async () => {
    const { env } = setup();
    const pre = (origin: string) => new Request('https://w.example/ping', { method: 'OPTIONS', headers: { Origin: origin } });
    const ok = await handle(pre('http://127.0.0.1:4173'), env);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
    expect((await handle(pre('https://evil.example'), env)).status).toBe(403);
  });

  it('DELETE removes every row for that device (the "turn off" promise)', async () => {
    const { env, rows } = setup();
    await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-11-08'));
    await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-11-09'));
    await handle(ping({ id: ID_B, v: '0.5.0', installed: false }), env, day('2026-11-09'));
    const res = await handle(ping({ id: ID_A }, APP, 'DELETE'), env);
    expect(res.status).toBe(204);
    expect(rows().map((r) => r.id)).toEqual([ID_B]);
  });

  it('stats need the owner key', async () => {
    const { env } = setup();
    expect((await handle(stats(), env)).status).toBe(401);
    expect((await handle(stats('wrong'), env)).status).toBe(401);
    expect((await handle(stats(''), { ...env, ADMIN_KEY: '' })).status).toBe(401);
    expect((await handle(stats('owner-secret-key-123'), env)).status).toBe(200);
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('abc', 'abcd')).toBe(false);
  });

  it('stats count distinct devices today, in 7 and 30 days, returning devices, installs and versions', async () => {
    const { env } = setup();
    const send = (id: string, d: string, v = '0.5.0', installed = true) => handle(ping({ id, v, installed }), env, day(d));
    await send(ID_A, '2026-11-09');
    await send(ID_A, '2026-11-05');
    await send(ID_B, '2026-11-01', '0.4.0', false);
    await send('c'.repeat(32), '2026-09-01'); // older than 30 days
    const res = await handle(stats('owner-secret-key-123'), env, day('2026-11-09'));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ today: 1, last7: 1, last30: 2, returning30: 1, installed7: 1 });
    expect(body.daily).toEqual([
      { day: '2026-11-09', devices: 1 },
      { day: '2026-11-05', devices: 1 },
      { day: '2026-11-01', devices: 1 },
    ]);
    expect(body.versions7).toEqual([{ v: '0.5.0', devices: 1 }]);
  });

  it('daily cleanup deletes rows older than 90 days', async () => {
    const { env, rows } = setup();
    await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-07-01'));
    await handle(ping({ id: ID_A, v: '0.5.0', installed: true }), env, day('2026-11-01'));
    await cleanup(env.DB, day('2026-11-09'));
    expect(rows().map((r) => r.day)).toEqual(['2026-11-01']);
  });

  it('unknown paths and methods are refused', async () => {
    const { env } = setup();
    expect((await handle(new Request('https://w.example/'), env)).status).toBe(404);
    expect((await handle(ping({}, APP, 'PUT'), env)).status).toBe(405);
    expect(parsePing(null)).toBeNull();
  });
});
