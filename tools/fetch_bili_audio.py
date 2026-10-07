# -*- coding: utf-8 -*-
"""下载 B 站 MV 的音频流（用于和本工程 140.032s 音频做互相关/DTW 对齐）。
用法：python fetch_bili_audio.py BV1C7h16jEHJ 42184804939 42185000255
输出：out/bili/<bvid>/audio_<cid>.m4s -> audio_<cid>.wav (48k mono)
"""
import json, os, re, subprocess, sys, urllib.request

FF = r"C:\Users\li\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out", "bili")

CK = None
p_ck = r"C:\Users\li\.zcode\workspace\default\video-distributor\engine\cookies\bilibili_main.json"
if os.path.exists(p_ck):
    txt = open(p_ck, "r", encoding="utf-8", errors="replace").read()
    m = re.search(r'SESSDATA["\']?\s*[:=]\s*["\']([^"\']+)', txt)
    if m:
        CK = "SESSDATA=" + m.group(1)

def get(url, referer, headers=None):
    h = {"User-Agent": UA, "Referer": referer, "Accept": "*/*", "Accept-Language": "zh-CN,zh;q=0.9",
         "Origin": "https://www.bilibili.com"}
    if CK:
        h["Cookie"] = CK
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def playurl(bv, cid):
    u = ("https://api.bilibili.com/x/player/playurl?bvid=%s&cid=%s&qn=64&fnver=0&fnval=4048&fourk=1" % (bv, cid))
    j = json.loads(get(u, "https://www.bilibili.com/video/" + bv).decode("utf-8", "replace"))
    if j.get("code") != 0:
        raise RuntimeError("playurl code=%s msg=%s" % (j.get("code"), j.get("message")))
    audios = ((j["data"].get("dash") or {}).get("audio")) or []
    if not audios:
        raise RuntimeError("no audio streams")
    # 取码率最高的一条
    a = sorted(audios, key=lambda x: -(x.get("bandwidth") or 0))[0]
    return a.get("baseUrl") or a.get("base_url"), a.get("bandwidth")

bv = sys.argv[1] if len(sys.argv) > 1 else "BV1C7h16jEHJ"
cids = sys.argv[2:] or ["42184804939"]
outdir = os.path.join(ROOT, bv)
os.makedirs(outdir, exist_ok=True)

for cid in cids:
    try:
        url, bw = playurl(bv, cid)
    except Exception as e:
        print("cid=%s playurl 失败 %r" % (cid, e)); continue
    raw = os.path.join(outdir, "audio_%s.m4s" % cid)
    print("下载 cid=%s bw=%s ..." % (cid, bw), end="", flush=True)
    data = get(url, "https://www.bilibili.com/video/" + bv)
    with open(raw, "wb") as f:
        f.write(data)
    print(" %d 字节" % len(data))
    wav = os.path.join(outdir, "audio_%s.wav" % cid)
    subprocess.run([os.path.join(FF, "ffmpeg.exe"), "-v", "error", "-y", "-i", raw,
                    "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", wav], check=True)
    info = subprocess.run([os.path.join(FF, "ffprobe.exe"), "-v", "error", "-show_entries",
                           "format=duration", "-of", "default=nw=1:nk=1", wav],
                          capture_output=True, text=True).stdout.strip()
    print("  -> %s  时长 %s s" % (wav, info))
