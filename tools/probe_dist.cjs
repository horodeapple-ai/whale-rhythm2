const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const rows = [];
for (let i = 0; i < 8; i++) { const p = root + `/qa/audit_${i}.jsonl`; if (fs.existsSync(p)) rows.push(...fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))); }
rows.sort((a, b) => a.f - b.f);
const E = rows.filter(r => r.energy != null).map(r => r.energy).sort((a, b) => a - b);
const q = p => E[Math.floor(p * (E.length - 1))];
console.log('能量分位: P5', q(.05).toFixed(4), 'P10', q(.10).toFixed(4), 'P25', q(.25).toFixed(4), 'P50', q(.5).toFixed(4), 'P75', q(.75).toFixed(4), 'P90', q(.9).toFixed(4), 'P95', q(.95).toFixed(4), 'P99', q(.99).toFixed(4));
console.log('近静止帧(<0.003)占比', (E.filter(v => v < 0.003).length / E.length * 100).toFixed(1) + '%');
console.log('高能帧(>0.05)占比', (E.filter(v => v > 0.05).length / E.length * 100).toFixed(1) + '%');

const byShot = {}; for (const r of rows) { if (r.camS == null) continue; (byShot[r.shot] ||= []).push(r); }
let mono = 0, tot = 0; const rate = [];
for (const [id, rs] of Object.entries(byShot)) {
  if (rs.length < 5) continue; tot++;
  let inc = 0, dec = 0;
  for (let i = 1; i < rs.length; i++) { if (rs[i].camS > rs[i - 1].camS + 1e-6) inc++; else if (rs[i].camS < rs[i - 1].camS - 1e-6) dec++; }
  const net = rs.at(-1).camS - rs[0].camS, span = rs.at(-1).t - rs[0].t;
  if (span > 0) rate.push(Math.abs(net) / span);
  if (Math.abs(net) > 0.02 && (inc > rs.length * 0.7 || dec > rs.length * 0.7)) mono++;
}
console.log('镜头数(样本足够)', tot, ' 相机单向推近的镜头数', mono, '=', (mono / tot * 100).toFixed(0) + '%');
rate.sort((a, b) => a - b);
console.log('相机缩放速率 /秒: 中位', (rate[Math.floor(rate.length / 2)] * 100).toFixed(2) + '%/s', ' 最小', (rate[0] * 100).toFixed(2), ' 最大', (rate.at(-1) * 100).toFixed(2));

const shots = {};
for (const r of rows) { shots[r.shot] = shots[r.shot] || [Infinity, -Infinity]; shots[r.shot][0] = Math.min(shots[r.shot][0], r.f); shots[r.shot][1] = Math.max(shots[r.shot][1], r.f); }
const L = Object.values(shots).map(([a, b]) => b - a + 1).sort((a, b) => a - b);
console.log('镜头长度(帧) 中位', L[Math.floor(L.length / 2)], '最短', L[0], '最长', L.at(-1), '中位秒数', (L[Math.floor(L.length / 2)] / 30).toFixed(2));
const lsec = L.map(v => v / 30);
console.log('镜头: <1s', lsec.filter(v => v < 1).length, ' 1~1.5s', lsec.filter(v => v >= 1 && v < 1.5).length, ' 1.5~2.2s', lsec.filter(v => v >= 1.5 && v < 2.2).length, ' >=2.2s', lsec.filter(v => v >= 2.2).length);
