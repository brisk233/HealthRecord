const date = require('./date.js');

// 保质期规则（天）：与 PRD 4.3 一致
const RULES = [
  { key: 'leaf', label: '叶菜(洗切)', days: 2 },
  { key: 'broccoli', label: '西兰花(焯水)', days: 3 },
  { key: 'marinated', label: '腌肉(冷藏)', days: 2 },
  { key: 'veggie', label: '切配蔬菜', days: 3 },
  { key: 'cookedCold', label: '熟肉(冷藏)', days: 3 },
  { key: 'egg', label: '水煮蛋', days: 5 },
  { key: 'eggRaw', label: '鸡蛋', days: 15 },
  { key: 'cookedFrozen', label: '熟肉(冷冻)', days: 14 },
  { key: 'rawFrozen', label: '生肉(冷冻)', days: 30 },
  { key: 'other', label: '其他', days: 7 }
];

function ruleOf(key) {
  for (const r of RULES) { if (r.key === key) return r; }
  return { key: key, label: '其他', days: 3 };
}
function suggestedFor(item) {
  return date.addDays(item.purchased, ruleOf(item.cat).days);
}
function daysLeft(item) {
  return date.daysBetween(date.todayStr(), suggestedFor(item));
}
function statusOf(item) {
  const d = daysLeft(item);
  if (d < 0) return { text: '已过期', cls: 'danger' };
  if (d === 0) return { text: '今天吃', cls: 'warn' };
  if (d <= 1) return { text: '临期', cls: 'warn' };
  return { text: '新鲜', cls: 'ok' };
}
module.exports = { RULES: RULES, ruleOf: ruleOf, suggestedFor: suggestedFor, daysLeft: daysLeft, statusOf: statusOf };
