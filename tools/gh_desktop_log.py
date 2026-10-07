# -*- coding: utf-8 -*-
"""看 GitHub Desktop 日志尾部：确认它是否收到了我们那条 `github open <path>`。"""
import os

d = r"C:\Users\li\AppData\Roaming\GitHub Desktop\logs"
files = sorted((f for f in os.listdir(d) if f.endswith(".log")),
               key=lambda f: os.path.getmtime(os.path.join(d, f)), reverse=True)
for f in files[:1]:
    p = os.path.join(d, f)
    size = os.path.getsize(p)
    print("日志 %s（%.1f MB）" % (f, size / 1048576.0))
    with open(p, "rb") as fh:
        if size > 400_000:
            fh.seek(-400_000, os.SEEK_END)
            fh.readline()
        raw = fh.read()
    txt = raw.decode("utf-8", errors="replace")
    lines = [l for l in txt.splitlines() if l.strip()]
    print("尾部 %d 行中的最后 10 行：" % len(lines))
    for l in lines[-10:]:
        print("   " + l[:240])
    hits = [l for l in lines if "whale-rhythm2" in l or "addRepositories" in l or "UI: " in l]
    print("\n命中（路径/addRepositories/UI）%d 行，最后 8 行：" % len(hits))
    for l in hits[-8:]:
        print("   " + l[:240])
