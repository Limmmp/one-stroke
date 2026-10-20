/** Вся отрисовка. Игровая логика сюда не заходит. */

export const W = 400;
export const H = 700;

const BOARD = { x: 40, y: 176, size: 320 };

// Синтаксис hsl() строго через запятые: пробельная форма из CSS Color 4
// не работает на Safari старше 12.1, а платформа заявляет поддержку iOS 9.
const hsl = (h, s, l, a = 1) =>
  a >= 1 ? `hsl(${Math.round(h)},${s}%,${l}%)` : `hsla(${Math.round(h)},${s}%,${l}%,${a})`;

/** HSL -> относительная яркость (WCAG). Нужна, чтобы уравнять оттенки по контрасту. */
function luminance(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  const [r, g, b] = seg.map((v) => v + m);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Светлота, при которой оттенок даёт заданную яркость.
 *
 * Без этого контраст линии к фону скачет между уровнями втрое: синий и жёлтый
 * при одной и той же светлоте HSL воспринимаются совершенно по-разному.
 * Подбор двоичным поиском — считается один раз на уровень.
 */
function lightnessFor(hue, sat, targetLum) {
  let lo = 25;
  let hi = 92;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(hue, sat, mid) < targetLum) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Цвет уровня. Оттенок меняется от уровня к уровню — прогресс виден глазом,
 * но яркость линии и фона держится постоянной, чтобы читаемость не плавала.
 */
export function themeFor(levelIndex) {
  const hue = (levelIndex * 47 + 200) % 360;
  const lineL = lightnessFor(hue, 85, 0.34); // яркая линия, одинаковая на всех оттенках
  return {
    hue,
    lineL,
    line: hsl(hue, 85, lineL),
    glow: hsl(hue, 90, lineL, 0.55),
    node: hsl(hue, 25, 90),
    // Фон почти нейтральный и всегда тёмный: оттенок только подкрашивает его,
    // а яркость задана числом, а не наугад.
    bgTop: hsl(hue, 26, 7),
    bgBottom: hsl((hue + 35) % 360, 28, 12),
  };
}

/**
 * Пересчёт координат уровня в экранные.
 *
 * Масштабируем по фактическим границам фигуры, а не по размеру сетки: иначе
 * компактный уровень занимал бы четверть доски, и по мелким точкам не попасть
 * пальцем. Пропорции сохраняем, чтобы фигуру не плющило.
 */
export function layout(level) {
  const xs = level.nodes.map((p) => p.x);
  const ys = level.nodes.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scale = BOARD.size / Math.max(spanX, spanY);

  const offX = (BOARD.size - spanX * scale) / 2;
  const offY = (BOARD.size - spanY * scale) / 2;

  return level.nodes.map((p) => ({
    x: BOARD.x + offX + (p.x - minX) * scale,
    y: BOARD.y + offY + (p.y - minY) * scale,
  }));
}

function background(ctx, theme, time) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.bgTop);
  g.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Мягкое свечение за фигурой — даёт глубину и притягивает взгляд к доске.
  const cx = BOARD.x + BOARD.size / 2;
  const cy = BOARD.y + BOARD.size / 2;
  const r = BOARD.size * (0.72 + Math.sin(time / 2600) * 0.03);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  halo.addColorStop(0, hsl(theme.hue, 70, 40, 0.20));
  halo.addColorStop(1, hsl(theme.hue, 70, 40, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
}

function strokeSegment(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function render(ctx, board, pts, ui) {
  const theme = ui.theme;
  background(ctx, theme, ui.time);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Непройденные рёбра — фоном: фигура читается целиком с первого взгляда,
  // игрок сразу видит задачу, а не открывает её по частям.
  ctx.lineWidth = 6;
  ctx.strokeStyle = hsl(theme.hue, 25, 100, 0.13);
  for (const [a, b] of board.level.edges) strokeSegment(ctx, pts[a], pts[b]);

  // Пройденный след — одной непрерывной светящейся линией.
  if (board.trail.length > 1) {
    ctx.save();
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 9;
    ctx.strokeStyle = theme.line;
    ctx.beginPath();
    ctx.moveTo(pts[board.trail[0]].x, pts[board.trail[0]].y);
    for (let i = 1; i < board.trail.length; i++) {
      ctx.lineTo(pts[board.trail[i]].x, pts[board.trail[i]].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Резинка от текущей точки к пальцу.
  if (ui.dragging && board.current >= 0 && ui.pointer) {
    ctx.save();
    ctx.setLineDash([2, 9]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = hsl(theme.hue, 80, 70, 0.5);
    strokeSegment(ctx, pts[board.current], ui.pointer);
    ctx.restore();
  }

  if (ui.hint) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -ui.time / 26;
    ctx.lineWidth = 5;
    ctx.strokeStyle = hsl(45, 100, 66, 0.85);
    strokeSegment(ctx, pts[ui.hint.from], pts[ui.hint.to]);
    ctx.restore();
  }

  drawNodes(ctx, board, pts, ui, theme);
  if (ui.winT > 0) drawWinBurst(ctx, board, pts, ui, theme);
  drawHud(ctx, board, ui, theme);
}

function drawNodes(ctx, board, pts, ui, theme) {
  // Подсветка стартов — только пока след пуст и только если она что-то значит.
  // На уровнях без нечётных вершин начинать можно откуда угодно, и подсветка
  // всех точек сразу — чистый шум: игрок ищет в ней смысл, которого нет.
  const startsMatter = board.validStarts.length < pts.length;
  const showStarts = board.trail.length === 0 && startsMatter;
  const visited = new Set(board.trail);

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const isStart = showStarts && board.validStarts.includes(i);
    const isCurrent = i === board.current;

    if (isStart) {
      const pulse = 1 + Math.sin(ui.time / 300) * 0.12;
      ctx.fillStyle = hsl(45, 100, 62, 0.16);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsl(45, 100, 66, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (isCurrent) {
      ctx.save();
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = isStart
      ? hsl(45, 100, 70)
      : visited.has(i)
        ? theme.node
        : hsl(theme.hue, 20, 78, 0.55);
    ctx.beginPath();
    ctx.arc(p.x, p.y, visited.has(i) ? 9 : 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Волна по фигуре при победе — короткая награда, ради которой хочется дальше. */
function drawWinBurst(ctx, board, pts, ui, theme) {
  const t = ui.winT; // 1 -> 0
  ctx.save();
  ctx.globalAlpha = t * 0.9;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 30 * t;
  ctx.lineWidth = 9 + (1 - t) * 8;
  ctx.strokeStyle = hsl(theme.hue, 95, 75);
  ctx.beginPath();
  ctx.moveTo(pts[board.trail[0]].x, pts[board.trail[0]].y);
  for (let i = 1; i < board.trail.length; i++) {
    ctx.lineTo(pts[board.trail[i]].x, pts[board.trail[i]].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, board, ui, theme) {
  ctx.textAlign = 'center';

  ctx.fillStyle = hsl(theme.hue, 25, 100, 0.5);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(ui.title.toUpperCase(), W / 2, 62);

  const left = board.level.edges.length - board.used.size;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(board.solved ? 'Готово' : String(left), W / 2, 100);

  if (!board.solved) {
    ctx.fillStyle = hsl(theme.hue, 25, 100, 0.45);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(board.stuck ? 'Тупик — отмени ход' : 'линий осталось', W / 2, 121);
  }

  // Полоска прогресса: мелкая обратная связь на каждый ход.
  const barW = 180;
  const x = (W - barW) / 2;
  ctx.fillStyle = hsl(theme.hue, 25, 100, 0.12);
  ctx.fillRect(x, 138, barW, 4);
  ctx.fillStyle = theme.line;
  ctx.fillRect(x, 138, barW * board.progress, 4);
}

/** Ближайшая к точке вершина в пределах радиуса попадания. */
export function nodeAt(pts, x, y, radius = 30) {
  let best = -1;
  let bestD = radius * radius;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
