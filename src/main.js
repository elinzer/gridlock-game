import puzzles from './puzzle/puzzles.json';
import { createStorage } from './game/storage.js';
import { createLeaderboard } from './game/leaderboard.js';
import { createPicker } from './game/picker.js';
import { initialState, reduce, warningVisible, canReloadForUpdate, touchRefreshDue } from './game/app.js';
import { W, H, hitTest, toInternal } from './ui/layout.js';
import { beginDrag, dragOffsetPx, endDrag, cancelDrag } from './ui/drag.js';
import { render, isAnimating, SOLVE_ANIM_MS, TITLE_BOARD } from './ui/render.js';
import { createAttract, stepAttract, attractView } from './ui/attract.js';

const TICK_MS = 250;
const UPDATE_CHECK_MS = 10 * 60 * 1000;
const SOLVED_TAP_GUARD_MS = SOLVE_ANIM_MS + 400;

const storage = createStorage(() => window.localStorage);
const deps = {
  picker: createPicker(puzzles, storage, Math.random),
  leaderboard: createLeaderboard(storage),
};

const screen = document.getElementById('screen');
const screenCtx = screen.getContext('2d');
const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
const ctx = buffer.getContext('2d');

let state = initialState(performance.now());
const view = { drag: null, dragOffset: 0, solveAnim: null, entries: [] };
let attract = createAttract(TITLE_BOARD, performance.now());
let gesture = null;
let dirty = true;
let updateReady = false;

function dispatch(event) {
  const before = state;
  state = reduce(state, event, deps);
  if (state === before) return;
  if (state.screen !== 'play') {
    view.drag = null;
    view.dragOffset = 0;
  }
  if (before.screen === 'play' && state.screen === 'solved') view.solveAnim = { startedAt: event.now };
  if (state.screen === 'leaderboard') view.entries = deps.leaderboard.entries(state.boardTab);
  dirty = true;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cssW = Math.floor(W * scale);
  const cssH = Math.floor(H * scale);
  screen.style.width = cssW + 'px';
  screen.style.height = cssH + 'px';
  screen.style.left = Math.floor((window.innerWidth - cssW) / 2) + 'px';
  screen.style.top = Math.floor((window.innerHeight - cssH) / 2) + 'px';
  screen.width = Math.round(cssW * dpr);
  screen.height = Math.round(cssH * dpr);
  dirty = true;
}

// A fixed CRT-style overlay: one dark device-pixel row in every four. It is
// identical every frame, so nothing flickers or rolls.
function makeScanlines() {
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 4;
  const t = tile.getContext('2d');
  t.fillStyle = 'rgba(0,0,0,0.15)';
  t.fillRect(0, 3, 1, 1);
  return screenCtx.createPattern(tile, 'repeat');
}
const scanlines = makeScanlines();

function draw(now) {
  render(ctx, state, view, now);
  screenCtx.imageSmoothingEnabled = false;
  screenCtx.webkitImageSmoothingEnabled = false;
  screenCtx.drawImage(buffer, 0, 0, W, H, 0, 0, screen.width, screen.height);
  if (scanlines) {
    screenCtx.fillStyle = scanlines;
    screenCtx.fillRect(0, 0, screen.width, screen.height);
  }
}

function frame() {
  const now = performance.now();
  let attractMoving = false;
  if (state.screen === 'title') {
    attract = stepAttract(attract, now, Math.random);
    view.attract = attractView(attract, now);
    attractMoving = !!attract.move;
  }
  if (dirty || attractMoving || view.drag || isAnimating(view, now)) {
    dirty = isAnimating(view, now);
    draw(now);
  }
  window.requestAnimationFrame(frame);
}

function pointFrom(clientX, clientY) {
  return toInternal(clientX, clientY, screen.getBoundingClientRect());
}

function inputLocked(now) {
  return state.screen === 'solved' && view.solveAnim && now - view.solveAnim.startedAt < SOLVED_TAP_GUARD_MS;
}

function startGesture(id, clientX, clientY) {
  if (gesture) return;
  const now = performance.now();
  const swallow = warningVisible(state, now) || inputLocked(now);
  dispatch({ type: 'touch', now });
  dirty = true;
  const p = pointFrom(clientX, clientY);
  gesture = { id, swallow, tap: null };
  if (swallow) return;
  if (state.screen === 'play') {
    view.drag = beginDrag(state.round.board, p.x, p.y, id);
    view.dragOffset = 0;
  }
  if (!view.drag) gesture.tap = hitTest(state.screen, state, p.x, p.y);
}

function moveGesture(id, clientX, clientY) {
  if (!gesture || gesture.id !== id || !view.drag) return;
  const now = performance.now();
  if (touchRefreshDue(state, now)) dispatch({ type: 'touch', now });
  const p = pointFrom(clientX, clientY);
  view.dragOffset = dragOffsetPx(view.drag, p.x, p.y);
}

function endGesture(id, clientX, clientY) {
  if (!gesture || gesture.id !== id) return;
  const g = gesture;
  gesture = null;
  const now = performance.now();
  dispatch({ type: 'touch', now });
  if (g.swallow) return;
  const p = pointFrom(clientX, clientY);
  if (view.drag) {
    const drag = view.drag;
    const delta = endDrag(drag, p.x, p.y);
    view.drag = null;
    view.dragOffset = 0;
    dirty = true;
    if (delta !== 0) dispatch({ type: 'move', i: drag.i, delta, now });
    return;
  }
  if (g.tap && hitTest(state.screen, state, p.x, p.y) === g.tap) {
    dispatch({ type: 'tap', target: g.tap, now });
  }
}

function cancelGesture() {
  gesture = null;
  if (view.drag) {
    view.drag = null;
    view.dragOffset = cancelDrag();
    dirty = true;
  }
}

function findTouch(list, id) {
  for (let n = 0; n < list.length; n++) if (list[n].identifier === id) return list[n];
  return null;
}

screen.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  if (t) startGesture(t.identifier, t.clientX, t.clientY);
}, { passive: false });

screen.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = gesture && findTouch(e.changedTouches, gesture.id);
  if (t) moveGesture(t.identifier, t.clientX, t.clientY);
}, { passive: false });

screen.addEventListener('touchend', (e) => {
  e.preventDefault();
  const t = gesture && findTouch(e.changedTouches, gesture.id);
  if (t) endGesture(t.identifier, t.clientX, t.clientY);
}, { passive: false });

screen.addEventListener('touchcancel', (e) => {
  e.preventDefault();
  cancelGesture();
}, { passive: false });

screen.addEventListener('mousedown', (e) => startGesture('mouse', e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => moveGesture('mouse', e.clientX, e.clientY));
window.addEventListener('mouseup', (e) => endGesture('mouse', e.clientX, e.clientY));

document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

setInterval(() => {
  const now = performance.now();
  dispatch({ type: 'tick', now });
  if (state.screen !== 'title') dirty = true;
  if (updateReady && !gesture && canReloadForUpdate(state, now)) window.location.reload();
}, TICK_MS);

if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) updateReady = true;
    hadController = true;
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    setInterval(() => { reg.update().catch(() => {}); }, UPDATE_CHECK_MS);
  }).catch(() => {});
}

resize();
window.requestAnimationFrame(frame);
