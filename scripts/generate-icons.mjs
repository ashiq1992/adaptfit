// Generates app icons in public/ from the AdaptFit logo mark (teal chevron over
// a dumbbell, on graphite). Dependency-free: PNGs are written with node:zlib.
// Run: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TEAL = [0, 214, 163];
const BG = [15, 17, 22];
const BG2 = [19, 31, 46];

// Logo geometry in a 32×32 box (mirrors src/ui/icons.tsx Logo).
const RECTS = [
  [3, 16, 4, 12, 1.5],
  [8, 18, 3, 8, 1],
  [11, 21, 10, 2.6, 1],
  [21, 18, 3, 8, 1],
  [25, 16, 4, 12, 1.5],
];
const CHEVRON = [
  [9, 13],
  [16, 5],
  [23, 13],
];
const STROKE = 3.4;

function inRoundRect(x, y, [rx, ry, w, h, r]) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function distSeg(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inLogo(x, y) {
  if (RECTS.some((r) => inRoundRect(x, y, r))) return true;
  return distSeg(x, y, CHEVRON[0], CHEVRON[1]) <= STROKE / 2 || distSeg(x, y, CHEVRON[1], CHEVRON[2]) <= STROKE / 2;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** `fill` = fraction of the canvas the 32-unit logo spans. */
function renderPng(size, fill) {
  const scale = (size * fill) / 32;
  const offset = (size - 32 * scale) / 2;
  const SS = 4;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const lx = (x + (sx + 0.5) / SS - offset) / scale;
          const ly = (y + 0.08 * size / scale + (sy + 0.5) / SS - offset) / scale;
          if (inLogo(lx, ly)) hits++;
        }
      const a = hits / (SS * SS);
      // Subtle vertical gradient from graphite to midnight.
      const g = y / size;
      const bg = BG.map((c, i) => Math.round(c + (BG2[i] - c) * g));
      const rgb = bg.map((c, i) => Math.round(c + (TEAL[i] - c) * a));
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = rgb[0]; raw[i + 1] = rgb[1]; raw[i + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f1116"/><g transform="translate(3 2.5) scale(0.8125)"><path d="M9 13 16 5l7 8" fill="none" stroke="#00d6a3" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>${RECTS.map(([x, y, w, h, r]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#00d6a3"/>`).join('')}</g></svg>\n`;

writeFileSync(join(out, 'icon-192.png'), renderPng(192, 0.72));
writeFileSync(join(out, 'icon-512.png'), renderPng(512, 0.72));
writeFileSync(join(out, 'icon-maskable-512.png'), renderPng(512, 0.52));
writeFileSync(join(out, 'apple-touch-icon.png'), renderPng(180, 0.66));
writeFileSync(join(out, 'favicon.svg'), svg);
console.log('Icons written to', out);
