// 掌中决 · 扩展玩法（寻物 / 走向）—— 自用模块
//
// ⚠️ 本文件【不进入上架版本】
//    上架构建时通过 project.config.json 的 packOptions.ignore 将本文件与
//    pages/zzj/lost.*  pages/zzj/future.* 一并排除出包（物理不打包，不是运行时隐藏）。
//    详见 docs/掌中决-实现规范.md「双构建架构」一节。
//
// 说明：本模块使用传统术数素材（断辞、方位、应期），在微信平台属高风险内容，
//       仅限本机自用。请勿在开启本模块的情况下提交审核。

var zzj = require('./zhangzhongjue.js');

var EXCLUDED_FROM_PUBLISH = true;

// ── 寻物 ──────────────────────────────────────────────
// dir 为主方位，dirAlt 为异说（同一宫在不同资料中最多出现 3 个方位，此处只列主方位 + 主要异说）
var LOST = {
  wen: {
    dir: '东方 / 家中', dirAlt: '', timing: '1 – 7 日',
    verse: '失物去不远，宅舍保安康',
    read: '东西没走远，多半还在家里。先翻你自己最常待的那几个位置，别急着扩大范围。'
  },
  chan: {
    dir: '南方', dirAlt: '异说：北方', timing: '2 – 3 个月',
    verse: '失物南方见，急讨方称心',
    read: '可能是被人顺手收起来了，或者压在别的杂物下面。越急着找越找不到，隔一天换个时间段再找。'
  },
  kuai: {
    dir: '南方 / 西南（申未午）', dirAlt: '', timing: '3 日内',
    verse: '失物申未午，逢人路上寻',
    read: '多半是在外面、路上或公共场合丢的。问人比找有用——问一下店员、前台、同行的人。'
  },
  zheng: {
    dir: '西方', dirAlt: '', timing: '1 个月以上',
    verse: '失物急去寻',
    read: '这件事可能牵扯到别人。直接去问比到处翻更有效，但注意别为这事起争执。'
  },
  he: {
    dir: '坤方 · 西南', dirAlt: '异说：东北', timing: '5 – 7 日',
    verse: '失物在坤方',
    read: '往有女性长辈的地方找，或者和吃穿、收纳有关的位置（厨房、衣柜、储物柜）。也可能有人帮你找到。'
  },
  kong: {
    dir: '难寻', dirAlt: '', timing: '3 个月以上',
    verse: '失物寻不见',
    read: '找回的可能性偏低。与其反复翻找，不如评估一下补办或重买的成本，把注意力收回来。'
  }
};

// ── 走向 ──────────────────────────────────────────────
// 三宫结构：起（起因）→ 中（经过）→ 果（结果）
// 采用「天盘 / 地盘 / 人盘 = 起因 / 经过 / 结果」的常见三宫断法
var FUTURE = {
  wen: {
    tone: '稳',
    start: '起点是平稳的，本来没什么问题，是后来才起的念头。',
    mid:   '过程平稳推进，没有大的波折，也没人特别推它。',
    end:   '结果大概率维持原样。不会有明显变化，也不会有惊喜。'
  },
  chan: {
    tone: '缠',
    start: '起点就带着犹豫——当时并没有真正下决心，只是先拖着。',
    mid:   '过程反复，中间已经绕了几圈，还是没定下来。',
    end:   '结果一时半会儿出不来，还会继续拖。越催越缠。'
  },
  kuai: {
    tone: '快',
    start: '起点很突然，是临时起意，或者被动卷进去的。',
    mid:   '过程推进很快，节奏一旦起来就压不住。',
    end:   '结果很快就见分晓，宜早做准备，别等临头。'
  },
  zheng: {
    tone: '争',
    start: '起点就存在分歧，各方意见从一开始就不一致。',
    mid:   '过程中出现争执或立场冲突，有人不肯让。',
    end:   '结果取决于分歧怎么处理——谈得拢就顺，谈不拢就僵。'
  },
  he: {
    tone: '合',
    start: '起点有助力，是别人带来的机会，不是你硬找的。',
    mid:   '过程中有人帮忙，事情被外部力量推着往前走。',
    end:   '结果偏向和合，容易达成一致，是个可以往前走的局面。'
  },
  kong: {
    tone: '空',
    start: '起点信息就不足，一开始就没看清全貌。',
    mid:   '过程中出现空转，做了不少无用功，热闹但不落地。',
    end:   '结果可能落空，预期需要下调。先别投入更多。'
  }
};

// 经验应期（速喜受生减、其余受生加等细则流派不一，此处只给区间）
var TIMING = {
  wen: '1 – 7 日', chan: '2 – 3 个月', kuai: '3 日内',
  zheng: '1 个月以上', he: '5 – 7 日', kong: '3 个月以上'
};

function lostOf(idx) {
  var p = zzj.palace(idx);
  var d = LOST[p.key];
  return {
    trad: p.trad, tone: p.tone,
    dir: d.dir, dirAlt: d.dirAlt, timing: d.timing,
    verse: d.verse, read: d.read
  };
}

function futureOf(a, b, c) {
  var pa = zzj.palace(a), pb = zzj.palace(b), pc = zzj.palace(c);
  return {
    stages: [
      { name: '起', trad: pa.trad, tone: pa.tone, text: FUTURE[pa.key].start },
      { name: '中', trad: pb.trad, tone: pb.tone, text: FUTURE[pb.key].mid },
      { name: '果', trad: pc.trad, tone: pc.tone, text: FUTURE[pc.key].end }
    ],
    timing: TIMING[pc.key]
  };
}

module.exports = {
  EXCLUDED_FROM_PUBLISH: EXCLUDED_FROM_PUBLISH,
  LOST: LOST,
  FUTURE: FUTURE,
  TIMING: TIMING,
  lostOf: lostOf,
  futureOf: futureOf
};
