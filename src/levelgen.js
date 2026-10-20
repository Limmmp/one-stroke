/**
 * Генератор уровней «одним росчерком».
 *
 * Уровень — связный граф, который можно обвести, не отрывая палец и не проводя
 * по ребру дважды. Это Эйлеров путь: он существует тогда и только тогда, когда
 * граф связен по рёбрам, а вершин нечётной степени ровно 0 или 2.
 *
 * Генератор строит граф так, чтобы условие выполнялось по построению, а затем
 * всё равно проверяет результат — брак дешевле выбросить, чем показать игроку
 * нерешаемый уровень.
 */

import { makeRng } from './rng.js';

const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

/**
 * Проходит ли отрезок a-b ровно через точку c.
 *
 * Критично для играбельности: если линия проходит через третью точку, игрок
 * не отличает одно длинное ребро от двух коротких и не понимает, что обвёл.
 */
function passesThrough(a, b, c) {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (cross !== 0) return false; // не на одной прямой
  const dot = (c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y);
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot > 0 && dot < len2; // строго между концами
}

/** Ребро «чистое», если ни одна другая точка на нём не лежит. */
function isClean(nodes, i, j) {
  for (let k = 0; k < nodes.length; k++) {
    if (k !== i && k !== j && passesThrough(nodes[i], nodes[j], nodes[k])) return false;
  }
  return true;
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Пересекаются ли отрезки (общая вершина пересечением не считается). */
function segmentsCross(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/**
 * Сколько пар рёбер пересекается. Немного пересечений делает фигуру интереснее,
 * много — превращает её в клубок, который невозможно проследить глазом.
 */
function countCrossings(nodes, edges) {
  let n = 0;
  for (let p = 0; p < edges.length; p++) {
    for (let q = p + 1; q < edges.length; q++) {
      const [a, b] = edges[p];
      const [c, d] = edges[q];
      if (a === c || a === d || b === c || b === d) continue;
      if (segmentsCross(nodes[a], nodes[b], nodes[c], nodes[d])) n++;
    }
  }
  return n;
}

/** Список смежности -> число вершин нечётной степени. */
function oddVertices(adj) {
  const odd = [];
  for (let i = 0; i < adj.length; i++) if (adj[i].size % 2) odd.push(i);
  return odd;
}

/** Связен ли граф ПО РЁБРАМ (изолированные вершины игнорируем — их не будет). */
function edgeConnected(adj) {
  const start = adj.findIndex((s) => s.size > 0);
  if (start < 0) return false;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    for (const n of adj[stack.pop()]) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return adj.every((s, i) => s.size === 0 || seen.has(i));
}

/**
 * Алгоритм Хирхольцера: возвращает Эйлеров путь как массив индексов вершин
 * или null. Нужен не только для проверки — из него берётся подсказка
 * («показать первый ход» за просмотр рекламы).
 */
export function solve(nodes, edges) {
  const adj = nodes.map(() => new Map()); // сосед -> сколько рёбер осталось
  for (const [a, b] of edges) {
    adj[a].set(b, (adj[a].get(b) || 0) + 1);
    adj[b].set(a, (adj[b].get(a) || 0) + 1);
  }
  const degree = (i) => [...adj[i].values()].reduce((s, n) => s + n, 0);

  const odd = nodes.map((_, i) => i).filter((i) => degree(i) % 2);
  if (odd.length !== 0 && odd.length !== 2) return null;

  const start = odd.length === 2 ? odd[0] : nodes.findIndex((_, i) => degree(i) > 0);
  if (start < 0) return null;

  const stack = [start];
  const path = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    if (degree(v) === 0) {
      path.push(stack.pop());
      continue;
    }
    const u = adj[v].keys().next().value;
    adj[v].set(u, adj[v].get(u) - 1);
    if (adj[v].get(u) === 0) adj[v].delete(u);
    adj[u].set(v, adj[u].get(v) - 1);
    if (adj[u].get(v) === 0) adj[u].delete(v);
    stack.push(u);
  }

  // Путь обходит все рёбра ровно тогда, когда его длина = рёбра + 1.
  return path.length === edges.length + 1 ? path.reverse() : null;
}

/**
 * Размер фигуры. Это НЕ сложность — только габариты.
 *
 * Число рёбер само по себе плохо предсказывает трудность: фигура из 15 рёбер,
 * где почти любой порядок обхода верен, легче фигуры из 8, где верный порядок
 * единственный. Настоящая сложность измеряется отдельно — см. measureDifficulty.
 */
export function sizeFor(levelIndex) {
  const t = Math.min(1, levelIndex / 80);
  return {
    grid: 3 + Math.round(t * 2), // сетка 3x3 -> 5x5
    nodes: 4 + Math.round(t * 8), // 4 -> 12 точек
    extra: 1 + Math.round(t * 5), // 1 -> 6 дополнительных рёбер
  };
}

/**
 * Доля случайных прохождений, упирающихся в тупик. Это и есть сложность:
 * насколько легко ошибиться, если не думать наперёд.
 *
 * 0 — ошибиться невозможно, любой порядок ведёт к решению.
 * 1 — почти любой необдуманный ход приводит в тупик.
 */
export function measureDifficulty(nodes, edges, rng, samples = 40) {
  const adj = nodes.map(() => []);
  edges.forEach(([a, b], i) => {
    adj[a].push([b, i]);
    adj[b].push([a, i]);
  });
  const degree = nodes.map((_, i) => adj[i].length);
  const odd = nodes.map((_, i) => i).filter((i) => degree[i] % 2);
  const starts = odd.length === 2 ? odd : nodes.map((_, i) => i).filter((i) => degree[i] > 0);

  let stuck = 0;
  for (let s = 0; s < samples; s++) {
    const used = new Uint8Array(edges.length);
    let at = starts[Math.floor(rng.next() * starts.length)];
    let left = edges.length;
    while (left > 0) {
      const options = adj[at].filter(([, e]) => !used[e]);
      if (!options.length) {
        stuck++;
        break;
      }
      const [to, e] = options[Math.floor(rng.next() * options.length)];
      used[e] = 1;
      at = to;
      left--;
    }
  }
  return stuck / samples;
}

/**
 * Есть ли ХОТЬ ОДИН путь, ведущий в тупик. Перебор всех вариантов, а не выборка.
 *
 * Нужен для обучающих уровней: measureDifficulty на 40 пробах может не заметить
 * редкую ловушку, а на первых уровнях недопустима ни одна — игрок ещё не знает
 * ни правил, ни кнопки отмены, и упершись, просто уйдёт.
 * Перебор дорогой, поэтому применяется только к маленьким фигурам.
 */
export function hasDeadEnd(nodes, edges) {
  const adj = nodes.map(() => []);
  edges.forEach(([a, b], i) => {
    adj[a].push([b, i]);
    adj[b].push([a, i]);
  });
  const degree = nodes.map((_, i) => adj[i].length);
  const odd = nodes.map((_, i) => i).filter((i) => degree[i] % 2);
  const starts = odd.length === 2 ? odd : nodes.map((_, i) => i).filter((i) => degree[i] > 0);

  const used = new Uint8Array(edges.length);
  const seen = new Set();

  const walk = (at, left) => {
    if (left === 0) return false; // прошли всё — это не тупик
    const memo = at + ':' + used.join('');
    if (seen.has(memo)) return false;
    seen.add(memo);

    const options = adj[at].filter(([, e]) => !used[e]);
    if (!options.length) return true; // ходов нет, рёбра остались — тупик
    for (const [to, e] of options) {
      used[e] = 1;
      const bad = walk(to, left - 1);
      used[e] = 0;
      if (bad) return true;
    }
    return false;
  };

  return starts.some((s) => walk(s, edges.length));
}

/**
 * Целевая сложность по номеру уровня.
 *
 * Первые уровни провалить невозможно — игрок осваивает управление и правило
 * старта. Потолок 0.68, а не 1.0, по двум причинам: выше просто не строится
 * при наших ограничениях на пересечения, и уровень, где ошибиться можно почти
 * всегда, воспринимается как нечестный, а не как сложный.
 */
export function targetDifficulty(levelIndex) {
  if (levelIndex < 3) return 0; // обучение: провалить невозможно
  const t = Math.min(1, (levelIndex - 3) / 70);
  return 0.1 + Math.pow(t, 0.8) * 0.58;
}

/** Одна попытка построить граф. Может вернуть брак — это нормально. */
function attempt(rng, cfg) {
  const spots = [];
  for (let x = 0; x < cfg.grid; x++) {
    for (let y = 0; y < cfg.grid; y++) spots.push({ x, y });
  }
  const nodes = rng.shuffle(spots).slice(0, Math.min(cfg.nodes, spots.length));
  if (nodes.length < 3) return null;

  const adj = nodes.map(() => new Set());
  const edgeSet = new Set();
  const addEdge = (a, b) => {
    adj[a].add(b);
    adj[b].add(a);
    edgeSet.add(key(a, b));
  };
  const dropEdge = (a, b) => {
    adj[a].delete(b);
    adj[b].delete(a);
    edgeSet.delete(key(a, b));
  };

  // Все допустимые рёбра — только «чистые», без точек на них.
  const candidates = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (isClean(nodes, i, j)) candidates.push([i, j]);
    }
  }
  if (!candidates.length) return null;

  // 1. Остовное дерево — гарантирует связность.
  //    Подключаем к одной из ближайших точек: длинные рёбра через весь холст
  //    режут фигуру и плодят пересечения.
  const connected = [0];
  const rest = nodes.map((_, i) => i).slice(1);
  rng.shuffle(rest);
  for (const node of rest) {
    const options = connected
      .filter((c) => isClean(nodes, node, c))
      .sort((p, q) => dist2(nodes[node], nodes[p]) - dist2(nodes[node], nodes[q]));
    if (!options.length) return null; // точку не подключить чисто — попытка в брак
    addEdge(node, rng.pick(options.slice(0, 3)));
    connected.push(node);
  }

  // 2. Немного дополнительных рёбер — дерево само по себе скучное.
  //    Берём из более коротких: они реже пересекают чужие линии.
  const free = candidates
    .filter(([a, b]) => !edgeSet.has(key(a, b)))
    .sort((p, q) => dist2(nodes[p[0]], nodes[p[1]]) - dist2(nodes[q[0]], nodes[q[1]]));
  const shortHalf = rng.shuffle(free.slice(0, Math.max(cfg.extra, Math.ceil(free.length / 2))));
  for (const [a, b] of shortHalf.slice(0, cfg.extra)) addEdge(a, b);

  // 3. Чиним чётность: спариваем нечётные вершины, пока их не станет <= 2.
  //    Добавить ребро предпочтительнее, чем убрать: удаление может разорвать граф
  //    или оставить точку вообще без рёбер — до неё игрок не дотянется.
  let odd = oddVertices(adj);
  let guard = 0;
  while (odd.length > 2 && guard++ < 100) {
    const [a, b] = [odd[0], odd[1]];
    const canDrop = edgeSet.has(key(a, b)) && adj[a].size > 1 && adj[b].size > 1;
    if (isClean(nodes, a, b) && !edgeSet.has(key(a, b))) addEdge(a, b);
    else if (canDrop) dropEdge(a, b);
    else break; // пара несовместима — попытку забракует финальная проверка
    odd = oddVertices(adj);
  }

  const edges = [...edgeSet].map((k) => k.split(',').map(Number));
  if (edges.length < 3) return null;
  if (adj.some((s) => s.size === 0)) return null; // точка без рёбер — недостижима
  if (!edgeConnected(adj)) return null;
  if (![0, 2].includes(oddVertices(adj).length)) return null;
  // Клубок из пересечений глазом не проследить. Порог растёт с размером фигуры,
  // но медленнее, чем само число рёбер.
  if (countCrossings(nodes, edges) > Math.ceil(edges.length * 0.35)) return null;

  return { nodes, edges };
}

/**
 * Строит уровень. Гарантирует решаемость: результат проверяется реальным
 * решателем, а не только условием чётности.
 *
 * @param {number} seed  — детерминирует уровень целиком
 * @param {number} levelIndex — номер уровня, задаёт сложность
 */
export function generateLevel(seed, levelIndex = 0) {
  const cfg = sizeFor(levelIndex);
  const target = targetDifficulty(levelIndex);

  let best = null;
  let bestMiss = Infinity;

  // Строим несколько кандидатов и берём того, чья реальная сложность ближе
  // к целевой. Один случайный граф даёт непредсказуемую трудность — отсюда
  // и брались «то тривиально, то невозможно» подряд идущие уровни.
  for (let tryNo = 0; tryNo < 70 && bestMiss > 0.04; tryNo++) {
    const rng = makeRng(seed + tryNo * 7919);
    const built = attempt(rng, cfg);
    if (!built) continue;
    const path = solve(built.nodes, built.edges);
    if (!path) continue;

    const diff = measureDifficulty(built.nodes, built.edges, makeRng(seed + tryNo));

    // Обучающие уровни проверяем перебором: выборочная оценка пропускает
    // редкие ловушки, а здесь недопустима ни одна.
    if (target === 0) {
      if (diff > 0 || hasDeadEnd(built.nodes, built.edges)) continue;
      return { ...built, path, seed, levelIndex, difficulty: 0 };
    }

    const miss = Math.abs(diff - target);
    if (miss < bestMiss) {
      bestMiss = miss;
      best = { ...built, path, seed, levelIndex, difficulty: diff };
    }
  }

  if (!best) throw new Error(`не удалось сгенерировать уровень seed=${seed} index=${levelIndex}`);
  return best;
}
