# -*- coding: utf-8 -*-
"""公开仓库前的泄露体检：只扫 git 跟踪的文件（= 马上会公开的那些）。
检查：常见密钥/token/cookie、个人隐私线索、第三方素材文件。
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIT = os.path.join(ROOT, "tools", "git.cmd")

out = subprocess.run([GIT, "ls-files"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
files = [f for f in out.stdout.splitlines() if f.strip()]
print("跟踪文件 %d 个" % len(files))

PATTERNS = [
    ("疑似密钥/令牌", re.compile(r"(?i)\b(SESSDATA|bili_jct|access[_-]?token|api[_-]?key|secret[_-]?key|password|passwd|authorization\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,}|sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,})")),
    ("长随机串", re.compile(r"[A-Za-z0-9_\-]{40,}")),
    ("邮箱/手机", re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|\b1[3-9]\d{9}\b")),
    ("本机路径", re.compile(r"[A-Za-z]:\\Users\\[^\\\s]+")),
]
hits = {name: [] for name, _ in PATTERNS}
for f in files:
    p = os.path.join(ROOT, f.replace("/", os.sep))
    try:
        if os.path.getsize(p) > 2_000_000:
            continue
        txt = open(p, encoding="utf-8", errors="ignore").read()
    except OSError:
        continue
    for name, pat in PATTERNS:
        for m in pat.finditer(txt):
            s = m.group(0)
            if name == "本机路径" and s.count("\\") < 3:
                continue
            if name == "长随机串" and not re.search(r"[A-Za-z]", s) :
                continue
            line_no = txt[:m.start()].count("\n") + 1
            hits[name].append("%s:%d  %s" % (f, line_no, s[:80]))

for name, _ in PATTERNS:
    lst = hits[name]
    print("\n== %s：%d 处 ==" % (name, len(lst)))
    seen = set()
    for h in lst:
        key = h.split("  ")[0]
        if key in seen:
            continue
        seen.add(key)
        print("   " + h)
        if len(seen) >= 12:
            print("   …（同类只列前 12 个文件）")
            break

print("\n== 会被公开的第三方/大文件（>300KB 或已知第三方）==")
for f in files:
    p = os.path.join(ROOT, f.replace("/", os.sep))
    try:
        sz = os.path.getsize(p)
    except OSError:
        continue
    if sz > 300_000 or f.startswith("vendor/") or "/vendor/" in f or f.startswith("assets/"):
        print("   %8.1f KB  %s" % (sz / 1024.0, f))
