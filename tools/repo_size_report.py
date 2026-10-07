# -*- coding: utf-8 -*-
"""统计 whale-rhythm2 各子目录大小与文件数，并列出可疑的"不该进仓库"的大文件/第三方素材。"""
import os

ROOT = r"C:\Users\li\.zcode\workspace\default\whale-rhythm2"

def walk_size(p):
    n = 0
    sz = 0
    for dirpath, _d, files in os.walk(p):
        for f in files:
            fp = os.path.join(dirpath, f)
            try:
                sz += os.path.getsize(fp); n += 1
            except OSError:
                pass
    return n, sz

def mb(x):
    return "%.1f MB" % (x / 1048576.0)

print("顶层目录：")
rows = []
for name in sorted(os.listdir(ROOT)):
    p = os.path.join(ROOT, name)
    if os.path.isdir(p):
        n, sz = walk_size(p)
        rows.append((sz, n, name + "/"))
    else:
        rows.append((os.path.getsize(p), 1, name))
rows.sort(reverse=True)
for sz, n, name in rows:
    print("  %-18s %9s  %5d 个文件" % (name, mb(sz), n))
total = sum(r[0] for r in rows)
print("  合计 %.1f MB" % (total / 1048576.0))

print("\n> 1MB 的文件（逐个看是否该进仓库）：")
big = []
for dirpath, dirs, files in os.walk(ROOT):
    if "node_modules" in dirpath or "\\.git" in dirpath:
        continue
    for f in files:
        fp = os.path.join(dirpath, f)
        try:
            s = os.path.getsize(fp)
        except OSError:
            continue
        if s > 1048576:
            big.append((s, os.path.relpath(fp, ROOT)))
big.sort(reverse=True)
for s, rel in big:
    print("  %9s  %s" % (mb(s), rel))
print("  共 %d 个大文件" % len(big))

print("\n第三方/许可相关文件：")
for dirpath, dirs, files in os.walk(ROOT):
    if "node_modules" in dirpath:
        continue
    for f in files:
        if any(k in f.upper() for k in ("LICENSE", "CREDIT", "NOTICE", "COPYING", "THIRD")):
            print("  " + os.path.relpath(os.path.join(dirpath, f), ROOT))
