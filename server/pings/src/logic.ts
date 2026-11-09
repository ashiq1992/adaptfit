/**
 * AdaptFit anonymous usage counter — logic for the Cloudflare Worker (entry: worker.ts) with one D1 table.
 *
 * What it stores, per device per day: a random install ID (made on the phone, not
 * linked to any person), the app version, whether it runs as an installed app, and
 * the UTC day. No IP address, no names, no workout data. Rows older than 90 days
 * are deleted by the daily cron.
 *
 *   POST   /ping   {"id","v","installed"}   → 204   (only from allowed origins)
 *   DELETE /ping   {"id"}                   → 204   (the app's "turn off" deletes the device's rows)
 *   GET    /stats  Authorization: Bearer <ADMIN_KEY> → JSON counts for the owner's Admin page
 */

/** The parts of the D1 API this Worker uses (kept local so no extra type package is needed). */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
}

export interface Env {
  DB: D1Like;
  /** Secret (`wrangler secret put ADMIN_KEY`). Without it, /stats is closed. */
  ADMIN_KEY?: string;
  /** Comma-separated origins allowed to send pings, e.g. "https://you.github.io". */
  ALLOWED_ORIGINS: string;
}

export const RETENTION_DAYS = 90;
const MAX_BODY = 512;

const ID_RE = /^[0-9a-f]{32}$/;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export interface PingBody {
  id: string;
  v: string;
  installed: 0 | 1;
}

/** Strict validation: anything unexpected is rejected, extra fields are dropped. */
export function parsePing(raw: unknown): PingBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !ID_RE.test(o.id)) return null;
  if (typeof o.v !== 'string' || !VERSION_RE.test(o.v)) return null;
  if (typeof o.installed !== 'boolean') return null;
  return { id: o.id, v: o.v, installed: o.installed ? 1 : 0 };
}

export function parseDelete(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = (raw as Record<string, unknown>).id;
  return typeof id === 'string' && ID_RE.test(id) ? id : null;
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function cors(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Length-independent comparison so the key can't be guessed byte by byte from timings. */
export function sameSecret(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface Stats {
  generatedAt: string;
  today: number;
  last7: number;
  last30: number;
  /** Devices seen on two or more different days in the last 30 days. */
  returning30: number;
  installed7: number;
  daily: { day: string; devices: number }[];
  versions7: { v: string; devices: number }[];
}

export async function readStats(db: D1Like, now: Date): Promise<Stats> {
  const day = (offset: number) => utcDay(new Date(now.getTime() - offset * 86_400_000));
  const count = async (sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
  const [today, last7, last30, returning30, installed7, daily, versions7] = await Promise.all([
    count('SELECT COUNT(DISTINCT id) AS n FROM pings WHERE day = ?', day(0)),
    count('SELECT COUNT(DISTINCT id) AS n FROM pings WHERE day >= ?', day(6)),
    count('SELECT COUNT(DISTINCT id) AS n FROM pings WHERE day >= ?', day(29)),
    count('SELECT COUNT(*) AS n FROM (SELECT id FROM pings WHERE day >= ? GROUP BY id HAVING COUNT(DISTINCT day) >= 2)', day(29)),
    count('SELECT COUNT(DISTINCT id) AS n FROM pings WHERE day >= ? AND installed = 1', day(6)),
    db.prepare('SELECT day, COUNT(DISTINCT id) AS devices FROM pings WHERE day >= ? GROUP BY day ORDER BY day DESC').bind(day(29)).all<{ day: string; devices: number }>(),
    db.prepare('SELECT v, COUNT(DISTINCT id) AS devices FROM pings WHERE day >= ? GROUP BY v ORDER BY devices DESC').bind(day(6)).all<{ v: string; devices: number }>(),
  ]);
  return { generatedAt: now.toISOString(), today, last7, last30, returning30, installed7, daily: daily.results, versions7: versions7.results };
}

export async function handle(request: Request, env: Env, now: Date = new Date()): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const headers = cors(origin, env);
  const reply = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'Cache-Control': 'no-store' },
    });

  if (request.method === 'OPTIONS') return reply(headers['Access-Control-Allow-Origin'] ? 204 : 403);

  if (url.pathname === '/ping') {
    // Browsers always send Origin on cross-site POST/DELETE; refuse anything else.
    if (!headers['Access-Control-Allow-Origin']) return reply(403);
    const body = await readJson(request);
    if (request.method === 'POST') {
      const ping = parsePing(body);
      if (!ping) return reply(400);
      await env.DB.prepare('INSERT OR IGNORE INTO pings (id, day, v, installed) VALUES (?, ?, ?, ?)').bind(ping.id, utcDay(now), ping.v, ping.installed).run();
      return reply(204);
    }
    if (request.method === 'DELETE') {
      const id = parseDelete(body);
      if (!id) return reply(400);
      await env.DB.prepare('DELETE FROM pings WHERE id = ?').bind(id).run();
      return reply(204);
    }
    return reply(405);
  }

  if (url.pathname === '/stats' && request.method === 'GET') {
    const auth = request.headers.get('Authorization') ?? '';
    const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!env.ADMIN_KEY || !key || !sameSecret(key, env.ADMIN_KEY)) return reply(401);
    return reply(200, await readStats(env.DB, now));
  }

  return reply(404);
}

export async function cleanup(db: D1Like, now: Date): Promise<void> {
  const cutoff = utcDay(new Date(now.getTime() - RETENTION_DAYS * 86_400_000));
  await db.prepare('DELETE FROM pings WHERE day < ?').bind(cutoff).run();
}
