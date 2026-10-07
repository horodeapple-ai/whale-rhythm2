/* 抽帧: node tools/stills.cjs --frames=1252,1253,... --out=qa/out --tag=before
 *   或 --at=41.8,41.867 --around=2 --tag=before
 * --scale=0.5 可缩图；--zoom 放大裁切 x0,y0,w,h
 */
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const { root, createCanvas } = require('./runtime.cjs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
(async () => {
  const S = await import(pathToFileURL((args.srcroot ? path.resolve(root, args.srcroot) : root) + '/src/scene.mjs').href);
  const W = args.aspect === 'half' ? 960 : 1920, H = args.aspect === 'half' ? 540 : 1080;
  const big = createCanvas(1920, 1080), bg = big.getContext('2d');
  const c = createCanvas(W, H), g = c.getContext('2d');
  const dir = (args.out || root + '/qa/pick') + (args.tag ? '/' + args.tag : '');
  fs.mkdirSync(dir, { recursive: true });
  let frames = [];
  if (args.frames) frames = String(args.frames).split(',').map(Number);
  else {
    const at = String(args.at || '').split(',').filter(Boolean).map(Number);
    const around = Number(args.around ?? 2);
    for (const t of at) for (let d = -around; d <= around; d++) frames.push(Math.round(t * 30) + d);
  }
  const z = args.crop ? String(args.crop).split(',').map(Number) : null;
  const files = [];
  for (const f of frames) {
    const t = Math.min(f / 30, S.DURATION - 1e-7);
    const st = S.renderFrame(bg, t);
    if (z) { g.drawImage(big, z[0], z[1], z[2], z[3], 0, 0, W, H); } else { g.drawImage(big, 0, 0, W, H); }
    const name = `f${String(f).padStart(4, '0')}_t${t.toFixed(3)}.png`;
    fs.writeFileSync(dir + '/' + name, c.toBuffer('image/png'));
    files.push({ f, t: +t.toFixed(3), shot: st.shot.id, name, camS: +st.camera.s.toFixed(4), imp: +st.camera.impact.toFixed(3) });
  }
  console.log(JSON.stringify(files, null, 1));
  console.error('→ ' + dir);
})().catch(e => { console.error(e); process.exit(1); });
