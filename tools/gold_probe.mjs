/* 金色画笔溯源：把画布包一层代理，凡是设置"金色系"fillStyle 的调用都记下调用栈。
 * 用法: node tools/gold_probe.mjs --frame=737 [--region=x0,y0,x1,y1]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const F = Number(args.frame ?? 737);
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(root + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(root + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(root + '/vendor/rich-song.js'); require(root + '/vendor/rich-lib.js'); require(root + '/vendor/rich-cast.js');

const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const c = createCanvas(1920, 1080), real = c.getContext('2d');
const GOLD = /#(e8b856|f0b941|ffdf88|ffe19b|e7cf97|d5a145|ffcf68|ffdf8c|f4c267|e8b64b|ffd264|fff0c6|f0bc53|d2b572|d49339|976022|c28831|8c734a|b97626|a97027|ffe8a5|ffd27a|ffe0a0)/i;
const hits = new Map();
const FILTER = args.all ? null : GOLD;
const wrapped = new Proxy(real, {
  get(t, k) {
    const v = Reflect.get(t, k, t);
    return typeof v === 'function' ? v.bind(t) : v;
  },
  set(t, k, v) {
    if (k === 'fillStyle' && typeof v === 'string' && (!FILTER || FILTER.test(v))) {
      const st = (new Error().stack || '').split('\n').slice(1, 7).map(s => s.trim().replace(/^at\s+/, '').replace(/\(.*?([^\\/]+:\d+:\d+)\)$/, '$1'));
      // 只保留 A 段自己的绘制（跳过通用件/我的世界层）
      const own = st.filter(s => /a-opening-pelican|opening-sample|original-world-detail/.test(s)).join(' <- ');
      if (!own) return Reflect.set(t, k, v, t);
      const key = v + '  @ ' + own;
      hits.set(key, (hits.get(key) || 0) + 1);
    }
    return Reflect.set(t, k, v, t);
  },
});
S.renderFrame(wrapped, F / 30);
console.log(`帧 ${F}（t=${(F / 30).toFixed(3)}）里画"金色系"的调用，共 ${hits.size} 种：`);
[...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).forEach(([k, n]) => console.log(`  ×${String(n).padStart(3)}  ${k}`));
