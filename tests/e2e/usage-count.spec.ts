import { expect, test } from '@playwright/test';
import { seed, watchForErrors } from './helpers';

/**
 * Full loop against a real local counter (`wrangler dev`), so it only runs when one is given:
 *   cd server/pings && npx wrangler dev --port 8787 --var "ALLOWED_ORIGINS:http://127.0.0.1:4175"
 *   VITE_PINGS_URL=http://127.0.0.1:8787 npx vite build --outDir .e2e-pings
 *   E2E_PINGS_URL=http://127.0.0.1:8787 E2E_PINGS_KEY=<ADMIN_KEY from .dev.vars> E2E_PORT=4175 E2E_DIST=.e2e-pings npx playwright test usage-count
 */
const PINGS = process.env.E2E_PINGS_URL;
const KEY = process.env.E2E_PINGS_KEY ?? '';

test.skip(!PINGS, 'needs a local counter (E2E_PINGS_URL)');

test('opt-in count: off by default, one anonymous ping when on, owner sees it, off deletes it', async ({ page }, info) => {
  const errors = watchForErrors(page);
  const sent: { method: string; body: string | null }[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith(PINGS!)) sent.push({ method: r.method(), body: r.postData() });
  });

  await seed(page, info);
  await page.reload();
  await page.waitForTimeout(500);
  expect(sent, 'nothing is sent before opting in').toEqual([]);

  await page.goto('/#/settings');
  await page.getByText('Privacy & about').click();
  const sw = page.getByRole('switch', { name: /Help count active users/ });
  await expect(sw).not.toBeChecked();
  const pinged = page.waitForResponse((r) => r.url() === `${PINGS}/ping` && r.request().method() === 'POST');
  await sw.check();
  expect((await pinged).status()).toBe(204);
  expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1);
  const body = JSON.parse(sent.find((s) => s.method === 'POST')!.body!) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(['id', 'installed', 'v']);

  // Reopening the same day does not send again.
  await page.reload();
  await page.waitForTimeout(500);
  expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1);

  // Owner view on the Admin page.
  await page.goto('/#/admin');
  await page.getByLabel('Owner key').fill('wrong-key');
  await page.getByRole('button', { name: 'Show numbers' }).click();
  await expect(page.getByRole('alert')).toContainText('wasn’t accepted');
  await page.getByLabel('Owner key').fill(KEY);
  await page.getByRole('button', { name: 'Show numbers' }).click();
  const stats = page.getByTestId('admin-stats');
  await expect(stats).toBeVisible();
  const today = Number(await stats.locator('.admin-tile', { hasText: 'Today' }).locator('dd').innerText());
  expect(today).toBeGreaterThanOrEqual(1);

  // Switching off deletes this device's rows.
  await page.goto('/#/settings');
  await page.getByText('Privacy & about').click();
  const deleted = page.waitForResponse((r) => r.url() === `${PINGS}/ping` && r.request().method() === 'DELETE');
  await page.getByRole('switch', { name: /Help count active users/ }).uncheck();
  expect((await deleted).status()).toBe(204);
  await page.goto('/#/admin');
  await page.getByRole('button', { name: 'Show numbers' }).click();
  await expect(stats).toBeVisible();
  expect(Number(await stats.locator('.admin-tile', { hasText: 'Today' }).locator('dd').innerText())).toBe(today - 1);

  // The only expected console line is the browser logging the deliberate wrong-key 401.
  expect(errors.filter((e) => !e.includes('status of 401'))).toEqual([]);
});
