import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, encodeBoard } from '../src/puzzle/board.js';
import { createAttract, stepAttract, attractView, ATTRACT } from '../src/ui/attract.js';

const BOARD = parseBoard('BBC.DD' + '..C..E' + 'AAC..E' + 'F.GG.E' + 'F..H..' + 'II.H..');
const seq = (values) => { let n = 0; return () => values[n++ % values.length]; };

test('nothing moves until the first pause ends', () => {
  const a = stepAttract(createAttract(BOARD, 0), ATTRACT.pauseMs - 1, Math.random);
  assert.equal(a.move, null);
  assert.deepEqual(attractView(a, ATTRACT.pauseMs - 1), { board: BOARD, index: -1, offset: 0 });
});

test('one vehicle slides exactly one cell, easing in and out, then settles', () => {
  let a = stepAttract(createAttract(BOARD, 0), ATTRACT.pauseMs, seq([0.3]));
  assert.ok(a.move);
  assert.equal(Math.abs(a.move.delta), 1);
  const t0 = ATTRACT.pauseMs;
  const quarter = attractView(a, t0 + ATTRACT.slideMs / 4).offset;
  const half = attractView(a, t0 + ATTRACT.slideMs / 2).offset;
  const sign = a.move.delta;
  assert.ok(Math.abs(quarter) < ATTRACT.cell / 4, 'eases in');
  assert.equal(half, sign * ATTRACT.cell / 2);
  a = stepAttract(a, t0 + ATTRACT.slideMs, seq([0.3]));
  assert.equal(a.move, null);
  assert.notEqual(encodeBoard(a.board), encodeBoard(BOARD));
  const moved = a.board.vehicles.filter((v, i) => v.row !== BOARD.vehicles[i].row || v.col !== BOARD.vehicles[i].col);
  assert.equal(moved.length, 1);
});

test('the red car never parks at the exit, and the demo runs indefinitely', () => {
  let a = createAttract(BOARD, 0);
  for (let t = 0; t < 600000; t += 250) {
    a = stepAttract(a, t, Math.random);
    assert.ok(a.board.vehicles[0].col < 4);
  }
});

test('isMoving reports an active slide', () => {
  const a = stepAttract(createAttract(BOARD, 0), ATTRACT.pauseMs, seq([0.5]));
  assert.equal(attractView(a, ATTRACT.pauseMs + 10).index >= 0, true);
});
