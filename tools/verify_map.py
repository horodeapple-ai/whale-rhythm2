# -*- coding: utf-8 -*-
"""精修并独立验证 MV->OUR 的时间偏移：
(a) 波形互相关（采样级）定偏移
(b) 用本工程实测节拍表交叉验证（ref 拍点 + offset 应命中我们的拍）
(c) 反向映射：我们音频多出来的开头是什么
(d) 人声带能量检验：映射后的歌词句首/句尾是否像真实起唱/收句
"""
import json, os, re, sys, wave
import numpy as np

def log(*a):
    print(*a, flush=True)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MV = os.path.join(ROOT, "out", "bili", "BV1C7h16jEHJ", "audio_42184804939.wav")
OUR = os.path.join(ROOT, "out", "align", "our_song_48k.wav")
SR = 48000
FINE = 15.061

def load(path):
    with wave.open(path, "rb") as w:
        n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr

mv, sr = load(MV)
our, _ = load(OUR)

def moving_avg(x, w):
    """cumsum 版滑动平均，O(n)。"""
    c = np.cumsum(np.insert(x.astype(np.float64), 0, 0.0))
    out = (c[w:] - c[:-w]) / w
    return out

def bandpass(x, lo, hi):
    """FFT 带通（零相位）。"""
    n = len(x)
    F = np.fft.rfft(x.astype(np.float64))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    F[(f < lo) | (f > hi)] = 0.0
    return np.fft.irfft(F, n)

def env_at_hop(x, hop):
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)

# ---------- (a) 波形互相关精修 ----------
log("[a] 波形互相关（10s 窗口，±0.25s 搜索，FFT）")
offs = []
for t_mv in [10.0, 20.0, 30.0, 45.0, 60.0, 75.0, 90.0, 105.0, 118.0]:
    i0 = int(t_mv * SR); i1 = i0 + 10 * SR
    if i1 > len(mv):
        continue
    seg = mv[i0:i1].astype(np.float64)
    seg = seg - seg.mean()
    c0 = int((t_mv + FINE) * SR)
    s0, s1 = c0 - int(0.25 * SR), c0 + int(0.25 * SR)
    if s1 + len(seg) > len(our):
        continue
    win = our[s0:s1 + len(seg)].astype(np.float64)
    n = 1
    while n < len(win) + len(seg):
        n *= 2
    cc = np.fft.irfft(np.fft.rfft(win, n) * np.conj(np.fft.rfft(seg, n)), n)
    cc = cc[len(seg) - 1:len(win)]
    nn = np.sqrt(np.convolve(win ** 2, np.ones(len(seg)), mode="valid") + 1e-9)
    score = cc / (nn * (np.linalg.norm(seg) + 1e-9))
    k = int(np.argmax(score))
    delta = (s0 + k) / SR - t_mv
    offs.append(delta)
    log("    mv %6.2f s  偏移 %+8.4f s  波形相关 %.4f" % (t_mv, delta, score[k]))
arr = np.array(offs)
log("    中位 %+0.4f s  散布 %.1f ms" % (np.median(arr), (arr.max() - arr.min()) * 1000))
DELTA = float(np.median(arr))
log("    ==> DELTA = %+0.4f s" % DELTA)

# ---------- (b) 交叉验证：实测节拍表 ----------
log("\n[b] 交叉验证：ref 拍点 + DELTA 是否命中本工程实测拍点")
src = open(os.path.join(ROOT, "src", "beat-data.mjs"), encoding="utf-8").read()
BD = json.loads(re.search(r'export const BEAT_DATA = (\{.*?\});', src, re.S).group(1))
our_beats = None; used = None
for k, v in BD.items():
    if isinstance(v, list) and v and isinstance(v[0], list) and len(v[0]) >= 2:
        our_beats = np.array([r[0] for r in v], dtype=float); used = k; break
    if isinstance(v, list) and v and isinstance(v[0], (int, float)):
        our_beats = np.array(v, dtype=float); used = k; break
log("    键=%s，实测拍点 %d 个，%.3f–%.3f s" % (used, len(our_beats), our_beats[0], our_beats[-1]))

ref = open(os.path.join(ROOT, "out", "ref-repo", "v2__src__song.js"), encoding="utf-8").read()
js = json.loads(ref[ref.index("{"):ref.rindex("}") + 1])
ref_beats = np.array(js["beats"], dtype=float)
def hit(b, label):
    b = b[(b > our_beats[0]) & (b < our_beats[-1])]
    d = np.array([np.min(np.abs(our_beats - x)) for x in b])
    log("    %-22s %4d 拍  中位 %5.1f ms   <30ms %3.0f%%   <50ms %3.0f%%" %
        (label, len(b), np.median(d) * 1000, (d < 0.03).mean() * 100, (d < 0.05).mean() * 100))
    return d
hit(ref_beats + DELTA, "TF+%.3f（本解）" % DELTA)
for w in (-2.0, -1.0, -0.5, 0.5, 1.0, 2.0):
    hit(ref_beats + DELTA + w, "对照 %+0.1f s" % w)

# ---------- (d) 人声带检验 ----------
log("\n[d] 人声带 200–4000Hz：映射后句首/句尾是否像真实起唱/收句")
bp = bandpass(our, 200.0, 4000.0)
HOP = int(0.005 * SR)
e = env_at_hop(bp, HOP)
e = moving_avg(e, int(0.25 / 0.005))          # 250ms 平滑
hop_t = HOP / SR
E = np.log1p(e * 1000.0)

lyr = js["lyrics"]
def rise(t, off):
    i = int((t + off) / hop_t)
    a = int(0.30 / hop_t)
    if i - a < 0 or i + a >= len(E):
        return None
    return float(E[i:i + a].mean() - E[i - a:i].mean())

starts = [l["t"] + DELTA for l in lyr]
ends = [l["end"] + DELTA for l in lyr]
for lab, off in [("本解", 0.0), ("-3s", -3.0), ("-2s", -2.0), ("-1s", -1.0), ("-0.5s", -0.5),
                 ("+0.5s", 0.5), ("+1s", 1.0), ("+2s", 2.0), ("+3s", 3.0)]:
    r = np.array([x for x in (rise(t, off) for t in starts) if x is not None])
    f = np.array([x for x in (rise(t, off) for t in ends) if x is not None])
    log("    偏移 %-6s 句首上升 %+8.4f（正 %3.0f%%）  句尾上升 %+8.4f（负 %3.0f%%）" %
        (lab, r.mean(), (r > 0).mean() * 100, f.mean(), (f < 0).mean() * 100))

rng = np.random.default_rng(7)
noise = np.array([x for x in (rise(float(t), 0.0) for t in rng.uniform(2.0, 138.0, 400)) if x is not None])
r0 = np.array([x for x in (rise(t, 0.0) for t in starts) if x is not None])
log("    随机时刻基线：均值 %+.4f 标准差 %.4f" % (noise.mean(), noise.std()))
log("    本解 z = %+.2f" % ((r0.mean() - noise.mean()) / (noise.std() / np.sqrt(len(r0)))))

# ---------- (c) 反向映射 ----------
log("\n[c] 我们音频 0–19s 反向匹配到 MV 的位置（看多出来的开头是什么）")
N, H = 2048, 1024
def feat(x):
    nf = (len(x) - N) // H + 1
    win = np.hanning(N).astype(np.float32)
    idx = np.arange(nf) * H
    F = np.empty((nf, N // 2 + 1), dtype=np.float32)
    for i, s in enumerate(idx):
        F[i] = np.abs(np.fft.rfft(x[s:s + N] * win))
    freqs = np.fft.rfftfreq(N, 1.0 / SR)
    ed = np.geomspace(60.0, 14000.0, 49)
    B = np.empty((nf, 48), dtype=np.float32)
    for b in range(48):
        s = (freqs >= ed[b]) & (freqs < ed[b + 1])
        B[:, b] = F[:, s].mean(axis=1) if s.any() else 0
    B = np.log1p(B * 50.0)
    B -= B.mean(axis=1, keepdims=True)
    return B / (np.linalg.norm(B, axis=1, keepdims=True) + 1e-9)
Xmv, Xour = feat(mv), feat(our)
hop = H / SR
for t0 in np.arange(0.0, 19.0, 1.5):
    k = min(int(t0 / hop), len(Xour) - 1)
    S = Xour[k] @ Xmv.T
    j = int(np.argmax(S))
    S2 = S.copy(); lo = max(0, j - int(2 / hop)); hi = min(len(S), j + int(2 / hop)); S2[lo:hi] = -9
    j2 = int(np.argmax(S2))
    log("    our %6.2f -> mv %7.3f (delta %+7.3f) sim=%.3f | 次优 mv %7.3f sim=%.3f" %
        (t0, j * hop, j * hop - t0, S[j], j2 * hop, S2[j2]))
log("    若 our = mv + %.3f：our 总长 %.3f 对应 mv %.3f（MV 总长 %.3f）" %
    (DELTA, len(our) / SR, len(our) / SR - DELTA, len(mv) / SR))
