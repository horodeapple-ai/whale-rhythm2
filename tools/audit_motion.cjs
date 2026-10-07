/* 动态/卡点体检：逐帧渲染 → 帧间运动能量 + 相机状态 + 切点，输出 JSONL
 * 用法: node tools/audit_motion.cjs --from=0 --to=140.032 --step=1 --out=qa/audit.jsonl
 *       --step 支持小数（0.5 = 每半帧）但不建议；默认 1 帧
 */
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const { root, createCanvas } = require('./runtime.cjs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const W = 1920, H = 1080, STEP_PX = 4;

(async () => {
  fs.mkdirSync(root + '/qa/frames', { recursive: true });
  const srcRoot = args.srcroot ? String(args.srcroot) : root;   // --srcroot=baseline 可体检"改造前"的工程副本
  const S = await import(pathToFileURL(srcRoot + '/src/scene.mjs').href);
  const c = createCanvas(W, H), g = c.getContext('2d');
  const from0 = Number(args.from ?? 0), to0 = Number(args.to ?? S.DURATION), step = Number(args.step ?? 1);
  const of = Number(args.of ?? 0), shard = Number(args.shard ?? -1);
  const from = of > 0 ? shard * (S.DURATION / of) : from0;
  const to = of > 0 ? Math.min(S.DURATION, (shard + 1) * (S.DURATION / of)) : to0;
  const outPath = args.out || root + '/qa/audit.jsonl';
  const out = fs.createWriteStream(outPath);
  const grabPath = args.grab ? new Set(String(args.grab).split(',').map(Number)) : null;
  const grabDir = root + '/qa/frames';

  const nsx = Math.floor(W / STEP_PX), nsy = Math.floor(H / STEP_PX);
  const N = nsx * nsy;
  const BANDS = [[0, 270], [270, 540], [540, 810], [810, 1080]];   // 顶部(吊灯/工单卡) 中上(窗户/屏幕) 中下(角色上半) 底部(角色下半/地板)
  const bandOf = (y) => { for (let b = 0; b < 4; b++) if (y >= BANDS[b][0] && y < BANDS[b][1]) return b; return 3; };
  const bandIdx = new Int8Array(N);
  { let k = 0; for (let y = 0; y < nsy; y++) for (let x = 0; x < nsx; x++) bandIdx[k++] = bandOf(y * STEP_PX); }
  let prev = new Uint8ClampedArray(N * 3), cur = new Uint8ClampedArray(N * 3);
  let hasPrev = false;

  const f0 = Math.round(from * S.FPS), f1 = Math.round(to * S.FPS);
  const t0 = Date.now();
  for (let f = f0; f < f1; f += Math.max(1, Math.round(step))) {
    const t = Math.min(f / S.FPS, S.DURATION - 1e-7);
    const st = S.renderFrame(g, t);
    const buf = c.data();
    // 抽样
    let k = 0;
    for (let y = 0; y < nsy; y++) {
      const row = y * STEP_PX * W * 4;
      for (let x = 0; x < nsx; x++) {
        const i = row + x * STEP_PX * 4;
        cur[k++] = buf[i]; cur[k++] = buf[i + 1]; cur[k++] = buf[i + 2];
      }
    }
    let sum = 0, moved = 0, lum = 0;
    const bSum = [0, 0, 0, 0], bN = [0, 0, 0, 0];
    for (let i = 0; i < N * 3; i += 3) {
      const r = cur[i], gg = cur[i + 1], b = cur[i + 2];
      lum += (r * 0.299 + gg * 0.587 + b * 0.114);
      const bi = bandIdx[i / 3];
      bN[bi]++;
      if (hasPrev) {
        const d = Math.abs(r - prev[i]) + Math.abs(gg - prev[i + 1]) + Math.abs(b - prev[i + 2]);
        sum += d;
        bSum[bi] += d;
        if (d > 24) moved++;
      }
    }
    const rec = {
      f, t: +t.toFixed(4), shot: st.shot.id, shotU: +st.u.toFixed(3),
      energy: hasPrev ? +(sum / (N * 3 * 255)).toFixed(5) : null, // 0..1
      moved: hasPrev ? +(moved / N).toFixed(4) : null,
      // 分带运动能量：0=顶部(吊灯/工单卡) 1=中上(窗户/屏幕) 2=中下(角色上半) 3=底部(角色下半/地板)
      band: hasPrev ? bSum.map((v, i) => +(v / (bN[i] * 3 * 255)).toFixed(5)) : null,
      lum: +(lum / N / 255).toFixed(4),
      camS: +st.camera.s.toFixed(5), camX: +st.camera.x.toFixed(2), camY: +st.camera.y.toFixed(2),
      camImp: +(st.camera.impact ?? 0).toFixed(4), glow: +(st.camera.edgeGlow ?? 0).toFixed(4),
      tr: st.transition ? st.transition.kind : null,
      cut: st.shot.startFrame === f
    };
    out.write(JSON.stringify(rec) + '\n');
    if (grabPath && grabPath.has(f)) {
      fs.writeFileSync(`${grabDir}/f${f}.png`, c.toBuffer('image/png'));
    }
    [prev, cur] = [cur, prev]; hasPrev = true;
    if ((f - f0) % 300 === 0) console.error(JSON.stringify({ f, fps: +((f - f0 + 1) / ((Date.now() - t0) / 1000)).toFixed(1) }));
  }
  out.end();
  console.error(JSON.stringify({ done: true, frames: f1 - f0, out: outPath, seconds: +((Date.now() - t0) / 1000).toFixed(1) }));
})().catch(e => { console.error(e); process.exit(1); });
