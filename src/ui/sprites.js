import { PALETTE } from './palette.js';

// Top-down pixel-art vehicles, drawn with fillRect in "along/across" coords so
// one routine covers both orientations. Everything scales with the cell size
// in whole pixels (s = 1 on the 12px title board, 2 on the 24px play board).
export function drawVehicle(ctx, v, x, y, cell, color) {
  const s = Math.max(1, Math.floor(cell / 12));
  const len = v.len * cell - s * 2;
  const wid = cell - s * 2;
  const ox = x + s;
  const oy = y + s;
  const fill = (u, w, lu, lw, c) => {
    ctx.fillStyle = c;
    if (v.horiz) ctx.fillRect(ox + u, oy + w, lu, lw);
    else ctx.fillRect(ox + w, oy + u, lw, lu);
  };
  const ink = PALETTE.ink;
  const light = color === PALETTE.accent ? PALETTE.text : PALETTE.accent;

  const wheel = 3 * s;
  [3 * s, len - 3 * s - wheel].forEach((u) => {
    fill(u, 0, wheel, 2 * s, ink);
    fill(u, wid - 2 * s, wheel, 2 * s, ink);
  });

  fill(0, s, len, wid - 2 * s, ink);
  fill(s, 2 * s, len - 2 * s, wid - 4 * s, color);
  fill(2 * s, 2 * s, len - 4 * s, s, PALETTE.text);

  fill(len - 2 * s, 2 * s, s, s, light);
  fill(len - 2 * s, wid - 3 * s, s, s, light);

  if (v.len === 2) {
    const windshield = Math.round(len * 0.6);
    fill(windshield, 3 * s, 2 * s, wid - 6 * s, ink);
    fill(Math.round(len * 0.22), 3 * s, s + Math.floor(s / 2), wid - 6 * s, ink);
  } else {
    const cab = len - Math.round(cell * 0.85);
    fill(cab - s, s, s, wid - 2 * s, ink);
    fill(cab + Math.round(cell * 0.25), 3 * s, 2 * s, wid - 6 * s, ink);
    for (let u = 3 * s; u < cab - 2 * s; u += 3 * s) fill(u, 3 * s, s, wid - 6 * s, PALETTE.roadLine);
  }
}
