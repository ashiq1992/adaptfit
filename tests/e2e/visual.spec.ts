import { expect, type Page, test } from '@playwright/test';
import { seed } from './helpers';

/**
 * Captures the main and V0.3 screens for visual review against the approved
 * design references, at every required viewport. Screenshots are written to
 * test-results and attached to the report; they are evidence for human
 * review, not proof that features work. Uses the synthetic V0.3 seed.
 */
type Shot = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const SHOTS: Shot[] = [
  { name: 'train', path: '/#/train' },
  {
    name: 'guide-results',
    path: '/#/programmes/guide',
    prepare: async (page) => {
      for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: 'See recommendations' }).click();
      await expect(page.getByTestId('recommendation-card').first()).toBeVisible();
    },
  },
  { name: 'fuel', path: '/#/coach/fuel', prepare: async (page) => void (await expect(page.getByTestId('meal-card').first()).toBeVisible()) },
  { name: 'coach-week', path: '/#/coach' },
  { name: 'progress-bodyweight', path: '/#/progress', prepare: async (page) => page.getByRole('tab', { name: 'Bodyweight' }).click() },
  { name: 'journey-characters', path: '/#/journey', prepare: async (page) => page.getByRole('tab', { name: 'Style' }).click() },
  { name: 'history', path: '/#/train/history' },
  { name: 'settings', path: '/#/settings' },
];

for (const vp of [
  { label: 'w375', width: 375, height: 812 },
  { label: 'w390', width: 390, height: 844 },
  { label: 'w430', width: 430, height: 932 },
  { label: 'w768', width: 768, height: 1024 },
  { label: 'w1280', width: 1280, height: 860 },
]) {
  test(`visual capture ${vp.label}`, async ({ page }, info) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seed(page, info, undefined, 3);
    for (const s of SHOTS) {
      await page.goto(s.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await s.prepare?.(page);
      await page.screenshot({ path: info.outputPath(`${vp.label}-${s.name}.png`), fullPage: true });
    }
    await page.goto('/#/train');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByRole('button', { name: /^Complete set 1/ }).first().click();
    await page.screenshot({ path: info.outputPath(`${vp.label}-workout.png`) });
  });
}
