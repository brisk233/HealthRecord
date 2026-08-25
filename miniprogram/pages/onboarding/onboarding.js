const app = getApp();
const cloudsync = require('../../utils/cloudsync.js');
const lifestyle = require('../../data/lifestyle.js');

Page({
  data: { MAJORS: lifestyle.MAJORS, selected: {}, subSelected: {}, subs: [], majorsCount: 0 },
  toggleMajor(e) {
    const k = e.currentTarget.dataset.k;
    const selected = Object.assign({}, this.data.selected);
    if (selected[k]) delete selected[k];
    else {
      if (Object.keys(selected).length >= 3) { wx.showToast({ title: '最多选 3 个', icon: 'none' }); return; }
      selected[k] = true;
    }
    const subs = [];
    Object.keys(selected).forEach(function (key) {
      (lifestyle.SUBTAGS[key] || []).forEach(function (s) { if (subs.indexOf(s) === -1) subs.push(s); });
    });
    this.setData({ selected: selected, subs: subs, majorsCount: Object.keys(selected).length });
  },
  toggleSub(e) {
    const v = e.currentTarget.dataset.v;
    const subSelected = Object.assign({}, this.data.subSelected);
    if (subSelected[v]) delete subSelected[v]; else subSelected[v] = true;
    this.setData({ subSelected: subSelected });
  },
  finish() {
    const majors = Object.keys(this.data.selected);
    if (!majors.length) { wx.showToast({ title: '至少选一个人格', icon: 'none' }); return; }
    const me = cloudsync.myGender();
    const profile = app.globalData.profile;
    const person = profile[me];
    person.tags = majors.map(function (k) {
      const m = lifestyle.MAJORS.find(function (x) { return x.key === k; });
      return m ? (m.icon + ' ' + m.name) : k;
    });
    person.subTags = Object.keys(this.data.subSelected);
    person.habits = person.habits || [];
    person.modules = lifestyle.defaultModulesFor(person.tags); // 未选运动型则不默认开启健身
    majors.forEach(function (k) {
      (lifestyle.HABIT_RECOMMEND[k] || []).forEach(function (h) {
        if (!person.habits.some(function (x) { return x.name === h.name; })) {
          person.habits.push({ key: 'h' + Date.now() + Math.random().toString(36).slice(2, 6), name: h.name, icon: h.icon, freq: h.freq });
        }
      });
    });
    person._t = Date.now();
    wx.setStorageSync('profile', profile);
    cloudsync.pushHome({ profile: profile });
    wx.showToast({ title: '已生成专属习惯 🎉', icon: 'success' });
    setTimeout(function () {
      wx.navigateBack({ fail: function () { wx.switchTab({ url: '/pages/today/today' }); } });
    }, 600);
  }
});
