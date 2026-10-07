# -*- coding: utf-8 -*-
"""把 MV 的 124.46s 音轨和本工程 140.03s 音轨做包络互相关，测出两者的时间映射。
输出：out/align/window_map.txt（每个 MV 窗口在本工程音频里落在哪）+ 分段线性映射
"""
import os, wave, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
os.makedirs(os.path.dirname(OUR), exist_ok=True)

def load(path):
    with wave.open(path, "rb") as w:
        assert w.getsampwidth() == 2, "expect s16"
        n = w.getnframes()
        sr = w.getframerate()
        ch = w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr

mv, sr = load(MV)
our, sr2 = load(OUR)
assert sr == sr2 == 48000
print("MV  %.3f s   OUR %.3f s" % (len(mv) / sr, len(our) / sr))

HOP = 240          # 5 ms
def env(x):
    n = len(x) // HOP
    y = x[:n * HOP].reshape(n, HOP)
    e = np.sqrt((y * y).mean(axis=1) + 1e-12)
    return np.log1p(e * 100.0)

emv, eour = env(mv), env(our)
# 轻微平滑，抑制单帧抖动
k = np.ones(5) / 5.0
emv_s = np.convolve(emv, k, mode="same")
eour_s = np.convolve(eour, k, mode="same")

def local_norm(a):
    a = a - a.mean()
    s = a.std()
    return a / (s + 1e-9)

WIN = int(8.0 * sr / HOP)   # 8 s
STEP = int(1.0 * sr / HOP)  # 每 1 s 取一个窗口

rows = []
n_mv = len(emv_s)
for p in range(0, n_mv - WIN, STEP):
    w = local_norm(emv_s[p:p + WIN])
    # 用 FFT 做归一化互相关
    n = 1
    while n < len(eour_s) + len(w):
        n *= 2
    F = np.fft.rfft(eour_s - eour_s.mean(), n)
    G = np.fft.rfft(w[::-1], n)
    cc = np.fft.irfft(F * G, n)[:len(eour_s)]
    # 局部能量归一化（滚动标准差）
    win_energy = np.sqrt(np.convolve(eour_s ** 2, np.ones(WIN) / WIN, mode="same"))
    denom = win_energy[:len(cc)] * (np.sqrt((w ** 2).mean()) + 1e-9) * WIN
    score = cc / (denom + 1e-9)
    j = int(np.argmax(score))
    peak = float(score[j])
    second = float(np.sort(score)[-2])
    t_mv = p * HOP / sr
    t_our = j * HOP / sr
    rows.append((t_mv, t_our, peak, second, t_our - t_mv))

out = os.path.join(ROOT, "out", "align", "window_map.txt")
with open(out, "w", encoding="utf-8") as f:
    f.write("# t_mv(s)  t_our(s)  peak  second  delta(our-mv)\n")
    for r in rows:
        f.write("%8.3f  %8.3f  %6.3f  %6.3f  %+7.3f\n" % r)
        print("%8.3f -> %8.3f   peak=%.3f  delta=%+.3f" % (r[0], r[1], r[2], r[4]))

# 只保留可信峰
good = [r for r in rows if r[2] > 0.35]
print("\n可信窗口 %d / %d" % (len(good), len(rows)))
print("\n按 MV 时间的 delta 变化（斜率≈1 表示同速度连续段）：")
prev = None
for r in good:
    d = r[4]
    slope = "" if prev is None else "  局部斜率=%.3f" % ((d - prev[1]) / (r[0] - prev[0]) if r[0] != prev[0] else float("nan"))
    prev = (r[0], d)
    print("  mv %7.3f  delta %+7.3f%s" % (r[0], d, slope))
