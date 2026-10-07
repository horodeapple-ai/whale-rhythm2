/* 播放器控件测试：检查合并后的切换键 + 空格键
 * 用法: node tools/player_test.mjs [--file=...]
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
const { chromium } = require('/Users/li/.zcode/workspace/default/dalabengba-repro/node_modules/playwright-core');

const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
await page.waitForFunction(() => /已就绪/.test(document.getElementById('status')?.textContent || ''), null, { timeout: 60000 });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const dbg = () => page.evaluate(() => window.__sampleDebug());
const label = () => page.textContent('#toggle');
const nBtn = () => page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.id));

console.log('=== 按钮布局 ===');
const ids = await nBtn();
console.log('  按钮：', ids.join(', '));
ok(ids.includes('toggle'), '存在合并后的切换键 #toggle');
ok(!ids.includes('play') && !ids.includes('pause'), '旧的 #play / #pause 已移除');
ok((await label()).trim() === '播放', `初始按钮文字 = "${await label()}"`);

console.log('\n=== 点按钮：播放 → 暂停 → 播放 ===');
await page.click('#toggle'); await page.waitForTimeout(700);
let d = await dbg();
ok(d.playing && d.time > 0, `点一下开始播放（time=${d.time.toFixed(2)}，playing=${d.playing}）`);
ok((await label()).trim() === '暂停', `播放中按钮文字 = "${await label()}"`);
const t1 = d.time;
await page.click('#toggle'); await page.waitForTimeout(500);
d = await dbg();
ok(!d.playing, `再点一下暂停（playing=${d.playing}）`);
ok((await label()).trim() === '播放', `暂停后按钮文字 = "${await label()}"`);
ok(Math.abs(d.time - t1) < 0.7, `暂停后音频不再前进（${t1.toFixed(2)} → ${d.time.toFixed(2)}）`);
await page.click('#toggle'); await page.waitForTimeout(500);
d = await dbg();
ok(d.playing, '再点一下继续播放');

console.log('\n=== 空格键 ===');
await page.evaluate(() => document.activeElement && document.activeElement.blur());   // 焦点移出按钮
await page.keyboard.press('Space'); await page.waitForTimeout(500);
d = await dbg();
ok(!d.playing, `空格暂停（playing=${d.playing}）`);
ok((await label()).trim() === '播放', `按钮文字跟着变 = "${await label()}"`);
await page.keyboard.press('Space'); await page.waitForTimeout(600);
d = await dbg();
ok(d.playing, '空格继续播放');
ok((await label()).trim() === '暂停', `按钮文字 = "${await label()}"`);

console.log('\n=== 空格不会把按钮触发两次（点击后按钮仍带焦点）===');
await page.click('#replay'); await page.waitForTimeout(600);
let d0 = await dbg();
ok(d0.playing && d0.time < 2, `"从头播放"把时间归零（time=${d0.time.toFixed(2)}）`);
await page.focus('#toggle');
await page.keyboard.press('Space'); await page.waitForTimeout(400);
const dA = await dbg();
await page.waitForTimeout(300);
const dB = await dbg();
ok(dA.playing === dB.playing, `焦点在按钮上时按空格只切换一次（${dA.playing} → ${dB.playing}）`);

console.log('\n=== 页面滚动 ===');
await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
await page.waitForTimeout(200);
const before = await page.evaluate(() => window.scrollY);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.scrollY);
ok(after === before, `焦点不在按钮上时，按空格不会把页面滚下去（${before} → ${after}）`);
await page.keyboard.press('Space');   // 切回去，别影响后续

console.log('\n页面错误：', errs.length ? errs : '无');
console.log(`\n通过 ${pass} / 失败 ${fail}`);
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
