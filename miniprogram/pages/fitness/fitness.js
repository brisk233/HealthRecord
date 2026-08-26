const app = getApp();
const date = require('../../utils/date.js');
const ex = require('../../data/exercises.js');
const cloudsync = require('../../utils/cloudsync.js');
const drag = require('../../utils/drag.js');
const lifestyle = require('../../data/lifestyle.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
function customKey(person, d) { return 'custom-' + person + '-' + d; }
function trainKey(person, d) { return 'train-' + person + '-' + d; }

Page({
  data: {
    profile: {}, person: {}, week: [], today: {}, streak: 0, records: [], lib: ex.EXERCISE_LIB,
    customType: '篮球', customName: '', customMinutes: 60, todayCustom: null,
    dragIdx: -1, order: [0, 1, 2, 3, 4, 5, 6], moduleOff: false, libOpen: {}
  },
  onShow() {
    this.refresh();
    cloudsync.hydrateTodayCheckins().then(function () { this.refresh(); }.bind(this)).catch(function () {});
  },
  refresh() {
    const profile = app.globalData.profile;
    const me = cloudsync.myGender();
    const person = profile[me];
    const list = me === 'male' ? ex.TRAIN_MALE : ex.TRAIN_FEMALE;
    const modules = Array.isArray(person.modules) ? person.modules : lifestyle.defaultModulesFor(person.tags);
    this._schedule = list;
    const order = this.orderOf(profile, me);
    const today = date.todayStr();
    const todayIdx = (new Date(today).getDay() + 6) % 7;
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = date.addDays(today, i - todayIdx);
      const item = list[order[i]];
      const c = wx.getStorageSync(customKey(me, d));
      const tOk = !!wx.getStorageSync(trainKey(me, d));
      week.push({
        weekday: date.weekdayZh(d), date: d, isFuture: d > today, isPast: d < today,
        title: c ? (c.type + ' · ' + c.minutes + '分钟') : item.title,
        time: c ? '自定义' : item.time,
        checked: !!(tOk || c),
        isToday: i === todayIdx
      });
    }
    const raw = list[order[todayIdx]];
    const tChecked = !!wx.getStorageSync(trainKey(me, today));
    const todayCustom = wx.getStorageSync(customKey(me, today)) || null;
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = date.addDays(today, -i);
      const ok = !!(wx.getStorageSync(trainKey(me, d)) || wx.getStorageSync(customKey(me, d)));
      if (ok) streak++;
      else if (i === 0) continue;
      else break;
    }
    const records = [];
    for (let i = 0; i < 7; i++) {
      const d = date.addDays(today, -i);
      const c = wx.getStorageSync(customKey(me, d));
      const tOk = wx.getStorageSync(trainKey(me, d));
      if (c) records.push({ date: d, weekday: date.weekdayZh(d), title: '🎾 ' + c.type + ' · ' + c.minutes + '分钟' });
      else if (tOk) records.push({ date: d, weekday: date.weekdayZh(d), title: list[order[(new Date(d).getDay() + 6) % 7]].title });
    }
    this.setData({
      profile: profile, person: person, week: week,
      today: { title: raw.title, time: raw.time, detail: raw.exercises ? raw.exercises.join(' · ') : raw.detail, checked: tChecked },
      streak: streak, records: records, todayCustom: todayCustom, order: order, moduleOff: modules.indexOf('fitness') === -1
    });
  },
  orderOf(profile, me) {
    const saved = profile.trainOrder && profile.trainOrder[me];
    if (saved && saved.length === 7 && new Set(saved).size === 7) return saved;
    return [0, 1, 2, 3, 4, 5, 6];
  },
  // F1：整行点击补卡/打卡（过去/今天可点，未来不可）
  onWeekTap(e) {
    const d = e.currentTarget.dataset.date;
    const me = cloudsync.myGender();
    const today = date.todayStr();
    if (d > today) { wx.showToast({ title: '还没到这一天哦', icon: 'none' }); return; }
    const key = trainKey(me, d);
    const cur = !!wx.getStorageSync(key);
    wx.setStorageSync(key, !cur);
    this.syncNow();
    buzz();
    wx.showToast({ title: !cur ? (d === today ? '打卡成功 🎉' : '已补卡 ✅') : '已取消', icon: 'none' });
    this.refresh();
  },
  onDragStart(e) { drag.startDrag(this, e, 'week'); },
  onDragMove(e) {
    drag.moveDrag(this, e, 'week', function (list) {
      const that = this;
      this.setData({
        order: list.map(function (w) {
          return that._schedule.findIndex(function (t) { return t.title === w.title; });
        })
      });
    }.bind(this));
  },
  onDragEnd() { drag.endDrag(this, this.persistOrder.bind(this)); },
  persistOrder() {
    const profile = app.globalData.profile;
    const me = cloudsync.myGender();
    profile.trainOrder = profile.trainOrder || {};
    profile.trainOrder[me] = this.data.order;
    wx.setStorageSync('profile', profile);
    cloudsync.pushHome({ profile: profile });
    this.refresh();
  },
  // F5：恢复默认前确认
  resetOrder() {
    const that = this;
    wx.showModal({
      title: '恢复默认课表',
      content: '将取消你调整过的训练顺序。确定？',
      confirmText: '恢复默认',
      success: function (res) {
        if (!res.confirm) return;
        const profile = app.globalData.profile;
        const me = cloudsync.myGender();
        profile.trainOrder = profile.trainOrder || {};
        profile.trainOrder[me] = [0, 1, 2, 3, 4, 5, 6];
        wx.setStorageSync('profile', profile);
        cloudsync.pushHome({ profile: profile });
        that.refresh();
        wx.showToast({ title: '已恢复默认课表', icon: 'success' });
      }
    });
  },
  pickType(e) {
    const t = e.currentTarget.dataset.t;
    const patch = { customType: t };
    if (t === '其他') patch.customFocus = true; // F2：自动聚焦输入框
    this.setData(patch);
  },
  pickMin(e) { this.setData({ customMinutes: Number(e.currentTarget.dataset.m) }); },
  onCustomName(e) { this.setData({ customName: e.detail.value }); },
  syncNow() {
    const me = cloudsync.myGender();
    const today = date.todayStr();
    cloudsync.pushCheckin(
      me,
      wx.getStorageSync('supps-' + me + '-' + today) || {},
      !!wx.getStorageSync(trainKey(me, today)),
      wx.getStorageSync(customKey(me, today)) || null,
      wx.getStorageSync('meals-' + me + '-' + today) || null,
      wx.getStorageSync('habit-' + me + '-' + today) || null
    );
  },
  checkinCustom() {
    const me = cloudsync.myGender();
    const today = date.todayStr();
    if (this.data.customType === '其他' && !String(this.data.customName || '').trim()) {
      wx.showToast({ title: '先填运动名称，如骑行', icon: 'none' }); return;
    }
    const type = this.data.customType === '其他' ? (this.data.customName || '其他运动') : this.data.customType;
    const rec = { type: type, minutes: this.data.customMinutes, date: today };
    wx.setStorageSync(customKey(me, today), rec);
    this.syncNow();
    buzz();
    wx.showToast({ title: '已记录 ' + type + ' 🎉', icon: 'success' });
    this.refresh();
  },
  cancelCustom() {
    const me = cloudsync.myGender();
    wx.removeStorageSync(customKey(me, date.todayStr()));
    this.syncNow();
    buzz();
    this.refresh();
  },
  checkin() {
    const me = cloudsync.myGender();
    wx.setStorageSync(trainKey(me, date.todayStr()), !this.data.today.checked);
    this.syncNow();
    buzz();
    wx.showToast({ title: this.data.today.checked ? '已取消' : '打卡成功 🎉', icon: 'success' });
    this.refresh();
  },
  // F4：训练库分组折叠
  toggleLib(e) {
    const g = e.currentTarget.dataset.group;
    const libOpen = Object.assign({}, this.data.libOpen);
    libOpen[g] = !libOpen[g];
    this.setData({ libOpen: libOpen });
  }
});
