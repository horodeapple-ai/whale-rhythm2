/* 台词后缀核对：把全片 speech() 的原文抓出来，过一遍模块里真正在用的 catSpeak()，
 * 打印"原文 -> 实际显示"，并统计加/不加。改台词规则后跑这个，不用等渲染。
 * 用法: node tools/check_speech.mjs
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

const { catSpeak } = await import(pathToFileURL(root + '/src/opening-sample.mjs').href);

// 抓源码里所有 speech(g,'...') 的原文
const pat = /speech\(g\s*,\s*'((?:[^'\\]|\\.)*)'/g;
const rows = [];
for (const dir of ['src', 'src/blocks']) {
  for (const fn of fs.readdirSync(path.join(root, dir))) {
    if (!fn.endsWith('.mjs')) continue;
    const p = path.join(root, dir, fn);
    const txt = fs.readFileSync(p, 'utf8');
    txt.split(/\r?\n/).forEach((line, i) => {
      let m; pat.lastIndex = 0;
      while ((m = pat.exec(line))) rows.push({ file: dir + '/' + fn, line: i + 1, s: m[1] });
    });
  }
}
let add = 0, keep = 0;
console.log('原文 -> 实际显示');
for (const r of rows) {
  const out = catSpeak(r.s);
  const changed = out !== r.s;
  if (changed) add++; else keep++;
  console.log(`  ${changed ? '加 ' : '不加'}  ${r.s.padEnd(16)} -> ${out}    (${r.file}:${r.line})`);
}
console.log(`\n共 ${rows.length} 句：加后缀 ${add} 句、保持原样 ${keep} 句`);
const bad = rows.filter(r => catSpeak(r.s).includes('喵~喵~'));
console.log(bad.length ? '❌ 有重复后缀：' + bad.map(b => b.s).join(' / ') : '✅ 没有重复后缀');
