/* 律动强度计量：抽样渲染相邻两帧，统计"帧间运动能量"、相机状态、以及有无"整屏跳亮"。
 * 用法: node tools/motion_gain.mjs --tag=before|after [--n=60]
 *   · 运动能量  = 相邻帧像素平均绝对差（越大＝画面动得越多）
 *   · 相机      = renderFrame 返回的 camera.zoom / vignette 均值与峰值（红线：只允许极轻微推近+暗角）
 *   · 整屏跳亮  = 全屏平均亮度的逐帧跳变峰值（红线：不许整屏闪）
 */
import path from 'node:path';
import fs from 'node:fs';
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
const N = Number(args.n || 60);
const W = 480, H = 270;                     // 低分辨率取样，省内存（运动能量对分辨率不敏感）
const c = createCanvas(W, H), g = c.getContext('2d');
const lum = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };

const rows = [];
const CUTS = new Set(S.CUT_FRAMES || []);
let tried = 0;
for (let i = 0; i < N * 3 && rows.length < N; i++) {
  const t = 2 + i * (S.DURATION - 4) / (N * 3 - 1);
  tried++;
  const f = Math.round(t * 30);
  // 跳过跨切点的帧对（切点本身是全屏变化，会把"运动能量/亮度跳变"两项都带跑偏）
  if (CUTS.has(f) || CUTS.has(f + 1) || CUTS.has(f - 1)) continue;
  S.renderFrame(g, t); const a = g.getImageData(0, 0, W, H).data; const la = lum(a);
  const st = S.renderFrame(g, Math.min(t + 1 / 30, S.DURATION - 1e-7));
  const b = g.getImageData(0, 0, W, H).data; const lb = lum(b);
  let diff = 0;
  for (let i2 = 0; i2 < a.length; i2 += 4) diff += Math.abs(a[i2] - b[i2]) + Math.abs(a[i2 + 1] - b[i2 + 1]) + Math.abs(a[i2 + 2] - b[i2 + 2]);
  rows.push({ t: +t.toFixed(2), motion: diff / (a.length / 4) / 3, luma: la, lumaStep: Math.abs(lb - la), zoom: st.camera?.s ?? 0, vig: st.camera?.vignette ?? 0 });
}
const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
const max = (k) => Math.max(...rows.map(r => r[k]));
const p95 = (k) => { const v = rows.map(r => r[k]).sort((x, y) => x - y); return v[Math.floor(v.length * 0.95)]; };
const tag = args.tag || 'run';
const out = { tag, n: rows.length, motion: +avg('motion').toFixed(3), motionP95: +p95('motion').toFixed(3), motionMax: +max('motion').toFixed(3),
  cameraZoomMax: +max('zoom').toFixed(4), cameraVigMax: +max('vig').toFixed(3), lumaStepMax: +max('lumaStep').toFixed(2), lumaAvg: +avg('luma').toFixed(1) };
fs.writeFileSync(root + '/qa/motion-' + tag + '.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
console.log('（motion＝相邻帧平均像素差；cameraZoom/Vig＝相机峰值；lumaStepMax＝全屏亮度跳变峰值，>4 就要怀疑"闪"）');
