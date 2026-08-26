const app = getApp();
const date = require('../../utils/date.js');
const shelf = require('../../utils/shelflife.js');
const cloudsync = require('../../utils/cloudsync.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
function normName(name) { return String(name || '').replace(/[（(][^）)]*[）)]/g, '').trim(); }

Page({
  data: { items: [], expCount: 0, badCount: 0, cats: [], catsDays: [], form: { name: '', catIdx: 0, box: '' }, editingId: '', autoHint: '' },
  _updateAutoHint() {
    const f = this.data.form;
    if (!f.name) { this.setData({ autoHint: '' }); return; }
    const days = this.data.catsDays[f.catIdx] || 0;
    const box = f.box || '待指定';
    this.setData({ autoHint: '「' + f.name + '」→ ' + this.data.cats[f.catIdx] + ' · 约 ' + days + ' 天保质 · 建议放 ' + box });
  },
  onShow() { this.refresh(); this.pullCloud(); },
  onLoad() {
    this.setData({
      cats: shelf.RULES.map(function (r) { return r.label; }),
      catsDays: shelf.RULES.map(function (r) { return r.days; })
    });
  },
  onPullDownRefresh() { this.refresh(); this.pullCloud(function () { wx.stopPullDownRefresh(); }); },
  pullCloud(done) {
    const cleanAtPullStart = cloudsync.fridgeSyncClean();
    const versionAtPullStart = cloudsync.fridgeVersion();
    cloudsync.pullHome().then(function (home) {
      // 拉取期间本地已有增删：以本地为准并重新推送，避免云端旧数据把刚吃的食材“复活”
      if (!cleanAtPullStart || cloudsync.fridgeChangedSince(versionAtPullStart)) {
        cloudsync.pushFridge(app.globalData.fridge);
        if (done) done();
        return;
      }
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
  onBox(e) { this.setData({ 'form.box': e.detail.value }); this._updateAutoHint(); },
  onCat(e) { this.setData({ 'form.catIdx': Number(e.detail.value) }); this._updateAutoHint(); },
  // 树选择：点「点击选择食材」打开；选中自动填名称 + 默认保质期分类
  openTree() {
    const tp = this.selectComponent('#tp');
    if (tp) tp.open({ title: '选择食材入库', mode: 'single' });
  },
  // 树选：自动带出 分类(保质期) + 默认储存位置
  onTreeSelect(e) {
    const it = e.detail.item || {};
    if (!it.name) return;
    let catIdx = 0;
    for (let i = 0; i < shelf.RULES.length; i++) {
      if (shelf.RULES[i].key === it.cat) { catIdx = i; break; }
    }
    this.setData({
      'form.name': it.name, 'form.catIdx': catIdx,
      'form.box': it.box || this.data.form.box, editingId: ''
    });
    this._updateAutoHint();
    buzz();
  },
  // 手输：按名称关键词自动推断分类 + 位置（树里能匹配上的）
  onName(e) {
    const name = e.detail.value;
    const patch = { 'form.name': name };
    const inferred = this.inferByKeyword(name);
    if (inferred) { patch['form.catIdx'] = inferred.catIdx; patch['form.box'] = inferred.box; }
    this.setData(patch);
    this._updateAutoHint();
  },
  inferByKeyword(name) {
    if (!String(name || '').trim()) return null;
    const tree = require('../../data/foodtree.js');
    let hit = null;
    tree.forEach(function (l1) {
      (l1.children || []).forEach(function (l2) {
        (l2.items || []).forEach(function (it) {
          if (!hit && String(name).indexOf(it.name) !== -1) hit = it;
        });
      });
    });
    if (!hit) return null;
    let catIdx = 0;
    for (let i = 0; i < shelf.RULES.length; i++) {
      if (shelf.RULES[i].key === hit.cat) { catIdx = i; break; }
    }
    return { catIdx: catIdx, box: hit.box || '' };
  },
  // C2：点击入库行开始编辑（复用表单）
  startEdit(e) {
    const id = e.currentTarget.dataset.id;
    const it = app.globalData.fridge.find(function (x) { return x.id === id; });
    if (!it) return;
    const catIdx = Math.max(0, shelf.RULES.findIndex(function (r) { return r.key === it.cat; }));
    this.setData({ editingId: id, form: { name: it.name, catIdx: catIdx, box: it.box === '未标注' ? '' : it.box } });
    this._updateAutoHint();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  cancelEdit() { this.setData({ editingId: '', form: { name: '', catIdx: 0, box: '' }, autoHint: '' }); },
  addItem() {
    const f = this.data.form;
    if (!f.name) { wx.showToast({ title: '先填食材名称', icon: 'none' }); return; }
    // C3：同名食材合并提示
    const dup = app.globalData.fridge.find(function (it) { return normName(it.name) === normName(f.name); });
    if (dup && !this.data.editingId) {
      const that = this;
      wx.showModal({
        title: '已有同名食材',
        content: '冰箱里已有「' + dup.name + '」，要再存一份吗？',
        confirmText: '再存一份',
        success: function (res) { if (res.confirm) that._doAdd(); }
      });
      return;
    }
    if (this.data.editingId) { this._saveEdit(); return; }
    this._doAdd();
  },
  _doAdd() {
    const f = this.data.form;
    const item = {
      id: 'f' + Date.now(),
      name: f.name, cat: shelf.RULES[f.catIdx].key, box: f.box || '未标注',
      purchased: date.todayStr(), note: ''
    };
    app.globalData.fridge.unshift(item);
    cloudsync.markFridgeLocalChange();
    wx.setStorageSync('fridge', app.globalData.fridge);
    cloudsync.pushFridge(app.globalData.fridge);
    this.setData({ form: { name: '', catIdx: 0, box: '' }, autoHint: '' });
    buzz();
    wx.showToast({ title: '已入库 ✅', icon: 'success' });
    this.refresh();
  },
  _saveEdit() {
    const f = this.data.form;
    const id = this.data.editingId;
    app.globalData.fridge = app.globalData.fridge.map(function (it) {
      if (it.id !== id) return it;
      return Object.assign({}, it, { name: f.name, cat: shelf.RULES[f.catIdx].key, box: f.box || '未标注' });
    });
    cloudsync.markFridgeLocalChange();
    wx.setStorageSync('fridge', app.globalData.fridge);
    cloudsync.pushFridge(app.globalData.fridge);
    this.setData({ editingId: '', form: { name: '', catIdx: 0, box: '' } });
    buzz();
    wx.showToast({ title: '已保存修改 ✏️', icon: 'success' });
    this.refresh();
  },
  // C1：吃掉前确认（防误触）
  eatItem(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    const it = app.globalData.fridge.find(function (x) { return x.id === id; });
    if (!it) return;
    wx.showModal({
      title: '吃掉「' + it.name + '」？',
      content: '吃完后将从冰箱移除，并同步到另一半的手机。',
      confirmText: '吃掉了',
      confirmColor: '#C23B3B',
      success: function (res) {
        if (!res.confirm) return;
        app.globalData.fridge = app.globalData.fridge.filter(function (x) { return x.id !== id; });
        cloudsync.markFridgeLocalChange();
        wx.setStorageSync('fridge', app.globalData.fridge);
        cloudsync.pushFridge(app.globalData.fridge);
        buzz();
        that.refresh();
        wx.showToast({ title: '已吃掉 🍽️', icon: 'success' });
      }
    });
  }
});
