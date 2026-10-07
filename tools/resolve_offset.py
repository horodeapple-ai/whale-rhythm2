# -*- coding: utf-8 -*-
"""消除 0.88s 歧义：多项独立证据交叉定位 MV->OUR 的真实偏移。
 A) 本工程实测节拍表 vs 本工程音频（起音强度）：确认我们的拍点表可信
 B) 参考 song.js 的 beats vs MV 音频：确认参考的拍点表可信
 C) 精细对角线相似度扫描 delta ∈ [13.5, 17.5]
 D) 两段音频里的"数字静音缺口"地标（编辑点/停顿）
 E) 尾巴对齐：我们音频最后 2s 匹配到 MV 的哪里
 F) 头部对齐：我们音频 15–16.5s（假设的歌曲起点）匹配到 MV 的哪里
"""
import json, os, re, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
SR = 48000
N, H = 2048, 512
HOP_T = H / SR

def load(path):
    with wave.open(path, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr

mv, sr = load(MV)
our, _ = load(OUR)
log("MV %.3f s   OUR %.3f s" % (len(mv) / SR, len(our) / SR))

# ---------- 特征 & 起音强度 ----------
def logmel(x, bands=48):
    nf = (len(x) - N) // H + 1
    win = np.hanning(N).astype(np.float32)
    idx = np.arange(nf) * H
    F = np.empty((nf, N // 2 + 1), dtype=np.float32)
    for i, s in enumerate(idx):
        F[i] = np.abs(np.fft.rfft(x[s:s + N] * win))
    freqs = np.fft.rfftfreq(N, 1.0 / SR)
    ed = np.geomspace(50.0, 16000.0, bands + 1)
    B = np.empty((nf, bands), dtype=np.float32)
    for b in range(bands):
        s = (freqs >= ed[b]) & (freqs < ed[b + 1])
        B[:, b] = F[:, s].mean(axis=1) if s.any() else 0
    return np.log1p(B * 40.0)

def flux(L):
    d = np.diff(L, axis=0)
    f = np.maximum(d, 0).sum(axis=1)
    return f / (f.std() + 1e-9)

Lmv, Lour = logmel(mv), logmel(our)
Fmv, Four = flux(Lmv), flux(Lour)
log("帧数 MV %d  OUR %d（帧长 %.4f s）" % (len(Lmv), len(Lour), HOP_T))

def onset_ratio(F, times, label):
    """给定时间点，看起音强度相对随机基线的比值。"""
    i = np.clip((np.asarray(times) / HOP_T).astype(int), 1, len(F) - 2)
    peak = np.maximum.reduce([F[i - 1], F[i], F[i + 1]])
    rng = np.random.default_rng(3)
    base = np.array([F[np.clip(int(t / HOP_T), 1, len(F) - 1)] for t in rng.uniform(2.0, len(F) * HOP_T - 2, 3000)])
    log("    %-28s 拍点强度均值 %+.3f  随机基线 %+.3f  比值 %.2f×" %
        (label, peak.mean(), base.mean(), peak.mean() / (base.mean() + 1e-9)))

# ---------- A / B ----------
log("\n[A] 本工程实测节拍表 vs 本工程音频")
src = open(os.path.join(ROOT, "src", "beat-data.mjs"), encoding="utf-8").read()
BD = json.loads(re.search(r'export const BEAT_DATA = (\{.*?\});', src, re.S).group(1))
our_beats = None
for k, v in BD.items():
    if isinstance(v, list) and v and isinstance(v[0], list) and len(v[0]) >= 2:
        our_beats = np.array([r[0] for r in v], dtype=float); break
log("    拍点 %d 个（%.3f–%.3f s）" % (len(our_beats), our_beats[0], our_beats[-1]))
onset_ratio(Four, our_beats, "本工程拍点")
onset_ratio(Four, our_beats + 0.5 * 0.464, "拍点+半拍(反拍)")

ref = open(os.path.join(ROOT, "out", "ref-repo", "v2__src__song.js"), encoding="utf-8").read()
js = json.loads(ref[ref.index("{"):ref.rindex("}") + 1])
ref_beats = np.array(js["beats"], dtype=float)
log("\n[B] 参考 song.js beats vs MV 音频")
onset_ratio(Fmv, ref_beats, "参考拍点")
onset_ratio(Fmv, ref_beats + 0.5 * 0.464, "参考拍点+半拍")

# ---------- C 精细对角线扫描 ----------
log("\n[C] 精细对角线相似度扫描（mel 余弦，逐 1 帧 = %.4f s）" % HOP_T)
def unit(L):
    X = L - L.mean(axis=1, keepdims=True)
    return X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
Umv, Uour = unit(Lmv), unit(Lour)
best = []
for d0 in np.arange(13.5, 17.5001, HOP_T):
    i0 = max(0, int(-d0 / HOP_T))
    i1 = min(len(Umv), int((len(Uour) * HOP_T - d0) / HOP_T))
    if i1 - i0 < 100:
        continue
    idx = np.arange(i0, i1)
    j = np.clip((idx * HOP_T + d0) / HOP_T, 0, len(Uour) - 1).astype(int)
    s = float(np.mean(np.sum(Umv[idx] * Uour[j], axis=1)))
    best.append((d0, s))
best.sort(key=lambda x: -x[1])
log("    相似度最高的 8 个偏移：")
for d0, s in best[:8]:
    log("      delta %+8.4f s  平均相似度 %.4f" % (d0, s))
# 局部极大值一览（每 0.1s 一个点）
log("    每 0.1s 采样：")
for d0, s in sorted(best):
    if abs(d0 * 10 - round(d0 * 10)) < 1e-6:
        log("      delta %+7.3f  sim %.4f" % (d0, s))

# ---------- D 静音缺口地标 ----------
log("\n[D] 数字静音缺口（局部 RMS < 1e-4 连续 >= 20ms）")
def gaps(x, name):
    w = int(0.005 * SR)
    n = len(x) // w
    r = np.sqrt((x[:n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-20)
    quiet = r < 1e-4
    out = []
    i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * 0.005 >= 0.02:
                out.append((i * 0.005, (j - i) * 0.005))
            i = j
        else:
            i += 1
    log("    %s：%d 处" % (name, len(out)))
    for t, dur in out[:40]:
        log("      t=%8.3f s  时长 %.3f s" % (t, dur))
    return out
gaps(our, "OUR")
gaps(mv, "MV")

# ---------- E 尾巴对齐 ----------
log("\n[E] 我们音频最后 2s 匹配到 MV 的哪里")
for t0 in np.arange(len(our) / SR - 3.0, len(our) / SR - 1.0, 0.25):
    k = int(t0 / HOP_T)
    S = Uour[k] @ Umv.T
    j = int(np.argmax(S))
    log("    our %7.3f -> mv %7.3f (delta %+7.3f) sim=%.3f" % (t0, j * HOP_T, j * HOP_T - t0, S[j]))

# ---------- F 头部对齐 ----------
log("\n[F] 我们音频 14.5–18s 匹配到 MV 的哪里（假设的歌曲起点附近）")
for t0 in np.arange(14.5, 18.01, 0.25):
    k = int(t0 / HOP_T)
    S = Uour[k] @ Umv.T
    j = int(np.argmax(S))
    S2 = S.copy(); lo = max(0, j - int(2 / HOP_T)); hi = min(len(S), j + int(2 / HOP_T)); S2[lo:hi] = -9
    j2 = int(np.argmax(S2))
    log("    our %7.3f -> mv %7.3f (delta %+7.3f) sim=%.3f | 次优 mv %7.3f sim=%.3f" %
        (t0, j * HOP_T, j * HOP_T - t0, S[j], j2 * HOP_T, S2[j2]))
