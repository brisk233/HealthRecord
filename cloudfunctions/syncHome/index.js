const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action, homeCode, data } = event;
  if (!homeCode) return { ok: false, err: '缺少家庭码' };
  const col = db.collection('homes');

  if (action === 'pull') {
    try {
      const res = await col.doc(homeCode).get();
      return { ok: true, data: res.data };
    } catch (e) {
      return { ok: true, data: null }; // 还没有数据
    }
  }

  if (action === 'push') {
    let base = { homeCode: homeCode, members: [], profile: null, fridge: [], updatedAt: 0 };
    try {
      const res = await col.doc(homeCode).get();
      if (res.data) base = res.data;
    } catch (e) { /* 首次写入 */ }
    const members = base.members || [];
    if (members.indexOf(OPENID) === -1) members.push(OPENID);
    const merged = {
      homeCode: homeCode,
      members: members,
      profile: (data && data.profile) || base.profile,
      fridge: (data && data.fridge) || base.fridge || [],
      updatedAt: Date.now()
    };
    await col.doc(homeCode).set({ data: merged });
    return { ok: true };
  }

  return { ok: false, err: '未知 action' };
};
