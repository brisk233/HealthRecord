function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayStr() { return fmt(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return fmt(d);
}
function weekdayZh(dateStr) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(dateStr).getDay()];
}
function daysBetween(aStr, bStr) {
  const a = new Date(aStr), b = new Date(bStr);
  return Math.round((b - a) / 86400000);
}
module.exports = { fmt: fmt, todayStr: todayStr, addDays: addDays, weekdayZh: weekdayZh, daysBetween: daysBetween };
