# -*- coding: utf-8 -*-
"""判定 0.22s 到底是"我的偏移错了"还是"官方 LRC 首句偏早"：
分别测 MV 音轨 与 本工程音轨 在"静音缺口之后"的音乐起音精确时刻。
若 MV 起音 ≈ 0.355s（我们 15.42 − 15.065），则偏移正确、LRC 首句偏早；
若 MV 起音 ≈ 0.138s，则偏移需 +0.22s。
"""
import os, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000

def load(p):
    with wave.open(p, "rb") as w:
        n, ch = w.getnframes(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a

def bp(a, lo, hi):
    n = len(a)
    F = np.fft.rfft(a.astype(np.float64))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    F[(f < lo) | (f > hi)] = 0.0
    return np.fft.irfft(F, n)

def env_db(a, hop):
    h = int(hop * SR)
    m = len(a) // h
    e = np.sqrt((a[:m * h].reshape(m, h) ** 2).mean(axis=1) + 1e-14)
    return e, hop

def onset_scan(path, t0, t1, label, bands=((80, 4000), (1000, 6000))):
    x = load(path)
    seg = x[int(t0 * SR):int((t1 + 0.3) * SR)]
    log("\n=== %s（%.3f–%.3f s）===" % (label, t0, t1))
    for lo, hi in bands:
        e, hop = env_db(bp(seg, lo, hi), 0.002)
        # 用前 0.1s 的能量作噪声底
        base = np.median(e[:int(0.1 / hop)])
        thr = base * 4.0
        i = int(np.argmax(e > thr))
        t_on = t0 + i * hop
        db = 20 * np.log10(e + 1e-9)
        log("    带 %4d–%4d Hz：噪声底 %.1f dB → 首次超过底+12dB 的时刻 %.4f s"
            % (lo, hi, 20 * np.log10(base + 1e-9), t_on))
        # 打印 2ms 分辨率表（只打关键段）
        s = max(0, i - 60); e2 = min(len(db), i + 90)
        line = []
        for k in range(s, e2, 10):
            line.append("%.3f:%.0f" % (t0 + k * hop, db[k]))
        log("      " + "  ".join(line))

mv = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
our = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
onset_scan(mv, 0.0, 0.75, "MV 音轨：开头")
onset_scan(our, 15.05, 15.80, "本工程音轨：缺口之后（预测 15.065+0.138=15.203，若真起音 15.42 则 MV 应在 0.355）")
log("\n  判定：本工程起音 − MV 起音 = 真实偏移。与静音缺口给的 15.065 比较。")
