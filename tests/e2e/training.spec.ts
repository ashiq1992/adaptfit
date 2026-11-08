import { expect, test } from '@playwright/test';
import { finishWorkout, onboard, seed, setsDone, startWorkout, watchForErrors } from './helpers';

test('T49 first-time onboarding reaches Train and offers the three ways to create a programme', async ({ page }) => {
  const errors = watchForErrors(page);
  await onboard(page, 'Skip for now');
  const card = page.getByTestId('setup-card');
  await expect(card.getByRole('link', { name: 'Recommend a programme' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Use my existing programme' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Build from scratch' })).toBeVisible();
  await expect(page.getByTestId('level')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('T50 create a four-day hypertrophy programme from routine text', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByText('Build muscle', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Use my existing programme', { exact: true }).click();
  await page.getByLabel('Paste your routine').fill(
    [
      'Upper Body A', 'Smith bench 3x6-10', 'Lat pulldown 3x8-12', 'Seated cable row 3x8-12', 'Lateral raises 3x12-15',
      'Lower Body A', 'Smith squat 3x6-10', 'Leg curl 3x10-15',
      'Upper Body B', 'Incline dumbbell press 3x8-12', 'Dumbbell row 3x8-12',
      'Lower Body B', 'Leg press 3x8-12', 'Squat 3x5-8',
    ].join('\n'),
  );
  await expect(page.getByText(/Found 4 days and 10 exercises/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start training' }).click();

  // "Squat" is ambiguous, so the editor opens for the user to choose the variation.
  await expect(page.getByRole('heading', { name: 'Edit programme' })).toBeVisible();
  await page.getByRole('button', { name: 'Save programme' }).click();
  await expect(page.getByRole('alert')).toContainText('choose an exercise for "Squat"');
  const lowerB = page.locator('details.day-card').nth(3);
  await lowerB.locator('summary').click();
  await lowerB.getByLabel('Exercise 2').selectOption({ label: 'Smith machine squat' });
  await lowerB.getByText('★ Priority lift').first().click();
  // Duplicate a day, then remove the copy again.
  await page.locator('details.day-card').first().getByRole('button', { name: 'Duplicate day' }).click();
  await expect(page.locator('details.day-card')).toHaveCount(5);
  await page.locator('details.day-card').nth(1).locator('summary').click();
  await page.locator('details.day-card').nth(1).getByRole('button', { name: 'Delete day' }).click();
  await page.getByLabel('Programme name').fill('My 4-day hypertrophy');
  await page.getByRole('button', { name: 'Save programme' }).click();
  await expect(page.getByRole('heading', { name: 'Upper Body A' })).toBeVisible();

  // Persists after refresh and is editable.
  await page.reload();
  await page.goto('/#/settings');
  await page.getByText('Training programmes', { exact: true }).click();
  await expect(page.locator('.pe-row').getByText('My 4-day hypertrophy', { exact: true })).toBeVisible();
  await expect(page.getByText(/4 days · 4× per week/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('T51 T52 T53 start a workout, confirm a prefilled set in one tap, edit values, and finish', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  const keyLift = (await page.getByTestId('last-session').innerText()).trim();
  await startWorkout(page);

  // T52: the first set is prefilled from last session and not yet done.
  const first = page.getByTestId('set-row').first();
  await expect(first).toContainText('From last session — not done yet');
  await expect(first).toContainText(keyLift.split(' × ')[0]!);
  expect(await setsDone(page)).toBe(0);
  await first.getByRole('button', { name: /^Complete set 1/ }).click();
  await expect(first).toContainText('Done');
  await expect.poll(() => setsDone(page)).toBe(1);

  // T53: edit load with + and type an arbitrary rep value on set 2.
  const second = page.getByTestId('set-row').nth(1);
  await second.getByRole('button', { name: 'Edit set 2' }).click();
  const weight = page.getByRole('textbox', { name: /^Weight/ });
  const before = Number(await weight.inputValue());
  await page.getByRole('button', { name: 'Increase Weight' }).click();
  await expect(weight).toHaveValue(String(before + 2.5));
  const reps = page.getByRole('textbox', { name: /^Reps/ });
  await reps.fill('13');
  await reps.press('Enter');
  await expect(second).toContainText(`${before + 2.5} kg × 13`);
  await second.getByRole('button', { name: /^Complete set 2/ }).click();
  await expect.poll(() => setsDone(page)).toBe(2);

  // Different exercises keep their own values.
  await page.locator('.up-next button').nth(1).click();
  await expect(page.getByTestId('set-row').first()).not.toContainText(`${before + 2.5} kg × 13`);

  // T51: finish with a manually entered duration.
  await finishWorkout(page, 'manual', '52');
  await expect(page.getByTestId('xp-earned')).toContainText('XP');
  await page.getByRole('link', { name: 'View history' }).click();
  const latest = page.getByTestId('history-item').first();
  await expect(latest).toContainText('52 min (entered)');
  await expect(latest).toContainText('2 strength sets');
  expect(errors).toEqual([]);
});

test('T60 draft persists after refresh, skip and add/delete sets work, no duplicate sessions', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await startWorkout(page);
  await page.getByRole('button', { name: /^Complete set 1/ }).first().click();
  await expect.poll(() => setsDone(page)).toBe(1);
  await page.getByRole('button', { name: 'Add set' }).click();
  await expect(page.getByTestId('set-row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Edit set 4' }).click();
  await page.getByRole('button', { name: 'Delete set 4' }).click();
  await expect(page.getByTestId('set-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Skip exercise' }).click();
  await expect(page.getByText('Skipped. Completing a set will un-skip it.')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('exercise-name')).toBeVisible();
  expect(await setsDone(page)).toBe(1);
  await expect(page.getByText('Skipped. Completing a set will un-skip it.')).toBeVisible();

  // Pause and resume the timer.
  await page.getByRole('button', { name: 'Pause workout timer' }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout timer' }).click();

  // Going back to Train offers Resume, not a second workout.
  await page.goto('/#/train');
  await page.getByRole('button', { name: 'Resume workout' }).click();
  await expect(page.getByTestId('exercise-name')).toBeVisible();
  const active = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('adaptfit');
        req.onsuccess = () => {
          const all = req.result.transaction('sessions').objectStore('sessions').getAll();
          all.onsuccess = () => resolve((all.result as { state: string }[]).filter((s) => s.state === 'active').length);
        };
      }),
  );
  expect(active).toBe(1);
  expect(errors).toEqual([]);
});
