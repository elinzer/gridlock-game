import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE, EXIT_ROW, parseBoard, encodeBoard, vehicleAt, slideRange, applyMove, isSolved, legalMoves,
} from '../src/puzzle/board.js';

const EXAMPLE = '....BB' + '..C...' + 'AAC...' + '..C...' + '......' + '......';
const idx = (board, id) => board.vehicles.findIndex((v) => v.id === id);

test('constants', () => {
  assert.equal(SIZE, 6);
  assert.equal(EXIT_ROW, 2);
});

test('parse/encode round-trips and infers vehicles', () => {
  const b = parseBoard(EXAMPLE);
  assert.equal(encodeBoard(b), EXAMPLE);
  assert.deepEqual(b.vehicles[0], { id: 'A', row: 2, col: 0, len: 2, horiz: true });
  const c = b.vehicles[idx(b, 'C')];
  assert.equal(c.len, 3);
  assert.equal(c.horiz, false);
});

test('encode canonicalizes letters in reading order', () => {
  const b = parseBoard('....ZZ' + '..Q...' + 'AAQ...' + '..Q...' + '......' + '......');
  assert.equal(encodeBoard(b), EXAMPLE);
});

test('parse rejects invalid boards', () => {
  const empty = '......';
  assert.throws(() => parseBoard(EXAMPLE.slice(1)));
  assert.throws(() => parseBoard(empty + empty + '..BB..' + empty + empty + empty));
  assert.throws(() => parseBoard(empty + '..A...' + '..A...' + empty + empty + empty));
  assert.throws(() => parseBoard('AA....' + empty + empty + empty + empty + empty));
  assert.throws(() => parseBoard(empty + '.B....' + 'AABB..' + empty + empty + empty));
  assert.throws(() => parseBoard(empty + empty + 'AA....' + 'BBBB..' + empty + empty));
  assert.throws(() => parseBoard(empty + empty + 'AA..x.' + empty + empty + empty));
});

test('vehicleAt', () => {
  const b = parseBoard(EXAMPLE);
  assert.equal(vehicleAt(b, 2, 1), 0);
  assert.equal(vehicleAt(b, 3, 2), idx(b, 'C'));
  assert.equal(vehicleAt(b, 5, 5), -1);
});

test('slideRange', () => {
  const b = parseBoard(EXAMPLE);
  assert.deepEqual(slideRange(b, 0), { min: 0, max: 0 });
  assert.deepEqual(slideRange(b, idx(b, 'C')), { min: -1, max: 2 });
  assert.deepEqual(slideRange(b, idx(b, 'B')), { min: -4, max: 0 });
});

test('applyMove clears the path and solves', () => {
  const b = parseBoard(EXAMPLE);
  const moved = applyMove(b, idx(b, 'C'), 2);
  assert.equal(slideRange(moved, 0).max, 4);
  assert.equal(isSolved(moved), false);
  assert.equal(isSolved(applyMove(moved, 0, 4)), true);
});

test('applyMove rejects 0 and out-of-range deltas without mutating', () => {
  const b = parseBoard(EXAMPLE);
  const before = structuredClone(b);
  assert.throws(() => applyMove(b, idx(b, 'C'), 0));
  assert.throws(() => applyMove(b, idx(b, 'C'), 3));
  assert.throws(() => applyMove(b, idx(b, 'C'), -2));
  applyMove(b, idx(b, 'C'), 2);
  assert.deepEqual(b, before);
});

test('legalMoves', () => {
  assert.equal(legalMoves(parseBoard(EXAMPLE)).length, 7);
});
