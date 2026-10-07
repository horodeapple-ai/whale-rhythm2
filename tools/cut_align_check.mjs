/* 切点重对齐核对：把"源切点吸附到实测网格"的结果与意见书附录 A 的建议值逐条对比
 * 用法: node tools/cut_align_check.cjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
global.window = global;
const { createCanvas } = await import('@napi-rs/canvas');
global.document = { createElement: () => createCanvas(1920, 1080) };
await import(pathToFileURL(root + '/vendor/rich-song.js').href);
const A = await import(pathToFileURL(root + '/src/blocks/a-opening-pelican.mjs').href);
const B = await import(pathToFileURL(root + '/src/blocks/b-game-overload.mjs').href);
const C = await import(pathToFileURL(root + '/src/blocks/c-clone-rescue.mjs').href);
const D = await import(pathToFileURL(root + '/src/blocks/d-delivery-finale.mjs').href);
const R = await import(pathToFileURL(root + '/src/rhythm.mjs').href);

// 意见书附录 A 的"建议切点(帧)"
const WANT = {
  'A-2': 64, 'A-3': 106, 'A-4': 161, 'A-5': 216, 'A-6': 291, 'A-7': 360, 'A-8': 428, 'A-9': 487, 'A-10': 537, 'A-11': 595, 'A-12': 644, 'A-13': 701, 'A-14': 744, 'A-15': 807, 'A-16': 863, 'A-17': 926, 'A-18': 976, 'A-19': 1025,
  'B-B01': 1081, 'B-B02': 1116, 'B-B03': 1172, 'B-B04': 1235, 'B-B05': 1291, 'B-B06': 1347, 'B-B07': 1389, 'B-B08': 1466, 'B-B09': 1515, 'B-B10': 1557, 'B-B11': 1634, 'B-B12': 1683, 'B-B13': 1731, 'B-B14': 1794, 'B-B15': 1857, 'B-B16': 1906, 'B-B17': 1941, 'B-B18': 1983, 'B-B19': 2031, 'B-B20': 2100,
  'C-C01': 2163, 'C-C02': 2219, 'C-C03': 2274, 'C-C04': 2309, 'C-C05': 2350, 'C-C06': 2392, 'C-C07': 2455, 'C-C08': 2517, 'C-C09': 2579, 'C-C10': 2642, 'C-C11': 2697, 'C-C12': 2752, 'C-C13': 2814, 'C-C14': 2876, 'C-C15': 2938, 'C-C16': 3007, 'C-C17': 3056, 'C-C18': 3131, 'C-C19': 3187,
  'D-D01': 3242, 'D-D02': 3297, 'D-D03': 3345, 'D-D04': 3393, 'D-D05': 3475, 'D-D06': 3551, 'D-D07': 3614, 'D-D08': 3684, 'D-D09': 3748, 'D-D10': 3811, 'D-D11': 3879, 'D-D12': 3895, 'D-D13': 3930, 'D-D14': 3985, 'D-D15': 4027, 'D-D16': 4054, 'D-D17': 4102, 'D-D18': 4144,
};
const grid = R ? null : null;
const BTS = (await import(pathToFileURL(root + '/src/beat-data.mjs').href)).BEAT_DATA.beats;
const FPS = 30;
function nearestEighth(t) {
  let best = null, bd = 1e9;
  for (let i = 0; i + 1 < BTS.length; i++) {
    const P = BTS[i + 1] - BTS[i];
    for (const cand of [BTS[i], BTS[i] + P / 2]) { const d = Math.abs(cand - t); if (d < bd) { bd = d; best = cand; } }
  }
  return Math.round(best * FPS);
}

const BLOCKS = [['A', A], ['B', B], ['C', C], ['D', D]];
let n = 0, same = 0, diff = [];
for (const [tag, M] of BLOCKS) {
  for (const s of M.SHOTS) {
    const id = `${tag}-${s.id}`;          // A 段的 id 是数字 → 统一拼成 'A-2' 这种形式
    if (!(id in WANT)) continue;
    n++;
    const got = nearestEighth(s.start);
    if (got === WANT[id]) same++;
    else diff.push({ id, src: +s.start.toFixed(3), got, want: WANT[id], d: got - WANT[id] });
  }
}
console.log(`共 ${n} 个内部切点；"最近八分"自动算出的与附录 A 建议值相同的：${same} 个（${(same / n * 100).toFixed(0)}%）`);
console.log('不同的：');
for (const d of diff) console.log(`  ${d.id.padEnd(7)} 源 ${d.src.toFixed(3)}s  算出 f${d.got}  建议 f${d.want}  差 ${d.d > 0 ? '+' : ''}${d.d} 帧`);
