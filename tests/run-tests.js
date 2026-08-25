// 自动化测试：项目根目录运行 node tests/run-tests.js
const path = require('path');
const mp = function (p) { return path.join(__dirname, '..', 'miniprogram', p); };
const date = require(mp('utils/date.js'));
const shelf = require(mp('utils/shelflife.js'));
const nutrition = require(mp('utils/nutrition.js'));
const mealplan = require(mp('utils/mealplan.js'));
const recipes = require(mp('data/recipes.js'));
const seed = require(mp('data/seed.js'));
const ex = require(mp('data/exercises.js'));
const lifestyle = require(mp('data/lifestyle.js'));
const cloudsync = require(mp('utils/cloudsync.js'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' -> ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' 期望 ' + b + ' 实际 ' + a); }

console.log('== date ==');
t('fmt/addDays/weekdayZh', function () {
  eq(date.fmt(new Date(2026, 7, 7)), '2026-08-07');
  eq(date.addDays('2026-08-30', 3), '2026-09-02');
  eq(date.addDays('2026-12-31', 1), '2027-01-01');
  eq(date.weekdayZh('2026-08-17'), '周一');
});

console.log('== shelflife ==');
t('保质期与状态边界（相对今天，避免日期漂移）', function () {
  const today = date.todayStr();
  eq(shelf.suggestedFor({ purchased: today, cat: 'leaf' }), date.addDays(today, 2));
  eq(shelf.suggestedFor({ purchased: today, cat: 'rawFrozen' }), date.addDays(today, 30));
  eq(shelf.statusOf({ purchased: today, cat: 'leaf' }).text, '新鲜');
  eq(shelf.statusOf({ purchased: date.addDays(today, -1), cat: 'leaf' }).text, '临期');
  eq(shelf.statusOf({ purchased: date.addDays(today, -3), cat: 'leaf' }).text, '已过期');
});

console.log('== nutrition ==');
t('双人目标', function () {
  eq(nutrition.proteinTarget(seed.defaultProfile.male), 112);
  eq(nutrition.proteinTarget(seed.defaultProfile.female), 62);
  eq(nutrition.calorieTarget(seed.defaultProfile.male), 2060);
  eq(nutrition.calorieTarget(seed.defaultProfile.female), 1352);
});

console.log('== recipes ==');
t('22 道且字段完整', function () {
  eq(recipes.length, 22);
  eq(new Set(recipes.map(function (r) { return r.id; })).size, 22);
  recipes.forEach(function (r) { if (!r.name || !(r.proteinG > 0) || !r.elements.length) throw new Error(r.id + ' 异常'); });
});

console.log('== mealplan（v4 库存驱动：只排冰箱能做，其余占位） ==');
t('空冰箱 → 7 天全为「需采购食材」占位', function () {
  const days = mealplan.generateWeekMenu([]);
  eq(days.length, 7);
  days.forEach(function (d) {
    if (d.purchased) throw new Error(d.date + ' 空冰箱不应有可做菜');
    if (d.dinner !== '需采购食材') throw new Error(d.date + ' 应为占位，实际 ' + d.dinner);
    if (!d.missing.length) throw new Error(d.date + ' 缺采购建议');
  });
});
t('只有吊龙 → 仅 1 天可做（牛肉滑蛋饭）', function () {
  const fridge = [{ id: 'x', name: '吊龙(切片)', cat: 'marinated', box: '①', purchased: date.todayStr(), note: '' }];
  const days = mealplan.generateWeekMenu(fridge);
  const purchased = days.filter(function (d) { return d.purchased; });
  eq(purchased.length, 1);
  if (purchased[0].dinner !== '牛肉滑蛋饭') throw new Error('实际 ' + purchased[0].dinner);
});
t('默认冰箱 → 第 1 天可做且 0 缺料', function () {
  const d0 = mealplan.generateWeekMenu(seed.buildDefaultFridge())[0];
  if (!d0.purchased || d0.missing.length) throw new Error('第1天异常');
});
t('可做天主菜不重复', function () {
  const days = mealplan.generateWeekMenu(seed.buildDefaultFridge());
  const dinners = days.filter(function (d) { return d.purchased; }).map(function (d) { return d.dinner; });
  if (new Set(dinners).size !== dinners.length) throw new Error('重复: ' + dinners.join('/'));
});
t('占位天 totalG=15 无蛋白', function () {
  const d = mealplan.generateWeekMenu([])[0];
  eq(d.totalG, 15);
  eq(d.proteinG, 0);
});
t('喜好：冰箱有鲈鱼+爱吃 → 第1天清蒸鲈鱼', function () {
  const f = [{ id: 'y', name: '鲈鱼(清理腌好)', cat: 'rawFrozen', box: '①', purchased: date.todayStr(), note: '' }];
  const d0 = mealplan.generateWeekMenu(f, { tasteLevel: '微辣', favs: ['鲈鱼'] })[0];
  if (d0.dinner !== '清蒸鲈鱼') throw new Error('实际 ' + d0.dinner);
});
t('喜好：清淡 → 避开辣菜', function () {
  const f = [
    { id: '1', name: '吊龙(切片)', cat: 'marinated', box: '①', purchased: date.todayStr(), note: '' },
    { id: '2', name: '辣椒(切圈)', cat: 'veggie', box: '②', purchased: date.todayStr(), note: '' },
    { id: '3', name: '叶子菜(洗切)', cat: 'leaf', box: '③', purchased: date.todayStr(), note: '' }
  ];
  const d0 = mealplan.generateWeekMenu(f, { tasteLevel: '清淡', favs: [] })[0];
  if (d0.dinner === '吊龙炒辣椒') throw new Error('清淡不应首排辣菜');
});
t('喜好：偏辣 → 优先排辣菜', function () {
  const f = [
    { id: '1', name: '吊龙(切片)', cat: 'marinated', box: '①', purchased: date.todayStr(), note: '' },
    { id: '2', name: '辣椒(切圈)', cat: 'veggie', box: '②', purchased: date.todayStr(), note: '' },
    { id: '3', name: '叶子菜(洗切)', cat: 'leaf', box: '③', purchased: date.todayStr(), note: '' }
  ];
  const d0 = mealplan.generateWeekMenu(f, { tasteLevel: '偏辣', favs: [] })[0];
  if (d0.dinner !== '吊龙炒辣椒') throw new Error('偏辣应首排辣菜，实际 ' + d0.dinner);
});
console.log('== lifestyle ==');
t('9 人格 + 细分 + 习惯推荐齐全', function () {
  eq(lifestyle.MAJORS.length, 9);
  lifestyle.MAJORS.forEach(function (m) {
    if (!lifestyle.SUBTAGS[m.key] || !lifestyle.SUBTAGS[m.key].length) throw new Error(m.key + ' 缺细分');
    if (!lifestyle.HABIT_RECOMMEND[m.key] || !lifestyle.HABIT_RECOMMEND[m.key].length) throw new Error(m.key + ' 缺推荐');
    lifestyle.HABIT_RECOMMEND[m.key].forEach(function (h) { if (!h.name || !h.icon || !h.freq) throw new Error(m.key + ' 习惯缺字段'); });
  });
});
t('seed 档案含 habits/modules/tags', function () {
  if (!Array.isArray(seed.defaultProfile.male.habits)) throw new Error('male 缺 habits');
  if (!Array.isArray(seed.defaultProfile.female.habits)) throw new Error('female 缺 habits');
  eq(seed.defaultProfile.male.modules.length, 3);
  eq(seed.defaultProfile.female.modules.length, 3);
});

console.log('== seed / exercises ==');
t('档案与冰箱', function () {
  eq(seed.defaultProfile.male.suppEnabled, true);
  eq(seed.defaultProfile.female.suppEnabled, true);
  eq(seed.buildDefaultFridge().length, 8);
});
t('课表与动作库', function () {
  eq(ex.TRAIN_MALE.length, 7);
  eq(ex.TRAIN_FEMALE.length, 7);
  eq(new Set(ex.TRAIN_MALE.map(function (x) { return x.title; })).size, 7);
  if (!ex.EXERCISE_LIB.length) throw new Error('动作库为空');
});

console.log('== profile/today/fitness 行为自测（mock wx 模拟点击） ==');
let mockStorage = {};
function installMocks(profile) {
  mockStorage = {};
  global.wx = {
    getStorageSync: function (k) { return mockStorage[k]; },
    setStorageSync: function (k, v) { mockStorage[k] = v; },
    removeStorageSync: function (k) { delete mockStorage[k]; },
    clearStorageSync: function () { mockStorage = {}; },
    cloud: { callFunction: function () { return Promise.resolve({ result: null }); }, init: function () {} },
    showToast: function () {}, showModal: function () {}, showActionSheet: function () {},
    vibrateShort: function () {}, requestSubscribeMessage: function () {},
    setClipboardData: function () {}, navigateTo: function () {}, navigateBack: function () {}, switchTab: function () {}
  };
  global.getApp = function () {
    return { globalData: { profile: profile, fridge: [], version: '2.1.9' }, resetLocal: function () {} };
  };
}
function setPath(obj, pathStr, val) {
  const parts = pathStr.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
}
function makePage(cfg, methods) {
  const page = Object.assign({}, cfg);
  page.data = JSON.parse(JSON.stringify(cfg.data));
  page.setData = function (patch) {
    Object.keys(patch).forEach(function (k) { setPath(this.data, k, patch[k]); }.bind(this));
  };
  (methods || ['refresh', 'buildFavAll', 'saveProfile', 'onModuleToggle', 'onFavToggle', 'onFavDel', 'clearFavs', 'addFav', 'moduleName']).forEach(function (m) {
    page[m] = cfg[m].bind(page);
  });
  return page;
}
function loadPage(rel) {
  const resolved = require.resolve(mp(rel));
  delete require.cache[resolved];
  return require(resolved);
}
function capturePage() {
  let cfg = null;
  global.Page = function (c) { cfg = c; };
  return function () { return cfg; };
}

t('模块开关：旧档案无 modules 时按标签补默认；可全部关闭且 refresh 不回弹', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  delete profile.male.modules;
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/profile/profile.js');
  const page = makePage(getCfg());
  page.refresh();
  if (profile.male.modules.length !== 2) throw new Error('默认模块应为 2 个(meals/supps)，实际 ' + profile.male.modules.length);
  page.onModuleToggle({ currentTarget: { dataset: { m: 'meals' } }, detail: { value: false } });
  page.onModuleToggle({ currentTarget: { dataset: { m: 'supps' } }, detail: { value: false } });
  if (profile.male.modules.length !== 0) throw new Error('关掉最后一个模块后被重置: ' + profile.male.modules.join('/'));
  if (page.data.modRows.some(function (r) { return r.on; })) throw new Error('modRows 未全部关闭');
  page.refresh();
  if (profile.male.modules.length !== 0) throw new Error('refresh 后模块被重置为默认');
  if (!mockStorage.profile || mockStorage.profile.male.modules.length !== 0) throw new Error('空模块未持久化');
});

t('食材删除：✕ 删除后 chip 彻底消失（含预设项）、存储持久化、重进不回弹', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/profile/profile.js');
  const page = makePage(getCfg());
  page.refresh();
  page.setData({ favNew: '番茄' });
  page.addFav();
  if (profile.male.favs.indexOf('番茄') === -1) throw new Error('自定义添加失败');
  page.onFavDel({ currentTarget: { dataset: { v: '番茄' } } });
  if (profile.male.favs.indexOf('番茄') !== -1) throw new Error('自定义食材删除失败');
  if (page.data.favChips.some(function (c) { return c.name === '番茄'; })) throw new Error('自定义食材删除后 chip 未消失');
  page.onFavDel({ currentTarget: { dataset: { v: '吊龙' } } });
  if (profile.male.favs.indexOf('吊龙') !== -1) throw new Error('预设食材删除失败');
  if (page.data.favChips.some(function (c) { return c.name === '吊龙'; })) throw new Error('预设食材删除后 chip 仍显示');
  if (profile.male.favHidden.indexOf('吊龙') === -1) throw new Error('删除后未记入 favHidden');
  page.refresh();
  if (profile.male.favs.indexOf('吊龙') !== -1 || page.data.favChips.some(function (c) { return c.name === '吊龙'; })) throw new Error('刷新后删除回弹');
  const stored = mockStorage.profile;
  if (!stored || stored.male.favs.indexOf('吊龙') !== -1 || stored.male.favs.indexOf('番茄') !== -1) throw new Error('删除未持久化');
  if (stored.male.favHidden.indexOf('吊龙') === -1) throw new Error('favHidden 未持久化');
  if (stored.male.favs.indexOf('牛腩') === -1) throw new Error('未删除项被误删');
});

t('食材 chip：点已选=删除并隐藏；点灰色=添加；删除项只能输入框加回', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/profile/profile.js');
  const page = makePage(getCfg());
  page.refresh();
  // 点已选（牛腩）→ 删除并隐藏
  page.onFavToggle({ currentTarget: { dataset: { v: '牛腩' } } });
  if (profile.male.favs.indexOf('牛腩') !== -1) throw new Error('点击已选食材未取消选中');
  if (page.data.favChips.some(function (c) { return c.name === '牛腩'; })) throw new Error('点已选 chip 删除后仍显示');
  // 已删除项无法用 chip 加回（防事件双触发把删除“复活”）
  page.onFavToggle({ currentTarget: { dataset: { v: '牛腩' } } });
  if (profile.male.favs.indexOf('牛腩') !== -1) throw new Error('已删除项被 chip 重新添加');
  // 点灰色（猪肉）→ 添加
  page.onFavToggle({ currentTarget: { dataset: { v: '猪肉' } } });
  if (profile.male.favs.indexOf('猪肉') === -1) throw new Error('点灰色 chip 未添加');
  // 输入框加回已删除项 → 恢复 chip
  page.setData({ favNew: '牛腩' });
  page.addFav();
  if (profile.male.favs.indexOf('牛腩') === -1) throw new Error('输入框无法加回已删除项');
  if (profile.male.favHidden.indexOf('牛腩') !== -1) throw new Error('加回后 favHidden 未清除');
  const restored = page.data.favChips.find(function (c) { return c.name === '牛腩'; });
  if (!restored || !restored.on) throw new Error('加回后 chip 未恢复选中');
});

t('云端空 favHidden 不抹本地已删除记录（mergeProfile 守卫）', function () {
  const local = JSON.parse(JSON.stringify(seed.defaultProfile));
  local.male.favHidden = ['吊龙'];
  local.male._t = 2000;
  const remote = JSON.parse(JSON.stringify(seed.defaultProfile));
  remote.male.favHidden = [];
  remote.male._t = 3000;
  const merged = cloudsync.mergeProfile(local, remote);
  if (merged.male.favHidden.indexOf('吊龙') === -1) throw new Error('云端空 favHidden 覆盖了本地删除记录');
});

t('今日页模块显隐标志：按 modules 计算且空数组保持隐藏', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  profile.male.modules = ['meals'];
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/today/today.js');
  const page = makePage(getCfg(), ['refresh']);
  page.refresh();
  if (page.data.modMeals !== true) throw new Error('modMeals 应为 true');
  if (page.data.modFitness !== false) throw new Error('modFitness 应为 false');
  if (page.data.modSupps !== false) throw new Error('modSupps 应为 false');
  profile.male.modules = [];
  page.refresh();
  if (page.data.modMeals || page.data.modFitness || page.data.modSupps) throw new Error('空模块应全部隐藏');
});

t('健身页 moduleOff：按 modules 计算且空数组不重置', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  profile.male.modules = [];
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/fitness/fitness.js');
  const page = makePage(getCfg(), ['refresh']);
  page.refresh();
  if (page.data.moduleOff !== true) throw new Error('moduleOff 应为 true');
  if (profile.male.modules.length !== 0) throw new Error('空模块被重置: ' + profile.male.modules.join('/'));
  profile.male.modules = ['meals', 'fitness'];
  page.refresh();
  if (page.data.moduleOff !== false) throw new Error('开启 fitness 后 moduleOff 应为 false');
});

t('WXML 扫描：全量模板禁止 indexOf 方法调用', function () {
  const fs = require('fs');
  const walk = function (dir) {
    fs.readdirSync(dir).forEach(function (name) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.indexOf('.wxml') !== -1) {
        const txt = fs.readFileSync(full, 'utf8');
        if (/\.indexOf\s*\(/.test(txt)) throw new Error(full + ' 含 WXML 不支持的 indexOf 方法调用');
      }
    });
  };
  walk(path.join(__dirname, '..', 'miniprogram'));
});

console.log('');
console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
