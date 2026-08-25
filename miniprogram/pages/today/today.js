const app = getApp();
const date = require('../../utils/date.js');
const shelf = require('../../utils/shelflife.js');
const mealplan = require('../../utils/mealplan.js');
const ex = require('../../data/exercises.js');
const cloudsync = require('../../utils/cloudsync.js');
const lifestyle = require('../../data/lifestyle.js');

function buzz() { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
function greet() {
  const h = new Date().getHours();
  if (h < 6) return '凌晨好';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

Page({
  data: { dateText: '', greet: '', profile: {}, person: {}, menu: {}, expiring: [], supps: [], suppDone: 0, train: {}, familyJoined: false, fridgeEmpty: false, meals: {}, mealDone: 0, mealLabels: { menu: '按菜单吃', home: '在家做', takeout: '外卖', party: '聚餐', out: '外食', skip: '没吃' }, habits: [], habitDone: 0, modules: ['meals', 'fitness', 'supps'] },
  onShow() {
    this.refresh();
    cloudsync.hydrateTodayCheckins().then(function () { this.refresh(); }.bind(this)).catch(function () {});
    cloudsync.familyInfo().then(function (info) {
      this.setData({ familyJoined: !!info });
    }.bind(this)).catch(function () {});
    // 拉取另一半的最新冰箱数据
    const cleanAtPullStart = cloudsync.fridgeSyncClean();
    const versionAtPullStart = cloudsync.fridgeVersion();
    cloudsync.pullHome().then(function (home) {
      if (home && home.fridge) {
        // 拉取期间冰箱本地有增删：以本地为准，避免旧数据复活已吃/覆盖新入库
        if (!cleanAtPullStart || cloudsync.fridgeChangedSince(versionAtPullStart)) {
          cloudsync.pushFridge(app.globalData.fridge);
        } else {
          app.globalData.fridge = home.fridge;
          wx.setStorageSync('fridge', home.fridge);
        }
      }
      if (home && home.profile) { app.globalData.profile = cloudsync.mergeProfile(app.globalData.profile, home.profile); wx.setStorageSync('profile', app.globalData.profile); }
      this.refresh();
    }.bind(this)).catch(function () {});
  },
  goFamily() { wx.switchTab({ url: '/pages/profile/profile' }); },
  refresh() {
    const profile = app.globalData.profile;
    const me = cloudsync.myGender();
    const person = profile[me];
    const menu = mealplan.generateWeekMenu(app.globalData.fridge, { tasteLevel: person.tasteLevel || '微辣', favs: person.favs || [] })[0];
    // 自动日志：记录今日晚餐（我的页近7天日志读取）
    wx.setStorageSync('menu-' + date.todayStr(), menu.dinner + ' + ' + menu.side);
    const expiring = app.globalData.fridge
      .map(function (it) { return Object.assign({}, it, { status: shelf.statusOf(it), daysLeft: shelf.daysLeft(it) }); })
      .filter(function (it) { return it.daysLeft <= 1; });
    const idx = (new Date().getDay() + 6) % 7;
    const trainList = me === 'male' ? ex.TRAIN_MALE : ex.TRAIN_FEMALE;
    const raw = trainList[idx];
    const trainKey = 'train-' + me + '-' + date.todayStr();
    const train = Object.assign({}, raw, {
      detail: raw.exercises ? raw.exercises.join(' · ') : raw.detail,
      checked: !!wx.getStorageSync(trainKey)
    });
    const modules = Array.isArray(person.modules) ? person.modules : lifestyle.defaultModulesFor(person.tags);
    const modMeals = modules.indexOf('meals') !== -1;
    const modSupps = modules.indexOf('supps') !== -1;
    const modFitness = modules.indexOf('fitness') !== -1;
    const habits = (person.habits || []).map(function (h) {
      const recToday = wx.getStorageSync('habit-' + me + '-' + date.todayStr()) || {};
      let streak = 0;
      for (let i = 0; i < 60; i++) {
        const d = date.addDays(date.todayStr(), -i);
        const rec = wx.getStorageSync('habit-' + me + '-' + d) || {};
        if (rec[h.key]) streak++;
        else if (i === 0) continue;
        else break;
      }
      return Object.assign({}, h, { done: !!recToday[h.key], streak: streak });
    });
    const mealsKey = 'meals-' + me + '-' + date.todayStr();
    const meals = wx.getStorageSync(mealsKey) || {};
    const supKey = 'supps-' + me + '-' + date.todayStr();
    const saved = wx.getStorageSync(supKey) || {};
    const supps = person.supps.map(function (s) {
      return Object.assign({}, s, { done: !!saved[s.key] });
    });
    this.setData({
      dateText: date.todayStr() + ' ' + date.weekdayZh(date.todayStr()),
      greet: greet(),
      profile: profile, person: person, menu: menu, expiring: expiring, supps: supps,
      fridgeEmpty: app.globalData.fridge.length === 0,
      suppDone: supps.filter(function (s) { return s.done; }).length,
      meals: meals,
      mealDone: ['b', 'l', 'd'].filter(function (k) { return meals[k]; }).length,
      habits: habits,
      habitDone: habits.filter(function (h) { return h.done; }).length,
      modules: modules,
      modMeals: modMeals,
      modSupps: modSupps,
      modFitness: modFitness,
      train: train
    });
  },
  syncCheckinNow() {
    const me = cloudsync.myGender();
    const supKey = 'supps-' + me + '-' + date.todayStr();
    const trainKey = 'train-' + me + '-' + date.todayStr();
    cloudsync.pushCheckin(me, wx.getStorageSync(supKey) || {}, !!wx.getStorageSync(trainKey), wx.getStorageSync('custom-' + me + '-' + date.todayStr()) || null, wx.getStorageSync('meals-' + me + '-' + date.todayStr()) || null, wx.getStorageSync('habit-' + me + '-' + date.todayStr()) || null);
  },
  toggleHabit(e) {
    const key = e.currentTarget.dataset.key;
    const me = cloudsync.myGender();
    const k = 'habit-' + me + '-' + date.todayStr();
    const rec = wx.getStorageSync(k) || {};
    rec[key] = !rec[key];
    wx.setStorageSync(k, rec);
    buzz();
    this.syncCheckinNow();
    this.refresh();
  },
  tapMeal(e) {
    const k = e.currentTarget.dataset.k;
    const labels = ['按菜单吃', '在家做', '外卖', '聚餐', '外食', '没吃'];
    const keys = ['menu', 'home', 'takeout', 'party', 'out', 'skip'];
    wx.showActionSheet({
      itemList: labels,
      success: function (res) {
        const me = cloudsync.myGender();
        const key = 'meals-' + me + '-' + date.todayStr();
        const meals = wx.getStorageSync(key) || {};
        meals[k] = keys[res.tapIndex];
        wx.setStorageSync(key, meals);
        buzz();
        this.syncCheckinNow();
        this.refresh();
      }.bind(this)
    });
  },
  toggleSupp(e) {
    const key = e.currentTarget.dataset.key;
    const me = cloudsync.myGender();
    const supKey = 'supps-' + me + '-' + date.todayStr();
    const saved = wx.getStorageSync(supKey) || {};
    saved[key] = e.detail.value;
    wx.setStorageSync(supKey, saved);
    buzz();
    this.syncCheckinNow();
    this.refresh();
  },
  trainCheck() {
    const me = cloudsync.myGender();
    const trainKey = 'train-' + me + '-' + date.todayStr();
    wx.setStorageSync(trainKey, !this.data.train.checked);
    buzz();
    this.syncCheckinNow();
    wx.showToast({ title: this.data.train.checked ? '已取消' : '打卡成功 🎉', icon: 'success' });
    this.refresh();
  }
});
