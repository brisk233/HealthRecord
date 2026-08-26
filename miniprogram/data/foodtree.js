// 食材树（v3）：大类 → 子类 → 食材；叶子 { name, cat, box }
// cat 为保质期分类（shelflife.RULES key）；box 为默认储存位置（入库自动带出，可改）
// 注意：name 需与菜谱库 recipes.js 的主料/配菜名兼容（fridgeHas 用包含匹配）
// 菜谱引擎识别名（勿改）：牛腩/吊龙/猪肉/鲈鱼/基围虾/虾仁/鸡蛋/西兰花/辣椒/胡萝卜/叶子菜/番茄

// 子类 → 默认 box（沿用 seed 盒体系：冷藏盒/冷冻盒/冷冻袋/冷藏格等）
const BOX_BY_SUBTREE = {
  beef: '冷冻盒①', pork: '冷冻盒①', chicken: '冷冻盒①', duckgoose: '冷冻盒①', lamb: '冷冻盒①',
  fish: '冷冻袋①', shrimp: '冷冻盒①', crab: '冷冻盒②',
  egg: '冷藏格', dairy: '冷藏格', bean: '冷藏盒②',
  leaf: '冷藏盒①', root: '冷藏盒②', fruitveg: '冷藏盒②', flower: '冷藏盒③', cornbean: '冷藏盒②',
  arom: '调料区', condiment: '调料区', oil: '调料区', other: '储物柜'
};

function makeTree() {
  const raw = [
    {
      key: 'meat', name: '🥩 肉类',
      children: [
        { key: 'beef', name: '牛肉', items: ['牛腩', '吊龙', '牛肉片', '牛腱子', '牛里脊', '牛排骨', '牛尾', '肥牛卷'].map(function (n) { return { name: n, cat: n === '牛肉片' ? 'marinated' : 'rawFrozen' }; }) },
        { key: 'pork', name: '猪肉', items: ['猪肉', '猪瘦肉', '排骨', '五花肉', '猪里脊', '猪蹄', '猪肝', '肉末'].map(function (n) { return { name: n, cat: 'rawFrozen' }; }).concat([{ name: '香肠', cat: 'cookedFrozen' }]) },
        { key: 'chicken', name: '鸡肉', items: ['鸡胸肉', '鸡腿肉', '整鸡', '鸡翅', '鸡爪', '鸡胗', '鸡排'].map(function (n) { return { name: n, cat: 'rawFrozen' }; }) },
        { key: 'duckgoose', name: '鸭鹅及其他', items: ['鸭肉', '鸭腿', '鸭翅', '鹅肉', '鸽子'].map(function (n) { return { name: n, cat: 'rawFrozen' }; }) },
        { key: 'lamb', name: '羊肉', items: ['羊肉', '羊排', '羊蝎子', '羊肉卷'].map(function (n) { return { name: n, cat: 'rawFrozen' }; }) }
      ]
    },
    {
      key: 'seafood', name: '🐟 鱼虾海鲜',
      children: [
        { key: 'fish', name: '鱼类', items: ['鲈鱼', '草鱼', '带鱼', '鲫鱼', '鲳鱼', '鳕鱼', '三文鱼', '黄花鱼'].map(function (n) { return { name: n, cat: 'rawFrozen' }; }) },
        { key: 'shrimp', name: '虾类', items: ['基围虾', '虾仁', '白虾', '小龙虾'].map(function (n) { return { name: n, cat: n === '虾仁' ? 'marinated' : 'rawFrozen' }; }) },
        { key: 'crab', name: '蟹贝类', items: ['螃蟹', '蟹肉棒', '扇贝', '花蛤', '蛏子', '鱿鱼', '墨鱼'].map(function (n) { return { name: n, cat: n === '蟹肉棒' ? 'cookedFrozen' : 'rawFrozen' }; }) }
      ]
    },
    {
      key: 'eggdairy', name: '🥚 蛋奶豆',
      children: [
        { key: 'egg', name: '蛋类', items: ['鸡蛋', '咸鸭蛋', '皮蛋', '鹌鹑蛋'].map(function (n) { return { name: n, cat: n === '鸡蛋' ? 'eggRaw' : 'other' }; }) },
        { key: 'dairy', name: '奶类', items: ['牛奶', '酸奶', '奶酪', '黄油'].map(function (n) { return { name: n, cat: 'other' }; }) },
        { key: 'bean', name: '豆制品', items: ['豆腐', '香干', '腐竹', '豆皮', '豆浆'].map(function (n) { return { name: n, cat: 'other' }; }) }
      ]
    },
    {
      key: 'veggie', name: '🥬 蔬菜',
      children: [
        { key: 'leaf', name: '叶菜类', items: ['叶子菜', '菠菜', '生菜', '油麦菜', '空心菜', '小白菜', '芹菜', '韭菜'].map(function (n) { return { name: n, cat: 'leaf' }; }) },
        { key: 'root', name: '根茎类', items: ['胡萝卜', '土豆', '洋葱', '白萝卜', '莲藕', '山药', '红薯', '芋头'].map(function (n) { return { name: n, cat: 'veggie' }; }) },
        { key: 'fruitveg', name: '瓜茄类', items: ['番茄', '辣椒', '青椒', '黄瓜', '茄子', '冬瓜', '南瓜', '丝瓜', '苦瓜'].map(function (n) { return { name: n, cat: 'veggie' }; }) },
        { key: 'flower', name: '花菜菌菇类', items: ['西兰花', '花菜', '包菜'].map(function (n) { return { name: n, cat: n === '西兰花' ? 'broccoli' : 'veggie' }; }).concat(['蘑菇', '香菇', '金针菇', '杏鲍菇', '木耳'].map(function (n) { return { name: n, cat: 'other' }; })) },
        { key: 'cornbean', name: '玉米豆类', items: ['玉米', '豌豆', '毛豆', '豆角'].map(function (n) { return { name: n, cat: 'veggie' }; }) }
      ]
    },
    {
      key: 'seasoning', name: '🧄 调味及其他',
      children: [
        { key: 'arom', name: '香辛料', items: ['姜/蒜/葱', '大蒜', '小葱', '姜', '香菜', '干辣椒', '花椒', '八角', '桂皮', '香叶', '孜然', '白胡椒', '黑胡椒', '咖喱'].map(function (n) { return { name: n, cat: 'other' }; }) },
        { key: 'sauce', name: '酱料', items: ['生抽', '老抽', '蚝油', '料酒', '豆瓣酱', '番茄酱', '醋', '辣椒酱', '黄豆酱', '芝麻酱', '豆豉', '腐乳', '泡椒'].map(function (n) { return { name: n, cat: 'other' }; }) },
        { key: 'oil', name: '油盐糖', items: ['食用油', '香油', '辣椒油', '盐', '白糖', '冰糖', '鸡精', '淀粉'].map(function (n) { return { name: n, cat: 'other' }; }) },
        { key: 'other', name: '其他囤货', items: ['干货', '面条', '方便面', '米', '面粉', '粉条'].map(function (n) { return { name: n, cat: 'other' }; }) }
      ]
    }
  ];
  // 统一附加 box
  raw.forEach(function (l1) {
    l1.children.forEach(function (l2) {
      l2.items.forEach(function (it) { it.box = BOX_BY_SUBTREE[l2.key] || '冷藏盒②'; });
    });
  });
  return raw;
}

module.exports = makeTree();
