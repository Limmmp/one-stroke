# -*- coding: utf-8 -*-
"""Рисует сетку превью уровней в PNG — тесты не показывают, как уровень выглядит.

    node tools/dump-levels.mjs && python tools/preview_levels.py
"""
import json
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
levels = json.load(open(os.path.join(HERE, "levels.json"), encoding="utf-8"))

CELL = 190
PAD = 26
COLS = 6
rows = (len(levels) + COLS - 1) // COLS

img = Image.new("RGB", (COLS * CELL, rows * CELL), (16, 18, 30))
d = ImageDraw.Draw(img)

for n, lvl in enumerate(levels):
    ox = (n % COLS) * CELL
    oy = (n // COLS) * CELL
    nodes = lvl["nodes"]

    span = max(1, max(max(p["x"] for p in nodes), max(p["y"] for p in nodes)))
    inner = CELL - PAD * 2

    def place(p):
        return (ox + PAD + p["x"] / span * inner,
                oy + PAD + p["y"] / span * inner)

    for a, b in lvl["edges"]:
        d.line([place(nodes[a]), place(nodes[b])], fill=(96, 132, 220), width=3)

    for i, p in enumerate(nodes):
        x, y = place(p)
        r = 6
        # концы эйлерова пути (нечётные вершины) — другим цветом:
        # именно с них игрок обязан начинать, это должно читаться визуально
        deg = sum(1 for e in lvl["edges"] if i in e)
        col = (255, 210, 90) if deg % 2 else (225, 232, 255)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)

    d.text((ox + 8, oy + 6), "ур.%d  %d рёбер" % (lvl["levelIndex"], len(lvl["edges"])),
           fill=(140, 150, 180))

out = os.path.join(HERE, "..", "levels-preview.png")
img.save(out)
print(os.path.abspath(out))
