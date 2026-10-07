# -*- coding: utf-8 -*-
"""列出全片所有 speech(...) 气泡台词（UTF-8 输出，避免 cmd 乱码）。"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "align", "speech_lines.txt")
pat = re.compile(r"speech\(g\s*,\s*'((?:[^'\\]|\\.)*)'")
rows = []
for dirpath, _d, files in os.walk(os.path.join(ROOT, "src")):
    for fn in files:
        if not fn.endswith(".mjs"):
            continue
        p = os.path.join(dirpath, fn)
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        for i, line in enumerate(open(p, encoding="utf-8"), 1):
            for m in pat.finditer(line):
                rows.append((rel, i, m.group(1)))
with open(OUT, "w", encoding="utf-8") as f:
    f.write("共 %d 处 speech( )\n\n" % len(rows))
    for rel, i, t in rows:
        f.write("%-42s :%-4d  %s\n" % (rel, i, t))
        print("%-42s :%-4d  %s" % (rel, i, t))
print("-> " + OUT)
