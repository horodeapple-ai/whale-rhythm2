/* 对照探针：把 300–3400Hz 包络按 0.25s 打表，并在歌词行起点处打标记 <=词
 * node tools/lyric_probe.cjs [--from=9] [--to=60] */
const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const from = Number(args.from || 9), to = Number(args.to || 60);
const buf = fs.readFileSync('qa/song.pcm'); const n = buf.length >> 1;
const x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
const FS = 16000;
const mk = (f0, hp) => { const w = 2 * Math.PI * f0 / FS, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Math.SQRT1_2);
  return hp ? [(1 + c) / 2, -(1 + c), (1 + c) / 2, -2 * c / (1 + al), (1 - al) / (1 + al)] : [(1 - c) / 2, 1 - c, (1 - c) / 2, -2 * c / (1 + al), (1 - al) / (1 + al)]; };
const bi = a => sig => { const y = new Float64Array(sig.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < sig.length; i++) { const xi = sig[i], yi = a[0] * xi + a[1] * x1 + a[2] * x2 - a[3] * y1 - a[4] * y2; x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi; } return y; };
const y = bi(mk(3400, false))(bi(mk(300, true))(x));
const hop = 160, win = 640, fr = Math.floor(n / hop), e = new Float64Array(fr);
for (let f = 0; f < fr; f++) { let s = 0; const a = Math.max(0, (f * hop - win) >> 1), b = Math.min(n, a + win); for (let i = a; i < b; i++) s += y[i] * y[i]; e[f] = Math.sqrt(s / (b - a)); }
const sm = new Float64Array(fr); for (let f = 0; f < fr; f++) { let s = 0, c = 0; for (let k = -10; k <= 10; k++) { const i = f + k; if (i >= 0 && i < fr) { s += e[i]; c++; } } sm[f] = s / c; }
globalThis.window = global; require('../vendor/rich-song.js');
const marks = new Map(); for (const l of window.SONG.lyrics) marks.set(Math.round(l.t * 4), l.en.slice(0, 22));
const rows = [];
for (let q = Math.round(from * 4); q <= Math.round(to * 4); q++) {
  const t = q / 4, f = Math.round(t * FS / hop);
  if (f >= fr) break;
  rows.push(t.toFixed(2).padStart(6) + '  ' + (sm[f] * 100).toFixed(0).padStart(2) + (marks.has(q) ? '  <= ' + marks.get(q) : ''));
}
console.log(rows.join('\n'));
