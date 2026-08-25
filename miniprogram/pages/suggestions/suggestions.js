const cloudsync = require('../../utils/cloudsync.js');

Page({
  data: { list: [] },
  onShow() {
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
  }
});
