# -*- coding: utf-8 -*-
"""(1) 抓 网易云 官方 LRC（含翻译 tlyric）→ out/ref-repo/netease_lrc.txt
(2) 与参考 song.js 的歌词逐句比对（时间与文本）
(3) 精修"前奏段"的映射偏移（our[0:14.5] 对应 mv[87.16:101.66]）
"""
import json, os, re, urllib.parse, urllib.request, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
SONGID = 3436937347

# ---------- (1) LRC ----------
u = "https://music.163.com/api/song/lyric?id=%s&lv=1&kv=1&tv=-1" % SONGID
raw = urllib.request.urlopen(urllib.request.Request(u, headers={
    "User-Agent": UA, "Referer": "https://music.163.com/", "Cookie": "appver=2.0.2; os=pc"}), timeout=30).read()
j = json.loads(raw.decode("utf-8", "replace"))
lrc = ((j.get("lrc") or {}).get("lyric")) or ""
tlyric = ((j.get("tlyric") or {}).get("lyric")) or ""
klyric = ((j.get("klyric") or {}).get("lyric")) or ""
log("[1] 官方 LRC：%d 字节  翻译(tlyric)：%d 字节  klyric(逐字)：%d 字节" % (len(lrc), len(tlyric), len(klyric)))
os.makedirs(os.path.join(ROOT, "out", "ref-repo"), exist_ok=True)
with open(os.path.join(ROOT, "out", "ref-repo", "netease_lrc.txt"), "w", encoding="utf-8") as f:
    f.write(lrc)
if tlyric:
    with open(os.path.join(ROOT, "out", "ref-repo", "netease_tlyric.txt"), "w", encoding="utf-8") as f:
        f.write(tlyric)
if klyric:
    with open(os.path.join(ROOT, "out", "ref-repo", "netease_klyric.txt"), "w", encoding="utf-8") as f:
        f.write(klyric)
log("    ---- LRC 全文 ----")
for l in lrc.splitlines():
    log("    " + l)

def parse_lrc(t):
    out = []
    for line in t.splitlines():
        m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)", line.strip())
        if not m:
            continue
        sec = int(m.group(1)) * 60 + float(m.group(2))
        txt = m.group(3).strip()
        out.append((sec, txt))
    return out

L = parse_lrc(lrc)
TL = parse_lrc(tlyric)
log("\n[2] 与参考 song.js 比对")
ref = open(os.path.join(ROOT, "out", "ref-repo", "v2__src__song.js"), encoding="utf-8").read()
js = json.loads(ref[ref.index("{"):ref.rindex("}") + 1])
sl = js["lyrics"]
log("    官方 LRC %d 条（含空行），song.js %d 条" % (len(L), len(sl)))
i = 0
mism = 0
for t, txt in L:
    if not txt:
        log("      [空行] %.3f" % t); continue
    if i >= len(sl):
        log("      !! 官方多出：%.3f %s" % (t, txt)); continue
    s = sl[i]
    dt = t - s["t"]
    same = (txt.replace("’", "'").replace("‘", "'").strip() == s["en"].replace("’", "'").replace("‘", "'").strip())
    flag = "OK " if (abs(dt) < 0.002 and same) else "差异"
    if flag != "OK ":
        mism += 1
    log("      %s %8.3f vs %8.3f (%+.3f)  %-46s | %s" % (flag, t, s["t"], dt, txt[:46], s["en"][:46]))
    i += 1
if i < len(sl):
    for s in sl[i:]:
        log("      !! song.js 多出：%.3f %s" % (s["t"], s["en"]))
log("    差异条数：%d" % mism)
if TL:
    log("\n    官方中文翻译（tlyric）前 12 条：")
    for t, txt in TL[:12]:
        log("      %8.3f  %s" % (t, txt))

# ---------- (3) 前奏段偏移精修 ----------
log("\n[3] 前奏段（our[0:14.5] ↔ mv[87.16:101.66]）偏移精修")
SR = 48000
N, H = 2048, 512
def load(p):
    with wave.open(p, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a

def feats(x):
    nf = (len(x) - N) // H + 1
    win = np.hanning(N).astype(np.float32)
    F = np.empty((nf, N // 2 + 1), dtype=np.float32)
    for i in range(nf):
        s = i * H
        F[i] = np.abs(np.fft.rfft(x[s:s + N] * win))
    freqs = np.fft.rfftfreq(N, 1.0 / SR)
    ed = np.geomspace(50.0, 16000.0, 49)
    B = np.empty((nf, 48), dtype=np.float32)
    for b in range(48):
        s = (freqs >= ed[b]) & (freqs < ed[b + 1])
        B[:, b] = F[:, s].mean(axis=1) if s.any() else 0
    B = np.log1p(B * 40.0)
    B -= B.mean(axis=1, keepdims=True)
    return B / (np.linalg.norm(B, axis=1, keepdims=True) + 1e-9)

mv = load(os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav"))
our = load(os.path.join(ROOT, "out", "align", "our_song_48k.wav"))
Uo, Um = feats(our), feats(mv)
hop = H / SR
rows = []
for d in np.arange(87.00, 87.301, hop):
    idx = np.arange(0, int(14.5 / hop))
    j = np.clip((idx * hop + d) / hop, 0, len(Um) - 1).astype(int)
    s = float(np.mean(np.sum(Uo[idx] * Um[j], axis=1)))
    rows.append((d, s))
rows.sort(key=lambda r: -r[1])
log("    前奏段相似度最高的 6 个偏移（our = mv - d）：")
for d, s in rows[:6]:
    log("      d(减法) %8.4f → our = mv − %.4f，平均相似度 %.4f" % (d, d, s))
