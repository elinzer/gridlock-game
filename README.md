# Lower Wacker

An 8-bit sliding-block traffic puzzle. Slide the other cars and trucks out of the way and drive the red car out the exit. Every puzzle has a **par** (the fewest possible moves), and each difficulty keeps its own top-10 board.

It's a single self-contained HTML file plus a tiny service worker, so it runs fully offline.

Play it: <https://elinzer.github.io/gridlock-game/>

## How it works

- **Puzzles are generated and graded ahead of time.** `tools/generate-puzzles.js` builds random boards, explores every state reachable from each one, and runs a breadth-first search back from the solved states, so every state gets an exact par. That's how it fills the Easy (par 4–8), Medium (9–14), and Hard (15–20) pools. The iPad never runs a solver; it just picks a puzzle it hasn't shown recently.
- **Pure logic, thin UI.** Game rules, timing, scoring, the leaderboard, and the screen flow (`src/puzzle/`, `src/game/`) are plain functions with unit tests. The UI (`src/ui/`) draws everything into a 256×192 canvas and scales it up with smoothing off, so the pixels stay crisp.
- **Built for a 2018 iPad.** The bundle targets Safari 12, and the build fails if the output isn't plain ES2018. Storage failures (private mode, a full disk, corrupt data) fall back to memory, so they never break the game.
- **No driver involvement.** After 60 seconds without a touch, a "Still playing?" countdown appears. Ten seconds later the game goes back to the title screen.

## Development

Requires Node 22.

```sh
npm install
npm test          # unit tests, plus a check of every shipped puzzle's par
npm run build     # writes dist/index.html, dist/sw.js, dist/apple-touch-icon.png
npm run gen       # regenerates src/puzzle/puzzles.json (deterministic, takes about 8 minutes)
```

To try it on desktop, serve `dist/` (`python3 -m http.server -d dist 8080`) and open it at 1024×768. The mouse works the same as touch.

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages (`.github/workflows/pages.yml`). Build and deploy are separate jobs, and the deploy retries once on its own. If it still fails (GitHub's Pages service is occasionally flaky), use **Re-run failed jobs**, which redeploys the same build.

## Setting the QR code

The QR code in the sidebar points to `LINKEDIN_URL` in [`src/config.js`](src/config.js). Change it, then rebuild. The build fails if the URL is too long to fit the sidebar (QR version 3, about 50 characters).

## iPad setup

1. On Wi-Fi, open the Pages URL in Safari, then tap **Share → Add to Home Screen**.
2. Launch it from the home-screen icon once while online, so the service worker caches it.
3. **Settings → Display & Brightness → Auto-Lock → Never.** Keep the iPad plugged in.
4. Lock rotation in landscape.
5. **Settings → Accessibility → Guided Access → On.** Open the game, then triple-click the Home button to start Guided Access.

While on Wi-Fi, the game checks for a new version every 10 minutes and reloads onto it when it's sitting untouched on the title screen, so it never interrupts a game. If launching offline from the home screen ever fails, a fallback is to keep the game open in a Safari tab under Guided Access.
