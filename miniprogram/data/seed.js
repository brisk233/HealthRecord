// 真实档案（已录入）
const date = require('../utils/date.js');

const defaultProfile = {
  active: 'male', // 当前展示的人
  male: {
    key: 'male', name: '他', height: 172, weight: 62, goal: '增肌',
    work: '9:30 - 18:30', sleep: '23:00', tasteLevel: '清淡', favs: ['吊龙', '牛腩', '基围虾'], favHidden: [],
    supps: [
      { key: 'fishOil', name: '鱼油', dose: '1粒', time: '随晚餐' },
      { key: 'vitaminD', name: '维生素D', dose: '1粒', time: '随脂餐' },
      { key: 'zinc', name: '锌', dose: '1粒', time: '随餐' }
    ],
    suppEnabled: true,
    tags: [], subTags: [], habits: [], modules: ['meals', 'fitness', 'supps']
  },
  female: {
    key: 'female', name: '她', height: 166, weight: 52, goal: '塑形',
    work: '9:00 - 17:00', sleep: '23:00', tasteLevel: '清淡', favs: ['鲈鱼', '基围虾', '西兰花', '叶子菜', '鸡蛋'], favHidden: [],
    supps: [
      { key: 'fishOil', name: '鱼油', dose: '1粒', time: '随晚餐' },
      { key: 'iron', name: '铁', dose: '按产品说明', time: '随餐(配维C吸收更好)' }
    ],
    suppEnabled: true,
    tags: [], subTags: [], habits: [], modules: ['meals', 'fitness', 'supps']
  }
};

function buildDefaultFridge() {
  const t = date.todayStr();
  return [
    { id: 'f1', name: '牛腩(炖好分装)', cat: 'cookedFrozen', box: '冷冻盒①~③', purchased: date.addDays(t, -3), note: '周一周四晚餐' },
    { id: 'f2', name: '吊龙(腌好切片)', cat: 'marinated', box: '冷藏盒①', purchased: t, note: '周二炒' },
    { id: 'f3', name: '西兰花(焯水)', cat: 'broccoli', box: '冷藏盒A~E', purchased: t, note: '' },
    { id: 'f4', name: '叶子菜(洗切)', cat: 'leaf', box: '冷藏盒①~③', purchased: t, note: '前2天吃完' },
    { id: 'f5', name: '鲈鱼(清理腌好)', cat: 'rawFrozen', box: '冷冻袋①', purchased: date.addDays(t, -1), note: '清蒸' },
    { id: 'f6', name: '虾仁(去壳)', cat: 'rawFrozen', box: '冷冻盒①', purchased: date.addDays(t, -1), note: '周五滑蛋' },
    { id: 'f7', name: '水煮蛋', cat: 'egg', box: '冷藏格', purchased: date.addDays(t, -1), note: '早餐' },
    { id: 'f8', name: '猪肉(切丝/片)', cat: 'rawFrozen', box: '冷冻盒①', purchased: date.addDays(t, -2), note: '辣椒炒肉/胡萝卜炒肉丝' }
  ];
}

module.exports = { defaultProfile: defaultProfile, buildDefaultFridge: buildDefaultFridge };
