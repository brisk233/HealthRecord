const app = getApp();
const date = require('../../utils/date.js');
const nutrition = require('../../utils/nutrition.js');
const cloudsync = require('../../utils/cloudsync.js');
const lifestyle = require('../../data/lifestyle.js');
const MEAL_LABELS = { menu: '按菜单', home: '在家做', takeout: '外卖', party: '聚餐', out: '外食', skip: '没吃' };

Page({
  data: {
    genders: ['男生', '女生'], genderIdx: 0,
    goals: ['增肌', '减脂', '塑形'], goalIdx: 0, form: {}, profile: {}, person: {},
    protein: 0, calorie: 0, bmi: '', supps: [],
    family: null, myRelation: '', myRelationIdx: 0, relations: ['情侣', '夫妻', '搭子'],
    joinCode: '', joinRelationIdx: 0, nickname: '', myAvatar: '', myAvatarUrl: '',
    newSupp: { name: '', dose: '', time: '' }, remindEnabled: false, logs: [], logOpen: false, sportDays: 0,
    familyName: '', editingName: false, loggedIn: false, suppOpen: false, baseOpen: false, familyOpen: false, myRole: '', favNew: '',
    tasteLevels: ['清淡', '微辣', '偏辣'], tasteIdx: 0,
    favOptions: ['牛腩', '吊龙', '猪肉', '鲈鱼', '基围虾', '鸡蛋', '西兰花', '辣椒', '胡萝卜', '叶子菜'], favs: [], favAll: [],
    prefOpen: false, habitOpen: false, modOpen: false,
    freqs: ['每天', '每周3次', '每周1次'], freqIdx: 0, newHabit: { name: '', icon: '' },
    modules: ['meals', 'fitness', 'supps'], habits: [], habitsCount: 0, showGuide: false, habitTemplates: [], version: '0.0.0', favLast: ''
  },
  onLoad(options) { if (options && options.code) this.setData({ joinCode: options.code }); },
  onShow() {
    this.setData({ familyOpen: false, baseOpen: false, suppOpen: false, prefOpen: false, logOpen: false });
    this.refresh();
    this.loadFamily();
  },
  refresh() {
    const profile = app.globalData.profile;
    const me = cloudsync.myGender();
    const person = profile[me];
    if (!person.habits) person.habits = [];
    if (!person.favs) person.favs = [];
    if (!Array.isArray(person.favHidden)) person.favHidden = [];
    if (!Array.isArray(person.modules)) person.modules = lifestyle.defaultModulesFor(person.tags);
    const goalIdx = this.data.goals.indexOf(person.goal);
    const bmi = (person.weight / Math.pow(person.height / 100, 2)).toFixed(1);
    const logs = [];
    for (let i = 0; i < 7; i++) {
      const d = date.addDays(date.todayStr(), -i);
      const saved = wx.getStorageSync('supps-' + me + '-' + d) || {};
      const suppDone = person.supps.filter(function (s) { return saved[s.key]; }).length;
      const trainOk = !!wx.getStorageSync('train-' + me + '-' + d);
      const custom = wx.getStorageSync('custom-' + me + '-' + d);
      const mealsRec = wx.getStorageSync('meals-' + me + '-' + d) || {};
      const habitRec = wx.getStorageSync('habit-' + me + '-' + d) || {};
      const hasHabit = Object.keys(habitRec).some(function (k) { return habitRec[k]; });
      // 空记录不显示：仅当有真实打卡（三餐/补剂/运动/习惯）才生成日志行
      if (!(mealsRec.d || suppDone > 0 || trainOk || custom || hasHabit)) continue;
      logs.push({
        date: d, weekday: date.weekdayZh(d),
        dinner: mealsRec.d ? ('🍽️ ' + (MEAL_LABELS[mealsRec.d] || '已打卡')) : (wx.getStorageSync('menu-' + d) || ''),
        supps: suppDone + '/' + person.supps.length,
        sport: custom ? ('🎾' + custom.type + ' ' + custom.minutes + '分') : (trainOk ? '💪 训练' : '—')
      });
    }
    const habits = person.habits;
    const habitTemplates = lifestyle.TEMPLATE_HABITS.filter(function (t) {
      return !habits.some(function (h) { return h.name === t.name; });
    });
    const modRows = ['meals', 'fitness', 'supps'].map(function (m) {
      return {
        key: m,
        name: m === 'meals' ? '🍚 三餐计划（菜单）' : m === 'fitness' ? '🏃 运动计划' : '💊 补剂打卡',
        on: person.modules.indexOf(m) !== -1
      };
    });
    const favChips = this.buildFavAll(person.favs, person.favHidden).map(function (n) {
      return { name: n, on: person.favs.indexOf(n) !== -1 };
    });
    try {
    this.setData({
      profile: profile, person: person,
      genderIdx: me === 'female' ? 1 : 0,
      goalIdx: Math.max(0, this.data.goals.indexOf(person.goal)),
      goals: this.goalOptions(person.tags),
      form: { height: person.height, weight: person.weight },
      protein: nutrition.proteinTarget(person),
      calorie: nutrition.calorieTarget(person),
      bmi: bmi, supps: person.supps,
      nickname: wx.getStorageSync('nickname') || '',
      myAvatarUrl: wx.getStorageSync('myAvatarUrl') || '',
      remindEnabled: !!wx.getStorageSync('remindEnabled'),
      loggedIn: !!wx.getStorageSync('myOpenid'),
      version: app.globalData.version,
      tasteIdx: Math.max(0, this.data.tasteLevels.indexOf(person.tasteLevel)),
      favs: person.favs, favAll: this.buildFavAll(person.favs, person.favHidden),
      modules: person.modules,
      modOnCount: person.modules.filter(function (x) { return ['meals', 'fitness', 'supps'].indexOf(x) !== -1; }).length,
      modRows: modRows,
      favChips: favChips,
      habits: habits, habitsCount: habits.length,
      showGuide: !person.tags || person.tags.length === 0,
      habitTemplates: habitTemplates,
      logs: logs, sportDays: logs.filter(function (l) { return l.sport !== '—'; }).length
    });
    } catch (err) {
      console.error('refresh 异常', err);
      this.setData({ profile: profile, person: person, favs: person.favs || [], modules: person.modules || [] });
    }
  },
  goalOptions(tags) {
    const isSport = (tags || []).some(function (t) { return t.indexOf('运动型') !== -1; });
    return isSport ? ['增肌', '减脂', '塑形'] : ['保持健康', '改善作息', '健康饮食', '运动塑形'];
  },
  buildFavAll(favs, hidden) {
    const hide = hidden || [];
    const list = favs.filter(function (f) { return hide.indexOf(f) === -1; });
    this.data.favOptions.forEach(function (f) { if (list.indexOf(f) === -1 && hide.indexOf(f) === -1) list.push(f); });
    return list;
  },
  loadFamily() {
    cloudsync.familyInfo().then(function (info) {
      if (info) {
        if (info.myNickname && !wx.getStorageSync('nickname')) wx.setStorageSync('nickname', info.myNickname);
        if (info.myAvatarUrl && !wx.getStorageSync('myAvatarUrl')) wx.setStorageSync('myAvatarUrl', info.myAvatarUrl);
        const idx = this.data.relations.indexOf(info.myRelation);
        const members = (info.members || []).map(function (m) { return Object.assign({}, m, { avatarErr: false }); });
        this.setData({ family: Object.assign({}, info, { members: members }), myRelation: info.myRelation, myRole: info.myRole || '', myRelationIdx: idx >= 0 ? idx : 2, familyName: info.name || '我们的家' });
      } else { this.setData({ family: null }); }
      this.refresh();
    }.bind(this)).catch(function () {});
  },
  saveProfile() {
    const p = app.globalData.profile;
    p[cloudsync.myGender()]._t = Date.now(); // 时间戳：同步时以最新修改方为准
    wx.setStorageSync('profile', p);
    cloudsync.pushHome({ profile: p });
    this.refresh();
  },
  // ===== 登录/头像/昵称 ======
  onChooseAvatar(e) {
    const proceed = () => {
      this.setData({ myAvatar: e.detail.avatarUrl });
      cloudsync.login().then(function (res) {
        const openid = res && res.openid;
        if (!openid) { wx.showToast({ title: '上传失败，请重试', icon: 'none' }); return; }
        wx.setStorageSync('myOpenid', openid);
        wx.cloud.uploadFile({
          // 加时间戳：每次上传都是新 fileID，避免覆盖同路径导致缓存不刷新（头像更新不生效）
          cloudPath: 'avatars/' + openid + '-' + Date.now() + '.png', filePath: e.detail.avatarUrl,
          success: function (up) {
            wx.setStorageSync('myAvatarUrl', up.fileID);
            this.setData({ myAvatarUrl: up.fileID });
            cloudsync.setAvatar(up.fileID);
            this.loadFamily();
            this.refresh();
            wx.showToast({ title: '头像已更新', icon: 'success' });
          }.bind(this),
          fail: function () { wx.showToast({ title: '上传失败，请重试', icon: 'none' }); }
        });
      }.bind(this)).catch(function () { wx.showToast({ title: '上传失败，请重试', icon: 'none' }); });
    };
    const pp = this.selectComponent('#pp');
    if (pp) pp.ensure(proceed); else proceed();
  },
  onNickname(e) { this.setData({ nickname: e.detail.value }); wx.setStorageSync('nickname', e.detail.value); },
  onNicknameBlur(e) {
    wx.setStorageSync('nickname', e.detail.value);
    cloudsync.setNickname(e.detail.value); // 同步到家庭成员，退出重登可恢复
  },
  doLogin() {
    const run = () => {
      cloudsync.login().then(function (res) {
        if (res && res.openid) {
          wx.setStorageSync('myOpenid', res.openid);
          cloudsync.familyInfo().then(function () { return cloudsync.pullHome(); }).then(function (home) {
            if (home) {
              if (home.profile) { app.globalData.profile = cloudsync.mergeProfile(app.globalData.profile, home.profile); wx.setStorageSync('profile', app.globalData.profile); }
              if (home.fridge) { app.globalData.fridge = home.fridge; wx.setStorageSync('fridge', home.fridge); }
              if (home.menuOverride !== undefined) wx.setStorageSync('menuOverride', home.menuOverride || {});
            }
            this.refresh(); this.loadFamily();
          }.bind(this)).catch(function () { this.refresh(); this.loadFamily(); }.bind(this));
          wx.showToast({ title: '登录成功', icon: 'success' });
        } else { wx.showToast({ title: '登录失败：请确认 login 云函数已部署', icon: 'none' }); }
      }.bind(this)).catch(function () { wx.showToast({ title: '登录失败：请确认 login 云函数已部署', icon: 'none' }); });
    };
    const pp = this.selectComponent('#pp');
    if (pp) pp.ensure(run); else run();
  },
  logout() {
    const that = this;
    wx.showModal({
      title: '退出登录',
      content: '退出将清空本机全部数据（云端保留，重新登录自动恢复）。确定退出？',
      success: function (res) {
        if (res.confirm) {
          getApp().resetLocal();
          that.setData({ family: null, loggedIn: false, myAvatarUrl: '', nickname: '' });
          that.refresh();
          wx.showToast({ title: '已退出并清空本机数据', icon: 'none' });
        }
      }
    });
  },
  // ===== 基础数据 ======
  onGender(e) { cloudsync.setGender(Number(e.detail.value) === 1 ? 'female' : 'male'); this.refresh(); },
  onGoal(e) { app.globalData.profile[cloudsync.myGender()].goal = this.data.goals[Number(e.detail.value)]; this.saveProfile(); },
  onHeight(e) { this.setData({ 'form.height': e.detail.value }); },
  onWeight(e) { this.setData({ 'form.weight': e.detail.value }); },
  save() {
    const person = app.globalData.profile[cloudsync.myGender()];
    person.height = Number(this.data.form.height) || person.height;
    person.weight = Number(this.data.form.weight) || person.weight;
    this.setData({ baseOpen: false });
    this.saveProfile();
    wx.showToast({ title: '已保存', icon: 'success' });
  },
  // ===== 补剂 ======
  onSuppEnabled(e) { app.globalData.profile[cloudsync.myGender()].suppEnabled = e.detail.value; this.saveProfile(); },
  onNewSuppName(e) { this.setData({ 'newSupp.name': e.detail.value }); },
  onNewSuppDose(e) { this.setData({ 'newSupp.dose': e.detail.value }); },
  onNewSuppTime(e) { this.setData({ 'newSupp.time': e.detail.value }); },
  addSupp() {
    const person = app.globalData.profile[cloudsync.myGender()];
    const n = this.data.newSupp;
    if (!n.name) { wx.showToast({ title: '先填补剂名称', icon: 'none' }); return; }
    person.supps.push({ key: 'c' + Date.now(), name: n.name, dose: n.dose || '1次', time: n.time || '随餐' });
    this.setData({ newSupp: { name: '', dose: '', time: '' } });
    this.saveProfile();
  },
  delSupp(e) {
    const key = e.currentTarget.dataset.key;
    const person = app.globalData.profile[cloudsync.myGender()];
    person.supps = person.supps.filter(function (s) { return s.key !== key; });
    this.saveProfile();
  },
  // ===== 习惯 ======
  goOnboarding() { wx.navigateTo({ url: '/pages/onboarding/onboarding' }); },
  delHabit(e) {
    const key = e.currentTarget.dataset.key;
    const person = app.globalData.profile[cloudsync.myGender()];
    person.habits = person.habits.filter(function (h) { return h.key !== key; });
    this.saveProfile();
  },
  addHabitFromTemplate(e) {
    const person = app.globalData.profile[cloudsync.myGender()];
    person.habits.push({ key: 'h' + Date.now(), name: e.currentTarget.dataset.name, icon: e.currentTarget.dataset.icon || '⭐', freq: e.currentTarget.dataset.freq || '每天' });
    this.saveProfile();
    wx.showToast({ title: '已添加', icon: 'success' });
  },
  onNewHabitName(e) { this.setData({ 'newHabit.name': e.detail.value }); },
  onFreq(e) { this.setData({ freqIdx: Number(e.detail.value) }); },
  autoHabitIcon(name) {
    const rules = [
      ['喝水', '💧'], ['水杯', '💧'], ['早睡', '😴'], ['睡觉', '😴'], ['睡前', '🌙'],
      ['跑', '🏃'], ['运动', '🏃'], ['健身', '🏋️'], ['拉伸', '🤸'], ['瑜伽', '🧘'], ['冥想', '🧘'],
      ['读书', '📖'], ['书', '📖'], ['单词', '🔤'], ['学习', '📚'], ['写作', '✍️'], ['练字', '✍️'],
      ['日记', '📝'], ['记账', '🧾'], ['攒钱', '💰'], ['理财', '💰'],
      ['泡脚', '🦶'], ['做饭', '🍳'], ['吃饭', '🍽️'], ['三餐', '🍽️'],
      ['手机', '📵'], ['刷', '📵'], ['整理', '🧹'], ['家务', '🧹'], ['出门', '🚶']
    ];
    const n = String(name || '');
    for (let i = 0; i < rules.length; i++) {
      if (n.indexOf(rules[i][0]) !== -1) return rules[i][1];
    }
    return '⭐';
  },
  addHabit() {
    const n = this.data.newHabit;
    if (!n.name) { wx.showToast({ title: '先填习惯名称', icon: 'none' }); return; }
    const person = app.globalData.profile[cloudsync.myGender()];
    person.habits.push({ key: 'h' + Date.now(), name: n.name, icon: this.autoHabitIcon(n.name), freq: this.data.freqs[this.data.freqIdx] });
    this.setData({ newHabit: { name: '' } });
    this.saveProfile();
  },
  reGenHabits() {
    const person = app.globalData.profile[cloudsync.myGender()];
    const keyMap = {};
    lifestyle.MAJORS.forEach(function (m) { keyMap[m.name] = m.key; });
    const keys = (person.tags || []).map(function (t) { return keyMap[t.split(' ')[1] || t]; }).filter(Boolean);
    const recNames = {};
    lifestyle.MAJORS.forEach(function (m) {
      (lifestyle.HABIT_RECOMMEND[m.key] || []).forEach(function (h) { recNames[h.name] = true; });
    });
    lifestyle.TEMPLATE_HABITS.forEach(function (h) { recNames[h.name] = true; });
    person.habits = person.habits.filter(function (h) { return !recNames[h.name]; });
    keys.forEach(function (k) {
      (lifestyle.HABIT_RECOMMEND[k] || []).forEach(function (h) {
        person.habits.push({ key: 'h' + Date.now() + Math.random().toString(36).slice(2, 6), name: h.name, icon: h.icon, freq: h.freq });
      });
    });
    this.saveProfile();
    wx.showToast({ title: '已按标签更新', icon: 'success' });
  },
  // ===== 模块 ======
  onModuleToggle(e) {
    const m = e.currentTarget.dataset.m;
    const on = e.detail.value;
    const person = app.globalData.profile[cloudsync.myGender()];
    if (!Array.isArray(person.modules)) person.modules = lifestyle.defaultModulesFor(person.tags);
    let modules = person.modules.slice();
    const i = modules.indexOf(m);
    if (on && i === -1) modules.push(m);
    if (!on && i !== -1) modules.splice(i, 1);
    person.modules = modules;
    person._t = Date.now();
    this.saveProfile();
    wx.showToast({ title: on ? '已开启「' + this.moduleName(m) + '」' : '已关闭「' + this.moduleName(m) + '」', icon: 'none' });
  },
  moduleName(m) {
    if (m === 'meals') return '三餐计划';
    if (m === 'fitness') return '运动计划';
    if (m === 'supps') return '补剂打卡';
    return m;
  },
  // ===== 作息与喜好 ======
  onWorkBlur(e) { app.globalData.profile[cloudsync.myGender()].work = e.detail.value; this.saveProfile(); },
  onSleepBlur(e) { app.globalData.profile[cloudsync.myGender()].sleep = e.detail.value; this.saveProfile(); },
  onTasteLevel(e) { app.globalData.profile[cloudsync.myGender()].tasteLevel = this.data.tasteLevels[Number(e.detail.value)]; this.saveProfile(); },
  onFavToggle(e) {
    const v = e.currentTarget.dataset.v;
    const person = app.globalData.profile[cloudsync.myGender()];
    if (!Array.isArray(person.favs)) person.favs = [];
    if (!Array.isArray(person.favHidden)) person.favHidden = [];
    const i = person.favs.indexOf(v);
    if (i !== -1) {
      // 已选中：点 chip 即删除（与 ✕ 一致），并从候选列表彻底移除
      person.favs.splice(i, 1);
      if (person.favHidden.indexOf(v) === -1) person.favHidden.push(v);
      this.saveProfile();
      this.setData({ favLast: '已删除「' + v + '」' });
      wx.showToast({ title: '已删除「' + v + '」', icon: 'none' });
      return;
    }
    // 已被 ✕ 删除的项不允许 chip 重新加回（防止事件双触发把删除“复活”）
    if (person.favHidden.indexOf(v) !== -1) {
      wx.showToast({ title: '「' + v + '」已删除，用输入框重新添加', icon: 'none' });
      return;
    }
    person.favs.push(v);
    this.saveProfile();
    this.setData({ favLast: '已添加「' + v + '」' });
    wx.showToast({ title: '已添加「' + v + '」', icon: 'none' });
  },
  onFavDel(e) {
    const v = e.currentTarget.dataset.v;
    const person = app.globalData.profile[cloudsync.myGender()];
    if (!Array.isArray(person.favs)) person.favs = [];
    if (!Array.isArray(person.favHidden)) person.favHidden = [];
    person.favs = person.favs.filter(function (f) { return f !== v; });
    if (person.favHidden.indexOf(v) === -1) person.favHidden.push(v);
    this.saveProfile();
    this.setData({ favLast: '已删除「' + v + '」' });
    wx.showToast({ title: '已删除「' + v + '」', icon: 'none' });
  },
  clearFavs() {
    const person = app.globalData.profile[cloudsync.myGender()];
    if (!Array.isArray(person.favs)) person.favs = [];
    const n = person.favs.length;
    person.favs = [];
    this.saveProfile();
    this.setData({ favLast: '已清空 ' + n + ' 种' });
    wx.showToast({ title: '已清空全部喜好', icon: 'none' });
  },
  onFavNew(e) { this.setData({ favNew: e.detail.value }); },
  addFav() {
    const v = String(this.data.favNew || '').trim();
    if (!v) { wx.showToast({ title: '先输入食材名', icon: 'none' }); return; }
    const person = app.globalData.profile[cloudsync.myGender()];
    if (!Array.isArray(person.favs)) person.favs = [];
    if (!Array.isArray(person.favHidden)) person.favHidden = [];
    const hi = person.favHidden.indexOf(v);
    if (hi !== -1) person.favHidden.splice(hi, 1);
    if (person.favs.indexOf(v) === -1) person.favs.push(v);
    this.setData({ favNew: '' });
    this.saveProfile();
  },
  // ===== 家庭 ======
  editName() {
    if (this.data.myRole !== 'creator') return; // 仅创建者可改名
    this.setData({ editingName: true });
  },
  onNameInput(e) { this.setData({ familyName: e.detail.value }); },
  saveName() {
    const name = String(this.data.familyName || '').trim() || '我们的家';
    const fam = this.data.family;
    if (fam) fam.name = name;
    this.setData({ editingName: false, familyName: name, family: fam });
    cloudsync.setName(name).then(function (r) {
      if (r && r.ok) wx.showToast({ title: '已保存', icon: 'success' });
      else wx.showToast({ title: (r && r.err) || '保存失败', icon: 'none' });
      this.loadFamily();
    }.bind(this));
  },
  onJoinCode(e) { this.setData({ joinCode: e.detail.value }); },
  onRelation(e) { this.setData({ joinRelationIdx: Number(e.detail.value) }); },
  createFamily() {
    cloudsync.createFamily(this.data.nickname || '我', wx.getStorageSync('myAvatarUrl') || '', cloudsync.myGender(), (this.data.nickname || '我') + '的家').then(function (r) {
      if (r && r.ok) { this.loadFamily(); wx.showToast({ title: '家庭已创建 🎉', icon: 'success' }); }
      else { wx.showToast({ title: (r && r.err) || '创建失败', icon: 'none' }); }
    }.bind(this)).catch(function () { wx.showToast({ title: '创建失败：请确认 family 云函数已部署', icon: 'none' }); });
  },
  joinFamily() {
    const code = String(this.data.joinCode || '').trim();
    if (!code) { wx.showToast({ title: '请输入邀请码', icon: 'none' }); return; }
    cloudsync.joinFamily(code, this.data.relations[this.data.joinRelationIdx], this.data.nickname || 'TA', wx.getStorageSync('myAvatarUrl') || '', cloudsync.myGender()).then(function (r) {
      if (r && r.ok) { this.loadFamily(); wx.showToast({ title: '加入成功 🎉', icon: 'success' }); }
      else { wx.showToast({ title: (r && r.err) || '加入失败', icon: 'none' }); }
    }.bind(this)).catch(function () { wx.showToast({ title: '加入失败：请确认 family 云函数已部署', icon: 'none' }); });
  },
  onMyRelation(e) {
    const idx = Number(e.detail.value);
    const rel = this.data.relations[idx];
    this.setData({ myRelationIdx: idx, myRelation: rel });
    cloudsync.setRelation(rel);
  },
  onAvatarError(e) {
    const idx = e.currentTarget.dataset.idx;
    const members = (this.data.family && this.data.family.members || []).slice();
    if (members[idx]) { members[idx].avatarErr = true; this.setData({ 'family.members': members }); }
  },
  leaveFamily() {
    const isCreator = this.data.myRole === 'creator';
    wx.showModal({
      title: isCreator ? '解散家庭' : '退出家庭',
      content: isCreator ? '解散后家庭数据将被删除，双方恢复单人模式。确定？' : '退出后你将恢复单人模式，家庭数据保留在云端。确定？',
      success: function (res) {
        if (!res.confirm) return;
        cloudsync.leaveFamily().then(function (r) {
          if (r && r.ok) {
            wx.removeStorageSync('familyCode');
            this.setData({ family: null, myRole: '' });
            this.loadFamily();
            wx.showToast({ title: isCreator ? '家庭已解散' : '已退出家庭', icon: 'success' });
          } else { wx.showToast({ title: (r && r.err) || '操作失败', icon: 'none' }); }
        }.bind(this)).catch(function () { wx.showToast({ title: '操作失败：请确认 family 云函数已部署', icon: 'none' }); });
      }.bind(this)
    });
  },
  copyCode() {
    if (!this.data.family) return;
    // 剪贴板属于隐私接口：先走隐私弹窗授权，再写入，避免审核回收权限后调用失败
    const run = () => {
      wx.setClipboardData({ data: this.data.family.code, success: function () { wx.showToast({ title: '邀请码已复制', icon: 'success' }); } });
    };
    const pp = this.selectComponent('#pp');
    if (pp) pp.ensure(run); else run();
  },
  onShareAppMessage() {
    const code = this.data.family ? this.data.family.code : '';
    return { title: '加入我们的「欢洋生活」小家庭 🏠', path: '/pages/profile/profile?code=' + code };
  },
  // ===== 使用建议 ======
  goSuggest() { wx.navigateTo({ url: '/pages/suggest/suggest' }); },
  goSuggestions() { wx.navigateTo({ url: '/pages/suggestions/suggestions' }); },
  // ===== 折叠与提醒 ======
  toggleLog() { this.setData({ logOpen: !this.data.logOpen }); },
  toggleBase() { this.setData({ baseOpen: !this.data.baseOpen }); },
  togglePref() { this.setData({ prefOpen: !this.data.prefOpen }); },
  toggleFamily() { this.setData({ familyOpen: !this.data.familyOpen }); },
  toggleHabitCard() { this.setData({ habitOpen: !this.data.habitOpen }); },
  toggleModCard() { this.setData({ modOpen: !this.data.modOpen }); },
  toggleSuppCard() { this.setData({ suppOpen: !this.data.suppOpen }); },
  openRemind() {
    const that = this;
    wx.requestSubscribeMessage({
      tmplIds: [cloudsync.TEMPLATE_ID],
      success: function (res) {
        if (res[cloudsync.TEMPLATE_ID] === 'accept') {
          wx.setStorageSync('remindEnabled', true);
          that.setData({ remindEnabled: true });
          wx.showToast({ title: '每日提醒已开启', icon: 'success' });
        } else { wx.showToast({ title: '未开启（已拒绝或达上限）', icon: 'none' }); }
      },
      fail: function () { wx.showToast({ title: '开启失败，请重试', icon: 'none' }); }
    });
  }
});
