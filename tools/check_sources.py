# -*- coding: utf-8 -*-
"""(1) MV 音轨/本工程音轨 的 mid/side 能量比（判断"中置=人声"这条路是否可行）
(2) 原曲投稿 BV1XbY66nEWr 的信息 + CC 字幕 + 音轨时长（独立歌词来源/我们音频的出处）
(3) 网易云搜《Let Me Go》看有没有带时间轴的 LRC
"""
import json, os, re, subprocess, urllib.parse, urllib.request, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
CK = None
p_ck = r"C:\Users\li\.zcode\workspace\default\video-distributor\engine\cookies\bilibili_main.json"
if os.path.exists(p_ck):
    m = re.search(r'SESSDATA["\']?\s*[:=]\s*["\']([^"\']+)', open(p_ck, encoding="utf-8", errors="replace").read())
    if m:
        CK = "SESSDATA=" + m.group(1)

def get(url, referer="https://www.bilibili.com/"):
    h = {"User-Agent": UA, "Referer": referer, "Accept": "application/json, text/plain, */*",
         "Accept-Language": "zh-CN,zh;q=0.9", "Origin": "https://www.bilibili.com"}
    if CK:
        h["Cookie"] = CK
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30).read()

# ---------- (1) mid/side ----------
log("[1] mid/side 能量比")
for name, p in [("MV 音轨", os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_stereo.wav")),
                ("本工程音轨", os.path.join(ROOT, "out", "align", "our_song_stereo.wav"))]:
    if not os.path.exists(p):
        log("    %s 不存在" % p); continue
    with wave.open(p, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
        a = a.reshape(-1, ch)
    if ch < 2:
        log("    %s：单声道" % name); continue
    L, R = a[:, 0], a[:, 1]
    mid, side = (L + R) / 2, (L - R) / 2
    lr = float(np.corrcoef(L, R)[0, 1])
    log("    %s：L/R 相关 %.4f   中置RMS %.5f  侧向RMS %.5f  侧/中 %.3f" %
        (name, lr, np.sqrt((mid ** 2).mean()), np.sqrt((side ** 2).mean()),
         np.sqrt((side ** 2).mean()) / (np.sqrt((mid ** 2).mean()) + 1e-12)))

# ---------- (2) 原曲投稿 ----------
log("\n[2] 原曲投稿 BV1XbY66nEWr")
try:
    v = json.loads(get("https://api.bilibili.com/x/web-interface/view?bvid=BV1XbY66nEWr").decode("utf-8", "replace"))
    log("    code=%s msg=%s" % (v.get("code"), v.get("message")))
    d = v.get("data") or {}
    if d:
        log("    title: %s" % d.get("title"))
        log("    owner: %s   时长: %s s" % ((d.get("owner") or {}).get("name"), d.get("duration")))
        log("    aid/cid: %s / %s" % (d.get("aid"), d.get("cid")))
        log("    pages: %s" % [(p.get("cid"), p.get("part"), p.get("duration")) for p in d.get("pages", [])])
        desc = d.get("desc") or ""
        log("    desc (%d 字) 前 1200 字：\n%s" % (len(desc), desc[:1200]))
        aid, cid = d.get("aid"), d.get("cid")
        pl = json.loads(get("https://api.bilibili.com/x/player/v2?aid=%s&cid=%s&bvid=BV1XbY66nEWr" % (aid, cid)).decode("utf-8", "replace"))
        sub = ((pl.get("data") or {}).get("subtitle") or {}).get("subtitles") or []
        log("    CC 字幕条目 %d" % len(sub))
        for s in sub:
            log("      lan=%s doc=%s url=%s" % (s.get("lan"), s.get("lan_doc"), str(s.get("subtitle_url"))[:120]))
except Exception as e:
    log("    失败: %r" % (e,))

# ---------- (3) 网易云 ----------
log("\n[3] 网易云搜索（独立 LRC 来源）")
try:
    q = urllib.parse.quote("罐装毕加索 Let Me Go")
    u = "https://music.163.com/api/search/get/web?s=%s&type=1&offset=0&limit=10" % q
    r = urllib.request.urlopen(urllib.request.Request(u, headers={
        "User-Agent": UA, "Referer": "https://music.163.com/",
        "Cookie": "appver=2.0.2; os=pc"}), timeout=25).read()
    j = json.loads(r.decode("utf-8", "replace"))
    songs = ((j.get("result") or {}).get("songs")) or []
    log("    命中 %d 首" % len(songs))
    for s in songs:
        log("      id=%s  %s — %s (%s)" % (s.get("id"), s.get("name"), ", ".join(a.get("name", "") for a in s.get("artists", [])), s.get("duration")))
    for s in songs[:3]:
        sid = s.get("id")
        try:
            lu = "https://music.163.com/api/song/lyric?id=%s&lv=1&kv=1&tv=-1" % sid
            lj = json.loads(urllib.request.urlopen(urllib.request.Request(lu, headers={
                "User-Agent": UA, "Referer": "https://music.163.com/", "Cookie": "appver=2.0.2; os=pc"}), timeout=25).read().decode("utf-8", "replace"))
            lrc = ((lj.get("lrc") or {}).get("lyric")) or ""
            log("      id=%s 歌词 %d 字，前 300 字：%s" % (sid, len(lrc), lrc[:300].replace("\n", " | ")))
        except Exception as e:
            log("      id=%s 歌词失败 %r" % (sid, e))
except Exception as e:
    log("    失败: %r" % (e,))
