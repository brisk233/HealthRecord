// 上架构建脚本
//
//   node tools/build-publish.js            生成上架版本（剔除扩展层）
//   node tools/build-publish.js --restore  还原为自用完整版
//   node tools/build-publish.js --dry-run  只看会改什么，不落盘
//
// 做四件事：
//   1. 剥离源码中 EXT:BEGIN … EXT:END 标记的扩展区块（js 用 //，wxml 用 <!-- -->）
//   2. 从 app.json 移除扩展页面注册
//   3. 在 project.config.json 写入 packOptions.ignore，把扩展文件排除出上传包
//   4. 校验：跑违禁词扫描
//
// ⚠️ 这是「两套构建产物」，不是运行时开关。被 ignore 的文件不在上传包里，
//    因此不构成运营规范 5.19 的「绕开、规避或对抗审核」。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const BACKUP = path.join(ROOT, '.publish-backup');

const EXT_PAGES = ['pages/zzj/lost', 'pages/zzj/future'];
const EXT_FILES = [
  'miniprogram/data/zzj-ext.js',
  'miniprogram/data/zzj-read.js',
  'miniprogram/pages/zzj/ext.wxss',
  'miniprogram/pages/zzj/lost.js',
  'miniprogram/pages/zzj/lost.wxml',
  'miniprogram/pages/zzj/lost.wxss',
  'miniprogram/pages/zzj/lost.json',
  'miniprogram/pages/zzj/future.js',
  'miniprogram/pages/zzj/future.wxml',
  'miniprogram/pages/zzj/future.wxss',
  'miniprogram/pages/zzj/future.json'
];

const TARGETS = [
  'miniprogram/app.json',
  'miniprogram/pages/zzj/zzj.js',
  'miniprogram/pages/zzj/zzj.wxml'
];

const args = process.argv.slice(2);
const isRestore = args.indexOf('--restore') !== -1;
const isDry = args.indexOf('--dry-run') !== -1;

// js 块： // EXT:BEGIN … // EXT:END
const RE_JS = /[ \t]*\/\/ EXT:BEGIN[^\n]*\n[\s\S]*?[ \t]*\/\/ EXT:END[^\n]*\n?/g;
// wxml 块： <!-- EXT:BEGIN --> … <!-- EXT:END -->
const RE_WXML = /[ \t]*<!-- EXT:BEGIN -->[^\n]*\n[\s\S]*?[ \t]*<!-- EXT:END -->[^\n]*\n?/g;

function stripExtBlocks(txt) {
  return txt.replace(RE_JS, '').replace(RE_WXML, '');
}

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function write(p, s) { fs.writeFileSync(path.join(ROOT, p), s, 'utf8'); }

function snap() {
  if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP, { recursive: true });
  TARGETS.forEach(function (p) {
    const dest = path.join(BACKUP, p.replace(/[\/\\]/g, '__'));
    fs.writeFileSync(dest, read(p), 'utf8');
  });
  const pc = path.join(BACKUP, 'project.config.json');
  fs.writeFileSync(pc, read('project.config.json'), 'utf8');
}

function restore() {
  if (!fs.existsSync(BACKUP)) { console.log('❌ 没有找到 .publish-backup/，无法还原'); process.exit(1); }
  TARGETS.forEach(function (p) {
    const src = path.join(BACKUP, p.replace(/[\/\\]/g, '__'));
    if (fs.existsSync(src)) write(p, fs.readFileSync(src, 'utf8'));
  });
  const pc = path.join(BACKUP, 'project.config.json');
  if (fs.existsSync(pc)) write('project.config.json', fs.readFileSync(pc, 'utf8'));
  console.log('✅ 已还原为自用完整版');
  console.log('   提示：扩展页面注册与 EXT 区块均已恢复。');
}

if (isRestore) { restore(); process.exit(0); }

console.log('▶ 生成上架版本' + (isDry ? '（dry-run，不落盘）' : ''));
snap();

let changed = 0;

// 1 + 2) 剥离 EXT 区块 / 移除扩展页面注册
TARGETS.forEach(function (p) {
  const before = read(p);
  let after = stripExtBlocks(before);

  if (p === 'miniprogram/app.json') {
    const j = JSON.parse(after);
    const kept = j.pages.filter(function (x) { return EXT_PAGES.indexOf(x) === -1; });
    const removed = j.pages.length - kept.length;
    j.pages = kept;
    after = JSON.stringify(j, null, 2) + '\n';
    console.log('   app.json: 移除 ' + removed + ' 个扩展页面注册');
  } else {
    const n = (before.match(/EXT:BEGIN/g) || []).length;
    console.log('   ' + p + ': 剥离 ' + n + ' 个 EXT 区块');
  }

  if (before !== after) { changed++; if (!isDry) write(p, after); }
});

// 3) 写入 packOptions.ignore
(function () {
  const p = 'project.config.json';
  const j = JSON.parse(read(p));
  j.packOptions = j.packOptions || {};
  const ignore = (j.packOptions.ignore || []).filter(function (e) {
    return EXT_FILES.indexOf(e && e.value) === -1;
  });
  EXT_FILES.forEach(function (f) { ignore.push({ type: 'file', value: f }); });
  j.packOptions.ignore = ignore;
  console.log('   project.config.json: 写入 ' + EXT_FILES.length + ' 条 packOptions.ignore');
  if (!isDry) write(p, JSON.stringify(j, null, 2) + '\n');
  changed++;
})();

console.log('');
if (isDry) { console.log('ℹ️  dry-run 结束，未修改任何文件'); process.exit(0); }

// 4) 校验
console.log('▶ 校验上架产物');
const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tests', 'check-banned-words.js')], { stdio: 'inherit' });
if (r.status !== 0) {
  console.log('');
  console.log('❌ 违禁词扫描未通过，已自动还原');
  restore();
  process.exit(1);
}

// 确认没有残留引用
const zzjJs = read('miniprogram/pages/zzj/zzj.js');
const zzjWxml = read('miniprogram/pages/zzj/zzj.wxml');
const leftover = [];
if (zzjJs.indexOf('zzj-ext') !== -1) leftover.push('zzj.js 仍引用 zzj-ext');
if (zzjWxml.indexOf('extEntries') !== -1) leftover.push('zzj.wxml 仍引用 extEntries');

if (leftover.length) {
  console.log('❌ 残留引用：' + leftover.join('；') + '，已自动还原');
  restore();
  process.exit(1);
}

console.log('');
console.log('✅ 上架版本已生成（共修改 ' + changed + ' 个文件）');
console.log('   扩展层已物理排除：data/zzj-ext.js + pages/zzj/lost.* + pages/zzj/future.*');
console.log('   下一步：用微信开发者工具「上传」，或先跑 node tests/run-tests.js 全量回归');
console.log('   还原自用版：node tools/build-publish.js --restore');
