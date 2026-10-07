/* ============================================================================
 * src/rhythm.mjs —— 节奏总线（本片唯一的"时间与强弱"来源）
 * ----------------------------------------------------------------------------
 * 三张表 + 一个函数：
 *   ① 实测节拍表  beat-data.mjs 的 beats（301 个真实拍点）—— 什么时候是拍
 *   ② 16 分槽位打击谱 slots（lo/mid/hi）—— 每个槽位上音乐里有没有一记、哪个频段
 *   ③ 段落/强度表 sections（按"次低频在场/缺席"划分，L0~L3）—— 该多大
 *  → rhythm(t) 返回一组 0..1 的包络；相机、世界层、纸片 UI、文字全部只读它。
 *
 * ★ 为什么不沿用恒速网格（BPM=128.35 / 首拍 0.264）：
 *   这首歌速度在 126–131 BPM 之间变化。恒速网格只在副歌 1（27–50 s）对得上，
 *   越往后越漂：独立实测（tools 里 verify_beats.mjs）"正拍 vs 反拍"的低频起音
 *   能量比——
 *       全片   恒速 1.43×   本表 2.06×
 *       前 50s 恒速 2.05×   本表 2.31×
 *       70–100s 恒速 0.80×（<1，网格落到反拍上）  本表 2.41×
 *       110–140s 恒速 1.10×  本表 1.34×
 *   也就是说：拿恒速网格做"跟拍"，全片最响的那 30 秒正好是踩反拍。
 *
 * ★ 用户定的三条红线（本项目必须遵守）：
 *   不做整屏闪帧 / 不做相机抖动 / 角色完全不动（不形变、部件也不转）。
 *   所以本模块**不提供 flash / shake / roll**；重音的能量全部走"画面里的元素"
 *   （屏幕均衡条、灯笼光晕、地砖金线、粒子、纸片 UI 弹跳），见 world-fx.mjs。
 *
 * 纯函数：只用 t 算，无 Math.random / 无跨帧状态；rhythm() 对同一 t 有 1 条缓存。
 * ========================================================================== */
import { BEAT_DATA as D } from './beat-data.mjs';

export const FPS = 30;
export const LEAD = 0.5 / FPS;          // 半帧提前量：事件落在两帧之间时，最近的那一帧就是"第 0 帧"
export const TAU = Math.PI * 2;

const BEATS = D.beats, N = BEATS.length;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };

/* ---------- 1. 拍：唯一的"拍号 ↔ 时间"关系（分段线性插值） ---------- */
/** t 所在的拍：{i 拍序号, f 拍内相位 0..1, P 本拍时长} */
export function beatPos(t) {
  if (t <= BEATS[0]) { const P = BEATS[1] - BEATS[0]; return { i: 0, f: (t - BEATS[0]) / P, P }; }
  if (t >= BEATS[N - 1]) { const P = BEATS[N - 1] - BEATS[N - 2]; return { i: N - 2, f: (t - BEATS[N - 2]) / P, P }; }
  let lo = 0, hi = N - 2;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (BEATS[m] <= t) lo = m; else hi = m - 1; }
  const P = BEATS[lo + 1] - BEATS[lo];
  return { i: lo, f: (t - BEATS[lo]) / P, P };
}
/** 秒 → 连续拍号（小数），分段线性、单调 */
export const kOf = (t) => { const b = beatPos(t); return b.i + b.f; };
/** 拍号（可小数）→ 秒。cue(56.5) 是该拍的反拍 */
export function cue(k) { const i = clamp(Math.floor(k), 0, N - 2); return BEATS[i] + (k - i) * (BEATS[i + 1] - BEATS[i]); }
/** 整数帧版（切点数组 / 钉帧用这个） */
export const cueFrame = (k) => Math.round(cue(k) * FPS);
/** 本拍时长（秒） */
export const periodAt = (t) => beatPos(t).P;
/** 循环相位 0..1：每 n 拍一圈。替换所有 Math.sin(T*任意数) / beatCycles */
export const loop = (t, n = 2, phaseBeats = 0) => { const x = (kOf(t) - phaseBeats) / n; return x - Math.floor(x); };
/** 吸附到最近的 1/unit 拍（1=拍，2=八分，4=十六分），返回秒 */
export const snap = (t, unit = 2) => cue(Math.round(kOf(t) * unit) / unit);
/** 吸附后的整数帧 */
export const snapFrame = (t, unit = 2) => Math.round(snap(t, unit) * FPS);

/* ---------- 2. 16 分槽位打击谱 ---------- */
const SLOT_T = [];
for (let i = 0; i < N - 1; i++) for (let q = 0; q < 4; q++) SLOT_T.push(BEATS[i] + q * (BEATS[i + 1] - BEATS[i]) / 4);
const mk = (s, thr) => { const o = []; for (let n = 0; n < s.length; n++) { const v = +s[n]; if (v >= thr) o.push([SLOT_T[n], v / 9]); } return o; };
const HITS = { lo: mk(D.slots.lo, 3), mid: mk(D.slots.mid, 3), hi: mk(D.slots.hi, 3) };
/** 某个频段的起音包络（0..1），τ 为衰减时间常数（秒） */
export function bandEnv(band, t, tau = 0.12) {
  const H = HITS[band]; if (!H) return 0;
  let lo = 0, hi = H.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (H[m][0] <= t + LEAD) lo = m + 1; else hi = m; }
  let best = 0;
  for (let j = lo - 1; j >= 0 && t - H[j][0] < tau * 6; j--) best = Math.max(best, H[j][1] * Math.exp(-(t - H[j][0] + LEAD) / tau));
  return best;
}
/** 该槽位有没有一记（判据同 §6.3）：max(lo,mid) */
export const slotStrength = (t) => Math.max(bandEnv('lo', t, 0.05), bandEnv('mid', t, 0.05));
/** 16 分槽位号 k16（= 拍序号*4 + 拍内第几个 16 分）上的谱字符 */
export function slotChar(k16) {
  const i = Math.max(0, Math.min(D.slots.lo.length - 1, Math.round(k16)));
  return { lo: +D.slots.lo[i], mid: +D.slots.mid[i], hi: +D.slots.hi[i] };
}
/** 该槽位上"音乐里有没有一记"：强 >=5，有 >=3，弱 <3（用于接触点吸附的判据） */
export function slotHasHit(k16, thr = 3) { const c = slotChar(k16); return c.lo >= thr || c.mid >= thr; }

/* ---------- 3. 段落与强度级 ---------- */
export const GAIN = [0, 0.35, 0.7, 1.0];          // L0..L3 的幅度增益
export const ACCENT_W = [1.0, 0.55, 0.75, 0.55];  // 小节内第 1~4 拍的权重
/* 全局律动幅度增益（用户 2026-10-08：「动态感或者说是抖动，提高一档」）。
 * 只作用在**元素层**：world-fx 的屏幕均衡条/灯笼光晕/中央辉光/地砖金线/光点/纸屑，
 * 以及 rhythm-fx 的纸片 UI 弹跳（那边另有保守上限，见该文件）。
 * **不作用于相机**（红线：相机只允许极轻微推近/暗角，cameraFx 里的系数维持原值）
 * **也不作用于角色**（角色完全不动）。想再提一档就改这一个数——
 * 注意 world-fx 里有几处亮度上限是按 1.4 配的，若调到 1.8 以上要一并复查那些 Math.min。 */
export const MOTION = 1.6;
const SEC_LEAD = 1 / FPS;                         // 段落边界提前一帧：DROP 那一帧就按新段落的强度算
export function sectionAt(t) { let s = D.sections[0]; for (const x of D.sections) { if (t >= x.start - SEC_LEAD) s = x; else break; } return s; }
/** 小节内第几拍（0..3），从该段第一个整拍起算 */
export function barBeat(t) { const s = sectionAt(t); return (((beatPos(t).i - s.barAnchor) % 4) + 4) % 4; }

/* ---------- 4. 每拍包络 ---------- */
/** 拍点起 1 → 0 的指数衰减（0..1） */
export function beatEnv(t, tau = 0.14) {
  const b = beatPos(t); let dt = b.f * b.P + LEAD; if (dt > b.P) dt -= b.P;
  return dt < 0 ? 0 : Math.exp(-dt / tau);
}

/* ---------- 5. 结构事件（DROP / hit / re-entry / stab / cut） ---------- */
export function eventsNear(t, back = 1.5, ahead = 1.0) {
  const out = [];
  for (const e of D.events) { const dt = t - e.t; if (dt > -ahead && dt < back) out.push({ e, dt }); }
  return out;
}
const KIND_K = { DROP: 1, hit: 0.55, 're-entry': 0.4, stab: 0.25 };   // cut 的力度是 0（次低频离场＝"收"）
/** 事件共用的"吸气—爆发"包络：inhale = 事件前 0.47s 内 0→k；burst = 事件后 k·e^(-d/0.30) */
export function eventShape(t) {
  let inhale = 0, burst = 0;
  for (const { e, dt } of eventsNear(t)) {
    const k = KIND_K[e.kind] || 0; if (!k) continue;
    const d = dt + LEAD;
    if (d < 0) inhale = Math.max(inhale, k * smooth(1 + d / 0.47));
    else burst = Math.max(burst, k * Math.exp(-d / 0.30));
  }
  return { inhale, burst };
}

/* ---------- 6. 总线（同一 t 只算一次） ---------- */
let _t = NaN, _r = null;
export function rhythm(t) {
  if (t === _t) return _r;
  const b = beatPos(t), s = sectionAt(t), ev = eventShape(t);
  const g = GAIN[s.level] * (1 - 0.7 * ev.inhale);          // "吸气"时各层逐拍反应自动回落
  _t = t;
  return (_r = {
    t, i: b.i, f: b.f, P: b.P, section: s, level: s.level, gain: g, inhale: ev.inhale, burst: ev.burst,
    breath: 0.5 - 0.5 * Math.cos(TAU * loop(t, 8)),         // 8 拍一次的缓慢呼吸（所有级别都有，L0 的主要律动）
    beat: beatEnv(t) * ACCENT_W[barBeat(t)] * g,
    lo: bandEnv('lo', t) * g, mid: bandEnv('mid', t) * g, hi: bandEnv('hi', t) * g,
  });
}

/* ---------- 7. 相机的节奏分量（克制版：只推近 + 吸气拉远 + 暗角；无抖动/无闪/无 roll） ----------
 * 用户明确否掉了"整屏闪帧 + 相机抖动"，所以这里只保留三样：
 *   · 逐拍轻推（相机缓慢呼吸，不是抖）
 *   · DROP 前的"吸气"：缓慢拉远 + 暗角加深（这是"对比"的来源，不是闪）
 *   · DROP 的爆发：推近（τ=0.3s 衰减），能量同时交给世界层（屏幕/灯笼/粒子）
 * 返回值都是**增量**，由 cameraAt 叠加；不污染 impact（QA 依赖 impact 的含义）。 */
export function cameraFx(t) {
  const R = rhythm(t);
  let zoom = 0.016 * R.beat + 0.012 * R.lo + 0.003 * R.breath;
  let vignette = 0.05 * R.beat;                     // 小节首拍极轻的暗角呼吸
  for (const { e, dt } of eventsNear(t)) {
    const k = KIND_K[e.kind] || 0; if (!k) continue;
    const d = dt + LEAD;
    if (d < 0) { const q = smooth(1 + d / 0.47); zoom -= 0.030 * k * q; vignette += 0.22 * k * q; }   // 吸气：收
    else zoom += 0.052 * k * Math.exp(-d / 0.30);                                                     // 爆发：推（无闪无抖）
  }
  return { zoom, vignette };
}

/* ---------- 8. 元素层用的小工具 ---------- */
/** 第 i 个同类元素在拍/爆发上的相位错开：spread 以"拍"为单位 */
export const stagger = (i, spread = 0.22) => i * spread;
/** 光源/元件的脉冲：拍点最强，重音再叠一层。peak≈1.0，重音≈1.7 */
export const lampPulse = (t, i = 0, spreadP = 0.125) => {
  const R = rhythm(t);
  const ph = stagger(i, spreadP);
  const w = 0.75 + 0.25 * Math.cos(TAU * (loop(t, 8) + ph));
  return 0.30 + 1.05 * R.beat * w + 0.55 * R.lo + 0.9 * R.burst;
};
