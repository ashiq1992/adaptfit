import { memo } from 'react';
import { type CharacterStyleDef, GEAR_PALETTE, resolveStyle } from '../content/characters';
import { type UnlockId, unlockedParts } from '../domain/rpg';
import { ARMOUR, BASE, CAPE, GILDED, PACK, PALETTE, SCARF } from './sprites';

type Layer = readonly string[];

/** Order matters: the cape is drawn behind the body. */
const LAYERS: { id: UnlockId | 'base'; rows: Layer; behind?: boolean }[] = [
  { id: 'cape', rows: CAPE, behind: true },
  { id: 'base', rows: BASE },
  { id: 'pack', rows: PACK },
  { id: 'armour', rows: ARMOUR },
  { id: 'scarf', rows: SCARF },
  { id: 'gilded', rows: GILDED },
];

function compose(parts: Set<string>, def: CharacterStyleDef): { x: number; y: number; w: number; fill: string }[] {
  const palette: Record<string, string> = { ...PALETTE, ...GEAR_PALETTE, ...def.palette };
  const grid: (string | null)[][] = Array.from({ length: 32 }, () => Array<string | null>(32).fill(null));
  const paint = (x: number, y: number, ch: string) => {
    const c = palette[ch];
    if (c && x >= 0 && x < 32 && y >= 0 && y < 32) grid[y]![x] = c;
  };
  for (const layer of LAYERS) {
    if (layer.id !== 'base' && !parts.has(layer.id)) continue;
    layer.rows.forEach((row, y) => {
      for (let x = 0; x < Math.min(32, row.length); x++) paint(x, y, row[x]!);
    });
    // Style gear sits on the body, under the unlockable layers.
    if (layer.id === 'base') for (const p of def.gear) paint(p.x, p.y, p.c);
  }
  // Merge horizontal runs into single rects to keep the DOM light.
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < 32) {
      const fill = row[x];
      if (!fill) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < 32 && row[x + w] === fill) w++;
      rects.push({ x, y, w, fill });
      x += w;
    }
  });
  return rects;
}

interface Props {
  level: number;
  /** Character style ID; unknown styles render the default sprite. */
  styleId?: string;
  /** Unlocked layers to hide (cosmetic choice). */
  hidden?: readonly string[];
  size?: number;
  label?: string;
  /** Override unlocks (e.g. to preview a future look). */
  parts?: Set<UnlockId>;
  className?: string;
  decorative?: boolean;
}

/** Original pixel adventurer whose gear reflects the level reached. Cosmetic only. */
export const Adventurer = memo(function Adventurer({ level, styleId, hidden, size = 96, label, parts, className, decorative }: Props) {
  const { def, fallback } = resolveStyle(styleId ?? 'warrior');
  const shown = new Set<string>(parts ?? unlockedParts(level));
  for (const h of hidden ?? []) shown.delete(h);
  const rects = compose(shown, def);
  return (
    <svg
      className={`pixel ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      data-style={def.id}
      data-fallback={fallback ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : (label ?? `Your ${def.name.toLowerCase()}, level ${level}`)}
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
});

/** Hexagonal achievement badge; amber for common, violet for rare. */
export function HexBadge({ earned, rarity, children, size = 60 }: { earned: boolean; rarity: 'common' | 'rare'; children: React.ReactNode; size?: number }) {
  const fill = !earned ? '#22354b' : rarity === 'rare' ? '#9b6dff' : '#f5b041';
  const rim = !earned ? '#3a5068' : rarity === 'rare' ? '#c9b0ff' : '#ffd88a';
  return (
    <span className="badge-shape" style={{ width: size, height: size * 1.1 }}>
      <svg className="hex" viewBox="0 0 60 66" aria-hidden="true">
        <path d="M30 2 56 17v32L30 64 4 49V17L30 2Z" fill={fill} stroke={rim} strokeWidth="3" />
        <path d="M30 10 49 21v24L30 56 11 45V21L30 10Z" fill="none" stroke="rgba(15,17,22,0.25)" strokeWidth="2" />
      </svg>
      <span className="glyph">{children}</span>
    </span>
  );
}
