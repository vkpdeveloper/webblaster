// Renders the pixel-art bomb icon to public/icon/{16,32,48,128}.png without any image dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ART = [
  '..NNNNNNNNNNNN..',
  '.NNNNNNNNNNyNrN.',
  'NNNNNNNNNNryoNNN',
  'NNNNNNNNNbNyNrNN',
  'NNNNNNNNbNNNNNNN',
  'NNNNNkkkbkNNNNNN',
  'NNNNkllkkkkNNNNN',
  'NNNklwwkkkkkNNNN',
  'NNkklwkkkkkkkNNN',
  'NNkklkkkkkkkkNNN',
  'NNkkkkkkkkkkkNNN',
  'NNkkkkkkkkkkkNNN',
  'NNNkkkkkkkkkNNNN',
  'NNNNkkkkkkkNNNNN',
  '.NNNNkkkkkNNNNN.',
  '..NNNNNNNNNNNN..',
];

const COLORS = {
  N: [0x7e, 0x25, 0x53],
  k: [0x00, 0x00, 0x00],
  l: [0x83, 0x76, 0x9c],
  w: [0xff, 0xf1, 0xe8],
  b: [0xab, 0x52, 0x36],
  y: [0xff, 0xec, 0x27],
  o: [0xff, 0xa3, 0x00],
  r: [0xff, 0x00, 0x4d],
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const scale = size / ART.length;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const ch = ART[Math.floor(y / scale)][Math.floor(x / scale)];
      const c = COLORS[ch];
      const i = row + 1 + x * 4;
      if (c) {
        raw[i] = c[0];
        raw[i + 1] = c[1];
        raw[i + 2] = c[2];
        raw[i + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(`public/icon/${size}.png`, png(size));
console.log('icons written to public/icon/');
