// 上架构建脚本
//
//   node tools/build-publish.js            生成上架版本（移出扩展层）
//   node tools/build-publish.js --restore  还原为自用完整版
//   node tools/build-publish.js --dry-run  只看会改什么，不落盘
//
// 做三件事：
//   1. 剥离源码中 EXT:BEGIN … EXT:END 标记的扩展区块（js 用 //，wxml 用 <!-- -->）
//   2. 从 app.json 移除扩展页面注册
//   3. 把扩展层文件【物理移出】 miniprogram/ ，移入 .publish-backup/excluded/
//   4. 校验：跑违禁词扫描
//
// ⚠️ 为什么是「移出」而不是 packOptions.ignore：
//    实测发现 packOptions.ignore 会让开发者工具把被排除文件从【本地编译】也剔除，
//    而 lost.wxss / future.wxss 内有 @import "./ext.wxss"，依赖链断裂会导致
//    整个工程编译失败（模拟器一个页面都加载不出来）。物理移出则不存在该问题。
//
// ⚠️ 这仍是「两套构建产物」，不是运行时开关：文件根本不在工程里，
//    不构成运营规范 5.19 的「绕开、规避或对抗审核」。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const BACKUP = path.join(ROOT, '.publish-backup');
const EXCLUDED = path.join(BACKUP, 'excluded');

// 扩展层文件（相对项目根）：构建时移出 miniprogram/
const EXT_FILES = [
  'miniprogram/data/zzj-ext.js',
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

const EXT_PAGES = ['pages/zzj/lost', 'pages/zzj/future'];

const TARGETS = [
  'miniprogram/app.json',
  'miniprogram/pages/zzj/zzj.js',
  'miniprogram/pages/zzj/zzj.wxml',
  'project.config.json'
];

const args = process.argv.slice(2);
const isRestore = args.indexOf('--restore') !== -1;
const isDry = args.indexOf('--dry-run') !== -1;

const RE_JS = /[ \t]*\/\/ EXT:BEGIN[^\n]*\n[\s\S]*?[ \t]*\/\/ EXT:END[^\n]*\n?/g;
const RE_WXML = /[ \t]*<!-- EXT:BEGIN -->[^\n]*\n[\s\S]*?[ \t]*<!-- EXT:END -->[^\n]*\n?/g;

const stripExtBlocks = t => t.replace(RE_JS, '').replace(RE_WXML, '');
const abs = p => path.join(ROOT, p);
const read = p => fs.readFileSync(abs(p), 'utf8');
const write = (p, s) => fs.writeFileSync(abs(p), s, 'utf8');
const slot = p => path.join(BACKUP, p.split(/[\/\\]/).join('__'));
const exSlot = p => path.join(EXCLUDED, p.split(/[\/\\]/).join('__'));

// 清掉历史版本写入的 packOptions.ignore（它会导致编译失败）
function clearIgnore() {
  const j = JSON.parse(read('project.config.json'));
  if (j.packOptions && Array.isArray(j.packOptions.ignore) && j.packOptions.ignore.length) {
    j.packOptions.ignore = j.packOptions.ignore.filter(function (e) {
      return EXT_FILES.indexOf(e && e.value) === -1;
    });
    write('project.config.json', JSON.stringify(j, null, 2) + '\n');
    return true;
  }
  return false;
}

function snap() {
  fs.mkdirSync(BACKUP, { recursive: true });
  TARGETS.forEach(function (p) { fs.writeFileSync(slot(p), read(p), 'utf8'); });
}
function unsnap() {
  TARGETS.forEach(function (p) {
    if (fs.existsSync(slot(p))) write(p, fs.readFileSync(slot(p), 'utf8'));
  });
}
function moveOut() {
  fs.mkdirSync(EXCLUDED, { recursive: true });
  let n = 0;
  EXT_FILES.forEach(function (p) {
    if (fs.existsSync(abs(p))) { fs.renameSync(abs(p), exSlot(p)); n++; }
  });
  return n;
}
function moveBack() {
  let n = 0;
  EXT_FILES.forEach(function (p) {
    if (fs.existsSync(exSlot(p))) { fs.renameSync(exSlot(p), abs(p)); n++; }
  });
  return n;
}

if (isRestore) {
  if (!fs.existsSync(BACKUP)) { console.log('❌ 没有 .publish-backup/，无法还原'); process.exit(1); }
  unsnap();
  const n = moveBack();
  clearIgnore();
  console.log('✅ 已还原为自用完整版（恢复 ' + n + ' 个扩展文件）');
  process.exit(0);
}

console.log('▶ 生成上架版本' + (isDry ? '（dry-run，不落盘）' : ''));
if (!isDry) snap();

let changed = 0;
TARGETS.forEach(function (p) {
  if (p === 'project.config.json') return;
  const before = read(p);
  let after = stripExtBlocks(before);
  if (p === 'miniprogram/app.json') {
    const j = JSON.parse(after);
    const kept = j.pages.filter(x => EXT_PAGES.indexOf(x) === -1);
    console.log('   app.json: 移除 ' + (j.pages.length - kept.length) + ' 个扩展页面注册');
    j.pages = kept;
    after = JSON.stringify(j, null, 2) + '\n';
  } else {
    const n = (before.match(/EXT:BEGIN/g) || []).length;
    console.log('   ' + p + ': 剥离 ' + n + ' 个 EXT 区块');
  }
  if (before !== after) { changed++; if (!isDry) write(p, after); }
});

if (!isDry) {
  const n = moveOut();
  console.log('   移出 ' + n + ' 个扩展层文件 -> .publish-backup/excluded/');
  if (clearIgnore()) console.log('   已清除历史 packOptions.ignore（它会导致编译失败）');
  changed++;
} else {
  console.log('   [dry-run] 将移出 ' + EXT_FILES.length + ' 个扩展层文件');
}

console.log('');
if (isDry) { console.log('ℹ️  dry-run 结束，未修改任何文件'); process.exit(0); }

console.log('▶ 校验上架产物');
const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tests', 'check-banned-words.js')], { stdio: 'inherit' });
if (r.status !== 0) { console.log('\n❌ 违禁词扫描未通过，已自动还原'); unsnap(); moveBack(); process.exit(1); }

const leftover = [];
const zzjJs = read('miniprogram/pages/zzj/zzj.js');
const zzjWxml = read('miniprogram/pages/zzj/zzj.wxml');
if (zzjJs.indexOf('zzj-ext') !== -1) leftover.push('zzj.js 仍引用 zzj-ext');
if (zzjWxml.indexOf('extEntries') !== -1) leftover.push('zzj.wxml 仍引用 extEntries');
EXT_FILES.forEach(function (p) { if (fs.existsSync(abs(p))) leftover.push('未移出: ' + p); });

if (leftover.length) {
  console.log('❌ 残留：' + leftover.join('；') + '，已自动还原');
  unsnap(); moveBack();
  process.exit(1);
}

console.log('');
console.log('✅ 上架版本已生成（修改 ' + changed + ' 个文件）');
console.log('   扩展层已物理移出 miniprogram/（不是 packOptions.ignore）');
console.log('   还原自用版：node tools/build-publish.js --restore');
