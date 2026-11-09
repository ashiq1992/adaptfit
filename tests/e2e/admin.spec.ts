import { expect, test } from '@playwright/test';
import { seed, watchForErrors } from './helpers';

// This spec covers builds without the optional usage counter (the default); usage-count.spec.ts covers builds with it.
test.skip(!!process.env.E2E_PINGS_URL, 'build has the usage counter');

/** On-device Admin page: honest "this device only" diagnostics, and no network calls to anyone else. */
test('admin page shows this device only, with counts from seeded data and no third-party requests', async ({ page, baseURL }, info) => {
  const errors = watchForErrors(page);
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });

  await seed(page, info);

  // Reached from Settings → Privacy & about.
  await page.goto('/#/settings');
  await page.getByText('Privacy & about').click();
  await page.getByRole('link', { name: /^Admin:/ }).click();
  await expect(page).toHaveURL(/#\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toBeVisible();

  await expect(page.getByTestId('admin-device-only')).toContainText('This page shows this device only.');
  await expect(page.getByTestId('admin-device-only')).toContainText("AdaptFit has no accounts or server, so it can't see other people.");
  await expect(page.getByTestId('admin-version')).toHaveText(/^\d+\.\d+\.\d+/);
  await expect(page.getByTestId('admin-db-version')).toContainText('version 5');

  const counts = page.getByTestId('admin-counts');
  await expect(counts).toBeVisible();
  const sessions = await counts.getByRole('row', { name: /Workout sessions/ }).locator('td').innerText();
  expect(Number(sessions)).toBeGreaterThan(0);
  await expect(page.getByTestId('admin-first-use')).not.toHaveText('—');
  await expect(page.getByTestId('admin-last-activity')).not.toHaveText('—');
  await expect(page.getByTestId('admin-online')).toHaveText('Online');
  await expect(page.getByTestId('admin-standalone')).toContainText('No');
  await expect(page.getByRole('heading', { name: 'See all users (needs a server)' })).toBeVisible();

  // The storage button is an explicit user action (persist() is never called automatically).
  const keep = page.getByRole('button', { name: 'Keep my data on this device' });
  if (await keep.isVisible()) {
    await keep.click();
    await expect(page.getByTestId('admin-persist-msg')).toHaveText(/Done|declined|does not offer/);
  }

  // Back link returns to Settings.
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

  expect(foreign, 'requests to other origins').toEqual([]);
  expect(errors).toEqual([]);
});
