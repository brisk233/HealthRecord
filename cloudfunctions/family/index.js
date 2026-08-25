const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 6 位邀请码（去除易混淆字符）
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
async function myFamily(openid) {
  const r = await db.collection('families').where({ members: _.elemMatch({ openid: openid }) }).get();
  return r.data.length ? r.data[0] : null;
}

// 首次运行时自动创建集合（免手动建库）
async function ensureCollections() {
  const names = ['families', 'checkins', 'suggestions'];
  for (const n of names) {
    try { await db.createCollection(n); } catch (e) { /* 已存在则忽略 */ }
  }
}

exports.main = async (event) => {
  await ensureCollections();
  const { OPENID } = cloud.getWXContext();
  const { action } = event;
  const col = db.collection('families');

  if (action === 'create') {
    const { nickname, avatarUrl, gender, name } = event;
    const mine = await myFamily(OPENID);
    if (mine) return { ok: true, already: true, data: mine };
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      try { await col.doc(code).get(); } catch (e) { break; }
      code = genCode();
    }
    const doc = {
      code: code, name: (name || '我们的家').slice(0, 12), creator: OPENID, createdAt: Date.now(),
      members: [{ openid: OPENID, role: 'creator', relation: '创建者', nickname: nickname || '我', avatarUrl: avatarUrl || '', gender: gender || 'male' }],
      profile: null, fridge: [], updatedAt: Date.now()
    };
    await col.doc(code).set({ data: doc });
    return { ok: true, data: doc };
  }

  if (action === 'join') {
    const { code, relation, nickname, avatarUrl, gender } = event;
    if (!code) return { ok: false, err: '请输入邀请码' };
    const key = String(code).trim().toUpperCase();
    let fam;
    try { const r = await col.doc(key).get(); fam = r.data; }
    catch (e) { return { ok: false, err: '邀请码不存在，检查是否输错' }; }
    if (fam.members.some(function (m) { return m.openid === OPENID; })) return { ok: true, already: true, data: fam };
    if (fam.members.length >= 2) return { ok: false, err: '家庭已满员（2 人）' };
    const member = { openid: OPENID, role: 'partner', relation: relation || '搭子', nickname: nickname || 'TA', avatarUrl: avatarUrl || '', gender: gender || 'male' };
    const members = fam.members.concat([member]);
    await col.doc(key).update({ data: { members: members, updatedAt: Date.now() } });
    fam.members = members;
    return { ok: true, data: fam };
  }

  if (action === 'pull') {
    const fam = await myFamily(OPENID);
    return { ok: true, data: fam };
  }

  if (action === 'push') {
    const { data } = event;
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    const merged = {
      profile: (data && data.profile) || fam.profile,
      fridge: (data && data.fridge) || fam.fridge || [],
      updatedAt: Date.now()
    };
    // 用 _.set 整体替换：档案/冰箱首次从 null 写入对象时，普通 update 会报
    // "Cannot create field 'active' in element {profile: null}" 导致推送失败
    const patch = {
      profile: _.set(merged.profile),
      fridge: _.set(merged.fridge),
      updatedAt: Date.now()
    };
    if (data && 'menuOverride' in data) patch.menuOverride = _.set(data.menuOverride || {});
    await col.doc(fam.code).update({ data: patch });
    return { ok: true };
  }

  if (action === 'info') {
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: true, data: null };
    // 用管理员权限把成员头像 fileID 转成临时链接：绕过存储 ACL，双方都能显示
    const members = await Promise.all((fam.members || []).map(async function (m) {
      if (m.avatarUrl && m.avatarUrl.indexOf('cloud://') === 0) {
        try {
          const res = await cloud.getTempFileURL({ fileList: [m.avatarUrl] });
          const f = res.fileList && res.fileList[0];
          if (f && f.tempFileURL) return Object.assign({}, m, { avatarUrl: f.tempFileURL });
        } catch (e) { /* 转换失败则保持原值 */ }
      }
      return m;
    }));
    const me = fam.members.find(function (m) { return m.openid === OPENID; });
    return { ok: true, data: { code: fam.code, name: fam.name || '我们的家', members: members, myRelation: me ? me.relation : '', myRole: me ? (me.role || '') : '', myGender: me ? (me.gender || 'male') : '', myNickname: me ? (me.nickname || '') : '', myAvatarUrl: me ? (me.avatarUrl || '') : '' } };
  }

  if (action === 'setRelation') {
    const { relation } = event;
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    const members = fam.members.map(function (m) {
      if (m.openid === OPENID) return Object.assign({}, m, { relation: relation || m.relation });
      return m;
    });
    await col.doc(fam.code).update({ data: { members: members, updatedAt: Date.now() } });
    return { ok: true };
  }

  if (action === 'setNickname') {
    const { nickname } = event;
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    const members = fam.members.map(function (m) {
      if (m.openid === OPENID) return Object.assign({}, m, { nickname: nickname || m.nickname });
      return m;
    });
    await col.doc(fam.code).update({ data: { members: members, updatedAt: Date.now() } });
    return { ok: true };
  }

  if (action === 'setAvatar') {
    const { avatarUrl } = event;
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    const members = fam.members.map(function (m) {
      if (m.openid === OPENID) return Object.assign({}, m, { avatarUrl: avatarUrl || '' });
      return m;
    });
    await col.doc(fam.code).update({ data: { members: members, updatedAt: Date.now() } });
    return { ok: true };
  }

  if (action === 'leave') {
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    const me = fam.members.find(function (m) { return m.openid === OPENID; });
    if (me && me.role === 'creator') {
      await col.doc(fam.code).remove(); // 创建者退出 = 解散家庭
    } else {
      const members = fam.members.filter(function (m) { return m.openid !== OPENID; });
      await col.doc(fam.code).update({ data: { members: members, updatedAt: Date.now() } });
    }
    return { ok: true };
  }

  if (action === 'setName') {
    const { name } = event;
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    await col.doc(fam.code).update({ data: { name: (name || '我们的家').slice(0, 12), updatedAt: Date.now() } });
    return { ok: true };
  }

  if (action === 'setGender') {
    const { gender } = event;
    const fam = await myFamily(OPENID);
    if (!fam) return { ok: false, err: '尚未加入家庭' };
    const members = fam.members.map(function (m) {
      if (m.openid === OPENID) return Object.assign({}, m, { gender: gender || m.gender });
      return m;
    });
    await col.doc(fam.code).update({ data: { members: members, updatedAt: Date.now() } });
    return { ok: true };
  }

  if (action === 'suggestAdd') {
    const { text, images } = event;
    const fam = await myFamily(OPENID);
    const member = fam && fam.members.find(function (m) { return m.openid === OPENID; });
    const content = String(text || '').trim().slice(0, 500);
    const imgs = Array.isArray(images) ? images.filter(function (x) { return typeof x === 'string' && x; }).slice(0, 3) : [];
    if (!content && !imgs.length) return { ok: false, err: '请填写建议或添加图片' };
    await db.collection('suggestions').add({
      data: {
        openid: OPENID,
        nickname: (member && member.nickname) || '我',
        gender: (member && member.gender) || 'male',
        text: content,
        images: imgs,
        code: fam ? fam.code : '',
        createdAt: Date.now(),
        status: 'new'
      }
    });
    return { ok: true };
  }

  if (action === 'suggestList') {
    const fam = await myFamily(OPENID);
    const r = await db.collection('suggestions').orderBy('createdAt', 'desc').limit(100).get();
    // 家庭模式只看本家庭建议；单人模式只看自己提交的建议
    const mine = fam ? r.data.filter(function (s) { return s.code === fam.code; }) : r.data.filter(function (s) { return s.openid === OPENID; });
    const list = await Promise.all(mine.map(async function (s) {
      const imgs = s.images || [];
      let images = imgs;
      if (imgs.length) {
        try {
          const res = await cloud.getTempFileURL({ fileList: imgs });
          const map = {};
          (res.fileList || []).forEach(function (f) { map[f.fileID] = f.tempFileURL || f.fileID; });
          images = imgs.map(function (id) { return map[id] || id; });
        } catch (e) { /* 转链失败则保留原 fileID */ }
      }
      return {
        id: s._id, nickname: s.nickname || '我', gender: s.gender || 'male',
        text: s.text || '', images: images, createdAt: s.createdAt || 0, status: s.status || 'new'
      };
    }));
    return { ok: true, data: list };
  }

  return { ok: false, err: '未知 action' };
};
