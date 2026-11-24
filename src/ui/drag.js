import { vehicleAt, slideRange } from '../puzzle/board.js';
import { BOARD, cellAt } from './layout.js';

export function beginDrag(board, x, y, touchId) {
  const cell = cellAt(x, y);
  if (!cell) return null;
  const i = vehicleAt(board, cell.row, cell.col);
  if (i === -1) return null;
  return { touchId, i, horiz: board.vehicles[i].horiz, startX: x, startY: y, range: slideRange(board, i) };
}

export function dragOffsetPx(drag, x, y) {
  const raw = drag.horiz ? x - drag.startX : y - drag.startY;
  return Math.max(drag.range.min * BOARD.cell, Math.min(drag.range.max * BOARD.cell, raw));
}

export function endDrag(drag, x, y) {
  const cells = Math.round(dragOffsetPx(drag, x, y) / BOARD.cell);
  return Math.max(drag.range.min, Math.min(drag.range.max, cells)) || 0;
}

export function cancelDrag() {
  return 0;
}
