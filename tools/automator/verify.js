// 掌中决 · 微信开发者工具模拟器实点验证（QA 铁律第 8 条）
//
//   node tools/automator/verify.js
//
// 用 miniprogram-automator 驱动真实 IDE 模拟器，真实点按页面、真实执行 WXML/JS。
// 产出：docs/screenshots/*.png + 控制台结论

const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

const CLI = 'D:\\develop\\微信web开发者工具\\cli.bat';
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
  if (!el) return null;
  return (await el.text()).trim();
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
  // Windows 下 automator.launch() 无法直接 spawn cli.bat（EINVAL），
  // 因此改为两步：先用 `cli.bat auto --project <路径> --auto-port 9420` 起服务，再 connect。
  //   & "$CLI" auto --project "$PROJECT" --auto-port 9420
  const WS = process.env.ZZJ_WS || 'ws://127.0.0.1:9420';
  console.log('▶ 连接开发者工具自动化服务 ' + WS + ' …');
  const miniProgram = await automator.connect({ wsEndpoint: WS });
  console.log('  ✅ 已连接模拟器\n');
  fs.mkdirSync(SHOTS, { recursive: true });

  // ═══ 1. 主页面：场景选择 ═══
  console.log('== 1. 主页面 · 场景选择 ==');
  const page = await miniProgram.navigateTo('/pages/zzj/zzj');
  await page.waitFor(9000);   // 本机开发者工具较慢，首帧可能 7-9 秒

  const title = await textOf(page, '.hero .date');
  check('主页面标题渲染', title === '掌中决', title || '(空)');

  const scenes = await page.$$('.scene-item');
  check('场景卡数量 = 5', scenes.length === 5, String(scenes.length));

  const extRows = await page.$$('.row');
  let extFound = false;
  for (const r of extRows) { const t = await r.text(); if (t.indexOf('寻物') !== -1) extFound = true; }
  check('扩展入口（寻物）可见', extFound);

  await miniProgram.screenshot({ path: path.join(SHOTS, '1-scene.png') });

  // ═══ 2. 选选项（预置直选）═══
  console.log('\n== 2. 选选项（预置直选）==');
  const clicked = await tapByText(page, '.scene-item', '今天吃什么');
  check('点击「今天吃什么」', clicked);
  await page.waitFor(900);

  const presets = await page.$$('.opt-chip');
  check('预置选项直接可点', presets.length >= 6, presets.length + ' 个');
  await tapByText(page, '.opt-chip', '火锅');
  await tapByText(page, '.opt-chip', '日料');
  await sleep(500);
  const selOn = await page.$$('.opt-chip.on');
  check('已选中 2 个选项', selOn.length === 2, selOn.length + ' 个');
  await miniProgram.screenshot({ path: path.join(SHOTS, '2-input.png') });

  // ═══ 3. 落宫动画 ═══
  console.log('\n== 3. 落宫动画 ==');
  const rollBtn = await page.$('.btn-primary');
  await rollBtn.tap();
  await sleep(500);
  const drawWrap = await page.$('.draw-wrap');
  check('进入落宫动画状态', !!drawWrap);
  const label = await textOf(page, '.draw-label');
  check('动画显示计数标签', !!label && label.indexOf('数') !== -1, label || '(空)');
  const palmsOn = await page.$$('.palm-dot.on');
  check('掌诀图有高亮宫', palmsOn.length === 1, String(palmsOn.length) + ' 个');
  await miniProgram.screenshot({ path: path.join(SHOTS, '3-drawing.png') });

  // 点击跳过
  if (drawWrap) await drawWrap.tap();
  await page.waitFor(1200);

  // ═══ 4. 结果页 ═══
  console.log('\n== 4. 结果页 ==');
  const picked = await textOf(page, '.pick-strong');
  check('显示抽中的选项', picked === '火锅' || picked === '日料', picked || '(空)');

  // ── 核心：白话结论打头，不把术语甩给用户 ──
  const headline = await textOf(page, '.res-headline');
  check('白话结论打头', !!headline && headline.length > 8, (headline || '').slice(0, 22) + '…');
  const NAME_RE = /大安|留连|速喜|赤口|小吉|空亡/;
  check('结论里不含宫位名', !!headline && !NAME_RE.test(headline));

  const focusChips = await page.$$('.chip');
  check('关注点可切换（4 个）', focusChips.length === 4, focusChips.length + ' 个');

  const layers = await page.$$('.layer');
  check('分层解读 3 层', layers.length === 3, layers.length + ' 层');
  const openA = await page.$$('.layer-x');
  check('默认只展开第一层', openA.length === 1, openA.length + ' 层展开');

  await tapByText(page, 'button', '继续看下一层');
  await sleep(600);
  const openB = await page.$$('.layer-x');
  check('可逐层展开', openB.length === 2, openB.length + ' 层展开');

  const closing = await textOf(page, '.close-text');
  check('有「今天做一件事」', !!closing && closing.indexOf('今天') !== -1, (closing || '').slice(0, 20));

  const acts = await page.$$('.act-row');
  check('三个具体动作', acts.length === 3, acts.length + ' 条');

  const fqs = await page.$$('.fq');
  check('可追问 4 条', fqs.length === 4, fqs.length + ' 条');

  await tapByText(page, '.chip', '大概什么时候');
  await sleep(600);
  const headline2 = await textOf(page, '.res-headline');
  check('换关注点后结论变化', !!headline2 && headline2 !== headline, (headline2 || '').slice(0, 22) + '…');

  const tradBefore = await page.$('.trad-box');
  check('六宫出处默认收起', !tradBefore);
  await tapByText(page, '.row', '查看六宫出处');
  await sleep(500);
  const tradName = await textOf(page, '.trad-name');
  check('可展开六宫出处', !!tradName && NAME_RE.test(tradName), tradName || '(空)');

  const disc = await textOf(page, '.disclaimer');
  check('常驻「随机提示」说明', !!disc && disc.indexOf('随机提示') !== -1, (disc || '').slice(0, 30));

  await miniProgram.screenshot({ path: path.join(SHOTS, '4-result.png') });

  // ═══ 5. 就这么定了 → 历史 ═══
  console.log('\n== 5. 就这么定了 · 历史记录 ==');
  const confirmed = await tapByText(page, 'button', '就这么定了');
  check('点击「就这么定了」', confirmed);
  await sleep(1500);

  // 回到主页看历史
  const page2 = await miniProgram.navigateTo('/pages/zzj/zzj');
  await page2.waitFor(1200);
  const histToggle = await tapByText(page2, '.card-title', '最近记录');
  check('展开历史记录', histToggle);
  await sleep(600);
  const histRows = await page2.$$('.hist-row');
  check('历史记录已写入', histRows.length >= 1, histRows.length + ' 条');
  if (histRows.length) {
    const t = await histRows[0].text();
    check('历史含已定标记', t.indexOf('已定') !== -1, t.replace(/\s+/g, ' ').slice(0, 50));
  }
  await miniProgram.screenshot({ path: path.join(SHOTS, '5-history.png') });

  // ═══ 6. 寻物（扩展页）═══
  console.log('\n== 6. 寻物（扩展页）==');
  const lp = await miniProgram.navigateTo('/pages/zzj/lost');
  await lp.waitFor(1200);
  const ltitle = await textOf(lp, '.ext-hero .t');
  check('寻物页标题', ltitle === '寻物', ltitle || '(空)');
  const linput = await lp.$('.ext-input');
  await linput.input('耳机');
  await sleep(300);
  await tapByText(lp, 'button', '帮我找');
  await sleep(500);
  const ldraw = await lp.$('.draw-wrap');
  if (ldraw) await ldraw.tap();
  await lp.waitFor(1200);
  // 寻物页现在是白话互动解读（传统依据收进折叠区）
  const lhead = await textOf(lp, '.res-headline');
  check('寻物白话结论打头', !!lhead && lhead.length > 6, (lhead || '').slice(0, 22) + '…');
  const lchips = await lp.$$('.chip');
  check('寻物关注点 4 个', lchips.length === 4, lchips.length + ' 个');
  const llayers = await lp.$$('.layer');
  check('寻物分层 3 层', llayers.length === 3, llayers.length + ' 层');
  const ltradBefore = await lp.$('.trad-box');
  check('寻物传统依据默认收起', !ltradBefore);
  await tapByText(lp, '.row', '查看传统依据');
  await sleep(600);
  const lverse = await textOf(lp, '.trad-verse');
  check('可展开传统依据含口诀', !!lverse && lverse.length > 4, lverse || '(空)');
  const lwarn = await textOf(lp, '.ext-warn');
  check('寻物页有风险提示', !!lwarn && lwarn.indexOf('仅供参考') !== -1);
  await miniProgram.screenshot({ path: path.join(SHOTS, '6-lost.png') });

  // ═══ 7. 走向（扩展页）═══
  console.log('\n== 7. 走向（扩展页）==');
  const fp = await miniProgram.navigateTo('/pages/zzj/future');
  await fp.waitFor(1200);
  const finput = await fp.$('.ext-input');
  await finput.input('要不要接这个新项目');
  await sleep(300);
  await tapByText(fp, 'button', '帮我看看');
  await sleep(500);
  const fdraw = await fp.$('.draw-wrap');
  if (fdraw) await fdraw.tap();
  await fp.waitFor(1500);

  // 走向会先问一句「你最想先弄清楚哪一点」
  const focusItems = await fp.$$('.ext-focus');
  check('走向先问关注点（4 个）', focusItems.length === 4, focusItems.length + ' 个');
  if (focusItems.length) await focusItems[0].tap();
  await fp.waitFor(1200);

  const stages = await fp.$$('.ext-stage');
  check('走向显示三层', stages.length === 3, stages.length + ' 个');
  if (stages.length === 3) {
    const heads = [];
    for (const s of stages) { heads.push((await s.text()).replace(/\s+/g, ' ').slice(0, 12)); }
    check('三宫为 起/中/果', heads[0].indexOf('起') === 0 && heads[1].indexOf('中') === 0 && heads[2].indexOf('果') === 0, heads.join(' | '));
  }
  await miniProgram.screenshot({ path: path.join(SHOTS, '7-future.png') });

  // ═══ 8. 科普页 ═══
  console.log('\n== 8. 六宫小识 ==');
  const kp = await miniProgram.navigateTo('/pages/zzj/knowledge');
  await kp.waitFor(1200);
  const ktitle = await textOf(kp, '.hero .date');
  check('科普页标题', ktitle === '六宫小识', ktitle || '(空)');
  const knRows = await kp.$$('.kn-row');
  check('六宫一览 6 条', knRows.length === 6, String(knRows.length));
  await miniProgram.screenshot({ path: path.join(SHOTS, '8-knowledge.png') });

  console.log('\n════════════════════════════');
  console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
  console.log('截图: docs/screenshots/');
  await miniProgram.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (e) {
  console.error('\n❌ 自动化执行失败:', e && e.message ? e.message : e);
  process.exit(2);
});
