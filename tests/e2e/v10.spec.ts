import { expect, type Page, test } from '@playwright/test';
import { watchForErrors } from './helpers';

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } as const;

async function pasteNote(page: Page, note: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: /^Paste from Notes/ }).click();
  await page.getByTestId('import-text').fill(note);
  await page.getByTestId('import-save').click();
  await expect(page.getByTestId('day-row').first()).toBeVisible();
}

// Day names without weekdays, so the suggestion is the rotation ("Next up").
const NOTE = 'Push\nSmith bench 30kg/side 3x8\nShoulder press 20kg each 3x10\n\nPull\nLat pulldown 45kg 3x10\nCable row 40kg 3x10\n\nLegs\nLeg press 100kg 3x12\nLeg curl 30kg 3x12';

test.describe('Home: your workouts, ready to log', () => {
  test.use(PHONE);

  test('every workout is listed; doing a different one than suggested is one tap to log, with Undo', async ({ page }) => {
    const errors = watchForErrors(page);
    await pasteNote(page, NOTE);
    await page.goto('/#/plan');

    const cards = page.locator('.workout-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('Next up');
    await expect(page.getByRole('button', { name: 'Log Push' })).toHaveClass(/btn-primary/);
    await expect(page.getByTestId('week-status')).toContainText('0 of 3 workouts');
    // No weekday circles: a missed weekday is never shown as a failure.
    await expect(page.locator('.week-strip')).toHaveCount(0);

    // Today it's Pull instead: one tap opens the log, filled in from the note.
    await page.getByRole('button', { name: 'Log Pull' }).click();
    const dialog = page.getByRole('dialog', { name: 'Log Pull' });
    await expect(dialog.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    const lat = dialog.getByLabel('Lat pulldown', { exact: true });
    await expect(lat).toHaveValue('45 kg × 10, 10, 10');
    await lat.fill('50 kg × 10, 10, 8');
    await dialog.getByTestId('log-save').click();

    await expect(page.getByTestId('logged-toast')).toContainText('Pull logged for today.');
    await expect(cards.nth(1)).toContainText('Done today');
    await expect(page.getByTestId('week-status')).toContainText('1 of 3 workouts');
    await expect(page.getByTestId('week-done')).toContainText('Pull');
    // The suggestion follows what was done, not the calendar: after Pull comes Legs.
    await expect(cards.nth(2)).toContainText('Next up');

    // Undo removes it.
    await page.getByTestId('logged-toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('week-status')).toContainText('0 of 3 workouts');
    await expect(cards.nth(1)).not.toContainText('Done today');
    expect(errors).toEqual([]);
  });

  test('a day page logs too, starts from last time, warns before logging the same day twice, and has a back button', async ({ page }) => {
    const errors = watchForErrors(page);
    await pasteNote(page, NOTE);
    await page.goto('/#/plan');
    await page.getByRole('button', { name: 'Log Legs' }).click();
    const first = page.getByRole('dialog', { name: 'Log Legs' });
    await first.getByLabel('Leg press', { exact: true }).fill('110 kg × 12, 12, 10');
    await first.getByRole('button', { name: 'Skipped Leg curl' }).click();
    await first.getByTestId('log-save').click();
    await expect(page.getByTestId('logged-toast')).toBeVisible();

    await page.getByTestId(/today-card|workout-card/).filter({ hasText: 'Legs' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Legs');
    await page.getByRole('button', { name: 'Log this workout' }).click();
    const again = page.getByRole('dialog', { name: 'Log Legs' });
    await expect(again.getByLabel('Leg press', { exact: true })).toHaveValue('110 kg × 12, 12, 10');
    await expect(again.getByRole('status')).toContainText('Already logged');
    await again.getByRole('button', { name: 'Yesterday' }).click();
    await expect(again.getByText('Already logged')).toHaveCount(0);
    await again.getByRole('button', { name: 'Cancel' }).click();

    // Back, named for where it goes, at the top and at the end of the day.
    await expect(page.getByRole('link', { name: 'Workouts', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to your workouts' }).click();
    await expect(page).toHaveURL(/#\/plan$/);
    await expect(page.getByTestId('week-status')).toContainText('1 of 3 workouts');
    expect(errors).toEqual([]);
  });
});
