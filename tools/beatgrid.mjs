/* 从 assets/song.m4a 重测节拍网格（BPM + 相位），复核工程常量
 * 方法：一阶低通取"低频（踢鼓）"频带 → 分帧能量 → 起音包络 → 自相关定周期 →
 *       起音时刻的圆周均值定相位 → 对工程常量做命中率/漂移体检。
 * 用法: node tools/beatgrid.mjs [--bpm=128.35] [--phase=0.264]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const FF = args.ffmpeg || 'ffmpeg';
const SR = 22050, HOP = 220; // 100 Hz envelope (10 ms)

const tmp = root + '/qa/.grid.pcm';
const r = spawnSync(FF, ['-v', 'error', '-y', '-i', root + '/assets/song.m4a', '-ac', '1', '-ar', String(SR), '-f', 's16le', tmp], { encoding: 'utf8' });
if (r.status !== 0) { console.error('ffmpeg 失败：', r.stderr || r.error?.message); process.exit(1); }
const pcm = fs.readFileSync(tmp);
const N = Math.floor(pcm.length / 2);
const DUR = N / SR;
console.log(`解码 ${DUR.toFixed(3)} s @ ${SR} Hz（hop ${(HOP / SR * 1000).toFixed(0)} ms）`);

// 低通（约 100 Hz）后做能量包络 → 正向差分 = 低频起音包络
let lp = 0; const a1 = 0.03, frames = [];
for (let i = 0; i < N; i += HOP) {
  let e = 0;
  for (let j = i; j < Math.min(i + HOP, N); j++) { const x = pcm.readInt16LE(j * 2) / 32768; lp += a1 * (x - lp); e += lp * lp; }
  frames.push(Math.sqrt(e / HOP));
}
const env = new Float64Array(frames.length);
for (let i = 1; i < frames.length; i++) env[i] = Math.max(0, frames[i] - frames[i - 1]);
const tOf = i => i * HOP / SR;

// ── 1) 自相关定周期（lag 0.30~1.30 s）
const maxLag = Math.round(1.30 * SR / HOP), minLag = Math.round(0.30 * SR / HOP);
let bestLag = 0, bestV = -1, vals = [];
for (let lag = minLag; lag <= maxLag; lag++) {
  let s = 0, n = 0;
  for (let i = 0; i + lag < env.length; i++) { s += env[i] * env[i + lag]; n++; }
  const v = s / n; vals.push(v);
  if (v > bestV) { bestV = v; bestLag = lag; }
}
// 在最佳 lag 附近做抛物线插值
const idx = bestLag - minLag;
const y0 = vals[idx - 1] || 0, y1 = vals[idx], y2 = vals[idx + 1] || 0;
const denom = (y0 - 2 * y1 + y2);
const sub = denom ? 0.5 * (y0 - y2) / denom : 0;
const period = (bestLag + sub) * HOP / SR;
console.log(`自相关最佳周期 ${period.toFixed(5)} s = ${(60 / period).toFixed(3)} BPM（lag ${bestLag}）`);

// ── 2) 低频起音候选（阈值 + 最小间隔 180ms）—— 仅作参考，判据用第 3/4 条
const onsets = [];
const thr = 0.0016;
let last = -9;
for (let i = 1; i < env.length - 1; i++) {
  if (env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > thr && tOf(i) - last > 0.18) { onsets.push(tOf(i)); last = tOf(i); }
}
console.log(`低频起音候选 ${onsets.length} 个（含贝斯等其他低频，仅作参考）`);

// 读随工程发布的 beats 数组做自洽性对照
const songSrc = fs.readFileSync(root + '/vendor/rich-song.js', 'utf8');
const beats = JSON.parse(songSrc.match(/"beats":\s*(\[[^\]]*\])/s)[1]);

// ── 3) 稳健判据 A：强起音（env > 均值+2σ）落在网格上的比例
const mean0 = env.reduce((a, b) => a + b, 0) / env.length;
const sd0 = Math.sqrt(env.reduce((a, b) => a + (b - mean0) ** 2, 0) / env.length);
const strong = [];
let lastS = -9;
for (let i = 1; i < env.length - 1; i++) {
  if (env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > mean0 + 2 * sd0 && tOf(i) - lastS > 0.12) { strong.push(tOf(i)); lastS = tOf(i); }
}
console.log(`强起音（>均值+2σ）${strong.length} 个`);

// ── 4) 稳健判据 B：踢鼓频带能量在"拍点"与"拍间（反拍）"上的对比
const BPM0 = Number(args.bpm ?? 128.35), PH0 = Number(args.phase ?? 0.264);
const TAU = Math.PI * 2, P0 = 60 / BPM0;
const at = t => env[Math.min(env.length - 1, Math.max(0, Math.round(t * SR / HOP)))] || 0;
let onBeat = [], offBeat = [], onDown = [];
for (let k = 0; ; k++) {
  const t = PH0 + k * P0; if (t > DUR - 0.1) break;
  let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, at(t + d * HOP / SR));
  if (k % 4 === 0) onDown.push(m); else onBeat.push(m);
  let om = 0; for (let d = -2; d <= 2; d++) om = Math.max(om, at(t + P0 / 2 + d * HOP / SR));
  offBeat.push(om);
}
const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
console.log(`踢鼓频带能量：正拍(1&3拍) ${avg(onBeat).toFixed(5)}  小节头(每4拍) ${avg(onDown).toFixed(5)}  反拍 ${avg(offBeat).toFixed(5)}`);
console.log(`→ 正拍/反拍 = ${(avg(onBeat) / avg(offBeat)).toFixed(2)}×   小节头/反拍 = ${(avg(onDown) / avg(offBeat)).toFixed(2)}×   （>1.3 才算网格真的对上鼓点）`);

const report = (bpm, ph, name) => {
  const P = 60 / bpm;
  const errs = strong.map(t => { const k = Math.round((t - ph) / P); return (t - (ph + k * P)) * 1000; });
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const hit = abs.filter(e => e <= 45).length;
  const d1 = errs.slice(0, 40).reduce((a, b) => a + b, 0) / Math.min(40, errs.length);
  const d2 = errs.slice(-40).reduce((a, b) => a + b, 0) / Math.min(40, errs.length);
  console.log(`\n【${name}】BPM=${bpm} phase=${ph}  每拍 ${(P * 30).toFixed(4)} 帧`);
  console.log(`  强起音命中 ≤45ms：${hit}/${strong.length} = ${(hit / strong.length * 100).toFixed(0)}%   中位 ${abs[Math.floor(abs.length / 2)].toFixed(0)}ms`);
  console.log(`  系统漂移：前 40 个 ${d1.toFixed(0)}ms → 后 40 个 ${d2.toFixed(0)}ms（差 ${(d2 - d1).toFixed(0)}ms）`);
};

// ── 5) 校验：工程常量 vs 随工程发布的 beats 数组（自洽性，最重要的一条）
let maxOff = 0, sumOff = 0;
for (const b of beats) { const k = Math.round((b - PH0) / P0); const e = Math.abs((b - (PH0 + k * P0)) * 30); maxOff = Math.max(maxOff, e); sumOff += e; }
console.log(`\n【自洽性】随工程发布的 ${beats.length} 个 beats 相对固定点阵(BPM=${BPM0}/PHASE=${PH0})：最大差 ${maxOff.toFixed(3)} 帧，平均 ${(sumOff / beats.length).toFixed(3)} 帧`);
report(BPM0, PH0, '工程常量');
// 对照：把相位挪半拍/挪 1/4 拍，命中率应明显下降（证明"31%"这个数是网格真的对上，而不是随便都能中）
for (const off of [0.25, 0.5, 0.75]) report(BPM0, +(PH0 + P0 * off).toFixed(4), `对照·相位偏 ${off} 拍`);
fs.unlinkSync(tmp);


