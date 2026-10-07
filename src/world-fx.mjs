/* ============================================================================
 * src/world-fx.mjs —— 世界层：背景不再是死图
 * ----------------------------------------------------------------------------
 * 原工程的背景是**一次性绘进缓存位图**的（opening-sample.mjs book()），全片 76 镜
 * 只做一次 drawImage —— 所以"画面平淡"里最要命的一条是：**场景里一个会动的东西都没有**。
 *
 * 这一层的做法（用户要求：跟拍要发生在画面里的元素上，不要整屏闪/抖）：
 *   a 屏幕均衡条  7 块拱门屏里的 3 条"请求条"按 lo/mid/hi 三个频段的包络伸缩，
 *                 每块比前一块晚 1/8 拍 → 一条从左到右的行波
 *   b 灯笼光晕    4 盏吊灯处叠加径向光晕，亮度随拍/高频/爆发
 *   c 中央辉光    拱门中心的青色辉光，按拍呼吸；DROP 时转暖
 *   d 地砖金线    地面 4 条高光线，在小节首拍亮一下
 *   e 光点/纸屑   三层视差的光点 + DROP 时爆出的纸屑（纯色小矩形，最多 60 片）
 *
 * 全部是 t 的纯函数；只用 fillRect / 简单渐变，不用 piece()（它带纸纤维+描边+投影）。
 * 全屏叠层 ≤3 层/帧。
 * ========================================================================== */
import {rhythm, eventsNear, loop, stagger, TAU, MOTION} from './rhythm.mjs';
import {hash2} from '../vendor/core/util.js';
/* ★ 幅度总表（2026-10-08「提高一档」，全片倍率 MOTION=1.4，上限同步放宽）：
 *   屏幕均衡条摆动 0.30+0.70 → 游程 ×1.4（摆动更大、低点更空）
 *   灯笼光晕 a×1.4、半径 96+46 → 100+62、α 上限 0.42 → 0.58
 *   中央辉光 a×1.4、α 上限 0.30 → 0.36（故意少放，避免整屏发白）
 *   地砖金线 a×1.4、α 上限 0.5 → 0.62；地灯光池 ×1.4、上限 0.30 → 0.38
 *   光点推力 60 → ×1.4、尺寸 1+0.5 → 1+0.7、闪烁 0.18+0.5 → 0.16+0.62
 *   纸屑初速 0.7+0.5k → 0.8+0.6k、DROP 片数 48 → 56（仍 ≤60 上限）
 * 相机与角色不在其中（红线），见 rhythm.mjs 的 MOTION 注释。 */

const W = 1920, H = 1080;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };

/* ---- 拱门上的 7 块屏（与 original-world-detail.mjs 的 screen() 同坐标） ---- */
export const SCREENS = [0, 1, 2, 3, 4, 5, 6].map((i) => [345 + i * 190, 185 + Math.abs(i - 3) * 39, 125, 79, i]);
export const LANTERNS = [[115, 144], [1770, 195], [300, 280], [1570, 108]];
const FLOOR_LINES = [803, 871, 958, 1042];

/* ===== a. 屏幕里的"请求条"：按频段伸缩 + 1/8 拍行波 ===== */
function screenBars(g, t) {
  const R = rhythm(t);
  const env = [R.lo, R.mid, R.hi];
  // L0/L1 段没有逐拍反应 → 用 8 拍呼吸慢慢摆，避免"安静段还在抖"
  const slow = R.breath * 0.35;
  SCREENS.forEach(([x, y, w, h, i]) => {
    const ph = i / 8;                                  // 每块晚 1/8 拍 → 行波
    const lag = env.map((e, j) => Math.max(e, (R.level <= 1 ? slow : 0) * (0.5 + 0.5 * Math.cos(TAU * (loop(t - ph * R.P, 8) + j)))));
    g.save();
    for (let j = 0; j < 3; j++) {
      const base = (w - 31 - j * 17);
      const ww = base * (0.30 + 0.70 * clamp(lag[j] * MOTION));
      const yy = y + 29 + j * 13;
      const cool = i % 2 === 1;
      g.fillStyle = cool ? '#0f6c86' : '#8a5a25';       // 槽底
      g.fillRect(x + 14, yy, base, 2.5);
      g.fillStyle = cool ? '#8ff4ef' : '#ffe9b0';       // 亮条
      g.fillRect(x + 14, yy, ww, 2.5);
    }
    g.restore();
  });
}

/* ===== b. 灯笼光晕（灯笼本体在缓存里，这里只叠光） ===== */
function lanternGlow(g, t) {
  const R = rhythm(t);
  LANTERNS.forEach(([x, y], i) => {
    const ph = stagger(i, 0.25);
    const a = MOTION * (0.10 * R.beat * (0.7 + 0.3 * Math.cos(TAU * (loop(t, 4) + ph))) + 0.05 * R.hi + 0.16 * R.burst);
    if (a <= 0.004) return;
    const r0 = 30, r1 = 100 + 62 * clamp(R.burst);
    const gr = g.createRadialGradient(x, y + 22, r0, x, y + 22, r1);
    gr.addColorStop(0, `rgba(255,236,170,${Math.min(0.58, a)})`);
    gr.addColorStop(1, 'rgba(255,222,140,0)');
    g.fillStyle = gr;
    g.fillRect(x - r1, y - r1 + 22, r1 * 2, r1 * 2);
  });
}

/* ===== c. 拱门中央辉光（按拍呼吸；DROP 转暖） ===== */
function centralGlow(g, t) {
  const R = rhythm(t);
  const a = MOTION * (0.05 * R.breath + 0.075 * (0.6 * R.beat + 0.4 * R.lo) + 0.10 * R.burst);
  if (a <= 0.004) return;
  const warm = R.burst > 0.25;
  const gr = g.createRadialGradient(1070, 500, 40, 1070, 500, 700);
  gr.addColorStop(0, warm ? `rgba(255,214,120,${Math.min(0.40, a)})` : `rgba(73,199,218,${Math.min(0.40, a)})`);
  gr.addColorStop(1, 'rgba(31,102,194,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

/* ===== d. 地砖金线：小节首拍亮一下（只在 L≥2） ===== */
function floorLines(g, t) {
  const R = rhythm(t);
  if (R.level < 2) return;
  const a = MOTION * 0.35 * R.beat;
  if (a <= 0.01) return;
  g.save();
  g.globalAlpha = Math.min(0.62, a);
  g.fillStyle = '#fff6d8';
  for (const y of FLOOR_LINES) g.fillRect(0, y, W, 1.6);
  // 台前三团地灯光池（往亮色地板上"加光"看不见，所以用有颜色的琥珀光池）
  const fa = Math.min(0.44, MOTION * 0.20 * (0.35 + 1.25 * R.beat + 0.7 * R.lo + 0.9 * R.burst));
  if (fa > 0.01) {
    g.globalAlpha = 1;
    [[430, 1002], [960, 1006], [1490, 1000]].forEach(([x, y], i) => {
      const gr = g.createRadialGradient(x, y, 6, x, y, 300);
      gr.addColorStop(0, `rgba(255,176,58,${fa})`);
      gr.addColorStop(0.5, `rgba(255,196,92,${fa * 0.55})`);
      gr.addColorStop(1, 'rgba(255,206,120,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, y, 310, 92, 0, 0, TAU); g.fill();
    });
  }
  g.restore();
}

/* ===== e. 光点（三层视差）+ DROP 纸屑 ===== */
const MOTE_TINT = ['#fff0cd', '#ffe0a0', '#ffd27a'];
function motes(g, t) {
  const R = rhythm(t);
  const speed = (R.level >= 3 ? 1.6 : 1) * (1 - 0.5 * R.inhale);
  const push = MOTION * 60 * R.beat;
  const layers = [[22, 2, 7], [14, 3.2, 15], [8, 5, 30]];
  for (let L = 0; L < layers.length; L++) {
    const [count, sz, spd] = layers[L];
    for (let i = 0; i < count; i++) {
      const seed = L * 31 + i;
      const base = hash2(seed, 11);
      // 竖直缓慢上浮 + 拍点推力；水平缓慢右漂
      const y = ((base * 700 - t * spd * speed - push * (L + 1)) % 760 + 760) % 760 + 120;
      const x = (hash2(seed, 23) * W + t * spd * 0.35 * speed) % W;
      const tw = 0.35 + 0.65 * Math.max(R.hi, R.beat * (0.6 + 0.4 * hash2(seed, 7)));
      g.fillStyle = MOTE_TINT[L];
      g.globalAlpha = 0.16 + 0.62 * tw * (1 - L * 0.18);
      const s = sz * (1 + 0.7 * R.beat);
      g.fillRect(x, y, s, s);
    }
  }
  g.globalAlpha = 1;
}

/* ---- 纸屑：只用纯色扁矩形，确定性（hash2），≤60 片 ---- */
const CONF = ['#f0b941', '#fff0cd', '#ef8564', '#49c7da', '#b8eff2'];
const confetti = (g, t, t0, x0, y0, { n = 36, seed = 1, life = 1.1, power = 1 } = {}) => {
  const dt = t - t0 + 1 / 60; if (dt < 0 || dt > life) return 0;
  const N = Math.min(60, n);
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (hash2(seed, i) - 0.5) * 2.4, v = (360 + hash2(seed + 7, i) * 520) * power;
    const x = x0 + Math.cos(a) * v * dt, y = y0 + Math.sin(a) * v * dt + 0.5 * 980 * dt * dt;
    const r = 6 + hash2(seed + 3, i) * 9;
    g.save();
    g.globalAlpha = Math.max(0, 1 - smooth(dt / life)) * 0.95;
    g.translate(x, y); g.rotate((hash2(seed + 5, i) - 0.5) * 42 * dt + i);
    g.fillStyle = CONF[i % CONF.length];
    g.fillRect(-r / 2, -r * 0.3, r, r * 0.6);
    g.restore();
  }
  return N;
};

/* ---- DROP/事件时的纸屑：从舞台中心爆出（确定性；遍历 events 表，1.1s 寿命） ---- */
function eventBursts(g, t) {
  for (const { e, dt } of eventsNear(t, 1.1, 0.2)) {
    const k = e.kind === 'DROP' ? 1 : e.kind === 'hit' ? 0.5 : e.kind === 're-entry' ? 0.35 : 0;
    if (k <= 0) continue;
    confetti(g, t, e.t, 960, 640, { n: k === 1 ? 56 : 16, seed: 17 + Math.round(e.t * 10), life: 1.1, power: 0.8 + 0.6 * k });
  }
}

/** 世界层总入口：在 book() 里 drawImage(worldCache) 之后调用 */
export function drawWorldFx(g, t) {
  if (!Number.isFinite(t)) return;
  screenBars(g, t);
  lanternGlow(g, t);
  centralGlow(g, t);
  floorLines(g, t);
  motes(g, t);
  eventBursts(g, t);
}
