/* 找颜色: node tools/scan_color.cjs --in=qa/x.png --mode=green [--min=40] */
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
(async () => {
  const img = await loadImage(args.in);
  const c = createCanvas(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const test = (r, gg, b, a) => {
    if (a < 200) return false;
    if (args.mode === 'green') return gg > 175 && gg - r > 28 && gg - b > 22 && r > 80 && r < 190;  // 青绿
    if (args.mode === 'mint') {  // C.mint #74cbb1 附近（容差 34）
      const dr = r - 116, dg = gg - 203, db = b - 177;
      return Math.abs(dr) < 34 && Math.abs(dg) < 34 && Math.abs(db) < 34;
    }
    if (args.mode === 'gold') return r > 210 && gg > 165 && gg < 225 && b < 140;
    return false;
  };
  const B = 16, W = Math.ceil(img.width / B), H = Math.ceil(img.height / B);
  const bins = new Map();
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4;
    if (!test(d[i], d[i + 1], d[i + 2], d[i + 3])) continue;
    const k = (y / B | 0) * W + (x / B | 0);
    let o = bins.get(k); if (!o) bins.set(k, o = { n: 0, x0: x, x1: x, y0: y, y1: y, r: 0, g: 0, b: 0 });
    o.n++; if (x < o.x0) o.x0 = x; if (x > o.x1) o.x1 = x; if (y < o.y0) o.y0 = y; if (y > o.y1) o.y1 = y;
    o.r += d[i]; o.g += d[i + 1]; o.b += d[i + 2];
  }
  const out = [...bins.values()].filter(o => o.n >= Number(args.min || 40))
    .sort((a, b) => b.n - a.n).slice(0, 12)
    .map(o => ({ n: o.n, x: o.x0, y: o.y0, w: o.x1 - o.x0 + 1, h: o.y1 - o.y0 + 1, rgb: [o.r / o.n | 0, o.g / o.n | 0, o.b / o.n | 0] }));
  console.log(JSON.stringify({ in: args.in, mode: args.mode, size: [img.width, img.height], clusters: out }, null, 1));
})();
