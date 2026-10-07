# -*- coding: utf-8 -*-
"""分块跑逐帧扫错（每帧都渲染），避免单进程内存爆炸（原工程的渲染层有 ~25MB/帧 的
原生内存增长，与本次字幕改动无关：字幕开/关两份实测曲线完全一致）。

用法: python tools/sweep_all.py [--chunk=8] [--step=1]
"""
import os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = r"C:\Users\li\.zcode\workspace\default\dalabengba-repro\tools\node-v22.12.0-win-x64\node.exe"
DUR = 140.032
chunk = 8.0
step = 1
for a in sys.argv[1:]:
    if a.startswith("--chunk="):
        chunk = float(a.split("=")[1])
    elif a.startswith("--step="):
        step = int(a.split("=")[1])

t0 = time.time()
t = 0.0
total_frames = 0
bad = []
nchunk = 0
while t < DUR:
    t2 = min(DUR, t + chunk)
    nchunk += 1
    cmd = [NODE, "tools/render_sweep.mjs", "--from=%.4f" % t, "--to=%.4f" % t2, "--step=%d" % step]
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (p.stdout or "") + (p.stderr or "")
    m = re.search(r"渲染 (\d+) 帧", out)
    n = int(m.group(1)) if m else 0
    total_frames += n
    ok = "✅" in out
    if not ok:
        bad.append((t, t2, out.strip()[-500:]))
    print("[%2d] %6.1f–%6.1f s  %4d 帧  %s  (累计 %.1fs)"
          % (nchunk, t, t2, n, "OK" if ok else "❌", time.time() - t0), flush=True)
    t = t2

print("\n共 %d 个分块，%d 帧，耗时 %.1fs" % (nchunk, total_frames, time.time() - t0))
if bad:
    print("❌ 有 %d 个分块失败：" % len(bad))
    for a, b, o in bad:
        print("  %.1f–%.1f s: %s" % (a, b, o))
    sys.exit(1)
print("✅ 全片每一帧（step=%d）都渲染通过" % step)
