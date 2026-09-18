// 掌中决 · 核心数据与算法（合规内核 / 上架版本）
//
// 定位：决策辅助工具。抽取结果用于帮你换个角度看问题，不构成对未来的判断。
// 合规：本文件属于「上架版本」，严禁出现敏感词（完整清单见规范文档，勿在本行罗列）。
//       词汇规则见 docs/掌中决-实现规范.md §1.2
//       校验：node tests/check-banned-words.js
//
// 六宫循环顺序固定：稳 → 缠 → 快 → 争 → 合 → 空 → (回稳)
// 功能层只暴露 tone（情境词）+ trad（传统名）+ tagline
// 五行/方位/六神/数字属传统文化标记，下沉到科普层（pages/zzj/knowledge）

var N = 6;

// ── 六宫 ──────────────────────────────────────────────
var PALACES = [
  {
    key: 'wen', trad: '大安', tone: '稳', tagline: '维持现状，按原计划走',
    why: '这件事处在「稳」的格局——没有必须改变的理由。你之所以纠结，多半只是因为两个选项看起来差不多。',
    next: '选你原本就倾向的那个，别再比了。',
    // 科普层属性
    sci: { element: '木', dir: '东', color: '青', god: '青龙', nums: '1、5、7' }
  },
  {
    key: 'chan', trad: '留连', tone: '缠', tagline: '有反复，先找卡点，别硬推',
    why: '这件事处在「缠」的格局——它已经拖了不止一天。反复权衡通常不是因为你缺决心，而是有个信息你还没拿到。',
    next: '把「选哪个」换成「我还需要知道什么」，然后去问。',
    sci: { element: '水（异说四隅土）', dir: '北（异说南）', color: '黑', god: '玄武（异说腾蛇）', nums: '2、8、10' }
  },
  {
    key: 'kuai', trad: '速喜', tone: '快', tagline: '时机是热的，趁现在',
    why: '这件事处在「快」的格局——时机是热的，越权衡越凉。两个选项你都还行，说明这不是需要想清楚的题，是需要拍板的题。',
    next: '现在定，定完不改。',
    sci: { element: '火', dir: '南', color: '赤', god: '朱雀', nums: '3、6、9' }
  },
  {
    key: 'zheng', trad: '赤口', tone: '争', tagline: '有分歧，把话说开再动',
    why: '这件事处在「争」的格局——它牵扯到别人的意见，或者你自己心里有两套标准在打架。',
    next: '先把分歧点说出口，再选。别在心里比。',
    sci: { element: '金', dir: '西', color: '白', god: '白虎', nums: '4、7、10' }
  },
  {
    key: 'he', trad: '小吉', tone: '合', tagline: '有助力，适合商量、找人帮忙',
    why: '这件事处在「合」的格局——它是那种「问一下别人会更清楚」的事。你一个人想不出来，不是因为你不会想。',
    next: '找最相关的那个人聊 5 分钟。',
    sci: { element: '木（异说水）', dir: '坤方·西南', color: '黄', god: '六合', nums: '1、5、7' }
  },
  {
    key: 'kong', trad: '空亡', tone: '空', tagline: '信息不足，先补齐再说',
    why: '这件事处在「空」的格局——不是选不出来，是线索还不够。硬选只会更烦。',
    next: '先补一个信息，明天再定。今天不定，也是一个决定。',
    sci: { element: '土', dir: '西南（异说中）', color: '黄', god: '勾陈', nums: '3、6、9' }
  }
];

// 结果页常驻说明（诚实的产品说明，不是免责声明）
var DISCLAIMER = '这是一次随机提示，帮你换个角度看问题，不构成对未来的判断。';

// 预设决策场景
var SCENES = [
  { key: 'eat',   label: '今天吃什么', icon: '🍚' },
  { key: 'chore', label: '谁做家务',   icon: '🧹' },
  { key: 'trip',  label: '周末去哪',   icon: '🚗' },
  { key: 'buy',   label: '买不买',     icon: '🛒' },
  { key: 'custom', label: '其他',      icon: '✏️' }
];

// 场景预置选项：让用户直接点选，不用自己输入
// （自定义场景不给预置，保留手写入口）
var PRESETS = {
  eat: ['火锅', '日料', '家常炒菜', '面食 / 饺子', '楼下随便吃点', '轻食沙拉'],
  chore: ['我来做', '你来做', '一起做', '用洗碗机 / 扫地机', '今天先不做', '叫保洁'],
  trip: ['在家休息', '逛商场', '公园散步', '近郊一日游', '找朋友聚', '看展 / 电影'],
  buy: ['买', '先不买', '等降价', '买便宜那款', '先用现有的凑合', '再对比两天'],
  custom: []
};

// ── 算法 ──────────────────────────────────────────────
function mod6(v) { return ((v % N) + N) % N; }

// 报数抽取。流派①「依次传递」（易德轩系）：第 2、3 个数从上次落宫起数。
// 说明：另一流派「各自起于大安」结果不同；本项目采用流派①，
//       与「月上起日、日上起时」的传递逻辑一致。改流派需同步改测试。
function pickByNumbers(n1, n2, n3) {
  var a = mod6(toInt(n1) - 1);
  var b = mod6(a + toInt(n2) - 1);
  var c = mod6(b + toInt(n3) - 1);
  return { first: a, second: b, result: c };
}

// 摇一摇 / 随机抽取：本地随机，无需服务端
function pickRandom(rand) {
  var r = typeof rand === 'function' ? rand : Math.random;
  var num = function () { return Math.floor(r() * 999) + 1; };
  return pickByNumbers(num(), num(), num());
}

// 传统月日时算法（v1 界面不使用，保留供科普与回归测试）
// 月宫 = (M-1) mod 6 ；日宫 = (M+D-2) mod 6 ；时宫 = (M+D+H-3) mod 6
// M 农历月 1-12，D 农历日 1-30，H 时辰序号 子=1 … 亥=12
// 已验证：《玉匣记》例「三月初五辰时」→ 小吉(4)
// 注意：网上流传的「(月+日+时) mod 6，余0当6」是错的，同一输入会得不同结果。
function byLunarDate(m, d, h) {
  var M = toInt(m), D = toInt(d), H = toInt(h);
  return {
    month: mod6(M - 1),
    day: mod6(M + D - 2),
    hour: mod6(M + D + H - 3)
  };
}

function toInt(v) {
  var n = parseInt(v, 10);
  return isNaN(n) ? 1 : n;
}

function palace(i) { return PALACES[mod6(i)]; }

// 组装结果对象（页面直接渲染，避免在 WXML 里做计算）
function buildResult(idx) {
  var p = palace(idx);
  return {
    key: p.key, trad: p.trad, tone: p.tone, tagline: p.tagline,
    why: p.why, next: p.next, disclaimer: DISCLAIMER
  };
}

// ── 掌诀图 ────────────────────────────────────────────
// 视觉排布：食指 / 中指 / 无名指 × 指根 / 指尖，顺时针一圈
// 值对应 PALACES 索引（稳0 缠1 快2 争3 合4 空5）
var PALM_LAYOUT = [1, 2, 3, 0, 5, 4];

// 返回掌诀图渲染数据（预计算 on 标志，WXML 不做判断）
function palmGrid(active) {
  return PALM_LAYOUT.map(function (pi) {
    var p = PALACES[pi];
    return { idx: pi, tone: p.tone, trad: p.trad, on: pi === active };
  });
}

// ── 落宫动画帧序列 ────────────────────────────────────
// 三段式：数第一数 → 数第二数 → 落宫，贴合真实掐指的计数过程。
// 每段至少绕一圈，保证落点必然正确。
function buildFrames(pick) {
  var frames = [];
  var pass = function (start, target, base, ease, label) {
    var dist = mod6(target - start);
    var total = 6 + dist;
    for (var i = 1; i <= total; i++) {
      var t = i / total;
      // 最后一段逐步放慢，制造「落定」感
      var delay = ease ? base + Math.round(t * t * 140) : base;
      frames.push({ idx: mod6(start + i), delay: delay, label: label });
    }
  };
  pass(0, pick.first, 65, false, '数第一数…');
  pass(pick.first, pick.second, 65, false, '数第二数…');
  pass(pick.second, pick.result, 60, true, '落宫…');
  return frames;
}

module.exports = {
  N: N,
  PALACES: PALACES,
  PALM_LAYOUT: PALM_LAYOUT,
  palmGrid: palmGrid,
  buildFrames: buildFrames,
  SCENES: SCENES,
  PRESETS: PRESETS,
  DISCLAIMER: DISCLAIMER,
  mod6: mod6,
  palace: palace,
  pickByNumbers: pickByNumbers,
  pickRandom: pickRandom,
  byLunarDate: byLunarDate,
  buildResult: buildResult
};
