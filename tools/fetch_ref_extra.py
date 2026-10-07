# -*- coding: utf-8 -*-
"""抓参考仓库里其余相关文件（karaoke / README / 歌词渲染代码）。"""
import os, urllib.parse, urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "ref-repo")
os.makedirs(OUT, exist_ok=True)
FILES = ["v2/compositions/karaoke.html", "v2/tools/karaoke.template.html", "v2/src/lib.js",
         "README.md", "v2/ANIMATION_GUIDE.md", "v2/STORYBOARD.md", "MEDIA.md", "USAGE.md",
         "v2/index.html"]
for p in FILES:
    u = "https://raw.githubusercontent.com/beidou070/let-me-go-code-mv/main/" + urllib.parse.quote(p)
    try:
        r = urllib.request.Request(u, headers={"User-Agent": UA})
        t = urllib.request.urlopen(r, timeout=30).read().decode("utf-8", "replace")
        fn = os.path.join(OUT, p.replace("/", "__"))
        with open(fn, "w", encoding="utf-8") as f:
            f.write(t)
        print("OK   %-38s %7d 字节 -> %s" % (p, len(t), os.path.basename(fn)))
    except Exception as e:
        print("FAIL %-38s %r" % (p, e))
