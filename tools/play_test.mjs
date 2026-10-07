/* 真实播放测试：点"播放"让音频真的走一段，检查画面有没有跟着走（而不是停在某帧）
 * 用法: node tools/play_test.mjs [--from=13.4] [--to=18] [--file=...]
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
const from = Number(args.from ?? 13.4), to = Number(args.to ?? 18);
const { chromium } = require('/Users/li/.zcode/workspace/default/dalabengba-repro/node_modules/playwright-core');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
await page.waitForFunction(() => /已就绪/.test(document.getElementById('status')?.textContent || ''), null, { timeout: 60000 });

await page.evaluate((t) => window.__sampleSeek(t), from);
await page.click('#play');
console.log(`从 ${from}s 开始播放，等它走到 ${to}s ...`);
const t0 = Date.now();
let last = null, stalls = 0;
const budget = Math.max(60000, (to - from) * 1600 + 30000);   // 1.6× 实时 + 30s 余量（够整片跑完）
let worstLag = 0;
while (Date.now() - t0 < budget) {
  const d = await page.evaluate(() => window.__sampleDebug());
  last = d;
  worstLag = Math.max(worstLag, Math.abs(d.time - d.rendered));
  if (d.time >= to) break;
  await page.waitForTimeout(400);
}
await page.click('#pause');
const d = await page.evaluate(() => window.__sampleDebug());
console.log(JSON.stringify({ playing: d.playing, audioTime: +d.time.toFixed(2), renderedTime: +d.rendered.toFixed(2), shot: d.shot }, null, 1));
const lag = Math.abs(d.time - d.rendered);
console.log(`音画差 ${lag.toFixed(2)}s（全程最大 ${worstLag.toFixed(2)}s） ${lag < 0.35 ? '✅ 画面跟着音频走' : '❌ 画面停在后面（疑似卡死）'}`);
console.log('页面错误：', errs.length ? errs : '无');
await browser.close();
process.exit((errs.length || lag >= 0.35) ? 1 : 0);
