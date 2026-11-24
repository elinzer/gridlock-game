export const SIZE = 6;
export const EXIT_ROW = 2;
const SOLVED_COL = SIZE - 2;
const ID_LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';

export function parseBoard(str) {
  if (typeof str !== 'string' || str.length !== SIZE * SIZE) {
    throw new Error('board must be ' + SIZE * SIZE + ' characters');
  }
  const cellsById = {};
  const order = [];
  for (let k = 0; k < str.length; k++) {
    const ch = str[k];
    if (ch === '.') continue;
    if (ch < 'A' || ch > 'Z') throw new Error('invalid character ' + ch);
    if (!cellsById[ch]) {
      cellsById[ch] = [];
      order.push(ch);
    }
    cellsById[ch].push({ row: Math.floor(k / SIZE), col: k % SIZE });
  }
  if (!cellsById.A) throw new Error('board has no red car');

  const vehicles = order.map((id) => toVehicle(id, cellsById[id]));
  const red = vehicles.find((v) => v.id === 'A');
  if (!red.horiz || red.len !== 2 || red.row !== EXIT_ROW) {
    throw new Error('red car must be horizontal, length 2, on row ' + EXIT_ROW);
  }
  return { vehicles: [red].concat(vehicles.filter((v) => v !== red)) };
}

function toVehicle(id, cells) {
  const len = cells.length;
  if (len !== 2 && len !== 3) throw new Error('vehicle ' + id + ' has length ' + len);
  const first = cells[0];
  const horiz = cells.every((c) => c.row === first.row);
  const vert = cells.every((c) => c.col === first.col);
  if (!horiz && !vert) throw new Error('vehicle ' + id + ' is not straight');
  cells.forEach((c, n) => {
    const expected = horiz ? first.col + n : first.row + n;
    if ((horiz ? c.col : c.row) !== expected) throw new Error('vehicle ' + id + ' is not contiguous');
  });
  return { id, row: first.row, col: first.col, len, horiz };
}

function cellsOf(v) {
  const out = [];
  for (let n = 0; n < v.len; n++) {
    out.push(v.horiz ? { row: v.row, col: v.col + n } : { row: v.row + n, col: v.col });
  }
  return out;
}

function occupancy(board) {
  const grid = new Array(SIZE * SIZE).fill(-1);
  board.vehicles.forEach((v, i) => {
    cellsOf(v).forEach((c) => { grid[c.row * SIZE + c.col] = i; });
  });
  return grid;
}

export function encodeBoard(board) {
  const grid = occupancy(board);
  const letters = {};
  letters[0] = 'A';
  let next = 0;
  let out = '';
  for (let k = 0; k < grid.length; k++) {
    const i = grid[k];
    if (i === -1) { out += '.'; continue; }
    if (letters[i] === undefined) letters[i] = ID_LETTERS[next++];
    out += letters[i];
  }
  return out;
}

export function vehicleAt(board, row, col) {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return -1;
  return occupancy(board)[row * SIZE + col];
}

export function slideRange(board, i) {
  const grid = occupancy(board);
  const v = board.vehicles[i];
  const free = (row, col) => row >= 0 && row < SIZE && col >= 0 && col < SIZE && grid[row * SIZE + col] === -1;
  let min = 0;
  let max = 0;
  if (v.horiz) {
    while (free(v.row, v.col + min - 1)) min--;
    while (free(v.row, v.col + v.len + max)) max++;
  } else {
    while (free(v.row + min - 1, v.col)) min--;
    while (free(v.row + v.len + max, v.col)) max++;
  }
  return { min, max };
}

export function applyMove(board, i, delta) {
  const range = slideRange(board, i);
  if (!Number.isInteger(delta) || delta === 0 || delta < range.min || delta > range.max) {
    throw new Error('illegal move ' + i + ' by ' + delta);
  }
  return {
    vehicles: board.vehicles.map((v, n) => {
      if (n !== i) return v;
      return v.horiz ? Object.assign({}, v, { col: v.col + delta }) : Object.assign({}, v, { row: v.row + delta });
    }),
  };
}

export function isSolved(board) {
  return board.vehicles[0].col === SOLVED_COL;
}

export function legalMoves(board) {
  const moves = [];
  board.vehicles.forEach((v, i) => {
    const { min, max } = slideRange(board, i);
    for (let d = min; d <= max; d++) if (d !== 0) moves.push({ i, delta: d });
  });
  return moves;
}
