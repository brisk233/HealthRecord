// V2 生活方式标签体系：人格大方向 + 细分标签 + 习惯推荐包
const MAJORS = [
  { key: 'sport', name: '运动型', icon: '💪', desc: '一天不动浑身难受' },
  { key: 'lazy', name: '懒狗型', icon: '🐶', desc: '能躺着绝不坐着，但想变好' },
  { key: 'foodie', name: '吃货型', icon: '🍜', desc: '不是在吃，就是在想吃什么' },
  { key: 'night', name: '夜猫型', icon: '🌙', desc: '凌晨两点，我的主场' },
  { key: 'study', name: '卷王型', icon: '📚', desc: '学无止境，卷死自己' },
  { key: 'money', name: '搞钱型', icon: '💰', desc: '搞钱使我快乐' },
  { key: 'health', name: '养生型', icon: '🧘', desc: '保温杯里泡枸杞' },
  { key: 'home', name: '宅家型', icon: '🎮', desc: '出门不如在家打游戏' },
  { key: 'social', name: '社牛型', icon: '☕', desc: '朋友遍天下，局局不能少' }
];

const SUBTAGS = {
  sport: ['篮球', '羽毛球', '跑步', '骑行', '游泳', '健身', '瑜伽', '普拉提', '舞蹈', '拳击', '登山', '乒乓球'],
  lazy: ['早睡', '少刷手机', '少熬夜', '按时吃饭', '每周出门一次', '家务打卡'],
  foodie: ['自己做饭', '探店', '咖啡', '烘焙', '健康餐', '外卖避坑'],
  night: ['12点前睡', '睡前不看手机', '早起一杯水', '作息规律'],
  study: ['读书', '背单词', '考证', '写作', '网课', '复盘'],
  money: ['记账', '攒钱', '副业', '理财学习', '不冲动消费'],
  health: ['喝水8杯', '早睡', '泡脚', '八段锦', '冥想', '补剂打卡'],
  home: ['游戏段位', '追番', '拼图', '养宠', '房间整理'],
  social: ['聚会', '桌游', '露营', '演出', '联系老朋友']
};

const HABIT_RECOMMEND = {
  sport: [{ name: '健身30分钟', icon: '🏋️', freq: '每天' }, { name: '跑步3公里', icon: '🏃', freq: '每周3次' }],
  lazy: [{ name: '23:30前睡觉', icon: '😴', freq: '每天' }, { name: '刷手机≤2小时', icon: '📵', freq: '每天' }, { name: '按时吃三餐', icon: '🍚', freq: '每天' }],
  foodie: [{ name: '自己做饭', icon: '🍳', freq: '每周3次' }, { name: '三餐打卡', icon: '🍽️', freq: '每天' }],
  night: [{ name: '0点前睡觉', icon: '🌙', freq: '每天' }, { name: '睡前不碰手机', icon: '📵', freq: '每天' }],
  study: [{ name: '读书30分钟', icon: '📖', freq: '每天' }, { name: '背单词20个', icon: '🔤', freq: '每天' }],
  money: [{ name: '每日记账', icon: '🧾', freq: '每天' }, { name: '不冲动消费', icon: '🛒', freq: '每天' }],
  health: [{ name: '喝水8杯', icon: '💧', freq: '每天' }, { name: '23:30前睡觉', icon: '😴', freq: '每天' }, { name: '泡脚15分钟', icon: '🦶', freq: '每天' }],
  home: [{ name: '游戏≤2小时', icon: '🎮', freq: '每天' }, { name: '房间整理', icon: '🧹', freq: '每周1次' }],
  social: [{ name: '联系一位老朋友', icon: '💬', freq: '每周1次' }, { name: '参加一次活动', icon: '🎉', freq: '每周1次' }]
};

// 通用习惯模板池（删除后可从这里重新选择添加）
const TEMPLATE_HABITS = [
  { name: '早睡', icon: '😴', freq: '每天' },
  { name: '喝水8杯', icon: '💧', freq: '每天' },
  { name: '运动30分钟', icon: '🏃', freq: '每天' },
  { name: '读书30分钟', icon: '📖', freq: '每天' },
  { name: '冥想10分钟', icon: '🧘', freq: '每天' },
  { name: '每日记账', icon: '🧾', freq: '每天' },
  { name: '写日记', icon: '📝', freq: '每天' },
  { name: '拉伸10分钟', icon: '🤸', freq: '每天' },
  { name: '背单词20个', icon: '🔤', freq: '每天' },
  { name: '少刷手机', icon: '📵', freq: '每天' },
  { name: '泡脚15分钟', icon: '🦶', freq: '每天' },
  { name: '自己做饭', icon: '🍳', freq: '每周3次' }
];

// 默认功能模块：选了运动型才默认开启健身，否则默认关闭
function defaultModulesFor(tags) {
  const isSport = (tags || []).some(function (t) { return t.indexOf('运动型') !== -1; });
  return isSport ? ['meals', 'fitness', 'supps'] : ['meals', 'supps'];
}

module.exports = { MAJORS: MAJORS, SUBTAGS: SUBTAGS, HABIT_RECOMMEND: HABIT_RECOMMEND, TEMPLATE_HABITS: TEMPLATE_HABITS, defaultModulesFor: defaultModulesFor };
