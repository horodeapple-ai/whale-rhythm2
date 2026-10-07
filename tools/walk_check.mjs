/* 走路体检：逐帧扫描全片，把"脚被放到够不着的地方"的帧全部找出来。
 * 原理：脚的落点是姿态里的 feet 目标（根坐标系、已除以 s）。腿长只有约 90–110（本地单位），
 * 如果 |foot| 远超这个数，IK 够不到 → 画出来的腿会被拉成一条直线（"走路崩了"）。
 * 用法: node tools/walk_check.mjs [--thr=150] [--from=0] [--to=140.032]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(root + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(root + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(root + '/vendor/rich-song.js'); require(root + '/vendor/rich-lib.js'); require(root + '/vendor/rich-cast.js');

const S = await import(pathToFileURL((args.srcroot ? path.resolve(root, args.srcroot) : root) + '/src/scene.mjs').href);
const THR = Number(args.thr ?? 155);
const from = Number(args.from ?? 0), to = Number(args.to ?? S.DURATION);
const c = createCanvas(1920, 1080), g = c.getContext('2d');
const f0 = Math.round(from * 30), f1 = Math.round(to * 30);

const bad = [];
const worstByShot = new Map();
for (let f = f0; f < f1; f++) {
  const t = Math.min(f / 30, S.DURATION - 1e-7);
  let st;
  try { st = S.renderFrame(g, t); } catch (e) { bad.push({ f, t: +t.toFixed(3), why: 'RENDER ERROR ' + e.message }); continue; }
  const poses = [];
  const s0 = st?.state;
  if (s0?.pose) poses.push({ who: 'main', p: s0.pose });
  if (Array.isArray(s0?.clones)) for (const cl of s0.clones) if (cl?.pose) poses.push({ who: cl.kind || 'clone', p: cl.pose });
  for (const { who, p } of poses) {
    if (!Array.isArray(p.feet)) continue;
    for (let i = 0; i < p.feet.length; i++) {
      const ft = p.feet[i]; if (!Array.isArray(ft)) continue;
      const d = Math.hypot(ft[0], ft[1]);
      const key = st.shot.id;
      const cur = worstByShot.get(key);
      if (!cur || d > cur.d) worstByShot.set(key, { d, f, who, foot: ft });
      if (d > THR) bad.push({ f, t: +t.toFixed(3), shot: st.shot.id, who, foot: [+ft[0].toFixed(0), +ft[1].toFixed(0)], dist: +d.toFixed(0) });
    }
  }
}
console.log(`扫描 ${f1 - f0} 帧（阈值 |foot| > ${THR}）`);
if (bad.length) {
  const byShot = {};
  for (const b of bad) (byShot[b.shot] ||= []).push(b);
  console.log(`❌ 有 ${bad.length} 帧的脚被放到够不着的地方，涉及 ${Object.keys(byShot).length} 个镜头：`);
  for (const [shot, list] of Object.entries(byShot).slice(0, 20)) {
    const first = list[0], last = list[list.length - 1];
    console.log(`   ${shot.padEnd(8)} ${list.length} 帧  f${first.f}–f${last.f} (t=${first.t}–${last.t})  最大 |foot| ${Math.max(...list.map(x => x.dist))}  例 ${first.who} foot=[${(first.foot || []).join(',')}]`);
  }
} else {
  console.log('✅ 没有任何一帧的脚超出可达范围');
}
console.log('\n各镜头"脚离身体最远"的帧（前 12 名）：');
[...worstByShot.entries()].sort((a, b) => b[1].d - a[1].d).slice(0, 12)
  .forEach(([shot, x]) => console.log(`   ${shot.padEnd(8)} |foot|=${x.d.toFixed(0).padStart(5)}  f${x.f} (t=${(x.f / 30).toFixed(2)})  ${x.who}  foot=[${x.foot.map(v => v.toFixed(0)).join(',')}]`));
process.exit(bad.length ? 1 : 0);
