# -*- coding: utf-8 -*-
"""验证歌词时间轴是否真的对得上人声。
原理：人声通常居中，乐器有立体声宽度 → 以「中置分量 - 侧向分量」在 400–4000Hz 的包络当"人声存在度"。
统计量：S(delta) = 歌词区间内的平均人声度 - 器乐空档(86.76–94.155)内的平均人声度。
若歌词时间轴正确，S 应在 delta≈0 取极大。
同时对 MV 音轨 与 本工程音轨（映射 +15.065）各做一遍。
"""
import json, os, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")   # 下载的是单声道
MVST = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_stereo.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")                       # 单声道
OURST = os.path.join(ROOT, "out", "align", "our_song_stereo.wav")
SR = 48000
DELTA = 15.065

def load(path):
    with wave.open(path, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
        a = a.reshape(-1, ch)
    return a, sr, ch

def mono(p):
    a, sr, ch = load(p)
    return (a.mean(axis=1) if ch > 1 else a[:, 0]), sr

def bp(x, lo, hi, sr=SR):
    n = len(x)
    F = np.fft.rfft(x.astype(np.float64))
    f = np.fft.rfftfreq(n, 1.0 / sr)
    F[(f < lo) | (f > hi)] = 0.0
    return np.fft.irfft(F, n)

def env(x, hop=int(0.02 * SR)):
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)

def smooth(x, w):
    c = np.cumsum(np.insert(x.astype(np.float64), 0, 0.0))
    return (c[w:] - c[:-w]) / w

def vocalness(stpath, fallback):
    """返回 (人声度包络, 时间轴hop)"""
    if os.path.exists(stpath):
        a, sr, ch = load(stpath)
        if ch >= 2:
            mid = (a[:, 0] + a[:, 1]) / 2.0
            side = (a[:, 0] - a[:, 1]) / 2.0
            e_mid = env(bp(mid, 400, 4000))
            e_side = env(bp(side, 400, 4000))
            log("    （%s 用 mid/side）" % os.path.basename(stpath))
            return (e_mid - e_side), 0.02
    m, sr = mono(fallback)
    return env(bp(m, 400, 4000)), 0.02

# 准备立体声版本
import subprocess
FF = r"C:\Users\li\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
subprocess.run([FF, "-v", "error", "-y", "-i", os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.m4s"),
                "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", MVST], check=False)
subprocess.run([FF, "-v", "error", "-y", "-i", os.path.join(ROOT, "assets", "song.m4a"),
                "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", OURST], check=False)

ref = open(os.path.join(ROOT, "out", "ref-repo", "v2__src__song.js"), encoding="utf-8").read()
js = json.loads(ref[ref.index("{"):ref.rindex("}") + 1])
lyr = js["lyrics"]

def contrast(V, hop, delta, label):
    t = np.arange(len(V)) * hop
    inside = np.zeros(len(V), dtype=bool)
    for l in lyr:
        inside |= (t >= l["t"] + delta) & (t < l["end"] + delta)
    # 器乐空档：86.761–94.155（参考时间轴里唯一一段明确的无词段）
    gap = (t >= 86.761 + delta) & (t < 94.155 + delta)
    # 只在有分析价值的范围内统计（前奏/尾巴排除）
    valid = (t > 0.5) & (t < (len(V) * hop) - 0.5)
    Vi, Vg = V[inside & valid], V[gap]
    if len(Vi) < 50 or len(Vg) < 50:
        return None
    return float(Vi.mean() - Vg.mean()), float(Vi.mean()), float(Vg.mean())

for name, stp, fb, base_delta in [("MV 音轨", MVST, MV, 0.0),
                                 ("本工程音轨", OURST, OUR, DELTA)]:
    log("\n=== %s ===" % name)
    V, hop = vocalness(stp, fb)
    # 归一化（除以中位数，避免不同音轨电平差）
    Vn = V / (np.median(V) + 1e-12)
    log("    扫描歌词时间轴偏移（步长 20ms）：")
    best = None
    for d in np.arange(-2.0, 2.001, 0.04):
        r = contrast(Vn, hop, base_delta + d, name)
        if r is None:
            continue
        c, vi, vg = r
        if best is None or c > best[0]:
            best = (c, d)
        if abs(d * 100 - round(d * 100)) < 1e-6 and abs(d) <= 1.0:
            log("      Δ%+6.2f s  区间内 %6.3f  空档 %6.3f  对比 %+6.3f" % (d, vi, vg, c))
    log("    ==> 最佳偏移 Δ%+.2f s（对比度 %+.3f）" % (best[1], best[0]))
    for d, lab in [(0.0, "本解"), (-0.5, "-0.5s"), (0.5, "+0.5s"), (-1.0, "-1.0s"), (1.0, "+1.0s")]:
        r = contrast(Vn, hop, base_delta + d, name)
        if r:
            log("      对照 %-6s 对比 %+6.3f（内 %.3f / 空档 %.3f）" % (lab, r[0], r[1], r[2]))
