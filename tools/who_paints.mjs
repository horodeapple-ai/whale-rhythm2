/* 像素溯源：给定帧号与矩形，报出在该区域附近"设置填充色"的绘制调用（含调用栈）。
 * 用法:
 *   node tools/who_paints.mjs --frame=1338 --rect=60,640,220,980
 *   node tools/who_paints.mjs --frame=737 --rect=900,370,1370,670 --all
 * 说明：拦截 Canvas 的 fillStyle 赋值，记录当时的真实变换（含相机矩阵）与调用栈；
 *      凡变换原点落在目标矩形外扩 R 之内的，都列出来。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const F = Number(args.frame ?? 737);
const R = String(args.rect || '0,0,1920,1080').split(',').map(Number);
const PAD = Number(args.pad ?? 900);
const cx = (R[0] + R[2]) / 2, cy = (R[1] + R[3]) / 2;
const ONLY = args.only ? new RegExp(String(args.only), 'i') : null;

const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(root + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(root + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(root + '/vendor/rich-song.js'); require(root + '/vendor/rich-lib.js'); require(root + '/vendor/rich-cast.js');
const S = await import(pathToFileURL((args.srcroot ? path.resolve(root, args.srcroot) : root) + '/src/scene.mjs').href);

const c = createCanvas(1920, 1080), real = c.getContext('2d');
const hits = new Map();
const wrapped = new Proxy(real, {
  get(t, k) { const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; },
  set(t, k, v) {
    if (k === 'fillStyle' && v != null) {
      let m = null; try { m = t.getTransform(); } catch { }
      if (m && Math.hypot(m.e - cx, m.f - cy) < PAD) {
        const col = typeof v === 'string' ? v : `[${v.constructor ? v.constructor.name : typeof v}]`;
        const st = (new Error().stack || '').split('\n').slice(2, 8)
          .map(s => s.trim().replace(/^at\s+/, '').replace(/\(.*?([^\\/]+:\d+:\d+)\)$/, '$1'))
          .filter(s => !/who_paints|node:internal/.test(s));
        const key = `${col.padEnd(16)} @ ${st.slice(0, 4).join(' <- ')}`;
        if (!ONLY || ONLY.test(key)) hits.set(key, (hits.get(key) || 0) + 1);
      }
    }
    return Reflect.set(t, k, v, t);
  },
});
S.renderFrame(wrapped, F / 30);
console.log(`帧 ${F}（t=${(F / 30).toFixed(3)}）  目标矩形 [${R.join(',')}]  外扩 ${PAD}px`);
console.log(`命中 ${hits.size} 种填充调用：`);
[...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(args.top ?? 30)).forEach(([k, n]) => console.log(`  ×${String(n).padStart(3)}  ${k}`));
