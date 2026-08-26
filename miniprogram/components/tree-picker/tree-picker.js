// 通用树形选择器（展开式）：大类 tab → 子类分组 → 食材平铺多选，底部已选区 + 确认
const foodtree = require('../../data/foodtree.js');

Component({
  data: {
    show: false, title: '选择食材', mode: 'multi',
    tree: [], activeL1: 0, curL1: null, chosen: []
  },
  methods: {
    noop() {},
    // 打开弹层：{ tree?, title?, mode?: 'multi'|'single', chosen?: [] }
    open(opts) {
      opts = opts || {};
      const tree = opts.tree || foodtree;
      const chosen = (opts.chosen || []).slice();
      const marked = tree.map(function (l1) {
        return Object.assign({}, l1, {
          children: (l1.children || []).map(function (l2) {
            return Object.assign({}, l2, {
              items: (l2.items || []).map(function (it) {
                return Object.assign({}, it, { checked: chosen.indexOf(it.name) !== -1 });
              })
            });
          })
        });
      });
      this.setData({
        show: true, title: opts.title || '选择食材',
        mode: opts.mode === 'single' ? 'single' : 'multi',
        tree: marked, activeL1: 0, curL1: marked[0], chosen: chosen
      });
    },
    close() { this.setData({ show: false }); },
    onMask() { this.close(); },
    onClose() { this.close(); },
    // 切换大类：一次性展示该大类全部子类与食材
    setL1(e) {
      const i = Number(e.currentTarget.dataset.i);
      this.setData({ activeL1: i, curL1: this.data.tree[i] });
    },
    // 点食材：翻转选中并同步 tree.checked + chosen（单选模式只保留一个）
    toggleLeaf(e) {
      const pos = String(e.currentTarget.dataset.pos || '');
      const sep = pos.indexOf('|');
      const gName = pos.slice(0, sep);
      const idx = Number(pos.slice(sep + 1));
      const isSingle = this.data.mode === 'single';
      const tree = this.data.tree.map(function (l1) {
        return Object.assign({}, l1, {
          children: (l1.children || []).map(function (l2) {
            if (l2.name !== gName) return l2;
            return Object.assign({}, l2, {
              items: (l2.items || []).map(function (it, i) {
                if (isSingle) {
                  // 单选：点中的置 true，其余全部置 false
                  return Object.assign({}, it, { checked: i === idx ? true : false });
                }
                if (i !== idx) return it;
                return Object.assign({}, it, { checked: !it.checked });
              })
            });
          })
        });
      });
      // 重算 chosen（与全树 checked 同步）
      const chosen = [];
      tree.forEach(function (l1) {
        (l1.children || []).forEach(function (l2) {
          (l2.items || []).forEach(function (it) { if (it.checked) chosen.push(it.name); });
        });
      });
      // 关键：curL1 是渲染源，必须同步到新 tree，否则勾选标识不更新
      this.setData({ tree: tree, chosen: chosen, curL1: tree[this.data.activeL1] });
      this.triggerEvent('change', { chosen: chosen.slice() });
    },
    // 底部移除单个已选
    removeChosen(e) {
      const v = e.currentTarget.dataset.v;
      const tree = this.data.tree.map(function (l1) {
        return Object.assign({}, l1, {
          children: (l1.children || []).map(function (l2) {
            return Object.assign({}, l2, {
              items: (l2.items || []).map(function (it) {
                if (it.name !== v) return it;
                return Object.assign({}, it, { checked: false });
              })
            });
          })
        });
      });
      const chosen = this.data.chosen.filter(function (n) { return n !== v; });
      this.setData({ tree: tree, chosen: chosen, curL1: tree[this.data.activeL1] });
      this.triggerEvent('change', { chosen: chosen.slice() });
    },
    // 确认：单选回传 item 行为（兼容冰箱），多选回传 chosen 数组
    confirm() {
      const chosen = this.data.chosen.slice();
      if (this.data.mode === 'single') {
        // single 模式：chosen 里取第一个（如冰箱入库场景点选即回填）
        if (!chosen.length) return;
        const name = chosen[chosen.length - 1];
        let it = null;
        this.data.tree.forEach(function (l1) {
          (l1.children || []).forEach(function (l2) {
            (l2.items || []).forEach(function (x) { if (x.name === name) it = x; });
          });
        });
        this.triggerEvent('select', { item: it, name: name, cat: it ? it.cat : '' });
      } else {
        this.triggerEvent('confirm', { chosen: chosen });
      }
      this.close();
    }
  }
});
