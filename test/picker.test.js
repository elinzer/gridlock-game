import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/game/storage.js';
import { createPicker } from '../src/game/picker.js';
import { fakeBackend } from './helpers.js';

const poolOf = (n) => ({ easy: Array.from({ length: n }, (_, k) => ({ board: 'board' + k, par: 4 })), medium: [], hard: [] });

test('never repeats any of the previous 10 picks', () => {
  const picker = createPicker(poolOf(12), createStorage(() => fakeBackend()), Math.random);
  const history = [];
  for (let n = 0; n < 50; n++) {
    const pick = picker.next('easy').board;
    assert.ok(!history.slice(-10).includes(pick), 'repeated ' + pick);
    history.push(pick);
  }
});

test('a pool smaller than RECENT_SIZE + 1 still returns puzzles, least recent first', () => {
  const picker = createPicker(poolOf(3), createStorage(() => fakeBackend()), Math.random);
  const picks = [];
  for (let n = 0; n < 9; n++) picks.push(picker.next('easy').board);
  for (let n = 3; n < 9; n++) assert.equal(picks[n], picks[n - 3]);
  assert.equal(new Set(picks.slice(0, 3)).size, 3);
});

test('recent picks persist through storage', () => {
  const backend = fakeBackend();
  const pool = poolOf(11);
  const first = createPicker(pool, createStorage(() => backend), Math.random);
  const seen = [];
  for (let n = 0; n < 10; n++) seen.push(first.next('easy').board);
  const second = createPicker(pool, createStorage(() => backend), Math.random);
  const remaining = pool.easy.map((p) => p.board).filter((b) => !seen.includes(b));
  assert.deepEqual([second.next('easy').board], remaining);
});

test('picker survives corrupt recents', () => {
  const backend = fakeBackend({ 'lowerwacker.recent.v1': '{"easy":[999,"x",-1]}' });
  const picker = createPicker(poolOf(5), createStorage(() => backend), Math.random);
  assert.ok(picker.next('easy').board.startsWith('board'));
});
