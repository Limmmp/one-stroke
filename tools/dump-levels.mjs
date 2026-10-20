/** Выгружает уровни в JSON, чтобы отрисовать их превью. node tools/dump-levels.mjs */
import { writeFileSync } from 'fs';
import { generateLevel } from '../src/levelgen.js';

const out = [];
for (const idx of [0, 3, 8, 15, 25, 35, 45, 60]) {
  for (let n = 0; n < 3; n++) out.push(generateLevel(4242 + n * 101, idx));
}
writeFileSync(new URL('./levels.json', import.meta.url), JSON.stringify(out));
console.log(`выгружено уровней: ${out.length}`);
