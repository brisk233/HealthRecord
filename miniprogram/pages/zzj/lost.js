const zzj = require('../../data/zhangzhongjue.js');
const EXT = require('../../data/zzj-ext.js');

Page({
  data: {
    item: '',
    isIdle: true, isDrawing: false, hasResult: false,
    result: null, palms: [], animIdx: -1, animLabel: ''
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
  onInput(e) { this.setData({ item: e.detail.value }); },

  roll() {
    const pick = zzj.pickRandom();
    this.pick = pick;
    this.setData({ isIdle: false, isDrawing: true, hasResult: false, animLabel: '' });
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
    const result = EXT.lostOf(pick.result);
    this.setData({
      isIdle: false, isDrawing: false, hasResult: true,
      palms: zzj.palmGrid(pick.result), animIdx: pick.result,
      animLabel: '', result: result
    });
  },

  again() {
    this.clearTimers();
    this.setData({
      isIdle: true, isDrawing: false, hasResult: false,
      result: null, palms: zzj.palmGrid(-1), animIdx: -1, animLabel: ''
    });
  }
});
