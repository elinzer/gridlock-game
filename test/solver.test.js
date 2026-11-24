import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, encodeBoard, applyMove, isSolved } from '../src/puzzle/board.js';
import { solve, componentDistances } from '../src/puzzle/solver.js';

const E = '......';
const EXAMPLE = '....BB' + '..C...' + 'AAC...' + '..C...' + E + E;

test('one-move board has par 1', () => {
  assert.equal(solve(parseBoard(E + E + 'AA....' + E + E + E)).par, 1);
});

test('example board has par 2', () => {
  assert.equal(solve(parseBoard(EXAMPLE)).par, 2);
});

test('permanently blocked board is unsolvable', () => {
  assert.equal(solve(parseBoard(E + E + 'AA.BBB' + E + E + E)), null);
});

test('componentDistances gives distance to nearest solved state', () => {
  const b = parseBoard(EXAMPLE);
  const dist = componentDistances(b);
  assert.equal(dist.get(encodeBoard(b)), 2);
  for (const d of dist.values()) assert.ok(d >= 0);
});

test('componentDistances is empty for unsolvable components', () => {
  assert.equal(componentDistances(parseBoard(E + E + 'AA.BBB' + E + E + E)).size, 0);
});

test('replaying the solution path solves the board', () => {
  let b = parseBoard(EXAMPLE);
  for (const m of solve(b).path) b = applyMove(b, m.i, m.delta);
  assert.equal(isSolved(b), true);
});
