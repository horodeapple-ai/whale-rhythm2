/* 内存探针：测 renderFrame 是否存在"每帧泄漏"，并 A/B 字幕开/关。
 * 用法: node tools/mem_probe.mjs [--from=0] [--n=400] [--nosubs]
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
if (args.nosubs) globalThis.__subs = false;

const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const from = Number(args.from ?? 0), n = Number(args.n ?? 400);
const c = createCanvas(1920, 1080), g = c.getContext('2d');
const mb = (x) => (x / 1048576).toFixed(0) + 'MB';
console.log((args.nosubs ? '[字幕关] ' : '[字幕开] ') + `from=${from} n=${n}  起始 RSS ${mb(process.memoryUsage().rss)}`);
let t0 = Date.now();
for (let k = 0; k < n; k++) {
  const f = from + k;
  S.renderFrame(g, Math.min(f / 30, S.DURATION - 1e-7));
  if ((k + 1) % 100 === 0) {
    const m = process.memoryUsage();
    console.log(`  +${k + 1} 帧  t=${(f / 30).toFixed(1)}s  rss=${mb(m.rss)}  external=${mb(m.external)}  heapUsed=${mb(m.heapUsed)}  ${((Date.now() - t0) / (k + 1)).toFixed(1)}ms/帧`);
  }
}
const m = process.memoryUsage();
console.log(`结束 RSS ${mb(m.rss)}  （${n} 帧，${((Date.now() - t0) / n).toFixed(1)} ms/帧）`);
