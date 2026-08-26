Component({
  data: { show: false },
  lifetimes: {
    attached() { this.ensure(null); } // 进入页面被动检测
  },
  methods: {
    // 隐私保障：未授权时弹窗，同意后执行回调（登录/换头像等获取用户信息前调用）
    ensure(cb) {
      const run = () => { this.setData({ show: false }); if (cb) cb(); };
      if (!wx.getPrivacySetting) { run(); return; }
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) { this._cb = cb; this.setData({ show: true }); }
          else run();
        },
        fail: () => run()
      });
    },
    onAgree() {
      const cb = this._cb;
      this._cb = null;
      const done = () => { this.setData({ show: false }); if (cb) cb(); };
      if (wx.requirePrivacyAuthorize) {
        wx.requirePrivacyAuthorize({ success: done, fail: () => this.setData({ show: false }) });
      } else {
        done();
      }
    },
    // V1：拒绝 → 只关闭弹窗不退出，功能受限但可继续使用
    onRefuse() {
      this._cb = null;
      this.setData({ show: false });
      wx.showToast({ title: '已拒绝授权，部分功能将受限', icon: 'none', duration: 2000 });
    }
  }
});