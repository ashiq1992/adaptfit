import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Sub-path hosting (GitHub Pages serves https://<user>.github.io/<repo>/):
 * serve the built app ONLY under /adaptfit/ (nothing at the root) and check it
 * loads, installs its service worker with the right scope, and reopens offline.
 */
const DIST = resolve(process.env.E2E_DIST ?? 'dist');
const PREFIX = '/adaptfit/';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

let server: Server;
let base = '';
const served: string[] = [];

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    served.push(path);
    if (path === PREFIX.slice(0, -1)) {
      res.writeHead(301, { Location: PREFIX }).end();
      return;
    }
    if (!path.startsWith(PREFIX)) {
      res.writeHead(404).end('Not found (only the sub-path is served)');
      return;
    }
    const rel = path.slice(PREFIX.length) || 'index.html';
    const file = normalize(join(DIST, rel));
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${PREFIX}`;
});

test.afterAll(async () => {
  await new Promise<void>((r) => (server.listening ? server.close(() => r()) : r()));
});

test('sub-path hosting: app, manifest, icons and lazy screens load under /adaptfit/, then work offline', async ({ page, context }) => {
  const bad: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`));

  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Welcome to AdaptFit' })).toBeVisible();

  // Every <link href> / <script src> in the page (icons, splash, theme script, manifest) resolves under the sub-path.
  const urls = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll('link[href]'), (l) => (l as HTMLLinkElement).href),
    ...Array.from(document.querySelectorAll('script[src]'), (s) => (s as HTMLScriptElement).src),
  ]);
  expect(urls.length).toBeGreaterThan(10);
  for (const u of urls) {
    expect(u.startsWith(base), `${u} is under ${base}`).toBe(true);
    expect((await page.request.get(u)).status(), u).toBe(200);
  }

  // Manifest: relative start_url/scope, icons resolve relative to the manifest.
  const manifestUrl = await page.locator('link[rel="manifest"]').evaluate((l) => (l as HTMLLinkElement).href);
  const manifest = (await (await page.request.get(manifestUrl)).json()) as { start_url: string; scope: string; icons: { src: string }[] };
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(base);
  expect(new URL(manifest.scope, manifestUrl).href).toBe(base);
  for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, manifestUrl).href)).status(), icon.src).toBe(200);

  // Service worker registers under the sub-path with the sub-path scope.
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(base);

  // Get past onboarding so lazy screens (chunks) are exercised.
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Offline: network off AND the server stopped — everything must come from the service worker.
  await context.setOffline(true);
  await new Promise<void>((r) => server.close(() => r()));
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  for (const hash of ['#/settings', '#/admin', '#/progress', '#/coach', '#/library']) {
    await page.goto(`${base}${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await expect(page.getByTestId('admin-online')).toHaveCount(0); // left the admin page
  await page.goto(`${base}#/admin`);
  await expect(page.getByTestId('admin-online')).toHaveText('Offline');
  await expect(page.getByTestId('admin-offline-ready')).toContainText('Ready');

  // Nothing was ever requested from the site root.
  expect(served.filter((p) => !p.startsWith(PREFIX))).toEqual([]);
  expect(bad).toEqual([]);
});
