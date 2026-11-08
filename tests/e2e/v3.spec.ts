import { expect, type Page, test } from '@playwright/test';
import { contentClearsFixedBars, noHorizontalOverflow, onboard, seed, setsDone, watchForErrors } from './helpers';

/** Answer the guided questionnaire with the defaults reused from onboarding. */
async function answerQuestionnaire(page: Page) {
  await expect(page.getByRole('heading', { name: 'Recommend a programme', level: 1 })).toBeVisible();
  await expect(page.getByText('Question 1 of 5')).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'See recommendations' }).click();
  await expect(page.getByTestId('recommendation-card').first()).toBeVisible();
}

for (const vp of [
  { id: 'T67', label: 'desktop', width: 1280, height: 860 },
  { id: 'T68', label: 'mobile', width: 390, height: 844 },
]) {
  test(`${vp.id} T73 guided programme onboarding on ${vp.label}, with a planned starting weight`, async ({ page }) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await onboard(page, 'Recommend a programme', 'Engineer');
    await answerQuestionnaire(page);
    await noHorizontalOverflow(page);
    // 4 days available → the 4-day split ranks first, with reasons, trade-offs, and an honest duration.
    const best = page.getByTestId('recommendation-card').first();
    await expect(best).toContainText('Upper / Lower Split');
    await expect(best).toContainText('Why it was recommended');
    await expect(best).toContainText(/~\d+ min per session/);
    // Compare alternatives, including the mismatch explanation for 5 days.
    await page.getByRole('button', { name: /Compare all 5 templates/ }).click();
    await expect(page.getByRole('table')).toContainText('Too many days');
    await page.getByRole('button', { name: 'Show top matches' }).click();
    await best.getByRole('button', { name: 'Preview and customise' }).click();

    // Customise: swap an exercise, set a starting weight, keep the rest.
    await expect(page.getByRole('heading', { name: 'Preview and customise' })).toBeVisible();
    const first = page.getByTestId('guided-exercise').first();
    await expect(first).toContainText('Barbell bench press');
    await first.getByTestId('planned-load-Barbell bench press').fill('60');
    await first.getByTestId('planned-load-Barbell bench press').blur();
    await expect(first).toContainText('60 kg total');
    await page.getByRole('button', { name: 'Save programme' }).click();
    await expect(page.getByTestId('programme-saved')).toBeVisible();
    await expect(page.getByTestId('fuel-prompt')).toContainText('Would you like AdaptFit to calculate your calorie and protein needs');
    await page.getByRole('button', { name: 'Not now' }).click();

    // Train follows the new programme; the planned load prefills but isn't completed.
    await expect(page.getByRole('heading', { name: 'Upper A' })).toBeVisible();
    await expect(page.getByTestId('fuel-prompt')).toHaveCount(0);
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByTestId('exercise-name')).toHaveText('Barbell bench press');
    await expect(page.getByText('Planned starting weight — not done yet').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Complete set 1/ }).first()).toHaveAccessibleName(/60/);
    expect(await setsDone(page)).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('T70 T22 nutrition can be skipped and started later', async ({ page }) => {
  const errors = watchForErrors(page);
  await onboard(page, 'Recommend a programme');
  await answerQuestionnaire(page);
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: 'Preview and customise' }).click();
  await page.getByRole('button', { name: 'Save programme' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await page.goto('/#/coach/fuel');
  await expect(page.getByTestId('fuel-intro')).toContainText('You chose “Not now” earlier');
  await page.getByRole('button', { name: 'Personalise my nutrition' }).click();
  await expect(page.getByTestId('fuel-setup')).toContainText('Step 1 of 6');
  // Resumable: leave and come back to the same step.
  await page.getByLabel('Age (years)').fill('34');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByTestId('fuel-setup')).toContainText('Step 2 of 6');
  await page.goto('/#/train');
  await page.goto('/#/coach/fuel');
  await expect(page.getByTestId('fuel-setup')).toContainText('Step 2 of 6');
  expect(errors).toEqual([]);
});

test('T69 T71 T72 nutrition opt-in, calorie calculation, target editing, cook/buy, and meal swaps', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info); // existing V0.2 user: programme and history, no nutrition yet
  await page.getByTestId('fuel-prompt').getByRole('button', { name: 'Yes, personalise my nutrition' }).click();
  await expect(page).toHaveURL(/#\/coach\/fuel$/);
  await page.getByLabel('Age (years)').fill('30');
  await page.getByLabel('Height (cm)').fill('176');
  await page.getByText('Male equation', { exact: true }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  // Bodyweight is reused from the log (migrated from V0.2 measurements), not asked again.
  await expect(page.getByTestId('reused-bodyweight')).toContainText('from your bodyweight log');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  const est = page.getByTestId('energy-estimate');
  await expect(est).toContainText('Resting energy (est.)');
  await expect(est).toContainText(/Maintenance range \(est\.\)\s*\d{4}–\d{4} kcal/);
  await page.getByTestId('target-kcal').fill('2700');
  await expect(page.getByText('Using your edited targets.')).toBeVisible();
  await page.getByRole('button', { name: 'Use these targets' }).click();
  await page.getByText('A mixture of both', { exact: true }).click();
  await page.getByText('Dinner', { exact: true }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByText('Malay', { exact: true }).click();
  await page.getByText('Chinese', { exact: true }).click();
  // Halal was noted in V0.2 and is reused — preselected, not asked again.
  await expect(page.getByRole('checkbox', { name: 'Halal' })).toBeChecked();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByTestId('meal-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Save nutrition profile' }).click();

  await expect(page.getByTestId('fuel-targets')).toContainText('2700 kcal');
  const cards = page.getByTestId('meal-card');
  await expect(cards).toHaveCount(3);
  // Mixed eating: dinner is cooked, the others are bought.
  await expect(cards.nth(2).getByRole('button', { name: 'Cook' })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.nth(0).getByRole('button', { name: 'Buy' })).toHaveAttribute('aria-pressed', 'true');
  // Eating-out nutrition is never invented.
  await expect(cards.nth(0).getByTestId('meal-nutrition')).toContainText('Nutrition estimate unavailable');
  await expect(cards.nth(0)).toContainText('AdaptFit does not verify certification');
  // Swap and switch cook/buy.
  const before = await cards.nth(1).getAttribute('data-meal');
  await cards.nth(1).getByRole('button', { name: 'Swap' }).click();
  await expect.poll(() => cards.nth(1).getAttribute('data-meal')).not.toBe(before);
  await cards.nth(1).getByRole('button', { name: 'Cook' }).click();
  await expect(cards.nth(1).getByRole('button', { name: 'Cook' })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards.nth(1).getByTestId('meal-nutrition')).toContainText(/kcal|unavailable/);
  // Portions and favourites.
  await cards.nth(1).getByRole('button', { name: 'Larger portion' }).click();
  await expect(cards.nth(1)).toContainText('1.25×');
  await cards.nth(1).getByRole('button', { name: 'Favourite' }).click();
  await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible();
  await expect(page.getByTestId('daily-totals')).toContainText(/covers \d of 3 meals|Nutrition estimate unavailable/);
  // Survives a refresh.
  const swapped = await cards.nth(1).getAttribute('data-meal');
  await page.reload();
  await expect(page.getByTestId('meal-card').nth(1)).toHaveAttribute('data-meal', swapped!);
  expect(errors).toEqual([]);
});

test('T74 bodyweight recording, editing, deleting, and trend', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await page.getByRole('tab', { name: 'Bodyweight' }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const list = page.getByTestId('bodyweight-list').locator('li');
  await expect(list).toHaveCount(5); // migrated from V0.2 measurements
  const form = page.getByTestId('bodyweight-form');
  await form.getByLabel('Bodyweight', { exact: true }).fill('abc');
  await form.getByRole('button', { name: 'Save entry' }).click();
  await expect(form.getByRole('alert')).toHaveText('Bodyweight must be a number.');
  await form.getByLabel('Bodyweight', { exact: true }).fill('75.6');
  await form.getByLabel('Note (optional)').fill('morning');
  await form.getByRole('button', { name: 'Save entry' }).click();
  await expect(list).toHaveCount(6);
  await expect(list.first()).toContainText('75.6 kg');
  await list.first().getByRole('button', { name: /^Edit entry/ }).click();
  await page.getByTestId('bodyweight-form').getByLabel('Bodyweight', { exact: true }).fill('75.9');
  await page.getByTestId('bodyweight-form').getByRole('button', { name: 'Save changes' }).click();
  await expect(list.first()).toContainText('75.9 kg');
  await expect(page.getByTestId('bodyweight-chart').getByRole('img', { name: /^Bodyweight:/ })).toBeVisible();
  await expect(page.getByTestId('weekly-averages').locator('li').first()).toBeVisible();
  await expect(page.getByTestId('bodyweight-trend')).toContainText(/Trending up|Roughly stable|Not enough data/);
  await list.first().getByRole('button', { name: /^Delete entry/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete entry' }).click();
  await expect(list).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('T75 character selection and switching keep XP and achievements', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Journey', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Journey', level: 1 })).toBeVisible();
  const level = await page.getByTestId('level').innerText();
  const xp = await page.getByTestId('xp-text').innerText();
  await page.getByRole('tab', { name: 'Style' }).click();
  await expect(page.getByTestId('character-picker').locator('label')).toHaveCount(4);
  await page.getByTestId('character-picker').getByText('Ranger', { exact: true }).click();
  await expect(page.getByTestId('character-preview')).toContainText('Preview: Ranger');
  await page.getByTestId('confirm-character').click();
  await expect(page.getByRole('img', { name: /Your ranger at level \d+/ })).toBeVisible();
  await expect(page.getByTestId('level')).toHaveText(level);
  await expect(page.getByTestId('xp-text')).toHaveText(xp);
  await page.reload();
  await expect(page.getByRole('img', { name: /Your ranger at level/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Achievements' }).click();
  await expect(page.getByTestId('ach-first-workout')).toContainText('Earned');
  expect(errors).toEqual([]);
});

test('T76 Coach weekly summary uses one consistent schedule and includes nutrition context', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.getByRole('link', { name: 'Coach', exact: true }).click();
  await expect(page.getByTestId('week-count')).toContainText(/\d+ of 4 planned workouts/);
  await expect(page.getByTestId('planner-normal')).toContainText('Normally 4 sessions a week');
  await expect(page.getByTestId('review-nutrition')).toContainText('Nutrition: not set up (optional)');
  await expect(page.getByTestId('review-nutrition')).toContainText('Bodyweight:');
  await page.getByRole('tab', { name: 'Insights' }).click();
  await expect(page.getByTestId('no-plateau').or(page.getByTestId('recommendation').first())).toBeVisible();
  expect(errors).toEqual([]);
});

test('T77 navigation across all tabs and settings', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info, undefined, 3);
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [link, heading] of [
    ['Progress', 'Progress'],
    ['Coach', 'Coach'],
    ['Journey', 'Journey'],
    ['Train', /Good (morning|afternoon|evening)!|Late session\?/],
  ] as const) {
    await nav.getByRole('link', { name: new RegExp(`^${link}`) }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
  await page.getByRole('link', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await page.getByText('Nutrition preferences (AdaptFit Fuel)').click();
  await page.getByRole('button', { name: 'Open AdaptFit Fuel' }).click();
  await expect(page.getByTestId('fuel-targets')).toBeVisible();
  await page.getByRole('tab', { name: 'This Week' }).click();
  await expect(page).toHaveURL(/#\/coach$/);
  expect(errors).toEqual([]);
});

test('T78 new screens never sit under the mobile bottom navigation', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await seed(page, info, undefined, 3);
  for (const [path, tab] of [
    ['/#/coach/fuel', null],
    ['/#/progress', 'Bodyweight'],
    ['/#/journey', 'Style'],
    ['/#/programmes/guide', null],
  ] as const) {
    await page.goto(path);
    if (tab) await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    await contentClearsFixedBars(page, path);
  }
});

test('T79 Fuel and bodyweight work offline', async ({ page, context }, info) => {
  await seed(page, info, undefined, 3);
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-offline-ready', 'true', { timeout: 30_000 });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto('/#/coach/fuel');
  await expect(page.getByTestId('meal-card').first()).toBeVisible();
  await page.getByTestId('meal-card').first().getByRole('button', { name: 'Swap' }).click();
  await page.goto('/#/programmes/guide');
  await expect(page.getByRole('heading', { name: 'Recommend a programme' })).toBeVisible();
  await page.goto('/#/progress');
  await page.getByRole('tab', { name: 'Bodyweight' }).click();
  await page.getByTestId('bodyweight-form').getByLabel('Bodyweight', { exact: true }).fill('75');
  await page.getByTestId('bodyweight-form').getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByTestId('bodyweight-list')).toContainText('75 kg');
  await context.setOffline(false);
});

test('T80 existing V0.2 user: history, programme, XP, and measurements carry over', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info); // a V0.2 backup goes through the V0.2 → V0.3 migration
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await page.goto('/#/train/history');
  await expect(page.getByTestId('history-item').first()).toBeVisible();
  expect(await page.getByTestId('history-item').count()).toBeGreaterThan(20);
  await page.goto('/#/journey');
  expect(Number(await page.getByTestId('level').innerText())).toBeGreaterThan(1);
  await expect(page.getByRole('img', { name: /Your warrior at level/ })).toBeVisible();
  await page.goto('/#/settings');
  await page.getByText('Training programmes', { exact: true }).click();
  await expect(page.locator('.pe-row').getByText('Upper / Lower (example)', { exact: true })).toBeVisible();
  await page.getByText('Nutrition preferences (AdaptFit Fuel)').click();
  await expect(page.getByText(/Notes from V0.2 are kept \(halal\)/)).toBeVisible();
  expect(errors).toEqual([]);
});
