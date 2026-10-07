/* 裁图: node tools/crop_png.cjs --in=a.png --out=b.png --crop=x0,y0,w,h [--scale=2] */
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
require('./runtime.cjs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
(async () => {
  const img = await loadImage(args.in);
  const z = String(args.crop).split(',').map(Number);
  const s = Number(args.scale || 1);
  const c = createCanvas(Math.round(z[2] * s), Math.round(z[3] * s)), g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(img, z[0], z[1], z[2], z[3], 0, 0, c.width, c.height);
  fs.writeFileSync(args.out, c.toBuffer('image/png'));
  console.log(JSON.stringify({ in: args.in, size: [img.width, img.height], crop: z, out: args.out }));
})();
