import { readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { contentClearsFixedBars, noHorizontalOverflow, openDay, openNote, openNoteDays, openThisWeek, seed, setsDone, startLive, watchForErrors } from './helpers';

/** Mobile app, accessibility, offline, PWA and data-safety checks (Sprint 4 T45–T56, T61–T64, T37). */
const SCREENS = ['/#/plan', '/#/week', '/#/weeks', '/#/import', '/#/library', '/#/progress', '/#/coach', '/#/coach/fuel', '/#/settings', '/#/history', '/#/library/guide'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

for (const width of [375, 390, 430]) {
  test(`T45–T47 T49 T56 ${width}px: Plan and every screen render, nothing hidden behind the navigation, touch targets`, async ({ page }, info) => {
    const errors = watchForErrors(page);
    await page.setViewportSize({ width, height: 844 });
    await seed(page, info, openThisWeek);
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
      await contentClearsFixedBars(page, path);
    }
    // The workout note, the most important screen.
    await openNote(page);
    await noHorizontalOverflow(page);
    await contentClearsFixedBars(page, 'note');
    const line = (await page.locator('.note-ex').first().boundingBox())!;
    expect(line.height).toBeGreaterThanOrEqual(44);
    // Weekly sheet controls.
    await page.goto('/#/week');
    await page.getByTestId('copy-previous').click();
    for (const loc of [page.getByRole('radio', { name: 'Done', exact: true }).first(), page.locator('.sheet-input').first(), page.getByTestId('confirm-week')]) {
      const box = (await loc.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await contentClearsFixedBars(page, 'weekly draft');
    for (const nav of ['Plan', 'Progress', 'Coach']) {
      const box = (await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: new RegExp(`^${nav}`) }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
  });
}

test('T48 the keyboard never covers the field being edited; the bottom navigation steps aside', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, info, openThisWeek);
  await page.goto('/#/week');
  await page.getByTestId('copy-previous').click();
  const last = page.locator('.sheet-input').last();
  // Simulate the on-screen keyboard taking ~half the screen.
  await page.setViewportSize({ width: 390, height: 420 });
  await last.click();
  await expect(page.locator('html')).toHaveClass(/kb-open/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  const box = (await last.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(420);
  // Same for the inline note editor.
  await openNote(page);
  await page.locator('.note-ex').nth(2).click();
  const editor = page.locator('.note-textarea');
  await expect(editor).toBeFocused();
  const eb = (await editor.boundingBox())!;
  expect(eb.y + Math.min(eb.height, 120)).toBeLessThanOrEqual(420);
  await expect(page.getByRole('button', { name: 'Done' })).toBeInViewport();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('html')).not.toHaveClass(/kb-open/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('768px and 1280px layouts, keyboard access, axe scan of every screen', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = watchForErrors(page);
  await page.setViewportSize({ width: 768, height: 1000 });
  await seed(page, info, openThisWeek);
  for (const path of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 1280, height: 860 });
  const scan = async (label: string) => {
    await page.waitForTimeout(250); // let the 180 ms screen fade-in finish before measuring contrast
    const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(r.violations.map((v) => `${label} ${v.id}: ${v.help} — ${v.nodes.slice(0, 2).map((n) => `${n.target.join(' ')} ${n.html.slice(0, 120)} ${(n.failureSummary ?? '').slice(0, 200)}`).join(' | ')}`)).toEqual([]);
  };
  for (const path of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    await scan(path);
  }
  // States not reachable by URL alone.
  await openNote(page);
  await scan('note');
  await page.locator('.note-ex').first().click();
  await scan('note editor');
  await page.keyboard.press('Escape');
  await page.goto('/#/week');
  await page.getByTestId('copy-previous').click();
  await page.getByRole('button', { name: 'Review changes' }).click();
  await scan('weekly draft + review');
  await page.goto('/#/import');
  await page.getByTestId('import-text').fill('Tuesday Upper\nBench 30kg 8 8 7\nRows 40kg 10x3');
  await scan('import preview');

  // Keyboard only: open a note line, edit it, save with Done.
  await openNote(page);
  await page.locator('.note-ex').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.note-textarea')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.note-textarea')).toHaveCount(0);
  // Dialogs trap focus and close with Escape.
  await page.getByRole('button', { name: /^Options for/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Ink & Paper: Night theme passes the same accessibility scan, persists across reloads, and Paper is the default', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, info, openThisWeek);
  // Paper by default: warm paper background and the matching browser bar colour.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(246, 242, 234)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f2ea');
  // Switch to Night in Settings → Appearance.
  await page.goto('/#/settings');
  await page.getByText('Appearance', { exact: true }).click();
  await page.getByRole('radio', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(22, 21, 19)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#161513');
  for (const path of ['/#/plan', '/#/week', '/#/progress', '/#/coach', '/#/settings', '/#/import', '/#/library']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(250);
    const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(r.violations.map((v) => `night ${path} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  }
  await openNote(page);
  await page.waitForTimeout(250);
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(r.violations.map((v) => `night note ${v.id}`)).toEqual([]);
});

test('T55 reduced-motion settings are respected', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, info);
  await page.goto('/#/progress');
  const anim = await page.locator('.screen').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  const dur = await page.locator('.btn').first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(dur).toBeLessThan(0.02);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  expect(await page.locator('.screen').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('screen-in');
});

test('T52 T53 the PWA manifest is valid and the app is set up for standalone use', async ({ page }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'AdaptFit', short_name: 'AdaptFit', display: 'standalone', start_url: './', scope: './', theme_color: '#f6f2ea', background_color: '#f6f2ea' });
  const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ''}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).status()).toBe(200);
  // iOS standalone: home-screen icon, status bar, splash screens, safe areas.
  expect(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')).toBe('yes');
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover');
  const splash = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((ls) => ls.map((l) => (l as HTMLLinkElement).href));
  expect(splash.length).toBeGreaterThanOrEqual(8);
  for (const href of splash) expect((await page.request.get(href)).status()).toBe(200);
  expect((await page.request.get('/apple-touch-icon.png')).status()).toBe(200);
});

test('T50 T51 T61 offline: the app reopens, notes can be edited, and drafts survive closing the app', async ({ page, context }, info) => {
  await seed(page, info, openThisWeek);
  await page.goto('/#/settings');
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-offline-ready', 'true', { timeout: 30_000 });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.goto('/#/plan');
  await page.reload();
  await expect(page.getByTestId('update-week')).toBeVisible();
  expect(await page.evaluate(() => fetch(`/__offline_probe?${Date.now()}`).then(() => 'net', () => 'failed'))).toBe('failed');
  for (const path of ['/#/progress', '/#/coach', '/#/settings', '/#/import', '/#/library', '/#/history']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  // Edit a note offline.
  await openNote(page);
  await page.locator('.note-ex').first().click();
  await page.locator('.note-textarea').fill('Smith machine bench press\n3 sets × 8 reps — 31.25 kg/side');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  // Weekly draft offline, then "close" the app (new page) and reopen.
  await page.goto('/#/week');
  await page.getByTestId('copy-previous').click();
  await page.locator('.sheet-input').first().fill('31.25 kg/side × 8, 8, 8');
  await expect(page.locator('.week-toolbar')).toContainText('Draft saved');
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto('/#/week');
  await expect(reopened.locator('.sheet-input').first()).toHaveValue('31.25 kg/side × 8, 8, 8');
  await reopened.goto('/#/plan');
  await reopened.getByTestId('today-card').click();
  await expect(reopened.locator('.note-ex').first()).toContainText('31.25 kg/side');
  expect(await reopened.evaluate(() => navigator.onLine)).toBe(false);
  await context.setOffline(false);
});

test('T63 backup and restore round-trip (format 4, weekly records included); malformed files are rejected safely', async ({ page }, info) => {
  const errors = watchForErrors(page);
  await seed(page, info, openThisWeek);
  // Confirm one week so weekly records are part of the backup.
  await page.goto('/#/week');
  await page.getByTestId('copy-previous').click();
  await page.locator('.week-sheet-day').first().getByRole('radio', { name: 'Done', exact: true }).click();
  await page.getByTestId('confirm-week').click();
  await expect(page.getByTestId('week-review')).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByTestId('history-item').first()).toBeVisible();
  const count = await page.getByTestId('history-item').count();
  await page.goto('/#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup (JSON)' }).click();
  const file = info.outputPath('export.json');
  await (await download).saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported).toMatchObject({ format: 'adaptfit-backup', version: 4 });
  expect(exported.data.trainingWeeks).toHaveLength(1);
  expect(exported.data.bodyweights.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Erase all data…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to AdaptFit' })).toBeVisible();
  await page.getByText('Coming back? Restore a backup').click();
  await page.getByTestId('restore-input').setInputFiles(file);
  await page.getByRole('dialog').getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByTestId('update-week')).toHaveText('Review this week');
  await page.goto('/#/history');
  await expect(page.getByTestId('history-item')).toHaveCount(count);

  // Malformed inputs change nothing.
  await page.goto('/#/settings');
  const bad = info.outputPath('bad.json');
  writeFileSync(bad, '{"format":"adaptfit-backup","version":4,"data":');
  await page.getByTestId('restore-input').setInputFiles(bad);
  await expect(page.getByTestId('import-status')).toContainText('not valid JSON');
  const tampered = structuredClone(exported);
  tampered.data.sessions[0].exercises[0].sets[0].load = -20;
  writeFileSync(bad, JSON.stringify(tampered));
  await page.getByTestId('restore-input').setInputFiles(bad);
  await expect(page.getByTestId('import-status')).toContainText('invalid data');
  await page.goto('/#/history');
  await expect(page.getByTestId('history-item')).toHaveCount(count);
  expect(errors).toEqual([]);
});

test('T59 optional live logging still works and is counted once in the week', async ({ page }, info) => {
  await seed(page, info, openThisWeek);
  await openNoteDays(page);
  await openDay(page); // the first day, which is the first row of the week sheet
  await startLive(page);
  await page.getByRole('button', { name: /^Complete set 1/ }).first().click();
  await expect.poll(() => setsDone(page)).toBe(1);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('dialog').getByText("Don't record a duration").click();
  await page.getByRole('dialog').getByRole('button', { name: /^Finish (early|workout)$/ }).click();
  await expect(page.getByText('Workout saved', { exact: true })).toBeVisible();
  await page.goto('/#/week');
  await page.getByTestId('copy-previous').click();
  await expect(page.locator('.week-sheet-day').first()).toContainText('Logged');
});

test('T37 T57 real-browser upgrade: a V0.1 (v2) database migrates to V0.4 and keeps its history', async ({ page }) => {
  const errors = watchForErrors(page);
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
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.goto('/#/history');
  const card = page.getByTestId('history-item');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Quick dumbbell strength');
  await expect(card).toContainText('Duration not recorded');
  await expect(card).toContainText('V0.1 record');
  await card.locator('.hist-summary').click();
  await expect(card).toContainText('30 kg × 10');
  const info = await page.evaluate(
    () =>
      new Promise<{ version: number; legacy: number }>((resolve) => {
        const req = indexedDB.open('adaptfit');
        req.onsuccess = () => {
          const c = req.result.transaction('legacySessions').objectStore('legacySessions').count();
          c.onsuccess = () => resolve({ version: req.result.version, legacy: c.result });
        };
      }),
  );
  expect(info).toEqual({ version: 50, legacy: 1 });
  expect(errors).toEqual([]);
});
