const app = getApp();
const cloudsync = require('../../utils/cloudsync.js');
const date = require('../../utils/date.js');

const CATS = {
  expense: [
    { key: 'food', icon: '🍚', name: '餐饮' },
    { key: 'market', icon: '🥬', name: '食材' },
    { key: 'transport', icon: '🚌', name: '交通' },
    { key: 'daily', icon: '🧻', name: '日用' },
    { key: 'clothes', icon: '👕', name: '服饰' },
    { key: 'health', icon: '💊', name: '医疗' },
    { key: 'housing', icon: '🏠', name: '住房' },
    { key: 'fun', icon: '🎮', name: '娱乐' },
    { key: 'other', icon: '📦', name: '其他' }
  ],
  income: [
    { key: 'salary', icon: '💼', name: '工资' },
    { key: 'bonus', icon: '🎁', name: '奖金' },
    { key: 'parttime', icon: '💪', name: '兼职' },
    { key: 'invest', icon: '📈', name: '理财' },
    { key: 'other', icon: '📦', name: '其他' }
  ]
};

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function ym(d) { return d.slice(0, 7); }
function fmtYMD(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

Page({
  data: {
    income: CATS.income, expense: CATS.expense,
    type: 'expense', money: '', category: 'food', note: '',
    catCurrent: CATS.expense,
    bills: [], // 已加载账单（按月）
    month: '', monthLabel: '', monthExpense: 0, monthIncome: 0, monthBalance: 0,
    expenseText: '0.00', incomeText: '0.00', balanceText: '0.00',
    persons: [{ key: 'male', name: '他' }, { key: 'female', name: '她' }], person: 'male',
    loading: false, importing: false
  },
  onLoad() {
    const t = date.todayStr().slice(0, 7);
    this.setData({ month: t, monthLabel: t.replace('-', '年') + '月' });
  },
  onShow() { this.loadMonth(); },
  loadMonth() {
    const that = this;
    this.setData({ loading: true });
    const from = this.data.month + '-01';
    const to = this.data.month + '-31';
    cloudsync.billList(from, to).then(function (list) {
      const bills = list.map(function (b) {
        // 规范化：云端返回 _id；统一暴露 id 供前端使用（删除/编辑依赖它）
        return Object.assign({}, b, { id: b._id || b.id, money: (b.amount / 100).toFixed(2) });
      });
      const exp = bills.filter(function (b) { return b.type === 'expense'; }).reduce(function (s, b) { return s + b.amount; }, 0);
      const inc = bills.filter(function (b) { return b.type === 'income'; }).reduce(function (s, b) { return s + b.amount; }, 0);
      const bal = inc - exp;
      const f = function (cents) { return (Math.abs(cents) / 100).toFixed(2); };
      that.setData({
        bills: bills, loading: false,
        monthExpense: exp, monthIncome: inc, monthBalance: bal,
        expenseText: f(exp), incomeText: f(inc),
        balanceText: (bal < 0 ? '-' : '') + f(bal)
      });
    }).catch(function () { that.setData({ loading: false }); });
  },
  prevMonth() {
    const cur = this.data.month;
    const d = new Date(cur + '-01'); d.setMonth(d.getMonth() - 1);
    this.setData({ month: d.getFullYear() + '-' + pad(d.getMonth() + 1), monthLabel: (d.getFullYear() + '年' + (d.getMonth() + 1) + '月') });
    this.loadMonth();
  },
  nextMonth() {
    const cur = this.data.month;
    const d = new Date(cur + '-01'); d.setMonth(d.getMonth() + 1);
    this.setData({ month: d.getFullYear() + '-' + pad(d.getMonth() + 1), monthLabel: (d.getFullYear() + '年' + (d.getMonth() + 1) + '月') });
    this.loadMonth();
  },
  pickType(e) { this.setData({ type: e.currentTarget.dataset.t, catCurrent: e.currentTarget.dataset.t === 'income' ? CATS.income : CATS.expense, category: e.currentTarget.dataset.t === 'income' ? 'salary' : 'food' }); },
  pickCat(e) { this.setData({ category: e.currentTarget.dataset.k }); },
  onMoney(e) { this.setData({ money: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },
  pickPerson(e) { this.setData({ person: e.currentTarget.dataset.p }); },
  catName(key) {
    const all = CATS.expense.concat(CATS.income);
    const c = all.find(function (x) { return x.key === key; });
    return c ? c.name : '其他';
  },
  save() {
    const that = this;
    const money = Number(this.data.money);
    if (!(money > 0)) { wx.showToast({ title: '请输入金额', icon: 'none' }); return; }
    const rec = {
      money: money, type: this.data.type, date: date.todayStr(),
      category: this.data.category, note: this.data.note, person: this.data.person
    };
    cloudsync.billAdd(rec).then(function (r) {
      if (r && r.ok) {
        that.setData({ money: '', note: '' });
        wx.showToast({ title: '已记账 ✅', icon: 'success' });
        that.loadMonth();
      } else { wx.showToast({ title: (r && r.err) || '记账失败', icon: 'none' }); }
    }).catch(function () { wx.showToast({ title: '记账失败：请确认 family 云函数已部署', icon: 'none' }); });
  },
  editNote(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showActionSheet({
      itemList: ['修改备注', '删除这笔'],
      success: function (res) {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '修改备注',
            editable: true,
            placeholderText: '新备注',
            success: function (m) {
              if (m.confirm && m.content !== undefined) {
                cloudsync.billUpdate(id, { note: m.content }).then(function () { that.loadMonth(); });
              }
            }
          });
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '删除这笔', content: '确定删除？', confirmText: '删除', confirmColor: '#C23B3B',
            success: function (m) {
              if (m.confirm) {
                cloudsync.billDel(id).then(function (r) {
                  if (r && r.ok) { wx.showToast({ title: '已删除', icon: 'success' }); }
                  else { wx.showToast({ title: (r && r.err) || '删除失败', icon: 'none' }); }
                  that.loadMonth();
                }).catch(function () { wx.showToast({ title: '删除失败', icon: 'none' }); });
              }
            }
          });
        }
      }
    });
  },
  goImport() { wx.navigateTo({ url: '/pages/bills/import' }); }
});
