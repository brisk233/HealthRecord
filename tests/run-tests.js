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
const testQueue = [];
function t(name, fn) {
  testQueue.push({ name: name, fn: fn });
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

console.log('== 习惯↔菜单映射与首次引导 ==');
const lifestyleFridge = function () {
  const t0 = require(mp('utils/date.js')).todayStr();
  return [
    { id: '1', name: '吊龙(切片)', cat: 'marinated', box: '①', purchased: t0, note: '' },
    { id: '2', name: '辣椒(切圈)', cat: 'veggie', box: '②', purchased: t0, note: '' },
    { id: '3', name: '叶子菜(洗切)', cat: 'leaf', box: '③', purchased: t0, note: '' },
    { id: '4', name: '鸡蛋', cat: 'egg', box: '④', purchased: t0, note: '' }
  ];
};
t('菜单：运动型优先高蛋白菜（涮牛肉锅）', function () {
  const d = mealplan.generateWeekMenu(lifestyleFridge(), { tasteLevel: '清淡', favs: [], tags: ['💪 运动型'] })[0];
  if (d.dinner !== '涮牛肉锅') throw new Error('运动型应首选高蛋白涮牛肉锅，实际 ' + d.dinner);
});
t('菜单：懒狗型不选 30 分钟慢菜', function () {
  const d = mealplan.generateWeekMenu(lifestyleFridge(), { tasteLevel: '偏辣', favs: [], tags: ['🐶 懒狗型'] })[0];
  if (d.dinner === '涮牛肉锅' || parseInt(d.cookTime, 10) > 15) throw new Error('懒狗型不应首选慢菜，实际 ' + d.dinner + ' ' + d.cookTime);
});
t('lifestyleScore：运动型高蛋白/懒狗型快手/夜猫型避辣直接生效', function () {
  if (mealplan.lifestyleScore({ proteinG: 35, cookTime: '30分钟', spicy: 0 }, ['💪 运动型']) >= 0) throw new Error('运动型未给高蛋白负分');
  if (mealplan.lifestyleScore({ proteinG: 10, cookTime: '10分钟', spicy: 0 }, ['🐶 懒狗型']) >= 0) throw new Error('懒狗型未给快手负分');
  if (mealplan.lifestyleScore({ proteinG: 10, cookTime: '10分钟', spicy: 2 }, ['🌙 夜猫型']) <= 0) throw new Error('夜猫型未给辣菜正分');
  if (mealplan.lifestyleScore({ proteinG: 35, cookTime: '30分钟', spicy: 0, veg: '叶子菜', elements: ['a', 'b', 'c'] }, ['🧘 养生型']) >= 0) throw new Error('养生型未给健康菜负分');
});
t('菜单：夜猫型/养生型避开辣菜', function () {
  const d1 = mealplan.generateWeekMenu(lifestyleFridge(), { tasteLevel: '清淡', favs: [], tags: ['🌙 夜猫型'] })[0];
  if (d1.dinner === '吊龙炒辣椒' || d1.dinner === '辣椒炒蛋') throw new Error('夜猫型不应首选辣菜: ' + d1.dinner);
  const d2 = mealplan.generateWeekMenu(lifestyleFridge(), { tasteLevel: '清淡', favs: [], tags: ['🧘 养生型'] })[0];
  if (d2.dinner === '吊龙炒辣椒' || d2.dinner === '辣椒炒蛋') throw new Error('养生型不应首选辣菜: ' + d2.dinner);
});

t('首次进入：无标签且未跳过 → 首页显示引导提示条（不强制跳转）', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  profile.male.tags = [];
  installMocks(profile);
  let navCount = 0;
  global.wx.navigateTo = function () { navCount++; };
  const getCfg = capturePage();
  loadPage('pages/today/today.js');
  const page = makePage(getCfg(), ['onShow', 'refresh']);
  page.onShow();
  if (page.data.showGuide !== true) throw new Error('首次应显示引导提示条 showGuide=true');
  if (navCount !== 0) throw new Error('不应强制跳转引导页');
  page.onShow();
  if (navCount !== 0) throw new Error('重复 onShow 不应跳转');
});

t('首次进入：已跳过或已有标签 → 不跳转', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  profile.male.tags = [];
  installMocks(profile);
  mockStorage.guideSkipped = 1;
  let navCount = 0;
  global.wx.navigateTo = function () { navCount++; };
  const getCfg = capturePage();
  loadPage('pages/today/today.js');
  const page = makePage(getCfg(), ['onShow', 'refresh']);
  page.onShow();
  if (navCount !== 0) throw new Error('跳过标记下不应跳转');
  const profile2 = JSON.parse(JSON.stringify(seed.defaultProfile));
  profile2.male.tags = ['💪 运动型'];
  installMocks(profile2);
  loadPage('pages/today/today.js');
  const page2 = makePage(getCfg(), ['onShow', 'refresh']);
  page2.onShow();
  if (navCount !== 0) throw new Error('已有标签不应跳转');
});

t('重新选择：保留自定义习惯、替换推荐、跳过写标记', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  profile.male.habits = [
    { key: 'c1', name: '练字', icon: '✍️', freq: '每天' },
    { key: 'r1', name: '跑步3公里', icon: '🏃', freq: '每周3次' }
  ];
  installMocks(profile);
  mockStorage.myGender = 'male';
  const getCfg = capturePage();
  loadPage('pages/onboarding/onboarding.js');
  const page = makePage(getCfg(), ['onLoad', 'toggleMajor', 'toggleSub', 'finish', 'skip']);
  page.onLoad();
  page.toggleMajor({ currentTarget: { dataset: { k: 'health' } } });
  page.finish();
  const habits = profile.male.habits;
  if (!habits.some(function (h) { return h.name === '练字'; })) throw new Error('自定义习惯被清掉');
  if (habits.some(function (h) { return h.name === '跑步3公里'; })) throw new Error('旧推荐习惯未替换');
  if (!habits.some(function (h) { return h.name === '喝水8杯'; })) throw new Error('新推荐习惯未生成');
  if (mockStorage.guideSkipped) throw new Error('完成后应清除跳过标记');
  page.skip();
  if (!mockStorage.guideSkipped) throw new Error('跳过未写标记');
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
  global.__mockApp = { globalData: { profile: profile, fridge: [], version: '2.1.9' }, resetLocal: function () {} };
  global.wx = {
    getStorageSync: function (k) { return mockStorage[k]; },
    setStorageSync: function (k, v) { mockStorage[k] = v; },
    removeStorageSync: function (k) { delete mockStorage[k]; },
    clearStorageSync: function () { mockStorage = {}; },
    cloud: { callFunction: function () { return Promise.resolve({ result: null }); }, init: function () {} },
    showToast: function () {}, showModal: function (opt) { if (opt && opt.success) opt.success({ confirm: true }); }, showActionSheet: function () {},
    showLoading: function () {}, hideLoading: function () {},
    vibrateShort: function () {}, requestSubscribeMessage: function () {},
    setClipboardData: function () {}, navigateTo: function () {}, navigateBack: function () {}, switchTab: function () {}
  };
  global.getApp = function () { return global.__mockApp; };
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
  (methods || ['refresh', 'buildFavAll', 'saveProfile', 'onModuleToggle', 'onFavToggle', 'onFavDel', 'clearFavs', 'addFav', 'addHabit', 'autoHabitIcon', 'moduleName', 'copyCode']).forEach(function (m) {
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

t('复制邀请码：经隐私弹窗授权后写入剪贴板', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/profile/profile.js');
  const page = makePage(getCfg());
  let copied = '';
  page.selectComponent = function () {
    return { ensure: function (cb) { cb(); } };
  };
  global.wx.setClipboardData = function (opt) { copied = opt.data; if (opt.success) opt.success(); };
  page.setData({ family: { code: 'ABC123' } });
  page.copyCode();
  if (copied !== 'ABC123') throw new Error('剪贴板未写入邀请码');
});

t('自定义习惯：不填图标，自动按名称生成', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/profile/profile.js');
  const page = makePage(getCfg());
  page.setData({ newHabit: { name: '每天喝水', icon: '' } });
  page.addHabit();
  const h1 = profile.male.habits[profile.male.habits.length - 1];
  if (h1.icon !== '💧') throw new Error('喝水习惯未自动生成水滴图标: ' + h1.icon);
  page.setData({ newHabit: { name: '练字', icon: '' } });
  page.addHabit();
  const h2 = profile.male.habits[profile.male.habits.length - 1];
  if (h2.icon !== '✍️') throw new Error('练字习惯未自动生成笔图标');
  page.setData({ newHabit: { name: '奇怪习惯', icon: '' } });
  page.addHabit();
  const h3 = profile.male.habits[profile.male.habits.length - 1];
  if (h3.icon !== '⭐') throw new Error('未知习惯未使用默认图标');
  const stored = mockStorage.profile;
  if (!stored || stored.male.habits.length !== profile.male.habits.length) throw new Error('自定义习惯未持久化');
});

t('建议提交：纯文字+图片，先上传再调 suggestAdd', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  mockStorage.myOpenid = 'o1';
  const calls = [];
  global.wx.cloud.callFunction = function (opt) {
    calls.push(opt);
    if (opt.name === 'family' && opt.data.action === 'suggestAdd') return Promise.resolve({ result: { ok: true } });
    return Promise.resolve({ result: {} });
  };
  global.wx.cloud.uploadFile = function (opt) { if (opt.success) opt.success({ fileID: 'cloud://sug/' + opt.cloudPath }); };
  global.wx.chooseMedia = function (opt) { if (opt.success) opt.success({ tempFiles: [{ tempFilePath: 'tmp1.jpg' }, { tempFilePath: 'tmp2.jpg' }] }); };
  const getCfg = capturePage();
  loadPage('pages/suggest/suggest.js');
  const page = makePage(getCfg(), ['onText', 'pickImage', 'removeImage', 'previewImage', 'submit']);
  page.selectComponent = function () { return { ensure: function (cb) { cb(); } }; };
  page.setData({ text: '希望增加夜间模式' });
  page.pickImage();
  if (page.data.images.length !== 2) throw new Error('选图后 images 应为 2');
  page.submit();
  return new Promise(function (res, rej) {
    setTimeout(function () {
      try {
        const adds = calls.filter(function (c) { return c.name === 'family' && c.data.action === 'suggestAdd'; });
        if (!adds.length) throw new Error('未调用 suggestAdd');
        const last = adds[adds.length - 1].data;
        if (last.text !== '希望增加夜间模式') throw new Error('建议文本未提交');
        if (last.images.length !== 2) throw new Error('图片未上传提交: ' + last.images.length);
        if (last.images[0].indexOf('cloud://sug/') !== 0) throw new Error('图片 fileID 不正确');
        res();
      } catch (e) { rej(e); }
    }, 30);
  });
});

t('建议提交：空内容拦截、删除图片生效', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const calls = [];
  global.wx.cloud.callFunction = function (opt) { calls.push(opt); return Promise.resolve({ result: {} }); };
  global.wx.chooseMedia = function (opt) { if (opt.success) opt.success({ tempFiles: [{ tempFilePath: 'tmp1.jpg' }, { tempFilePath: 'tmp2.jpg' }] }); };
  const getCfg = capturePage();
  loadPage('pages/suggest/suggest.js');
  const page = makePage(getCfg(), ['onText', 'pickImage', 'removeImage', 'previewImage', 'submit']);
  page.selectComponent = function () { return { ensure: function (cb) { cb(); } }; };
  page.submit();
  if (calls.some(function (c) { return c.name === 'family' && c.data.action === 'suggestAdd'; })) throw new Error('空内容不应提交');
  page.pickImage();
  page.removeImage({ currentTarget: { dataset: { idx: 1 } } });
  if (page.data.images.length !== 1) throw new Error('删除图片后应为 1 张');
});

t('查看建议：拉取列表并格式化时间', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  global.wx.cloud.callFunction = function (opt) {
    if (opt.name === 'family' && opt.data.action === 'suggestList') {
      return Promise.resolve({ result: { ok: true, data: [{ id: 's1', nickname: '李爹', gender: 'male', text: '好用', images: [], createdAt: 1787643416847, status: 'new' }] } });
    }
    return Promise.resolve({ result: {} });
  };
  const getCfg = capturePage();
  loadPage('pages/suggestions/suggestions.js');
  const page = makePage(getCfg(), ['onShow', 'previewImage']);
  page.onShow();
  return new Promise(function (res, rej) {
    setTimeout(function () {
      try {
        if (page.data.list.length !== 1) throw new Error('建议列表未加载');
        if (page.data.list[0].text !== '好用') throw new Error('建议内容错误');
        if (!page.data.list[0].dateText) throw new Error('时间未格式化');
        res();
      } catch (e) { rej(e); }
    }, 30);
  });
});

t('我的页含提交/查看建议入口，页面已注册', function () {
  const fs = require('fs');
  const wxml = fs.readFileSync(mp('pages/profile/profile.wxml'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(mp('app.json'), 'utf8'));
  if (wxml.indexOf('提交建议') === -1 || wxml.indexOf('查看建议') === -1) throw new Error('我的页缺少建议入口');
  if (appJson.pages.indexOf('pages/suggest/suggest') === -1) throw new Error('suggest 页面未注册');
  if (appJson.pages.indexOf('pages/suggestions/suggestions') === -1) throw new Error('suggestions 页面未注册');
});

t('云端合并不丢 trainOrder（健身课表排序持久化）', function () {
  const local = JSON.parse(JSON.stringify(seed.defaultProfile));
  local.trainOrder = { male: [6, 5, 4, 3, 2, 1, 0] };
  const remote = JSON.parse(JSON.stringify(seed.defaultProfile));
  remote.trainOrder = { male: [6, 5, 4, 3, 2, 1, 0] };
  remote.male._t = 1000;
  const merged = cloudsync.mergeProfile(local, remote);
  if (!merged.trainOrder || merged.trainOrder.male[0] !== 6) throw new Error('trainOrder 被合并逻辑丢弃');
});

t('今日三餐打卡：选择后写入 meals 存储（含食堂选项）', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/today/today.js');
  const page = makePage(getCfg(), ['refresh', 'tapMeal', 'pickMeal', 'toggleSupp', 'toggleHabit']);
  page.refresh();
  page.tapMeal({ currentTarget: { dataset: { k: 'd' } } });
  if (!page.data.mealSheet.show || page.data.mealSheet.list.length !== 7) throw new Error('弹层未打开或选项数不对');
  // 食堂：直接选新选项
  page.pickMeal({ currentTarget: { dataset: { v: 'canteen' } } });
  const key = 'meals-male-' + require(mp('utils/date.js')).todayStr();
  if (!mockStorage[key] || mockStorage[key].d !== 'canteen') throw new Error('食堂打卡未写入');
  // 按菜单吃
  page.tapMeal({ currentTarget: { dataset: { k: 'l' } } });
  page.pickMeal({ currentTarget: { dataset: { v: 'menu' } } });
  if (!mockStorage[key] || mockStorage[key].l !== 'menu') throw new Error('午餐打卡未写入');
  page.toggleSupp({ currentTarget: { dataset: { key: 'fishOil' } }, detail: { value: true } });
  const supKey = 'supps-male-' + require(mp('utils/date.js')).todayStr();
  if (!mockStorage[supKey] || !mockStorage[supKey].fishOil) throw new Error('补剂打卡未写入');
  page.toggleHabit({ currentTarget: { dataset: { key: 'h1' } } });
  const habitKey = 'habit-male-' + require(mp('utils/date.js')).todayStr();
  if (!mockStorage[habitKey] || !mockStorage[habitKey].h1) throw new Error('习惯打卡未写入');
});

t('健身：训练打卡/取消、自定义运动/取消', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/fitness/fitness.js');
  const page = makePage(getCfg(), ['refresh', 'checkin', 'checkinCustom', 'cancelCustom', 'persistOrder', 'resetOrder']);
  page.refresh();
  const today = require(mp('utils/date.js')).todayStr();
  page.checkin();
  if (!mockStorage['train-male-' + today]) throw new Error('训练打卡未写入');
  page.checkin();
  if (mockStorage['train-male-' + today]) throw new Error('训练取消未生效');
  page.setData({ customType: '篮球', customMinutes: 60 });
  page.checkinCustom();
  if (!mockStorage['custom-male-' + today] || mockStorage['custom-male-' + today].type !== '篮球') throw new Error('自定义运动未写入');
  page.cancelCustom();
  if (mockStorage['custom-male-' + today]) throw new Error('取消自定义运动未生效');
  page.setData({ order: [1, 0, 2, 3, 4, 5, 6] });
  page.persistOrder();
  if (!profile.trainOrder || !profile.trainOrder.male || profile.trainOrder.male[0] !== 1) throw new Error('课表顺序未持久化');
  page.resetOrder();
  if (profile.trainOrder.male[0] !== 0) throw new Error('恢复默认课表未生效');
});

t('菜单：采购/备菜勾选、重新生成、恢复默认', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/meals/meals.js');
  const page = makePage(getCfg(), ['refresh', 'regen', 'resetMenu', 'toggleAllBuy', 'toggleAllSteps', 'toggleBuy', 'toggleStep', 'persistMenu']);
  page.refresh();
  if (!page.data.purchase.length) throw new Error('采购清单为空');
  page.toggleBuy({ currentTarget: { dataset: { idx: 0 } } });
  if (!page.data.purchase[0].done) throw new Error('采购单项勾选未生效');
  page.toggleAllBuy();
  if (!page.data.purchase.every(function (x) { return x.done; })) throw new Error('采购一键全选未生效');
  page.toggleStep({ currentTarget: { dataset: { idx: 0 } } });
  page.toggleAllSteps();
  if (!page.data.steps.every(function (x) { return x.done; })) throw new Error('备菜一键全选未生效');
  mockStorage.menuOverride = { '2099-01-01': { dinner: 'x' } };
  page.regen();
  if (mockStorage.menuOverride) throw new Error('重新生成未清除 menuOverride');
  page.persistMenu();
  if (!mockStorage.menuOverride) throw new Error('拖拽持久化未写入 menuOverride');
  page.resetMenu();
  if (mockStorage.menuOverride) throw new Error('恢复默认未清除 menuOverride');
});

t('冰箱：入库校验、入库、吃掉了', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  const getCfg = capturePage();
  loadPage('pages/fridge/fridge.js');
  const page = makePage(getCfg(), ['onLoad', 'refresh', 'addItem', 'eatItem']);
  page.onLoad();
  page.refresh();
  const app = global.getApp();
  page.setData({ form: { name: '', catIdx: 0, box: '' } });
  page.addItem();
  if (app.globalData.fridge.length !== 0) throw new Error('空名称不应入库');
  page.setData({ form: { name: '番茄', catIdx: 1, box: '冷藏' } });
  page.addItem();
  if (app.globalData.fridge.length !== 1) throw new Error('入库失败');
  page.eatItem({ currentTarget: { dataset: { id: app.globalData.fridge[0].id } } });
  if (app.globalData.fridge.length !== 0) throw new Error('吃掉了未生效');
});

t('跨页：冰箱本地改动后，菜单页拉取不复活已吃食材', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  mockStorage.familyCode = 'T3JK6D';
  global.wx.cloud.callFunction = function (opt) {
    if (opt.name === 'family' && opt.data.action === 'push') return new Promise(function () {}); // 推送保持未确认
    return Promise.resolve({ result: null });
  };
  const cloudsyncMod = require(mp('utils/cloudsync.js'));
  const oldPull = cloudsyncMod.pullHome;
  let resolvePull;
  cloudsyncMod.pullHome = function () { return new Promise(function (res) { resolvePull = res; }); };
  const app = global.getApp();
  const oldFridge = [{ id: 'f1', name: '过期食材', cat: 'leaf', box: 'x', purchased: '2026-01-01', note: '' }];
  app.globalData.fridge = oldFridge.slice();
  const getCfg = capturePage();
  loadPage('pages/fridge/fridge.js');
  const fpage = makePage(getCfg(), ['refresh', 'eatItem']);
  fpage.refresh();
  fpage.eatItem({ currentTarget: { dataset: { id: 'f1' } } });
  if (app.globalData.fridge.length !== 0) throw new Error('冰箱页吃掉未生效');
  loadPage('pages/meals/meals.js');
  const mpage = makePage(getCfg(), ['onShow', 'refresh']);
  mpage.onShow();
  resolvePull({ fridge: oldFridge.slice(), profile: null });
  return new Promise(function (res, rej) {
    setTimeout(function () {
      try {
        cloudsyncMod.pullHome = oldPull;
        if (app.globalData.fridge.length !== 0) throw new Error('菜单页拉取把已吃食材复活');
        res();
      } catch (e) { cloudsyncMod.pullHome = oldPull; rej(e); }
    }, 20);
  });
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

t('云端空 tags/subTags 不抹本地已选生活方式（mergeProfile 守卫）', function () {
  const local = JSON.parse(JSON.stringify(seed.defaultProfile));
  local.male.tags = ['💪 运动型'];
  local.male.subTags = ['健身'];
  local.male._t = 2000;
  const remote = JSON.parse(JSON.stringify(seed.defaultProfile));
  remote.male.tags = [];
  remote.male.subTags = [];
  remote.male._t = 3000;
  const merged = cloudsync.mergeProfile(local, remote);
  if (!merged.male.tags.some(function (t) { return t.indexOf('运动型') !== -1; })) throw new Error('云端空 tags 覆盖了本地标签');
  if (merged.male.subTags.indexOf('健身') === -1) throw new Error('云端空 subTags 覆盖了本地细分');
});

t('退出登录后重登：默认档案合并云端恢复生活方式（云端无 _t 也恢复）', function () {
  const local = JSON.parse(JSON.stringify(seed.defaultProfile)); // 无 _t、数组全空 = 退出后的本机状态
  const remote = JSON.parse(JSON.stringify(seed.defaultProfile));
  remote.male.tags = ['💪 运动型'];
  remote.male.subTags = ['健身'];
  remote.male.habits = [{ key: 'h1', name: '健身30分钟', icon: '🏋️', freq: '每天' }];
  remote.male.modules = ['meals', 'supps'];
  remote.male.favs = ['鲈鱼'];
  remote.male.favHidden = ['牛腩'];
  // 注意：remote 不设置 _t —— 模拟旧云端没有时间戳
  const merged = cloudsync.mergeProfile(local, remote);
  if (!merged.male.tags.some(function (t) { return t.indexOf('运动型') !== -1; })) throw new Error('重登后 tags 未恢复');
  if (!merged.male.subTags.length) throw new Error('重登后 subTags 未恢复');
  if (!merged.male.habits.length) throw new Error('重登后 habits 未恢复');
  if (merged.male.modules.indexOf('supps') === -1) throw new Error('重登后 modules 未恢复');
  if (merged.male.favs.indexOf('鲈鱼') === -1) throw new Error('重登后 favs 未恢复');
  if (merged.male.favHidden.indexOf('牛腩') === -1) throw new Error('重登后 favHidden 未恢复');
});

t('本地已保存(有 _t)且数组为空时，云端旧数据不得覆盖', function () {
  const local = JSON.parse(JSON.stringify(seed.defaultProfile));
  local.male.tags = [];
  local.male.habits = [];
  local.male.favs = [];
  local.male._t = 2000;
  const remote = JSON.parse(JSON.stringify(seed.defaultProfile));
  remote.male.tags = ['💪 运动型'];
  remote.male.habits = [{ key: 'h1', name: 'x', icon: '🏋️', freq: '每天' }];
  remote.male.favs = ['鲈鱼'];
  remote.male._t = 1000; // 云端更旧
  const merged = cloudsync.mergeProfile(local, remote);
  if (merged.male.tags.length !== 0) throw new Error('本地已保存的空 tags 被云端覆盖');
  if (merged.male.habits.length !== 0) throw new Error('本地已保存的空 habits 被云端覆盖');
  if (merged.male.favs.length !== 0) throw new Error('本地已保存的空 favs 被云端覆盖');
});

t('退出登录→重新登录：生活方式从云端恢复（端到端页面流程）', function () {
  const remoteProfile = JSON.parse(JSON.stringify(seed.defaultProfile));
  remoteProfile.male.tags = ['💪 运动型'];
  remoteProfile.male.subTags = ['健身'];
  remoteProfile.male.habits = [{ key: 'h1', name: '健身30分钟', icon: '🏋️', freq: '每天' }];
  remoteProfile.male.modules = ['meals', 'supps'];
  // 不设 _t：模拟旧云端
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  mockStorage.myOpenid = 'o1';
  mockStorage.familyCode = 'T3JK6D';
  mockStorage.myGender = 'male';
  global.wx.showModal = function (opt) { if (opt.success) opt.success({ confirm: true }); };
  global.wx.cloud.callFunction = function (opt) {
    if (opt.name === 'login') return Promise.resolve({ result: { openid: 'o1' } });
    if (opt.name === 'family') {
      if (opt.data.action === 'info') return Promise.resolve({ result: { ok: true, data: { code: 'T3JK6D', myGender: 'male', members: [], name: '家' } } });
      if (opt.data.action === 'pull') return Promise.resolve({ result: { ok: true, data: { profile: remoteProfile, fridge: [] } } });
      if (opt.data.action === 'push') return Promise.resolve({ result: { ok: true } });
    }
    return Promise.resolve({ result: {} });
  };
  const getCfg = capturePage();
  loadPage('pages/profile/profile.js');
  const page = makePage(getCfg());
  page.selectComponent = function () { return { ensure: function (cb) { cb(); } }; };
  page.logout();
  const app = global.getApp();
  if (app.globalData.profile.male.tags.length !== 0) throw new Error('退出后本机应清空生活方式');
  page.doLogin();
  return new Promise(function (res, rej) {
    setTimeout(function () {
      try {
        if (!app.globalData.profile.male.tags.some(function (t) { return t.indexOf('运动型') !== -1; })) throw new Error('重登后生活方式未恢复');
        const stored = mockStorage.profile;
        if (!stored || !stored.male.tags.some(function (t) { return t.indexOf('运动型') !== -1; })) throw new Error('重登后未写回存储');
        res();
      } catch (e) { rej(e); }
    }, 50);
  });
});

t('生活方式：完成引导后 tags/subTags/habits/modules 持久化且再次进入回显', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  mockStorage.myGender = 'male';
  const getCfg = capturePage();
  loadPage('pages/onboarding/onboarding.js');
  const page = makePage(getCfg(), ['onLoad', 'toggleMajor', 'toggleSub', 'finish']);
  page.onLoad();
  page.toggleMajor({ currentTarget: { dataset: { k: 'sport' } } });
  page.toggleMajor({ currentTarget: { dataset: { k: 'health' } } });
  page.toggleSub({ currentTarget: { dataset: { v: '健身' } } });
  page.finish();
  const stored = mockStorage.profile;
  if (!stored.male.tags.length) throw new Error('tags 未持久化');
  if (stored.male.tags[0].indexOf('运动型') === -1) throw new Error('tags 内容错误');
  if (!stored.male.subTags.length) throw new Error('subTags 未持久化');
  if (!stored.male.habits.length) throw new Error('habits 未持久化');
  if (stored.male.modules.indexOf('fitness') === -1) throw new Error('运动型应默认开启健身');
  if (!stored.male._t) throw new Error('_t 未写入');
  const page2 = makePage(getCfg(), ['onLoad']);
  page2.onLoad();
  if (!page2.data.selected.sport || !page2.data.selected.health) throw new Error('onLoad 未回显已存标签');
});

t('冰箱：拉取期间的本地「吃掉」不被云端旧数据覆盖', function () {
  const profile = JSON.parse(JSON.stringify(seed.defaultProfile));
  installMocks(profile);
  mockStorage.familyCode = 'T3JK6D';
  global.wx.cloud.callFunction = function (opt) {
    if (opt.name === 'family' && opt.data.action === 'push') return new Promise(function () {}); // 推送保持未确认
    return Promise.resolve({ result: null });
  };
  const cloudsyncMod = require(mp('utils/cloudsync.js'));
  const oldPull = cloudsyncMod.pullHome;
  let resolvePull;
  cloudsyncMod.pullHome = function () { return new Promise(function (res) { resolvePull = res; }); };
  const app = global.getApp();
  const oldFridge = [{ id: 'f1', name: '过期食材', cat: 'leaf', box: 'x', purchased: '2026-01-01', note: '' }];
  app.globalData.fridge = oldFridge.slice();
  const getCfg = capturePage();
  loadPage('pages/fridge/fridge.js');
  const page = makePage(getCfg(), ['refresh', 'pullCloud', 'eatItem']);
  page.refresh();
  page.pullCloud(function () {});
  page.eatItem({ currentTarget: { dataset: { id: 'f1' } } });
  if (app.globalData.fridge.length !== 0) throw new Error('吃掉后本地未移除');
  resolvePull({ fridge: oldFridge.slice() });
  return new Promise(function (res, rej) {
    setTimeout(function () {
      try {
        cloudsyncMod.pullHome = oldPull;
        if (app.globalData.fridge.length !== 0) throw new Error('云端旧数据把已吃掉的食材复活了');
        res();
      } catch (e) { cloudsyncMod.pullHome = oldPull; rej(e); }
    }, 20);
  });
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

t('喜欢食材弹层确认=全量同步：取消勾选即移除（树内），手输自定义不受影响', function () {
  const foodtree = require(mp('data/foodtree.js'));
  const treeNames = {};
  foodtree.forEach(function (l1) {
    (l1.children || []).forEach(function (l2) {
      (l2.items || []).forEach(function (it) { treeNames[it.name] = true; });
    });
  });
  // 已选：牛腩 + 手输 腊肉；弹层取消牛腩、勾选吊龙
  let favs = ['牛腩', '腊肉'];
  const chosen = ['吊龙'];
  const favHidden = [];
  chosen.forEach(function (v) {
    const hi = favHidden.indexOf(v);
    if (hi !== -1) favHidden.splice(hi, 1);
    if (favs.indexOf(v) === -1) { favs.push(v); }
  });
  favs = favs.filter(function (v) {
    if (treeNames[v] && chosen.indexOf(v) === -1) return false;
    return true;
  });
  if (favs.indexOf('牛腩') !== -1) throw new Error('取消的牛腩未移除');
  if (favs.indexOf('腊肉') === -1) throw new Error('手输的腊肉被误删');
  if (favs.indexOf('吊龙') === -1) throw new Error('勾选的吊龙未添加');
  if (favs.length !== 2) throw new Error('最终应为 腊肉+吊龙，实际 ' + favs.join('/'));
});

t('食材树选择器：点选后渲染源 curL1 同步勾选、可移除、单选只留一个', function () {
  // 组件模板不能加载（WXML 不走 node），直接模拟 Component 逻辑
  let cfg = null;
  const oldComponent = global.Component;
  global.Component = function (c) { cfg = c; };
  delete require.cache[require.resolve(mp('components/tree-picker/tree-picker.js'))];
  require(mp('components/tree-picker/tree-picker.js'));
  global.Component = oldComponent;
  const inst = {
    data: JSON.parse(JSON.stringify(cfg.data)),
    setData: function (p) { Object.keys(p).forEach(function (k) { inst.data[k] = p[k]; }); },
    triggerEvent: function () {}
  };
  Object.keys(cfg.methods).forEach(function (k) { inst[k] = cfg.methods[k].bind(inst); });
  // 多选
  inst.open({ title: 't', mode: 'multi' });
  inst.toggleLeaf({ currentTarget: { dataset: { pos: '牛肉|0' } } });
  if (inst.data.chosen.indexOf('牛腩') === -1) throw new Error('多选点选后 chosen 不含牛腩');
  if (inst.data.curL1.children[0].items[0].checked !== true) throw new Error('渲染源 curL1 未同步勾选（选中标识不显示）');
  inst.toggleLeaf({ currentTarget: { dataset: { pos: '牛肉|1' } } });
  if (inst.data.chosen.length !== 2) throw new Error('多选第二项失败: ' + inst.data.chosen.join('/'));
  // 移除
  inst.removeChosen({ currentTarget: { dataset: { v: '牛腩' } } });
  if (inst.data.chosen.indexOf('牛腩') !== -1) throw new Error('移除牛腩失败');
  if (inst.data.curL1.children[0].items[0].checked !== false) throw new Error('移除后渲染源未清除勾选');
  // 单选：只留一个
  inst.open({ title: 's', mode: 'single' });
  inst.toggleLeaf({ currentTarget: { dataset: { pos: '牛肉|0' } } });
  inst.toggleLeaf({ currentTarget: { dataset: { pos: '牛肉|1' } } });
  if (inst.data.chosen.length !== 1 || inst.data.chosen[0] !== '吊龙') throw new Error('单选应只留最后一项: ' + inst.data.chosen.join('/'));
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
        // WXML 模板 {{ }} 中禁止调用自定义函数（如 {{foo(idx)}}），否则编译失败、页面不响应
        const callInExpr = /\{\{[^}]*[A-Za-z_$][A-Za-z0-9_$]*\s*\([^}]*\}\}/;
        if (callInExpr.test(txt)) {
          const m = txt.match(callInExpr);
          throw new Error(full + ' 含 WXML 不支持的函数调用: ' + String(m && m[0]).slice(0, 60));
        }
      }
    });
  };
  walk(path.join(__dirname, '..', 'miniprogram'));
});

console.log('');
(async function runAll() {
  for (let i = 0; i < testQueue.length; i++) {
    const item = testQueue[i];
    try {
      const r = item.fn();
      if (r && typeof r.then === 'function') await r;
      pass++; console.log('  ✓ ' + item.name);
    } catch (e) {
      fail++; console.log('  ✗ ' + item.name + ' -> ' + e.message);
    }
  }
  console.log('');
  console.log('结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail > 0 ? 1 : 0);
})();
