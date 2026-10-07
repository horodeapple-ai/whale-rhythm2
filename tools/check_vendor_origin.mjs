/* 检查 vendor/rich-*.js 是不是参考工程（beidou070/let-me-go-code-mv）的原文件，
 * 用来判断"这个仓库里哪些代码是第三方的、能不能公开"。
 * 用法: node tools/check_vendor_origin.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const h = (p) => {
  try { const b = fs.readFileSync(p); return crypto.createHash('sha256').update(b).digest('hex').slice(0, 16) + '  ' + b.length + 'B'; }
  catch { return 'MISSING'; }
};
console.log('--- whale-rhythm2/vendor/ ---');
for (const f of fs.readdirSync(root + '/vendor')) if (f.endsWith('.js')) console.log('  ' + f.padEnd(16), h(root + '/vendor/' + f));
console.log('--- 参考工程（下载的，out/ref-repo/） ---');
for (const f of fs.readdirSync(root + '/out/ref-repo')) if (f.endsWith('.js')) console.log('  ' + f.padEnd(24), h(root + '/out/ref-repo/' + f));
console.log('--- vendor/ 其它内容 ---');
for (const f of fs.readdirSync(root + '/vendor')) console.log('  ' + f);
console.log('--- vendor/core, vendor/rigs ---');
for (const d of ['core', 'rigs']) {
  const p = root + '/vendor/' + d;
  if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) console.log('  ' + d + '/' + f.padEnd(18), h(p + '/' + f));
}
console.log('--- baseline/ ---');
for (const f of fs.readdirSync(root + '/baseline')) console.log('  ' + f);
console.log('--- docs/ ---');
console.log('  ' + fs.readdirSync(root + '/docs').join(', '));
console.log('--- 根 ---');
for (const f of fs.readdirSync(root)) if (fs.statSync(root + '/' + f).isFile()) console.log('  ' + f);
