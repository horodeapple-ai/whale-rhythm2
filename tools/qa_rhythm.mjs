/* 节奏改造验收（数据层，不需要渲染）：对应意见书 §8.1 的 A1–A4
 * 用法: node tools/qa_rhythm.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
global.window = global;
const { createCanvas } = await import('@napi-rs/canvas');
global.document = { createElement: () => createCanvas(1920, 1080) };
await import(pathToFileURL(root + '/vendor/rich-song.js').href);

const R = await import(pathToFileURL(root + '/src/rhythm.mjs').href);
const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const D = (await import(pathToFileURL(root + '/src/beat-data.mjs').href)).BEAT_DATA;
const FPS = 30;
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } };

console.log('=== A4 节拍表自洽性 ===');
{
  const b = D.beats;
  let mono = true, range = 0, n = 0;
  for (let i = 0; i + 1 < b.length; i++) {
    if (b[i + 1] <= b[i]) mono = false;
    const P = b[i + 1] - b[i];
    if (!D.longBeats.includes(i)) { n++; if (P >= 0.40 && P <= 0.53) range++; }
  }
  ok(mono, `beats 严格递增（${b.length} 个拍点）`);
  ok(range === n, `相邻拍长在 [0.40,0.53] 内：${range}/${n}（长拍 ${JSON.stringify(D.longBeats)} 已排除）`);
  let bad = 0;
  for (let k = 1; k < b.length - 1; k++) { const t = R.cue(k); if (Math.abs(R.kOf(t) - k) > 1e-6) bad++; }
  ok(bad === 0, `kOf(cue(k)) == k 全部成立（检查 ${b.length - 2} 个整拍，失败 ${bad}）`);
}

console.log('\n=== A1 切点：到 {实测拍, 八分, DROP 帧} 的距离 ===');
{
  const cuts = S.SHOTS.map(s => s.startFrame).filter(f => f > 0);   // 帧 0 是片头起点，不是"切点"
  const drops = (D.drops || []).filter(d => d.kind === 'DROP').map(d => Math.round(d.t * FPS));
  let worst = 0, over1 = 0, over05 = 0, offenders = [];
  for (const f of cuts) {
    const t = f / FPS;
    let best = 1e9;
    for (const unit of [1, 2]) { const f2 = Math.round(R.snap(t, unit) * FPS); best = Math.min(best, Math.abs(f2 - f)); }
    for (const d of drops) best = Math.min(best, Math.abs(d - f));
    const e = best / FPS * 1000;
    worst = Math.max(worst, e);
    if (e > 16.7) { over05++; offenders.push(f + '(f' + f + ', ' + e.toFixed(0) + 'ms)'); }
    if (e > 33.4) over1++;
  }
  ok(over1 === 0, `${cuts.length} 个切点：距最近网格 >1 帧的有 ${over1} 个（失败）${offenders.length ? ' → ' + offenders.join(' ') : ''}`);
  ok(over05 === 0, `距最近网格 >0.5 帧的有 ${over05} 个；最大偏差 ${worst.toFixed(1)} ms`);
}

console.log('\n=== A2 接触点：所在槽位有没有一记打击（max(lo,mid)）===');
{
  // 用"时间轴上钉住的帧"判断：该 16 分槽位上的谱值
  const evs = S.EVENTS.filter(e => e.kind === 'contact');
  let strong = 0;
  const rows = [];
  for (const e of evs) {
    const t = e.time;
    const k16 = Math.round(R.kOf(t) * 4);
    const c = R.slotChar(k16);
    const hit = c.lo >= 3 || c.mid >= 3;
    if (hit) strong++;
    rows.push({ id: e.id, t, c, hit });
  }
  for (const r of rows) console.log(`  ${r.id.padEnd(20)} ${r.t.toFixed(3)}s  槽位 lo/mid/hi = ${r.c.lo}/${r.c.mid}/${r.c.hi}  ${r.hit ? '有打击' : '弱'}`);
  ok(strong >= 27, `30 个接触点里 ${strong} 个落在有打击的槽位上（通过线 ≥27）`);
}

console.log('\n=== 时钟一致性：所有"随拍"入口都读实测表 ===');
{
  const files = ['action-motion.mjs', 'subagent-detail.mjs', 'opening-sample.mjs', 'motion-system.mjs', 'blocks/a-opening-pelican.mjs', 'blocks/b-game-overload.mjs', 'blocks/c-clone-rescue.mjs', 'blocks/d-delivery-finale.mjs'];
  let bad = [];
  for (const f of files) {
    const src = fs.readFileSync(root + '/src/' + f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')      // 去掉块注释（注释里可以提旧常量）
      .replace(/(^|[^:])\/\/.*$/gm, '$1');   // 去掉行注释
    const m = src.match(/globalThis\.SONG\?\.bpm|128\.35|BEAT_OFFSET/g);
    if (m) bad.push(f + ' 里仍有 ' + [...new Set(m)].join(','));
  }
  ok(bad.length === 0, bad.length ? '仍有旧节拍常量：' + bad.join(' | ') : '8 个文件里已无 128.35 / SONG.bpm / BEAT_OFFSET');
}

console.log('\n=== 红线检查（用户要求）===');
{
  const ms = fs.readFileSync(root + '/src/motion-system.mjs', 'utf8');
  const hasFlash = /fillStyle\s*=\s*['"]#fffdf7|flash\s*[:=]/.test(ms) && !/没有整屏闪帧/.test(ms.split('drawMotionOverlay')[1] || '');
  ok(!/shake|roll/.test(ms.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')), 'motion-system 里没有 shake/roll 参与画面（仅注释提及）');
  ok(!/impactFlash/.test(ms), '没有整屏闪帧函数');
  const pw = fs.readFileSync(root + '/src/paper-whale.mjs', 'utf8');
  ok(!/groove|squash|withGroove/.test(pw), 'paper-whale.mjs 未被改动（角色一律不动）');
}

console.log(`\n===== 通过 ${pass} / 失败 ${fail} =====`);
process.exit(fail ? 1 : 0);
