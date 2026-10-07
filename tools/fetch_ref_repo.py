# -*- coding: utf-8 -*-
"""列出并抓取 beidou070/let-me-go-code-mv 仓库里与歌词相关的文件。
输出到 out/ref-repo/ 下。
"""
import json, os, re, sys, urllib.request

REPO = "beidou070/let-me-go-code-mv"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out", "ref-repo")
os.makedirs(OUT, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

def get(url, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read()
    return b.decode("utf-8", "replace") if raw else json.loads(b.decode("utf-8", "replace"))

# 找到默认分支
info = get("https://api.github.com/repos/" + REPO)
branch = info.get("default_branch", "main")
print("repo:", info.get("full_name"), "branch:", branch, "size(KB):", info.get("size"))
print("desc:", (info.get("description") or "")[:200])

tree = get("https://api.github.com/repos/%s/git/trees/%s?recursive=1" % (REPO, branch))
paths = [(t["path"], t.get("size", 0)) for t in tree.get("tree", []) if t["type"] == "blob"]
print("文件数:", len(paths))
with open(os.path.join(OUT, "tree.txt"), "w", encoding="utf-8") as f:
    for p, s in paths:
        f.write("%9d  %s\n" % (s, p))
for p, s in paths:
    print("%9d  %s" % (s, p))

# 抓取候选文件（名字里带 lyric/song/lrc/sub/timeline，或小体积的 js/json/md）
KEEP = re.compile(r"(lyric|lrc|sub(title)?|song|timeline|beat|text)", re.I)
cands = [p for p, s in paths if KEEP.search(p) and s < 400000]
print("\n候选文件:", cands)
for p in cands:
    url = "https://raw.githubusercontent.com/%s/%s/%s" % (REPO, branch, urllib.parse.quote(p))
    try:
        txt = get(url, raw=True)
    except Exception as e:
        print("  失败", p, repr(e)); continue
    safe = p.replace("/", "__")
    with open(os.path.join(OUT, safe), "w", encoding="utf-8") as f:
        f.write(txt)
    print("  已存 %s (%d 字节) -> %s" % (p, len(txt), safe))
