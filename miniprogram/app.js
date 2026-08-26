const seed = require('./data/seed.js');
const cloudsync = require('./utils/cloudsync.js');

App({
  globalData: {
    version: '2.5.0',
    env: cloudsync.ENV,
    profile: null,
    fridge: []
  },
  onLaunch() {
    // 临时诊断（定位后移除）：真机 JS 报错时弹窗显示错误内容
    const showErr = function (err) {
      try {
        const msg = (err && (err.message || err.errMsg)) || String(err);
        wx.showModal({ title: '页面出错', content: String(msg).slice(0, 200), showCancel: false });
      } catch (e) {}
    };
    if (wx.onError) wx.onError(showErr);
    if (wx.onUnhandledRejection) wx.onUnhandledRejection(showErr);

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
