# -*- coding: utf-8 -*-
"""找出所有"画在气泡之外、但看起来像角色台词"的中文短句（txt(...) 直接调用）。
用于确认「角色每句话加喵~」的范围是否只覆盖 speech()。
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "align", "other_texts.txt")
# 抓 txt(g,'...' 以及 txt(g,"..." 的字面量
pat = re.compile(r"""txt\(g\s*,\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1""")
rows = []
for dirpath, _d, files in os.walk(os.path.join(ROOT, "src")):
    for fn in files:
        if not fn.endswith(".mjs"):
            continue
        p = os.path.join(dirpath, fn)
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        if rel.endswith("opening-sample.mjs"):
            continue                      # 该文件的 txt() 大量用于标题/卡面，先单独看
        for i, line in enumerate(open(p, encoding="utf-8"), 1):
            for m in pat.finditer(line):
                s = m.group(2)
                if re.search(r"[\u4e00-\u9fa5]", s):
                    rows.append((rel, i, s))
with open(OUT, "w", encoding="utf-8") as f:
    f.write("共 %d 处含中文的 txt()\n\n" % len(rows))
    for rel, i, s in rows:
        f.write("%-42s :%-4d  %s\n" % (rel, i, s))
print("共 %d 处 -> %s" % (len(rows), OUT))
