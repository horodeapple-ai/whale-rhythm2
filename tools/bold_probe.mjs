/* 英文加粗方案对比：真 bold 权重 / 描边加粗(faux bold) / 原样
 * 渲染同一帧的纯背景，再分别用三种方式画同一句英文，裁字幕带存图并统计"墨量"。
 * 用法: node tools/bold_probe.mjs
 */
import fs from 'node:fs';
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
globalThis.__subs = false;                     // 背景不带字幕

const S = await import(pathToFileURL(root + '/src/scene.mjs').href);
const out = root + '/qa/pick/bold';
fs.mkdirSync(out, { recursive: true });

const T = 17.5, CY = 1030, SIZE = 30, COL = '#42597d';
const STR = 'I\u2019m making the calls';

const variants = [
  ['normal',    (g) => { g.font = `${SIZE}px Fredoka`; }],
  ['bold',      (g) => { g.font = `bold ${SIZE}px Fredoka`; }],
  ['faux09',    (g) => { g.font = `${SIZE}px Fredoka`; g.lineWidth = 0.9; g.strokeStyle = COL; g.lineJoin = 'round'; g.strokeText(STR, 960, CY); }],
  ['faux14',    (g) => { g.font = `${SIZE}px Fredoka`; g.lineWidth = 1.4; g.strokeStyle = COL; g.lineJoin = 'round'; g.strokeText(STR, 960, CY); }],
  ['faux20',    (g) => { g.font = `${SIZE}px Fredoka`; g.lineWidth = 2.0; g.strokeStyle = COL; g.lineJoin = 'round'; g.strokeText(STR, 960, CY); }],
];

for (const [name, apply] of variants) {
  const c = createCanvas(1920, 1080), g = c.getContext('2d');
  S.renderFrame(g, T);                         // 背景
  g.fillStyle = COL; g.textAlign = 'center'; g.textBaseline = 'middle';
  apply(g);
  g.fillText(STR, 960, CY);
  // 墨量：字体色附近（暗于背景）的像素数
  const d = g.getImageData(700, 1000, 520, 60).data;
  let ink = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 140) ink++;
  }
  fs.writeFileSync(out + '/' + name + '.png', c.toBuffer('image/png'));
  console.log(`${name.padEnd(8)} 墨量(暗像素) ${String(ink).padStart(6)}`);
}
console.log('图已存 ' + out + '（整帧，字幕在 y≈1030）');
