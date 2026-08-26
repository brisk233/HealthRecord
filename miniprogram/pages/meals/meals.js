const app = getApp();
const mealplan = require('../../utils/mealplan.js');
const nutrition = require('../../utils/nutrition.js');
const drag = require('../../utils/drag.js');
const cloudsync = require('../../utils/cloudsync.js');
const recipes = require('../../data/recipes.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
function tipFor(gap) {
  const n = Math.max(1, Math.ceil(gap / 7));
  return '建议加餐：鸡蛋×' + n + ' 或牛奶一杯';
}
function normName(name) {
  return String(name || '').replace(/[（(][^）)]*[）)]/g, '').trim();
}
function fridgeHas(fridge, ingredient) {
  if (!fridge || !ingredient) return false;
  return fridge.some(function (it) {
    const n = normName(it.name);
    return n.indexOf(ingredient) !== -1 || ingredient.indexOf(n) !== -1;
  });
}

Page({
  data: {
    seg: 'menu', days: [], targets: {}, missing: [], purchase: [], steps: [],
    buyDone: 0, stepDone: 0, buyPct: 0, stepPct: 0, fridgeEmpty: false, dragIdx: -1,
    allBought: false, allSteps: false, expandedDate: ''
  },
  onShow() {
    this.refresh();
    // M5：首次拖动提示
    if (!wx.getStorageSync('dragHintShown')) {
      wx.setStorageSync('dragHintShown', 1);
      setTimeout(function () { wx.showToast({ title: '长按行首 ☰ 可拖动换序', icon: 'none' }); }, 800);
    }
    const cleanAtPullStart = cloudsync.fridgeSyncClean();
    const versionAtPullStart = cloudsync.fridgeVersion();
    cloudsync.pullHome().then(function (home) {
      if (home) {
        if (home.profile) { app.globalData.profile = cloudsync.mergeProfile(app.globalData.profile, home.profile); wx.setStorageSync('profile', app.globalData.profile); }
        if (home.fridge) {
          // 拉取期间冰箱本地有增删：以本地为准，避免旧数据复活已吃/覆盖新入库
          if (!cleanAtPullStart || cloudsync.fridgeChangedSince(versionAtPullStart)) {
            cloudsync.pushFridge(app.globalData.fridge);
          } else {
            app.globalData.fridge = home.fridge;
            wx.setStorageSync('fridge', home.fridge);
          }
        }
        if (home.menuOverride !== undefined) wx.setStorageSync('menuOverride', home.menuOverride || {});
      }
      this.refresh();
    }.bind(this)).catch(function () {});
  },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  switchSeg(e) { this.setData({ seg: e.currentTarget.dataset.seg }); },
  refresh() {
    const p = app.globalData.profile;
    const targets = { male: nutrition.proteinTarget(p.male), female: nutrition.proteinTarget(p.female) };
    const override = wx.getStorageSync('menuOverride') || {};
    const person = app.globalData.profile[cloudsync.myGender()];
    const prefs = { tasteLevel: person.tasteLevel || '微辣', favs: person.favs || [], tags: person.tags || [] };
    const days = mealplan.generateWeekMenu(app.globalData.fridge, prefs).map(function (d) {
      const base = override[d.date] ? Object.assign({}, d, override[d.date]) : d;
      const isPurchased = base.purchased !== false;
      const gapM = targets.male - base.totalG;
      const gapF = targets.female - base.totalG;
      return Object.assign({}, base, {
        purchased: isPurchased,
        gapM: gapM, tipM: isPurchased ? tipFor(gapM) : '',
        gapF: gapF, tipF: isPurchased ? tipFor(gapF) : '',
        pM: isPurchased ? Math.min(100, Math.round(base.totalG / targets.male * 100)) : 0,
        pF: isPurchased ? Math.min(100, Math.round(base.totalG / targets.female * 100)) : 0
      });
    });
    // 默认展开「今天」的卡片（其余折叠，M6）
    let expandedDate = this.data.expandedDate;
    if (days.length && !days.some(function (d) { return d.date === expandedDate; })) {
      expandedDate = days[0].date;
    }
    const missMap = {};
    days.forEach(function (d) { (d.missing || []).forEach(function (m) { missMap[m] = 1; }); });
    const buyKey = 'purchase-done';
    const stepKey = 'prep-done';
    const bought = wx.getStorageSync(buyKey) || {};
    const stepped = wx.getStorageSync(stepKey) || {};
    const purchase = mealplan.PURCHASE_LIST.map(function (x, i) {
      return Object.assign({}, x, { done: !!bought[i] });
    });
    const steps = mealplan.PREP_STEPS.map(function (x, i) {
      return Object.assign({}, x, { done: !!stepped[i] });
    });
    const buyDone = purchase.filter(function (x) { return x.done; }).length;
    const stepDone = steps.filter(function (x) { return x.done; }).length;
    this.setData({
      days: days, targets: targets, missing: Object.keys(missMap), expandedDate: expandedDate,
      fridgeEmpty: app.globalData.fridge.length === 0,
      purchase: purchase, steps: steps,
      buyDone: buyDone, stepDone: stepDone, allBought: purchase.length > 0 && buyDone === purchase.length, allSteps: steps.length > 0 && stepDone === steps.length,
      buyPct: Math.round(buyDone / purchase.length * 100),
      stepPct: Math.round(stepDone / steps.length * 100)
    });
  },
  // M6：展开/收起某天详情
  toggleDay(e) {
    const d = e.currentTarget.dataset.date;
    this.setData({ expandedDate: this.data.expandedDate === d ? '' : d });
  },
  // M1：重新生成前确认
  regen() {
    const that = this;
    wx.showModal({
      title: '重新生成菜单',
      content: '会清掉你手动调整过的顺序，按冰箱库存+喜好重新排。确定？',
      confirmText: '重新生成',
      success: function (res) {
        if (!res.confirm) return;
        wx.removeStorageSync('menuOverride');
        cloudsync.pushHome({ menuOverride: {} });
        that.refresh();
        wx.showToast({ title: '已按冰箱库存重新生成', icon: 'none' });
      }
    });
  },
  goFridge() { wx.switchTab({ url: '/pages/fridge/fridge' }); },
  onDragStart(e) { drag.startDrag(this, e, 'days'); },
  onDragMove(e) { drag.moveDrag(this, e, 'days', null); },
  onDragEnd() { drag.endDrag(this, this.persistMenu.bind(this)); },
  persistMenu() {
    const override = {};
    this.data.days.forEach(function (d) {
      override[d.date] = {
        dinner: d.dinner, side: d.side, box: d.box, method: d.method, cookTime: d.cookTime,
        proteinG: d.proteinG, kcal: d.kcal, elements: d.elements, missing: d.missing,
        purchased: d.purchased !== false
      };
    });
    wx.setStorageSync('menuOverride', override);
    cloudsync.pushHome({ menuOverride: override });
    this.refresh();
  },
  // M4：换一道主菜（弹 action sheet 选菜）
  swapDish(e) {
    const date = e.currentTarget.dataset.date;
    const that = this;
    const day = this.data.days.find(function (d) { return d.date === date; });
    if (!day) return;
    const fridge = app.globalData.fridge;
    // 候选：主菜、非早餐、其他天没用过、冰箱有主料（或主料缺但配菜在，优先冰箱有料）
    const used = this.data.days.filter(function (d) { return d.date !== date; }).map(function (d) { return d.dinner; });
    const pool = recipes.filter(function (r) {
      return r.main !== '-' && r.name.indexOf('早餐') === -1 && used.indexOf(r.name) === -1 && fridgeHas(fridge, r.main);
    });
    if (!pool.length) { wx.showToast({ title: '冰箱里暂无其他可换的主料，先入库或采购吧', icon: 'none' }); return; }
    const itemList = pool.slice(0, 6).map(function (r) { return r.name + ' · ' + r.proteinG + 'g蛋白'; });
    wx.showActionSheet({
      itemList: itemList,
      success: function (res) {
        const r = pool[res.tapIndex];
        const days = that.data.days.map(function (d) {
          if (d.date !== date) return d;
          const sideName = (d.side && d.side !== '—' && d.side !== '加一道蔬菜吧') ? d.side : null;
          let sideProtein = 0, sideKcal = 0, sideEls = [], sideBox = '';
          if (sideName) {
            const s = recipes.find(function (x) { return x.name === sideName; });
            if (s) { sideProtein = s.proteinG || 0; sideKcal = s.kcal || 0; sideEls = s.elements || []; sideBox = ' + ' + s.box; }
          }
          const el = (r.elements || []).concat(sideEls).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
          const proteinG = (r.proteinG || 0) + sideProtein;
          const missing = [];
          if (r.main !== '-' && !fridgeHas(fridge, r.main)) missing.push('买：' + r.main);
          return Object.assign({}, d, {
            dinner: r.name,
            box: r.box + sideBox,
            method: r.method, cookTime: r.cookTime,
            proteinG: proteinG, kcal: (r.kcal || 0) + sideKcal, elements: el, missing: missing,
            purchased: true, totalG: 15 + proteinG * 2
          });
        });
        that.setData({ days: days });
        that.persistMenu();
        wx.showToast({ title: '已换成「' + r.name + '」', icon: 'none' });
      }
    });
  },
  // M1：恢复默认前确认
  resetMenu() {
    const that = this;
    wx.showModal({
      title: '恢复默认菜单',
      content: '将取消手动调整，恢复自动生成。确定？',
      confirmText: '恢复默认',
      success: function (res) {
        if (!res.confirm) return;
        wx.removeStorageSync('menuOverride');
        cloudsync.pushHome({ menuOverride: {} });
        that.refresh();
        wx.showToast({ title: '已恢复自动菜单', icon: 'success' });
      }
    });
  },
  toggleAllBuy() {
    const key = 'purchase-done';
    const saved = {};
    if (!this.data.allBought) {
      this.data.purchase.forEach(function (x, i) { saved[i] = true; });
    }
    wx.setStorageSync(key, saved);
    this.refresh();
  },
  toggleAllSteps() {
    const key = 'prep-done';
    const saved = {};
    if (!this.data.allSteps) {
      this.data.steps.forEach(function (x, i) { saved[i] = true; });
    }
    wx.setStorageSync(key, saved);
    this.refresh();
  },
  toggleBuy(e) {
    const idx = e.currentTarget.dataset.idx;
    const key = 'purchase-done';
    const saved = wx.getStorageSync(key) || {};
    saved[idx] = !this.data.purchase[idx].done;
    wx.setStorageSync(key, saved);
    buzz();
    this.refresh();
  },
  toggleStep(e) {
    const idx = e.currentTarget.dataset.idx;
    const key = 'prep-done';
    const saved = wx.getStorageSync(key) || {};
    saved[idx] = !this.data.steps[idx].done;
    wx.setStorageSync(key, saved);
    buzz();
    this.refresh();
  }
});
