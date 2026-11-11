import { expect, type Page, test } from '@playwright/test';
import { watchForErrors } from './helpers';

/** Paste a note through onboarding and land on it. */
async function pasteNote(page: Page, note: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: /^Paste from Notes/ }).click();
  await page.getByTestId('import-text').fill(note);
  await page.getByTestId('import-save').click();
  await expect(page.locator('.note-ex').first()).toBeVisible();
}

const LONG_DAY = 'Upper\n\n' + Array.from({ length: 8 }, (_, i) => `${['Lat pulldown', 'Cable row', 'Smith machine bench press', 'Lateral raise', 'Face pull', 'Triceps pushdown', 'Dumbbell curl', 'Leg press'][i]}\n3 sets × 10 reps — ${40 + i} kg\nkeep the reps slow and controlled, full range of motion on every rep`).join('\n\n');

test.describe('phone: editing a whole day', () => {
  test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

  test('typing in the middle of a long day keeps the screen where it is (no jump to the top or to Done)', async ({ page }) => {
    const errors = watchForErrors(page);
    await pasteNote(page, LONG_DAY);
    await page.getByRole('button', { name: /^Options for / }).first().tap();
    await page.getByRole('button', { name: 'Edit as text' }).tap();
    const box = page.locator('.note-textarea');
    await expect(box).toBeFocused();
    expect(await box.evaluate((t: HTMLTextAreaElement) => t.scrollHeight - t.clientHeight), 'whole day visible, no inner scrolling').toBeLessThanOrEqual(1);

    // Put the caret in the middle (Face pull) and scroll so that line is on screen, like a person would.
    const at = await box.evaluate((t: HTMLTextAreaElement) => {
      const i = t.value.indexOf('Face pull') + 'Face pull'.length;
      t.setSelectionRange(i, i);
      return i;
    });
    expect(at).toBeGreaterThan(20);
    await page.evaluate(() => {
      const t = document.querySelector('.note-textarea') as HTMLTextAreaElement;
      const r = t.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top + r.height / 2 - 250);
    });
    const before = await page.evaluate(() => window.scrollY);
    await box.pressSequentially(' (rope)');
    await box.press('Enter');
    await box.pressSequentially('elbows high');
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before), 'screen stays put while typing mid-text').toBeLessThanOrEqual(40);
    expect(await box.inputValue()).toContain('Face pull (rope)\nelbows high');

    // Near the end of the note, deleting text must not pull the page up either.
    await box.evaluate((t: HTMLTextAreaElement) => t.setSelectionRange(t.value.length, t.value.length));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const atEnd = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 12; i++) await box.press('Backspace');
    const afterDelete = await page.evaluate(() => window.scrollY);
    expect(atEnd - afterDelete, 'no jump towards the top when the text gets shorter').toBeLessThanOrEqual(80);

    await page.getByRole('button', { name: 'Done' }).tap();
    await expect(page.locator('.note-ex-name').filter({ hasText: 'Face pull' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Rest between sets', () => {
  test('defaults to 1:30, can be changed per exercise in its text, in the day text, and for the whole note', async ({ page }) => {
    const errors = watchForErrors(page);
    await pasteNote(page, 'Pull\nLat pulldown 45 kg 3x10\nCable row 40 kg 3x10');
    const restBtn = (name: string) => page.locator('.note-line').filter({ hasText: name }).getByRole('button', { name: /^Rest / });
    await expect(restBtn('Lat pulldown')).toHaveText(/Rest 1 min 30 s/);

    // One exercise: the text shows "Rest 1:30"; change it.
    await page.locator('.note-ex').filter({ hasText: 'Lat pulldown' }).click();
    const box = page.locator('.note-textarea');
    await expect(box).toHaveValue(/\nRest 1:30$/);
    await box.fill((await box.inputValue()).replace('Rest 1:30', 'Rest 2 min'));
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(restBtn('Lat pulldown')).toHaveText(/Rest 2 min/);
    await expect(restBtn('Cable row')).toHaveText(/Rest 1 min 30 s/);

    // Whole day as text.
    await page.getByRole('button', { name: /^Options for / }).first().click();
    await page.getByRole('button', { name: 'Edit as text' }).click();
    const day = await box.inputValue();
    expect(day).toContain('Lat pulldown\n3 sets × 10 reps — 45 kg\nRest 2 min');
    await box.fill(day.replace(/(cable row[^]*?)Rest 1:30/i, '$1Rest 45 s'));
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(restBtn('Cable row')).toHaveText(/Rest 45 s/);

    // Every exercise at once, from the note menu.
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('button', { name: 'Rest between sets…' }).click();
    await page.getByRole('dialog', { name: 'Rest between sets' }).getByRole('button', { name: /^3 min/ }).click();
    await expect(restBtn('Lat pulldown')).toHaveText(/Rest 3 min/);
    await expect(restBtn('Cable row')).toHaveText(/Rest 3 min/);
    await restBtn('Cable row').click();
    await expect(page.getByTestId('rest-bar-time')).toHaveText(/^0?(3:00|2:59)$/);
    expect(errors).toEqual([]);
  });

  test('timed exercises get a countdown for the hold', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.clock.install();
    await pasteNote(page, 'Core\nPlank 3 x 30 s');
    const btn = page.getByRole('button', { name: /^Time 30 s: start a 30 s timer for Plank/ });
    await btn.click();
    const bar = page.getByTestId('rest-bar');
    await expect(bar).toContainText('Timer · Plank');
    await page.clock.runFor(31_000);
    await expect(bar).toContainText('Time');
    await expect(bar).not.toContainText('Rest over');
    // The alarm rings until a tap anywhere; the bar stays until Close.
    await expect(bar).toHaveAttribute('data-ringing', 'true');
    await expect(bar).toContainText('Tap to stop');
    await page.locator('.note-day').first().click({ position: { x: 5, y: 5 } });
    await expect(bar).not.toHaveAttribute('data-ringing', 'true');
    await expect(bar).toContainText('Go');
    await bar.getByRole('button', { name: 'Close' }).click();
    await expect(bar).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the alarm stops by itself after 30 s if nobody taps', async ({ page }) => {
    await page.clock.install();
    await pasteNote(page, 'Core\nPlank 3 x 30 s');
    await page.getByRole('button', { name: /^Time 30 s/ }).click();
    const bar = page.getByTestId('rest-bar');
    await page.clock.runFor(31_000);
    await expect(bar).toHaveAttribute('data-ringing', 'true');
    await page.clock.runFor(31_000);
    await expect(bar).not.toHaveAttribute('data-ringing', 'true');
    await expect(bar).toContainText('Time');
  });
});

test.describe('Timer alarm settings', () => {
  test('sound, vibration and a 5-second test; choices are remembered', async ({ page }) => {
    const errors = watchForErrors(page);
    // Count beeps actually scheduled on the audio output.
    await page.addInitScript(() => {
      const w = window as unknown as { __beeps: number };
      w.__beeps = 0;
      const orig = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...a: Parameters<typeof orig>) {
        w.__beeps++;
        return orig.apply(this, a);
      };
    });
    await page.clock.install();
    await pasteNote(page, 'Pull\nLat pulldown 45 kg 3x10');
    await page.goto('/#/settings');
    const group = page.locator('#timer-alarm');
    await group.locator('summary').click();
    await expect(group).toContainText('Sound + Vibration');
    const test = group.getByTestId('test-alarm');
    await test.click();
    await expect(test).toHaveText('Ringing… tap to stop');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __beeps: number }).__beeps), { message: 'three beeps per round reach the speaker' }).toBeGreaterThanOrEqual(3);
    await test.click(); // the tap stops it and doesn't start it again
    await expect(test).toHaveText('Test the alarm');
    await test.click();
    await page.clock.runFor(6000);
    await expect(test).toHaveText('Test the alarm');

    await group.getByText('Vibrate', { exact: true }).click();
    await expect(group).toContainText('Sound');
    await expect(group.locator('summary')).not.toContainText('Vibration');
    await page.reload();
    await page.locator('#timer-alarm summary').click();
    await expect(page.locator('#timer-alarm summary')).toContainText('Sound');
    await expect(page.locator('#timer-alarm summary')).not.toContainText('Vibration');
    expect(errors).toEqual([]);
  });
});
