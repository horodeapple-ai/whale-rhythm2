/* 从音频里找"唱段"（人声段）：node tools/vocal_segments.cjs [--in=qa/song.pcm] [--fs=16000]
 * 做法：带通 300–3400Hz（两级 Butterworth）→ 40ms 窗/10ms 步 RMS → 平滑 → 双阈值滞后分段。 */
const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const IN = args.in || 'qa/song.pcm', FS = Number(args.fs || 16000);
const buf = fs.readFileSync(IN);
const n = buf.length >> 1;
const x = new Float64Array(n);
for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
// 双二阶 Butterworth 带通
function biquad(b0, b1, b2, a1, a2) {
  return (sig) => { const y = new Float64Array(sig.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < sig.length; i++) { const xi = sig[i]; const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi; } return y; };
}
const mk = (f0, hp) => { const w = 2 * Math.PI * f0 / FS, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Math.SQRT1_2);
  // 归一化后直接落到差分式 y = b0x+b1x1+b2x2 - a1y1 - a2y2 上：a1 = -2cos/a0、a2 = (1-al)/a0，都不要再翻符号
  return hp ? [ (1 + c) / 2, -(1 + c), (1 + c) / 2, -2 * c / (1 + al), (1 - al) / (1 + al) ]
            : [ (1 - c) / 2, 1 - c, (1 - c) / 2, -2 * c / (1 + al), (1 - al) / (1 + al) ]; };
const hp = mk(300, true), lp = mk(3400, false);
const y1 = biquad(hp[0], hp[1], hp[2], hp[3], hp[4])(x);
const y = biquad(lp[0], lp[1], lp[2], lp[3], lp[4])(y1);
// RMS 包络
const hop = Math.round(0.01 * FS), win = Math.round(0.04 * FS);
const frames = Math.floor(n / hop), env = new Float64Array(frames);
for (let f = 0; f < frames; f++) { let s = 0, c = 0; const a = Math.max(0, f * hop - win >> 1); const b = Math.min(n, a + win);
  for (let i = a; i < b; i++) { s += y[i] * y[i]; c++; } env[f] = Math.sqrt(s / Math.max(1, c)); }
// 平滑 120ms
const sm = new Float64Array(frames), K = 12;
for (let f = 0; f < frames; f++) { let s = 0, c = 0; for (let k = -K; k <= K; k++) { const i = f + k; if (i >= 0 && i < frames) { s += env[i]; c++; } } sm[f] = s / c; }
const sorted = [...sm].sort((a, b) => a - b);
const q = p => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
const floor = q(.25), peak = q(.97), hi = floor + .35 * (peak - floor), lo = floor + .20 * (peak - floor);
const segs = []; let on = false, start = 0, lastAbove = 0;
for (let f = 0; f < frames; f++) {
  const t = f * hop / FS;
  if (!on && sm[f] > hi) { on = true; start = t; lastAbove = t; }
  else if (on) { if (sm[f] > lo) lastAbove = t; else if (t - lastAbove > 0.18) { const e = lastAbove + 0.04; if (e - start >= 0.25) segs.push([start, e]); on = false; } }
}
if (on) segs.push([start, lastAbove + 0.04]);
console.log('阈值 hi=' + hi.toFixed(4) + ' lo=' + lo.toFixed(4) + ' (' + IN + ')');
console.log('段数 ' + segs.length);
for (const [a, b] of segs) console.log(a.toFixed(2) + ' – ' + b.toFixed(2) + '   (' + (b - a).toFixed(2) + 's)');
