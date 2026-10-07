/* 全片渲染遍历：每帧都渲染一遍（或按 --step 抽样），任何一帧抛错都立刻报出来。
 * 这是"播放到某处卡死"类 bug 的兜底检查 —— 抽几个时间点是不够的。
 * 用法: node tools/render_sweep.mjs [--step=1] [--from=0] [--to=140.032]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(root + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(root + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(root + '/vendor/rich-song.js'); require(root + '/vendor/rich-lib.js'); require(root + '/vendor/rich-cast.js');

const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const step = Number(args.step || 1);
const from = Number(args.from ?? 0), to = Number(args.to ?? S.DURATION);
const c = createCanvas(1920, 1080), g = c.getContext('2d');
const f0 = Math.round(from * 30), f1 = Math.round(to * 30);
let n = 0, fails = [];
const t0 = Date.now();
for (let f = f0; f < f1; f += step) {
  const t = Math.min(f / 30, S.DURATION - 1e-7);
  try { S.renderFrame(g, t); n++; }
  catch (e) { fails.push({ f, t: +t.toFixed(4), msg: e.message, stack: (e.stack || '').split('\n')[1] || '' }); if (fails.length > 8) break; }
  if ((f - f0) % 600 === 0 && (f - f0) > 0) console.error(JSON.stringify({ f, fps: +((f - f0) / ((Date.now() - t0) / 1000)).toFixed(1) }));
}
console.log(`渲染 ${n} 帧（step=${step}），耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (fails.length) {
  console.log(`❌ 有 ${fails.length} 帧抛错：`);
  for (const x of fails) console.log(`   f${x.f} (t=${x.t})  ${x.msg}   @${x.stack.trim()}`);
  process.exit(1);
} else {
  console.log('✅ 全片每一帧都渲染通过，没有任何一帧抛错');
}
