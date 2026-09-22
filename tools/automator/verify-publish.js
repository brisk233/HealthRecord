// 上架产物模拟器验证：确认移除扩展层后主流程依然可用
// 用法：先 node tools/build-publish.js，再运行本脚本；之后 node tools/build-publish.js --restore

const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const PROJECT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(PROJECT, 'docs', 'screenshots');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✓ ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function textOf(page, sel) {
  const el = await page.$(sel);
  return el ? (await el.text()).trim() : null;
}
async function tapByText(page, sel, want) {
  const list = await page.$$(sel);
  for (const el of list) {
    const t = (await el.text()).trim();
    if (t.indexOf(want) !== -1) { await el.tap(); return true; }
  }
  return false;
}

(async function main() {
  const WS = process.env.ZZJ_WS || 'ws://127.0.0.1:9420';
  console.log('▶ 连接自动化服务 ' + WS);
  const miniProgram = await automator.connect({ wsEndpoint: WS });
  console.log('  ✅ 已连接\n');
  fs.mkdirSync(SHOTS, { recursive: true });

  console.log('== A. 上架产物 · 主流程 ==');
  const page = await miniProgram.navigateTo('/pages/zzj/zzj');
  // 注意：本机开发者工具较慢，页面首帧可能要 7-9 秒，等待必须给足
  await page.waitFor(9000);

  check('主页面可打开', (await textOf(page, '.hero .date')) === '掌中决');
  const scenes = await page.$$('.scene-item');
  check('场景卡 5 个', scenes.length === 5, scenes.length + ' 个');

  // 核心断言：扩展入口必须消失
  const rows = await page.$$('.row');
  let extSeen = false;
  for (const r of rows) {
    const t = await r.text();
    if (t.indexOf('寻物') !== -1 || t.indexOf('走向') !== -1) extSeen = true;
  }
  check('扩展入口已移除（寻物/走向不可见）', !extSeen);
  const note = await page.$('.ext-note');
  check('扩展提示文案已移除', !note);

  console.log('\n== B. 上架产物 · 抽取与白话解读 ==');
  await tapByText(page, '.scene-item', '今天吃什么');
  await page.waitFor(900);
  const chips = await page.$$('.opt-chip');
  check('预置选项可用', chips.length >= 6, chips.length + ' 个');
  await tapByText(page, '.opt-chip', '火锅');
  await tapByText(page, '.opt-chip', '日料');
  await sleep(500);

  const rollBtn = await page.$('.btn-primary');
  await rollBtn.tap();
  await sleep(600);
  const draw = await page.$('.draw-wrap');
  check('落宫动画可运行', !!draw);
  if (draw) await draw.tap();
  await page.waitFor(1400);

  const headline = await textOf(page, '.res-headline');
  check('白话结论渲染', !!headline && headline.length > 8, (headline || '').slice(0, 22) + '…');
  check('结论不含宫位名', !!headline && !/大安|留连|速喜|赤口|小吉|空亡/.test(headline));

  const layers = await page.$$('.layer');
  check('分层解读 3 层', layers.length === 3, layers.length + ' 层');
  const fqs = await page.$$('.fq');
  check('追问 4 条', fqs.length === 4, fqs.length + ' 条');
  const acts = await page.$$('.act-row');
  check('动作 3 条', acts.length === 3, acts.length + ' 条');

  await miniProgram.screenshot({ path: path.join(SHOTS, 'publish-result.png') });

  console.log('\n== C. 上架产物 · 科普页 ==');
  const kp = await miniProgram.navigateTo('/pages/zzj/knowledge');
  await kp.waitFor(8000);
  check('科普页可打开', (await textOf(kp, '.hero .date')) === '六宫小识');
  check('六宫一览 6 条', (await kp.$$('.kn-row')).length === 6);

  console.log('\n════════════════════════════');
  console.log('上架产物验证: ' + pass + ' 通过, ' + fail + ' 失败');
  await miniProgram.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (e) {
  console.error('\n❌ 执行失败:', e && e.message ? e.message : e);
  process.exit(2);
});
