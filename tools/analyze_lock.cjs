/* 更贴近"人眼读到律动"的指标：
 *  A. 运动能量局部峰值的【相位直方图】——峰值是否会集中在拍点
 *  B. 梳状锁拍强度 lock = mean(E@beat - E@localbase) / std
 *  C. 每拍"可见事件"覆盖率：该拍附近是否有比邻域明显的变化
 *  D. 各段（副歌/间奏）分档统计
 * 用法: node tools/analyze_lock.cjs [--json]
 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const songSrc = fs.readFileSync(root + '/vendor/rich-song.js', 'utf8');
const bpm = Number(songSrc.match(/"bpm":\s*([\d.]+)/)[1]);
const beats = JSON.parse(songSrc.match(/"beats":\s*(\[[^\]]*\])/s)[1]);
const SPB = 60 / bpm;

const rows = [];
const DIR = (process.argv.find(a => a.startsWith('--dir=')) || '--dir=qa/before').slice(6);
for (let i = 0; i < 8; i++) {
  const p = root + `/${DIR}/audit_${i}.jsonl`;
  if (fs.existsSync(p)) rows.push(...fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
}
console.log(`【数据源】${DIR}  帧数 ${rows.length}`);
rows.sort((a, b) => a.f - b.f);
const E = new Array(4201).fill(null);
for (const r of rows) E[r.f] = r.energy;
// 补空
for (let i = 1; i < 4201; i++) if (E[i] == null) E[i] = E[i - 1];
for (let i = 4199; i >= 0; i--) if (E[i] == null) E[i] = E[i + 1];
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// A. 局部峰值相位
const peaks = [];
for (let i = 4; i < 4197; i++) {
  const w = E.slice(i - 4, i + 5);
  if (E[i] === Math.max(...w) && E[i] > med(E.slice(Math.max(0, i - 30), i + 30)) * 1.35) peaks.push(i);
}
const phaseHist = new Array(8).fill(0);
for (const f of peaks) {
  const t = f / 30;
  const n = (t - beats[0]) / SPB;
  let ph = n - Math.round(n);            // -0.5..0.5
  if (ph < 0) ph += 1;                   // 0..1
  phaseHist[Math.min(7, Math.floor(ph * 8))]++;
}
console.log(`【A】运动峰值 ${peaks.length} 个，相位分布（每格 1/8 拍，0 = 正拍）:`);
console.log('   ', phaseHist.map((v, i) => `${i}:${(v / peaks.length * 100).toFixed(0)}%`).join('  '));
const inQuarter = (phaseHist[0] + phaseHist[7]) / peaks.length;
console.log(`    落在 ±1/8 拍内的比例 ${(inQuarter * 100).toFixed(1)}%（均匀分布应为 25%）`);

// B. 梳状锁拍强度
let num = 0, den = 0, base = [];
for (const t of beats) {
  const f = Math.round(t * 30);
  if (f < 3 || f > 4197) continue;
  const local = [];
  for (let d = -8; d <= 8; d++) if (Math.abs(d) > 2) local.push(E[f + d]);
  const b = mean(local);
  base.push(b);
  num += Math.max(-b, (Math.max(E[f], E[f + 1], E[f + 2]) - b));
}
for (const b of base) den += (E.length ? 0 : 0);
const globalMean = mean(E);
const globalStd = Math.sqrt(mean(E.map(v => (v - globalMean) ** 2)));
console.log(`【B】梳状锁拍：拍点超出邻域基线的平均增量 ${(num / base.length * 1000).toFixed(2)}e-3，全片能量均值 ${(globalMean * 1000).toFixed(2)}e-3，标准差 ${(globalStd * 1000).toFixed(2)}e-3`);
console.log(`    lock = Δ/σ = ${((num / base.length) / globalStd).toFixed(3)}`);

// C. 每拍可见事件覆盖率
let covered = 0, total = 0, perSec = [];
for (const t of beats) {
  const f = Math.round(t * 30);
  if (f < 3 || f > 4197) continue;
  total++;
  const local = [];
  for (let d = -10; d <= 10; d++) if (Math.abs(d) > 2) local.push(E[f + d]);
  const b = mean(local), sd = Math.sqrt(mean(local.map(v => (v - b) ** 2))) || 1e-9;
  const hit = Math.max(E[f], E[f + 1], E[f + 2]);
  if ((hit - b) / sd > 0.8) covered++;
  perSec.push({ t, z: (hit - b) / sd });
}
console.log(`【C】拍点可见事件覆盖：${covered}/${total} = ${(covered / total * 100).toFixed(1)}%（判据：拍点能量 z>0.8）`);
const zSorted = perSec.map(p => p.z).sort((a, b) => a - b);
console.log(`    z 分布 中位 ${zSorted[Math.floor(zSorted.length / 2)].toFixed(2)}  P75 ${zSorted[Math.floor(zSorted.length * .75)].toFixed(2)}  P90 ${zSorted[Math.floor(zSorted.length * .9)].toFixed(2)}  最大 ${zSorted.at(-1).toFixed(2)}`);

// D. 分段（用 jiedan 方案的段落）
const SECTIONS = [['前奏', 0, 11.5], ['主歌', 11.5, 27], ['副歌1', 27, 44], ['scat', 44, 52], ['间奏A', 52, 68], ['间奏B', 68, 76], ['间奏C', 76, 108], ['回升', 108, 128.8], ['副歌终章', 128.8, 140.03]];
console.log('\n【D】分段：能量中位 / 拍点 z 中位 / 覆盖率');
for (const [name, a, b] of SECTIONS) {
  const seg = E.slice(Math.round(a * 30), Math.round(b * 30)).filter(v => v != null);
  const zs = perSec.filter(p => p.t >= a && p.t < b).map(p => p.z).sort((x, y) => x - y);
  const cov = zs.filter(z => z > 0.8).length / (zs.length || 1);
  console.log(`   ${name.padEnd(6)} ${((med(seg) || 0) * 1000).toFixed(1).padStart(6)}e-3   z中位 ${(zs.length ? zs[Math.floor(zs.length / 2)] : 0).toFixed(2).padStart(6)}   覆盖 ${(cov * 100).toFixed(0)}%`);
}

// E. 最长的"低压"区间（连续 2 秒能量低于全片中位）
let runStart = -1, runs = [];
for (let i = 0; i < 4201; i++) {
  if (E[i] < globalMean * 0.8) { if (runStart < 0) runStart = i; }
  else { if (runStart >= 0 && i - runStart >= 60) runs.push([runStart, i]); runStart = -1; }
}
console.log('\n【E】连续 ≥2 秒的低能量区间:', runs.map(([a, b]) => `${(a / 30).toFixed(1)}~${(b / 30).toFixed(1)}s(${((b - a) / 30).toFixed(1)}s)`).join('  ') || '无');

// F. 相机在拍点上的位移幅度
const camPunch = [];
for (const t of beats) {
  const f = Math.round(t * 30);
  const r = rows.find(x => x.f === f);
  if (!r) continue;
  const before = rows.find(x => x.f === f - 3), after = rows.find(x => x.f === f + 3);
  if (!before || !after) continue;
  camPunch.push(Math.abs(after.camS - before.camS));
}
const cpS = camPunch.sort((a, b) => a - b);
console.log(`\n【F】拍点前后 3 帧相机缩放变化：中位 ${(cpS[Math.floor(cpS.length / 2)] * 100).toFixed(2)}%  P90 ${(cpS[Math.floor(cpS.length * .9)] * 100).toFixed(2)}%  最大 ${(cpS.at(-1) * 100).toFixed(2)}%`);
console.log(`    变化 >1% 的拍点数 ${camPunch.filter(v => v > 0.01).length}/${camPunch.length}`);
