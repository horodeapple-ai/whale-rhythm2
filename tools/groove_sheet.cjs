/* 元素律动对比图：同一组帧，baseline（改造前）vs 当前（元素律动），可放大裁切
 * 用法: node tools/groove_sheet.cjs [--frames=1256,1270,1284,1298] [--crop=700,470,760,470] [--name=名字]
 * 输出 qa/compare/元素律动-<name>.png（上=改造前 下=改造后）
 */
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BASELINE_DIR || ROOT + '/baseline';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));

global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(ROOT + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(ROOT + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(ROOT + '/vendor/rich-song.js'); require(ROOT + '/vendor/rich-lib.js'); require(ROOT + '/vendor/rich-cast.js');

const FRAMES = String(args.frames || '1256,1270,1284,1298').split(',').map(Number);
const CROP = String(args.crop || '700,470,760,470').split(',').map(Number);   // x,y,w,h
const NAME = args.name || '角色';
const SCALE = Number(args.scale || 1);
const W = Math.round(CROP[2] * SCALE), H = Math.round(CROP[3] * SCALE);

(async () => {
  const S0 = await import(pathToFileURL(BASE + '/src/scene.mjs').href);
  const S1 = await import(pathToFileURL(ROOT + '/src/scene.mjs').href);
  const canvas = createCanvas(1920, 1080), cg = canvas.getContext('2d');
  const outDir = ROOT + '/qa/compare';
  fs.mkdirSync(outDir, { recursive: true });
  const sheet = createCanvas(W * FRAMES.length, H * 2 + 48);
  const g = sheet.getContext('2d');
  const cell = createCanvas(W, H), sg = cell.getContext('2d');
  g.fillStyle = '#0a2448'; g.fillRect(0, 0, sheet.width, sheet.height);
  g.font = '20px KuaiLe'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = '#ffb59a'; g.fillText(`▲ 改造前（相机推近+闪帧版）   ${NAME}`, 12, 23);
  g.fillStyle = '#8ff0c0'; g.fillText(`▼ 改造后（元素律动版：耳/尾/发/裙摆/挤压 + 吊灯/浮尘/工单卡）   ${NAME}`, 12, H + 48 + 23);
  for (const [S, y0] of [[S0, 44], [S1, H + 48 + 44]]) {
    for (let i = 0; i < FRAMES.length; i++) {
      const f = FRAMES[i], t = Math.min(f / 30, S.DURATION - 1e-7);
      const st = S.renderFrame(cg, t);
      let [cx, cy, cw, ch] = CROP;
      if (args.follow) {                       // 自动跟随角色：用这一帧的姿态锚点定裁切框
        const po = st?.state?.pose ?? st?.state?.o ?? st?.state;
        const px = po?.x, py = po?.y, ps = po?.s ?? 1;
        if (Number.isFinite(px) && Number.isFinite(py)) {
          const boxH = Number(args.followH || 470), boxW = Number(args.followW || 560);
          cx = px - boxW / 2; cy = py - boxH * 0.62 - 30 * ps; cw = boxW; ch = boxH;
        }
      }
      sg.drawImage(canvas, Math.max(0, Math.round(cx)), Math.max(0, Math.round(cy)), cw, ch, 0, 0, W, H);
      g.drawImage(cell, i * W, y0);
      g.fillStyle = 'rgba(6,20,40,.6)'; g.fillRect(i * W, y0 + H - 26, W, 26);
      g.fillStyle = '#cfe9ff';
      g.fillText(`f${f}  t=${t.toFixed(3)}`, i * W + 8, y0 + H - 13);
    }
  }
  const out = `${outDir}/元素律动-${NAME}.png`;
  fs.writeFileSync(out, sheet.toBuffer('image/png'));
  console.log('→', out, sheet.width + 'x' + sheet.height);
})().catch(e => { console.error(e); process.exit(1); });
