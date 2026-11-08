import type { CharacterStyle } from '../domain/types';

/**
 * Character styles (V0.3). ORIGINAL placeholder pixel art drawn in code for
 * AdaptFit — not final commercial artwork, and not taken from any game.
 *
 * Every style shares the same 32×32 body, the same level unlock layers
 * (scarf, pack, cape, armour, gilded trim), and the same progression rules.
 * Styles are cosmetic only: they never change XP, stats, or training logic.
 */

export interface Pixel {
  x: number;
  y: number;
  c: string;
}

export interface CharacterStyleDef {
  id: CharacterStyle;
  name: string;
  tagline: string;
  /** Palette overrides applied to the shared body (key → colour). */
  palette: Record<string, string>;
  /** Style gear drawn on top of the body (and under unlock layers). */
  gear: Pixel[];
  /** Future cosmetic slots this style can use. */
  slots: ('outfit' | 'armour' | 'scarf' | 'headgear' | 'accessory' | 'palette')[];
  placeholder: true;
}

/** Stamp a small block of rows at (x, y); '.' is transparent. */
function stamp(x: number, y: number, rows: string[]): Pixel[] {
  const out: Pixel[] = [];
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') out.push({ x: x + dx, y: y + dy, c: row[dx]! });
  });
  return out;
}

/** Extra palette keys used by style gear. */
export const GEAR_PALETTE: Record<string, string> = {
  B: '#3d6fd1', // book cover
  n: '#7a4a2a', // bow wood
  u: '#e8e2d0', // bowstring / pages
  x: '#a7b3c2', // steel
  X: '#5f6b7a', // steel shade
  q: '#5a3a1e', // quiver
};

const ALL_SLOTS: CharacterStyleDef['slots'] = ['outfit', 'armour', 'scarf', 'headgear', 'accessory', 'palette'];

export const CHARACTER_DEFS: readonly CharacterStyleDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    tagline: 'Headband, leather vest, and a trusty blade.',
    palette: {},
    gear: stamp(25, 10, ['.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', '.x.', 'ggg', '.l.', '.l.']),
    slots: ALL_SLOTS,
    placeholder: true,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    tagline: 'Forest greens and a longbow for the long road.',
    palette: { r: '#2f8f5b', R: '#1f6b42', c: '#3b6b45', C: '#2a4e33', h: '#3a2616', H: '#5b3a24' },
    gear: stamp(3, 9, ['..nu', '.n.u', '.n.u', 'n..u', 'n..u', 'n..u', 'n..u', 'n..u', 'n..u', 'n..u', '.n.u', '.n.u', '..nu']),
    slots: ALL_SLOTS,
    placeholder: true,
  },
  {
    id: 'scholar',
    name: 'Scholar',
    tagline: 'Robes, spectacles, and a well-worn training journal.',
    palette: { c: '#4b3f8f', C: '#352c66', l: '#7a5cc4', L: '#5a4296', r: '#9b6dff', R: '#6f4bc4', h: '#1d1a24', H: '#3a3346' },
    gear: [...stamp(11, 8, ['g..gggg..g']), ...stamp(2, 18, ['BBBBB', 'Buuuo', 'Buuuo', 'BBBBB'])],
    slots: ALL_SLOTS,
    placeholder: true,
  },
  {
    id: 'engineer',
    name: 'Engineer',
    tagline: 'Goggles up, overalls on, wrench in hand.',
    palette: { c: '#c9ced6', C: '#9aa3ae', l: '#2f5d8a', L: '#21456a', r: '#f5b041', R: '#c98a22' },
    gear: [...stamp(11, 6, ['XttX..XttX']), ...stamp(24, 14, ['x.x', 'xxx', '.x.', '.x.', '.x.', '.x.', '.X.', '.X.', '.X.'])],
    slots: ALL_SLOTS,
    placeholder: true,
  },
];

export const DEFAULT_STYLE: CharacterStyle = 'warrior';

/**
 * Resolve a stored style ID. Unknown, removed, or malformed styles fall back
 * to the default sprite instead of failing to render.
 */
export function resolveStyle(id: string | null | undefined, registry: readonly CharacterStyleDef[] = CHARACTER_DEFS): { def: CharacterStyleDef; fallback: boolean } {
  const found = registry.find((d) => d.id === id);
  if (found && isValidDef(found)) return { def: found, fallback: false };
  return { def: CHARACTER_DEFS.find((d) => d.id === DEFAULT_STYLE)!, fallback: true };
}

/** Gear must stay inside the 32×32 grid. */
export function isValidDef(def: CharacterStyleDef): boolean {
  return def.gear.every((p) => p.x >= 0 && p.x < 32 && p.y >= 0 && p.y < 32 && typeof p.c === 'string' && p.c.length === 1);
}
