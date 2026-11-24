import { DIFFICULTY_ORDER, LEADERBOARD_SIZE } from '../config.js';
import { compareResults } from './scoring.js';

const KEY = 'lowerwacker.leaderboard.v1';

function isValidEntry(e) {
  return !!e && typeof e === 'object' &&
    typeof e.initials === 'string' && /^[A-Z]{3}$/.test(e.initials) &&
    typeof e.overPar === 'number' && isFinite(e.overPar) &&
    typeof e.timeLeftMs === 'number' && isFinite(e.timeLeftMs);
}

function load(storage) {
  const raw = storage.getJSON(KEY, null);
  const boards = {};
  DIFFICULTY_ORDER.forEach((d) => {
    const list = raw && typeof raw === 'object' && Array.isArray(raw[d]) ? raw[d] : [];
    boards[d] = list.filter(isValidEntry)
      .map((e) => ({ initials: e.initials, overPar: e.overPar, timeLeftMs: e.timeLeftMs }))
      .sort(compareResults)
      .slice(0, LEADERBOARD_SIZE);
  });
  return boards;
}

// Index where `result` would land: after every entry that ranks the same or better.
function insertionIndex(list, result) {
  let n = 0;
  while (n < list.length && compareResults(list[n], result) <= 0) n++;
  return n;
}

export function createLeaderboard(storage) {
  return {
    entries(difficulty) {
      return load(storage)[difficulty] || [];
    },
    rankFor(difficulty, result) {
      const index = insertionIndex(this.entries(difficulty), result);
      return index < LEADERBOARD_SIZE ? index : null;
    },
    insert(difficulty, entry) {
      const boards = load(storage);
      const list = boards[difficulty];
      const index = insertionIndex(list, entry);
      list.splice(index, 0, { initials: entry.initials, overPar: entry.overPar, timeLeftMs: entry.timeLeftMs });
      boards[difficulty] = list.slice(0, LEADERBOARD_SIZE);
      storage.setJSON(KEY, boards);
      return index;
    },
  };
}
