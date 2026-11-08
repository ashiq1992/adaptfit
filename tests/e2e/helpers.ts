import { writeFileSync } from 'node:fs';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { buildSeedBackup, buildSeedBackupV3 } from './seed';

/** Collect uncaught page errors, console errors, and failed requests. */
export function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => {
    if (!r.url().includes('__offline_probe')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
  return errors;
}

/** Restore the synthetic 8-week history from the welcome screen (exercises the real Restore UI). */
export async function seed(page: Page, info: TestInfo, mutate?: (b: ReturnType<typeof buildSeedBackup>) => void, version: 2 | 3 = 2) {
  const backup = version === 3 ? (buildSeedBackupV3() as unknown as ReturnType<typeof buildSeedBackup>) : buildSeedBackup();
  mutate?.(backup);
  const file = info.outputPath(`seed-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(backup));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to AdaptFit' })).toBeVisible();
  await page.getByTestId('restore-input').setInputFiles(file);
  await page.getByRole('dialog').getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('button', { name: /Start workout|Resume workout/ })).toBeVisible();
  return backup;
}

/** Complete onboarding, choosing how to start the programme. */
export async function onboard(page: Page, routine: 'Recommend a programme' | 'Skip for now' = 'Skip for now', character?: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: 'Next' }).click(); // goal
  await page.getByText(routine, { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click(); // routine
  await page.getByRole('button', { name: 'Next' }).click(); // schedule
  await page.getByRole('button', { name: 'Continue' }).click(); // lifestyle (skipped)
  if (character) await page.getByTestId('character-picker').getByText(character, { exact: true }).click();
  await page.getByRole('button', { name: routine === 'Recommend a programme' ? 'Continue to programme questions' : 'Start training' }).click();
}

export async function startWorkout(page: Page) {
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByTestId('exercise-name')).toBeVisible();
}

export async function setsDone(page: Page): Promise<number> {
  return Number((await page.getByTestId('sets-done').innerText()).split('/')[0]);
}

export async function finishWorkout(page: Page, duration: 'timer' | 'manual' | 'none' = 'none', minutes = '50') {
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (duration === 'manual') {
    await dialog.getByText('Enter duration').click();
    await dialog.getByLabel('Minutes').fill(minutes);
  } else if (duration === 'none') await dialog.getByText("Don't record a duration").click();
  await dialog.getByRole('button', { name: /^Finish (early|workout)$/ }).click();
  await expect(page.getByText('Workout complete', { exact: true })).toBeVisible();
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

/**
 * Scroll to the bottom and confirm the last piece of content ends above the
 * fixed bottom navigation / action bar (nothing important is obscured).
 */
export async function contentClearsFixedBars(page: Page, label = '') {
  // Scroll to the bottom until the page height is stable (lazy content may still be rendering).
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 2;
      }),
    )
    .toBe(true);
  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    const bar = document.querySelector('.bottomnav, .action-bar');
    if (!main || !bar) return { ok: true, detail: 'no fixed bar' };
    const barRect = bar.getBoundingClientRect();
    if (barRect.width < window.innerWidth * 0.5) return { ok: true, detail: 'sidebar layout' };
    const items = Array.from(main.querySelectorAll('button, a, p, h2, li')).filter((el) => (el as HTMLElement).checkVisibility() && !el.closest('.action-bar, .bottomnav'));
    const lastBottom = Math.max(...items.map((el) => el.getBoundingClientRect().bottom));
    const worst = items.find((el) => Math.round(el.getBoundingClientRect().bottom) === Math.round(lastBottom));
    return { ok: lastBottom <= barRect.top + 1, detail: `content ends ${Math.round(lastBottom)}, bar top ${Math.round(barRect.top)} — ${worst?.outerHTML.slice(0, 140)}` };
  });
  expect(result.ok, `${label} ${result.detail}`).toBe(true);
}
