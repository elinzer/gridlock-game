import { DIFFICULTIES } from '../config.js';
import { EXIT_ROW, SIZE, parseBoard } from '../puzzle/board.js';
import { timeLeftMs } from '../game/round.js';
import { formatClock, formatOverPar } from '../game/scoring.js';
import { idleStatus } from '../game/idle.js';
import { warningVisible } from '../game/app.js';
import { LETTERS } from '../game/initials.js';
import { QR } from '../generated/qr.js';
import { PALETTE, VEHICLE_COLORS } from './palette.js';
import { drawText, drawTextCentered, textWidth } from './font.js';
import { drawVehicle } from './sprites.js';
import {
  W, H, BOARD, SIDEBAR, QR_CARD, CREDIT_LINES, MAIN, MAIN_CX, INITIAL_COLUMNS, INITIAL_ROWS, buttonsFor,
} from './layout.js';

export const SOLVE_ANIM_MS = 400;
const TITLE_BOARD = parseBoard('BBC.DD' + '..C..E' + 'AAC..E' + 'F.GG.E' + 'F..H..' + 'II.H..');
const TITLE_GEO = { x: MAIN_CX - 36, y: 44, cell: 12 };
const SIDEBAR_CX = SIDEBAR.x + SIDEBAR.w / 2;

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function outline(ctx, x, y, w, h, color) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
}

export function vehicleColor(i) {
  return i === 0 ? PALETTE.red : VEHICLE_COLORS[(i - 1) % VEHICLE_COLORS.length];
}

// geo = { x, y, cell }; opts = { dragIndex, dragOffset, exitOffset }
export function drawBoard(ctx, board, geo, opts) {
  const o = opts || {};
  const size = geo.cell * SIZE;
  const f = Math.max(2, Math.round(geo.cell / 6));
  rect(ctx, geo.x - f, geo.y - f, size + f * 2, size + f * 2, PALETTE.frame);
  rect(ctx, geo.x, geo.y, size, size, PALETTE.road);
  for (let n = 1; n < SIZE; n++) {
    for (let m = 0; m < SIZE; m++) {
      const cx = geo.x + n * geo.cell;
      const cy = geo.y + m * geo.cell + Math.floor(geo.cell / 2);
      rect(ctx, cx, cy, 1, 1, PALETTE.roadLine);
      rect(ctx, geo.x + m * geo.cell + Math.floor(geo.cell / 2), geo.y + n * geo.cell, 1, 1, PALETTE.roadLine);
    }
  }
  // The exit is an underground portal: a dark tunnel mouth cut through the
  // frame with a concrete lip above it, and green arrows pointing out.
  const exitY = geo.y + EXIT_ROW * geo.cell;
  const lip = Math.max(1, Math.round(f / 2));
  rect(ctx, geo.x + size, exitY - lip, f + lip, geo.cell + lip * 2, PALETTE.dim);
  rect(ctx, geo.x + size, exitY, f + lip, geo.cell, PALETTE.ink);
  for (let n = 0; n < 2; n++) {
    const ax = geo.x + size + f + lip + 2 + n * 3;
    const ay = exitY + Math.floor(geo.cell / 2);
    rect(ctx, ax, ay - 2, 1, 5, PALETTE.exit);
    rect(ctx, ax + 1, ay - 1, 1, 3, PALETTE.exit);
    rect(ctx, ax + 2, ay, 1, 1, PALETTE.exit);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(geo.x, geo.y, size, size);
  ctx.rect(geo.x + size, exitY, f + lip, geo.cell);
  ctx.clip();
  board.vehicles.forEach((v, i) => {
    let x = geo.x + v.col * geo.cell;
    let y = geo.y + v.row * geo.cell;
    if (i === o.dragIndex) {
      if (v.horiz) x += o.dragOffset; else y += o.dragOffset;
    }
    if (i === 0 && o.exitOffset) x += o.exitOffset;
    drawVehicle(ctx, v, Math.round(x), Math.round(y), geo.cell, vehicleColor(i));
  });
  ctx.restore();
}

function drawButton(ctx, b, primary) {
  rect(ctx, b.x, b.y, b.w, b.h, primary ? PALETTE.accent : PALETTE.road);
  outline(ctx, b.x, b.y, b.w, b.h, primary ? PALETTE.text : PALETTE.frame);
  if (b.label) {
    drawTextCentered(ctx, b.label, b.x + b.w / 2, b.y + Math.floor((b.h - 7) / 2), primary ? PALETTE.ink : PALETTE.text);
  }
}

function drawArrow(ctx, b, up) {
  const cx = Math.floor(b.x + b.w / 2);
  const top = b.y + Math.floor(b.h / 2) - 4;
  for (let n = 0; n < 8; n++) {
    const half = up ? n : 7 - n;
    rect(ctx, cx - half, top + n, half * 2 + 1, 1, PALETTE.text);
  }
}

function drawQR(ctx) {
  rect(ctx, QR_CARD.x, QR_CARD.y, QR_CARD.w, QR_CARD.h, PALETTE.paper);
  const scale = 2;
  const ox = QR_CARD.x + Math.floor((QR_CARD.w - QR.size * scale) / 2);
  const oy = QR_CARD.y + Math.floor((QR_CARD.h - QR.size * scale) / 2);
  ctx.fillStyle = PALETTE.ink;
  for (let r = 0; r < QR.size; r++) {
    for (let c = 0; c < QR.size; c++) {
      if (QR.modules[r * QR.size + c]) ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
    }
  }
}

function drawSidebar(ctx, state, now) {
  drawTextCentered(ctx, 'LOWER WACKER', SIDEBAR_CX, 6, PALETTE.accent);
  if (state.round && (state.screen === 'play' || state.screen === 'solved')) {
    const left = timeLeftMs(state.round, now);
    drawTextCentered(ctx, formatClock(left), SIDEBAR_CX, 17, left <= 30000 ? PALETTE.accent : PALETTE.text, 2);
    drawTextCentered(ctx, 'MOVES ' + state.round.moves, SIDEBAR_CX, 34, PALETTE.text);
    drawTextCentered(ctx, DIFFICULTIES[state.difficulty].label + ' PAR ' + state.round.par, SIDEBAR_CX, 43, PALETTE.dim);
  } else if (state.screen === 'title') {
    drawTextCentered(ctx, 'DRAG TO SLIDE', SIDEBAR_CX, 30, PALETTE.dim);
  }
  CREDIT_LINES.forEach((l) => drawTextCentered(ctx, l.text, SIDEBAR_CX, l.y, PALETTE.text));
  drawQR(ctx);
}

function drawTitle(ctx, state, view) {
  drawTextCentered(ctx, 'LOWER WACKER', MAIN_CX, 10, PALETTE.accent, 2);
  drawTextCentered(ctx, 'GET THE RED CAR OUT', MAIN_CX, 30, PALETTE.text);
  const demo = view.attract || { board: TITLE_BOARD };
  drawBoard(ctx, demo.board, TITLE_GEO, { dragIndex: demo.index, dragOffset: demo.offset });
}

function drawSolved(ctx, state) {
  const r = state.result;
  drawTextCentered(ctx, 'SOLVED!', MAIN_CX, 16, PALETTE.exit, 2);
  drawTextCentered(ctx, 'MOVES ' + r.moves + '  PAR ' + r.par, MAIN_CX, 44, PALETTE.text);
  drawTextCentered(ctx, formatOverPar(r.overPar), MAIN_CX, 58, PALETTE.accent, 3);
  drawTextCentered(ctx, 'TIME LEFT ' + formatClock(r.timeLeftMs), MAIN_CX, 92, PALETTE.text);
  if (state.rank !== null) {
    drawTextCentered(ctx, 'NEW HIGH SCORE!', MAIN_CX, 112, PALETTE.accent);
    drawTextCentered(ctx, 'RANK ' + (state.rank + 1), MAIN_CX, 124, PALETTE.text);
  }
  drawTextCentered(ctx, 'TAP TO CONTINUE', MAIN_CX, 166, PALETTE.dim);
}

function drawInitials(ctx, state, buttons) {
  drawTextCentered(ctx, 'NEW HIGH SCORE!', MAIN_CX, 10, PALETTE.accent);
  drawTextCentered(ctx, 'ENTER YOUR INITIALS', MAIN_CX, 24, PALETTE.text);
  buttons.forEach((b) => {
    if (b.target.indexOf('initials:up') === 0 || b.target.indexOf('initials:down') === 0) {
      drawButton(ctx, b, false);
      drawArrow(ctx, b, b.target.indexOf(':up:') !== -1);
    }
  });
  INITIAL_COLUMNS.forEach((c, n) => {
    drawTextCentered(ctx, LETTERS[state.initials[n]], c.x + c.w / 2, INITIAL_ROWS.letter, PALETTE.text, 4);
  });
  if (state.blockedMsg) drawTextCentered(ctx, 'TRY AGAIN', MAIN_CX, 136, PALETTE.red);
  drawButton(ctx, buttons.find((b) => b.target === 'initials:ok'), true);
}

function drawLeaderboard(ctx, state, buttons, entries) {
  drawTextCentered(ctx, 'HIGH SCORES', MAIN_CX, 8, PALETTE.accent);
  buttons.forEach((b) => {
    if (b.target.indexOf('board:tab:') === 0) drawButton(ctx, b, b.target === 'board:tab:' + state.boardTab);
  });
  if (!entries.length) {
    drawTextCentered(ctx, 'NO SCORES YET', MAIN_CX, 92, PALETTE.dim);
  }
  entries.forEach((e, n) => {
    const y = 50 + n * 10;
    const color = n === state.highlight ? PALETTE.accent : PALETTE.text;
    const rank = (n + 1) + '.';
    drawText(ctx, rank, 32 - textWidth(rank), y, color);
    drawText(ctx, e.initials, 40, y, color);
    drawText(ctx, formatOverPar(e.overPar), 74, y, color);
    const clock = formatClock(e.timeLeftMs);
    drawText(ctx, clock, 136 - textWidth(clock), y, color);
  });
  drawButton(ctx, buttons.find((b) => b.target === 'board:done'), false);
}

function drawTimesUp(ctx, state) {
  drawTextCentered(ctx, "TIME'S UP", MAIN_CX, 50, PALETTE.accent, 2);
  drawTextCentered(ctx, 'PAR WAS ' + state.round.par, MAIN_CX, 82, PALETTE.text);
  drawTextCentered(ctx, 'TAP TO CONTINUE', MAIN_CX, 166, PALETTE.dim);
}

function drawWarning(ctx, state, now) {
  const box = { x: 12, y: 44, w: 144, h: 100 };
  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.ink);
  outline(ctx, box.x, box.y, box.w, box.h, PALETTE.accent);
  drawTextCentered(ctx, 'STILL PLAYING?', MAIN_CX, box.y + 12, PALETTE.text);
  drawTextCentered(ctx, String(idleStatus(state.lastTouchAt, now).secondsLeft), MAIN_CX, box.y + 34, PALETTE.accent, 4);
  drawTextCentered(ctx, 'TAP TO KEEP GOING', MAIN_CX, box.y + 78, PALETTE.text);
}

function solveAnimating(view, now) {
  return !!view.solveAnim && now - view.solveAnim.startedAt < SOLVE_ANIM_MS;
}

export function isAnimating(view, now) {
  return solveAnimating(view, now);
}

// view = { drag, dragOffset, solveAnim: {startedAt}|null, attract, entries }
export function render(ctx, state, view, now) {
  rect(ctx, 0, 0, W, H, PALETTE.bg);
  rect(ctx, SIDEBAR.x - 4, 0, 1, H, PALETTE.road);
  drawSidebar(ctx, state, now);

  const buttons = buttonsFor(state.screen, state);
  switch (state.screen) {
    case 'title':
      drawTitle(ctx, state, view);
      drawButton(ctx, buttons[0], true);
      drawButton(ctx, buttons[1], false);
      break;
    case 'difficulty':
      drawTextCentered(ctx, 'PICK A LEVEL', MAIN_CX, 12, PALETTE.accent);
      buttons.forEach((b) => drawButton(ctx, b, false));
      break;
    case 'play':
      drawBoard(ctx, state.round.board, BOARD, {
        dragIndex: view.drag ? view.drag.i : -1, dragOffset: view.dragOffset,
      });
      drawButton(ctx, buttons[0], false);
      break;
    case 'solved':
      if (solveAnimating(view, now)) {
        const t = (now - view.solveAnim.startedAt) / SOLVE_ANIM_MS;
        drawBoard(ctx, state.round.board, BOARD, { exitOffset: Math.round(t * t * BOARD.cell * 2.5) });
      } else {
        drawSolved(ctx, state);
      }
      break;
    case 'initials':
      drawInitials(ctx, state, buttons);
      break;
    case 'leaderboard':
      drawLeaderboard(ctx, state, buttons, view.entries || []);
      break;
    case 'timesup':
      drawTimesUp(ctx, state);
      break;
    default:
      break;
  }

  if (warningVisible(state, now)) drawWarning(ctx, state, now);
}
