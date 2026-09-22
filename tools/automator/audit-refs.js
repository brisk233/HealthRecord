// 上架产物依赖闭环审计：确认没有对已移出文件的悬空引用
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const MP = path.join(ROOT, 'miniprogram');

const MOVED = [
  'data/zzj-ext.js', 'data/zzj-lost-read.js',
  'pages/zzj/ext.wxss',
  'pages/zzj/lost.js', 'pages/zzj/lost.wxml', 'pages/zzj/lost.wxss', 'pages/zzj/lost.json',
  'pages/zzj/future.js', 'pages/zzj/future.wxml', 'pages/zzj/future.wxss', 'pages/zzj/future.json'
];

const PATTERNS = [
  /require\(\s*['"][^'"]*zzj-ext[^'"]*['"]/,
  /require\(\s*['"][^'"]*zzj-lost-read[^'"]*['"]/,
  /@import\s+['"]\.\/ext\.wxss['"]/,
  /\/pages\/zzj\/lost/,
  /\/pages\/zzj\/future/
];

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (n) {
    if (n === 'node_modules' || n === 'miniprogram_npm') return;
    const full = path.join(dir, n);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|wxml|json|wxss)$/.test(n)) out.push(full);
  });
  return out;
}

const problems = [];
walk(MP, []).forEach(function (full) {
  const rel = path.relative(MP, full).split(path.sep).join('/');
  if (MOVED.indexOf(rel) !== -1) return;                 // 已移出，跳过
  const txt = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  txt.forEach(function (line, i) {
    PATTERNS.forEach(function (re) {
      if (re.test(line)) problems.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 80));
    });
  });
});

// 顺带确认被移出的文件确实不在工程里
const stillThere = MOVED.filter(function (p) { return fs.existsSync(path.join(MP, p)); });

if (stillThere.length) { console.log('❌ 未移出: ' + stillThere.join(', ')); process.exit(1); }
if (problems.length) {
  console.log('❌ 悬空引用 ' + problems.length + ' 处：');
  problems.forEach(function (p) { console.log('   ' + p); });
  process.exit(1);
}
console.log('✅ 依赖闭环：11 个扩展文件已移出，工程内无悬空引用');
