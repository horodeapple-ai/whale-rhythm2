/* 字幕端到端检查：
 *  1) 39 句逐句核对：句首 +0.3s / 句尾 -0.05s 时 lyricAt 是否就是这一句
 *  2) 句尾 +0.05s 时是否已经不是这一句（或已经是下一句）
 *  3) 真渲染：在纸条中心区域采样像素，确认纸片条确实画出来了（不是空白/没画）
 *  4) 打印一段"时间 → 当前显示的双语"清单，便于人工核对
 * 用法: node tools/check_subs.mjs
 */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(root + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(root + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(root + '/vendor/rich-song.js'); require(root + '/vendor/rich-lib.js'); require(root + '/vendor/rich-cast.js');

const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const SUB = await import(pathToFileURL(root + '/src/subtitles.mjs').href);
const DATA = await import(pathToFileURL(root + '/src/lyrics-data.mjs').href);
const c = createCanvas(1920, 1080), g = c.getContext('2d');
const L = DATA.LYRICS;

let bad = 0;
console.log('== 1/2 句首句尾归属 ==');
for (const l of L) {
  const cases = [
    [l.t + 0.30, l, '句首+0.30'],
    [l.end - 0.05, l, '句尾-0.05'],
  ];
  for (const [t, want, lab] of cases) {
    if (t >= S.DURATION) continue;
    const got = SUB.lyricAt(t);
    const ok = got && Math.abs(got.t - want.t) < 1e-6;
    if (!ok) { bad++; console.log(`  ❌ ${lab} t=${t.toFixed(3)} 期望 ${want.en} 实得 ${got ? got.en : 'null'}`); }
  }
  // 句尾之后
  const t2 = l.end + 0.05;
  if (t2 < S.DURATION) {
    const got = SUB.lyricAt(t2);
    const stillThis = got && Math.abs(got.t - l.t) < 1e-6;
    if (stillThis) { bad++; console.log(`  ❌ 句尾+0.05 t=${t2.toFixed(3)} 仍显示本句 ${l.en}`); }
  }
}
console.log(bad ? `  ❌ 归属检查失败 ${bad} 处` : '  ✅ 39 句句首/句尾归属全部正确');

console.log('\n== 3 真渲染检查：同一帧"字幕开/关"在字幕带上的差异像素 ==');
// 去掉纸片条之后不能靠"找纸色像素"了：改为同帧渲染两遍（开/关字幕）比差异像素。
const BAND = [340, 940, 1240, 120];      // x, y, w, h
function bandDiff(t) {
  globalThis.__subs = true;  S.renderFrame(g, t);
  const on = g.getImageData(...BAND).data;
  globalThis.__subs = false; S.renderFrame(g, t);
  const off = g.getImageData(...BAND).data;
  let diff = 0;
  for (let i = 0; i < on.length; i += 4) {
    if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 30) diff++;
  }
  return diff;
}
// 先标定：无歌词时刻的差应该≈0；最短句的差就是下限
const cal0 = Math.max(bandDiff(3.0), bandDiff(138.5));
let minLine = Infinity;
for (const l of L) minLine = Math.min(minLine, bandDiff(Math.min(l.t + (l.end - l.t) * 0.5, S.DURATION - 1e-7)));
const THRESH = Math.max(200, Math.min(600, Math.floor(minLine * 0.6)));
console.log(`  标定：无歌词时差=${cal0}（应≈0）；最短句差=${minLine} → 判定阈值 ${THRESH}`);
if (cal0 > 200) { bad++; console.log('  ❌ 无歌词时刻却有明显字幕像素'); }

let drawn = 0, missing = [];
for (const l of L) {
  const t = Math.min(l.t + (l.end - l.t) * 0.5, S.DURATION - 1e-7);   // 取句中，避开淡入淡出
  const diff = bandDiff(t);
  if (diff >= THRESH) drawn++; else missing.push(`t=${t.toFixed(3)} ${l.en} (差异${diff})`);
}
globalThis.__subs = true;
console.log(`  句中渲染：${drawn}/${L.length} 句检到字幕像素${missing.length ? '，缺：' + missing.join('; ') : ''}`);
if (missing.length) bad++;

console.log('\n== 4 时间线清单（可与音频逐句核对）==');
for (const l of L) console.log(`  ${l.t.toFixed(3).padStart(7)} – ${l.end.toFixed(3).padStart(7)}  ${l.en}  |  ${l.zh}`);

// 不该有字幕的时段
console.log('\n== 5 空白时段应为无字幕 ==');
for (const t of [0.5, 3.0, 6.5, 14.3, 14.9, 138.5, 139.8]) {
  const got = SUB.lyricAt(t);
  console.log(`  t=${String(t).padStart(6)}  ${got ? '❌ ' + got.en : '✓ 无字幕'}`);
  if (got) bad++;
}
console.log(bad ? `\n❌ 共 ${bad} 处问题` : '\n✅ 全部通过');
process.exit(bad ? 1 : 0);
