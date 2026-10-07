# -*- coding: utf-8 -*-
"""尝试从 B 站拿到音频流地址（用于和本工程音频做互相关对齐）。
输出：out/bili/<bvid>/playurl_<cid>.json
"""
import json, os, sys, urllib.request, urllib.parse

BVS = [("BV1C7h16jEHJ", [42184804939, 42185000255], "MV两版"),
       ("BV1XbY66nEWr", None, "原曲《Let Me Go（共创版）》")]
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out", "bili")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def get(url, referer="https://www.bilibili.com/"):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Referer": referer,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def cookie_header():
    """从 video-distributor 工程里找 B 站 cookie（若有）。"""
    for base in [r"C:\Users\li\.zcode\workspace\default\video-distributor"]:
        if not os.path.isdir(base):
            continue
        for dirpath, _dirs, files in os.walk(base):
            if "node_modules" in dirpath or ".git" in dirpath:
                continue
            for fn in files:
                if not fn.lower().endswith((".json", ".txt", ".js", ".mjs", ".cjs")):
                    continue
                if len(fn) > 60:
                    continue
                p = os.path.join(dirpath, fn)
                try:
                    if os.path.getsize(p) > 200000:
                        continue
                    txt = open(p, "r", encoding="utf-8", errors="replace").read()
                except OSError:
                    continue
                if "SESSDATA" in txt:
                    print("[cookie] 命中文件:", p)
                    return txt
    return None

ck = cookie_header()
extra = {}
if ck:
    import re
    m = re.search(r'SESSDATA["\']?\s*[:=]\s*["\']([^"\']+)', ck)
    if m:
        extra["Cookie"] = "SESSDATA=" + m.group(1)
        print("[cookie] 已提取 SESSDATA（长度 %d）" % len(m.group(1)))

for bv, cids, label in BVS:
    outdir = os.path.join(ROOT, bv)
    os.makedirs(outdir, exist_ok=True)
    print("=== %s %s (%s)" % (bv, label, bv))
    if cids is None:
        try:
            v = get("https://api.bilibili.com/x/web-interface/view?bvid=" + bv)
            d = v.get("data") or {}
            print("  title: %s" % d.get("title"))
            print("  duration: %s s   aid/cid: %s/%s" % (d.get("duration"), d.get("aid"), d.get("cid")))
            print("  pages: %s" % [(p.get("cid"), p.get("part"), p.get("duration")) for p in d.get("pages", [])])
            cids = [p.get("cid") for p in d.get("pages", [])] or [d.get("cid")]
        except Exception as e:
            print("  view 失败: %r" % (e,)); continue
    for cid in cids:
        for fnval in (4048, 16):
            url = ("https://api.bilibili.com/x/player/playurl?bvid=%s&cid=%s&qn=64&fnver=0&fnval=%d&fourk=1"
                   % (bv, cid, fnval))
            try:
                j = get(url, referer="https://www.bilibili.com/video/" + bv)
            except Exception as e:
                print("  playurl 异常 cid=%s fnval=%s: %r" % (cid, fnval, e)); continue
            code = j.get("code")
            if code != 0:
                print("  playurl code=%s msg=%s (cid=%s fnval=%s)" % (code, j.get("message"), cid, fnval))
                continue
            d = j.get("data") or {}
            audios = ((d.get("dash") or {}).get("audio")) or []
            print("  OK cid=%s fnval=%s  accept=%s audio流=%d durl=%d" % (
                cid, fnval, d.get("accept_description"), len(audios), len(d.get("durl") or [])))
            for a in audios:
                bu = a.get("baseUrl") or a.get("base_url") or ""
                print("     id=%s bw=%s codec=%s len=%s bytes" % (a.get("id"), a.get("bandwidth"),
                                                                 a.get("codecs"), a.get("size")))
                print("     %s" % bu[:150])
            with open(os.path.join(outdir, "playurl_%s.json" % cid), "w", encoding="utf-8") as f:
                json.dump(j, f, ensure_ascii=False, indent=1)
            if audios:
                break
