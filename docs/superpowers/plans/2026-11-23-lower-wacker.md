# Lower Wacker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Lower Wacker, an offline 8-bit sliding-block traffic puzzle for a landscape iPad mini 3 (iOS 12) mounted on a rideshare headrest, hosted on GitHub Pages.

**Architecture:** Plain ES modules in `src/`, split into pure logic (`src/puzzle/`, `src/game/`, fully unit-tested in Node) and canvas UI (`src/ui/`). Everything is drawn into a 256×192 offscreen canvas and scaled up with smoothing off onto a full-resolution visible canvas. `tools/build.js` bundles with esbuild (target `safari12`), inlines the bundle into a single `dist/index.html`, and writes `dist/sw.js` for offline launch. Puzzles are generated and solved ahead of time by `tools/generate-puzzles.js` and committed as JSON.

**Tech Stack:** Node 22 (dev only), `node:test`, esbuild 0.28, `qrcode` 1.5 (build-time only), `acorn` 8 (build-time syntax check), Canvas 2D, Service Worker, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-23-lower-wacker-design.md`

## Global Constraints

- Target: iPad mini 3, iOS 12.5.7, Safari 12. Landscape only, viewport 1024×768 points, devicePixelRatio 2.
- Shipped JS must parse as ES2018 (no `?.`, no `??`, no regex lookbehind, no class fields). The build enforces this.
- No runtime network requests and no runtime CDN. Everything is inlined in `dist/index.html` except `dist/sw.js` (and the icon in Task 9).
- No sound or audio code of any kind.
- No screen shake, scrolling backgrounds, camera movement, flashing, flicker, or device-motion input.
- Every `localStorage` access goes through `src/game/storage.js` (try/catch with an in-memory fallback).
- All asset and script paths are relative (the site is served at `/gridlock-game/`).
- Title text: `LOWER WACKER`. QR caption: `BUILT BY YOUR DRIVER` / `SCAN TO CONNECT`.
- The QR target is `LINKEDIN_URL` in `src/config.js`. Until the driver supplies it, use the placeholder `https://www.linkedin.com/` with a `// TODO(driver): set your LinkedIn URL` marker.
- The repo is public: never commit secrets or personal data.
- Use timers based on `performance.now()`, not `Date.now()` (the clock can jump when the iPad syncs time on Wi-Fi).

## Review Focus

1. **localStorage throws or is full.** The game stays fully playable, and leaderboards work in memory for the session. *(Test in Task 5.)*
2. **Stored data is corrupt or from an older shape** (bad JSON, missing fields, wrong types). Ignore it and start empty, without crashing. *(Test in Task 5.)*
3. **A drag is interrupted** by `touchcancel` (Guided Access, a notification) or a second finger. The vehicle snaps back, no move is counted, and other touches are ignored during the drag. *(Test in Task 8.)*
4. **A move lands right at the time limit.** A move committed at or after expiry is rejected. A solving move committed before expiry wins, and its time left is frozen. *(Test in Task 4.)*
5. **A rider walks away mid-flow** (on difficulty select, mid-round, initials entry, or the leaderboard). The warning appears at 60s and the game returns to the title at 70s. A touch during the warning cancels it, and the title screen never warns. *(Test in Task 6.)*

---

## File Structure

```
package.json                     scripts: test, build, gen; type: module
.github/workflows/pages.yml      build + deploy to GitHub Pages on push to main
web/index.template.html          HTML shell (meta tags, styles, <!--BUNDLE--> slot)
web/sw.js                        service worker template (__CACHE_VERSION__ slot)
tools/build.js                   QR gen → esbuild bundle → ES2018 check → dist/
tools/generate-puzzles.js        writes src/puzzle/puzzles.json
tools/png.js                     tiny PNG encoder for the home-screen icon (Task 9)
src/config.js                    all tunable values
src/puzzle/board.js              board model and move rules
src/puzzle/solver.js             BFS solver + component distance (Node/tools only, never bundled)
src/puzzle/puzzles.json          generated, committed
src/game/round.js                one round: moves, timer, result
src/game/scoring.js              compare and format results
src/game/storage.js              safe localStorage wrapper
src/game/leaderboard.js          three top-10 boards
src/game/initials.js             letters + blocklist
src/game/picker.js               random puzzle, avoiding recent ones
src/game/idle.js                 idle status
src/game/app.js                  screen-flow reducer
src/ui/layout.js                 256×192 layout rects + hit testing
src/ui/font.js                   5×7 bitmap font
src/ui/palette.js                16-color palette
src/ui/drag.js                   drag math
src/ui/render.js                 draws each screen
src/ui/sprites.js                vehicle pixel art (Task 9)
src/main.js                      browser entry: canvas, input, loop, SW registration
src/generated/qr.js              written by build (gitignored)
test/*.test.js                   node:test suites
```

---

### Task 1: Build pipeline, service worker, Pages deploy, offline spike

Goal: prove the iPad launches the home-screen app offline before building the game.

**Files:**
- Create: `package.json`, `web/index.template.html`, `web/sw.js`, `tools/build.js`, `src/config.js`, `src/main.js` (spike version), `.github/workflows/pages.yml`, `test/build.test.js`
- Modify: `.gitignore` (add `dist/`, `src/generated/`)

**Interfaces:**
- Produces: `npm run build` → `dist/index.html`, `dist/sw.js`; `src/generated/qr.js` exporting `QR = { size: number, modules: number[] }` (row-major 0/1, no quiet zone); `src/config.js` exporting `LINKEDIN_URL`.

- [ ] **Step 1: `package.json`** with `"type": "module"`, `"private": true`, scripts `test: "node --test test/"`, `build: "node tools/build.js"`, `gen: "node tools/generate-puzzles.js"`. devDependencies: `esbuild@0.28.2`, `qrcode@1.5.4`, `acorn@8.19.0`. Run `npm install`.

- [ ] **Step 2: Write the failing test** `test/build.test.js`:

```js
test('build emits single-file html, sw, and ES2018-only JS', () => {
  execSync('node tools/build.js');
  const html = readFileSync('dist/index.html', 'utf8');
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);       // no external scripts
  const urls = (html.match(/https?:\/\/[^\s"'`)<]+/g) || []).filter(u => !LINKEDIN_URL.startsWith(u) && !u.startsWith(LINKEDIN_URL));
  assert.deepEqual(urls, []);                            // no runtime URLs besides the QR target
  const sw = readFileSync('dist/sw.js', 'utf8');
  assert.doesNotMatch(sw, /__CACHE_VERSION__/);
});
test('QR matrix fits the sidebar (version 3 or lower)', async () => {
  execSync('node tools/build.js');
  const { QR } = await import('../src/generated/qr.js?' + Date.now());
  assert.ok(QR.size <= 29);
  assert.equal(QR.modules.length, QR.size * QR.size);
});
```

- [ ] **Step 3: Run it.** `npm test` → FAIL (no `tools/build.js`).

- [ ] **Step 4: Implement.**
  - `web/index.template.html`: `<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">`, `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black`, `<title>Lower Wacker</title>`. Body black and full-screen, `-webkit-user-select:none; -webkit-touch-callout:none; overflow:hidden`, one `<canvas id="screen">`, and `<script><!--BUNDLE--></script>`.
  - `web/sw.js`: cache name `lower-wacker-__CACHE_VERSION__`. `install` caches `./` and `./index.html`, then `skipWaiting()`. `activate` deletes other `lower-wacker-*` caches, then `clients.claim()`. `fetch`: for navigations, network first with a 3s timeout and fall back to the cached `./index.html`. Successful responses update the cache. Cache-first for everything else.
  - `tools/build.js`: (1) `QRCode.create(LINKEDIN_URL, { errorCorrectionLevel: 'L' })` writes `src/generated/qr.js`, and the build throws if size > 29. (2) esbuild bundles `src/main.js` with `bundle: true, format: 'iife', target: 'safari12', minify: true, write: false`. (3) `acorn.parse(code, { ecmaVersion: 2018 })`, which throws and fails the build on newer syntax. (4) The bundle goes into the template (replace `</script` inside the code with `<\/script`), written to `dist/index.html`. (5) `dist/sw.js` gets `__CACHE_VERSION__` = the first 10 hex digits of sha256(index.html).
  - `src/main.js` (spike): register `sw.js` if supported, then draw "LOWER WACKER" and the build version on the canvas with `fillText`, plus the text `OFFLINE OK` once `navigator.serviceWorker.controller` is set.
  - `.github/workflows/pages.yml`: on push to `main` → `actions/checkout@v4`, `actions/setup-node@v4` (node 22), `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact@v3` (path `dist`), `actions/deploy-pages@v4`. Permissions `pages: write, id-token: write`.

- [ ] **Step 5: Run it.** `npm test` → PASS. Then `npm run build && npx esbuild --version` succeeds.

- [ ] **Step 6: Commit and push.** `git add -A && git commit -m "feat: build pipeline, service worker, Pages deploy"`, then `git push`.

- [ ] **Step 7: Enable Pages.** `gh api -X POST repos/elinzer/gridlock-game/pages -f build_type=workflow` (if it already exists, use `-X PUT`). Wait until `gh run watch` shows the deploy green, and `curl -sI https://elinzer.github.io/gridlock-game/` returns 200.

- [ ] **Step 8: Device checkpoint (driver).** Ask the driver to do this on the iPad, on Wi-Fi: open the URL in Safari → Share → Add to Home Screen → launch from the icon → see `OFFLINE OK` → turn on Airplane Mode → force-quit the app → launch from the icon again → it must still show `LOWER WACKER`. Also try it once after rebooting the iPad in Airplane Mode. **Stop and report back if it fails.** The spec's fallback (keep it open in a Safari tab under Guided Access) changes the deploy instructions, not the game code.

---

### Task 2: Board model

**Files:**
- Create: `src/puzzle/board.js`, `test/board.test.js`

**Interfaces:**
- Produces (all pure and immutable):
  - `Vehicle = { id: string, row: number, col: number, len: 2|3, horiz: boolean }`, `Board = { vehicles: Vehicle[] }`, with `vehicles[0]` always the red car `'A'` (horizontal, len 2, row 2).
  - `SIZE = 6`, `EXIT_ROW = 2`
  - `parseBoard(str: string): Board` takes 36 chars, row-major. `.` is empty, `A` is the red car, `B`–`Z` are other vehicles. Orientation and length are inferred from the cells, and anything invalid throws.
  - `encodeBoard(board): string` is the inverse of `parseBoard`, with letters re-assigned in reading order of each vehicle's first cell (A stays the red car). This gives a canonical key.
  - `vehicleAt(board, row, col): number` returns the vehicle index, or -1.
  - `slideRange(board, i): { min: number, max: number }` gives cell deltas (min ≤ 0 ≤ max) that vehicle i can slide without overlap.
  - `applyMove(board, i, delta): Board` throws if delta is outside slideRange or is 0.
  - `isSolved(board): boolean` is true when the red car's `col === 4` (touching the exit on the right edge of row 2). The move that gets it there is the final counted move, and the UI animates it out.
  - `legalMoves(board): Array<{ i: number, delta: number }>` lists every nonzero delta in range for every vehicle.

- [ ] **Step 1: Write failing tests:**
  - `parseBoard` then `encodeBoard` round-trips `'....BB' + '..C...' + 'AAC...' + '..C...' + '......' + '......'`. Vehicle C has len 3 and is vertical.
  - `parseBoard` throws for: the wrong length, no `A`, `A` vertical, `A` not on row 2, an L-shaped or len-4 vehicle.
  - `slideRange` for A on the board above is `{min:0,max:0}` (blocked by C on the right, wall on the left). For C it's `{min:-1,max:2}`. For B it's `{min:-4,max:0}`.
  - `applyMove(board, idxOfC, 2)`, then A's slideRange max becomes 4, and `applyMove(A, 4)` gives `isSolved === true`.
  - `applyMove` with delta 0 or out of range throws. The original board stays unchanged (deep-equal to before).
  - `legalMoves` count on the board above is 1 (C, -1) + 2 (C, +1/+2) + 4 (B) = 7.

- [ ] **Step 2: Run** `node --test test/board.test.js` → FAIL.
- [ ] **Step 3: Implement** `src/puzzle/board.js` with the signatures above. Build an occupancy grid per call. Boards are tiny, so don't optimize.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: board model`.

---

### Task 3: Solver, generator, shipped puzzles, config

**Files:**
- Create: `src/puzzle/solver.js`, `tools/generate-puzzles.js`, `src/puzzle/puzzles.json`, `test/solver.test.js`, `test/puzzles.test.js`
- Modify: `src/config.js`

**Interfaces:**
- Consumes: Task 2 board API.
- Produces:
  - `src/config.js` adds:
    ```js
    export const DIFFICULTIES = {
      easy:   { label: 'EASY',   limitMs: 120000, parMin: 4,  parMax: 8 },
      medium: { label: 'MEDIUM', limitMs: 180000, parMin: 9,  parMax: 14 },
      hard:   { label: 'HARD',   limitMs: 240000, parMin: 15, parMax: 20 },
    };
    export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];
    export const POOL_SIZE = 120;
    export const GEN_SEED = 20261123;
    ```
  - `solve(board): { par: number, path: Array<{i, delta}> } | null` is a BFS from `board` to the first solved state, with states keyed by `encodeBoard`.
  - `componentDistances(board): Map<string, number>` covers every state reachable from `board`, mapped to its distance to the nearest solved state. Unsolvable components return an empty Map.
  - `puzzles.json`: `{ "easy": [{ "board": string, "par": number }], "medium": [...], "hard": [...] }` with `POOL_SIZE` entries each.

- [ ] **Step 1: Write failing tests** `test/solver.test.js`:
  - `solve` on an already-one-move board (`'......' + '......' + 'AA....' + ...empty`) has `par === 1`.
  - `solve` on the Task 2 example board has `par === 2` (move C, then A).
  - `solve` on a board where A is permanently blocked by a horizontal truck on its own row (`'......'+'......'+'AA.BBB'+'......'+'......'+'......'`) returns `null`.
  - For the Task 2 example, `componentDistances(board).get(encodeBoard(board)) === 2`, and every value in the map ≥ 0.
  - Replaying `solve(b).path` with `applyMove` ends in `isSolved`.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `solver.js`. `componentDistances`: BFS over `legalMoves` to collect the component and its edges. Then a multi-source BFS starting from all solved states in it (moves are reversible, so the graph is undirected).

- [ ] **Step 4: Run** → PASS. Commit `feat: puzzle solver`.

- [ ] **Step 5: Write the failing test** `test/puzzles.test.js` (checks the shipped data):

```js
for (const key of DIFFICULTY_ORDER) {
  test(`${key}: ${POOL_SIZE} unique, solvable puzzles at recorded par within range`, () => {
    const { parMin, parMax } = DIFFICULTIES[key];
    const list = puzzles[key];
    assert.equal(list.length, POOL_SIZE);
    assert.equal(new Set(list.map(p => p.board)).size, POOL_SIZE);
    for (const p of list) {
      const b = parseBoard(p.board);
      assert.equal(isSolved(b), false);
      assert.equal(solve(b).par, p.par);
      assert.ok(p.par >= parMin && p.par <= parMax);
    }
  });
}
```

Also check that no board appears in two difficulties.

- [ ] **Step 6: Run** → FAIL (no JSON). **Step 7: Implement** `tools/generate-puzzles.js`, seeded with a small deterministic PRNG (mulberry32 on `GEN_SEED`):

```
loop until every bucket has POOL_SIZE (abort after 200k attempts with an error naming the short bucket):
  b = random board: A at row 2, col 0..3; then try to place 8..13 more vehicles
      (25% trucks, random orientation and position, skip if overlapping; no other
      horizontal vehicle on row 2 so the exit row stays solvable in principle)
  dist = componentDistances(b); if empty → continue
  for each difficulty whose bucket isn't full:
     candidates = states in dist with parMin ≤ d ≤ parMax and not already used anywhere
     if any: pick one with the PRNG and push { board: key, par: d }
write JSON (2-space indent), print counts and elapsed time
```

If the Hard bucket fills too slowly (more than about 5 minutes), raise the vehicle count range for later attempts. Don't change the par ranges without updating the spec.

- [ ] **Step 8: Run** `npm run gen && node --test test/puzzles.test.js` → PASS. Running `npm run gen` twice must produce an identical file.
- [ ] **Step 9: Commit** `feat: generate and ship puzzle pools`. Commit `puzzles.json`. `solver.js` must never be imported from `src/main.js` or anything it imports.

---

### Task 4: Round and scoring

**Files:**
- Create: `src/game/round.js`, `src/game/scoring.js`, `test/round.test.js`

**Interfaces:**
- Consumes: board API, `DIFFICULTIES`.
- Produces:
  - `Round = { difficulty, board: Board, par, moves, startedAt, limitMs, solvedAt: number|null }`
  - `createRound({ board: string, par }, difficulty, now): Round`
  - `timeLeftMs(round, now): number`. When unsolved it's `max(0, limitMs - (now - startedAt))`. When solved it's frozen at `limitMs - (solvedAt - startedAt)`.
  - `isExpired(round, now): boolean`. True when unsolved and `timeLeftMs === 0`.
  - `commitMove(round, i, delta, now): Round` returns the same object unchanged if delta is 0, the round is expired or solved, or the move is illegal. Otherwise it returns a new round with `moves + 1`, and if solved, `solvedAt = now`.
  - `Result = { overPar: number, timeLeftMs: number, moves: number, par: number }`
  - `resultOf(round): Result` (only valid when solved)
  - `compareResults(a, b): number`. Negative means a ranks higher: overPar ascending, then timeLeftMs descending.
  - `formatOverPar(n): string`. 0 gives `'PAR'`, 3 gives `'+3'`.
  - `formatClock(ms): string`, rounding seconds up. 120000 gives `'2:00'`, 61001 gives `'1:02'`, 0 gives `'0:00'`.

- [ ] **Step 1: Write failing tests** using the Task 2 example board (par 2):
  - Two correct moves give `solvedAt` set, `moves 2`, and `resultOf` `{overPar:0}`, and `formatOverPar` is `'PAR'`.
  - A wasted move (B -1, then B +1), then the solution, gives overPar 2.
  - A delta 0 move returns the identical object and the move count stays the same.
  - **Edge of the time limit:** with startedAt 0 and limitMs 120000, a move at `now = 120000` is rejected (expired). The solving move at `119999` is accepted, and `timeLeftMs(round, 500000) === 1`.
  - After solving, further `commitMove` calls are ignored.
  - `compareResults`: `{overPar:0,timeLeftMs:10}` ranks above `{overPar:1,timeLeftMs:90000}`, and at equal overPar, more time ranks higher.
  - `formatClock` cases above.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. **Step 5: Commit** `feat: round timing and scoring`.

---

### Task 5: Storage, leaderboard, initials, puzzle picker

**Files:**
- Create: `src/game/storage.js`, `src/game/leaderboard.js`, `src/game/initials.js`, `src/game/picker.js`, `test/leaderboard.test.js`, `test/picker.test.js`
- Modify: `src/config.js` (add `LEADERBOARD_SIZE = 10`, `RECENT_SIZE = 10`)

**Interfaces:**
- Produces:
  - `createStorage(getBackend: () => Storage): { getJSON(key, fallback), setJSON(key, value) }`. Every backend call (including `getBackend()` itself) is wrapped in try/catch. It keeps an in-memory map that's always written, and reads prefer the backend, falling back to memory. Bad JSON returns `fallback`.
  - `Entry = { initials: string, overPar: number, timeLeftMs: number }`
  - `createLeaderboard(storage): { entries(difficulty): Entry[], rankFor(difficulty, result): number|null, insert(difficulty, entry): number }`. Key `lowerwacker.leaderboard.v1` holds `{ easy: Entry[], medium: Entry[], hard: Entry[] }`. Entries are sorted by `compareResults`. On ties, a new entry goes *after* existing equal ones. `rankFor` returns a 0-based index if it would land in the top `LEADERBOARD_SIZE`, otherwise null. `insert` returns the index after trimming to the size.
  - `LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'`, `isBlocked(initials: string): boolean` against a short uppercase list of common offensive 3-letter combinations, checked forwards. Keep the list in this file. About 30–60 entries is fine.
  - `createPicker(pool, storage, random: () => number): { next(difficulty): { board: string, par: number } }`. It avoids the last `RECENT_SIZE` indices for that difficulty (key `lowerwacker.recent.v1`) and records the pick.

- [ ] **Step 1: Write failing tests** `test/leaderboard.test.js`:
  - Inserting 12 results keeps 10, sorted, and `rankFor` a worse-than-10th result is null.
  - Tie: insert `{ABC, 0, 5000}` then `{XYZ, 0, 5000}`, and XYZ lands at index 1.
  - Boards are independent: inserting into easy leaves medium empty.
  - Persistence: a new `createLeaderboard` over the same fake backend sees the entries.
  - **Storage throws:** `getBackend` throws, or `setItem` throws `QuotaExceededError`. Insert and read back in the same instance still work, and nothing throws.
  - **Corrupt data:** the backend holds `'not json'`, `'{"easy":"x"}'`, or entries missing fields or with wrong types. `entries()` returns `[]`, or only the valid entries, and nothing throws.
  - `isBlocked('ASS') === true`, `isBlocked('ABC') === false`.
- [ ] **Step 2: Write failing tests** `test/picker.test.js`:
  - With a pool of 12 and RECENT_SIZE 10, 50 picks with `Math.random` never repeat any of the previous 10.
  - With a pool smaller than RECENT_SIZE + 1, it still returns a puzzle (it falls back to the least recently used one).
  - Recents persist through storage.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** Validate entries on load: `initials` is a 3-letter A–Z string, and the numbers are finite. **Step 5: Run** → PASS. **Step 6: Commit** `feat: leaderboard, storage, picker`.

---

### Task 6: Idle timer and screen-flow reducer

**Files:**
- Create: `src/game/idle.js`, `src/game/app.js`, `test/app.test.js`
- Modify: `src/config.js` (add `IDLE = { warnMs: 60000, graceMs: 10000 }`)

**Interfaces:**
- Consumes: round, scoring, leaderboard, initials, picker.
- Produces:
  - `idleStatus(lastTouchAt, now): { status: 'active'|'warning'|'expired', secondsLeft: number }`. `secondsLeft` is the warning countdown, rounded up.
  - `Screen = 'title'|'difficulty'|'play'|'solved'|'initials'|'leaderboard'|'timesup'`
  - `AppState = { screen, difficulty: string|null, round: Round|null, result: Result|null, rank: number|null, initials: number[3], blockedMsg: boolean, highlight: number|null, boardTab: string, lastTouchAt: number }`
  - `initialState(now): AppState` (screen `'title'`, `boardTab: 'easy'`)
  - `reduce(state, event, deps): AppState` with `deps = { picker, leaderboard }`. Events:
    - `{type:'touch', now}` sets `lastTouchAt = now`.
    - `{type:'tap', target, now}`. Targets: `'title:play'`, `'title:scores'`, `'diff:easy'|'diff:medium'|'diff:hard'`, `'diff:back'`, `'play:quit'`, `'solved:continue'`, `'timesup:continue'`, `'initials:up:0'..'initials:up:2'`, `'initials:down:0'..'2'`, `'initials:ok'`, `'board:tab:easy'|'medium'|'hard'`, `'board:done'`.
    - `{type:'move', i, delta, now}` applies only on `'play'`.
    - `{type:'tick', now}`.
  - `warningVisible(state, now): boolean` is true when the screen isn't `'title'` and the idle status is `'warning'`.

Flow (the tests pin these):
- title, then `title:play` → difficulty. Then `diff:X` → play with `picker.next(X)` and `createRound`. `diff:back` → title. `title:scores` → leaderboard with `highlight null`, `board:done` → title.
- play, then a solving move → `solved` with `result` and `rank = leaderboard.rankFor`. Then `solved:continue` → `initials` (initials reset to `[0,0,0]`) if rank isn't null, else `leaderboard` with `boardTab = difficulty`.
- initials: up/down wrap around 0..25. `initials:ok` with blocked letters sets `blockedMsg: true` and stays put. Otherwise it inserts, then goes to `leaderboard` with `highlight` = the returned index.
- play, then a `tick` where `isExpired` → `timesup`. `timesup:continue` → title. `play:quit` → title.
- Any non-title screen, then a `tick` where the idle status is `expired` → `initialState(now)`, dropping the round. Nothing gets saved.

- [ ] **Step 1: Write failing tests** `test/app.test.js` with a fake picker (always the Task 2 example board, par 2) and a leaderboard over an in-memory storage. Cover each flow line above, plus:
  - **Idle:** on `difficulty` with lastTouchAt 0, `warningVisible` is false at 59999 and true at 60000. A `touch` at 65000 clears it, and the screen stays the same. A `tick` at 70000 with no touch → `title`. During `initials`, idle expiry inserts nothing into the leaderboard. On `title`, a `tick` at 10 minutes changes nothing and `warningVisible` stays false.
  - A `move` event on a non-play screen is ignored.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (pure. `reduce` returns a new object, and only `leaderboard.insert` and `picker.next` cause side effects). **Step 4: Run** → PASS. **Step 5: Commit** `feat: idle timer and screen flow`.

---

### Task 7: Pixel canvas, palette, bitmap font, layout, QR card

**Files:**
- Create: `src/ui/palette.js`, `src/ui/font.js`, `src/ui/layout.js`, `test/ui.test.js`

**Interfaces:**
- Produces:
  - `W = 256, H = 192` (internal resolution, 4× to 1024×768 points).
  - `PALETTE`: 16 named colors as hex strings, including `bg`, `road`, `roadLine`, `frame`, `text`, `accent` (yellow), `red` (player car, unique among vehicle colors), `exit` (green), `paper` (QR card background), `ink`, plus at least 6 distinct vehicle colors `VEHICLE_COLORS`.
  - `font.js`: `GLYPHS` is a 5×7 bitmap per character covering `A–Z 0–9 space : + - ! ? . / '`. `textWidth(str, scale=1): number` (6px advance × scale, no trailing gap). `drawText(ctx, str, x, y, color, scale=1)` draws with `fillRect` per lit pixel.
  - `layout.js` (starting values, adjust visually on device):
    - `BOARD = { x: 12, y: 24, cell: 24 }` (inner 144×144; a 4px frame around it, the exit opening on the right edge at row 2).
    - `SIDEBAR = { x: 170, y: 8, w: 80 }`.
    - `QR_CARD = { x: 170, y: 98, w: 80, h: 90 }`. QR at 2px per module with a 4-module quiet zone (≤ 74px), caption below it.
    - `cellAt(x, y): {row, col} | null`.
    - `buttonsFor(screen, state): Array<{ target: string, x, y, w, h, label }>`. Every tappable rect for that screen, each at least 32×20 internal px (128×80 points). The play board isn't a button, since dragging handles it.
    - `hitTest(screen, state, x, y): string | null`.
    - `toInternal(clientX, clientY, canvasRect): {x, y}`.

- [ ] **Step 1: Write failing tests** `test/ui.test.js`:
  - Every character in every UI string (export `UI_STRINGS` from `layout.js` listing all fixed labels, including `LOWER WACKER`, `BUILT BY YOUR DRIVER`, `SCAN TO CONNECT`, `STILL PLAYING?`, `TIME'S UP`, `PAR WAS`, `TRY AGAIN`) has a glyph.
  - Every glyph is exactly 7 rows of 5 columns.
  - For every screen, buttons don't overlap each other or the QR card, they stay inside 256×192, and they meet the minimum size.
  - `cellAt(12, 24)` is `{0,0}`, `cellAt(12+143, 24+143)` is `{5,5}`, and `cellAt(11, 24)` is null.
  - `hitTest('difficulty', ..., center of the EASY button)` is `'diff:easy'`.
  - Sidebar text widths: `textWidth('BUILT BY') <= 80` and so on for each sidebar line, so nothing overflows.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. **Step 5: Commit** `feat: palette, bitmap font, layout`.

---

### Task 8: Rendering, input, and wiring (playable build)

**Files:**
- Create: `src/ui/drag.js`, `src/ui/render.js`, `test/drag.test.js`
- Modify: `src/main.js` (replace the spike)

**Interfaces:**
- Consumes: everything above. `QR` from `src/generated/qr.js`, puzzles from `src/puzzle/puzzles.json` (esbuild inlines JSON).
- Produces:
  - `drag.js`:
    - `beginDrag(board, x, y, touchId): Drag | null` where `Drag = { touchId, i, horiz, startX, startY, range: {min,max} }` (null if no vehicle is under the point).
    - `dragOffsetPx(drag, x, y): number` is the pointer delta along the vehicle's axis, clamped to `[range.min*cell, range.max*cell]`.
    - `endDrag(drag, x, y): number` is the delta in cells, `Math.round(offset/cell)`, clamped to the range.
    - `cancelDrag(): 0`
  - `render.js`: `render(ctx, state, view, now)` draws the whole 256×192 frame for `state.screen` plus the warning overlay, where `view = { drag: Drag|null, dragOffset: number, solveAnim: {startedAt}|null }`. The sidebar and QR card are drawn on **every** screen. Screens:
    - title: the logo, a static jam board, a `PLAY` button, a `SCORES` button.
    - difficulty: three buttons labeled `EASY  ~1 MIN`, `MEDIUM ~2 MIN`, `HARD ~3 MIN`, plus `BACK`.
    - play: the board and vehicles (flat colored rects with a 1px dark outline and a lighter top edge are enough here), the sidebar with time, moves, difficulty, `PAR n`, and `QUIT`.
    - solved: `SOLVED!`, `MOVES n  PAR p`, `formatOverPar`, time left, `TAP TO CONTINUE`.
    - initials: 3 big letters with up/down arrows and `OK`, plus `TRY AGAIN` if `blockedMsg`.
    - leaderboard: tabs and 10 rows `1. ABC  PAR  1:23`, with the highlighted row in `accent`.
    - timesup: `TIME'S UP`, `PAR WAS n`, `TAP TO CONTINUE`.
    - warning overlay: a dark box, `STILL PLAYING?`, `TAP TO KEEP GOING`, and the countdown.
  - `main.js`: the visible canvas has a backing size of `innerWidth*dpr × innerHeight*dpr`, CSS size fills the window while keeping 4:3 (letterboxed and centered). The offscreen canvas is 256×192. Each frame: `render` into the offscreen canvas, then `imageSmoothingEnabled = false` (and the `webkit` prefix) and `drawImage` scaled. Redraw only when dirty, on a drag, during an animation, or once per second for the clock. Touch listeners on the canvas with `{passive:false}` and `preventDefault()`, tracking only the first touch's `identifier` and ignoring the rest until it ends. `touchstart` dispatches `touch`. On play, touchstart tries `beginDrag`, and if that's null it falls through to hitTest. `touchend` dispatches either `move` (non-zero delta) or `tap`. `touchcancel` calls `cancelDrag`. If the warning overlay is visible when a gesture starts, that gesture only dispatches `touch` (dismissing the overlay) and is otherwise ignored, so it can't also press a button underneath. Add mouse listeners mirroring touch for desktop development. `setInterval(tick, 250)` using `performance.now()`. On a solving move, run the red car drive-out animation (400ms, red car only) before the solved screen. Keep the service worker registration from Task 1. Storage is `createStorage(() => window.localStorage)`.

- [ ] **Step 1: Write failing tests** `test/drag.test.js` on the Task 2 example board with `BOARD` from layout:
  - `beginDrag` on C's cell returns C with range `{-1,2}`. On an empty cell it returns null.
  - A drag of +100px gives `dragOffsetPx` clamped to `2*cell`, and `endDrag` returns 2.
  - A drag of +11px (less than half a cell) gives `endDrag` 0. A drag of +13px gives 1.
  - For a vertical vehicle, a horizontal pointer motion gives offset 0 and delta 0.
  - **Interrupted drag:** `cancelDrag()` returns 0. Through `reduce` (Task 6), a `move` with delta 0 doesn't change `moves`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `drag.js`, then `render.js` and `main.js`. **Step 4: Run** `npm test` → PASS, and `npm run build` → OK. (The build's acorn check covers ES2018.)
- [ ] **Step 5: Desktop check.** Serve `dist/` (`npx --yes http-server dist -p 8080` or `python3 -m http.server -d dist 8080`), open it at 1024×768, and play an Easy puzzle end to end with the mouse: solve, enter initials, see the board, time out a round, and leave it idle for 70s. Fix anything broken.
- [ ] **Step 6: Commit and push** `feat: playable game`. Wait for the Pages deploy.
- [ ] **Step 7: Device checkpoint (driver).** On the iPad, reopen it from the home screen while on Wi-Fi so it picks up the update, then check:
  - Dragging feels right, and nothing scrolls or zooms the page.
  - The text is readable at arm's length.
  - The QR code scans from the back seat.
  - It runs smoothly.
  - It works in Airplane Mode.

  Collect feedback before Task 9.

---

### Task 9: Polish

Each item is independent. Commit each one separately, and stop wherever the driver says.

**Files:**
- Create: `src/ui/sprites.js`, `tools/png.js`, `test/png.test.js`
- Modify: `src/ui/render.js`, `web/index.template.html`, `tools/build.js`, `web/sw.js`

- [ ] **9a: Vehicle sprites.** `drawVehicle(ctx, vehicle, x, y, cell, color)` in `sprites.js` draws a top-down pixel-art car (len 2) or truck (len 3) in either orientation: windshield, roof, wheels peeking out, with the color from `PALETTE`. Red car `A` uses `PALETTE.red`, and other vehicles cycle through `VEHICLE_COLORS` by index. Render the exit as an underground road portal (a dark opening with a small `EXIT` mark in the frame). Check on desktop, then commit `feat: vehicle sprites`.
- [ ] **9b: Title attract demo.** On the title screen, one vehicle at a time slides one cell every ~2s on the static jam board, at an easing pace. Only vehicles move, never the view. Commit `feat: title attract demo`.
- [ ] **9c: Scanlines.** After scaling, draw a static overlay on the visible canvas: a 1-device-pixel line at 15% black every 4 device pixels. Precompute it once into a pattern canvas. Nothing animated. Commit `feat: scanline overlay`.
- [ ] **9d: Home-screen icon.**
  - Write `tools/png.js` with `encodePNG(width, height, rgba: Uint8Array): Buffer` (zlib from Node, CRC32, IHDR/IDAT/IEND, RGBA 8-bit).
  - Test: the output starts with the PNG signature `89 50 4E 47 0D 0A 1A 0A`, and its IHDR width and height match.
  - The build draws a 180×180 icon: a red car on the road palette at nearest-neighbor scale, using the vehicle sprite logic. Write it to `dist/apple-touch-icon.png`, add `<link rel="apple-touch-icon" href="apple-touch-icon.png">` to the template, and add the icon to the service worker's cache list.
  - Commit `feat: home screen icon`.
- [ ] **Final:** run `npm test` and `npm run build`, push, and have the driver repeat the Task 8 device checkpoint (including Airplane Mode). Update `README.md` with:
  - what it is,
  - how to run `npm test`, `npm run build`, and `npm run gen`,
  - iPad setup: Add to Home Screen, Guided Access, Auto-Lock Never, rotation lock,
  - where to set `LINKEDIN_URL`.

  Commit `docs: readme`.
