// 训练课表 v2：按真实器械配置 + 动作库
const TRAIN_MALE = [
  { title: '背部力量 + 引体', time: '60分钟', exercises: ['引体向上(自重/弹力带辅助) 5×5', '高位下拉 4×10', '坐姿划船 3×12', '杠铃划船 4×8'] },
  { title: '篮球', time: '60-90分钟', detail: '全场/半场对抗，注意热身与拉伸' },
  { title: '腿部', time: '60分钟', exercises: ['哈克深蹲 5×5', '杠铃深蹲 4×8', '腿屈伸(大腿前侧) 4×12', '提踵 4×15'] },
  { title: '休息 + 放松', time: '20分钟', detail: '滚筒放松 + 筋膜球按痛点' },
  { title: '拳击', time: '60分钟', exercises: ['跑步机/跳绳热身 10分钟', '空击组合拳 40分钟', '平板 3×45秒', '悬垂举腿 3×10'] },
  { title: '胸 + 家庭全身', time: '40分钟', exercises: ['蝴蝶机夹胸 4×12', '杠铃卧推 4×8', '俯卧撑 3×12', '弹力带面拉 3×15'] },
  { title: '休息', time: '—', detail: '完全休息，周日复盘与备菜' }
];
const TRAIN_FEMALE = [
  { title: '普拉提·核心塑形(家)', time: '45分钟', detail: '瑜伽垫：百次呼吸 · 卷动 · 单腿伸展 · 臀桥系列' },
  { title: '休息/散步', time: '30分钟', detail: '爬坡机轻松走或散步' },
  { title: '舞蹈课', time: '60分钟', detail: '爵士/尊巴/urban 任选' },
  { title: '臀腿器械(健身房)', time: '45分钟', exercises: ['臀桥机 4×12', '龙门架绳索后踢 3×15', '腿屈伸(轻) 3×12', '哈克深蹲(轻) 3×10'] },
  { title: '家庭普拉提+弹力带', time: '30分钟', exercises: ['弹力带蚌式 3×15', '弹力带臀桥 3×15', '平板 3×45秒'] },
  { title: '舞蹈/有氧', time: '40分钟', detail: '跑步机 + 爬坡机 或 舞蹈跟练视频' },
  { title: '休息/双人拉伸', time: '15分钟', detail: '瑜伽垫 + 滚筒放松，家庭时间' }
];

// 动作库（按真实器械分组）
const EXERCISE_LIB = [
  { group: '背部', where: '健身房', items: [
    { name: '引体向上', set: '5×5（可弹力带辅助）' },
    { name: '高位下拉', set: '4×10' },
    { name: '坐姿划船', set: '3×12' },
    { name: '杠铃划船', set: '4×8' }
  ] },
  { group: '腿部', where: '健身房', items: [
    { name: '哈克深蹲', set: '5×5' },
    { name: '杠铃深蹲', set: '4×8' },
    { name: '腿屈伸', set: '4×12' },
    { name: '提踵', set: '4×15' }
  ] },
  { group: '胸部', where: '健身房', items: [
    { name: '蝴蝶机夹胸', set: '4×12' },
    { name: '杠铃卧推', set: '4×8' },
    { name: '俯卧撑', set: '3×12' }
  ] },
  { group: '核心', where: '健身房/家庭', items: [
    { name: '平板支撑', set: '3×45 秒' },
    { name: '悬垂举腿', set: '3×10' }
  ] },
  { group: '有氧', where: '健身房', items: [
    { name: '跑步机', set: '20-30 分钟' },
    { name: '爬坡机', set: '20-30 分钟' }
  ] },
  { group: '拳击', where: '健身房', items: [
    { name: '跳绳', set: '10 分钟热身' },
    { name: '空击组合', set: '4 组×3 分钟' },
    { name: '沙袋组合', set: '4 组×3 分钟' }
  ] },
  { group: '臀腿(她)', where: '健身房', items: [
    { name: '臀桥机', set: '4×12' },
    { name: '龙门架绳索后踢', set: '3×15' },
    { name: '弹力带蚌式', set: '3×15' }
  ] },
  { group: '普拉提(她)', where: '家庭', items: [
    { name: '百次呼吸', set: '1×100' },
    { name: '卷动', set: '3×8' },
    { name: '单腿伸展', set: '3×10' },
    { name: '臀桥系列', set: '3×15' }
  ] },
  { group: '放松', where: '家庭', items: [
    { name: '滚筒放松', set: '每部位 60 秒' },
    { name: '筋膜球按压', set: '每痛点 30 秒' }
  ] }
];

module.exports = { TRAIN_MALE: TRAIN_MALE, TRAIN_FEMALE: TRAIN_FEMALE, EXERCISE_LIB: EXERCISE_LIB };
