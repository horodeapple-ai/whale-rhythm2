/* 量字幕带背景明暗：关掉字幕渲染，统计 y∈[935,1065] 区域的亮度分布，
 * 用来决定"去掉纸片条"之后文字颜色/描边怎么配。
 * 用法: node tools/band_luma.mjs [--step=2]
 */
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
globalThis.__subs = false;              // 只看背景

const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const c = createCanvas(1920, 1080), g = c.getContext('2d');
const step = Number(args.step || 2);
const Y0 = 935, H = 130, X0 = 300, W = 1320;
const rows = [];
for (let t = 6; t < 138; t += step) {
  S.renderFrame(g, Math.min(t, S.DURATION - 1e-7));
  const d = g.getImageData(X0, Y0, W, H).data;
  let sum = 0, n = 0, dark = 0;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) {
    const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += L; n++; lum.push(L);
    if (L < 90) dark++;
  }
  lum.sort((a, b) => a - b);
  rows.push({ t, mean: sum / n, p10: lum[Math.floor(n * 0.1)], p50: lum[Math.floor(n * 0.5)], p90: lum[Math.floor(n * 0.9)], darkPct: dark / n * 100 });
}
const mean = rows.reduce((a, r) => a + r.mean, 0) / rows.length;
const dark = rows.reduce((a, r) => a + r.darkPct, 0) / rows.length;
console.log(`字幕带背景亮度（${rows.length} 帧，y ${Y0}–${Y0 + H}）：平均 ${mean.toFixed(0)}/255，暗像素(<90)占比平均 ${dark.toFixed(1)}%`);
rows.sort((a, b) => a.mean - b.mean);
console.log('\n最暗的 8 帧：');
for (const r of rows.slice(0, 8)) console.log(`  t=${r.t.toFixed(0).padStart(4)}s  均值 ${r.mean.toFixed(0)}  p10 ${r.p10.toFixed(0)}  p90 ${r.p90.toFixed(0)}  暗占比 ${r.darkPct.toFixed(0)}%`);
console.log('\n最亮的 8 帧：');
for (const r of rows.slice(-8)) console.log(`  t=${r.t.toFixed(0).padStart(4)}s  均值 ${r.mean.toFixed(0)}  p10 ${r.p10.toFixed(0)}  p90 ${r.p90.toFixed(0)}  暗占比 ${r.darkPct.toFixed(0)}%`);
const veryDark = rows.filter(r => r.mean < 110).length;
console.log(`\n带内偏暗（均值<110）的帧：${veryDark}/${rows.length}（${(veryDark / rows.length * 100).toFixed(0)}%）`);
