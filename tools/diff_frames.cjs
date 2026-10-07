/* 帧差: node tools/diff_frames.cjs --a=now.png --b=base.png [--scaleB=1.009] [--grid=48]
 * scaleB: 把 B 图围绕画面中心缩放该倍数后再比较（用来抵消两版相机的轻微缩放差） */
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
(async () => {
  const A = await loadImage(args.a), B0 = await loadImage(args.b);
  const W = 960, H = 540;                       // 半分辨率比较，够用且快
  const ca = createCanvas(W, H), ga = ca.getContext('2d');
  ga.drawImage(A, 0, 0, W, H);
  const cb = createCanvas(W, H), gb = cb.getContext('2d');
  const f = Number(args.scaleB || 1);
  gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
  gb.drawImage(B0, W / 2 + (0 - W / 2) * f, H / 2 + (0 - H / 2) * f, W * f, H * f);
  const da = ga.getImageData(0, 0, W, H).data, db = gb.getImageData(0, 0, W, H).data;
  const N = Number(args.grid || 48), cw = W / N, ch = H / N;
  const cells = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let sum = 0, n = 0, mx = 0;
    for (let y = j * ch | 0; y < (j + 1) * ch; y++) for (let x = i * cw | 0; x < (i + 1) * cw; x++) {
      const k = (y * W + x) * 4, d = Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]);
      sum += d; n++; if (d > mx) mx = d;
    }
    cells.push({ i, j, mean: sum / n / 3, max: mx / 3, x: i * cw | 0, y: j * ch | 0 });
  }
  const top = cells.filter(c => c.mean > 12).sort((a, b) => b.mean - a.mean).slice(0, 24);
  console.log(JSON.stringify({ a: args.a, b: args.b, scaleB: f, cellsAbove12: top.length, top }, null, 1));
})();
