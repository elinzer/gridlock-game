import { DIFFICULTIES } from '../config.js';
import { parseBoard, slideRange, applyMove, isSolved } from '../puzzle/board.js';

export function createRound(puzzle, difficulty, now) {
  return {
    difficulty,
    board: parseBoard(puzzle.board),
    par: puzzle.par,
    moves: 0,
    startedAt: now,
    limitMs: DIFFICULTIES[difficulty].limitMs,
    solvedAt: null,
  };
}

export function timeLeftMs(round, now) {
  const end = round.solvedAt === null ? now : round.solvedAt;
  return Math.max(0, round.limitMs - (end - round.startedAt));
}

export function isExpired(round, now) {
  return round.solvedAt === null && timeLeftMs(round, now) === 0;
}

export function commitMove(round, i, delta, now) {
  if (delta === 0 || round.solvedAt !== null || isExpired(round, now)) return round;
  const vehicle = round.board.vehicles[i];
  if (!vehicle) return round;
  const range = slideRange(round.board, i);
  if (delta < range.min || delta > range.max) return round;
  const board = applyMove(round.board, i, delta);
  return Object.assign({}, round, {
    board,
    moves: round.moves + 1,
    solvedAt: isSolved(board) ? now : null,
  });
}

export function resultOf(round) {
  return {
    overPar: round.moves - round.par,
    timeLeftMs: timeLeftMs(round, round.solvedAt),
    moves: round.moves,
    par: round.par,
  };
}
