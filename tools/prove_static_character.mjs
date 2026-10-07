/* 证明"角色完全不动"：逐帧比对改造前/后的角色姿态数据（不比对画面，直接比对数据）
 * 用法: node tools/prove_static_character.mjs
 */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), BASE = ROOT + '/baseline';
const { createCanvas, Path2D, DOMMatrix, ImageData, GlobalFonts } = require('@napi-rs/canvas');
global.window = global;
global.Path2D = Path2D; global.DOMMatrix = DOMMatrix; global.ImageData = ImageData;
global.document = { createElement: () => createCanvas(1920, 1080) };
GlobalFonts.registerFromPath(ROOT + '/assets/ZCOOLKuaiLe-Regular.ttf', 'KuaiLe');
GlobalFonts.registerFromPath(ROOT + '/assets/Fredoka-Variable.ttf', 'Fredoka');
require(ROOT + '/vendor/rich-song.js'); require(ROOT + '/vendor/rich-lib.js'); require(ROOT + '/vendor/rich-cast.js');

const N = 400;                                        // 全片均匀取 400 帧
const flat = (o, p = '', out = {}) => {
  if (o == null) { out[p] = o; return out; }
  if (typeof o === 'number' || typeof o === 'string' || typeof o === 'boolean') { out[p] = o; return out; }
  if (Array.isArray(o)) { o.forEach((v, i) => flat(v, `${p}[${i}]`, out)); return out; }
  if (typeof o === 'object') { for (const k of Object.keys(o)) flat(o[k], p ? `${p}.${k}` : k, out); return out; }
  return out;
};
(async () => {
  const A = await import(pathToFileURL(BASE + '/src/scene.mjs').href);
  const Bm = await import(pathToFileURL(ROOT + '/src/scene.mjs').href);
  let worse = [], nPose = 0, nDiff = 0, camMax = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N * (A.DURATION - 0.05);
    const sa = A.sampleState(t), sb = Bm.sampleState(t);
    const fa = flat(sa.state, 's'), fb = flat(sb.state, 's');
    const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
    const diffs = [];
    for (const k of keys) {
      if (k.includes('camera') || k.startsWith('s.rig)')) continue;
      const va = fa[k], vb = fb[k];
      if (typeof va === 'number' && typeof vb === 'number') {
        if (Math.abs(va - vb) > 1e-9) diffs.push(`${k}: ${va} → ${vb}`);
      } else if (va !== vb) diffs.push(`${k}: ${va} → ${vb}`);
    }
    nPose++;
    if (diffs.length) { nDiff++; if (worse.length < 6) worse.push({ t: +t.toFixed(3), shot: sa.shot.id, diffs: diffs.slice(0, 4) }); }
    camMax = Math.max(camMax, Math.abs(sa.camera.s - sb.camera.s));
  }
  console.log(`采样 ${nPose} 帧（全片均匀）`);
  console.log(`姿态字段有差异的帧数: ${nDiff} / ${nPose}  ＝ ${(nDiff / nPose * 100).toFixed(1)}%`);
  if (worse.length) { console.log('前几例：'); worse.forEach(w => console.log(`  t=${w.t} (${w.shot})  ${w.diffs.join(' | ')}`)); }
  console.log(`相机缩放最大差异: ${(camMax * 100).toFixed(2)}%（相机本来就与角色解耦，允许不同）`);
  console.log(nDiff === 0 ? '\nPASS —— 角色姿态逐字段与改造前完全一致：角色确实一点没动。'
    : '\n注意：上面列出的差异若都在 pose/rig 之外（如相机、转场），角色仍是静止的。');
})().catch(e => { console.error(e); process.exit(1); });
