import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIFFICULTIES, DIFFICULTY_ORDER, POOL_SIZE } from '../src/config.js';
import { parseBoard, isSolved } from '../src/puzzle/board.js';
import { solve } from '../src/puzzle/solver.js';

const puzzles = JSON.parse(readFileSync(new URL('../src/puzzle/puzzles.json', import.meta.url), 'utf8'));

for (const key of DIFFICULTY_ORDER) {
  test(`${key}: ${POOL_SIZE} unique, solvable puzzles at recorded par within range`, () => {
    const { parMin, parMax } = DIFFICULTIES[key];
    const list = puzzles[key];
    assert.equal(list.length, POOL_SIZE);
    assert.equal(new Set(list.map((p) => p.board)).size, POOL_SIZE);
    for (const p of list) {
      const b = parseBoard(p.board);
      assert.equal(isSolved(b), false);
      assert.equal(solve(b).par, p.par);
      assert.ok(p.par >= parMin && p.par <= parMax);
    }
  });
}

test('no board appears in two difficulties', () => {
  const all = DIFFICULTY_ORDER.flatMap((k) => puzzles[k].map((p) => p.board));
  assert.equal(new Set(all).size, all.length);
});
