import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, timeLeftMs, isExpired, commitMove, resultOf } from '../src/game/round.js';
import { compareResults, formatOverPar, formatClock } from '../src/game/scoring.js';

const E = '......';
const PUZZLE = { board: '....BB' + '..C...' + 'AAC...' + '..C...' + E + E, par: 2 };
const idx = (round, id) => round.board.vehicles.findIndex((v) => v.id === id);
const fresh = () => createRound(PUZZLE, 'easy', 0);

test('createRound uses the difficulty time limit', () => {
  const r = fresh();
  assert.equal(r.limitMs, 120000);
  assert.equal(r.moves, 0);
  assert.equal(r.solvedAt, null);
  assert.equal(r.par, 2);
});

test('solving in par moves scores PAR', () => {
  let r = fresh();
  r = commitMove(r, idx(r, 'C'), 2, 1000);
  r = commitMove(r, 0, 4, 2000);
  assert.equal(r.solvedAt, 2000);
  assert.equal(r.moves, 2);
  const result = resultOf(r);
  assert.equal(result.overPar, 0);
  assert.equal(result.timeLeftMs, 118000);
  assert.equal(formatOverPar(result.overPar), 'PAR');
});

test('wasted moves count against par', () => {
  let r = fresh();
  r = commitMove(r, idx(r, 'B'), -1, 10);
  r = commitMove(r, idx(r, 'B'), 1, 20);
  r = commitMove(r, idx(r, 'C'), 2, 30);
  r = commitMove(r, 0, 4, 40);
  assert.equal(resultOf(r).overPar, 2);
});

test('a zero-delta move returns the same round', () => {
  const r = fresh();
  assert.equal(commitMove(r, idx(r, 'C'), 0, 10), r);
});

test('illegal moves are ignored', () => {
  const r = fresh();
  assert.equal(commitMove(r, idx(r, 'C'), 3, 10), r);
});

test('a move at the time limit is rejected', () => {
  let r = fresh();
  r = commitMove(r, idx(r, 'C'), 2, 1000);
  assert.equal(isExpired(r, 119999), false);
  assert.equal(isExpired(r, 120000), true);
  assert.equal(commitMove(r, 0, 4, 120000), r);
});

test('a solving move just before the limit wins and freezes time left', () => {
  let r = fresh();
  r = commitMove(r, idx(r, 'C'), 2, 1000);
  r = commitMove(r, 0, 4, 119999);
  assert.equal(r.solvedAt, 119999);
  assert.equal(timeLeftMs(r, 500000), 1);
  assert.equal(isExpired(r, 500000), false);
});

test('moves after solving are ignored', () => {
  let r = fresh();
  r = commitMove(r, idx(r, 'C'), 2, 1000);
  r = commitMove(r, 0, 4, 2000);
  assert.equal(commitMove(r, idx(r, 'B'), -1, 3000), r);
});

test('timeLeftMs counts down and stops at zero', () => {
  const r = fresh();
  assert.equal(timeLeftMs(r, 20000), 100000);
  assert.equal(timeLeftMs(r, 999999), 0);
});

test('compareResults ranks fewer moves over par first, then more time', () => {
  assert.ok(compareResults({ overPar: 0, timeLeftMs: 10 }, { overPar: 1, timeLeftMs: 90000 }) < 0);
  assert.ok(compareResults({ overPar: 1, timeLeftMs: 90000 }, { overPar: 0, timeLeftMs: 10 }) > 0);
  assert.ok(compareResults({ overPar: 2, timeLeftMs: 5000 }, { overPar: 2, timeLeftMs: 4000 }) < 0);
  assert.equal(compareResults({ overPar: 2, timeLeftMs: 5000 }, { overPar: 2, timeLeftMs: 5000 }), 0);
});

test('formatOverPar', () => {
  assert.equal(formatOverPar(0), 'PAR');
  assert.equal(formatOverPar(3), '+3');
});

test('formatClock rounds seconds up', () => {
  assert.equal(formatClock(120000), '2:00');
  assert.equal(formatClock(61001), '1:02');
  assert.equal(formatClock(9000), '0:09');
  assert.equal(formatClock(0), '0:00');
});
