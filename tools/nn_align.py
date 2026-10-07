# -*- coding: utf-8 -*-
"""决定性检验：MV(124.46s) 与 本工程(140.03s) 是否同一次录音 + 精确时间映射。
方法：对数谱（mel-ish 频带）逐帧 L2 归一化 → 余弦相似 → 每个 MV 帧在 OUR 里找最相似帧（NN 场）。
输出：out/align/nn_map.txt
"""
import os, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
OUTD = os.path.join(ROOT, "out", "align")

def load(path):
    with wave.open(path, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr

def features(x, sr, N=2048, H=1024, bands=48):
    nf = (len(x) - N) // H + 1
    win = np.hanning(N).astype(np.float32)
    idx = np.arange(nf) * H
    F = np.empty((nf, N // 2 + 1), dtype=np.float32)
    for i, s in enumerate(idx):
        F[i] = np.abs(np.fft.rfft(x[s:s + N] * win))
    freqs = np.fft.rfftfreq(N, 1.0 / sr)
    # 对数间隔频带（60 Hz – 14 kHz）
    edges = np.geomspace(60.0, 14000.0, bands + 1)
    band = np.empty((nf, bands), dtype=np.float32)
    for b in range(bands):
        sel = (freqs >= edges[b]) & (freqs < edges[b + 1])
        band[:, b] = F[:, sel].mean(axis=1) if sel.any() else 0.0
    band = np.log1p(band * 50.0)
    band -= band.mean(axis=1, keepdims=True)
    nrm = np.linalg.norm(band, axis=1, keepdims=True) + 1e-9
    return band / nrm, H / sr

mv, sr = load(MV)
our, _ = load(OUR)
Xmv, hop = features(mv, sr)
Xour, _ = features(our, sr)
print("MV 帧 %d  OUR 帧 %d  hop=%.4fs  时长 MV %.3f OUR %.3f" %
      (len(Xmv), len(Xour), hop, len(mv) / sr, len(our) / sr))

# 分块 NN
best_j = np.empty(len(Xmv), dtype=np.int32)
best_s = np.empty(len(Xmv), dtype=np.float32)
sec_s = np.empty(len(Xmv), dtype=np.float32)
CH = 512
for a in range(0, len(Xmv), CH):
    b = min(a + CH, len(Xmv))
    S = Xmv[a:b] @ Xour.T                      # (chunk, our)
    j = np.argmax(S, axis=1)
    best_j[a:b] = j
    best_s[a:b] = S[np.arange(b - a), j]
    S[np.arange(b - a), j] = -9.0
    sec_s[a:b] = np.max(S, axis=1)

t_mv = np.arange(len(Xmv)) * hop
t_our = best_j * hop

# 1) 全局：delta 直方图
delta = t_our - t_mv
sel = slice(0, int(112.0 / hop))
print("\n[1] 每个 MV 帧的最佳匹配 delta 统计（0–112s 段）")
d = delta[sel]
print("    中位数 %.3f  均值 %.3f  标准差 %.3f  IQR %.3f…%.3f" %
      (np.median(d), d.mean(), d.std(), np.percentile(d, 25), np.percentile(d, 75)))
# 直方图峰值
hist, edges = np.histogram(d, bins=np.arange(d.min(), d.max() + 0.02, 0.01))
top = np.argsort(hist)[-6:][::-1]
print("    delta 直方图前几名（0.01s 桶）：")
for k in top:
    print("      delta=%+.2f s  %d 帧" % (edges[k] + 0.005, hist[k]))

# 2) 每 4s 打印映射与可信度
print("\n[2] 映射抽样（每 4s）：mv -> our, 相似度, 次优")
with open(os.path.join(OUTD, "nn_map.txt"), "w", encoding="utf-8") as f:
    f.write("# t_mv t_our delta sim second\n")
    for tt in np.arange(0, t_mv[-1], 4.0):
        k = int(tt / hop)
        k = min(k, len(Xmv) - 1)
        f.write("%8.3f %8.3f %+8.3f %.3f %.3f\n" % (t_mv[k], t_our[k], delta[k], best_s[k], sec_s[k]))
    for tt in np.arange(0, t_mv[-1], 4.0):
        k = min(int(tt / hop), len(Xmv) - 1)
        print("  mv %7.3f -> our %7.3f  delta %+7.3f  sim=%.3f (次优 %.3f)" %
              (t_mv[k], t_our[k], delta[k], best_s[k], sec_s[k]))

# 3) 用「整段窗口平均相似度」比较几个假设的 delta（窗口 6s，逐 2s 采样）
print("\n[3] 候选整体偏移的窗口平均相似度（越大越像）")
WIN = int(6.0 / hop)
for cand in [0.0, 15.573, 23.06, 23.065, 7.49, -7.49, 8.0, 39.5]:
    tot, cnt = 0.0, 0
    for t0 in np.arange(2.0, 110.0, 2.0):
        i0 = int(t0 / hop); i1 = i0 + WIN
        j0 = int((t0 + cand) / hop); j1 = j0 + WIN
        if j1 >= len(Xour) or i1 > len(Xmv):
            continue
        # 逐帧对角相似度平均（帧对齐）
        tot += float(np.sum(Xmv[i0:i1] * Xour[j0:j1]))
        cnt += (i1 - i0)
    print("    delta=%+8.3f  平均对角相似=%.4f  (%d 帧)" % (cand, tot / max(cnt, 1), cnt))

# 4) 反向：OUR 每帧找到 MV 的最佳匹配，看我们音频「多出来的」部分是什么
print("\n[4] OUR 每帧 -> MV 最佳匹配（找我们多出来的段）")
rev_best = np.empty(len(Xour), dtype=np.float32)
rev_j = np.empty(len(Xour), dtype=np.int32)
for a in range(0, len(Xour), CH):
    b = min(a + CH, len(Xour))
    S = Xour[a:b] @ Xmv.T
    j = np.argmax(S, axis=1)
    rev_j[a:b] = j
    rev_best[a:b] = S[np.arange(b - a), j]
for t0 in np.arange(0, len(our) / sr, 4.0):
    k = min(int(t0 / hop), len(Xour) - 1)
    print("  our %7.3f -> mv %7.3f  (delta %+7.3f)  sim=%.3f" %
          (t0, rev_j[k] * hop, rev_j[k] * hop - t0, rev_best[k]))
