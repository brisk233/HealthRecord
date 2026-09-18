const app = getApp();
const cloudsync = require('../../utils/cloudsync.js');
const date = require('../../utils/date.js');

Page({
  data: {
    importing: false, candidates: [], importingStep: '', results: [], picked: [],
    cntTotal: 0, cntOk: 0, done: false
  },
  pickImages() {
    if (this.data.importing) return;
    const that = this;
    wx.chooseMedia({
      count: 5, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
      success: function (res) {
        const paths = (res.tempFiles || []).map(function (f) { return f.tempFilePath; });
        that.runOcr(paths);
      }
    });
  },
  async runOcr(paths) {
    const that = this;
    this.setData({ importing: true, candidates: [], importingStep: '识别中…（每张约 2 秒）' });
    const all = [];
    for (let i = 0; i < paths.length; i++) {
      this.setData({ importingStep: '识别第 ' + (i + 1) + '/' + paths.length + ' 张…' });
      try {
        const r = await cloudsync.billOcr(paths[i]);
        if (r && r.ok && r.data && Array.isArray(r.data.candidates)) {
          all.push.apply(all, r.data.candidates.map(function (c) {
            return Object.assign({}, c, {
              picked: true, category: 'food', person: 'male', _k: Date.now() + '_' + Math.random().toString(36).slice(2, 7)
            });
          }));
        } else if (r && r.err) {
          // 所有错误都可见提示，严禁静默吞掉
          that.setData({ importing: false, importingStep: '' });
          wx.showModal({
            title: '识别失败',
            content: r.err,
            showCancel: false
          });
          return;
        } else {
          that.setData({ importing: false, importingStep: '' });
          wx.showToast({ title: '未识别出账单条目', icon: 'none' });
          return;
        }
      } catch (e) {
        // 单张异常继续下一张，但全程结束后若一张都没识别到就提示
        console.warn('billOcr 异常', e);
      }
    }
    this.setData({ importing: false, importingStep: '', candidates: all, cntTotal: all.length });
    if (!all.length) {
      wx.showModal({
        title: '识别失败',
        content: '没有从截图识别到账单条目。请确认：1) family 云函数已用最新版部署（含 OCR）；2) 腾讯云密钥已配置；3) 截图是微信支付账单页面。',
        showCancel: false
      });
    }
  },
  togglePick(e) {
    const k = e.currentTarget.dataset.k;
    const candidates = this.data.candidates.map(function (c) {
      return c._k === k ? Object.assign({}, c, { picked: !c.picked }) : c;
    });
    this.setData({ candidates: candidates, cntOk: candidates.filter(function (c) { return c.picked; }).length });
  },
  pickCat(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.currentTarget.dataset.v;
    const candidates = this.data.candidates.map(function (c) {
      return c._k === k ? Object.assign({}, c, { category: v }) : c;
    });
    this.setData({ candidates: candidates });
  },
  pickPerson(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.currentTarget.dataset.v;
    const candidates = this.data.candidates.map(function (c) {
      return c._k === k ? Object.assign({}, c, { person: v }) : c;
    });
    this.setData({ candidates: candidates });
  },
  async saveAll() {
    const that = this;
    const picked = this.data.candidates.filter(function (c) { return c.picked; });
    if (!picked.length) { wx.showToast({ title: '请勾选要入账的条目', icon: 'none' }); return; }
    this.setData({ importing: true, importingStep: '保存中…' });
    let ok = 0, failCnt = 0;
    for (let i = 0; i < picked.length; i++) {
      const c = picked[i];
      // OCR 候选的日期解析：无日期时为今天
      const d = c.date ? c.date.replace(/年|月/g, '-').replace(/日.*$/, '').replace(/-(d)$/, '-0$1') : date.todayStr();
      const r = await cloudsync.billAdd({
        money: c.amount, type: c.type === 'income' ? 'income' : 'expense',
        date: d, category: c.category || 'food',
        note: (c.merchant || '截图导入'), merchant: c.merchant || '', person: c.person || 'male'
      });
      if (r && r.ok) ok++; else failCnt++;
    }
    this.setData({ importing: false, importingStep: '', done: true, cntOk: ok, cntTotal: picked.length });
    wx.showToast({ title: '已导入 ' + ok + ' 笔' + (failCnt ? '，失败 ' + failCnt : ''), icon: 'none' });
    if (this.data.candidates.filter(function (c) { return c.picked; }).length) {
      setTimeout(function () {
        wx.redirectTo({ url: '/pages/bills/bills' });
      }, 1200);
    }
  }
});
