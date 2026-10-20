/**
 * Проверка генератора уровней.
 *
 * Тут не «запустилось без ошибок», а проверка свойств, на которых держится
 * весь план проекта: решаемость, детерминированность, играбельность геометрии.
 *
 *     node tools/test-levelgen.mjs
 */

import { generateLevel, solve, sizeFor, targetDifficulty, hasDeadEnd } from '../src/levelgen.js';
import { makeRng, seedFromString } from '../src/rng.js';

let failures = 0;
const check = (ok, msg) => {
  if (!ok) {
    failures++;
    console.log('  ПРОВАЛ: ' + msg);
  }
};

/** Независимая проверка пути: обходит все рёбра ровно по разу и связен по шагам. */
function pathIsValid(nodes, edges, path) {
  if (!path || path.length !== edges.length + 1) return false;
  const pool = new Map();
  for (const [a, b] of edges) {
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    pool.set(k, (pool.get(k) || 0) + 1);
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    if (!pool.get(k)) return false; // такого ребра нет или оно уже пройдено
    pool.set(k, pool.get(k) - 1);
  }
  return [...pool.values()].every((n) => n === 0);
}

/** Лежит ли какая-нибудь точка ровно на ребре — визуально это нечитаемо. */
function hasNodeOnEdge(nodes, edges) {
  for (const [i, j] of edges) {
    for (let k = 0; k < nodes.length; k++) {
      if (k === i || k === j) continue;
      const a = nodes[i];
      const b = nodes[j];
      const c = nodes[k];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross !== 0) continue;
      const dot = (c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y);
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (dot > 0 && dot < len2) return true;
    }
  }
  return false;
}

/** Пересечения рёбер: много — значит фигуру не проследить глазом. */
function countCrossings(nodes, edges) {
  const side = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  let n = 0;
  for (let p = 0; p < edges.length; p++) {
    for (let q = p + 1; q < edges.length; q++) {
      const [a, b] = edges[p];
      const [c, d] = edges[q];
      if (a === c || a === d || b === c || b === d) continue;
      const [A, B, C, D] = [nodes[a], nodes[b], nodes[c], nodes[d]];
      if (side(A, B, C) * side(A, B, D) < 0 && side(C, D, A) * side(C, D, B) < 0) n++;
    }
  }
  return n;
}

console.log('1. Решаемость и геометрия на 2000 уровнях');
{
  const edgeCounts = [];
  let onEdge = 0;
  let unsolvable = 0;
  let dup = 0;
  let isolated = 0;
  let tangled = 0;

  for (let i = 0; i < 2000; i++) {
    const lvl = generateLevel(1000 + i, i % 80);
    if (!pathIsValid(lvl.nodes, lvl.edges, lvl.path)) unsolvable++;
    if (hasNodeOnEdge(lvl.nodes, lvl.edges)) onEdge++;

    // Точка без единого ребра недостижима — игрок видит цель, которую не взять.
    const deg = lvl.nodes.map(() => 0);
    for (const [a, b] of lvl.edges) {
      deg[a]++;
      deg[b]++;
    }
    if (deg.some((d) => d === 0)) isolated++;
    if (countCrossings(lvl.nodes, lvl.edges) > Math.ceil(lvl.edges.length * 0.35)) tangled++;

    const seen = new Set();
    for (const [a, b] of lvl.edges) {
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (seen.has(k)) dup++;
      seen.add(k);
    }
    edgeCounts.push(lvl.edges.length);
  }

  check(unsolvable === 0, `нерешаемых уровней: ${unsolvable}`);
  check(onEdge === 0, `уровней с точкой на ребре: ${onEdge}`);
  check(dup === 0, `дублирующихся рёбер: ${dup}`);
  check(isolated === 0, `уровней с изолированной точкой: ${isolated}`);
  check(tangled === 0, `уровней-клубков: ${tangled}`);
  console.log(`   решаемы: ${2000 - unsolvable}/2000, точек на рёбрах: ${onEdge}, дублей: ${dup}`);
  console.log(`   изолированных точек: ${isolated}, клубков: ${tangled}`);
  console.log(`   рёбер: min ${Math.min(...edgeCounts)}, max ${Math.max(...edgeCounts)}`);
}

console.log('2. Детерминированность (ежедневный уровень)');
{
  const a = generateLevel(seedFromString('2026-07-22'), 10);
  const b = generateLevel(seedFromString('2026-07-22'), 10);
  const c = generateLevel(seedFromString('2026-07-23'), 10);
  check(JSON.stringify(a) === JSON.stringify(b), 'один seed дал разные уровни');
  check(JSON.stringify(a) !== JSON.stringify(c), 'разные даты дали одинаковый уровень');
  console.log('   один seed -> один уровень: ' + (JSON.stringify(a) === JSON.stringify(b)));
}

console.log('3. Кривая сложности идёт за целевой');
{
  const rows = [0, 5, 15, 30, 50, 80].map((idx) => {
    const diffs = [];
    const edges = [];
    for (let i = 0; i < 120; i++) {
      const lvl = generateLevel(50000 + i * 13, idx);
      diffs.push(lvl.difficulty);
      edges.push(lvl.edges.length);
    }
    const avg = diffs.reduce((s, n) => s + n, 0) / diffs.length;
    const avgE = edges.reduce((s, n) => s + n, 0) / edges.length;
    return { idx, avg, avgE, target: targetDifficulty(idx) };
  });
  for (const r of rows) {
    console.log(`   уровень ${String(r.idx).padStart(2)}: сложность ${r.avg.toFixed(2)} ` +
      `(цель ${r.target.toFixed(2)}), рёбер ${r.avgE.toFixed(1)}`);
  }
  const maxMiss = Math.max(...rows.map((r) => Math.abs(r.avg - r.target)));
  check(maxMiss < 0.12, `сложность расходится с целевой на ${maxMiss.toFixed(2)}`);
  check(rows[0].avg < rows[5].avg, 'сложность не растёт по ходу игры');
}

console.log('4. Обучающие уровни провалить невозможно');
{
  let risky = 0;
  const edgeMax = [];
  for (let i = 0; i < 150; i++) {
    for (const idx of [0, 1, 2]) {
      const lvl = generateLevel(777 + i * 7, idx);
      // Перебором, а не выборкой: ни одного пути в тупик существовать не должно.
      if (lvl.difficulty > 0 || hasDeadEnd(lvl.nodes, lvl.edges)) risky++;
      edgeMax.push(lvl.edges.length);
    }
  }
  check(risky === 0, `обучающих уровней с шансом тупика: ${risky}`);
  console.log(`   уровни 1-3: тупиков невозможно, рёбер до ${Math.max(...edgeMax)}`);
}

console.log('5. Генератор не падает на краях диапазона');
{
  let threw = 0;
  for (const idx of [0, 1, 5, 200, 1000]) {
    for (let s = 0; s < 60; s++) {
      try {
        generateLevel(s * 31 + 5, idx);
      } catch {
        threw++;
      }
    }
  }
  check(threw === 0, `исключений: ${threw}`);
  console.log('   исключений: ' + threw);
}

console.log(failures === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures ? 1 : 0);
