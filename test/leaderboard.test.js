import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/game/storage.js';
import { createLeaderboard } from '../src/game/leaderboard.js';
import { isBlocked, LETTERS } from '../src/game/initials.js';
import { fakeBackend } from './helpers.js';

const KEY = 'lowerwacker.leaderboard.v1';
const entry = (initials, overPar, timeLeftMs) => ({ initials, overPar, timeLeftMs });
const fresh = (backend = fakeBackend()) => createLeaderboard(createStorage(() => backend));

test('keeps the top 10 sorted', () => {
  const lb = fresh();
  for (let n = 0; n < 12; n++) lb.insert('easy', entry('AAA', n % 4, n * 1000));
  const list = lb.entries('easy');
  assert.equal(list.length, 10);
  for (let n = 1; n < list.length; n++) {
    const a = list[n - 1];
    const b = list[n];
    assert.ok(a.overPar < b.overPar || (a.overPar === b.overPar && a.timeLeftMs >= b.timeLeftMs));
  }
  assert.equal(lb.rankFor('easy', { overPar: 9, timeLeftMs: 0 }), null);
  assert.equal(lb.rankFor('easy', { overPar: 0, timeLeftMs: 999999 }), 0);
});

test('rankFor on an empty board is 0', () => {
  assert.equal(fresh().rankFor('hard', { overPar: 5, timeLeftMs: 1 }), 0);
});

test('a new entry goes after existing equal ones', () => {
  const lb = fresh();
  lb.insert('easy', entry('ABC', 0, 5000));
  assert.equal(lb.rankFor('easy', { overPar: 0, timeLeftMs: 5000 }), 1);
  assert.equal(lb.insert('easy', entry('XYZ', 0, 5000)), 1);
  assert.deepEqual(lb.entries('easy').map((e) => e.initials), ['ABC', 'XYZ']);
});

test('boards are independent', () => {
  const lb = fresh();
  lb.insert('easy', entry('ABC', 0, 5000));
  assert.deepEqual(lb.entries('medium'), []);
  assert.deepEqual(lb.entries('hard'), []);
});

test('entries persist across instances', () => {
  const backend = fakeBackend();
  fresh(backend).insert('medium', entry('JOE', 1, 3000));
  assert.deepEqual(fresh(backend).entries('medium'), [entry('JOE', 1, 3000)]);
});

test('works in memory when getting storage throws', () => {
  const lb = createLeaderboard(createStorage(() => { throw new Error('SecurityError'); }));
  assert.equal(lb.insert('easy', entry('ABC', 0, 5000)), 0);
  assert.deepEqual(lb.entries('easy'), [entry('ABC', 0, 5000)]);
});

test('works in memory when setItem throws QuotaExceededError', () => {
  const backend = fakeBackend();
  backend.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  const lb = fresh(backend);
  lb.insert('easy', entry('ABC', 0, 5000));
  lb.insert('easy', entry('DEF', 1, 5000));
  assert.deepEqual(lb.entries('easy').map((e) => e.initials), ['ABC', 'DEF']);
});

test('works in memory when getItem throws', () => {
  const backend = fakeBackend();
  backend.getItem = () => { throw new Error('nope'); };
  const lb = fresh(backend);
  lb.insert('hard', entry('ABC', 0, 5000));
  assert.deepEqual(lb.entries('hard'), [entry('ABC', 0, 5000)]);
});

for (const raw of ['not json', '{"easy":"x"}', 'null', '42', '[]']) {
  test(`corrupt stored data ${raw} is ignored`, () => {
    const lb = fresh(fakeBackend({ [KEY]: raw }));
    assert.deepEqual(lb.entries('easy'), []);
    assert.equal(lb.insert('easy', entry('ABC', 0, 5000)), 0);
  });
}

test('invalid entries are dropped, valid ones kept', () => {
  const stored = JSON.stringify({
    easy: [
      entry('ABC', 0, 5000),
      { initials: 'ABC' },
      entry('abc', 0, 1),
      entry('ABCD', 0, 1),
      entry('XYZ', '1', 1),
      entry('XYZ', 1, null),
      entry('QQQ', Infinity, 1),
      null,
      entry('DEF', 2, 100),
    ],
    medium: { not: 'a list' },
  });
  const lb = fresh(fakeBackend({ [KEY]: stored }));
  assert.deepEqual(lb.entries('easy').map((e) => e.initials), ['ABC', 'DEF']);
  assert.deepEqual(lb.entries('medium'), []);
});

test('initials blocklist', () => {
  assert.equal(LETTERS, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.equal(isBlocked('ASS'), true);
  assert.equal(isBlocked('ABC'), false);
});
