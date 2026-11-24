import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, VEHICLE_COLORS } from '../src/ui/palette.js';
import { GLYPHS, textWidth, drawText } from '../src/ui/font.js';
import {
  W, H, BOARD, SIDEBAR, QR_CARD, CREDIT, UI_STRINGS, SIDEBAR_LINES, cellAt, buttonsFor, hitTest, toInternal,
} from '../src/ui/layout.js';
import { initialState } from '../src/game/app.js';

const SCREENS = ['title', 'difficulty', 'play', 'solved', 'initials', 'leaderboard', 'timesup'];
const stateFor = (screen) => Object.assign(initialState(0), { screen, difficulty: 'easy' });
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('internal resolution is 256x192', () => {
  assert.equal(W, 256);
  assert.equal(H, 192);
});

test('palette has 16 colors and a unique red', () => {
  assert.equal(Object.keys(PALETTE).length, 16);
  for (const name of ['bg', 'road', 'roadLine', 'frame', 'text', 'accent', 'red', 'exit', 'paper', 'ink']) {
    assert.match(PALETTE[name], /^#[0-9a-f]{6}$/, name);
  }
  assert.ok(VEHICLE_COLORS.length >= 6);
  assert.equal(new Set(VEHICLE_COLORS).size, VEHICLE_COLORS.length);
  assert.ok(!VEHICLE_COLORS.includes(PALETTE.red));
  for (const c of VEHICLE_COLORS) assert.ok(Object.values(PALETTE).includes(c));
});

test('every UI string has glyphs', () => {
  for (const s of UI_STRINGS) {
    for (const ch of s) assert.ok(GLYPHS[ch], `missing glyph ${JSON.stringify(ch)} in ${s}`);
  }
  for (const s of ['LOWER WACKER', 'BUILT BY', 'YOUR DRIVER', 'SCAN TO', 'CONNECT', 'STILL PLAYING?', "TIME'S UP", 'PAR WAS', 'TRY AGAIN', 'EASY  ~1 MIN']) {
    assert.ok(UI_STRINGS.includes(s), s);
  }
  for (const ch of '0123456789:+-./') assert.ok(GLYPHS[ch], ch);
});

test('every glyph is 7 rows of 5 columns', () => {
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    assert.equal(rows.length, 7, ch);
    for (const r of rows) assert.match(r, /^[01]{5}$/, ch);
  }
});

test('textWidth uses a 6px advance with no trailing gap', () => {
  assert.equal(textWidth('A'), 5);
  assert.equal(textWidth('AB'), 11);
  assert.equal(textWidth('AB', 2), 22);
  assert.equal(textWidth(''), 0);
});

test('drawText fills one rect per lit pixel', () => {
  const rects = [];
  const ctx = { fillStyle: '', fillRect: (x, y, w, h) => rects.push([x, y, w, h]) };
  drawText(ctx, '-', 10, 20, '#ffffff', 2);
  assert.deepEqual(rects, [[10, 26, 2, 2], [12, 26, 2, 2], [14, 26, 2, 2], [16, 26, 2, 2], [18, 26, 2, 2]]);
});

for (const screen of SCREENS) {
  test(`${screen}: buttons are big enough, on screen, and clear of each other and the QR credit`, () => {
    const buttons = buttonsFor(screen, stateFor(screen));
    assert.ok(buttons.length > 0);
    buttons.forEach((b, n) => {
      assert.ok(b.w >= 32 && b.h >= 20, `${b.target} too small`);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${b.target} off screen`);
      assert.ok(!overlaps(b, CREDIT), `${b.target} overlaps the QR credit`);
      buttons.slice(n + 1).forEach((o) => assert.ok(!overlaps(b, o), `${b.target} overlaps ${o.target}`));
      if (b.label) assert.ok(textWidth(b.label) <= b.w - 4, `${b.target} label overflows`);
    });
  });
}

test('play buttons stay off the board', () => {
  const frame = { x: BOARD.x - 4, y: BOARD.y - 4, w: BOARD.cell * 6 + 8, h: BOARD.cell * 6 + 8 };
  for (const b of buttonsFor('play', stateFor('play'))) assert.ok(!overlaps(b, frame), b.target);
});

test('QR card fits a version-3 code with a 4-module quiet zone at 2px', () => {
  assert.ok(QR_CARD.w >= (29 + 8) * 2 && QR_CARD.h >= (29 + 8) * 2);
  assert.ok(QR_CARD.x >= CREDIT.x && QR_CARD.y >= CREDIT.y);
  assert.ok(QR_CARD.x + QR_CARD.w <= CREDIT.x + CREDIT.w && QR_CARD.y + QR_CARD.h <= CREDIT.y + CREDIT.h);
  assert.ok(CREDIT.x + CREDIT.w <= W && CREDIT.y + CREDIT.h <= H);
});

test('sidebar text fits the sidebar width', () => {
  for (const line of SIDEBAR_LINES) assert.ok(textWidth(line) <= SIDEBAR.w, line);
});

test('cellAt', () => {
  assert.deepEqual(cellAt(12, 24), { row: 0, col: 0 });
  assert.deepEqual(cellAt(12 + 143, 24 + 143), { row: 5, col: 5 });
  assert.equal(cellAt(11, 24), null);
  assert.equal(cellAt(12 + 144, 24), null);
});

test('hitTest finds the EASY button', () => {
  const easy = buttonsFor('difficulty', stateFor('difficulty')).find((b) => b.target === 'diff:easy');
  assert.equal(hitTest('difficulty', stateFor('difficulty'), easy.x + easy.w / 2, easy.y + easy.h / 2), 'diff:easy');
  assert.equal(hitTest('difficulty', stateFor('difficulty'), 255, 191), null);
});

test('toInternal maps client coordinates into 256x192', () => {
  const rect = { left: 0, top: 0, width: 1024, height: 768 };
  assert.deepEqual(toInternal(512, 384, rect), { x: 128, y: 96 });
  assert.deepEqual(toInternal(100 + 512, 50 + 384, { left: 100, top: 50, width: 1024, height: 768 }), { x: 128, y: 96 });
});
