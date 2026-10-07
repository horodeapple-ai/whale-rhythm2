# -*- coding: utf-8 -*-
"""匿名（不带任何凭据）验证仓库对全世界可见：文件树 + README 开头 + 关键源码文件。"""
import base64, json, urllib.request

API = "https://api.github.com/repos/horodeapple-ai/whale-rhythm2"
H = {"User-Agent": "anon-check"}

def get(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(API + path, headers=H), timeout=25))

info = get("")
print("仓库：%s" % info["full_name"])
print("  可见性：%s（private=%s）  fork 数：%s  star：%s" % (info["visibility"], info["private"], info["forks_count"], info["stargazers_count"]))
print("  默认分支：%s  最近推送：%s  大小：%s KB  协议：%s" % (info["default_branch"], info["pushed_at"], info["size"], info.get("license")))

tree = get("/git/trees/main?recursive=1")
files = [t for t in tree["tree"] if t["type"] == "blob"]
print("  公开文件数：%d（截断标记 %s）" % (len(files), tree.get("truncated")))
top = {}
for f in files:
    k = f["path"].split("/")[0]
    top[k] = top.get(k, 0) + 1
print("  按顶层目录：" + "  ".join("%s=%d" % (k, v) for k, v in sorted(top.items())))

for path in ["README.md", "CREDITS.md", "src/scene.mjs", "src/subtitles.mjs", ".gitignore"]:
    try:
        c = get("/contents/" + path)
        raw = base64.b64decode(c["content"])
        head = raw.decode("utf-8", "replace").splitlines()[:2]
        print("  ✅ %-20s %6d 字节  %s" % (path, len(raw), " / ".join(h.strip()[:60] for h in head)))
    except Exception as e:
        print("  ❌ %-20s %s" % (path, e))

# 不该出现的（确认没被公开）
for path in ["assets/song.m4a", "output/DeepSeek-Whale-Cutpaper-Full-Film.html", "node_modules"]:
    try:
        get("/contents/" + path)
        print("  ⚠️ %s 也在仓库里" % path)
    except Exception:
        print("  ✅ %s 未公开（符合预期）" % path)
