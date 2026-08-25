const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection() {
  try { await db.createCollection('checkins'); } catch (e) { /* 已存在 */ }
}

exports.main = async (event) => {
  await ensureCollection();
  const { action, homeCode, person, date, supps, train, custom, meals, habits } = event;
  if (!homeCode) return { ok: false, err: '缺少家庭码' };
  const col = db.collection('checkins');

  if (action === 'pull') {
    const res = await col.where({ homeCode: homeCode, date: date }).get();
    return { ok: true, list: res.data };
  }

  if (action === 'push') {
    const docId = homeCode + '_' + person + '_' + date;
    await col.doc(docId).set({
      data: { homeCode: homeCode, person: person, date: date, supps: supps || {}, train: !!train, custom: custom || null, meals: meals || null, habits: habits || null, updatedAt: Date.now() }
    });
    return { ok: true };
  }

  return { ok: false, err: '未知 action' };
};
