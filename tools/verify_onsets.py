# -*- coding: utf-8 -*-
"""定点验证：官方 LRC 的句首时间 + 我们的映射偏移，是否落在音频里真实的"起唱"时刻。
检查点：
  15.203 = 15.065 + 0.138  （第一句 "let me go～"，紧跟 15.125–15.175 的静音缺口之后）
   6.984 = 94.155 − 87.1707（前奏段第一句 "Ba-da-ba-doo"）
  17.245 = 15.065 + 2.180  （第二句 "I'm making the calls"）
  8.591  （前奏段第二句）
另外对照：静音缺口结束点 15.175、缺口起点 15.125。
输出：包络时间序列表（100ms 一格）与起音强度峰值位置。
"""
import json, os, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
SR = 48000

with wave.open(OUR, "rb") as w:
    n, ch = w.getnframes(), w.getnchannels()
    x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)

def bp(a, lo, hi):
    n = len(a)
    F = np.fft.rfft(a.astype(np.float64))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    F[(f < lo) | (f > hi)] = 0.0
    return np.fft.irfft(F, n)

def env(a, hop=0.01):
    h = int(hop * SR)
    m = len(a) // h
    return np.sqrt((a[:m * h].reshape(m, h) ** 2).mean(axis=1) + 1e-14)

def sm(e, w):
    c = np.cumsum(np.insert(e, 0, 0.0))
    return (c[w:] - c[:-w]) / w

band = bp(x, 250, 4000)
e = sm(env(band), 5)          # 50ms 平滑
hop = 0.01

def table(t0, t1, marks, title):
    log("\n=== %s ===" % title)
    log("     时间    250–4000Hz包络(dB)   标记")
    i0, i1 = int(t0 / hop), int(t1 / hop)
    for i in range(i0, i1):
        t = i * hop
        db = 20 * np.log10(e[i] + 1e-9)
        bar = "#" * max(0, int((db + 60) / 1.5))
        mk = ""
        for name, tm in marks:
            if abs(t - tm) < hop / 2:
                mk = "   <<< " + name
        log("    %7.3f   %+7.1f  %s%s" % (t, db, bar, mk))

table(14.90, 16.30, [("静音缺口起 15.125", 15.125), ("缺口止 15.175", 15.175),
                     ("预测起唱 15.203", 15.203), ("LRC 偏移对照 +0.1s", 15.303)], 
      "第一句 'let me go～'（预测 15.203 = 15.065 + 0.138）")
table(6.60, 7.60, [("预测起唱 6.984", 6.984), ("±0.2s", 7.184)], 
      "前奏段第一句 'Ba-da-ba-doo'（预测 6.984 = 94.155 − 87.1707）")

# 起音强度：局部最大值位置
log("\n=== 起音峰定位（包络一阶正差分的局部峰，取窗口内前 5 强）===")
for t0, t1, lab in [(14.95, 16.60, "第一句附近"), (6.60, 8.20, "前奏段第一句附近"),
                    (16.60, 18.10, "第二句附近"), (8.20, 9.60, "前奏段第二句附近")]:
    i0, i1 = int(t0 / hop), int(t1 / hop)
    d = np.diff(e[i0:i1])
    idx = np.argsort(d)[-5:][::-1]
    log("    %s（%0.2f–%0.2f）：" % (lab, t0, t1))
    for k in sorted(idx):
        log("       峰 %7.3f s  强度 %+.5f  (dB %+.1f)" % (t0 + k * hop, d[k], 20 * np.log10(e[i0 + k] + 1e-9)))
