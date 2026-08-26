const cloudsync = require('../../utils/cloudsync.js');

Page({
  data: { list: [] },
  onShow() {
    this.load();
  },
  load() {
    cloudsync.suggestList().then(function (list) {
      const items = list.map(function (s) {
        const d = new Date(s.createdAt || 0);
        const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return Object.assign({}, s, {
          dateText: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
        });
      });
      this.setData({ list: items });
    }.bind(this)).catch(function () { this.setData({ list: [] }); }.bind(this));
  },
  previewImage(e) {
    const urls = e.currentTarget.dataset.list || [];
    const current = e.currentTarget.dataset.url;
    if (urls.length) wx.previewImage({ urls: urls, current: current });
  },
  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '删除建议',
      content: '删除后不可恢复，确定？',
      confirmText: '删除', confirmColor: '#C23B3B',
      success: function (res) {
        if (!res.confirm) return;
        cloudsync.suggestDelete(id).then(function (r) {
          if (r && r.ok) {
            wx.showToast({ title: '已删除', icon: 'success' });
            that.load();
          } else {
            wx.showToast({ title: (r && r.err) || '删除失败', icon: 'none' });
          }
        }).catch(function () { wx.showToast({ title: '删除失败：请确认已部署最新 family 云函数', icon: 'none' }); });
      }
    });
  }
});
