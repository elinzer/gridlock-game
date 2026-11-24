# Lower Wacker — Design

A retro 8-bit sliding-block traffic puzzle for an iPad mounted on the back of a rideshare headrest in Chicago.

Repo: `gridlock-game`. In-game title: **Lower Wacker**.

## Intent

The driver (a backend-leaning engineer who likes building things people use) wants a hook that gets riders to say "that's clever" and start a conversation, and that leads them to the driver's LinkedIn via an always-visible QR code. The game is the hook, not the whole portfolio: it should be fun and look polished, but it doesn't need to be complex or show off every skill.

The genre fits the setting on purpose. The rider is stuck in traffic, the driver drives for a living, and the puzzle is getting your car out of a jam. It takes no reflexes, so car bumps and a reach to a headrest-mounted screen don't hurt play.

## Goals

- A rider can understand it within seconds with no instructions, and finish a round within a short ride.
- It looks good: a consistent 8-bit pixel-art look.
- "Built by your driver" and a QR code to the driver's LinkedIn are visible on every screen.
- It runs fully offline indefinitely. The iPad has no data plan and may go days without Wi-Fi.
- It needs zero maintenance from the driver between riders: it resets itself.

## Non-goals

- No backend, no network calls, no score syncing. Everything stays on the device.
- No sound at all: no audio code, no mute toggle.
- No hint button and no "watch the solution" replay.
- No daily or periodic leaderboard reset.
- No accounts, no names beyond 3-letter initials.

## Anti-goals (a failure even if it works)

- Anything that causes motion sickness in a moving car: no scrolling backgrounds, no screen shake, no camera movement, no flashing or flicker, no tilt or motion-sensor controls.
- Controls that punish car bumps (precision taps, fast swipes where a slip loses the game).
- A blank or broken screen when the iPad launches without signal.
- Anything that looks like a copy of the board game Rush Hour (its name, art, or puzzle cards). The genre is fine; the puzzles, art, and name are original.

## Device and platform constraints

- **iPad mini 3, iOS 12.5.7, Safari 12 (WebKit, 2018).** 2048×1536 Retina screen, A7 chip, 1 GB RAM.
- **Mounted in landscape** on the passenger headrest, facing the back seat at about arm's length. The rider can't hold it; every touch is a reach.
- **Shipped JavaScript must run on Safari 12:** no optional chaining (`?.`), no nullish coalescing (`??`), no other post-2018 syntax. async/await, canvas, flexbox, and grid are fine.
- **No runtime CDN or network dependencies.** Fonts, sprites, QR code, and puzzles are all inlined or bundled.
- **localStorage for persistence,** every access wrapped in try/catch; the game must still work if storage throws.
- The driver sets these outside the game: Auto-Lock → Never, Guided Access on, iPad plugged in, rotation locked to landscape.

## The game

### Rules (standard for the genre)

- A 6×6 grid holds vehicles: cars (2 cells) and trucks (3 cells), each horizontal or vertical.
- A vehicle slides only along its own axis, any number of cells, and can't pass through other vehicles.
- The player's car is red and sits on the row with the exit on the right edge of the board. The puzzle is solved when the red car slides out of the exit.
- **One move = sliding one vehicle any distance in one drag.** This is the standard way to count, and it's what par is measured in.

### Controls

- Drag a vehicle along its axis; it follows the finger, clamped by its neighbors, and snaps to the nearest cell on release.
- If the vehicle ends in the cell it started in, it doesn't count as a move. This makes accidental bump-drags harmless.
- Vehicles are large enough to grab easily at arm's length. No small tap targets anywhere.

### Difficulty and time limits

- The rider picks **Easy, Medium, or Hard** before each round. Each shows a rough time hint.
- Each difficulty has a countdown time limit for solving one puzzle. *Builder's call, starting point: Easy 2:00, Medium 3:00, Hard 4:00. Tune so most Easy rounds finish well within 2 minutes.*
- Difficulty is defined by the puzzle's **par** (the minimum number of moves to solve it). *Builder's call on the exact par ranges per difficulty; pick ranges that are solvable within the time limits by a first-time player.*

### Scoring

- **Par** is the puzzle's minimum move count. A rider's result is **moves over par** (0 is perfect, shown as "PAR"; otherwise "+2" and so on) plus **time remaining**.
- Only solved puzzles can go on the leaderboard.
- If time runs out: a "Time's up" screen that shows par for that puzzle ("Par was 11"), then back to the title. No replay.

### Leaderboard

- **Three separate all-time leaderboards:** Easy, Medium, Hard. They never reset.
- Ranked by moves over par (lower is better), then by time remaining (higher is better).
- Each board keeps the **top 10**. *(My call.)*
- A solved round that makes the top 10 asks for **3-letter initials**, entered arcade-style with big on-screen up/down letter pickers (no iOS keyboard). A round that doesn't make the top 10 shows the rider's result and the board without asking.
- A small blocklist of offensive 3-letter combinations is rejected at entry. *(My call.)*
- Stored in localStorage. If storage fails, the leaderboard runs in memory for the session and the game keeps working.

### Puzzles

- **Pre-generated at build time, not on the iPad.** A build-time script (Node) generates random boards, solves each one (breadth-first search over board states) to find par, rejects trivial or unsolvable boards, buckets them by par into the three difficulties, and writes them into the shipped game. The iPad never runs a solver.
- The game picks a random puzzle from the chosen difficulty each round, avoiding recently played ones. *(My call; puzzles are not tied to the date.)*
- *Builder's call:* pool size (on the order of 100+ per difficulty), board encoding, generator heuristics.
- The generator and solver are part of the repo and are a legitimate thing for the driver to talk about ("I wrote a solver that grades every puzzle"), so they should be clean and readable.

### Auto-reset (no driver involvement)

- The iPad can't tell when riders change, so inactivity stands in for it.
- After about **60 seconds** with no touch on any screen other than the title, show a "Still playing?" overlay with a **10-second** countdown. Any touch dismisses it. If it reaches zero, the current game (or initials entry, or leaderboard view) is discarded and the game returns to the title screen. *(Timings are my call; tune if riders thinking quietly get interrupted.)*
- The round's countdown timer keeps running during the overlay.

## Screens

Every screen is landscape, and every screen keeps the right-hand sidebar with the **"Built by your driver" QR card** visible. The QR card is large enough to scan from the back seat.

1. **Title:** "LOWER WACKER" in a pixel font, a pixel-art traffic-jam board, "Tap to play." *(My call: an optional gentle attract demo where a car or two slides slowly on the board. Nothing that moves the whole view.)* A way to view the three leaderboards.
2. **Pick difficulty:** three big buttons with time hints.
3. **Play (layout A, chosen by the driver):** board on the left, filling the height. Right sidebar, top to bottom: title, time remaining, move count, difficulty and par, then the QR card at the bottom. A small way to quit back to the title.
4. **Solved:** moves vs. par, time left, rank if any → initials entry if top 10 → leaderboard for that difficulty → back to title.
5. **Time's up:** "Par was N" → back to title.
6. **"Still playing?" overlay:** over any non-title screen.

## Visual style

- **8-bit pixel art.** Render at a low internal resolution and scale up with smoothing off, so pixels stay crisp. *Builder's call: exact internal resolution and how it maps to the 1024×768-point screen.*
- A limited, consistent palette (around 16 colors). The red player car must stand out from every other vehicle.
- Top-down pixel-art cars and trucks, drawn in code or inlined as data. No external image files at runtime.
- A pixel font: either an inlined font file or a hand-built bitmap font drawn on canvas. *Builder's call.*
- A static CRT scanline overlay is allowed (fixed, no flicker or roll).
- Chicago flavor stays light: the name, and optionally small touches like the exit styled as an underground road portal. Don't make it cute.

## QR code

- Points to the driver's LinkedIn. The URL is a single config value so it can later point to a portfolio. *The actual LinkedIn URL is to be provided by the driver before deploy.*
- Generated at build time (or in-page by an inlined encoder) and rendered crisp as pixels with a proper quiet zone. It must scan reliably from a phone at arm's length.
- Caption: "Built by your driver," plus a short line like "Scan to connect."

## Offline delivery and deployment

The brief asked for a single self-contained HTML file. The catch: if the game is hosted (say on GitHub Pages) and launched from the home screen with no signal, iOS can't load it unless something cached it.

*My call:*
- The game itself is one self-contained `index.html` (inline CSS, JS, puzzles, sprites, font, QR code).
- Alongside it, a tiny **service worker** caches `index.html` so the home-screen app launches with no signal. Service workers are supported on iOS 12. Also include the home-screen icon and the `apple-mobile-web-app-capable` meta tag so it opens full-screen.
- Host on **GitHub Pages**. The driver does "Add to Home Screen" once while on Wi-Fi, then runs it from the home-screen icon under Guided Access.
- Updates happen whenever the iPad next opens the game on Wi-Fi; the service worker must update its cache cleanly when a new version is deployed.
- Risk: home-screen web apps on iOS 12 had service worker quirks. The builder must verify offline launch on the real iPad (Airplane Mode → launch from home screen) early, before polishing. If it proves unreliable, the fallback is to keep the game open in Safari under Guided Access so it never reloads.

## Build and verification

- Source can be split into files for readability. A build step produces the single shipped `index.html` (plus the service worker).
- The build must enforce Safari 12 compatibility automatically. *My call: bundle with a tool targeting `safari12` (for example esbuild) so unsupported syntax gets lowered or fails the build.*
- Unit tests for the parts with real logic: the solver, the generator (every shipped puzzle is solvable at its recorded par), move counting, scoring and ranking, the leaderboard (top-10 trimming, storage failure fallback), and the initials blocklist.
- Real-device check on the iPad mini 3 is required for: performance, drag feel, offline launch, and QR scanning from the back seat. The driver does these checks; the builder should ship an early playable build for that purpose.

## Hosting and work order

- The repo is **public on GitHub** (driver confirmed), created with `gh` under the driver's account, with **GitHub Pages** turned on early.
- No tight deadline, but the work should move at a steady pace. Order the work so each step leaves something usable:
  1. **Offline-launch spike first:** a bare-bones page plus service worker deployed to Pages. The driver adds it to the home screen, turns on Airplane Mode, and confirms it launches. This de-risks the shakiest assumption before anything else.
  2. **Playable core:** board, dragging, move counting, timer, difficulty select, puzzles with par, scoring, leaderboard with initials, QR sidebar, idle reset.
  3. **Polish,** each piece optional and stoppable: pixel font, nicer sprites, title-screen attract demo, scanlines.
- *My call:* the red car's final slide out of the exit counts as a move, and the solver counts it the same way. Updates deploy by pushing to the repo; a simple Pages deploy is enough, and no extra automation is needed.

## Open items for the driver

- LinkedIn URL for the QR code. The driver will add it later; build with a clearly marked placeholder in the config value until then.
- Uber/Lyft promotional-material rules: checked by the driver, fine.
- The repo is public: never commit secrets, tokens, or personal data.

## Left to the builder

Code structure, rendering approach (canvas vs. DOM), exact palette, sprite design, font approach, puzzle encoding and pool size, par ranges per difficulty, exact time limits and idle timings within the guidance above, and test tooling.
