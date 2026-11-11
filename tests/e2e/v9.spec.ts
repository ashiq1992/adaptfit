import { expect, type Page, test } from '@playwright/test';
import { openDay, openNoteDays, seed, watchForErrors } from './helpers';

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } as const;

/** Paste a note through onboarding. */
async function pasteNote(page: Page, note: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: /^Paste from Notes/ }).click();
  await page.getByTestId('import-text').fill(note);
  await page.getByTestId('import-save').click();
}

const THREE_DAYS = 'Monday Push\nSmith bench 30kg/side 3x8\nShoulder press 20kg each 3x10\n\nWednesday Pull\nLat pulldown 45kg 3x10\nCable row 40kg 3x10\n\nFriday Legs\nLeg press 100kg 3x12\nLeg curl 30kg 3x12';

test.describe('A workout note, one day at a time', () => {
  test.use(PHONE);

  test('the note lists its days; a day opens on its own, and edits stay in that day', async ({ page }) => {
    const errors = watchForErrors(page);
    await pasteNote(page, THREE_DAYS);
    const rows = page.getByTestId('day-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Monday Push');
    await expect(rows.nth(0)).toContainText('2 exercises');
    await expect(rows.nth(1)).toContainText('Lat pulldown, Seated cable row');
    // No exercise of any day is editable from the list.
    await expect(page.locator('.note-ex')).toHaveCount(0);

    await rows.filter({ hasText: 'Wednesday Pull' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wednesday Pull');
    await expect(page.locator('.note-day')).toHaveCount(1);
    await expect(page.locator('.note-ex-name')).toHaveText(['Lat pulldown', 'Seated cable row']);
    await expect(page.getByText(/day 2 of 3/)).toBeVisible();

    // Edit the whole day as text: only this day's exercises are in the box.
    await page.getByRole('button', { name: 'Options for Wednesday Pull' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Edit as text' }).click();
    const box = page.locator('.note-textarea');
    const text = await box.inputValue();
    expect(text).toContain('Lat pulldown');
    expect(text).not.toContain('Leg press');
    expect(text).not.toContain('Smith');
    await box.fill(text.replace('3 sets × 10 reps — 45 kg', '3 sets × 10 reps — 50 kg'));
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 10 reps — 50 kg');

    // Next and previous day without going back to the list.
    await page.getByRole('link', { name: /Friday Legs/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Friday Legs');
    await expect(page.locator('.note-ex-name')).toHaveText(['Leg press', 'Leg curl']);
    await page.getByRole('link', { name: /Wednesday Pull/ }).click();
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 10 reps — 50 kg');

    // Other days are untouched.
    await page.getByRole('link', { name: 'All days' }).click();
    await rows.filter({ hasText: 'Monday Push' }).click();
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 8 reps — 30 kg/side');
    expect(errors).toEqual([]);
  });

  test('a day’s questions show on the list, Plan opens today’s day, a new day opens ready to type, deleting returns to the list', async ({ page }) => {
    const errors = watchForErrors(page);
    await pasteNote(page, 'Push\nSmith bench 30kg 3x8\nSmith squat 40kg 3x8\n\nPull\nLat pulldown 45kg 3x10');
    const rows = page.getByTestId('day-row');
    await expect(rows.filter({ hasText: 'Push' }).first()).toContainText('2 to check');
    await expect(rows.filter({ hasText: 'Pull' })).not.toContainText('to check');

    // From Plan, one tap opens a single day.
    await page.goto('/#/plan');
    const todays = (await page.getByTestId('today-card').innerText()).trim();
    await page.getByTestId('today-card').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(todays);
    await expect(page.locator('.note-day')).toHaveCount(1);

    // Add a day: it opens on its own, ready to type.
    await page.getByRole('link', { name: 'All days' }).click();
    await page.getByRole('button', { name: 'Add day' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Day 3');
    await expect(page.locator('.note-textarea')).toBeFocused();
    await page.locator('.note-textarea').fill('Day 3\n\nPlank 3 x 30 s');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.note-ex-name')).toHaveText(['Plank']);

    // Delete it: back on the list, two days left.
    await page.getByRole('button', { name: 'Options for Day 3' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete day…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete day' }).click();
    await expect(rows).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('unsaved typing in a day is reopened on that day, even when the note is opened at its list', async ({ page, context }) => {
    await pasteNote(page, THREE_DAYS);
    await openDay(page, 'Friday Legs');
    await page.locator('.note-ex').first().click();
    await page.locator('.note-textarea').fill('Leg press\n3 sets × 12 reps — 110 kg');
    // As if the app had crashed mid-typing: the unsaved copy is all that is left.
    const drafts = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('adaptfit:draft:')));
    expect(drafts).toHaveLength(1);
    const list = page.url().replace(/\/[^/]+$/, '');
    await page.close();
    const again = await context.newPage();
    await again.addInitScript((d) => {
      for (const [k, v] of d) localStorage.setItem(k, v);
    }, drafts);
    // Opening the note at its list goes straight to that day, with the text back.
    await again.goto(list);
    await expect(again.getByRole('heading', { level: 1 })).toHaveText('Friday Legs');
    await expect(again.getByText('Restored your unsaved edit.')).toBeVisible();
    await expect(again.locator('.note-textarea')).toHaveValue('Leg press\n3 sets × 12 reps — 110 kg');
  });

  test('leaving a day mid-edit saves the typing (nothing is lost)', async ({ page }) => {
    await pasteNote(page, THREE_DAYS);
    await openDay(page, 'Friday Legs');
    await page.locator('.note-ex').first().click();
    await page.locator('.note-textarea').fill('Leg press\n3 sets × 12 reps — 110 kg');
    await page.getByRole('link', { name: 'All days' }).click();
    await openDay(page, 'Friday Legs');
    await expect(page.locator('.note-ex-pres').first()).toHaveText('3 sets × 12 reps — 110 kg');
  });
});

test.describe('UI fixes from the bug folder', () => {
  test.use(PHONE);

  test('Recommend a programme: Back on the first question is usable and leaves the questions', async ({ page }, info) => {
    await seed(page, info);
    await page.goto('/#/library/guide');
    await expect(page.getByText(/Question 1 of/)).toBeVisible();
    const back = page.getByRole('button', { name: 'Back', exact: true });
    await expect(back).toBeEnabled();
    await back.click();
    await expect(page).toHaveURL(/#\/library$/);
  });

  test('Waist: Save waist has space above it, clear of the fields', async ({ page }, info) => {
    await seed(page, info);
    await page.goto('/#/progress');
    await page.getByText('Bodyweight (optional)').click();
    await page.getByText('Waist measurements (optional)').click();
    const field = page.getByLabel('Waist (cm)');
    const save = page.getByRole('button', { name: 'Save waist' });
    const f = (await field.boundingBox())!;
    const b = (await save.boundingBox())!;
    expect(b.y - (f.y + f.height), 'gap between the fields and Save waist').toBeGreaterThanOrEqual(10);
  });

  test('Fuel targets: boxes in a row line up; protein is one from–to field; carbs and fat grouped', async ({ page }, info) => {
    await seed(page, info);
    await page.goto('/#/coach/fuel');
    await page.getByTestId('fuel-targets').getByRole('button', { name: 'Edit' }).click();
    const kcal = page.getByTestId('target-kcal');
    await expect(kcal).toBeVisible();
    await expect(page.getByRole('group', { name: 'Protein per day (g)' })).toBeVisible();
    const from = (await page.getByLabel('Protein from (g)').boundingBox())!;
    const to = (await page.getByLabel('Protein to (g)').boundingBox())!;
    expect(Math.abs(from.y - to.y), 'protein from and to on one line').toBeLessThanOrEqual(1);
    const carbs = (await page.getByLabel('Carbs (g)').boundingBox())!;
    const fat = (await page.getByLabel('Fat (g)').boundingBox())!;
    expect(Math.abs(carbs.y - fat.y), 'carbs and fat boxes level').toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Recalculate carbs and fat from calories' })).toHaveCSS('border-top-style', 'solid');
  });

  test('Coach: AdaptFit Fuel and Sleep and work schedule are both drawn as buttons', async ({ page }, info) => {
    await seed(page, info);
    await page.goto('/#/coach');
    const fuel = page.getByRole('link', { name: 'AdaptFit Fuel' });
    const sleep = page.getByRole('link', { name: 'Sleep and work schedule' });
    for (const l of [fuel, sleep]) {
      const s = await l.evaluate((el) => {
        const c = getComputedStyle(el);
        return { border: c.borderTopColor, width: c.borderTopWidth, bg: c.backgroundColor };
      });
      expect(s.width).not.toBe('0px');
      expect(s.border).not.toBe('rgba(0, 0, 0, 0)');
    }
    const a = await fuel.evaluate((el) => getComputedStyle(el).borderTopColor);
    const b = await sleep.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(a).toBe(b);
  });

  test('every labelled button on the main screens has a visible outline or fill', async ({ page }, info) => {
    await seed(page, info);
    const problems: string[] = [];
    const check = async () => {
      const found = await page.evaluate(() =>
        [...document.querySelectorAll('.btn:not(.btn-icon)')]
          .filter((el) => (el as HTMLElement).offsetParent !== null && (el.textContent ?? '').trim())
          .filter((el) => {
            const c = getComputedStyle(el);
            const noBorder = c.borderTopStyle === 'none' || c.borderTopWidth === '0px' || c.borderTopColor === 'rgba(0, 0, 0, 0)';
            const noFill = c.backgroundColor === 'rgba(0, 0, 0, 0)';
            return noBorder && noFill;
          })
          .map((el) => `${location.hash}: "${(el.textContent ?? '').trim().slice(0, 40)}"`),
      );
      problems.push(...found);
    };
    for (const path of ['/#/plan', '/#/coach', '/#/coach/fuel', '/#/progress', '/#/settings', '/#/week', '/#/library']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await check();
    }
    await openNoteDays(page);
    await check();
    await openDay(page);
    await check();
    expect(problems).toEqual([]);
  });
});
