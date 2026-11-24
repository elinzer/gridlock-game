import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard } from '../src/puzzle/board.js';
import { BOARD } from '../src/ui/layout.js';
import { beginDrag, dragOffsetPx, endDrag, cancelDrag } from '../src/ui/drag.js';
import { initialState, reduce } from '../src/game/app.js';
import { createStorage } from '../src/game/storage.js';
import { createLeaderboard } from '../src/game/leaderboard.js';

const E = '......';
const PUZZLE = { board: '....BB' + '..C...' + 'AAC...' + '..C...' + E + E, par: 2 };
const board = parseBoard(PUZZLE.board);
const cIdx = board.vehicles.findIndex((v) => v.id === 'C');
const center = (row, col) => ({ x: BOARD.x + col * BOARD.cell + BOARD.cell / 2, y: BOARD.y + row * BOARD.cell + BOARD.cell / 2 });

test('beginDrag picks the vehicle under the point', () => {
  const p = center(2, 2);
  const drag = beginDrag(board, p.x, p.y, 7);
  assert.equal(drag.i, cIdx);
  assert.equal(drag.touchId, 7);
  assert.equal(drag.horiz, false);
  assert.deepEqual(drag.range, { min: -1, max: 2 });
});

test('beginDrag on an empty cell or off the board is null', () => {
  const p = center(5, 5);
  assert.equal(beginDrag(board, p.x, p.y, 1), null);
  assert.equal(beginDrag(board, 2, 2, 1), null);
});

test('drag offset is clamped to the slide range', () => {
  const p = center(2, 2);
  const drag = beginDrag(board, p.x, p.y, 1);
  assert.equal(dragOffsetPx(drag, p.x, p.y + 100), 2 * BOARD.cell);
  assert.equal(dragOffsetPx(drag, p.x, p.y - 100), -1 * BOARD.cell);
  assert.equal(endDrag(drag, p.x, p.y + 100), 2);
});

test('releases snap to the nearest cell', () => {
  const p = center(2, 2);
  const drag = beginDrag(board, p.x, p.y, 1);
  assert.equal(endDrag(drag, p.x, p.y + 11), 0);
  assert.equal(endDrag(drag, p.x, p.y + 13), 1);
  assert.equal(endDrag(drag, p.x, p.y - 13), -1);
});

test('a vertical vehicle ignores horizontal motion', () => {
  const p = center(2, 2);
  const drag = beginDrag(board, p.x, p.y, 1);
  assert.equal(dragOffsetPx(drag, p.x + 60, p.y), 0);
  assert.equal(endDrag(drag, p.x + 60, p.y), 0);
});

test('an interrupted drag commits no move', () => {
  assert.equal(cancelDrag(), 0);
  const deps = { picker: { next: () => PUZZLE }, leaderboard: createLeaderboard(createStorage(() => null)) };
  let s = reduce(initialState(0), { type: 'tap', target: 'title:play', now: 0 }, deps);
  s = reduce(s, { type: 'tap', target: 'diff:easy', now: 0 }, deps);
  s = reduce(s, { type: 'move', i: cIdx, delta: cancelDrag(), now: 10 }, deps);
  assert.equal(s.round.moves, 0);
});
