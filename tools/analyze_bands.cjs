/* 分带锁拍体检：把"画面哪一部分在跟着音乐动"量出来
 * 用法: node tools/analyze_bands.cjs --dir=qa/before
 * 判据：band 锁拍强度 = 拍点增量 / 该带标准差。越大越说明"这一带在跟拍"。
 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const DIR = (process.argv.find(a => a.startsWith('--dir=')) || '--dir=qa/before').slice(6);
const songSrc = fs.readFileSync(root + '/vendor/rich-song.js', 'utf8');
const bpm = Number(songSrc.match(/"bpm":\s*([\d.]+)/)[1]);
const beats = JSON.parse(songSrc.match(/"beats":\s*(\[[^\]]*\])/s)[1]);
const SPB = 60 / bpm;

const rows = [];
for (let i = 0; i < 8; i++) {
  const p = root + `/${DIR}/audit_${i}.jsonl`;
  if (fs.existsSync(p)) rows.push(...fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
}
rows.sort((a, b) => a.f - b.f);
const byF = new Map(rows.map(r => [r.f, r]));
const NAMES = ['0 顶部 吊灯/工单卡', '1 中上 窗户/屏幕', '2 中下 角色上半', '3 底部 角色下半/地板'];
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

console.log(`【数据源】${DIR}  帧数 ${rows.length}`);
function lockOf(pick, label) {
  const vals = rows.map(pick).filter(v => v != null);
  const mu = mean(vals);
  const sd = Math.sqrt(mean(vals.map(v => (v - mu) ** 2))) || 1e-9;
  let num = 0, n = 0, cov = 0;
  for (const t of beats) {
    const f = Math.round(t * 30);
    if (f < 3 || f > 4195) continue;
    const local = [];
    for (let d = -10; d <= 10; d++) if (Math.abs(d) > 2 && byF.get(f + d)) local.push(pick(byF.get(f + d)));
    if (local.length < 12) continue;
    const b = mean(local), sdl = Math.sqrt(mean(local.map(v => (v - b) ** 2))) || 1e-9;
    const hit = Math.max(...[0, 1, 2].map(d => pick(byF.get(f + d)) ?? 0));
    num += Math.max(0, hit - b); n++;
    if ((hit - b) / sdl > 0.8) cov++;
  }
  const lock = (num / n) / sd;
  console.log(`  ${label}:  均值 ${(mu * 1000).toFixed(2)}e-3   σ ${(sd * 1000).toFixed(2)}e-3   拍点增量 ${((num / n) * 1000).toFixed(2)}e-3   →  lock ${lock.toFixed(3)}   拍点覆盖 ${(cov / n * 100).toFixed(0)}%`);
  return lock;
}
console.log('\n【整幅 / 分带：谁在跟拍？】');
const L = [lockOf(r => r.energy, '全画面     ')];
for (let b = 0; b < 4; b++) L.push(lockOf(r => r.band && r.band[b], NAMES[b]));
console.log(`\n  带均值 lock = ${(mean(L.slice(1))).toFixed(3)}（只算 4 个带）；全画面 lock = ${L[0].toFixed(3)}`);
console.log('  → 带均值高、且各带都不低 = "画面里的东西在跟拍"；');
console.log('    全画面高但带均值低 = 主要靠整屏抖动/闪帧，不是元素在动。');
