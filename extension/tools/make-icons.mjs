// Generates the toolbar icons (no image deps): navy tile, white resume page,
// green "match" badge. Run: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const NAVY = [31, 58, 95], WHITE = [255, 255, 255], LINE = [148, 170, 199], GREEN = [5, 150, 105];

function shade(u, v) {
  // u,v in 0..1. Returns [r,g,b,a]
  const r = 0.2, inTile = (() => { const dx = Math.max(r - u, 0, u - (1 - r)), dy = Math.max(r - v, 0, v - (1 - r)); return dx * dx + dy * dy <= r * r; })();
  if (!inTile) return [0, 0, 0, 0];
  const bx = 0.71, by = 0.71, br = 0.2;
  if ((u - bx) ** 2 + (v - by) ** 2 <= br ** 2) {
    const ring = (u - bx) ** 2 + (v - by) ** 2 > (br - 0.035) ** 2;
    if (ring) return [...NAVY, 255];
    // check mark
    const onSeg = (x1, y1, x2, y2, w) => { const t = Math.max(0, Math.min(1, ((u - x1) * (x2 - x1) + (v - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2))); return (u - (x1 + t * (x2 - x1))) ** 2 + (v - (y1 + t * (y2 - y1))) ** 2 <= w * w; };
    if (onSeg(0.63, 0.71, 0.69, 0.78, 0.028) || onSeg(0.69, 0.78, 0.8, 0.64, 0.028)) return [...WHITE, 255];
    return [...GREEN, 255];
  }
  if (u > 0.24 && u < 0.66 && v > 0.18 && v < 0.8) {
    const lines = [0.32, 0.43, 0.54, 0.65];
    if (u > 0.31 && u < (v > 0.6 ? 0.5 : 0.59) && lines.some((y) => Math.abs(v - y) < 0.025)) return [...LINE, 255];
    if (u > 0.31 && u < 0.45 && v > 0.23 && v < 0.27) return [...NAVY, 255];
    return [...WHITE, 255];
  }
  return [...NAVY, 255];
}

function png(size) {
  const SS = 4, raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const a = acc[3] / (SS * SS);
      raw[o] = acc[3] ? acc[0] / acc[3] : 0; raw[o + 1] = acc[3] ? acc[1] / acc[3] : 0; raw[o + 2] = acc[3] ? acc[2] / acc[3] : 0; raw[o + 3] = a;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const dir = new URL('../icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(new URL(`icon${s}.png`, dir), png(s));
console.log('icons written');
