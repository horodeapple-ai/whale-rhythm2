/* 元素律动自检（不需要渲染，秒出）
 *   1) 节拍是否量化到整数帧（元素峰值必须落在拍点那一帧）
 *   2) 同类元素是否相位错开（4 灯 / 7 屏 / 3 地灯）
 *   3) 重音强度是否分层（弱拍小、重音大）
 *   4) 确定性（同一 t 多次取结果一致）
 *   5) 角色确实不参与律动（groove.mjs 里不允许出现任何角色通道）
 * 用法: node tools/groove_check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
global.window = global;
const { createCanvas } = require('@napi-rs/canvas');
global.document = { createElement: () => createCanvas(1920, 1080) };
await import(pathToFileURL(root + '/vendor/rich-song.js').href);
const G = await import(pathToFileURL(root + '/src/groove.mjs').href);
const B = await import(pathToFileURL(root + '/src/beat.mjs').href);
const FPS = B.FPS;
const snap = (t) => Math.round(t * FPS) / FPS;
const t0 = snap(41.8667);                        // 全片最强踢鼓（第 89 拍 = 帧 1256）

console.log(`基准撞点 t=${t0.toFixed(6)}（第 89 拍，帧 ${Math.round(t0 * 30)}）  每拍 ${(B.PERIOD * FPS).toFixed(3)} 帧`);
console.log('  ⚠ t=41.8667 比帧时刻 41.866667 大 33µs，会让"拍点脉冲"整整差一拍——');
console.log('    这就是本项目反复踩到的坑：任何时刻都要先 Math.round(t*30)/30 再比较。');

console.log('\n【1】撞点前后 ±4 帧：拍脉冲 p 是否在拍点那一帧取到峰值');
console.log('帧号    Δ(相对拍点)      p     小节脉冲   重音强度');
{
  const f0 = Math.round(t0 * 30);
  for (let f = f0 - 4; f <= f0 + 4; f++) {
    const t = f / FPS;
    const k = (t - B.PHASE) / B.PERIOD, d = k - Math.round(k);
    console.log(`${String(f).padStart(4)}  ${(d * B.PERIOD * 1000).toFixed(0).padStart(6)}ms  ${G.pulse(t, 6).toFixed(4)}  ${G.barPulse(t, 5.5).toFixed(4)}   ${G.accentAt(t).toFixed(3)}${d === 0 ? '   ← 拍点' : ''}`);
  }
}

console.log('\n【2】同类元素的相位错开（同一帧里各元素必须各不相同 → 波浪）');
console.log('   测的就是代码里实际用的公式（drawLanterns / drawScreenLights / drawFloorLights）');
const RATE = 1 / B.PERIOD;                                     // 2.1395 拍/秒
{
  const n1 = 4, swayL = [], glowL = [];
  for (let i = 0; i < n1; i++) {
    swayL.push((0.040 * Math.sin(Math.PI * 2 * (t0 * RATE / 4 + i / n1)) * 180 / Math.PI).toFixed(2));
    glowL.push(G.lampPulse(t0, i, 0.15).toFixed(3));
  }
  console.log(`  吊灯×4 摆角:   ${swayL.map(v => v + '°').join(' ')}   → ${new Set(swayL).size === n1 ? 'PASS' : '注意 ' + new Set(swayL).size + ' 种'}`);
  console.log(`  吊灯×4 灯脉冲: ${glowL.join(' ')}   → ${new Set(glowL).size === n1 ? 'PASS' : '注意 ' + new Set(glowL).size + ' 种'}`);
}
for (const [name, n, off] of [['屏幕', 7, 0], ['地灯', 3, 11]]) {
  const glow = [];
  for (let i = 0; i < n; i++) glow.push(G.lampPulse(t0, i + off, 0.5/n).toFixed(3));
  console.log(`  ${name}×${n} 灯脉冲: ${glow.join(' ')}   → ${new Set(glow).size === n ? 'PASS' : '注意 ' + new Set(glow).size + ' 种'}`);
}

console.log('\n【3】重音是否分层（重音越强，灯越亮）');
for (const [label, t] of [['弱拍（41.6333）', snap(41.6333)], ['普通拍（42.3333）', snap(42.3333)], ['全片最强（41.8667）', t0]]) {
  const g0 = G.lampPulse(t, 0), a = G.accentAt(t), e = G.envGroove(t, 0);
  console.log(`  ${label.padEnd(18)} 重音强度 ${a.toFixed(3)}  灯脉冲 ${g0.toFixed(2)}×  光池 alpha ${Math.min(.30, .20 * g0).toFixed(3)}`);
}

console.log('\n【4】确定性：同一 t 连续取 3 次必须完全相同');
{
  const a = JSON.stringify(G.envGroove(t0 + 0.013, 2)), b = JSON.stringify(G.envGroove(t0 + 0.013, 2)), c = JSON.stringify(G.envGroove(t0 + 0.013, 2));
  console.log('  ' + (a === b && b === c ? 'PASS 三次一致' : 'FAIL 结果不稳定'));
}

console.log('\n【5】角色确实不参与律动（红线检查）');
{
  const src = fs.readFileSync(root + '/src/groove.mjs', 'utf8');
  const banned = ['characterGroove', 'squash', 'sy:', 'sx:', 'ears', 'tail:', 'blinkOnBar'];
  const hit = banned.filter(k => src.includes(k));
  console.log('  groove.mjs 中出现的角色通道：' + (hit.length ? '❌ ' + hit.join(', ') : '✅ 无（角色一律不动）'));
  const pw = fs.readFileSync(root + '/src/paper-whale.mjs', 'utf8');
  const pwHit = pw.includes('groove.mjs') || pw.includes('characterGroove');
  console.log('  paper-whale.mjs 是否引用律动层：' + (pwHit ? '❌ 引用了（角色被动过）' : '✅ 未引用（角色渲染保持原样）'));
}
