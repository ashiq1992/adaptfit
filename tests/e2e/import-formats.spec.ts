import { expect, type Page, test } from '@playwright/test';
import { onboard, watchForErrors } from './helpers';

/**
 * Notes pasted from Apple Notes / Google Keep / chats, imported as a plan and
 * as history. What was logged must be kept exactly, apart from the plan, and
 * nothing may be invented (dates, units, bar weight, sets).
 */

/** The user's own note (a regression case). */
const USER_NOTE = `1. db flat press
27.5kg for 7 reps
4 × 6
Rest: 2–3 min

2. lats pull down (Weighted if possible)
Did 8 reps  with 1 rir with added 1
4 × 6
76kg
Rest: 2 min

Chest Supported Row — 8
Did 45 at 8 reps with 1 rir x3 , 90 sec rest`;

const PER_SET = `12 Oct 2025
• Barbell bench 60kg x 8, 65kg x 6, 70kg x 5
• Lat pd 50kg 3x12 felt easy`;

const WARM_UPS = `☐ Tuesday
BB squat
warmup 40x10
100kg x 5
105kg x 5
A1. DB curl 12kg 3x12
A2. Triceps pushdown 25kg 3x12`;

async function paste(page: Page, text: string) {
  await onboard(page, 'Paste from Notes');
  await expect(page.getByRole('heading', { name: 'Import from Notes', level: 1 })).toBeVisible();
  await page.getByTestId('import-text').fill(text);
}

const mode = (page: Page, label: string) => page.getByRole('radio', { name: label }).check();

test.describe('Import formats', () => {
  test('the user’s note as a plan: plan and what was done are shown apart, and both are kept', async ({ page }) => {
    const errors = watchForErrors(page);
    await paste(page, USER_NOTE);
    await expect(page.getByTestId('import-summary')).toContainText('3 exercises in 1 day recognised');
    const preview = page.getByTestId('import-preview');
    const db = preview.locator('.import-entry').nth(0);
    await expect(db.locator('.note-ex-name')).toHaveText('Dumbbell bench press');
    await expect(db.locator('.note-ex-pres')).toHaveText('4 sets × 6 reps — 27.5 kg/dumbbell (?)');
    await expect(db.locator('.note-ex-last')).toContainText('Did');
    await expect(db.locator('.note-ex-last')).toContainText('27.5 kg/dumbbell × 7 (?)');
    await expect(db).toContainText('total, per side, or per dumbbell?');
    const row = preview.locator('.import-entry').nth(2);
    await expect(row.locator('.note-ex-name')).toContainText('Chest Supported Row');
    await expect(row.locator('.note-ex-last')).toContainText('45 kg × 8, 8, 8');
    await expect(row).toContainText('No unit written for 45 — read as kg');

    await page.getByTestId('import-save').click();
    await expect(page).toHaveURL(/#\/note\//);
    await expect(page.locator('.note-ex-name')).toHaveText(['Dumbbell bench press', 'Lat pulldown', 'Chest Supported Row']);
    await expect(page.locator('.note-ex-pres').nth(1)).toHaveText('4 sets × 6 reps — 76 kg');
    await expect(page.getByText('Logged: 27.5 kg/dumbbell × 7')).toBeVisible();
    await expect(page.getByText('Logged: 76 kg × 8')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the user’s note as history: needs a date and the loading answers, then records exactly what was done', async ({ page }) => {
    const errors = watchForErrors(page);
    await paste(page, USER_NOTE);
    await mode(page, 'Add to my training history');
    const preview = page.getByTestId('import-preview');
    await expect(preview).toContainText('Choose the date these workouts were done');
    await expect(page.getByTestId('import-save')).toBeDisabled();
    await page.getByLabel('Date of these workouts').fill('2025-10-12');
    await preview.locator('.import-entry').nth(0).getByRole('button', { name: /^Per dumbbell/ }).click();
    await preview.locator('.import-entry').nth(2).getByRole('button', { name: /^Total/ }).click();
    await expect(page.getByTestId('import-save')).toBeEnabled();
    await page.getByTestId('import-save').click();
    await expect(page).toHaveURL(/#\/history/);
    const item = page.getByTestId('history-item');
    await expect(item).toHaveCount(1);
    await item.locator('.hist-summary').click();
    const ex = item.locator('.hist-ex');
    await expect(ex.nth(0).locator('.set-tag')).toHaveCount(1);
    await expect(ex.nth(0).locator('.set-tag')).toContainText('27.5');
    await expect(ex.nth(1).locator('.set-tag')).toContainText('76');
    await expect(ex.nth(2).locator('.set-tag')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test('a weight for each set (“60kg x 8, 65kg x 6, 70kg x 5”) is recorded set by set, on the date written', async ({ page }) => {
    const errors = watchForErrors(page);
    await paste(page, PER_SET);
    await mode(page, 'Add to my training history');
    const preview = page.getByTestId('import-preview');
    await expect(preview.locator('.import-entry').nth(0).locator('.note-ex-pres')).toHaveText('60 kg × 8; 65 kg × 6; 70 kg × 5');
    await expect(preview.locator('.import-entry').nth(1).locator('.note-ex-name')).toHaveText('Lat pulldown');
    await expect(preview).toContainText('felt easy');
    await expect(page.getByTestId('import-save')).toBeEnabled(); // the date is in the note
    await page.getByTestId('import-save').click();
    await expect(page).toHaveURL(/#\/history/);
    const item = page.getByTestId('history-item');
    await expect(item).toHaveCount(1);
    await item.locator('.hist-summary').click();
    const tags = item.locator('.hist-ex').nth(0).locator('.set-tag');
    await expect(tags).toHaveCount(3);
    await expect(tags.nth(0)).toContainText('60');
    await expect(tags.nth(1)).toContainText('65');
    await expect(tags.nth(2)).toContainText('70');
    expect(errors).toEqual([]);
  });

  test('warm-ups stay notes, superset labels are kept, checklist marks are ignored', async ({ page }) => {
    const errors = watchForErrors(page);
    await paste(page, WARM_UPS);
    await expect(page.getByTestId('import-summary')).toContainText('3 exercises in 1 day recognised');
    const preview = page.getByTestId('import-preview');
    await expect(preview.getByRole('heading', { name: 'Tuesday' })).toBeVisible();
    const squat = preview.locator('.import-entry').nth(0);
    await expect(squat.locator('.note-ex-pres')).toHaveText('100 kg × 5; 105 kg × 5');
    await expect(squat).toContainText('Warm-up kept as a note, not recorded as a working set.');
    await page.getByTestId('import-save').click();
    await expect(page).toHaveURL(/#\/note\//);
    await expect(page.locator('.note-ex-name')).toHaveText(['Barbell back squat', 'Dumbbell biceps curl', 'Triceps pushdown']);
    await expect(page.getByText('warmup 40x10')).toBeVisible();
    await expect(page.getByText('A1', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
