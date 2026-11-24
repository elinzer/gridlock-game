import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePNG } from '../tools/png.js';

test('encodes a valid RGBA PNG', () => {
  const w = 3;
  const h = 2;
  const rgba = new Uint8Array(w * h * 4).map((_, n) => n);
  const png = encodePNG(w, h, rgba);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString('latin1', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), w);
  assert.equal(png.readUInt32BE(20), h);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6);
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.toString('latin1', 37, 41), 'IDAT');
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, h * (1 + w * 4));
  assert.deepEqual([...raw.subarray(1, 1 + w * 4)], [...rgba.subarray(0, w * 4)]);
  assert.equal(png.toString('latin1', png.length - 8, png.length - 4), 'IEND');
});
