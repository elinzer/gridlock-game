import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { LINKEDIN_URL } from '../src/config.js';

test('build emits single-file html, sw, and ES2018-only JS', () => {
  execSync('node tools/build.js');
  const html = readFileSync('dist/index.html', 'utf8');
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  const urls = (html.match(/https?:\/\/[^\s"'`)<]+/g) || []).filter(u => !LINKEDIN_URL.startsWith(u) && !u.startsWith(LINKEDIN_URL));
  assert.deepEqual(urls, []);
  const sw = readFileSync('dist/sw.js', 'utf8');
  assert.doesNotMatch(sw, /__CACHE_VERSION__/);
});

test('QR matrix fits the sidebar (version 3 or lower)', async () => {
  execSync('node tools/build.js');
  const { QR } = await import('../src/generated/qr.js?' + Date.now());
  assert.ok(QR.size <= 29);
  assert.equal(QR.modules.length, QR.size * QR.size);
});
