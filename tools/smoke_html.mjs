/* 浏览器冒烟：打开单文件 HTML，跳帧截图 + 读渲染耗时/异常
 * 用法: node tools/smoke_html.mjs [--file=<html路径>] [--at=41.867,65.167] [--out=qa/web]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.split('='); return [k.replace(/^--/, ''), v.join('=') || true]; }));
const CHROME = args.chrome || 'C:/Users/li/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const file = args.file || root + '/output/DeepSeek-Whale-Cutpaper-Full-Film.html';
const outDir = args.out || root + '/qa/web';
fs.mkdirSync(outDir, { recursive: true });
const { chromium } = require('/Users/li/.zcode/workspace/default/dalabengba-repro/node_modules/playwright-core');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
await page.waitForFunction(() => /已就绪|失败|错/.test(document.getElementById('status')?.textContent || ''), null, { timeout: 60000 });
const status = await page.textContent('#status');
console.log('状态：', status);

/* ★ 默认**扫遍全片**（每 55 帧一个采样点 + 5 个已知关键点）：
 *   只抽几个时间点是不够的 —— 曾经因为某个镜头分支里少 import 一个符号，
 *   浏览器里 renderFrame 抛错 → rAF 链断掉 → 画面停住而音频继续（"播到某处卡死"），
 *   而当时那 5 个抽样点恰好都没落进那个镜头。 */
const times = [];
if (args.at) times.push(...String(args.at).split(',').map(Number));
else {
  times.push(8.0, 41.867, 65.167, 84.367, 138.633);
  for (let f = 10; f < 4201; f += 55) times.push(+(f / 30).toFixed(3));
}
const bad = [];
for (const t of times) {
  const r = await page.evaluate((t) => { try { window.__sampleSeek(t); return null; } catch (e) { return e.message; } }, t);
  if (r) bad.push({ t, msg: r });
}
console.log(`渲染抽样 ${times.length} 个时刻：${bad.length ? '❌ ' + JSON.stringify(bad.slice(0, 8)) : '✅ 全部渲染通过'}`);

const ms = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 5; i++) window.__sampleSeek(70 + i * 0.033); return (performance.now() - t0) / 5; });
const worst = await page.evaluate(() => { let m = 0; for (let i = 0; i < 120; i++) { const a = performance.now(); window.__sampleSeek(70 + i / 30); m = Math.max(m, performance.now() - a); } return m; });
console.log(`单帧渲染 平均 ${ms.toFixed(1)}ms；连续 120 帧里最慢 ${worst.toFixed(1)}ms ${worst > 40 ? '⚠ 实时播放可能卡顿' : '✅'}`);

for (const t of (args.at ? String(args.at).split(',').map(Number) : [8.0, 41.867, 65.167, 84.367, 138.633])) {
  const dbg = await page.evaluate((t) => window.__sampleSeek(t), t);
  const name = `t${t.toFixed(3).replace('.', '_')}_${dbg.shot.replace(/[^A-Za-z0-9-]/g, '')}.png`;
  await page.locator('#stage').screenshot({ path: outDir + '/' + name });
  console.log(JSON.stringify({ t, shot: dbg.shot, file: name }));
}
console.log('页面错误：', errs.length ? errs : '无');
await browser.close();
process.exit(bad.length || errs.length ? 1 : 0);
