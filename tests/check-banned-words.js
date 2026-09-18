// 违禁词扫描：node tests/check-banned-words.js
// 目的：确保「掌中决」核心层不出现算命类敏感词。
// 规则见 docs/掌中决-实现规范.md §1.2
//
// 分两层：
//   TIER1 硬禁 —— 任何地方（含扩展模块）都不允许出现
//   TIER2 核心层禁 —— 只允许出现在扩展模块（自用，不上架）

const fs = require('fs');
const path = require('path');

// 扩展模块：自用、不进入上架版本，豁免 TIER2
const EXT_FILES = [
  'data/zzj-ext.js',
  'data/zzj-read.js',
  'pages/zzj/lost.js', 'pages/zzj/lost.wxml',
  'pages/zzj/future.js', 'pages/zzj/future.wxml'
];

const TIER1 = [
  '算命', '算卦', '占卜', '卜卦', '起卦', '起课', '求签', '抽签', '签文', '卦象',
  '吉凶', '大吉', '大凶', '凶兆', '辟邪', '转运', '化解', '消灾', '改运',
  '风水', '命理', '八字', '生辰', '姻缘', '正缘', '桃花运', '横财', '破财',
  '官非', '血光', '灾殃', '开光', '灵验', '超度', '法事', '开运', '作法',
  '大师', '消业', '阴德', '前世', '因果报应'
];

const TIER2 = ['预测', '预言', '运势', '灵不灵', '准不准', '应验'];

// 观察名单：不禁用，但会在结果里提示，供上架前人工确认。
// 这些是术数专名——科普语境可用，但出现在功能页会明显放大审核联想。
const WATCH = ['小六壬', '掐指', '术数', '起课', '掌诀'];

const root = path.join(__dirname, '..', 'miniprogram');

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(js|wxml|wxss|json)$/.test(name)) out.push(full);
  });
  return out;
}

var files = walk(root, []);
var problems = [];
var watchHits = [];

files.forEach(function (full) {
  var rel = path.relative(root, full).split(path.sep).join('/');
  var isExt = EXT_FILES.indexOf(rel) !== -1;
  var txt = fs.readFileSync(full, 'utf8');
  var lines = txt.split(/\r?\n/);

  lines.forEach(function (line, i) {
    TIER1.forEach(function (w) {
      if (line.indexOf(w) !== -1) {
        problems.push(rel + ':' + (i + 1) + ' 硬禁词「' + w + '」 -> ' + line.trim().slice(0, 70));
      }
    });
    if (!isExt) {
      TIER2.forEach(function (w) {
        if (line.indexOf(w) !== -1) {
          problems.push(rel + ':' + (i + 1) + ' 核心层禁词「' + w + '」 -> ' + line.trim().slice(0, 70));
        }
      });
    }
    WATCH.forEach(function (w) {
      if (line.indexOf(w) !== -1) {
        watchHits.push(rel + ':' + (i + 1) + ' 「' + w + '」 -> ' + line.trim().slice(0, 60));
      }
    });
  });
});

if (problems.length) {
  console.log('❌ 违禁词扫描未通过（' + problems.length + ' 处）：');
  problems.forEach(function (p) { console.log('   ' + p); });
  process.exit(1);
} else {
  console.log('✅ 违禁词扫描通过：' + files.length + ' 个文件，无违禁词');
  if (watchHits.length) {
    console.log('');
    console.log('⚠️  观察名单命中 ' + watchHits.length + ' 处（不阻断，上架前请人工确认）：');
    watchHits.forEach(function (w) { console.log('   ' + w); });
  }
}
