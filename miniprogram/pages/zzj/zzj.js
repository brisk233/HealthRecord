const zzj = require('../../data/zhangzhongjue.js');
const READ = require('../../data/zzj-read.js');
// EXT:BEGIN —— 扩展层：上架构建时本区块连同 pages/zzj/lost|future 一并移除
const EXT = require('../../data/zzj-ext.js');
// EXT:END

const HISTORY_KEY = 'zzj-history';
const REROLL_KEY = 'zzj-reroll';
const MAX_HISTORY = 30;
const REROLL_LIMIT = 3;
const MAX_OPTIONS = 3;

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function timeLabel(ts) {
  const d = new Date(ts);
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
    ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

Page({
  data: {
    stage: 'scene',            // scene | input | drawing | result
    isScene: true, isInput: false, isDrawing: false, isResult: false,
    scenes: [],
    scene: null,
    sceneLabel: '',
    // 输入态：默认 2 个输入框，最多可加到 MAX_OPTIONS 个
    options: ['', ''],
    canAdd: true,
    // 预置选项直选（默认模式）：presets 为当前场景候选，mode='manual' 时走手输
    mode: 'preset',
    presets: [],
    selCount: 0,
    rollReady: false,
    picked: '',
    reading: null,          // 白话互动解读（zzj-read.buildDecision）
    focusList: [],          // 关注点 chips
    hasMoreLayer: false,    // 是否还有未展开的层
    tradOpen: false,        // 六宫出处是否展开（默认收起，不打扰用户）
    disclaimer: '',
    result: null,
    palms: [],
    animIdx: -1,
    animLabel: '',
    rerollLeft: REROLL_LIMIT,
    history: [],
    historyOpen: false,
    historyCount: 0,
    // EXT:BEGIN
    extEntries: [],
    // EXT:END
  },

  onLoad(options) {
    this.timers = [];
    this.shakeOn = false;
    this.buildPalms(-1);
    const scenes = zzj.SCENES.map(function (s) { return { key: s.key, label: s.label, icon: s.icon }; });
    const patch = { scenes: scenes };
    // EXT:BEGIN
    patch.extEntries = [
      { key: 'lost', icon: '🧭', title: '寻物', desc: '东西丢了，看看方位和时机', url: '/pages/zzj/lost' },
      { key: 'future', icon: '🔭', title: '走向', desc: '一件事的起因 · 经过 · 结果', url: '/pages/zzj/future' }
    ];
    // EXT:END
    this.setData(patch);
    this.refreshHistory();
    // 支持带场景参数直接进入（如 /pages/zzj/zzj?scene=eat）：跳过场景列表，直接进选项页
    // 说明：今日页「今天听谁的」入口不再带参数，用户自己选场景
    const wantKey = options && options.scene;
    if (wantKey) {
      const hit = zzj.SCENES.filter(function (x) { return x.key === wantKey; })[0];
      if (hit) this.pickSceneByKey(hit);
    }
  },

  pickSceneByKey(s) {
    const list = (zzj.PRESETS && zzj.PRESETS[s.key]) || [];
    const presets = list.map(function (label) { return { label: label, on: false }; });
    this.setData({
      scene: s, sceneLabel: s.label, stage: 'input', isScene: false, isInput: true, isDrawing: false, isResult: false,
      // 有预置选项就直接点选，没有（如「其他」）则回到手输
      mode: presets.length ? 'preset' : 'manual',
      presets: presets, selCount: 0,
      options: ['', ''], canAdd: true,
      rollReady: false
    });
  },

  onShow() {
    this.startShake();
  },
  onHide() { this.stopShake(); this.clearTimers(); },
  onUnload() { this.stopShake(); this.clearTimers(); },

  clearTimers() {
    (this.timers || []).forEach(function (t) { clearTimeout(t); });
    this.timers = [];
  },

  // ── 掌诀图 ───────────────────────────────────────────
  buildPalms(active) {
    this.setData({ palms: zzj.palmGrid(active), animIdx: active });
  },

  // ── 摇一摇 ───────────────────────────────────────────
  startShake() {
    if (this.shakeOn) return;
    const self = this;
    this.shakeHandler = function (res) {
      const power = Math.abs(res.x) + Math.abs(res.y) + Math.abs(res.z);
      if (power > 2.6) { self.onShakeHit(); }
    };
    wx.onAccelerometerChange(this.shakeHandler);
    wx.startAccelerometer({ interval: 'normal', fail: function () {} });
    this.shakeOn = true;
  },
  stopShake() {
    if (!this.shakeOn) return;
    if (this.shakeHandler) { wx.offAccelerometerChange(this.shakeHandler); this.shakeHandler = null; }
    wx.stopAccelerometer({ fail: function () {} });
    this.shakeOn = false;
  },
  onShakeHit() {
    const now = Date.now();
    if (this.lastShake && now - this.lastShake < 1500) return;  // 防抖
    this.lastShake = now;
    if (this.data.stage === 'input') {
      if (!this.canRoll()) return;
      wx.vibrateShort({ fail: function () {} });
      this.doRoll();
    } else if (this.data.stage === 'result') {
      this.onReroll();
    }
  },

  // ── 场景 / 选项 ──────────────────────────────────────
  pickScene(e) {
    const key = e.currentTarget.dataset.key;
    const s = zzj.SCENES.filter(function (x) { return x.key === key; })[0];
    if (s) this.pickSceneByKey(s);
  },
  onOption(e) {
    const i = e.currentTarget.dataset.idx;
    const options = this.data.options.slice();
    options[i] = e.detail.value;
    this.setData({ options: options, rollReady: this.filledOptions().length >= 2 });
  },
  addOption() {
    const options = this.data.options.slice();
    if (options.length >= MAX_OPTIONS) return; // 已到上限：按钮此时应已隐藏（canAdd=false）
    options.push('');
    this.setData({ options: options, canAdd: options.length < MAX_OPTIONS });
  },
  filledOptions() {
    return this.data.options.map(function (s) { return String(s || '').trim(); }).filter(function (s) { return !!s; });
  },

  // ── 预置选项直选 ─────────────────────────────────────
  togglePreset(e) {
    const i = Number(e.currentTarget.dataset.idx);
    const presets = this.data.presets.slice();
    if (!presets[i]) return;
    const nextOn = !presets[i].on;
    let selCount = this.data.selCount;
    if (nextOn && selCount >= MAX_OPTIONS) {
      wx.showToast({ title: '最多选 ' + MAX_OPTIONS + ' 个', icon: 'none' });
      return;
    }
    presets[i] = { label: presets[i].label, on: nextOn };
    selCount = presets.filter(function (p) { return p.on; }).length;
    this.setData({ presets: presets, selCount: selCount, rollReady: selCount >= 2 });
  },
  switchManual() {
    this.setData({ mode: 'manual', rollReady: this.filledOptions().length >= 2 });
  },
  switchPreset() {
    if (!this.data.presets.length) return;
    this.setData({ mode: 'preset', rollReady: this.data.selCount >= 2 });
  },
  // 当前生效的选项：预置模式取已选，手输模式取填写内容
  currentOptions() {
    if (this.data.mode === 'preset') {
      return this.data.presets.filter(function (p) { return p.on; }).map(function (p) { return p.label; });
    }
    return this.filledOptions();
  },

  canRoll() {
    if (this.currentOptions().length < 2) {
      wx.showToast({
        title: this.data.mode === 'preset' ? '至少点选 2 个选项' : '至少写 2 个选项',
        icon: 'none'
      });
      return false;
    }
    return true;
  },
  backToScene() {
    this.clearTimers();
    this.setData({
      stage: 'scene', isScene: true, isInput: false, isDrawing: false, isResult: false,
      scene: null, options: ['', ''], canAdd: true, mode: 'preset', presets: [], selCount: 0,
      rollReady: false, animLabel: '', reading: null, tradOpen: false
    });
    this.focusKey = 'result';
    this.buildPalms(-1);
  },
  backToInput() {
    this.clearTimers();
    this.focusKey = 'result';
    this.setData({ stage: 'input', isScene: false, isInput: true, isDrawing: false, isResult: false, animLabel: '', reading: null, tradOpen: false });
    this.buildPalms(-1);
  },

  // ── 抽取 ─────────────────────────────────────────────
  roll() { if (this.canRoll()) this.doRoll(); },

  doRoll() {
    const pick = zzj.pickRandom();
    this.pick = pick;
    const opts = this.currentOptions();
    // 用落宫结果在选项间做公平分配
    const oi = pick.result % opts.length;
    this.pickedText = opts[oi];
    this.setData({ stage: 'drawing', isScene: false, isInput: false, isDrawing: true, isResult: false });
    this.animate(pick, this.pickedText);
  },

  animate(pick, pickedText) {
    const self = this;
    const frames = zzj.buildFrames(pick);
    let i = 0;
    const step = () => {
      if (i >= frames.length) { self.showResult(pick, pickedText); return; }
      const f = frames[i++];
      self.buildPalms(f.idx);
      self.setData({ animLabel: f.label });
      self.timers.push(setTimeout(step, f.delay));
    };
    step();
  },

  skipAnim() {
    if (this.data.stage !== 'drawing') return;
    this.clearTimers();
    this.showResult(this.pick, this.pickedText);
  },

  showResult(pick, pickedText) {
    const r = zzj.buildResult(pick.result);
    this.buildPalms(pick.result);
    const rec = {
      ts: Date.now(), time: timeLabel(Date.now()),
      scene: this.data.sceneLabel,
      options: this.currentOptions().join(' / '),
      picked: pickedText, tone: r.tone, trad: r.trad, done: false, idx: pick.result
    };
    this.curRecord = rec;
    this.focusKey = 'result';
    this.setData({
      stage: 'result', isScene: false, isInput: false, isDrawing: false, isResult: true,
      result: r, picked: pickedText, animLabel: '', tradOpen: false
    });
    this.buildReading(pickedText);
  },

  // ── 白话互动解读 ─────────────────────────────────────
  // 不打头展示宫位名，先说白话结论；用户可换关注点、逐层展开、追问
  buildReading(pickedText) {
    const key = this.focusKey || 'result';
    const reading = READ.buildDecision(this.pick, key, pickedText, this.data.sceneLabel);
    const focusList = READ.FOCUS.map(function (f) {
      return { key: f.key, label: f.label, on: f.key === key };
    });
    this.setData({
      reading: reading,
      focusList: focusList,
      hasMoreLayer: reading.layers.some(function (l) { return !l.open; }),
      disclaimer: zzj.DISCLAIMER
    });
  },

  onFocus(e) {
    this.focusKey = e.currentTarget.dataset.key;
    this.buildReading(this.data.picked);
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

  // ── 再来一次（同题同日限 3 次）────────────────────────
  rerollState() {
    const store = wx.getStorageSync(REROLL_KEY) || {};
    if (store.date !== todayKey()) return {};
    return store.map || {};
  },
  canReroll(questionKey) {
    const used = this.rerollState()[questionKey] || 0;
    return used < REROLL_LIMIT;
  },
  bumpReroll(questionKey) {
    const map = this.rerollState();
    map[questionKey] = (map[questionKey] || 0) + 1;
    wx.setStorageSync(REROLL_KEY, { date: todayKey(), map: map });
    return REROLL_LIMIT - map[questionKey];
  },
  questionKey() {
    return (this.data.scene ? this.data.scene.key : 'x') + '|' + this.currentOptions().join('|');
  },
  onReroll() {
    const qk = this.questionKey();
    if (!this.canReroll(qk)) {
      wx.showToast({ title: '同一个问题今天已经算过 3 次了，先按结果定下来吧', icon: 'none', duration: 2500 });
      return;
    }
    const left = this.bumpReroll(qk);
    this.setData({ rerollLeft: left });
    this.doRoll();
  },

  // ── 就这么定了 ───────────────────────────────────────
  onConfirm() {
    if (!this.curRecord) return;
    const rec = Object.assign({}, this.curRecord, { done: true });
    const list = wx.getStorageSync(HISTORY_KEY) || [];
    list.unshift(rec);
    const trimmed = list.slice(0, MAX_HISTORY);
    wx.setStorageSync(HISTORY_KEY, trimmed);
    this.refreshHistory();
    wx.vibrateShort({ fail: function () {} });
    wx.showToast({ title: '定了 ✅', icon: 'none' });
    setTimeout(function () { wx.navigateBack({ fail: function () {} }); }, 700);
  },

  refreshHistory() {
    const list = wx.getStorageSync(HISTORY_KEY) || [];
    this.setData({ history: list, historyCount: list.length });
  },
  toggleHistory() { this.setData({ historyOpen: !this.data.historyOpen }); },
  clearHistory() {
    const self = this;
    wx.showModal({
      title: '清空记录', content: '确定清空全部历史记录吗？',
      success: function (r) {
        if (r.confirm) { wx.removeStorageSync(HISTORY_KEY); self.refreshHistory(); wx.showToast({ title: '已清空', icon: 'none' }); }
      }
    });
  },

  goKnowledge() { wx.navigateTo({ url: '/pages/zzj/knowledge' }); },
  // EXT:BEGIN
  goExt(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }); },
  // EXT:END
  noop() {}
});
