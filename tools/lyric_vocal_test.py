# -*- coding: utf-8 -*-
"""直接检验歌词时间轴与"人声起唱/收句"的关系。
特征：STFT → 沿时间中值滤波取谐波分量（HPSS 的谐波侧）→ 带限 250–4000Hz → 包络 →
      再除以 ±2s 局部中值（消除整曲电平漂移）。
统计量 S(delta) = 平均(句首上升) + 平均(句尾下降)，扫描 delta 看是否在 0 取极大。
先在 MV 音轨上标定（若参考时间轴正确，应在 delta≈0 出峰）。
"""
import json, os, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
SR = 48000
DELTA = 15.065
N, H = 2048, 480           # 10 ms hop

def load(path):
    with wave.open(path, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a

def harmonic_env(x):
    nf = (len(x) - N) // H + 1
    win = np.hanning(N).astype(np.float32)
    S = np.empty((nf, N // 2 + 1), dtype=np.float32)
    for i in range(nf):
        s = i * H
        S[i] = np.abs(np.fft.rfft(x[s:s + N] * win))
    # 谐波分量：沿时间轴中值滤波（宽度 ~ 0.2s = 20 帧）
    from numpy.lib.stride_tricks import sliding_window_view
    pad = 10
    Sp = np.pad(S, ((pad, pad), (0, 0)), mode="edge")
    Hh = np.median(sliding_window_view(Sp, 21, axis=0), axis=-1)   # (nf, bins)
    freqs = np.fft.rfftfreq(N, 1.0 / SR)
    sel = (freqs >= 250) & (freqs <= 4000)
    e = Hh[:, sel].sum(axis=1)
    return e, H / SR

def local_norm(e, w):
    pad = np.pad(e, (w, w), mode="edge")
    med = np.median(sliding_view(pad, 2 * w + 1), axis=-1) if False else None
    # 用 cumsum 做滑动中值太贵，改用滑动均值（对漂移同样有效）
    c = np.cumsum(np.insert(e.astype(np.float64), 0, 0.0))
    m = (c[2 * w:] - c[:-2 * w]) / (2 * w)
    m = np.pad(m, (w, w), mode="edge")[:len(e)]
    return e / (m + 1e-9)

def sliding_view(x, w):
    from numpy.lib.stride_tricks import sliding_window_view
    return sliding_window_view(x, w)

ref = open(os.path.join(ROOT, "out", "ref-repo", "v2__src__song.js"), encoding="utf-8").read()
js = json.loads(ref[ref.index("{"):ref.rindex("}") + 1])
lyr = js["lyrics"]

def score(E, hop, delta, lab=""):
    w = int(0.40 / hop)
    rises, falls = [], []
    for l in lyr:
        s = (l["t"] + delta) / hop
        e = (l["end"] + delta) / hop
        i, j = int(round(s)), int(round(e))
        if i - w < 0 or i + w >= len(E) or j - w < 0 or j + w >= len(E):
            continue
        rises.append(E[i:i + w].mean() - E[i - w:i].mean())
        falls.append(E[j - w:j].mean() - E[j:j + w].mean())
    if len(rises) < 20:
        return None
    return float(np.mean(rises)), float(np.mean(falls)), len(rises)

for name, path, base in [("MV 音轨（参考时间轴，delta 应≈0）", MV, 0.0),
                         ("本工程音轨（映射 +%.3f）" % DELTA, OUR, DELTA)]:
    log("\n=== %s ===" % name)
    x = load(path)
    e, hop = harmonic_env(x)
    E = local_norm(e, int(2.0 / hop))
    log("    包络帧数 %d（%.1f s）" % (len(E), len(E) * hop))
    rows = []
    for d in np.arange(-1.2, 1.201, 0.02):
        r = score(E, hop, base + d)
        if r:
            rows.append((d, r[0], r[1], r[0] + r[1]))
    rows.sort(key=lambda r: -r[3])
    log("    S = 句首上升 + 句尾下降，最大的 6 个偏移：")
    for d, a, b, s in rows[:6]:
        log("      delta %+6.2f s   句首上升 %+7.4f  句尾下降 %+7.4f  S=%+7.4f" % (d, a, b, s))
    log("    delta=0 附近：")
    for d, a, b, s in sorted(rows):
        if abs(d * 100 - round(d * 100)) < 1e-6 and abs(d) <= 0.4:
            log("      delta %+6.2f s   句首上升 %+7.4f  句尾下降 %+7.4f  S=%+7.4f" % (d, a, b, s))
