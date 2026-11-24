import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idleStatus } from '../src/game/idle.js';
import { initialState, reduce, warningVisible } from '../src/game/app.js';
import { createStorage } from '../src/game/storage.js';
import { createLeaderboard } from '../src/game/leaderboard.js';

const E = '......';
const PUZZLE = { board: '....BB' + '..C...' + 'AAC...' + '..C...' + E + E, par: 2 };

function setup() {
  const picks = [];
  const deps = {
    picker: { next(d) { picks.push(d); return PUZZLE; } },
    leaderboard: createLeaderboard(createStorage(() => null)),
  };
  return { deps, picks };
}

const tap = (target, now = 0) => ({ type: 'tap', target, now });
const run = (state, events, deps) => events.reduce((s, e) => reduce(s, e, deps), state);
const idxC = (state) => state.round.board.vehicles.findIndex((v) => v.id === 'C');

function solvedState(deps, now = 1000) {
  let s = run(initialState(0), [tap('title:play'), tap('diff:easy')], deps);
  s = reduce(s, { type: 'move', i: idxC(s), delta: 2, now }, deps);
  return reduce(s, { type: 'move', i: 0, delta: 4, now }, deps);
}

test('idleStatus', () => {
  assert.deepEqual(idleStatus(0, 59999), { status: 'active', secondsLeft: 10 });
  assert.deepEqual(idleStatus(0, 60000), { status: 'warning', secondsLeft: 10 });
  assert.deepEqual(idleStatus(0, 60001), { status: 'warning', secondsLeft: 10 });
  assert.deepEqual(idleStatus(0, 69001), { status: 'warning', secondsLeft: 1 });
  assert.deepEqual(idleStatus(0, 70000), { status: 'expired', secondsLeft: 0 });
});

test('initial state', () => {
  const s = initialState(5);
  assert.equal(s.screen, 'title');
  assert.equal(s.boardTab, 'easy');
  assert.equal(s.lastTouchAt, 5);
  assert.equal(s.round, null);
});

test('title → difficulty → play, and back', () => {
  const { deps, picks } = setup();
  let s = reduce(initialState(0), tap('title:play'), deps);
  assert.equal(s.screen, 'difficulty');
  assert.equal(reduce(s, tap('diff:back'), deps).screen, 'title');
  s = reduce(s, tap('diff:medium', 500), deps);
  assert.equal(s.screen, 'play');
  assert.equal(s.difficulty, 'medium');
  assert.equal(s.round.startedAt, 500);
  assert.equal(s.round.limitMs, 180000);
  assert.deepEqual(picks, ['medium']);
});

test('title → scores → title', () => {
  const { deps } = setup();
  let s = reduce(initialState(0), tap('title:scores'), deps);
  assert.equal(s.screen, 'leaderboard');
  assert.equal(s.highlight, null);
  s = reduce(s, tap('board:tab:hard'), deps);
  assert.equal(s.boardTab, 'hard');
  assert.equal(reduce(s, tap('board:done'), deps).screen, 'title');
});

test('taps for other screens are ignored', () => {
  const { deps } = setup();
  const s = initialState(0);
  assert.equal(reduce(s, tap('diff:easy'), deps).screen, 'title');
  assert.equal(reduce(s, tap('play:quit'), deps).screen, 'title');
});

test('solving goes to solved with result and rank', () => {
  const { deps } = setup();
  const s = solvedState(deps);
  assert.equal(s.screen, 'solved');
  assert.equal(s.result.overPar, 0);
  assert.equal(s.result.timeLeftMs, 119000);
  assert.equal(s.rank, 0);
});

test('solved → initials when ranked, initials reset', () => {
  const { deps } = setup();
  const s = reduce(solvedState(deps), tap('solved:continue'), deps);
  assert.equal(s.screen, 'initials');
  assert.deepEqual(s.initials, [0, 0, 0]);
  assert.equal(s.blockedMsg, false);
});

test('solved → leaderboard when not ranked', () => {
  const { deps } = setup();
  for (let n = 0; n < 10; n++) deps.leaderboard.insert('easy', { initials: 'AAA', overPar: 0, timeLeftMs: 120000 });
  let s = solvedState(deps);
  assert.equal(s.rank, null);
  s = reduce(s, tap('solved:continue'), deps);
  assert.equal(s.screen, 'leaderboard');
  assert.equal(s.boardTab, 'easy');
  assert.equal(s.highlight, null);
});

test('initials pickers wrap around', () => {
  const { deps } = setup();
  let s = reduce(solvedState(deps), tap('solved:continue'), deps);
  s = reduce(s, tap('initials:down:0'), deps);
  assert.deepEqual(s.initials, [25, 0, 0]);
  s = reduce(s, tap('initials:up:0'), deps);
  s = reduce(s, tap('initials:up:2'), deps);
  assert.deepEqual(s.initials, [0, 0, 1]);
});

test('blocked initials stay on the screen', () => {
  const { deps } = setup();
  let s = reduce(solvedState(deps), tap('solved:continue'), deps);
  s = { ...s, initials: [0, 18, 18] };
  s = reduce(s, tap('initials:ok'), deps);
  assert.equal(s.screen, 'initials');
  assert.equal(s.blockedMsg, true);
  assert.deepEqual(deps.leaderboard.entries('easy'), []);
  s = reduce(s, tap('initials:up:0'), deps);
  assert.equal(s.blockedMsg, false);
});

test('ok inserts and shows the board with the new row highlighted', () => {
  const { deps } = setup();
  deps.leaderboard.insert('easy', { initials: 'TOP', overPar: 0, timeLeftMs: 120000 });
  let s = reduce(solvedState(deps), tap('solved:continue'), deps);
  s = { ...s, initials: [9, 14, 4] };
  s = reduce(s, tap('initials:ok'), deps);
  assert.equal(s.screen, 'leaderboard');
  assert.equal(s.boardTab, 'easy');
  assert.equal(s.highlight, 1);
  assert.deepEqual(deps.leaderboard.entries('easy')[1], { initials: 'JOE', overPar: 0, timeLeftMs: 119000 });
});

test('running out of time → timesup → title', () => {
  const { deps } = setup();
  let s = run(initialState(0), [tap('title:play'), tap('diff:easy', 0)], deps);
  s = reduce(s, { type: 'touch', now: 119000 }, deps);
  s = reduce(s, { type: 'tick', now: 119999 }, deps);
  assert.equal(s.screen, 'play');
  s = reduce(s, { type: 'tick', now: 120000 }, deps);
  assert.equal(s.screen, 'timesup');
  assert.equal(reduce(s, tap('timesup:continue'), deps).screen, 'title');
});

test('quit returns to the title', () => {
  const { deps } = setup();
  const s = run(initialState(0), [tap('title:play'), tap('diff:easy'), tap('play:quit')], deps);
  assert.equal(s.screen, 'title');
  assert.equal(s.round, null);
});

test('moves are ignored off the play screen', () => {
  const { deps } = setup();
  const s = reduce(initialState(0), tap('title:play'), deps);
  assert.equal(reduce(s, { type: 'move', i: 0, delta: 1, now: 1 }, deps), s);
});

test('a zero-delta move does not count', () => {
  const { deps } = setup();
  let s = run(initialState(0), [tap('title:play'), tap('diff:easy')], deps);
  s = reduce(s, { type: 'move', i: idxC(s), delta: 0, now: 5 }, deps);
  assert.equal(s.round.moves, 0);
});

test('idle warning appears at 60s, touch clears it, expiry returns to title', () => {
  const { deps } = setup();
  let s = run(initialState(0), [{ type: 'touch', now: 0 }, tap('title:play')], deps);
  assert.equal(s.screen, 'difficulty');
  assert.equal(warningVisible(s, 59999), false);
  assert.equal(warningVisible(s, 60000), true);
  s = reduce(s, { type: 'touch', now: 65000 }, deps);
  assert.equal(warningVisible(s, 65000), false);
  assert.equal(s.screen, 'difficulty');
  s = reduce(s, { type: 'tick', now: 70000 }, deps);
  assert.equal(s.screen, 'difficulty');
  s = reduce(s, { type: 'tick', now: 135000 }, deps);
  assert.equal(s.screen, 'title');
});

test('idle expiry with no touch at 70s returns to title', () => {
  const { deps } = setup();
  let s = run(initialState(0), [{ type: 'touch', now: 0 }, tap('title:play')], deps);
  s = reduce(s, { type: 'tick', now: 70000 }, deps);
  assert.equal(s.screen, 'title');
  assert.equal(s.lastTouchAt, 70000);
});

test('idle expiry mid-round drops the round', () => {
  const { deps } = setup();
  let s = run(initialState(0), [tap('title:play'), tap('diff:hard')], deps);
  s = reduce(s, { type: 'tick', now: 70000 }, deps);
  assert.equal(s.screen, 'title');
  assert.equal(s.round, null);
});

test('idle expiry during initials saves nothing', () => {
  const { deps } = setup();
  let s = reduce(solvedState(deps, 1000), { type: 'touch', now: 1000 }, deps);
  s = reduce(s, tap('solved:continue', 1000), deps);
  assert.equal(s.screen, 'initials');
  s = reduce(s, { type: 'tick', now: 71000 }, deps);
  assert.equal(s.screen, 'title');
  assert.deepEqual(deps.leaderboard.entries('easy'), []);
});

test('the title screen never warns or resets', () => {
  const { deps } = setup();
  const s = initialState(0);
  assert.equal(warningVisible(s, 600000), false);
  assert.deepEqual(reduce(s, { type: 'tick', now: 600000 }, deps), s);
});
