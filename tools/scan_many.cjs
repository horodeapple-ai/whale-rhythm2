/* 批量找色: node tools/scan_many.cjs --dir=<pngdir> --mode=green|gold [--min=40] */
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const test = (r, g, b, a, mode) => {
  if (a < 200) return false;
  if (mode === 'green') return g > 175 && g - r > 28 && g - b > 22 && r > 80 && r < 190;
  if (mode === 'mint') { const dr = r - 116, dg = g - 203, db = b - 177; return Math.abs(dr) < 34 && Math.abs(dg) < 34 && Math.abs(db) < 34; }
  if (mode === 'gold') return r > 205 && g > 150 && g < 232 && b < 150 && (r - b) > 70;
  return false;
};
(async () => {
  const files = fs.readdirSync(args.dir).filter(f => /\.png$/i.test(f));
  const out = [];
  for (const f of files) {
    const img = await loadImage(path.join(args.dir, f));
    const c = createCanvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0, sr = 0, sg = 0, sb = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (!test(d[i], d[i + 1], d[i + 2], d[i + 3], args.mode)) continue;
      n++; sr += d[i]; sg += d[i + 1]; sb += d[i + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    out.push({ f, n, bbox: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, rgb: n ? [sr / n | 0, sg / n | 0, sb / n | 0] : null });
  }
  console.log(JSON.stringify(out.filter(o => o.n >= Number(args.min || 20)), null, 1));
})();
