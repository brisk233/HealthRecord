const date = require('./date.js');
const shelf = require('./shelflife.js');
const recipes = require('../data/recipes.js');

function normName(name) {
  return String(name).replace(/[（(][^）)]*[）)]/g, '').trim();
}
function fridgeHas(fridge, ingredient) {
  if (!fridge || !ingredient) return false;
  return fridge.some(function (it) {
    const n = normName(it.name);
    return n.indexOf(ingredient) !== -1 || ingredient.indexOf(n) !== -1;
  });
}
function minDaysLeft(fridge, ingredient) {
  let d = 99;
  if (!fridge) return d;
  fridge.forEach(function (it) {
    if (normName(it.name).indexOf(ingredient) !== -1) d = Math.min(d, shelf.daysLeft(it));
  });
  return d;
}
function dishInfo(r, fridge) {
  const mainOk = r.main === '-' || fridgeHas(fridge, r.main);
  const vegOk = r.veg === '-' || fridgeHas(fridge, r.veg);
  const missing = [];
  if (r.main !== '-' && !mainOk) missing.push('买：' + r.main);
  if (r.veg !== '-' && !vegOk) missing.push('买：' + r.veg);
  const dl = r.main === '-' ? minDaysLeft(fridge, r.veg) : minDaysLeft(fridge, r.main);
  return { mainOk: mainOk, vegOk: vegOk, missing: missing, dl: dl };
}
function tasteNum(t) { if (t === '清淡') return 1; if (t === '偏辣') return 3; return 2; }
function spicyScore(spicy, tn) {
  if (tn === 1) return spicy > 1 ? (spicy - 1) * 3 : 0;
  if (tn === 3) return spicy >= 2 ? -3 : 3;
  return Math.abs(spicy - 2) * 2;
}

// 只挑「主料+配菜都在冰箱」且本周未用过的菜；临期 + 爱吃 + 辣度匹配
function pickUnused(pool, used, fridge, prefs) {
  const favs = prefs.favs || [];
  const tn = tasteNum(prefs.tasteLevel || '微辣');
  const candidates = pool.map(function (r) {
    return Object.assign({}, r, dishInfo(r, fridge));
  }).filter(function (r) { return used.indexOf(r.id) === -1; })
    .filter(function (r) { return r.mainOk && r.vegOk; });
  candidates.sort(function (a, b) {
    const sa = a.dl + spicyScore(a.spicy || 0, tn) + (favs.indexOf(a.main) !== -1 ? -2 : 0);
    const sb = b.dl + spicyScore(b.spicy || 0, tn) + (favs.indexOf(b.main) !== -1 ? -2 : 0);
    return sa - sb;
  });
  const best = candidates[0] || null;
  if (best) used.push(best.id);
  return best;
}
function suggestToBuy(pool, fridge) {
  const uniq = [];
  pool.forEach(function (r) {
    if (!fridgeHas(fridge, r.main) && uniq.indexOf(r.main) === -1) uniq.push(r.main);
  });
  return uniq.slice(0, 3).map(function (m) { return '建议买：' + m; });
}

// 生成 7 天菜单（v4 严格库存驱动）：只排冰箱能做的菜，其余天为「需采购食材」占位
function generateWeekMenu(fridge, prefs) {
  prefs = prefs || {};
  const mainPool = recipes.filter(function (r) { return r.main !== '-' && r.name.indexOf('早餐') === -1; });
  const sidePool = recipes.filter(function (r) { return r.main === '-'; });
  const usedMain = [], usedSide = [];
  const t = date.todayStr();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = date.addDays(t, i);
    const main = pickUnused(mainPool, usedMain, fridge, prefs);
    if (main) {
      const side = pickUnused(sidePool, usedSide, fridge, prefs);
      const proteinG = (main.proteinG || 0) + (side ? side.proteinG || 0 : 0);
      const kcal = (main.kcal || 0) + (side ? side.kcal || 0 : 0);
      const elements = [];
      (main.elements || []).concat(side ? (side.elements || []) : []).forEach(function (e) {
        if (elements.indexOf(e) === -1) elements.push(e);
      });
      days.push({
        date: d, weekday: date.weekdayZh(d), isToday: i === 0, purchased: true,
        dinner: main.name, side: side ? side.name : '加一道蔬菜吧',
        box: main.box + (side ? ' + ' + side.box : ''),
        method: main.method, cookTime: main.cookTime,
        proteinG: proteinG, kcal: kcal, elements: elements, missing: side ? [] : ['建议买：蔬菜']
      });
    } else {
      days.push({
        date: d, weekday: date.weekdayZh(d), isToday: i === 0, purchased: false,
        dinner: '需采购食材', side: '—', box: '—', method: '—', cookTime: '—',
        proteinG: 0, kcal: 0, elements: [], missing: suggestToBuy(mainPool, fridge)
      });
    }
  }
  return days.map(function (d) { return Object.assign({}, d, { totalG: 15 + (d.proteinG || 0) * 2 }); });
}

const PURCHASE_LIST = [
  { name: '牛腩', amount: '500g', zone: '肉禽海鲜' },
  { name: '吊龙', amount: '300g', zone: '肉禽海鲜' },
  { name: '猪瘦肉', amount: '250g', zone: '肉禽海鲜' },
  { name: '鲈鱼', amount: '2条', zone: '肉禽海鲜' },
  { name: '基围虾', amount: '500g', zone: '肉禽海鲜' },
  { name: '鸡蛋', amount: '6枚', zone: '蛋奶' },
  { name: '西兰花', amount: '2颗', zone: '蔬菜' },
  { name: '胡萝卜', amount: '2根', zone: '蔬菜' },
  { name: '辣椒', amount: '300g', zone: '蔬菜' },
  { name: '叶子菜', amount: '3把', zone: '蔬菜' },
  { name: '番茄', amount: '2个', zone: '蔬菜' },
  { name: '姜/蒜/葱', amount: '适量', zone: '调味' }
];

const PREP_STEPS = [
  { t: '0:00', task: '牛腩焯水 → 入炖锅加胡萝卜/番茄，炖 1.5 小时，分 5 盒（2 冷藏 + 3 冷冻）' },
  { t: '0:15', task: '（炖煮并行）鲈鱼清理改刀腌制，装袋冷冻 ×2' },
  { t: '0:30', task: '基围虾去壳开背，虾仁分 2 盒（1 冷藏 + 1 冷冻）' },
  { t: '0:50', task: '吊龙切薄片腌制（生抽/蚝油/淀粉/油），2 盒冷藏 + 1 盒冷冻' },
  { t: '1:05', task: '猪肉切丝/片分装，冷冻 ×2' },
  { t: '1:20', task: '西兰花切小朵焯水 1 分钟过凉，分 5 盒冷藏' },
  { t: '1:40', task: '胡萝卜切丝、辣椒切圈，分装冷藏' },
  { t: '1:50', task: '叶子菜洗净甩干垫厨房纸密封（前 2 天吃完），分 3 盒冷藏' },
  { t: '2:00', task: '煮水煮蛋 6 枚，冷藏（5 天内吃完）' }
];

module.exports = { generateWeekMenu: generateWeekMenu, PURCHASE_LIST: PURCHASE_LIST, PREP_STEPS: PREP_STEPS };
