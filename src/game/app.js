// Screen flow as a pure reducer: (state, event) → new state. The only side
// effects are picking a puzzle and saving a leaderboard entry, both via deps.
import { DIFFICULTIES } from '../config.js';
import { createRound, commitMove, isExpired, resultOf } from './round.js';
import { LETTERS, isBlocked } from './initials.js';
import { idleStatus } from './idle.js';

export function initialState(now) {
  return {
    screen: 'title',
    difficulty: null,
    round: null,
    result: null,
    rank: null,
    initials: [0, 0, 0],
    blockedMsg: false,
    highlight: null,
    boardTab: 'easy',
    lastTouchAt: now,
  };
}

export function warningVisible(state, now) {
  return state.screen !== 'title' && idleStatus(state.lastTouchAt, now).status === 'warning';
}

export const RELOAD_QUIET_MS = 5000;

export function canReloadForUpdate(state, now) {
  return state.screen === 'title' && now - state.lastTouchAt >= RELOAD_QUIET_MS;
}

export const DRAG_TOUCH_REFRESH_MS = 1000;

export function touchRefreshDue(state, now) {
  return now - state.lastTouchAt >= DRAG_TOUCH_REFRESH_MS;
}

const set = (state, changes) => Object.assign({}, state, changes);

function goTitle(state) {
  return set(initialState(state.lastTouchAt), { boardTab: state.boardTab });
}

function tap(state, target, now, deps) {
  const parts = target.split(':');
  switch (state.screen) {
    case 'title':
      if (target === 'title:play') return set(state, { screen: 'difficulty' });
      if (target === 'title:scores') return set(state, { screen: 'leaderboard', highlight: null });
      return state;
    case 'difficulty':
      if (target === 'diff:back') return goTitle(state);
      if (parts[0] === 'diff' && DIFFICULTIES[parts[1]]) {
        const difficulty = parts[1];
        const round = createRound(deps.picker.next(difficulty), difficulty, now);
        return set(state, { screen: 'play', difficulty, round, result: null, rank: null });
      }
      return state;
    case 'play':
      return target === 'play:quit' ? goTitle(state) : state;
    case 'solved':
      if (target !== 'solved:continue') return state;
      if (state.rank !== null) return set(state, { screen: 'initials', initials: [0, 0, 0], blockedMsg: false });
      return set(state, { screen: 'leaderboard', boardTab: state.difficulty, highlight: null });
    case 'initials':
      return tapInitials(state, parts, deps);
    case 'leaderboard':
      if (target === 'board:done') return goTitle(state);
      if (parts[0] === 'board' && parts[1] === 'tab' && DIFFICULTIES[parts[2]]) {
        return set(state, { boardTab: parts[2], highlight: parts[2] === state.boardTab ? state.highlight : null });
      }
      return state;
    case 'timesup':
      return target === 'timesup:continue' ? goTitle(state) : state;
    default:
      return state;
  }
}

function tapInitials(state, parts, deps) {
  if (parts[0] !== 'initials') return state;
  if (parts[1] === 'up' || parts[1] === 'down') {
    const slot = Number(parts[2]);
    if (!(slot >= 0 && slot < 3)) return state;
    const step = parts[1] === 'up' ? 1 : LETTERS.length - 1;
    const initials = state.initials.slice();
    initials[slot] = (initials[slot] + step) % LETTERS.length;
    return set(state, { initials, blockedMsg: false });
  }
  if (parts[1] === 'ok') {
    const text = state.initials.map((n) => LETTERS[n]).join('');
    if (isBlocked(text)) return set(state, { blockedMsg: true });
    const highlight = deps.leaderboard.insert(state.difficulty, {
      initials: text, overPar: state.result.overPar, timeLeftMs: state.result.timeLeftMs,
    });
    return set(state, { screen: 'leaderboard', boardTab: state.difficulty, highlight });
  }
  return state;
}

function move(state, event, deps) {
  if (state.screen !== 'play') return state;
  const round = commitMove(state.round, event.i, event.delta, event.now);
  if (round === state.round) return state;
  if (round.solvedAt === null) return set(state, { round });
  const result = resultOf(round);
  return set(state, { round, result, screen: 'solved', rank: deps.leaderboard.rankFor(state.difficulty, result) });
}

function tick(state, now) {
  if (state.screen === 'title') return state;
  if (idleStatus(state.lastTouchAt, now).status === 'expired') return initialState(now);
  if (state.screen === 'play' && isExpired(state.round, now)) return set(state, { screen: 'timesup' });
  return state;
}

export function reduce(state, event, deps) {
  switch (event.type) {
    case 'touch': return set(state, { lastTouchAt: event.now });
    case 'tap': return tap(state, event.target, event.now, deps);
    case 'move': return move(state, event, deps);
    case 'tick': return tick(state, event.now);
    default: return state;
  }
}
