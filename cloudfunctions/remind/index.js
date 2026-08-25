const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 订阅消息模板：日程提醒（活动名称 / 开始时间 / 温馨提示 / 详情）
const TEMPLATE_ID = 'yIuWV0vMu8mt7CPR1OREuDEaV9Q-u-Qa8ITkGw1OOwI';
const RULES = { leaf: 2, broccoli: 3, marinated: 2, veggie: 3, cookedCold: 3, egg: 5, eggRaw: 15, cookedFrozen: 14, rawFrozen: 30, other: 7 };

function daysLeft(item) {
  if (!item.purchased) return 99;
  const days = RULES[item.cat] || 3;
  const from = new Date(item.purchased + 'T00:00:00');
  const passed = Math.floor((Date.now() - from.getTime()) / 86400000);
  return days - passed;
}

// 北京时间（date 类型字段格式：YYYY年M月D日 HH:mm）
function bjTime() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}

async function ensureCollection() {
  try { await db.createCollection('families'); } catch (e) { /* 已存在 */ }
}

exports.main = async () => {
  await ensureCollection();
  const res = await db.collection('families').limit(100).get();
  let sent = 0;
  for (const home of res.data) {
    const expiring = (home.fridge || []).filter(function (it) { return daysLeft(it) <= 1; });
    if (!expiring.length) continue;
    const names = expiring.map(function (it) { return it.name; }).join('、').slice(0, 20);
    for (const openid of home.members || []) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: TEMPLATE_ID,
          page: 'pages/today/today',
          data: {
            thing1: { value: '临期食材提醒' },          // 活动名称
            date2: { value: bjTime() },                  // 开始时间
            thing3: { value: '建议今天吃掉或冷冻处理' },  // 温馨提示
            thing4: { value: names }                      // 详情
          }
        });
        sent++;
      } catch (e) {
        console.log('发送失败(未订阅或字段不匹配)', e.errMsg || e.message || e);
      }
    }
  }
  return { sent: sent };
};
