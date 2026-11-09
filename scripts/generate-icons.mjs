// Generates the app icon, favicon and iOS splash screens in public/ ("Ink & Paper", V0.5).
// Mark: ruled notebook lines where the last line steps up, with a highlighter
// stroke behind the step. Original artwork, dependency-free: PNGs are written
// with node:zlib.
// Run: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const INK = [28, 27, 24]; // #1C1B18
const PAPER = [246, 242, 234]; // #F6F2EA
const HI = [230, 240, 106]; // #E6F06A

// Mark geometry in a 64×64 box.
const RULES = [
  [[16, 20], [48, 20]],
  [[16, 30], [48, 30]],
];
const RULE_W = 2.6;
const HI_RECT = [34, 35, 17, 9, 2.5];
const STEP = [[16, 46], [30, 46], [37, 39], [48, 39]];
const STEP_W = 3.6;
const CONTENT_CENTRE = [32, 33]; // optical centre of the drawn content

const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

function inRoundRect(x, y, [rx, ry, w, h, r]) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function distSeg(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax,
    dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Colour of the mark at (x, y) in mark units over `bg`, with `fg` as the ink. */
function markAt(x, y, bg, fg) {
  for (let i = 0; i < STEP.length - 1; i++) if (distSeg(x, y, STEP[i], STEP[i + 1]) <= STEP_W / 2) return fg;
  if (inRoundRect(x, y, HI_RECT)) return HI;
  for (const [a, b] of RULES) if (distSeg(x, y, a, b) <= RULE_W / 2) return mix(bg, fg, 0.32);
  return null;
}

function crc32(buf) {
  let c,
    crc = 0xffffffff;
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
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Render a w×h image on `bg`, with the 64-unit mark drawn `markSize` px wide around the centre. */
function render(w, h, markSize, bg, fg) {
  const scale = markSize / 64;
  const ox = w / 2 - CONTENT_CENTRE[0] * scale;
  const oy = h / 2 - CONTENT_CENTRE[1] * scale;
  const SS = 3;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const y0 = oy + 16 * scale - 4,
    y1 = oy + 50 * scale + 4,
    x0 = ox + 12 * scale - 4,
    x1 = ox + 54 * scale + 4;
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      let c = bg;
      if (y >= y0 && y <= y1 && x >= x0 && x <= x1) {
        const acc = [0, 0, 0];
        for (let sy = 0; sy < SS; sy++)
          for (let sx = 0; sx < SS; sx++) {
            const m = markAt((x + (sx + 0.5) / SS - ox) / scale, (y + (sy + 0.5) / SS - oy) / scale, bg, fg) ?? bg;
            acc[0] += m[0];
            acc[1] += m[1];
            acc[2] += m[2];
          }
        c = acc.map((v) => Math.round(v / (SS * SS)));
      }
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = c[0];
      raw[i + 1] = c[1];
      raw[i + 2] = c[2];
    }
  }
  return png(w, h, raw);
}

const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${hex(INK)}"/><path d="M16 20H48M16 30H48" stroke="${hex(PAPER)}" stroke-opacity=".35" stroke-width="${RULE_W}" stroke-linecap="round"/><rect x="34" y="35" width="17" height="9" rx="2.5" fill="${hex(HI)}"/><path d="M16 46H30L37 39H48" stroke="${hex(PAPER)}" stroke-width="${STEP_W}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;

// App icons: paper mark on ink (stands out on a home screen). The platform applies its own corner mask.
writeFileSync(join(out, 'icon-192.png'), render(192, 192, 192, INK, PAPER));
writeFileSync(join(out, 'icon-512.png'), render(512, 512, 512, INK, PAPER));
// Maskable: keep the mark inside the 80% safe zone.
writeFileSync(join(out, 'icon-maskable-512.png'), render(512, 512, 400, INK, PAPER));
writeFileSync(join(out, 'apple-touch-icon.png'), render(180, 180, 180, INK, PAPER));
writeFileSync(join(out, 'favicon.svg'), svg);

// iOS launch screens (portrait): ink mark on paper, matching the app's first screen.
export const SPLASH = [
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 }, // iPhone SE / 8
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 }, // X / XS / 11 Pro / 12 mini / 13 mini
  { w: 828, h: 1792, dw: 414, dh: 896, r: 2 }, // XR / 11
  { w: 1242, h: 2688, dw: 414, dh: 896, r: 3 }, // XS Max / 11 Pro Max
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 }, // 12 / 13 / 14
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 }, // 12–14 Pro Max / 14 Plus
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 }, // 14 Pro / 15 / 15 Pro / 16
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 }, // 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus
];
mkdirSync(join(out, 'splash'), { recursive: true });
for (const s of SPLASH) writeFileSync(join(out, 'splash', `splash-${s.w}x${s.h}.png`), render(s.w, s.h, Math.round(s.w * 0.42), PAPER, INK));
console.log('Icons and splash screens written to', out);
