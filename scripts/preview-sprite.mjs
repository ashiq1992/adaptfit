// Dev helper: renders the adventurer sprite layers to PNGs for visual review.
// Usage: node scripts/preview-sprite.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ui', 'sprites.ts'), 'utf8');
function arr(name) {
  const m = new RegExp(`export const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\];`).exec(src);
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}
const pal = Object.fromEntries([...src.matchAll(/^\s+(\w): '(#[0-9a-f]{6})'/gim)].map((m) => [m[1], m[2]]));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function compose(layers) {
  const grid = Array.from({ length: 32 }, () => Array(32).fill(null));
  for (const layer of layers) layer.forEach((row, y) => [...row].forEach((ch, x) => { if (x < 32 && y < 32 && pal[ch]) grid[y][x] = pal[ch]; }));
  return grid;
}
function png(grid, scale, bg = '#131f2e') {
  const size = 32 * scale;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = hex(grid[Math.floor(y / scale)][Math.floor(x / scale)] ?? bg);
    const i = y * (size * 3 + 1) + 1 + x * 3;
    raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2];
  }
  const crc = (b) => { let c, r = ~0; for (const n of b) { c = (r ^ n) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return ~r >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const L = { BASE: arr('BASE'), SCARF: arr('SCARF'), PACK: arr('PACK'), CAPE: arr('CAPE'), ARMOUR: arr('ARMOUR'), GILDED: arr('GILDED') };
for (const [n, rows] of Object.entries(L)) rows.forEach((r, i) => { if (r.length > 32) console.warn(`${n} row ${i} length ${r.length}`); });
const stages = { lv1: ['BASE'], lv3: ['BASE', 'SCARF'], lv5: ['BASE', 'SCARF', 'PACK'], lv10: ['CAPE', 'BASE', 'SCARF', 'PACK'], lv20: ['CAPE', 'BASE', 'PACK', 'ARMOUR', 'SCARF', 'GILDED'] };
// One strip with all stages.
const strip = Object.values(stages).map((s) => compose(s.map((k) => L[k])));
const scale = 8, w = 32 * scale;
const parts = strip.map((g) => png(g, scale));
writeFileSync(join(out, 'sprite-stages.json'), JSON.stringify(Object.keys(stages)));
Object.keys(stages).forEach((k, i) => writeFileSync(join(out, `sprite-${k}.png`), parts[i]));
console.log('wrote', Object.keys(stages).length, 'previews at', w, 'px');
