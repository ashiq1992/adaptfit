import { writeFileSync } from 'node:fs';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { addDays, localDateOf } from '../../src/domain/dates';
import { buildSeedBackup, buildSeedBackupV3, SEED_TZ } from './seed';

/** Seed mutation: remove workouts in the current week so it can be updated in the weekly sheet. */
export function openThisWeek(b: ReturnType<typeof buildSeedBackup>) {
  const today = localDateOf(new Date(), SEED_TZ);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = addDays(today, -((dow + 6) % 7));
  b.data.sessions = b.data.sessions.filter((s) => !s.completedLocalDate || s.completedLocalDate < monday);
}

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

/**
 * Restore the synthetic 8-week history from the welcome screen (exercises the
 * real Restore UI and the V0.2/V0.3 → V0.4 restore migration).
 */
export async function seed(page: Page, info: TestInfo, mutate?: (b: ReturnType<typeof buildSeedBackup>) => void, version: 2 | 3 = 3) {
  const backup = version === 3 ? (buildSeedBackupV3() as unknown as ReturnType<typeof buildSeedBackup>) : buildSeedBackup();
  mutate?.(backup);
  const file = info.outputPath(`seed-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(backup));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to AdaptFit' })).toBeVisible();
  await page.getByText('Coming back? Restore a backup').click();
  await page.getByTestId('restore-input').setInputFiles(file);
  await page.getByRole('dialog').getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByTestId('update-week')).toBeVisible();
  return backup;
}

export type StartChoice = 'Paste from Notes' | 'Choose a programme' | 'Write my own' | 'Skip for now';

/** First run: units and goal, then how to start. */
export async function onboard(page: Page, start: StartChoice = 'Skip for now') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  if (start === 'Skip for now') await page.getByRole('button', { name: 'Skip for now' }).click();
  else await page.getByRole('button', { name: new RegExp(`^${start}`) }).click();
}

/** Open today's day of the current note (one tap from Plan). */
export async function openNote(page: Page) {
  await page.goto('/#/plan');
  await page.getByTestId('today-card').click();
  await expect(page.locator('.note-day').first()).toBeVisible();
}

/** The current note's list of days, for editing it (Plan → "Edit"). */
export async function openNoteDays(page: Page) {
  await page.goto('/#/plan');
  await page.getByRole('link', { name: /^Edit / }).click();
  await expect(page.getByTestId('day-row').first()).toBeVisible();
}

/** Name of the suggested workout on Plan. */
export async function todaysName(page: Page): Promise<string> {
  return (await page.getByTestId('today-card').locator('.workout-card-name').innerText()).trim();
}

/** Open one day from the note's list of days (the first, or by name). */
export async function openDay(page: Page, name?: string | RegExp) {
  const rows = page.getByTestId('day-row');
  await (name ? rows.filter({ hasText: name }).first() : rows.first()).click();
  await expect(page.locator('.note-day')).toBeVisible();
}

/** Optional live logging from a day's menu. */
export async function startLive(page: Page, dayName?: string) {
  if (dayName) {
    await openNoteDays(page);
    await openDay(page, dayName);
  }
  await page.getByRole('button', { name: /^Options for/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Log sets live (optional)' }).click();
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
  await expect(page.getByText('Workout saved', { exact: true })).toBeVisible();
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
    const items = Array.from(main.querySelectorAll('button, a, p, h2, li, input')).filter((el) => (el as HTMLElement).checkVisibility() && !el.closest('.action-bar, .bottomnav, .toast'));
    const lastBottom = Math.max(...items.map((el) => el.getBoundingClientRect().bottom));
    const worst = items.find((el) => Math.round(el.getBoundingClientRect().bottom) === Math.round(lastBottom));
    return { ok: lastBottom <= barRect.top + 1, detail: `content ends ${Math.round(lastBottom)}, bar top ${Math.round(barRect.top)} — ${worst?.outerHTML.slice(0, 140)}` };
  });
  expect(result.ok, `${label} ${result.detail}`).toBe(true);
}
