const zzj = require('../../data/zhangzhongjue.js');
const READ = require('../../data/zzj-read.js');

Page({
  data: {
    question: '',
    isIdle: true, isDrawing: false, isFocus: false, hasResult: false,
    focusList: READ.FOCUS,
    result: null, palms: [], animIdx: -1, animLabel: '', hasMoreLayer: false
  },

  onLoad() {
    this.timers = [];
    this.setData({ palms: zzj.palmGrid(-1) });
  },
  onUnload() { this.clearTimers(); },
  clearTimers() {
    (this.timers || []).forEach(function (t) { clearTimeout(t); });
    this.timers = [];
  },
  onInput(e) { this.setData({ question: e.detail.value }); },

  roll() {
    // 点击反馈 + 异常可见：避免「点了没反应」时无从判断
    try { wx.vibrateShort({ fail: function () {} }); } catch (e) {}
    try {
      const pick = zzj.pickRandom();
      this.pick = pick;
      this.setData({ isIdle: false, isDrawing: true, isFocus: false, hasResult: false, animLabel: '' });
      this.animate(pick);
    } catch (err) {
      this.clearTimers();
      this.setData({ isIdle: true, isDrawing: false, isFocus: false, hasResult: false });
      wx.showToast({ title: '出错了：' + ((err && err.message) || err), icon: 'none', duration: 3000 });
    }
  },

  animate(pick) {
    const self = this;
    let frames = [];
    try { frames = zzj.buildFrames(pick); } catch (err) { frames = []; }
    if (!frames.length) { self.askFocus(pick); return; }
    let i = 0;
    const step = () => {
      if (i >= frames.length) { self.askFocus(pick); return; }
      const f = frames[i++];
      self.setData({ palms: zzj.palmGrid(f.idx), animIdx: f.idx, animLabel: f.label });
      self.timers.push(setTimeout(step, f.delay));
    };
    step();
  },

  skipAnim() {
    if (!this.data.isDrawing) return;
    this.clearTimers();
    this.askFocus(this.pick);
  },

  // 落宫完成后先问一句「你最想弄清楚哪一点」，再按用户关注点组织解读
  askFocus(pick) {
    this.setData({
      isIdle: false, isDrawing: false, isFocus: true, hasResult: false,
      palms: zzj.palmGrid(pick.result), animIdx: pick.result, animLabel: ''
    });
  },

  pickFocus(e) {
    const key = e.currentTarget.dataset.k;
    const reading = READ.buildReading(this.pick, key, this.data.question);
    this.setData({
      isIdle: false, isDrawing: false, isFocus: false, hasResult: true,
      result: reading, hasMoreLayer: this.layerHasMore(reading.layers)
    });
  },

  layerHasMore(layers) {
    return layers.some(function (l) { return !l.open; });
  },

  // 点某一层：展开/收起；点「继续展开」：按顺序推出下一层
  toggleLayer(e) {
    const i = Number(e.currentTarget.dataset.i);
    const layers = this.data.result.layers.map(function (l, idx) {
      return Object.assign({}, l, { open: idx === i ? !l.open : l.open });
    });
    this.setData({
      result: Object.assign({}, this.data.result, { layers: layers }),
      hasMoreLayer: this.layerHasMore(layers)
    });
  },

  nextLayer() {
    const layers = this.data.result.layers;
    let target = -1;
    for (let i = 0; i < layers.length; i++) {
      if (!layers[i].open) { target = i; break; }
    }
    if (target === -1) return;
    const opened = layers.map(function (l, idx) {
      return Object.assign({}, l, { open: idx <= target ? true : l.open });
    });
    this.setData({
      result: Object.assign({}, this.data.result, { layers: opened }),
      hasMoreLayer: this.layerHasMore(opened)
    });
  },

  // 追问：点开一个问题显示回答
  toggleFollowup(e) {
    const i = Number(e.currentTarget.dataset.i);
    const followups = this.data.result.followups.map(function (f, idx) {
      return Object.assign({}, f, { open: idx === i ? !f.open : f.open });
    });
    this.setData({ result: Object.assign({}, this.data.result, { followups: followups }) });
  },

  again() {
    this.clearTimers();
    this.setData({
      isIdle: true, isDrawing: false, isFocus: false, hasResult: false,
      result: null, palms: zzj.palmGrid(-1), animIdx: -1, animLabel: '',
      hasMoreLayer: false
    });
  }
});
