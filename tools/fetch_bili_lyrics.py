# -*- coding: utf-8 -*-
"""拉取 B 站视频信息/字幕（CC）/简介，用于获取《Let Me Go》真实歌词时间轴。
用法：node 不需要；python fetch_bili_lyrics.py [BV号]
输出：out/bili/<bvid>/ 下的 view.json / player.json / subtitle_*.json / summary.txt
"""
import json, os, sys, time, urllib.request, urllib.error

BV = sys.argv[1] if len(sys.argv) > 1 else "BV1C7h16jEHJ"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out", "bili", BV)
os.makedirs(OUT, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HDRS = {
    "User-Agent": UA,
    "Referer": "https://www.bilibili.com/video/" + BV,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

def get(url, extra=None, binary=False):
    h = dict(HDRS)
    if extra:
        h.update(extra)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=25) as r:
        data = r.read()
    return data if binary else json.loads(data.decode("utf-8", "replace"))

def save(name, obj_or_bytes):
    p = os.path.join(OUT, name)
    with open(p, "wb") as f:
        if isinstance(obj_or_bytes, (bytes, bytearray)):
            f.write(obj_or_bytes)
        else:
            f.write(json.dumps(obj_or_bytes, ensure_ascii=False, indent=1).encode("utf-8"))
    return p

lines = []
def log(s):
    lines.append(str(s))
    print(s, flush=True)

# 1) 视频基本信息
try:
    view = get("https://api.bilibili.com/x/web-interface/view?bvid=" + BV)
except Exception as e:
    log("view API 失败: %r" % (e,)); view = None

aid = cid = None
if view and view.get("code") == 0:
    d = view["data"]
    aid, cid = d.get("aid"), d.get("cid")
    log("title   : %s" % d.get("title"))
    log("owner   : %s" % (d.get("owner") or {}).get("name"))
    log("duration: %s s" % d.get("duration"))
    log("aid/cid : %s / %s" % (aid, cid))
    log("pages   : %s" % [(p.get("cid"), p.get("part"), p.get("duration")) for p in d.get("pages", [])])
    desc = d.get("desc") or ""
    log("desc.len: %d" % len(desc))
    save("view.json", view)
    with open(os.path.join(OUT, "desc.txt"), "w", encoding="utf-8") as f:
        f.write(desc)
    log("---- desc 前 3000 字 ----")
    log(desc[:3000])
    log("---- desc 结束 ----")
else:
    log("view code: %s msg: %s" % ((view or {}).get("code"), (view or {}).get("message")))
    if view:
        save("view.json", view)

# 2) 字幕列表（CC）
subs = []
if aid and cid:
    try:
        pl = get("https://api.bilibili.com/x/player/v2?aid=%s&cid=%s&bvid=%s" % (aid, cid, BV))
        save("player.json", pl)
        sub = (pl.get("data") or {}).get("subtitle") or {}
        subs = sub.get("subtitles") or []
        log("字幕条目: %d" % len(subs))
        for s in subs:
            log("  lan=%s lan_doc=%s url=%s" % (s.get("lan"), s.get("lan_doc"), s.get("subtitle_url")))
    except Exception as e:
        log("player/v2 API 失败: %r" % (e,))

# 3) 下载每条字幕 JSON（按服务器时长的 .json 结尾才是完整字幕）
got = 0
for i, s in enumerate(subs):
    u = s.get("subtitle_url") or ""
    if not u:
        continue
    if u.startswith("//"):
        u = "https:" + u
    if not u.endswith(".json"):
        log("  跳过（非完整字幕，服务器端为 %s）: %s" % (u.split("?")[0].split("/")[-1], s.get("lan")))
        continue
    try:
        j = get(u)
        got += 1
        save("subtitle_%s.json" % (s.get("lan") or i), j)
        body = j.get("body") or []
        log("  已下载 lan=%s 条数=%d" % (s.get("lan"), len(body)))
        for b in body[:6]:
            log("    [%s - %s] %s" % (b.get("from"), b.get("to"), b.get("content")))
    except Exception as e:
        log("  字幕下载失败 lan=%s: %r" % (s.get("lan"), e))

# 4) 相关视频/合集信息（有时歌词在同 UP 的合集里）
try:
    arc = get("https://api.bilibili.com/x/web-interface/view/detail?bvid=" + BV)
    save("detail.json", arc)
except Exception as e:
    log("detail API 失败: %r" % (e,))

with open(os.path.join(OUT, "summary.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
log("== 输出目录: %s  字幕已下载: %d 条 ==" % (OUT, got))
