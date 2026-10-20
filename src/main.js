import { generateLevel } from './levelgen.js';
import { createBoard, hintFor } from './board.js';
import { render, layout, nodeAt, themeFor, W, H } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  pointer: null,
  dragging: false,
  hint: null,
  time: 0,
  title: '',
  theme: themeFor(0),
  winT: 0, // затухающая вспышка при победе
};

let levelIndex = Number(localStorage.getItem('level') || 0);
let board = null;
let pts = null;

function load(index) {
  levelIndex = index;
  localStorage.setItem('level', String(index));
  // Seed завязан на номер уровня: один и тот же уровень у всех игроков
  // и при любом перезапуске.
  board = createBoard(generateLevel(0xa11ce + index * 2654435761, index));
  pts = layout(board.level);
  ui.hint = null;
  ui.winT = 0;
  ui.theme = themeFor(index);
  ui.title = `Уровень ${index + 1}`;
  syncButtons();
}

// --- Ввод -------------------------------------------------------------

/** Экранные координаты события -> виртуальные координаты игры. */
function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  };
}

function onDown(e) {
  if (board.solved) return;
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  const p = toLocal(e);
  ui.pointer = p;
  const i = nodeAt(pts, p.x, p.y);
  if (i < 0) return;

  if (!board.trail.length) {
    if (board.start(i)) ui.dragging = true;
    return;
  }
  // Тап по текущей точке — продолжить ведение после отрыва пальца.
  if (i === board.current) {
    ui.dragging = true;
    return;
  }
  // Тап по достижимой соседней точке — сделать ход без ведения.
  // На десктопе мышью так удобнее, чем тащить.
  if (board.canMove(i)) {
    board.move(i);
    ui.dragging = true;
    afterMove();
  }
}

function onMove(e) {
  const p = toLocal(e);
  ui.pointer = p;
  if (!ui.dragging || board.solved) return;
  const i = nodeAt(pts, p.x, p.y, 26);
  if (i < 0 || i === board.current) return;

  // Провести обратно по последней линии = отменить ход. Естественный жест,
  // которым игроки пользуются раньше, чем находят кнопку отмены.
  if (board.trail.length > 1 && i === board.trail[board.trail.length - 2]) {
    board.undo();
    ui.hint = null;
    syncButtons();
    return;
  }
  if (board.canMove(i)) {
    board.move(i);
    afterMove();
  }
}

function onUp() {
  ui.dragging = false;
  ui.pointer = null;
}

function afterMove() {
  ui.hint = null;
  if (board.solved) {
    ui.winT = 1;
    ui.dragging = false;
  }
  syncButtons();
}

canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

// --- Кнопки -----------------------------------------------------------

const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');
const btnHint = document.getElementById('btn-hint');
const btnNext = document.getElementById('btn-next');

function syncButtons() {
  const playing = !board.solved;
  btnUndo.hidden = !playing;
  btnReset.hidden = !playing;
  btnHint.hidden = !playing;
  btnNext.hidden = playing;
  btnUndo.disabled = board.trail.length === 0;
}

btnUndo.addEventListener('click', () => {
  board.undo();
  ui.hint = null;
  syncButtons();
});

btnReset.addEventListener('click', () => {
  board.reset();
  ui.hint = null;
  syncButtons();
});

// Позже сюда встанет rewarded-реклама: подсказка — то, за что игрок
// добровольно смотрит ролик.
btnHint.addEventListener('click', () => {
  ui.hint = hintFor(board);
  if (!ui.hint) {
    // Игрок свернул с решения — подсказать можно только после сброса.
    board.reset();
    ui.hint = hintFor(board);
    syncButtons();
  }
});

btnNext.addEventListener('click', () => load(levelIndex + 1));

// --- Цикл и масштабирование -------------------------------------------

const stage = document.getElementById('stage');
const wrap = document.getElementById('wrap');

function fit() {
  const availW = stage.clientWidth || window.innerWidth;
  const availH = stage.clientHeight || window.innerHeight;
  const scale = Math.min(availW / W, availH / H);
  wrap.style.width = W + 'px';
  wrap.style.height = H + 'px';
  wrap.style.transform = `scale(${scale > 0 ? scale : 1})`;
  canvas.width = W;
  canvas.height = H;
}
new ResizeObserver(fit).observe(stage);
window.addEventListener('orientationchange', fit);

function loop(t) {
  ui.time = t;
  if (ui.winT > 0) ui.winT = Math.max(0, ui.winT - 0.018);
  render(ctx, board, pts, ui);
  requestAnimationFrame(loop);
}

load(levelIndex);
fit();
requestAnimationFrame(loop);

// Для диагностики из консоли и автотестов. draw() рисует кадр принудительно:
// в скрытой вкладке requestAnimationFrame заморожен, и проверить картинку иначе нельзя.
window.__game = {
  get board() { return board; },
  get pts() { return pts; },
  load,
  ui,
  draw: () => render(ctx, board, pts, ui),
};
