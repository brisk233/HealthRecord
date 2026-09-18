const zzj = require('../../data/zhangzhongjue.js');

Page({
  data: { palaces: [], intro: '' },
  onLoad() {
    const palaces = zzj.PALACES.map(function (p) {
      return {
        key: p.key, tone: p.tone, trad: p.trad, tagline: p.tagline,
        element: p.sci.element, dir: p.sci.dir, color: p.sci.color,
        god: p.sci.god, nums: p.sci.nums
      };
    });
    this.setData({
      palaces: palaces,
      intro: '小六壬是流传于民间的一种掌上推演方法，把六个位置安放在左手食指、中指、无名指的三节指节上，按顺序循环。它定型于明代，过去的通俗读本里已经出现过今天这六个名字。\n\n需要说明的是：常听到的「李淳风所创」「诸葛亮马前课」都是后人的托名，并不可考。它和式法类的「大六壬」也没有术理上的关系，只是借了名字。'
    });
  }
});
