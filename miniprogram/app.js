const seed = require('./data/seed.js');
const cloudsync = require('./utils/cloudsync.js');

App({
  globalData: {
    version: '2.2.0',
    env: cloudsync.ENV,
    profile: null,
    fridge: []
  },
  onLaunch() {
    const stored = wx.getStorageSync('profile');
    this.globalData.profile = (stored && stored.male && stored.female) ? stored : seed.defaultProfile;
    const fridge = wx.getStorageSync('fridge');
    this.globalData.fridge = (fridge && fridge.length > 0) ? fridge : seed.buildDefaultFridge();

    cloudsync.init();
    const app = this;
    function applyHome(home) {
      if (!home) return;
      if (home.profile) { app.globalData.profile = cloudsync.mergeProfile(app.globalData.profile, home.profile); wx.setStorageSync('profile', app.globalData.profile); }
      if (home.fridge) { app.globalData.fridge = home.fridge; wx.setStorageSync('fridge', home.fridge); }
      if (home.menuOverride !== undefined) wx.setStorageSync('menuOverride', home.menuOverride || {});
    }
    cloudsync.pullHome().then(applyHome).catch(function () {});
    cloudsync.hydrateTodayCheckins();
    // 静默自动登录：确认身份后按账号自动绑回家庭并拉取数据
    cloudsync.login().then(function (res) {
      if (res && res.openid) {
        wx.setStorageSync('myOpenid', res.openid);
        if (!cloudsync.familyCode()) {
          cloudsync.familyInfo().then(function () {
            return cloudsync.pullHome();
          }).then(applyHome).catch(function () {});
        }
      }
    }).catch(function () {});
  },
  // 退出登录：清空本机全部数据（云端保留，重新登录自动恢复）
  resetLocal() {
    wx.clearStorageSync();
    this.globalData.profile = seed.defaultProfile;
    this.globalData.fridge = [];
  }
});
