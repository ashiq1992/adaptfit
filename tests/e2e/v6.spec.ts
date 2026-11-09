import { expect, test } from '@playwright/test';
import { onboard, openThisWeek, seed, watchForErrors } from './helpers';

test.describe('V0.6 features', () => {
  test('same answer for all: answering one loading question offers it for the others loaded the same way', async ({ page }) => {
    const errors = watchForErrors(page);
    await onboard(page, 'Paste from Notes');
    await page.getByTestId('import-text').fill('Push\nSmith bench 30kg 3x8\nSmith squat 40kg 3x8\nSmith bench 32.5kg 3x6');
    await page.getByTestId('import-save').click();
    await expect(page.locator('.clarify')).toHaveCount(3);

    await page.locator('.clarify').first().getByRole('button', { name: /^Per side/ }).click();
    const offer = page.getByTestId('same-answer');
    await expect(offer).toContainText('Also use “Per side” for the 2 other machine exercises still asking?');
    await offer.getByRole('button', { name: 'Apply to 2' }).click();
    await expect(page.locator('.clarify')).toHaveCount(0);
    await expect(page.locator('.note-ex-pres')).toHaveText(['3 sets × 8 reps — 30 kg/side', '3 sets × 8 reps — 40 kg/side', '3 sets × 6 reps — 32.5 kg/side']);
    expect(errors).toEqual([]);
  });

  test('declining the offer changes nothing else', async ({ page }) => {
    await onboard(page, 'Paste from Notes');
    await page.getByTestId('import-text').fill('Push\nSmith bench 30kg 3x8\nSmith squat 40kg 3x8');
    await page.getByTestId('import-save').click();
    await page.locator('.clarify').first().getByRole('button', { name: /^Total/ }).click();
    await page.getByTestId('same-answer').getByRole('button', { name: 'No' }).click();
    await expect(page.getByTestId('same-answer')).toHaveCount(0);
    await expect(page.locator('.clarify')).toHaveCount(1);
  });

  test('share a confirmed week as text', async ({ page, context }, info) => {
    const errors = watchForErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, info, openThisWeek);
    await page.goto('/#/week');
    await page.getByTestId('copy-previous').click();
    await page.locator('.week-sheet-day').first().getByRole('radio', { name: 'Done', exact: true }).click();
    await page.getByTestId('confirm-week').click();
    await expect(page.getByTestId('week-review')).toBeVisible();
    await page.getByTestId('share-week').click();
    const dialog = page.getByRole('dialog', { name: 'Share this week' });
    const text = await dialog.getByLabel('Week as text').inputValue();
    expect(text).toMatch(/^Week of \d{1,2} \w{3}/);
    expect(text).toMatch(/Smith machine bench press: 30 kg\/side × /);
    expect(text).toContain('Logged with AdaptFit');
    await dialog.getByRole('button', { name: 'Copy' }).click();
    await expect(dialog.getByText('Copied.')).toBeVisible();
    // The OS clipboard may use its own line endings.
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(text);
    expect(errors).toEqual([]);
  });

  test('text shared in from another app opens Import pre-filled, and the address is cleaned', async ({ page }) => {
    await onboard(page);
    await expect(page.getByRole('heading', { name: /Start your/ })).toBeVisible();
    await page.goto('/?title=Leg%20day&text=Leg%20day%0ALeg%20press%20150kg%203x10');
    await expect(page.getByRole('heading', { level: 1, name: 'Import from Notes' })).toBeVisible();
    await expect(page.getByTestId('import-text')).toHaveValue('Leg day\nLeg press 150kg 3x10');
    await expect(page.getByText('Shared from another app.')).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await expect(page.getByTestId('import-preview')).toContainText('Leg press');
  });

  test('Paste button fills the box from the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await onboard(page, 'Paste from Notes');
    await page.evaluate(() => navigator.clipboard.writeText('Pull\nLat pulldown 60kg 3x10'));
    await page.getByTestId('import-paste').click();
    await expect(page.getByTestId('import-text')).toHaveValue('Pull\nLat pulldown 60kg 3x10');
    await expect(page.getByTestId('import-preview')).toContainText('Lat pulldown');
  });

  test('the installed app offers itself as a share target (Android)', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.share_target).toEqual({ action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } });
  });
});
