import { describe, expect, it } from 'vitest';

/**
 * Ink & Paper brand guard (static scan).
 * Every colour lives in src/ui/tokens.css; components use the role tokens
 * (var(--ink), var(--record), var(--hi) …), so Paper and Night stay in step.
 */

/**
 * Source text of every stylesheet and component, keyed by "src/…" path. Read
 * from disk (Vitest blanks CSS imports); `fs` is imported by name so the app's
 * browser-only type settings don't need Node types.
 */
type Fs = { readFileSync(p: string, enc: 'utf8'): string; readdirSync(p: string, o: { recursive: true }): string[] };
const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as Fs;
/** Vitest runs from the project root. */
const ROOT = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
const SOURCES: Record<string, string> = Object.fromEntries(
  [
    ...fs
      .readdirSync(`${ROOT}/src`, { recursive: true })
      .map((p) => `src/${p.split('\\').join('/')}`)
      .filter((p) => /\.(css|tsx?)$/.test(p)),
    'index.html',
  ].map((p) => [p, fs.readFileSync(`${ROOT}/${p}`, 'utf8')]),
);

/** Files that may hold literal colours, and why. Keep this list short. */
const ALLOWLIST: Record<string, string> = {
  'src/ui/tokens.css': 'the palette itself',
  'src/ui/theme.ts': 'browser bar colour (<meta name="theme-color">) must be a literal',
};

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const HEX = /(^|[^\w&/#-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const FUNC = /\b(?:rgba?|hsla?|oklch|lab|lch)\(/;
const OLD_PALETTE = /#2dd4bf|#101418|#192128|45,\s*212,\s*191/i;

describe('Ink & Paper: no hard-coded colours outside tokens.css', () => {
  const files = Object.keys(SOURCES).filter((f) => /\.(css|tsx)$/.test(f) || f === 'src/ui/theme.ts');

  it('scans a meaningful set of files', () => {
    expect(files).toContain('src/ui/app.css');
    expect(files.filter((f) => f.endsWith('.tsx')).length).toBeGreaterThan(20);
  });

  it('uses role tokens instead of literal hex/rgb/hsl colours', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (ALLOWLIST[f]) continue;
      stripComments(SOURCES[f]!)
        .split('\n')
        .forEach((line, i) => {
          if (HEX.test(line) || FUNC.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('never brings back the old dark/teal palette, anywhere in src or index.html', () => {
    expect(Object.keys(SOURCES).filter((f) => OLD_PALETTE.test(SOURCES[f]!))).toEqual([]);
  });

  it('keeps the allowlist honest (every entry exists)', () => {
    for (const f of Object.keys(ALLOWLIST)) expect(SOURCES[f], f).toBeTypeOf('string');
  });
});

/* ── Tokens: every role is defined in Paper, Night and "follow the device" ── */

const tokens = SOURCES['src/ui/tokens.css']!;

function block(selectorPattern: RegExp): Record<string, string> {
  const m = selectorPattern.exec(tokens);
  if (!m) throw new Error(`block not found: ${selectorPattern}`);
  const start = tokens.indexOf('{', m.index) + 1;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < tokens.length) {
    if (tokens[i] === '{') depth++;
    if (tokens[i] === '}') depth--;
    i++;
  }
  const body = tokens.slice(start, i - 1);
  return Object.fromEntries([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((x) => [x[1]!, x[2]!.trim()]));
}

const paper = block(/^:root\s*\{/m);
const night = block(/:root\[data-theme='night'\]\s*\{/);
const auto = block(/:root\[data-theme='auto'\]\s*\{/);

/** Colour roles (see the header of tokens.css and docs/brand/ink-and-paper.html). */
const ROLES = [
  'bg', 'surface', 'surface-2', 'surface-3', 'rule', 'border', 'border-strong',
  'text', 'text-2', 'text-faint', 'ink', 'on-ink', 'ink-soft',
  'record', 'hi', 'hi-text', 'attention', 'attention-soft', 'danger', 'danger-soft', 'margin',
  'focus', 'scrim', 'bar-bg', 'shadow', 'knob-shadow',
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('Ink & Paper: tokens', () => {
  it.each(ROLES)('defines --%s in Paper, Night and follow-the-device dark', (role) => {
    expect(paper[role], `paper --${role}`).toBeTruthy();
    expect(night[role], `night --${role}`).toBeTruthy();
    expect(auto[role], `auto --${role}`).toBeTruthy();
  });

  it('keeps the two dark blocks (explicit Night and follow-the-device) identical', () => {
    expect(auto).toEqual(night);
  });

  it('matches the brand board values', () => {
    expect(paper).toMatchObject({ bg: '#f6f2ea', ink: '#1c1b18', text: '#1c1b18', record: '#24479a', hi: '#e6f06a', attention: '#94600f', danger: '#b0302a' });
    expect(night).toMatchObject({ bg: '#161513', ink: '#efeae0', text: '#efeae0', record: '#9db4f0' });
  });

  it('defines the three type voices', () => {
    const root = block(/^:root\s*\{\s*\/\* Three voices/m);
    expect(root['font-display']).toMatch(/Fraunces/);
    expect(root['font-num']).toMatch(/IBM Plex Mono/);
    expect(root['font']).toMatch(/^-apple-system/);
  });

  it.each([
    ['paper', paper],
    ['night', night],
  ] as const)('every text colour meets WCAG AA (4.5:1) on paper and on surfaces in %s', (_name, t) => {
    // Reading text sits on paper, cards and insets.
    for (const fg of ['text', 'text-2', 'text-faint']) {
      for (const bg of ['bg', 'surface', 'surface-2']) {
        expect(contrast(t[fg]!, t[bg]!), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Accent inks (brand-fixed values) are used on paper and cards.
    for (const fg of ['record', 'attention', 'danger']) {
      for (const bg of ['bg', 'surface']) {
        expect(contrast(t[fg]!, t[bg]!), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Ink buttons, and ink text on the highlighter.
    expect(contrast(t['on-ink']!, t.ink!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['hi-text']!, t.hi!)).toBeGreaterThanOrEqual(4.5);
  });
});
