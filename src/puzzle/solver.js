// Build-time only. Never import this from src/main.js or anything it imports.
import { encodeBoard, applyMove, isSolved, legalMoves } from './board.js';

// Breadth-first search over board states. Because BFS visits states in order
// of move count, the first solved state found is reached in the fewest moves.
export function solve(board) {
  const startKey = encodeBoard(board);
  const parent = new Map([[startKey, null]]);
  let frontier = [board];
  while (frontier.length) {
    const next = [];
    for (const b of frontier) {
      const key = encodeBoard(b);
      if (isSolved(b)) return { par: pathTo(parent, key).length, path: pathTo(parent, key) };
      for (const move of legalMoves(b)) {
        const nb = applyMove(b, move.i, move.delta);
        const nk = encodeBoard(nb);
        if (parent.has(nk)) continue;
        parent.set(nk, { from: key, move });
        next.push(nb);
      }
    }
    frontier = next;
  }
  return null;
}

function pathTo(parent, key) {
  const path = [];
  for (let step = parent.get(key); step; step = parent.get(step.from)) path.unshift(step.move);
  return path;
}

// Every state reachable from `board`, mapped to its distance from the nearest
// solved state. Slides are reversible, so the state graph is undirected and a
// multi-source BFS from all solved states gives every state's optimal par.
export function componentDistances(board) {
  const neighbors = new Map();
  const solved = [];
  const stack = [board];
  neighbors.set(encodeBoard(board), null);
  while (stack.length) {
    const b = stack.pop();
    const key = encodeBoard(b);
    if (isSolved(b)) solved.push(key);
    const adj = [];
    for (const move of legalMoves(b)) {
      const nb = applyMove(b, move.i, move.delta);
      const nk = encodeBoard(nb);
      adj.push(nk);
      if (!neighbors.has(nk)) {
        neighbors.set(nk, null);
        stack.push(nb);
      }
    }
    neighbors.set(key, adj);
  }

  const dist = new Map();
  if (!solved.length) return dist;
  let frontier = solved;
  solved.forEach((k) => dist.set(k, 0));
  for (let d = 1; frontier.length; d++) {
    const next = [];
    for (const key of frontier) {
      for (const nk of neighbors.get(key)) {
        if (dist.has(nk)) continue;
        dist.set(nk, d);
        next.push(nk);
      }
    }
    frontier = next;
  }
  return dist;
}
