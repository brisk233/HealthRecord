const app = getApp();
const date = require('../../utils/date.js');
const shelf = require('../../utils/shelflife.js');
const cloudsync = require('../../utils/cloudsync.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }

Page({
  data: { items: [], expCount: 0, badCount: 0, cats: [], catsDays: [], form: { name: '', catIdx: 0, box: '' } },
  onShow() { this.refresh(); this.pullCloud(); },
  onLoad() {
    this.setData({
      cats: shelf.RULES.map(function (r) { return r.label; }),
      catsDays: shelf.RULES.map(function (r) { return r.days; })
    });
  },
  onPullDownRefresh() { this.refresh(); this.pullCloud(function () { wx.stopPullDownRefresh(); }); },
  pullCloud(done) {
    cloudsync.pullHome().then(function (home) {
      if (home && home.fridge) {
        app.globalData.fridge = home.fridge;
        wx.setStorageSync('fridge', home.fridge);
        this.refresh();
      }
      if (done) done();
    }.bind(this)).catch(function () { if (done) done(); });
  },
  refresh() {
    const items = app.globalData.fridge.map(function (it) {
      return Object.assign({}, it, {
        catLabel: shelf.ruleOf(it.cat).label,
        suggested: shelf.suggestedFor(it),
        daysLeft: shelf.daysLeft(it),
        status: shelf.statusOf(it)
      });
    }).sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    this.setData({
      items: items,
      expCount: items.filter(function (x) { return x.daysLeft >= 0 && x.daysLeft <= 1; }).length,
      badCount: items.filter(function (x) { return x.daysLeft < 0; }).length
    });
  },
  onName(e) { this.setData({ 'form.name': e.detail.value }); },
  onBox(e) { this.setData({ 'form.box': e.detail.value }); },
  onCat(e) { this.setData({ 'form.catIdx': Number(e.detail.value) }); },
  addItem() {
    const f = this.data.form;
    if (!f.name) { wx.showToast({ title: '先填食材名称', icon: 'none' }); return; }
    const item = {
      id: 'f' + Date.now(),
      name: f.name, cat: shelf.RULES[f.catIdx].key, box: f.box || '未标注',
      purchased: date.todayStr(), note: ''
    };
    app.globalData.fridge.unshift(item);
    wx.setStorageSync('fridge', app.globalData.fridge);
    cloudsync.pushHome({ fridge: app.globalData.fridge });
    this.setData({ form: { name: '', catIdx: 0, box: '' } });
    buzz();
    wx.showToast({ title: '已入库 ✅', icon: 'success' });
    this.refresh();
  },
  eatItem(e) {
    const id = e.currentTarget.dataset.id;
    app.globalData.fridge = app.globalData.fridge.filter(function (it) { return it.id !== id; });
    wx.setStorageSync('fridge', app.globalData.fridge);
    cloudsync.pushHome({ fridge: app.globalData.fridge });
    buzz();
    this.refresh();
  }
});
