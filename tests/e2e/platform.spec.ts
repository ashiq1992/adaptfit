import { readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { contentClearsFixedBars, finishWorkout, noHorizontalOverflow, seed, setsDone, startWorkout, watchForErrors } from './helpers';

const SCREENS = ['/#/train', '/#/train/history', '/#/progress', '/#/coach', '/#/coach/fuel', '/#/journey', '/#/settings', '/#/programmes/guide'];

for (const width of [375, 390, 430]) {
  test(`T62–T65 ${width}px: no overflow, navigation never covers content, touch targets`, async ({ page }, info) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width, height: 844 });
    await seed(page, info);
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
      await contentClearsFixedBars(page, path);
    }
    await page.goto('/#/train');
    await startWorkout(page);
    await noHorizontalOverflow(page);
    await contentClearsFixedBars(page);
    for (const name of [/^Complete set 1/, /^Edit set 1/]) {
      const box = (await page.getByRole('button', { name }).first().boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    for (const nav of ['Train', 'Progress', 'Coach', 'Journey']) {
      await page.goto('/#/train');
      const box = (await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: new RegExp(`^${nav}`) }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
  });
}

test('768px and 1280px layouts, keyboard access, axe scan', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await page.setViewportSize({ width: 768, height: 1000 });
  await seed(page, info);
  for (const path of SCREENS) {
    await page.goto(path);
    await noHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 1280, height: 860 });
  for (const path of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(scan.violations.map((v) => `${path} ${v.id}: ${v.help} — ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  }
  // Keyboard-only: start the workout and complete a set.
  await page.goto('/#/train');
  await page.getByRole('button', { name: 'Start workout' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exercise-name')).toBeVisible();
  await page.getByRole('button', { name: /^Complete set 1/ }).first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => setsDone(page)).toBe(1);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations.map((v) => `workout ${v.id}: ${v.help}`)).toEqual([]);
  // Dialog traps focus and closes with Escape.
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Keep going' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('T66 reduced motion keeps feedback but disables animation', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, info);
  await startWorkout(page);
  await page.getByRole('button', { name: /^Complete set 1/ }).first().click();
  await expect.poll(() => setsDone(page)).toBe(1);
  await finishWorkout(page);
  await expect(page.getByTestId('xp-earned')).toBeVisible();
  const duration = await page.locator('.celebrate .pixel').first().evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
});

test('T61 offline: production app reopens and the core loop works without a network', async ({ page, context }, info) => {
  await seed(page, info);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'AdaptFit', display: 'standalone' });
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-offline-ready', 'true', { timeout: 30_000 });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  expect(await page.evaluate(() => fetch(`/__offline_probe?${Date.now()}`).then(() => 'net', () => 'failed'))).toBe('failed');
  // Lazy-loaded screens are precached too.
  for (const path of ['/#/progress', '/#/coach', '/#/journey', '/#/settings', '/#/train/history']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.goto('/#/train');
  await startWorkout(page);
  await page.getByRole('button', { name: /^Complete set 1/ }).first().click();
  await expect.poll(() => setsDone(page)).toBe(1);
  await finishWorkout(page);
  await page.getByRole('link', { name: 'View history' }).click();
  await expect(page.getByTestId('history-item').first()).toContainText('Duration not recorded');
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await context.setOffline(false);
});

test('T67 T68 backup and restore round-trip; malformed input is rejected safely', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info);
  await page.goto('/#/train/history');
  await expect(page.getByTestId('history-item').first()).toBeVisible();
  const count = await page.getByTestId('history-item').count();
  await page.goto('/#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup (JSON)' }).click();
  const file = info.outputPath('export.json');
  await (await download).saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported).toMatchObject({ format: 'adaptfit-backup', version: 3 });
  expect(exported.data.bodyweights.length).toBeGreaterThan(0);
  expect(exported.data.programmes).toHaveLength(1);

  await page.getByRole('button', { name: 'Erase all data…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to AdaptFit' })).toBeVisible();
  await page.getByTestId('restore-input').setInputFiles(file);
  await page.getByRole('dialog').getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
  await page.goto('/#/train/history');
  await expect(page.getByTestId('history-item')).toHaveCount(count);

  // T68: malformed inputs.
  await page.goto('/#/settings');
  const bad = info.outputPath('bad.json');
  writeFileSync(bad, '{"format":"adaptfit-backup","version":2,"data":');
  await page.getByTestId('restore-input').setInputFiles(bad);
  await expect(page.getByTestId('import-status')).toContainText('not valid JSON');
  const tampered = structuredClone(exported);
  tampered.data.sessions[0].exercises[0].sets[0].load = -20;
  writeFileSync(bad, JSON.stringify(tampered));
  await page.getByTestId('restore-input').setInputFiles(bad);
  await expect(page.getByTestId('import-status')).toContainText('invalid data');
  await page.goto('/#/train/history');
  await expect(page.getByTestId('history-item')).toHaveCount(count);

  // Invalid set values in the workout are rejected with an error, not saved.
  await page.goto('/#/train');
  await startWorkout(page);
  await page.getByRole('button', { name: 'Edit set 1' }).click();
  await page.getByRole('textbox', { name: /^Reps/ }).fill('-3');
  await page.getByRole('textbox', { name: /^Reps/ }).press('Enter');
  await expect(page.getByRole('alert').first()).toContainText('whole number from 1');
  // Unresolved notes import cannot be saved.
  await page.goto('/#/import');
  await page.getByLabel('Workout notes').fill('Bench 60 kg 5x5');
  await page.getByRole('button', { name: 'Review import' }).click();
  await expect(page.getByRole('button', { name: /^Save/ })).toBeDisabled();
  await expect(page.getByTestId('import-row')).toContainText('Date missing');
  expect(errors).toEqual([]);
});

test('T37 real-browser upgrade: a V0.1 (v2) database migrates and keeps its history', async ({ page }) => {
  const errors = watchForErrors(page);
  // Write a V0.1-shaped database directly with the IndexedDB API before the app opens it.
  // Same origin, but a static file so the app itself doesn't open the database first.
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    const plan = {
      templateId: 'db-quick-strength', name: 'Quick dumbbell strength', emphasis: 'full', intensity: 'moderate', warmupSec: 120, estimatedMinutes: 12,
      equipment: ['dumbbells'], optionalEquipment: [],
      items: [{ key: 'db-quick-strength:0', exerciseId: 'goblet-squat', name: 'Goblet squat', mode: 'reps', tags: ['strength'], loadable: true, equipment: ['dumbbells'], sets: 3, reps: 10, durationSec: null, restSec: 60, cue: '', substitutedFrom: null }],
    };
    const checkIn = { localDate: '2026-10-01', availableMinutes: 20, energy: 'medium', soreness: 'none', equipment: ['bodyweight', 'dumbbells'], safetyConcern: null, updatedAt: '2026-10-01T01:00:00.000Z' };
    const session = {
      id: 'v01-session', state: 'completed', startedAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:01:00.000Z', completedAt: '2026-10-01T10:01:00.000Z',
      completedLocalDate: '2026-10-01', discardedAt: null, checkIn, recommendedPlan: plan, plan, substitutions: [], position: 0, restStartedAt: null, restDurationSec: null,
      sets: [1, 2].map((n) => ({ id: `v01-set-${n}`, itemKey: 'db-quick-strength:0', exerciseId: 'goblet-squat', exerciseName: 'Goblet squat', tags: ['strength'], reps: 10, durationSec: null, load: { value: 30, unit: 'kg' }, loggedAt: '2026-10-01T10:00:3' + n + '.000Z', updatedAt: '2026-10-01T10:00:3' + n + '.000Z' })),
    };
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('adaptfit', 20); // Dexie stores version × 10
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('profile', { keyPath: 'id' });
        db.createObjectStore('checkIns', { keyPath: 'localDate' });
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        ['state', 'completedAt', 'completedLocalDate', 'startedAt'].forEach((i) => s.createIndex(i, i));
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const tx = req.result.transaction(['profile', 'checkIns', 'sessions'], 'readwrite');
        tx.objectStore('profile').put({ id: 'me', goal: 'strength', experience: 'beginner', equipment: ['bodyweight', 'dumbbells'], preferredMinutes: 20, weightUnit: 'kg', createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z' });
        tx.objectStore('checkIns').put(checkIn);
        tx.objectStore('sessions').put(session);
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.goto('/#/train/history');
  const card = page.getByTestId('history-item');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Quick dumbbell strength');
  await expect(card).toContainText('Duration not recorded');
  await expect(card).toContainText('V0.1 record');
  await card.locator('.hist-summary').click();
  await expect(card).toContainText('30 kg × 10');
  const legacy = await page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('adaptfit');
    req.onsuccess = () => {
      const c = req.result.transaction('legacySessions').objectStore('legacySessions').count();
      c.onsuccess = () => resolve(c.result);
    };
  }));
  expect(legacy).toBe(1);
  expect(errors).toEqual([]);
});
