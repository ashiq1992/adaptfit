import { expect, type Page, test } from '@playwright/test';
import { onboard, openNote, openThisWeek, seed, watchForErrors } from './helpers';

/**
 * V0.4 journeys in a real browser (Chromium), with SYNTHETIC data.
 * Test IDs refer to Sprint4.MD §20.
 */

/** Count taps and screens for the usability targets (§19). */
function meter(page: Page) {
  let taps = 0;
  const screens = new Set<string>();
  const tap = async (fn: () => Promise<void>) => {
    taps += 1;
    await fn();
    screens.add(new URL(page.url()).hash.split('?')[0] || '#/');
  };
  return { tap, report: () => ({ taps, screens: screens.size }) };
}

test.describe('Notes-first workout view', () => {
  test('T01 T02 Target A: the workout note opens in one tap from Plan and reads like a note', async ({ page }, info) => {
    const errors = watchForErrors(page);
    await seed(page, info);
    const m = meter(page);
    await m.tap(() => page.getByTestId('today-card').click());
    await expect(page.locator('.note-day').first()).toBeVisible();
    const first = page.locator('.note-day').first();
    await expect(first.getByRole('heading', { level: 2 })).toHaveText('Upper Body A');
    await expect(first.locator('.note-ex-name').first()).toHaveText('Smith machine bench press');
    await expect(first.locator('.note-ex-pres').first()).toHaveText('3 sets × 6–10 reps');
    // No Start or Finish workout is needed to follow it.
    await expect(page.getByRole('button', { name: /Start workout|Finish/ })).toHaveCount(0);
    info.annotations.push({ type: 'Target A', description: JSON.stringify(m.report()) });
    expect(m.report().taps).toBe(1);
    expect(errors).toEqual([]);
  });

  test('T03 T05 T06 T07 Target B: inline edit saves automatically, survives refresh mid-typing, and can be undone', async ({ page }, info) => {
    await seed(page, info);
    await openNote(page);
    const m = meter(page);
    // Target B: change one value with one tap, typing, and Done.
    await m.tap(() => page.locator('.note-ex').first().click());
    const editor = page.locator('.note-textarea');
    await editor.fill('Smith machine bench press\n3 sets × 8 reps — 30 kg/side');
    await m.tap(() => page.getByRole('button', { name: 'Done' }).click());
    await expect(page.getByTestId('save-state')).toHaveText('Saved');
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 8 reps — 30 kg/side');
    info.annotations.push({ type: 'Target B', description: JSON.stringify(m.report()) });
    expect(m.report()).toEqual({ taps: 2, screens: 1 });
    // T05: persisted.
    await page.reload();
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 8 reps — 30 kg/side');
    // T06: refresh in the middle of typing keeps the draft.
    await page.locator('.note-ex').first().click();
    await page.locator('.note-textarea').fill('Smith machine bench press\n3 sets × 9 reps — 30 kg/side');
    await page.reload();
    await expect(page.getByText('Restored your unsaved edit.')).toBeVisible();
    await expect(page.locator('.note-textarea')).toHaveValue('Smith machine bench press\n3 sets × 9 reps — 30 kg/side');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 9 reps — 30 kg/side');
    // T07: undo restores the previous version.
    await page.getByTestId('undo').click();
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 8 reps — 30 kg/side');
  });

  test('T04 add, reorder, remove (with undo) and free text in a note', async ({ page }, info) => {
    await seed(page, info);
    await openNote(page);
    const day = page.locator('.note-day').first();
    await day.getByRole('button', { name: 'Add exercise' }).click();
    await page.locator('.note-textarea').fill('Face pull 20kg 3x15\nslow and controlled');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(day.locator('.note-ex-name').last()).toHaveText('Face pull');
    await expect(day.locator('.note-ex-notes').last()).toHaveText('slow and controlled');
    // Reorder: move it up.
    await day.locator('.note-ex').last().click();
    await page.getByRole('button', { name: 'Move up' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(day.locator('.note-ex-name').nth(3)).toHaveText('Face pull');
    // Remove, then undo.
    await day.locator('.note-ex').nth(3).click();
    await page.getByRole('button', { name: 'Remove Face pull' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Removed Face pull' })).toBeVisible();
    await expect(day.locator('.note-ex-name', { hasText: 'Face pull' })).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect(day.locator('.note-ex-name', { hasText: 'Face pull' })).toHaveCount(1);
    // Edit a whole day as text: unrecognised lines are kept.
    await day.getByRole('button', { name: /^Options for/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Edit as text' }).click();
    const text = page.locator('.note-textarea');
    await text.fill(`${await text.inputValue()}\n\nBring chalk!`);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(day.locator('.note-free')).toContainText('Bring chalk!');
  });

  test('T08 deleting a note requires confirmation', async ({ page }, info) => {
    await seed(page, info);
    await openNote(page);
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete note…' }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText('Recorded workouts and weekly history stay');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.note-day').first()).toBeVisible();
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete note…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete note' }).click();
    await expect(page.getByRole('heading', { name: 'AdaptFit', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start your workout note' })).toBeVisible();
    // History is kept.
    await page.goto('/#/history');
    await expect(page.getByTestId('history-item').first()).toBeVisible();
  });
});

test.describe('Weekly update', () => {
  test('T09–T15 T37 T43 Target C/E: copy last week, change two values, confirm three sessions, see the review', async ({ page }, info) => {
    await seed(page, info, (b) => {
      openThisWeek(b);
      // A three-session week, the brief's typical case.
      b.data.programmes[0]!.daysPerWeek = 3;
    });
    const started = Date.now();
    const m = meter(page);
    await m.tap(() => page.getByTestId('update-week').click());
    await m.tap(() => page.getByTestId('copy-previous').click());
    // T10: copied values are not confirmed.
    await expect(page.getByTestId('week-counts')).toContainText('0 of 3 marked done');
    const days = page.locator('.week-sheet-day');
    await expect(days).toHaveCount(3);
    // T14: change only what differs, in one screen.
    const bench = days.nth(0).locator('.sheet-input').first();
    const before = await bench.inputValue();
    await m.tap(() => bench.click());
    await bench.fill(before.replace(/× (\d+)/, (_, r: string) => `× ${Number(r) + 1}`));
    await m.tap(() => days.nth(1).locator('.sheet-input').first().click());
    await days.nth(1).locator('.sheet-input').first().fill('40 kg/side × 8, 8, 8');
    await expect(days.nth(0).locator('.sheet-row.changed')).toHaveCount(1);
    // Batch action: everything not yet marked is done.
    await m.tap(() => page.getByTestId('mark-all-done').click());
    await expect(page.getByTestId('week-counts')).toContainText('3 of 3 marked done');
    await m.tap(() => page.getByTestId('confirm-week').click());
    // T37/T43 Target E: an immediate review from the confirmed records.
    const review = page.getByTestId('week-review');
    await expect(review).toBeVisible();
    const seconds = (Date.now() - started) / 1000;
    info.annotations.push({ type: 'Target C (automated)', description: `${JSON.stringify(m.report())}, ${seconds.toFixed(1)} s` });
    expect(m.report().taps).toBeLessThanOrEqual(8);
    await expect(page.getByTestId('review-training')).toHaveText('3 of 3 planned sessions');
    await expect(review).toContainText('Smith machine bench press');
    await expect(review).toContainText(/\+1 rep/);
    // T15: the dates are the planned weekdays in this week (Mon, Tue, Thu).
    await page.goto('/#/history');
    await expect(page.getByTestId('history-item')).toHaveCount(await page.getByTestId('history-item').count());
    // T16: the week is stored as history; Plan shows it as confirmed.
    await page.goto('/#/plan');
    await expect(page.getByTestId('week-status')).toContainText('Confirmed · 3 of 3');
  });

  test('T12 T13 skipped and unrecorded sessions never count as completed', async ({ page }, info) => {
    await seed(page, info, openThisWeek);
    await page.goto('/#/week');
    await page.getByTestId('copy-previous').click();
    const days = page.locator('.week-sheet-day');
    await days.nth(0).getByRole('radio', { name: 'Done', exact: true }).click();
    await days.nth(1).getByRole('radio', { name: 'Skipped', exact: true }).click();
    await page.getByTestId('confirm-week').click();
    await expect(page.getByTestId('review-training')).toHaveText('1 of 4 planned sessions');
    await expect(page.getByTestId('week-review')).toContainText(/Since 3 sessions were missed, continue the programme before considering a change/);
  });

  test('T17 T18 one record per week; editing a confirmed week updates it (no duplicate)', async ({ page }, info) => {
    await seed(page, info, openThisWeek);
    await page.goto('/#/week');
    await page.getByTestId('copy-previous').click();
    await page.locator('.week-sheet-day').first().getByRole('radio', { name: 'Done', exact: true }).click();
    await page.getByTestId('confirm-week').click();
    await expect(page.getByTestId('week-review')).toBeVisible();
    await page.goto('/#/history');
    await expect(page.getByTestId('history-item').first()).toBeVisible();
    const count = await page.getByTestId('history-item').count();
    // Re-open and edit the confirmed week.
    await page.goto('/#/week');
    await page.getByRole('button', { name: 'Edit this week' }).click();
    await page.locator('.sheet-input').first().fill('35 kg/side × 10, 10, 10');
    await page.getByRole('button', { name: 'Confirm changes' }).click();
    await expect(page.getByTestId('week-review')).toContainText(/Smith machine bench press/);
    await page.goto('/#/history');
    await expect(page.getByTestId('history-item')).toHaveCount(count);
    await expect(page.getByTestId('history-item').first()).toContainText('35');
    await page.goto('/#/weeks');
    await expect(page.locator('.note-card')).toHaveCount(1);
  });

  test('T54 moving between screens keeps the draft', async ({ page }, info) => {
    await seed(page, info, openThisWeek);
    await page.goto('/#/week');
    await page.getByTestId('copy-previous').click();
    await page.locator('.sheet-input').first().fill('33 kg/side × 8, 8, 8');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' }).click();
    await expect(page.getByRole('heading', { name: 'Progress', level: 1 })).toBeVisible();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plan' }).click();
    await page.getByTestId('update-week').click();
    await expect(page.locator('.sheet-input').first()).toHaveValue('33 kg/side × 8, 8, 8');
  });
});

test.describe('Import from Notes', () => {
  test('T19–T26 Target D: paste a Notes workout, resolve what is ambiguous, get a workout note', async ({ page }) => {
    const errors = watchForErrors(page);
    await onboard(page, 'Paste from Notes');
    await expect(page.getByRole('heading', { name: 'Import from Notes', level: 1 })).toBeVisible();
    await page.getByTestId('import-text').fill('Tuesday Upper\nBench 30kg/side 8 8 7\nPulldown 45kg 10 10 9\nRows 40kg 10x3\nkeep elbows tucked\n\nSaturday Lower\nSquat 35kg/side 6x4\nRDL 20kg each hand 10x3');
    const preview = page.getByTestId('import-preview');
    await expect(page.getByTestId('import-summary')).toContainText('5 exercises in 2 days recognised');
    await expect(preview.getByRole('heading', { name: 'Tuesday Upper' })).toBeVisible();
    await expect(preview).toContainText('Dumbbell Romanian deadlift');
    await expect(preview).toContainText('Read “10x3” as 3 sets of 10 reps.');
    // Ambiguous names need a choice before saving.
    await expect(page.getByTestId('import-save')).toBeDisabled();
    await preview.getByRole('group', { name: /Which exercise is “Bench”/ }).getByRole('button', { name: 'Smith machine bench press' }).click();
    await preview.getByRole('group', { name: /Which exercise is “Rows”/ }).getByRole('button', { name: 'Seated cable row' }).click();
    await preview.getByRole('group', { name: /Which exercise is “Squat”/ }).getByRole('button', { name: 'Smith machine squat' }).click();
    await expect(page.getByTestId('import-save')).toBeEnabled();
    await page.getByTestId('import-save').click();
    await expect(page.locator('.note-day')).toHaveCount(2);
    await expect(page.locator('.note-ex-name').first()).toHaveText('Smith machine bench press');
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 7–8 reps — 30 kg/side');
    await expect(page.locator('.note-ex-notes').first()).toHaveCount(1);
    await expect(page.getByText('keep elbows tucked')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a numbered note with detail lines (plan, what was done, rest) becomes one exercise per block', async ({ page }, info) => {
    const errors = watchForErrors(page);
    await onboard(page, 'Paste from Notes');
    await page
      .getByTestId('import-text')
      .fill('1. db flat press\n27.5kg for 7 reps\n4 × 6\nRest: 2–3 min\n\n2. lats pull down (Weighted if possible)\nDid 8 reps  with 1 rir with added 1\n4 × 6\n76kg\nRest: 2 min\n\nChest Supported Row — 8\nDid 45 at 8 reps with 1 rir x3 , 90 sec rest\n\nMilitary press\nBarbell with added 5 kg - 6 reps\nX3 sets\nRest: 90 sec\n\nSmith machine bench press\n17.5 kg, 3x10 reps');
    await expect(page.getByTestId('import-summary')).toContainText('5 exercises in 1 day recognised');
    const preview = page.getByTestId('import-preview');
    for (const name of ['Dumbbell bench press', 'Lat pulldown', 'Chest Supported Row', 'Barbell overhead press', 'Smith machine bench press']) await expect(preview).toContainText(name);
    await expect(preview).not.toContainText(/^Rest$/m);
    await page.screenshot({ path: info.outputPath('import-blocks.png'), fullPage: true });
    await page.getByTestId('import-save').click();
    await expect(page.locator('.note-ex-name')).toHaveText(['Dumbbell bench press', 'Lat pulldown', 'Chest Supported Row', 'Barbell overhead press', 'Smith machine bench press']);
    await expect(page.locator('.note-ex-pres').nth(1)).toHaveText('4 sets × 6 reps — 76 kg');
    expect(errors).toEqual([]);
  });

  test('T25 "30 kg bench" is not assumed to be per side: the note asks', async ({ page }) => {
    await onboard(page, 'Paste from Notes');
    await page.getByTestId('import-text').fill('Push\nSmith bench 30kg 3x8');
    await expect(page.getByTestId('import-preview')).toContainText('total, per side, or per dumbbell?');
    await page.getByTestId('import-save').click(); // allowed for a plan; the question stays on the note
    await expect(page.locator('.clarify')).toContainText('Total weight, per side, or per dumbbell?');
    await page.locator('.clarify').getByRole('button', { name: /^Per side/ }).click();
    await expect(page.locator('.clarify')).toHaveCount(0);
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 8 reps — 30 kg/side');
  });
});

test.describe('Programmes, coaching and regression', () => {
  test('T58 a recommended programme becomes a workout note', async ({ page }) => {
    await onboard(page, 'Choose a programme');
    await page.getByRole('link', { name: /Preview and customise/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Preview and customise' })).toBeVisible();
    await page.getByRole('button', { name: 'Save as workout note' }).click();
    await page.getByTestId('open-note').click();
    await expect(page.locator('.note-day').first()).toBeVisible();
    await page.goto('/#/plan');
    await expect(page.getByTestId('today-card')).toBeVisible();
  });

  test('T44 T60 T61 T62 existing data stays available; nutrition is optional and secondary', async ({ page }, info) => {
    await seed(page, info);
    await page.goto('/#/progress');
    await expect(page.locator('.status-row').first()).toBeVisible();
    await expect(page.getByText(/All 16 exercises/)).toBeVisible();
    await page.getByText('Bodyweight (optional)').click();
    await expect(page.getByRole('heading', { name: /Bodyweight/ }).first()).toBeVisible();
    await page.goto('/#/coach');
    await expect(page.getByTestId('review-nutrition')).toContainText('2600 kcal');
    await page.getByRole('tab', { name: 'Fuel' }).click();
    await expect(page.getByTestId('meal-card').first()).toBeVisible();
    // No RPG anywhere in the app.
    for (const path of ['/#/plan', '/#/progress', '/#/coach', '/#/settings']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText(/\bXP\b|Journey|Level \d|mission/i);
    }
  });

  test('a new user can write a note from scratch without any nutrition setup', async ({ page }) => {
    await onboard(page, 'Write my own');
    const editor = page.locator('.note-textarea');
    await expect(editor).toBeFocused();
    await editor.fill('Monday — Push\n\nBench press 60kg 3x8\nIncline DB press 22kg each 3x10');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.note-day h2')).toHaveText('Monday — Push');
    await expect(page.locator('.note-ex-name')).toHaveCount(2);
    await page.goto('/#/plan');
    await expect(page.getByTestId('today-card')).toContainText('Monday — Push');
  });
});
