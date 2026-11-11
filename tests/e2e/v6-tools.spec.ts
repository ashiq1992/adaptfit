import { expect, test } from '@playwright/test';
import { openDay, openNoteDays, openThisWeek, seed, watchForErrors } from './helpers';

test.describe('Gym tools in the note', () => {
  test('rest timer: starts from the note, keeps running across screens, +30 s, ends with "Rest over"', async ({ page }, info) => {
    const errors = watchForErrors(page);
    await page.clock.install();
    await seed(page, info, openThisWeek);
    await page.getByTestId('today-card').click();
    const restBtn = page.getByRole('button', { name: /^Rest .+: start the timer for / }).first();
    await expect(restBtn).toBeVisible();
    await restBtn.click();
    const bar = page.getByTestId('rest-bar');
    await expect(bar).toBeVisible();
    const start = await page.getByTestId('rest-bar-time').innerText();
    expect(start).toMatch(/^\d+:\d{2}$/);

    // Still running on another screen.
    await page.getByRole('link', { name: 'Progress' }).first().click();
    await expect(bar).toBeVisible();

    await bar.getByRole('button', { name: '+30 s' }).click();
    const [m, s] = start.split(':').map(Number) as [number, number];
    await page.clock.runFor((m * 60 + s + 31) * 1000);
    await expect(bar).toContainText('Rest over');
    await bar.getByRole('button', { name: 'Close' }).click();
    await expect(bar).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('plate calculator: per-side load shows the plates for each side', async ({ page }, info) => {
    await seed(page, info, openThisWeek);
    await openNoteDays(page);
    await openDay(page, 'Upper Body A');
    await page.getByRole('button', { name: 'Plates for Smith machine bench press' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Plates · Smith machine bench press/ });
    // Starts from the last logged weight (the seeded note has no weight written).
    const weight = dialog.getByLabel('Weight on each side (kg)');
    await expect(weight).toHaveValue('30');
    await expect(dialog.locator('.plate')).toHaveText(['25', '5']);
    await weight.fill('42.5');
    await expect(dialog.locator('.plate')).toHaveText(['25', '15', '2.5']);
    await dialog.getByRole('button', { name: 'Done' }).click();
  });

  test('a heavier week: New best on the note and a weekly summary on Plan with Share', async ({ page, context }, info) => {
    const errors = watchForErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, info, openThisWeek);
    await page.goto('/#/week');
    await page.getByTestId('copy-previous').click();
    const first = page.locator('.week-sheet-day').first();
    await first.locator('.sheet-input').first().fill('40 kg/side × 8, 8, 8');
    await first.getByRole('radio', { name: 'Done', exact: true }).click();
    await page.getByTestId('confirm-week').click();
    await expect(page.getByTestId('week-review')).toBeVisible();

    await page.goto('/#/plan');
    const summary = page.getByTestId('week-summary');
    await expect(summary).toContainText('This week in review');
    await expect(summary).toContainText(/1 of \d+/);
    await expect(summary).toContainText('New best');
    await expect(summary).toContainText('Smith machine bench press');
    await summary.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog', { name: 'Share this week' }).getByLabel('Week as text')).toHaveValue(/Smith machine bench press: 40 kg\/side × 8, 8, 8/);
    await page.getByRole('dialog', { name: 'Share this week' }).getByRole('button', { name: 'Close' }).click();

    await openNoteDays(page);
    await openDay(page, 'Upper Body A');
    await expect(page.locator('.note-line').filter({ hasText: 'Smith machine bench press' }).getByTestId('new-best')).toBeVisible();

    // Hiding the summary keeps it hidden.
    await page.goto('/#/plan');
    await summary.getByRole('button', { name: 'Hide this summary' }).click();
    await expect(summary).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(summary).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
