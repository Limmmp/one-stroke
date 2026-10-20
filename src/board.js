/**
 * Состояние партии: какие рёбра уже обведены, где сейчас палец, что можно дальше.
 *
 * Отделено от отрисовки и ввода намеренно — эту логику можно проверить тестами
 * без браузера, а на неё завязано всё: победа, тупик, отмена, подсказка.
 */

const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

export function createBoard(level) {
  const adj = level.nodes.map(() => new Set());
  for (const [a, b] of level.edges) {
    adj[a].add(b);
    adj[b].add(a);
  }

  const degree = (i) => adj[i].size;
  const odd = level.nodes.map((_, i) => i).filter((i) => degree(i) % 2);

  return {
    level,
    adj,
    /**
     * Откуда разрешено начинать. Если нечётных вершин две — только они,
     * иначе уровень не решается. Это правило игрок не обязан знать, поэтому
     * старты подсвечиваются, а не оставляются на угадывание.
     */
    validStarts: odd.length === 2 ? odd : level.nodes.map((_, i) => i).filter((i) => degree(i) > 0),
    trail: [], // последовательность вершин
    used: new Set(), // ключи пройденных рёбер

    get current() {
      return this.trail.length ? this.trail[this.trail.length - 1] : -1;
    },
    get solved() {
      return this.used.size === this.level.edges.length;
    },
    get progress() {
      return this.level.edges.length ? this.used.size / this.level.edges.length : 0;
    },

    /** Есть ли ребро между вершинами и не пройдено ли оно. */
    canMove(to) {
      const from = this.current;
      if (from < 0) return false;
      return this.adj[from].has(to) && !this.used.has(key(from, to));
    },

    /** Начать с вершины. Возвращает false, если старт недопустим. */
    start(i) {
      if (this.trail.length || !this.validStarts.includes(i)) return false;
      this.trail.push(i);
      return true;
    },

    /** Пройти ребро до вершины to. */
    move(to) {
      if (!this.canMove(to)) return false;
      this.used.add(key(this.current, to));
      this.trail.push(to);
      return true;
    },

    /** Шаг назад. Отдельная кнопка + жест «провести обратно по линии». */
    undo() {
      if (this.trail.length < 2) {
        this.trail = [];
        return false;
      }
      const last = this.trail.pop();
      this.used.delete(key(this.current, last));
      return true;
    },

    reset() {
      this.trail = [];
      this.used.clear();
    },

    /** Куда можно пойти прямо сейчас. */
    moves() {
      const from = this.current;
      if (from < 0) return [];
      return [...this.adj[from]].filter((n) => !this.used.has(key(from, n)));
    },

    /**
     * Тупик: ходов нет, а рёбра остались. Важно ловить явно — молча замерший
     * уровень игрок принимает за баг и уходит.
     */
    get stuck() {
      return this.trail.length > 0 && !this.solved && this.moves().length === 0;
    },
  };
}

/**
 * Подсказка: следующий шаг по заранее посчитанному решению.
 * Работает, только если игрок пока идёт по нему — иначе предлагает начать заново
 * с правильного старта.
 */
export function hintFor(board) {
  const { path } = board.level;
  if (!path) return null;
  if (!board.trail.length) return { from: path[0], to: path[1] };
  // Ищем позицию в решении, совпадающую с текущим следом.
  const matches = board.trail.every((v, i) => path[i] === v);
  if (!matches) return null;
  const i = board.trail.length - 1;
  return i + 1 < path.length ? { from: path[i], to: path[i + 1] } : null;
}
