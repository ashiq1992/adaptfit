import { expect, test } from '@playwright/test';
import { seed, watchForErrors } from './helpers';

test('T54 T55 History lists workouts with real comparisons and expandable details', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'History', level: 1 })).toBeVisible();
  const cards = page.getByTestId('history-item');
  expect(await cards.count()).toBeGreaterThan(20);
  const first = cards.first();
  await expect(first).toContainText('Completed');
  await expect(first).toContainText(/\d+ exercises · \d+ strength sets · 4\d min/);
  await first.locator('.hist-summary').click();
  await expect(first.locator('.hist-ex').first()).toBeVisible();
  await expect(first.getByText(/^Previous: /).first()).toBeVisible();

  // The very first session has no comparisons — never invented.
  const last = cards.last();
  await last.locator('.hist-summary').click();
  await expect(last.getByText('First record of this exercise — no comparison yet.').first()).toBeVisible();

  // Filter by exercise.
  await page.getByRole('button', { name: 'Filter history' }).click();
  await page.getByLabel('Exercise').selectOption({ label: 'Leg press' });
  const filtered = await cards.count();
  expect(filtered).toBeGreaterThan(3);
  expect(filtered).toBeLessThan(12);
  expect(errors).toEqual([]);
});

test('T56 Progress shows strength progression from saved data', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress', level: 1 })).toBeVisible();
  await expect(page.getByTestId('metric-sessions')).not.toHaveText('0');
  await page.getByRole('combobox').first().selectOption({ label: 'Smith machine bench press' });
  await expect(page.getByRole('img', { name: /Smith machine bench press top set/ })).toBeVisible();
  await expect(page.locator('.big-change')).toContainText('%');
  await page.getByRole('button', { name: '4W' }).click();
  await page.getByRole('tab', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: 'Est. 1RM' }).click();
  await expect(page.getByRole('table')).toContainText('kg/side');
  await page.getByRole('tab', { name: 'Consistency' }).click();
  await expect(page.getByRole('img', { name: /Sessions per week/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('T57 Journey shows character progression, stats with explanations, and achievements', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Journey', exact: true }).click();
  await expect(page.getByRole('img', { name: /Your warrior at level \d+/ })).toBeVisible();
  const level = Number(await page.getByTestId('level').innerText());
  expect(level).toBeGreaterThan(1);
  await page.getByTestId('stat-str').click();
  await expect(page.getByText('Verified personal records on comparable lifts.')).toBeVisible();
  await expect(page.getByText(/Next unlock/)).toBeVisible();
  await page.getByRole('tab', { name: 'Achievements' }).click();
  await expect(page.getByTestId('ach-first-workout')).toContainText('Earned');
  await page.getByRole('tab', { name: 'Missions' }).click();
  await expect(page.getByTestId('mission-planned')).toBeVisible();

  // Gamification can be turned off without affecting training.
  await page.goto('/#/settings');
  await page.getByText('Gamification', { exact: true }).click();
  await page.getByRole('switch', { name: /Show character, XP, and missions/ }).click();
  await page.goto('/#/journey');
  await expect(page.getByText('Gamification is off')).toBeVisible();
  await page.goto('/#/train');
  await expect(page.locator('.hero-char')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('T58 Coach reviews the week and flags a possible plateau with context questions', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByTestId('week-status')).toBeVisible();
  await page.getByRole('tab', { name: 'Insights' }).click();
  const rec = page.getByTestId('recommendation');
  await expect(rec).toHaveCount(1); // only priority lifts are raised automatically
  await expect(rec).toContainText('Lat pulldown');
  await expect(rec).toContainText('Possible plateau — additional context needed.');
  await expect(page.getByTestId('watch-list')).toBeVisible();
  await rec.getByRole('group').first().getByRole('button', { name: 'Yes' }).click();
  await expect(rec).toContainText(/Consider a lighter week|Review recovery|Check training consistency/);
  await rec.getByRole('button', { name: 'Later' }).click();
  await expect(page.getByTestId('recommendation')).toHaveCount(0);
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByTestId('rec-history-item')).toContainText('postponed');
  expect(errors).toEqual([]);
});

test('T59 apply a reduced-week schedule adjustment', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByTestId('available-sessions')).toHaveText('4 / 4');
  await page.getByRole('button', { name: 'Fewer sessions' }).click();
  await page.getByRole('button', { name: 'Fewer sessions' }).click();
  await page.getByRole('button', { name: 'Propose adjusted week' }).click();
  const proposal = page.getByTestId('week-proposal');
  await expect(proposal).toContainText('Trade-offs');
  await expect(proposal).toContainText('not extra work crammed into fewer days');
  await proposal.getByRole('button', { name: 'Apply plan' }).click();
  await expect(page.getByTestId('approved-week')).toContainText('2 of 4 sessions');
  await page.getByRole('link', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  expect(errors).toEqual([]);
});
