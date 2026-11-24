// Title-screen demo: every couple of seconds one vehicle on the jam board
// eases one cell along its lane. Only vehicles move; the view never does.
import { applyMove, legalMoves } from '../puzzle/board.js';

export const ATTRACT = { pauseMs: 1600, slideMs: 600, cell: 12 };

export function createAttract(board, now) {
  return { board, move: null, nextAt: now + ATTRACT.pauseMs };
}

function candidates(board) {
  return legalMoves(board).filter((m) => {
    if (Math.abs(m.delta) !== 1) return false;
    return !(m.i === 0 && board.vehicles[0].col + m.delta >= 4);
  });
}

export function stepAttract(attract, now, random) {
  if (attract.move) {
    if (now - attract.move.startedAt < ATTRACT.slideMs) return attract;
    return {
      board: applyMove(attract.board, attract.move.i, attract.move.delta),
      move: null,
      nextAt: now + ATTRACT.pauseMs,
    };
  }
  if (now < attract.nextAt) return attract;
  const options = candidates(attract.board);
  if (!options.length) return attract;
  const pick = options[Math.floor(random() * options.length)];
  return { board: attract.board, move: { i: pick.i, delta: pick.delta, startedAt: now }, nextAt: attract.nextAt };
}

export function attractView(attract, now) {
  if (!attract.move) return { board: attract.board, index: -1, offset: 0 };
  const t = Math.min(1, Math.max(0, (now - attract.move.startedAt) / ATTRACT.slideMs));
  const eased = t * t * (3 - 2 * t);
  return { board: attract.board, index: attract.move.i, offset: eased * attract.move.delta * ATTRACT.cell };
}
