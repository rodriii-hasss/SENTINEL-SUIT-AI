'use strict';

// Genera iconos PNG (192, 512 y 512 maskable) sin dependencias externas.
// Uso: node scripts/gen-icon.js

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) { raw[o++] = 0; rgba.copy(raw, o, y * size * 4, (y + 1) * size * 4); o += size * 4; }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const R = size / 2;
  const ringOuter = size * (maskable ? 0.30 : 0.38);
  const ringInner = ringOuter - size * 0.045;
  const dotR = size * 0.085;
  const dotAngle = -Math.PI / 3.4;
  const dotD = size * (maskable ? 0.27 : 0.32);
  const coreR = size * 0.10;
  const rad = size * (maskable ? 0 : 0.10);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0;
      let rC = 0, gC = 0, bC = 0;
      if (x >= rad && x < size - rad && y >= rad && y < size - rad) {
        a = maskable ? 255 : 250;
        rC = 4; gC = 10; bC = 20;
      }
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (a > 0) {
        if (d <= ringOuter && d >= ringInner) {
          rC = 0; gC = 212; bC = 255;
          if (d > ringOuter - size * 0.02 || d < ringInner + size * 0.02) { rC = 0; gC = 140; bC = 180; }
        }
        const ddx = dx - Math.cos(dotAngle) * dotD;
        const ddy = dy - Math.sin(dotAngle) * dotD;
        const dDot = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dDot <= dotR) { rC = 255; gC = 107; bC = 53; }
        if (d <= coreR) {
          rC = 0; gC = 150; bC = 190;
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = rC; rgba[i + 1] = gC; rgba[i + 2] = bC; rgba[i + 3] = a;
    }
  }
  return encodePNG(size, rgba);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192, false));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512, false));
fs.writeFileSync(path.join(outDir, 'icon-512-maskable.png'), drawIcon(512, true));
console.log('iconos generados en ' + outDir);
