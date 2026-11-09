import { expect, type Page, test } from '@playwright/test';
import { openThisWeek, seed } from './helpers';

/**
 * Captures the eight main screens required by the Sprint 4 brief at every
 * required width, using the synthetic seed. Screenshots are evidence for
 * human review (written to test-results), not proof that features work.
 * Set SHOTS_DIR to also copy them into docs.
 */
type Shot = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const SHOTS: Shot[] = [
  { name: '1-plan', path: '/#/plan' },
  { name: '2-workout-note', path: '/#/plan', prepare: async (page) => page.getByTestId('today-card').click() },
  {
    name: '3-weekly-update',
    path: '/#/week',
    prepare: async (page) => {
      await page.getByTestId('copy-previous').click();
      const first = page.locator('.week-sheet-day').first();
      await first.getByRole('radio', { name: 'Done', exact: true }).click();
      await first.locator('.sheet-input').first().fill('27.5 kg/side × 9, 8, 8');
    },
  },
  {
    name: '4-notes-import',
    path: '/#/import',
    prepare: async (page) => {
      await page.getByTestId('import-text').fill('Tuesday Upper\nBench 30kg 8 8 7\nPulldown 45kg 10 10 9\nRows 40kg 10x3\nkeep elbows tucked\n\nSaturday Lower\nSquat 35kg/side 6x4\nRDL 20kg each hand 10x3');
      await page.getByText('Use as my workout plan').click();
    },
  },
  { name: '5-progress', path: '/#/progress' },
  { name: '6-coach', path: '/#/coach' },
  { name: '7-programme-library', path: '/#/library' },
  { name: '8-settings', path: '/#/settings' },
  {
    name: '9-settings-expanded',
    path: '/#/settings',
    prepare: async (page) => {
      await page.evaluate(() => document.querySelectorAll<HTMLDetailsElement>('.settings-group').forEach((d) => (d.open = true)));
    },
  },
];

const VIEWPORTS = [
  { label: 'w375', width: 375, height: 812 },
  { label: 'w390', width: 390, height: 844 },
  { label: 'w430', width: 430, height: 932 },
  { label: 'w768', width: 768, height: 1024 },
  { label: 'w1280', width: 1280, height: 860 },
];

for (const vp of VIEWPORTS) {
  test(`visual capture ${vp.label}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seed(page, info, openThisWeek);
    for (const s of SHOTS) {
      await page.goto(s.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await s.prepare?.(page);
      await page.waitForTimeout(250); // let the 180 ms screen transition settle
      const file = info.outputPath(`${vp.label}-${s.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${vp.label}-${s.name}.png`, fullPage: true });
    }
  });
}

/** The same eight screens in the Night theme, at a typical phone width. */
test('visual capture w390 night', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, info, openThisWeek);
  await page.evaluate(() => localStorage.setItem('adaptfit:theme', 'night'));
  for (const s of SHOTS) {
    await page.goto(s.path);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await s.prepare?.(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: info.outputPath(`w390-night-${s.name}.png`), fullPage: true });
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/w390-night-${s.name}.png`, fullPage: true });
  }
});
