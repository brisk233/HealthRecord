const cloudsync = require('../../utils/cloudsync.js');

Page({
  data: { text: '', images: [], submitting: false, canAddImg: true },
  onLoad() {
    // S2：恢复上次未提交的草稿
    const draft = wx.getStorageSync('suggestDraft');
    if (draft) this.setData({ text: draft });
  },
  onUnload() {
    // S2：离开时保存草稿（提交成功后会清除）
    if (this.data.text) wx.setStorageSync('suggestDraft', this.data.text);
  },
  onText(e) {
    this.setData({ text: e.detail.value });
    wx.setStorageSync('suggestDraft', e.detail.value);
  },
  pickImage() {
    const left = 3 - this.data.images.length;
    if (left <= 0) { wx.showToast({ title: '最多添加 3 张图片', icon: 'none' }); return; }
    // 相册属于隐私接口：先走隐私弹窗授权，再打开相册
    const run = () => {
      wx.chooseMedia({
        count: left, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
        success: (res) => {
          const paths = (res.tempFiles || []).map(function (f) { return f.tempFilePath; });
          const images = this.data.images.concat(paths);
          this.setData({ images: images, canAddImg: images.length < 3 });
        }
      });
    };
    const pp = this.selectComponent('#pp');
    if (pp) pp.ensure(run); else run();
  },
  removeImage(e) {
    const idx = e.currentTarget.dataset.idx;
    const images = this.data.images.slice();
    images.splice(idx, 1);
    this.setData({ images: images, canAddImg: images.length < 3 });
  },
  previewImage(e) {
    const urls = this.data.images;
    const current = urls[e.currentTarget.dataset.idx];
    if (urls.length) wx.previewImage({ urls: urls, current: current });
  },
  submit() {
    if (this.data.submitting) return;
    const text = String(this.data.text || '').trim();
    if (!text && !this.data.images.length) { wx.showToast({ title: '先填写建议或添加图片', icon: 'none' }); return; }
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中…' });
    const uploadOne = (path, i) => {
      return new Promise(function (resolve, reject) {
        const openid = wx.getStorageSync('myOpenid') || 'guest';
        wx.cloud.uploadFile({
          cloudPath: 'suggestions/' + openid + '-' + Date.now() + '-' + i + '.jpg',
          filePath: path,
          success: function (up) { resolve(up.fileID); },
          fail: function (e) { reject(e); }
        });
      });
    };
    Promise.all(this.data.images.map(uploadOne)).then(function (fileIDs) {
      return cloudsync.suggestAdd(text, fileIDs);
    }).then(function (r) {
      wx.hideLoading();
      if (r && r.ok) {
        wx.removeStorageSync('suggestDraft'); // S2：提交成功清草稿
        wx.showToast({ title: '已提交，感谢反馈 🎉', icon: 'success' });
        setTimeout(function () { wx.navigateBack({ fail: function () {} }); }, 600);
      } else {
        this.setData({ submitting: false });
        wx.showToast({ title: (r && r.err) || '提交失败，请重试', icon: 'none' });
      }
    }.bind(this)).catch(function () {
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '提交失败：请确认已部署最新 family 云函数', icon: 'none' });
    }.bind(this));
  }
});
