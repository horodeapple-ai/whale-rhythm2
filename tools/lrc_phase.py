# -*- coding: utf-8 -*-
"""(1) MV 音轨开头 200–2000Hz 是否有内容（判定"0.138 处到底有没有人声/乐器"）
(2) 官方 LRC 每句起点/终点落在"小节内第几拍"（用本工程实测拍表 + 段落小节锚点）
    —— 若集中在某几个拍位，说明 LRC 音乐上自洽；若散乱，说明它本身粗糙。
"""
import json, os, re, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
D_MAIN, D_INTRO = 15.065, 87.1707

def load(p):
    with wave.open(p, "rb") as w:
        n, ch = w.getnframes(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a

def bp(a, lo, hi):
    F = np.fft.rfft(a.astype(np.float64))
    f = np.fft.rfftfreq(len(a), 1.0 / SR)
    F[(f < lo) | (f > hi)] = 0.0
    return np.fft.irfft(F, len(a))

def env(a, hop=0.01):
    h = int(hop * SR)
    m = len(a) // h
    return np.sqrt((a[:m * h].reshape(m, h) ** 2).mean(axis=1) + 1e-14), hop

# ---------- (1) ----------
log("[1] MV 音轨开头各频段包络（每 20ms 一格，dB）")
x = load(MV)[:int(1.2 * SR)]
bands = [(60, 250), (250, 800), (800, 2500), (2500, 8000)]
envs = []
for lo, hi in bands:
    e, hop = env(bp(x, lo, hi))
    envs.append(e)
log("    时间   " + "  ".join("%6d-%-5d" % b for b in bands))
for k in range(0, int(0.9 / 0.01), 2):
    t = k * 0.01
    log("    %5.3f  " % t + "  ".join("%11.1f" % (20 * np.log10(envs[i][k] + 1e-9)) for i in range(4)))

# ---------- (2) ----------
log("\n[2] 官方 LRC 句首落在小节内的拍位")
src = open(os.path.join(ROOT, "src", "beat-data.mjs"), encoding="utf-8").read()
BD = json.loads(re.search(r'export const BEAT_DATA = (\{.*?\});', src, re.S).group(1))
beats = np.array(BD["beats"], dtype=float)
sections = BD["sections"]
log("    实测拍点 %d 个（%.3f–%.3f）" % (len(beats), beats[0], beats[-1]))

def bar_phase(t):
    """返回 (小节内拍位 0..4, 该小节的拍长秒数)"""
    for s in sections:
        if s["start"] <= t <= s["end"]:
            anchor = beats[s["barAnchor"]]
            # 从锚点起，每 4 拍一小节；找 t 之前最近的锚点+k*4
            idx = int(np.searchsorted(beats, t)) - 1
            if idx < 0:
                return None
            k = idx - s["barAnchor"]
            k4 = (k // 4) * 4
            i0 = s["barAnchor"] + k4
            if i0 < 0 or i0 + 4 >= len(beats):
                return None
            bl = beats[i0 + 4] - beats[i0]
            ph = (t - beats[i0]) / bl * 4.0
            return ph % 4.0, bl
    return None

lrc = open(os.path.join(ROOT, "out", "ref-repo", "netease_lrc.txt"), encoding="utf-8").read()
entries = []
for line in lrc.splitlines():
    m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\](.*)", line.strip())
    if not m:
        continue
    entries.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))

log("\n    句首（映射到本工程时间轴）：")
phs = []
for t, txt in entries:
    if not txt:
        continue
    to = t + D_MAIN
    r = bar_phase(to)
    if r is None:
        log("      %8.3f  %-46s  (段落外)" % (to, txt[:46])); continue
    ph, bl = r
    phs.append(ph)
    log("      %8.3f  %-46s  拍位 %.2f / 4   (小节 %.3f s)" % (to, txt[:46], ph, bl))
phs = np.array(phs)
log("\n    拍位直方图（0.25 拍一格）：")
h, e = np.histogram(phs, bins=np.arange(0, 4.01, 0.25))
for i, c in enumerate(h):
    if c:
        log("      %.2f–%.2f 拍：%s (%d)" % (e[i], e[i + 1], "#" * c, c))
log("    拍位与最近整拍的差：中位 %.3f 拍，平均 %.3f 拍" %
    (np.median(np.minimum(phs % 1, 1 - (phs % 1))), np.mean(np.minimum(phs % 1, 1 - (phs % 1)))))
