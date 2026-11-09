import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { noHorizontalOverflow, openThisWeek, seed } from './helpers';

/**
 * Brand + design tests ("Ink & Paper", docs/brand/ink-and-paper.html).
 * Computed-style checks in Paper and Night: the three type voices, one job per
 * colour, the settings rows' alignment, touch targets and input sizes.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
type Theme = 'paper' | 'night';

/** Screens reachable by URL, plus a step to reach a richer state. */
const SCREENS: { name: string; path: string; prepare?: (page: Page) => Promise<void> }[] = [
  { name: 'plan', path: '/#/plan' },
  { name: 'note', path: '/#/plan', prepare: async (page) => page.getByTestId('today-card').click() },
  { name: 'week', path: '/#/week', prepare: async (page) => page.getByTestId('copy-previous').click() },
  { name: 'progress', path: '/#/progress' },
  { name: 'coach', path: '/#/coach' },
  { name: 'fuel', path: '/#/coach/fuel' },
  { name: 'library', path: '/#/library' },
  { name: 'guide', path: '/#/library/guide' },
  { name: 'history', path: '/#/history', prepare: async (page) => page.locator('.hist-summary').first().click() },
  { name: 'settings', path: '/#/settings', prepare: openAllGroups },
];

async function openAllGroups(page: Page) {
  await page.evaluate(() => document.querySelectorAll<HTMLDetailsElement>('.settings-group').forEach((d) => (d.open = true)));
}

async function switchTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => localStorage.setItem('adaptfit:theme', t), theme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function visit(page: Page, s: (typeof SCREENS)[number]) {
  await page.goto(s.path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await s.prepare?.(page);
  await page.waitForTimeout(250); // the 180 ms screen fade-in
}

/** Resolve a CSS colour expression (e.g. var(--ink)) to the browser's rgb() string. */
async function resolveColour(page: Page, expr: string) {
  return page.evaluate((e) => {
    const probe = document.createElement('div');
    probe.style.color = e;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, expr);
}

for (const theme of ['paper', 'night'] as const) {
  test(`brand: type voices and colour jobs on every key screen (${theme})`, async ({ page }, info) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, info, openThisWeek);
    await switchTheme(page, theme);
    const ink = await resolveColour(page, 'var(--ink)');
    const hi = await resolveColour(page, 'var(--hi)');

    for (const s of SCREENS) {
      await visit(page, s);
      const report = await page.evaluate(
        ({ hi }) => {
          const visible = (el: Element) => (el as HTMLElement).checkVisibility?.() ?? true;
          const font = (el: Element) => getComputedStyle(el).fontFamily;
          const h1 = document.querySelector('h1');
          const out = {
            h1: h1 ? font(h1) : '',
            body: font(document.body),
            reading: [] as string[],
            numbers: [] as string[],
            primary: [] as string[],
            oldPalette: [] as string[],
            hiMisuse: [] as string[],
          };
          // Reading text: labels, buttons and exercise names use the system font.
          for (const el of document.querySelectorAll('.field-label, .btn, .note-ex-name, .settings-title, .switch-label, .choice-label')) {
            if (visible(el) && /Fraunces|Plex/.test(font(el))) out.reading.push(`${el.className}: ${font(el)}`);
          }
          // Numbers are set in IBM Plex Mono.
          for (const el of document.querySelectorAll('.note-ex-pres, .sheet-input, .num, .note-ex-last, .set-tag, .input-num')) {
            if (visible(el) && !font(el).includes('IBM Plex Mono')) out.numbers.push(`${el.className}: ${font(el)}`);
          }
          for (const el of document.querySelectorAll('.btn-primary')) if (visible(el)) out.primary.push(getComputedStyle(el).backgroundColor);
          // The old dark/teal palette must not appear anywhere.
          const OLD = ['rgb(45, 212, 191)', 'rgb(16, 20, 24)', 'rgb(25, 33, 40)'];
          // Highlighter only for progress (behind ink text), and the current nav tab.
          // (.logo: the brand mark itself carries a highlighter stroke behind its step.)
          const HI_OK = '.hl, .pill-progress, .pill-improved, .pill-pr, .positive-text, .change.up .delta, .chart .tip, .nav-item[aria-current="page"] > span, .logo *';
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            const paints = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor, cs.backgroundImage, cs.boxShadow, cs.fill, cs.stroke].join(' ');
            if (OLD.some((c) => paints.includes(c))) out.oldPalette.push(`${el.tagName}.${el.getAttribute('class')}`);
            if (cs.color === hi) out.hiMisuse.push(`text colour: ${el.tagName}.${el.getAttribute('class')}`);
            const usesHi = [cs.backgroundColor, cs.backgroundImage, cs.boxShadow, cs.fill, cs.borderTopColor, cs.borderLeftColor].some((v) => v.includes(hi));
            if (usesHi && !el.matches(HI_OK)) out.hiMisuse.push(`${el.tagName}.${el.getAttribute('class')}`);
          }
          return out;
        },
        { hi },
      );
      const where = `${theme} ${s.name}`;
      expect(report.h1, `${where} h1`).toContain('Fraunces');
      expect(report.body, `${where} body`).toMatch(/^-apple-system/);
      expect(report.body, `${where} body`).not.toMatch(/Fraunces|Plex/);
      expect(report.reading, `${where} reading text in system font`).toEqual([]);
      expect(report.numbers, `${where} numbers in mono`).toEqual([]);
      for (const bg of report.primary) expect(bg, `${where} primary button is ink`).toBe(ink);
      expect(report.oldPalette, `${where} old palette`).toEqual([]);
      expect(report.hiMisuse, `${where} highlighter outside progress`).toEqual([]);
    }
    // ::selection uses the highlighter behind ink text.
    const sel = await page.evaluate(() => getComputedStyle(document.body, '::selection').backgroundColor);
    expect(sel).toBe(hi);
  });
}

test('brand: there is at least one primary button, number and highlighter on the sample screens', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, info, openThisWeek);
  await page.goto('/#/plan');
  await expect(page.locator('.btn-primary').first()).toBeVisible();
  await page.getByTestId('today-card').click();
  await expect(page.locator('.note-ex-pres').first()).toBeVisible();
  await page.goto('/#/progress');
  await expect(page.locator('.pill-progress').first()).toBeVisible();
});

const PHONES = [375, 390, 430];

test('settings rows: icon, text and chevron share one centre line; every row starts at the same left edge', async ({ page }, info) => {
  test.setTimeout(120_000);
  await seed(page, info, openThisWeek);
  for (const theme of ['paper', 'night'] as const) {
    await switchTheme(page, theme);
    for (const width of [...PHONES, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/settings');
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
      await openAllGroups(page);
      await page.waitForTimeout(250);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('.settings-group > summary')].map((s) => {
          const box = (sel: string) => s.querySelector(sel)!.getBoundingClientRect();
          const mid = (r: DOMRect) => r.top + r.height / 2;
          const [icon, text, chev, row] = [box('.settings-icon'), box('.settings-text'), box('.chev'), s.getBoundingClientRect()];
          return {
            title: s.querySelector('.settings-title')!.textContent,
            iconText: Math.abs(mid(icon) - mid(text)),
            chevText: Math.abs(mid(chev) - mid(text)),
            rowLeft: row.left,
            iconLeft: icon.left,
            textLeft: text.left,
            chevRight: chev.right,
            rowRight: row.right,
            height: row.height,
          };
        }),
      );
      expect(rows.length, 'settings rows').toBeGreaterThanOrEqual(11);
      const where = `${theme} ${width}px`;
      for (const r of rows) {
        expect(r.iconText, `${where} ${r.title}: icon vs text centre`).toBeLessThanOrEqual(2);
        expect(r.chevText, `${where} ${r.title}: chevron vs text centre`).toBeLessThanOrEqual(2);
        expect(r.height, `${where} ${r.title}: row height`).toBeGreaterThanOrEqual(44);
        expect(Math.abs(r.rowRight - r.chevRight), `${where} ${r.title}: chevron on the right edge`).toBeLessThanOrEqual(2);
      }
      for (const key of ['rowLeft', 'iconLeft', 'textLeft'] as const) {
        const xs = rows.map((r) => r[key]);
        expect(Math.max(...xs) - Math.min(...xs), `${where} ${key} aligned`).toBeLessThanOrEqual(1);
      }
      // One chevron style: an SVG, never a text glyph.
      expect(await page.locator('.settings-group > summary .chev').evaluateAll((els) => els.every((e) => e.tagName.toLowerCase() === 'svg'))).toBe(true);
    }
  }
});

test('phones: touch targets ≥44px tall, inputs ≥16px, no horizontal overflow at 375px', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page, info, openThisWeek);
  for (const s of SCREENS) {
    await visit(page, s);
    await noHorizontalOverflow(page);
    const problems = await page.evaluate(() => {
      const out: string[] = [];
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2 && ((el as HTMLElement).checkVisibility?.({ visibilityProperty: true }) ?? true);
      };
      const label = (el: Element) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      // Interactive controls (inline text links inside sentences are exempt, as WCAG allows).
      const targets = document.querySelectorAll('button, a.btn, a.bar-back, a.note-card, a.plan-link, a.status-row, select, input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, summary, .choice-body, .switch, .nav-item');
      for (const el of targets) {
        if (!visible(el) || el.closest('.visually-hidden, .chart')) continue;
        if (el.getBoundingClientRect().height < 43.5) out.push(`target ${Math.round(el.getBoundingClientRect().height)}px: ${label(el)}`);
      }
      for (const el of document.querySelectorAll('input, select, textarea')) {
        if (!visible(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 16) out.push(`input font ${size}px: ${label(el)}`);
      }
      return out;
    });
    expect(problems, s.name).toEqual([]);
  }
});

for (const theme of ['paper', 'night'] as const) {
  test(`axe: Settings with every group open has no WCAG 2.1 AA violations (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, info, openThisWeek);
    await switchTheme(page, theme);
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await openAllGroups(page);
    await page.waitForTimeout(250);
    const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(r.violations.map((v) => `${theme} ${v.id}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} ${(n.failureSummary ?? '').slice(0, 160)}`).join(' | ')}`)).toEqual([]);
  });
}

test('settings contents: every control starts under its group title, stays inside the screen, and no option label is cut off', async ({ page }, info) => {
  test.setTimeout(120_000);
  await seed(page, info, openThisWeek);
  for (const width of [320, 360, ...PHONES, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await openAllGroups(page);
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const out = { misaligned: [] as string[], outside: [] as string[], cut: [] as string[], timeHeights: [] as number[] };
      for (const g of document.querySelectorAll<HTMLDetailsElement>('.settings-group')) {
        const title = g.querySelector('.settings-text')!.getBoundingClientRect();
        const row = g.querySelector('summary')!.getBoundingClientRect();
        const name = g.querySelector('.settings-title')!.textContent;
        const body = g.querySelector('.settings-body')!;
        // Direct children of the body: fields, switches, buttons, paragraphs.
        for (const el of body.children) {
          const b = el.getBoundingClientRect();
          if (!b.width) continue;
          if (window.innerWidth >= 360 && Math.abs(b.left - title.left) > 1) out.misaligned.push(`${name}: ${el.className || el.tagName} at ${Math.round(b.left)} vs title ${Math.round(title.left)}`);
          if (b.right > row.right + 1) out.outside.push(`${name}: ${el.className || el.tagName}`);
        }
        for (const l of body.querySelectorAll<HTMLElement>('.choice-label, .seg-btn')) {
          if (l.scrollWidth > l.clientWidth + 1) out.cut.push(`${name}: “${l.textContent}”`);
        }
        for (const t of body.querySelectorAll<HTMLInputElement>('input[type=time]')) out.timeHeights.push(Math.round(t.getBoundingClientRect().height));
      }
      return out;
    });
    expect(r.misaligned, `${width}px: controls aligned with their group title`).toEqual([]);
    expect(r.outside, `${width}px: nothing past the right edge`).toEqual([]);
    expect(r.cut, `${width}px: no option label cut off`).toEqual([]);
    expect(r.timeHeights.every((h) => h >= 44), `${width}px: time boxes are full height (${r.timeHeights})`).toBe(true);
    await noHorizontalOverflow(page);
  }
});

test.describe('phone editing', () => {
  test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

  test('pasting and editing a long note: boxes grow with the text (no hidden lines, no box-inside-the-page scrolling) and Done stays on screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByRole('button', { name: /^Paste from Notes/ }).click();
    const note = Array.from({ length: 6 }, (_, i) => `${i + 1}. Lat pulldown\n4 × 6\n76kg\nRest: 2 min\nfelt strong today, next week try 80kg for all four sets and keep the pause at the bottom`).join('\n\n');
    const paste = page.getByTestId('import-text');
    await paste.fill(note);
    const hidden = (sel: string) => page.locator(sel).evaluate((t: HTMLTextAreaElement) => t.scrollHeight - t.clientHeight);
    expect(await hidden('[data-testid=import-text]'), 'paste box shows the whole note').toBeLessThanOrEqual(1);
    await page.getByTestId('import-save').click();
    await expect(page.locator('.note-ex').first()).toBeVisible();

    await page.locator('.note-ex').first().tap();
    const box = page.locator('.note-textarea');
    await expect(box).toBeFocused();
    expect(await hidden('.note-textarea'), 'editor opens showing every line').toBeLessThanOrEqual(1);
    await box.press('End');
    await box.pressSequentially('\nanother long line that wraps on a phone screen because it has quite a few words in it');
    expect(await hidden('.note-textarea'), 'editor grows as you type, wrapped lines included').toBeLessThanOrEqual(1);
    const done = page.getByRole('button', { name: 'Done' });
    const b = (await done.boundingBox())!;
    expect(b.y + b.height, 'Done is on screen while typing').toBeLessThanOrEqual(664);
    await done.tap();
    await expect(page.locator('.note-ex-notes').first()).toContainText('another long line');
  });
});
