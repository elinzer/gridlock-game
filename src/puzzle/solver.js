// Build-time only. Never import this from src/main.js or anything it imports.
//
// The search works on a compact form of the board: each vehicle is fixed to a
// lane (its row if horizontal, its column if vertical), so a state is just
// each vehicle's position along its lane. That's a short string key and a
// cheap neighbor scan, which matters because one random board can reach
// tens of thousands of states.
import { SIZE, encodeBoard } from './board.js';

const SOLVED_POS = SIZE - 2;

function compile(board) {
  const lanes = board.vehicles.map((v) => ({ id: v.id, horiz: v.horiz, lane: v.horiz ? v.row : v.col, len: v.len }));
  const start = board.vehicles.map((v) => (v.horiz ? v.col : v.row));
  return { lanes, start };
}

const keyOf = (pos) => String.fromCharCode.apply(null, pos);
const posOf = (key) => Array.from(key, (ch) => ch.charCodeAt(0));

function occupancy(lanes, pos) {
  const grid = new Int8Array(SIZE * SIZE).fill(-1);
  for (let i = 0; i < lanes.length; i++) {
    const { horiz, lane, len } = lanes[i];
    for (let n = 0; n < len; n++) {
      grid[horiz ? lane * SIZE + pos[i] + n : (pos[i] + n) * SIZE + lane] = i;
    }
  }
  return grid;
}

// Calls visit(i, delta, nextPos) for every legal single-vehicle slide.
function forEachMove(lanes, pos, visit) {
  const grid = occupancy(lanes, pos);
  const free = (lane, horiz, p) => grid[horiz ? lane * SIZE + p : p * SIZE + lane] === -1;
  for (let i = 0; i < lanes.length; i++) {
    const { horiz, lane, len } = lanes[i];
    for (let p = pos[i] - 1; p >= 0 && free(lane, horiz, p); p--) {
      const next = pos.slice();
      next[i] = p;
      visit(i, p - pos[i], next);
    }
    for (let p = pos[i] + len; p < SIZE && free(lane, horiz, p); p++) {
      const next = pos.slice();
      next[i] = p - len + 1;
      visit(i, next[i] - pos[i], next);
    }
  }
}

function toBoard(lanes, pos) {
  return {
    vehicles: lanes.map((l, i) => ({
      id: l.id, len: l.len, horiz: l.horiz,
      row: l.horiz ? l.lane : pos[i],
      col: l.horiz ? pos[i] : l.lane,
    })),
  };
}

// Breadth-first search: states are visited in order of move count, so the
// first solved state found is reached in the fewest moves (par).
export function solve(board) {
  const { lanes, start } = compile(board);
  const startKey = keyOf(start);
  const parent = new Map([[startKey, null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const pos of frontier) {
      if (pos[0] === SOLVED_POS) {
        const path = [];
        for (let step = parent.get(keyOf(pos)); step; step = parent.get(step.from)) {
          path.unshift({ i: step.i, delta: step.delta });
        }
        return { par: path.length, path };
      }
      const from = keyOf(pos);
      forEachMove(lanes, pos, (i, delta, np) => {
        const nk = keyOf(np);
        if (parent.has(nk)) return;
        parent.set(nk, { from, i, delta });
        next.push(np);
      });
    }
    frontier = next;
  }
  return null;
}

// Every state reachable from `board` (keyed by encodeBoard), mapped to its
// distance from the nearest solved state. Slides are reversible, so the state
// graph is undirected and a multi-source BFS from all solved states gives
// every state's exact par. An unsolvable component gives an empty Map.
export function componentDistances(board) {
  const { lanes, start } = compile(board);
  const dist = new Map();
  let frontier = [];
  const seen = new Set([keyOf(start)]);
  const stack = [start];
  while (stack.length) {
    const pos = stack.pop();
    if (pos[0] === SOLVED_POS) frontier.push(pos);
    forEachMove(lanes, pos, (i, delta, np) => {
      const nk = keyOf(np);
      if (seen.has(nk)) return;
      seen.add(nk);
      stack.push(np);
    });
  }

  if (!frontier.length) return dist;
  const internal = new Map(frontier.map((pos) => [keyOf(pos), 0]));
  for (let d = 1; frontier.length; d++) {
    const next = [];
    for (const pos of frontier) {
      forEachMove(lanes, pos, (i, delta, np) => {
        const nk = keyOf(np);
        if (internal.has(nk)) return;
        internal.set(nk, d);
        next.push(np);
      });
    }
    frontier = next;
  }
  for (const [key, d] of internal) dist.set(encodeBoard(toBoard(lanes, posOf(key))), d);
  return dist;
}
