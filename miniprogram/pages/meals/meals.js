const app = getApp();
const mealplan = require('../../utils/mealplan.js');
const nutrition = require('../../utils/nutrition.js');
const drag = require('../../utils/drag.js');
const cloudsync = require('../../utils/cloudsync.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
function tipFor(gap) {
  const n = Math.max(1, Math.ceil(gap / 7));
  return '建议加餐：鸡蛋×' + n + ' 或牛奶一杯';
}

Page({
  data: {
    seg: 'menu', days: [], targets: {}, missing: [], purchase: [], steps: [],
    buyDone: 0, stepDone: 0, buyPct: 0, stepPct: 0, fridgeEmpty: false, dragIdx: -1, allBought: false, allSteps: false
  },
  onShow() {
    this.refresh();
    cloudsync.pullHome().then(function (home) {
      if (home) {
        if (home.profile) { app.globalData.profile = cloudsync.mergeProfile(app.globalData.profile, home.profile); wx.setStorageSync('profile', app.globalData.profile); }
        if (home.fridge) { app.globalData.fridge = home.fridge; wx.setStorageSync('fridge', home.fridge); }
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
    const prefs = { tasteLevel: person.tasteLevel || '微辣', favs: person.favs || [] };
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
      days: days, targets: targets, missing: Object.keys(missMap),
      fridgeEmpty: app.globalData.fridge.length === 0,
      purchase: purchase, steps: steps,
      buyDone: buyDone, stepDone: stepDone, allBought: purchase.length > 0 && buyDone === purchase.length, allSteps: steps.length > 0 && stepDone === steps.length,
      buyPct: Math.round(buyDone / purchase.length * 100),
      stepPct: Math.round(stepDone / steps.length * 100)
    });
  },
  regen() {
    wx.removeStorageSync('menuOverride');
    cloudsync.pushHome({ menuOverride: {} });
    this.refresh();
    wx.showToast({ title: '已按冰箱库存重新生成', icon: 'none' });
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
  resetMenu() {
    wx.removeStorageSync('menuOverride');
    cloudsync.pushHome({ menuOverride: {} });
    this.refresh();
    wx.showToast({ title: '已恢复自动菜单', icon: 'success' });
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
