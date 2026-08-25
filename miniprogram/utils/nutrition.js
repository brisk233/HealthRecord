// 每日目标速算（可后续细化）
function isMale(p) {
  return p.key === 'male' || p.gender === 'male';
}
function proteinTarget(p) {
  const male = isMale(p);
  let rate = 1.5;
  if (p.goal === '增肌') rate = male ? 1.8 : 1.5;
  if (p.goal === '减脂') rate = male ? 2.0 : 1.6;
  if (p.goal === '塑形') rate = male ? 1.5 : 1.2;
  return Math.round(p.weight * rate);
}
function calorieTarget(p) {
  const base = isMale(p) ? 30 : 26;
  const adjust = p.goal === '增肌' ? 200 : p.goal === '减脂' ? -300 : 0;
  return Math.round(p.weight * base + adjust);
}
module.exports = { proteinTarget: proteinTarget, calorieTarget: calorieTarget };
