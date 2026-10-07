/* 渲染一小段成片为 mp4（改前/改后对比用）
 * 用法: node tools/clip.cjs --srcroot=baseline --from=41.4 --to=44.0 --out=out/before-41.mp4
 *       node tools/clip.cjs                      --from=41.4 --to=44.0 --out=out/after-41.mp4
 */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const SRC = args.srcroot ? path.resolve(ROOT, args.srcroot) : ROOT;
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(ROOT + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(ROOT + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(ROOT + '/vendor/rich-song.js'); require(ROOT + '/vendor/rich-lib.js'); require(ROOT + '/vendor/rich-cast.js');

(async () => {
  const S = await import(pathToFileURL(SRC + '/src/scene.mjs').href);
  const from = Number(args.from ?? 0), to = Number(args.to ?? 4);
  const dest = args.out || (ROOT + `/output/clip-${from}.mp4`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const c = createCanvas(1920, 1080), g = c.getContext('2d');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-r', '30', '-i', 'pipe:0',
    '-ss', String(from), '-i', ROOT + '/assets/song.m4a',   // ★ -ss 必须在 -i 之前（输入定位），否则会丢整条流
    '-t', String(to - from), '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', dest], { stdio: ['pipe', 'inherit', 'inherit'] });
  let err = null; ff.on('error', e => err = e);
  const done = new Promise((ok, no) => ff.on('exit', n => n === 0 ? ok() : no(Error('ffmpeg exit ' + n))));
  const f0 = Math.round(from * 30), f1 = Math.round(to * 30), t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    S.renderFrame(g, Math.min(f / 30, S.DURATION - 1e-7));
    if (!ff.stdin.write(c.data())) await new Promise(r => ff.stdin.once('drain', r));
    if (err) throw err;
  }
  ff.stdin.end(); await done;
  console.log(`✓ ${dest}  ${(f1 - f0)} 帧 ${((Date.now() - t0) / 1000).toFixed(1)}s  ${(fs.statSync(dest).size / 1024).toFixed(0)}KB`);
})().catch(e => { console.error(e); process.exit(1); });
