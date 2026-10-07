/* 由 beat-map.json 生成 src/beat-data.mjs（一次性脚本） */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const src = process.argv[2] || 'C:/Users/li/.zcode/workspace/default/whale-dyn-audit/_incoming/大肥鱼_画面律动修改意见/beat-map.json';
const d = JSON.parse(fs.readFileSync(src, 'utf8'));
const header = `/* 实测节拍表（由 beat-map.json 生成，勿手改）\n`
  + ` * 来源：对 assets/song.m4a 做 STFT / 自相关 / 锁相环逐拍追踪（复现脚本见 tools 里的验证程序）\n`
  + ` * 为什么不用 vendor/rich-song.js 的 128.35 恒速网格：\n`
  + ` *   这首歌速度在 126–131 BPM 之间变化，恒速网格越到后面越漂；\n`
  + ` *   实测 70–100s 段"正拍/反拍"的低频起音能量比只有 0.80×（<1，即网格点上的鼓比反拍还少）。\n`
  + ` *   同段用本表则是 2.41×。\n`
  + ` */\n`;
fs.writeFileSync(root + '/src/beat-data.mjs', header + 'export const BEAT_DATA = ' + JSON.stringify(d) + ';\n');
console.log('beat-data.mjs bytes =', fs.statSync(root + '/src/beat-data.mjs').size);
console.log('beats =', d.beats.length, d.beats[0], '→', d.beats[d.beats.length - 1]);
console.log('sections =', d.sections.length, 'events =', d.events.length, 'drops =', d.drops.length);
console.log('slots len =', d.slots.lo.length, d.slots.mid.length, d.slots.hi.length);
console.log('longBeats =', JSON.stringify(d.longBeats));
for (const s of d.sections) console.log(`  ${s.id.padEnd(12)} ${s.start.toFixed(2)}–${s.end.toFixed(2)}  low=${s.lowEnd}  L${s.level}  anchor=${s.barAnchor}  ${s.bpmMean} BPM`);
