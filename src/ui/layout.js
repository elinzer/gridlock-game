// Everything is laid out on a 256x192 grid, drawn 4x to fill 1024x768 points.
// The board sits on the left; the sidebar on the right always ends with the
// "built by your driver" QR credit.
export const W = 256;
export const H = 192;

export const BOARD = { x: 12, y: 24, cell: 24 };
export const BOARD_PX = BOARD.cell * 6;
export const SIDEBAR = { x: 170, y: 4, w: 80 };
export const CREDIT = { x: 170, y: 74, w: 80, h: 118 };
export const QR_CARD = { x: 173, y: 94, w: 74, h: 74 };
export const CREDIT_LINES = [
  { text: 'BUILT BY', y: 76 },
  { text: 'YOUR DRIVER', y: 85 },
  { text: 'SCAN TO', y: 172 },
  { text: 'CONNECT', y: 181 },
];
export const MAIN = { x: 4, y: 4, w: 160, h: 184 };
export const MAIN_CX = MAIN.x + MAIN.w / 2;

export const DIFFICULTY_LABELS = { easy: 'EASY  ~1 MIN', medium: 'MEDIUM ~2 MIN', hard: 'HARD  ~3 MIN' };
const TAB_LABELS = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' };

export const UI_STRINGS = [
  'LOWER WACKER', 'BUILT BY', 'YOUR DRIVER', 'SCAN TO', 'CONNECT', 'PLAY', 'SCORES', 'BACK', 'QUIT',
  'PICK A LEVEL', 'SOLVED!', 'MOVES', 'PAR', 'TIME LEFT', 'RANK', 'TAP TO CONTINUE', 'NEW HIGH SCORE!',
  'ENTER YOUR INITIALS', 'OK', 'TRY AGAIN', 'HIGH SCORES', 'NO SCORES YET', 'DONE', "TIME'S UP", 'PAR WAS',
  'STILL PLAYING?', 'TAP TO KEEP GOING', 'GET THE RED CAR OUT', 'DRAG TO SLIDE',
  DIFFICULTY_LABELS.easy, DIFFICULTY_LABELS.medium, DIFFICULTY_LABELS.hard,
];

export const SIDEBAR_LINES = ['LOWER WACKER', 'MOVES 999', 'MEDIUM PAR 20', 'BUILT BY', 'YOUR DRIVER', 'SCAN TO', 'CONNECT'];

export function cellAt(x, y) {
  const col = Math.floor((x - BOARD.x) / BOARD.cell);
  const row = Math.floor((y - BOARD.y) / BOARD.cell);
  if (x < BOARD.x || y < BOARD.y || col > 5 || row > 5) return null;
  return { row, col };
}

const button = (target, x, y, w, h, label) => ({ target, x, y, w, h, label });
const centered = (target, y, w, h, label) => button(target, Math.round(MAIN_CX - w / 2), y, w, h, label);

export const INITIAL_COLUMNS = [24, 66, 108].map((x) => ({ x, w: 36 }));
export const INITIAL_ROWS = { up: 44, letter: 72, down: 104 };

export function buttonsFor(screen, state) {
  switch (screen) {
    case 'title':
      return [centered('title:play', 124, 112, 28, 'PLAY'), centered('title:scores', 158, 112, 24, 'SCORES')];
    case 'difficulty':
      return [
        centered('diff:easy', 30, 128, 32, DIFFICULTY_LABELS.easy),
        centered('diff:medium', 70, 128, 32, DIFFICULTY_LABELS.medium),
        centered('diff:hard', 110, 128, 32, DIFFICULTY_LABELS.hard),
        centered('diff:back', 158, 64, 24, 'BACK'),
      ];
    case 'play':
      return [button('play:quit', SIDEBAR.x, 52, SIDEBAR.w, 20, 'QUIT')];
    case 'solved':
      return [button('solved:continue', MAIN.x, MAIN.y, MAIN.w, MAIN.h, '')];
    case 'timesup':
      return [button('timesup:continue', MAIN.x, MAIN.y, MAIN.w, MAIN.h, '')];
    case 'initials': {
      const out = [];
      INITIAL_COLUMNS.forEach((c, n) => {
        out.push(button('initials:up:' + n, c.x, INITIAL_ROWS.up, c.w, 24, ''));
        out.push(button('initials:down:' + n, c.x, INITIAL_ROWS.down, c.w, 24, ''));
      });
      out.push(centered('initials:ok', 152, 72, 28, 'OK'));
      return out;
    }
    case 'leaderboard':
      return [
        button('board:tab:easy', 8, 22, 46, 20, TAB_LABELS.easy),
        button('board:tab:medium', 59, 22, 46, 20, TAB_LABELS.medium),
        button('board:tab:hard', 110, 22, 46, 20, TAB_LABELS.hard),
        centered('board:done', 162, 72, 24, 'DONE'),
      ];
    default:
      return [];
  }
}

export function hitTest(screen, state, x, y) {
  const hit = buttonsFor(screen, state).find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  return hit ? hit.target : null;
}

export function toInternal(clientX, clientY, rect) {
  return {
    x: (clientX - rect.left) * W / rect.width,
    y: (clientY - rect.top) * H / rect.height,
  };
}
