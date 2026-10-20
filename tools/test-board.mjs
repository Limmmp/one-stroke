/**
 * Тесты логики партии (board.js) — без браузера.
 *
 *     node tools/test-board.mjs
 */

import { generateLevel } from '../src/levelgen.js';
import { createBoard, hintFor } from '../src/board.js';

let failures = 0;
const check = (ok, msg) => {
  if (!ok) {
    failures++;
    console.log('  ПРОВАЛ: ' + msg);
  }
};

console.log('1. Уровень проходится по своему решению');
{
  let bad = 0;
  for (let i = 0; i < 500; i++) {
    const b = createBoard(generateLevel(2000 + i, i % 70));
    const path = b.level.path;
    if (!b.start(path[0])) { bad++; continue; }
    for (let k = 1; k < path.length; k++) {
      if (!b.move(path[k])) { bad++; break; }
    }
    if (!b.solved) bad++;
  }
  check(bad === 0, `не прошли по решению: ${bad}`);
  console.log(`   пройдено 500 уровней, сбоев: ${bad}`);
}

console.log('2. Старт разрешён только с допустимых точек');
{
  let wrong = 0;
  for (let i = 0; i < 300; i++) {
    const b = createBoard(generateLevel(7000 + i, i % 50));
    for (let n = 0; n < b.level.nodes.length; n++) {
      const fresh = createBoard(b.level);
      const ok = fresh.start(n);
      if (ok !== fresh.validStarts.includes(n)) wrong++;
    }
  }
  check(wrong === 0, `расхождений старта: ${wrong}`);
  console.log(`   расхождений: ${wrong}`);
}

console.log('3. Отмена возвращает ровно предыдущее состояние');
{
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const b = createBoard(generateLevel(4100 + i, 10 + (i % 40)));
    const path = b.level.path;
    b.start(path[0]);
    for (let k = 1; k < Math.min(4, path.length); k++) b.move(path[k]);
    const snapshot = { trail: [...b.trail], used: [...b.used].sort() };
    b.move(path[Math.min(4, path.length - 1)]);
    b.undo();
    const now = { trail: [...b.trail], used: [...b.used].sort() };
    if (JSON.stringify(snapshot) !== JSON.stringify(now)) bad++;
  }
  check(bad === 0, `отмена не восстановила состояние: ${bad}`);
  console.log(`   расхождений: ${bad}`);
}

console.log('4. Тупик определяется, а решённый уровень тупиком не считается');
{
  let falsePositive = 0;
  let found = 0;
  for (let i = 0; i < 400; i++) {
    const b = createBoard(generateLevel(6100 + i, 15 + (i % 45)));
    const path = b.level.path;
    b.start(path[0]);
    for (let k = 1; k < path.length; k++) b.move(path[k]);
    if (b.stuck) falsePositive++; // решён — значит не тупик

    // жадный случайный обход почти всегда упирается в тупик
    const g = createBoard(b.level);
    g.start(g.validStarts[0]);
    let guard = 0;
    while (!g.solved && g.moves().length && guard++ < 200) g.move(g.moves()[0]);
    if (g.stuck) found++;
  }
  check(falsePositive === 0, `решённый уровень посчитан тупиком: ${falsePositive}`);
  check(found > 0, 'тупик не встретился ни разу — детектор подозрительно молчит');
  console.log(`   ложных срабатываний: ${falsePositive}, реальных тупиков найдено: ${found}`);
}

console.log('5. Подсказка ведёт по решению');
{
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const b = createBoard(generateLevel(8100 + i, i % 60));
    let guard = 0;
    while (!b.solved && guard++ < 200) {
      const h = hintFor(b);
      if (!h) { bad++; break; }
      if (!b.trail.length) b.start(h.from);
      if (!b.move(h.to)) { bad++; break; }
    }
    if (!b.solved) bad++;
  }
  check(bad === 0, `подсказка не довела до решения: ${bad}`);
  console.log(`   сбоев: ${bad}`);
}

console.log(failures === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛОВ: ${failures}`);
process.exit(failures ? 1 : 0);
