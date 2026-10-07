/* 比较两组 PNG 的亮度/差异: node tools/imgdiff.cjs qa/pick/before qa/pick/after */
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
(async () => {
  const [dA, dB] = process.argv.slice(2);
  const list = fs.readdirSync(dA).filter(f => f.endsWith('.png')).sort();
  const c = createCanvas(480, 270), g = c.getContext('2d');
  const stat = async (p) => {
    const img = await loadImage(p); g.drawImage(img, 0, 0, 480, 270);
    const d = g.getImageData(0, 0, 480, 270).data;
    let lum = 0, n = 0, mx = 0;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255; lum += l; mx = Math.max(mx, l); n++; }
    return { lum: lum / n, max: mx };
  };
  console.log('file'.padEnd(28), 'before-lum  after-lum   增量');
  for (const f of list) {
    const a = await stat(path.join(dA, f)), b = await stat(path.join(dB, f)).catch(() => null);
    if (!b) continue;
    console.log(f.padEnd(28), a.lum.toFixed(4).padStart(9), b.lum.toFixed(4).padStart(10), ((b.lum - a.lum) * 100).toFixed(2) + '%');
  }
})();
