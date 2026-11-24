// Generates the shipped puzzle pools. Each random board is expanded into its
// whole state space; every state in it gets an exact par from a reverse BFS,
// so one board can yield an Easy, a Medium, and a Hard puzzle at once.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DIFFICULTIES, DIFFICULTY_ORDER, POOL_SIZE, GEN_SEED } from '../src/config.js';
import { SIZE, EXIT_ROW, parseBoard } from '../src/puzzle/board.js';
import { componentDistances } from '../src/puzzle/solver.js';

const OUT = fileURLToPath(new URL('../src/puzzle/puzzles.json', import.meta.url));
const MAX_ATTEMPTS = 200000;
const LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

function randomBoard(rand, minExtra, maxExtra) {
  const grid = new Array(SIZE * SIZE).fill('.');
  const redCol = randInt(rand, 0, 3);
  grid[EXIT_ROW * SIZE + redCol] = 'A';
  grid[EXIT_ROW * SIZE + redCol + 1] = 'A';

  const target = randInt(rand, minExtra, maxExtra);
  let placed = 0;
  for (let tries = 0; placed < target && tries < 200; tries++) {
    const len = rand() < 0.25 ? 3 : 2;
    const horiz = rand() < 0.5;
    const row = horiz ? randInt(rand, 0, SIZE - 1) : randInt(rand, 0, SIZE - len);
    const col = horiz ? randInt(rand, 0, SIZE - len) : randInt(rand, 0, SIZE - 1);
    if (horiz && row === EXIT_ROW) continue;
    const cells = [];
    for (let n = 0; n < len; n++) cells.push(horiz ? row * SIZE + col + n : (row + n) * SIZE + col);
    if (cells.some((k) => grid[k] !== '.')) continue;
    cells.forEach((k) => { grid[k] = LETTERS[placed]; });
    placed++;
  }
  return parseBoard(grid.join(''));
}

function generate() {
  const rand = mulberry32(GEN_SEED);
  const pools = {};
  DIFFICULTY_ORDER.forEach((k) => { pools[k] = []; });
  const used = new Set();
  const started = Date.now();
  let minExtra = 8;
  let maxExtra = 13;

  for (let attempt = 1; ; attempt++) {
    const short = DIFFICULTY_ORDER.filter((k) => pools[k].length < POOL_SIZE);
    if (!short.length) break;
    if (attempt > MAX_ATTEMPTS) {
      throw new Error('gave up after ' + MAX_ATTEMPTS + ' attempts; short buckets: ' +
        short.map((k) => k + ' ' + pools[k].length + '/' + POOL_SIZE).join(', '));
    }
    // Once the easier buckets are full, only Hard is left; denser boards make
    // long solutions more likely.
    if (short.length === 1 && short[0] === 'hard' && maxExtra === 13) {
      minExtra = 10;
      maxExtra = 14;
    }

    const dist = componentDistances(randomBoard(rand, minExtra, maxExtra));
    if (!dist.size) continue;

    for (const key of short) {
      const { parMin, parMax } = DIFFICULTIES[key];
      const candidates = [];
      for (const [board, d] of dist) {
        if (d >= parMin && d <= parMax && !used.has(board)) candidates.push({ board, par: d });
      }
      if (!candidates.length) continue;
      const pick = candidates[Math.floor(rand() * candidates.length)];
      used.add(pick.board);
      pools[key].push(pick);
    }

    if (attempt % 100 === 0) {
      console.log('attempt ' + attempt + ': ' + DIFFICULTY_ORDER.map((k) => k + ' ' + pools[k].length).join(', '));
    }
  }

  writeFileSync(OUT, JSON.stringify(pools, null, 2) + '\n');
  console.log('wrote ' + DIFFICULTY_ORDER.map((k) => pools[k].length + ' ' + k).join(', ') +
    ' in ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
}

generate();
