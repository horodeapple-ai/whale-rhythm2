/* ============================================================================
 * src/rhythm-fx.mjs —— 纸片 UI 层：窗口/卡片/平台/气泡的"节拍弹跳 + 交错行波"
 * ----------------------------------------------------------------------------
 * 原工程里所有窗口、卡片、平台都走 opening-sample.mjs 的少数几个原语
 * （windowFrame / card / stage / speech / request …，全片 150+ 处调用）。
 * **改原语 = 一次作用于全片**。
 *
 * 做法：
 *   · 每个元素按自己的中心点做轻微缩放（拍点最大），幅度按强度级分档：
 *     L3 +2.8% / L2 +1.6% / L1 +0.6% / L0 0
 *   · 行波：x 越靠右越晚（0..0.5 拍），再叠一个按元素 key 的 1/16 拍错开 → 不像机械
 *   · DROP 的爆发再给全体 +5%（0.3 s 衰减）
 *   · 平台（stage）改为纵向"咚"一下（Δy ≤4px）
 *   · 文字所在元素逐拍幅度 ≤3%（再大就糊边）
 *
 * 纯函数；读 playbackTime()（由 music-clock 在渲染作用域里设置）。
 * ========================================================================== */
import {rhythm, beatPos, LEAD, TAU} from './rhythm.mjs';
import {playbackTime} from './music-clock.mjs';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };

/** 各强度级的缩放幅度 */
export const POP_AMP = [0, 0.006, 0.016, 0.028];

/** 交错行波包络：x 位置决定延迟（0..0.5 拍），key 再错开最多 3/16 拍 */
export function staggerEnv(x, key = 0) {
  const t = playbackTime();
  if (!Number.isFinite(t)) return 0;
  const b = beatPos(t);
  const delay = (clamp(x / 1920) * 0.5 + (key % 4) * 0.0625) * b.P;
  let dt = b.f * b.P + LEAD - delay;
  if (dt < 0) dt += b.P;                      // 还没轮到本拍 → 用上一拍的余波
  return Math.exp(-dt / 0.16);
}

/** 这个元素此刻的缩放系数（1 = 不弹）。渲染作用域之外返回 1（保证 QA 里 stateAt 的锚点与基线一致） */
export function popScale(x, key = 0) {
  const t = playbackTime();
  if (!Number.isFinite(t)) return 1;
  const R = rhythm(t);
  if (R.level === 0) return 1;
  return 1 + POP_AMP[R.level] * (1 - 0.7 * R.inhale) * staggerEnv(x, key) + 0.05 * R.burst;
}

/** 平台纵向弹：返回 y 偏移（正=下沉），≤4px */
export function stageBounce(x, key = 0) {
  const t = playbackTime();
  if (!Number.isFinite(t)) return 0;
  const R = rhythm(t);
  if (R.level === 0) return 0;
  return 4 * staggerEnv(x, key) * R.gain;
}

/** 以 (cx,cy) 为中心、按 popScale 缩放地画一个 UI 元素 */
export function popDraw(g, cx, cy, x, key, fn) {
  const s = popScale(x, key);
  if (s === 1) { fn(); return; }
  g.save();
  g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy);
  fn();
  g.restore();
}

/** 欠阻尼弹簧：0→1，过冲约 12.6%，0.27s 内稳定。给"文字/气泡弹出"用 */
export function springPop(dt, zeta = 0.55, f = 3.5) {
  if (!(dt > 0)) return 0;
  const wn = TAU * f, k = Math.sqrt(1 - zeta * zeta), wd = wn * k;
  return 1 - Math.exp(-zeta * wn * dt) * (Math.cos(wd * dt) + (zeta / k) * Math.sin(wd * dt));
}
