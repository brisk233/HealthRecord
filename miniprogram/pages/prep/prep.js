const app = getApp();
const mealplan = require('../../utils/mealplan.js');
const cloudsync = require('../../utils/cloudsync.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }

Page({
  data: { missing: [], purchase: [], steps: [], buyDone: 0, stepDone: 0, buyPct: 0, stepPct: 0 },
  onShow() { this.refresh(); },
  refresh() {
    const person = app.globalData.profile[cloudsync.myGender()];
    const days = mealplan.generateWeekMenu(app.globalData.fridge, { tasteLevel: person.tasteLevel || '微辣', favs: person.favs || [] });
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
      missing: Object.keys(missMap),
      purchase: purchase, steps: steps,
      buyDone: buyDone, stepDone: stepDone,
      buyPct: Math.round(buyDone / purchase.length * 100),
      stepPct: Math.round(stepDone / steps.length * 100)
    });
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
