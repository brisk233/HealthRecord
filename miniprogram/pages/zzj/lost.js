const zzj = require('../../data/zhangzhongjue.js');
const READ = require('../../data/zzj-lost-read.js');

Page({
  data: {
    item: '',
    isIdle: true, isDrawing: false, hasResult: false,
    reading: null,          // 白话互动解读
    focusList: [],
    hasMoreLayer: false,
    tradOpen: false,        // 传统依据（方位/口诀/应期）默认收起
    palms: [], animIdx: -1, animLabel: ''
  },

  onLoad() {
    this.timers = [];
    this.focusKey = 'find';
    this.setData({ palms: zzj.palmGrid(-1) });
  },
  onUnload() { this.clearTimers(); },
  clearTimers() {
    (this.timers || []).forEach(function (t) { clearTimeout(t); });
    this.timers = [];
  },
  onInput(e) { this.setData({ item: e.detail.value }); },

  roll() {
    const pick = zzj.pickRandom();
    this.pick = pick;
    this.setData({ isIdle: false, isDrawing: true, hasResult: false, animLabel: '', tradOpen: false });
    this.animate(pick);
  },

  animate(pick) {
    const self = this;
    const frames = zzj.buildFrames(pick);
    let i = 0;
    const step = () => {
      if (i >= frames.length) { self.showResult(pick); return; }
      const f = frames[i++];
      self.setData({ palms: zzj.palmGrid(f.idx), animIdx: f.idx, animLabel: f.label });
      self.timers.push(setTimeout(step, f.delay));
    };
    step();
  },

  skipAnim() {
    if (!this.data.isDrawing) return;
    this.clearTimers();
    this.showResult(this.pick);
  },

  showResult(pick) {
    this.setData({
      isIdle: false, isDrawing: false, hasResult: true,
      palms: zzj.palmGrid(pick.result), animIdx: pick.result,
      animLabel: '', tradOpen: false
    });
    this.buildReading();
  },

  // ── 白话互动解读 ─────────────────────────────────────
  buildReading() {
    const key = this.focusKey || 'find';
    const reading = READ.buildLost(this.pick, key, this.data.item);
    const focusList = READ.FOCUS.map(function (f) {
      return { key: f.key, label: f.label, on: f.key === key };
    });
    this.setData({
      reading: reading,
      focusList: focusList,
      hasMoreLayer: reading.layers.some(function (l) { return !l.open; })
    });
  },

  onFocus(e) {
    this.focusKey = e.currentTarget.dataset.key;
    this.buildReading();
  },

  toggleLayer(e) {
    const idx = e.currentTarget.dataset.idx;
    const layers = this.data.reading.layers.map(function (l, i) {
      return { t: l.t, x: l.x, open: i === idx ? !l.open : l.open };
    });
    this.setData({
      reading: Object.assign({}, this.data.reading, { layers: layers }),
      hasMoreLayer: layers.some(function (l) { return !l.open; })
    });
  },

  openNextLayer() {
    const layers = this.data.reading.layers;
    let target = -1;
    for (let i = 0; i < layers.length; i++) { if (!layers[i].open) { target = i; break; } }
    if (target === -1) return;
    const opened = layers.map(function (l, i) {
      return { t: l.t, x: l.x, open: i <= target ? true : l.open };
    });
    this.setData({
      reading: Object.assign({}, this.data.reading, { layers: opened }),
      hasMoreLayer: opened.some(function (l) { return !l.open; })
    });
  },

  toggleFollowup(e) {
    const idx = e.currentTarget.dataset.idx;
    const followups = this.data.reading.followups.map(function (f, i) {
      return { q: f.q, a: f.a, open: i === idx ? !f.open : f.open };
    });
    this.setData({ reading: Object.assign({}, this.data.reading, { followups: followups }) });
  },

  toggleTrad() { this.setData({ tradOpen: !this.data.tradOpen }); },

  again() {
    this.clearTimers();
    this.focusKey = 'find';
    this.setData({
      isIdle: true, isDrawing: false, hasResult: false,
      reading: null, tradOpen: false,
      palms: zzj.palmGrid(-1), animIdx: -1, animLabel: ''
    });
  }
});
