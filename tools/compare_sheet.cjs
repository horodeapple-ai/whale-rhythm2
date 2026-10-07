/* 双版本抽帧对比图： node tools/compare_sheet.cjs
 * baseline/ = 改造前的工程副本（原始 src）；当前 src/ = 改造后
 * 输出 qa/compare/*.png（每张：上半=改前 4 帧，下半=改后 4 帧）
 */
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASELINE_DIR || ROOT + '/baseline';

global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(ROOT + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(ROOT + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(ROOT + '/vendor/rich-song.js'); require(ROOT + '/vendor/rich-lib.js'); require(ROOT + '/vendor/rich-cast.js');

const ACC = [
  { t: 41.8667, name: '01-41.867-最强踢鼓-头撞问号块' },
  { t: 65.1667, name: '02-65.167-印章落窗-账号已封禁' },
  { t: 68.8667, name: '03-68.867-抽码全塌起手' },
  { t: 84.3667, name: '04-84.367-分身一落脚' },
];
const OFF = [-2, -1, 0, 1];
const W = 480, H = 270;

(async () => {
  const outDir = ROOT + '/qa/compare';
  fs.mkdirSync(outDir, { recursive: true });
  const SBefore = await import(pathToFileURL(BASE + '/src/scene.mjs').href);
  const SAfter = await import(pathToFileURL(ROOT + '/src/scene.mjs').href);
  const canvas = createCanvas(1920, 1080), cg = canvas.getContext('2d');
  const small = createCanvas(W, H), sg = small.getContext('2d');

  for (const a of ACC) {
    const sheet = createCanvas(W * OFF.length, H * 2 + 44);
    const g = sheet.getContext('2d');
    g.fillStyle = '#0a2448'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.font = '19px KuaiLe'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = '#ffb59a'; g.fillText(`▲ 改造前   ${a.name}`, 12, 21);
    g.fillStyle = '#8ff0c0'; g.fillText(`▼ 改造后   ${a.name}`, 12, H + 44 + 21);
    for (const [pass, S, y0] of [[0, SBefore, 40], [1, SAfter, H + 44 + 40]]) {
      for (let i = 0; i < OFF.length; i++) {
        const f = Math.round(a.t * 30) + OFF[i];
        const t = Math.max(0, Math.min(f / 30, S.DURATION - 1e-7));
        S.renderFrame(cg, t);
        sg.drawImage(canvas, 0, 0, W, H);
        g.drawImage(small, i * W, y0);
        g.fillStyle = 'rgba(6,20,40,.55)'; g.fillRect(i * W, y0 + H - 26, W, 26);
        g.fillStyle = OFF[i] === 0 ? '#ff9f86' : '#cfe9ff';
        g.fillText(`f${f}${OFF[i] === 0 ? '  ← 撞点' : ''}`, i * W + 8, y0 + H - 13);
      }
    }
    fs.writeFileSync(`${outDir}/${a.name}.png`, sheet.toBuffer('image/png'));
    console.log('✓', a.name);
  }
  console.log('→', outDir);
})().catch(e => { console.error(e); process.exit(1); });
