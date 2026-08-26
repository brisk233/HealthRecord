const date = require('./date.js');

const ENV = 'cloudbase-d1glhkgunaf107df5';
const TEMPLATE_ID = 'yIuWV0vMu8mt7CPR1OREuDEaV9Q-u-Qa8ITkGw1OOwI'; // 日程提醒模板

function familyCode() { return wx.getStorageSync('familyCode') || wx.getStorageSync('homeCode') || ''; }
function myGender() { return wx.getStorageSync('myGender') || 'male'; }
function ready() { return !!(wx.cloud && familyCode()); }

function init() {
  if (!wx.cloud) return false;
  try { wx.cloud.init({ env: ENV, traceUser: true }); return true; }
  catch (e) { console.warn('云初始化失败，使用本地模式', e); return false; }
}

function callFamily(extra) {
  return wx.cloud.callFunction({ name: 'family', data: extra }).then(function (r) { return r.result; });
}

// 把云函数调用失败的真实原因翻译成人话
function friendlyCloudErr(e) {
  const msg = (e && (e.errMsg || e.message)) || '';
  if ((e && e.errCode === -501000) || msg.indexOf('FunctionName') !== -1 || msg.indexOf('FUNCTION_NOT_FOUND') !== -1) {
    return 'family 云函数未部署：请到开发者工具左侧 cloudfunctions/family 右键→上传并部署';
  }
  if (msg.indexOf('ENV') !== -1 || msg.indexOf('env not') !== -1) return '云环境异常：请检查云开发环境是否开通';
  if (msg.indexOf('timeout') !== -1) return '请求超时，请重试';
  if (msg.indexOf('fail') !== -1 && msg.indexOf('cloud') !== -1) return '云服务调用失败，请检查网络';
  return msg || '网络错误，请重试';
}

// 微信登录：获取 openid 确认使用人身份
async function login() {
  if (!wx.cloud) return null;
  try {
    const r = await wx.cloud.callFunction({ name: 'login' });
    return r.result || null;
  } catch (e) { console.warn('login 失败', e); return null; }
}

async function createFamily(nickname, avatarUrl, gender, name) {
  if (!wx.cloud) return { ok: false, err: '云不可用，请检查网络' };
  try {
    const res = await callFamily({ action: 'create', nickname: nickname, avatarUrl: avatarUrl || '', gender: gender || myGender(), name: name || '我们的家' });
    if (res && res.ok && res.data) {
      wx.setStorageSync('familyCode', res.data.code);
      pushHome({ profile: getApp().globalData.profile, fridge: getApp().globalData.fridge });
    }
    return res;
  } catch (e) { return { ok: false, err: friendlyCloudErr(e) }; }
}

async function joinFamily(code, relation, nickname, avatarUrl, gender) {
  if (!wx.cloud) return { ok: false, err: '云不可用，请检查网络' };
  try {
    const res = await callFamily({ action: 'join', code: code, relation: relation, nickname: nickname, avatarUrl: avatarUrl || '', gender: gender || myGender() });
    if (res && res.ok && res.data) {
      wx.setStorageSync('familyCode', res.data.code);
      // 先拉取现有家庭数据（避免用本地默认数据覆盖），再推送合并
      const home = await pullHome();
      if (home && home.profile) { getApp().globalData.profile = home.profile; wx.setStorageSync('profile', home.profile); }
      if (home && home.fridge) { getApp().globalData.fridge = home.fridge; wx.setStorageSync('fridge', home.fridge); }
      pushHome({ profile: getApp().globalData.profile, fridge: getApp().globalData.fridge });
    }
    return res;
  } catch (e) { return { ok: false, err: friendlyCloudErr(e) }; }
}

async function setRelation(relation) {
  if (!ready()) return;
  try { await callFamily({ action: 'setRelation', relation: relation }); } catch (e) { console.warn('setRelation 失败', e); }
}

// 档案字段级合并：云端有值的字段以云端为准，云端缺失的新字段（modules/habits/favs 等）保留本地
function mergeProfile(local, remote) {
  if (!remote) return local;
  const out = { active: (local && local.active) || 'male' };
  // 保留档案根级字段（如健身课表排序 trainOrder），避免合并时被丢弃
  if (local) Object.keys(local).forEach(function (k) {
    if (k !== 'male' && k !== 'female' && !(k in out)) out[k] = local[k];
  });
  if (remote) Object.keys(remote).forEach(function (k) {
    if (k !== 'male' && k !== 'female' && !(k in out)) out[k] = remote[k];
  });
  const ARR_GUARD = ['habits', 'favs', 'modules', 'favHidden', 'tags', 'subTags'];
  function guardArrays(l, r, merged) {
    ARR_GUARD.forEach(function (arrKey) {
      const lArr = l[arrKey];
      const rArr = r[arrKey];
      if (Array.isArray(rArr) && Array.isArray(lArr) && rArr.length === 0 && lArr.length > 0) merged[arrKey] = lArr;
    });
  }
  ['male', 'female'].forEach(function (k) {
    const l = (local && local[k]) || {};
    const r = remote[k] || {};
    const remoteNewer = (r._t || 0) > (l._t || 0);
    let merged;
    if (remoteNewer) {
      // 云端确实更新 → 云端为主（保留空数组守卫）
      merged = Object.assign({}, l, r);
      guardArrays(l, r, merged);
    } else {
      // 本地更新/无时间戳 → 本地为主，云端只补本地缺失的字段（旧云端无法回退本地新改动）
      merged = Object.assign({}, l);
      // 退出登录后本机是默认档案（无 _t、数组全空）：云端即使没有 _t，也要把生活方式/喜好等数据补回来
      const localUntouched = !(l._t || 0);
      if (localUntouched) {
        // 本机从未保存过（退出登录后的默认档案）：云端整体为准，含用户主动清空的数组
        Object.keys(r).forEach(function (key) {
          if (r[key] !== undefined) merged[key] = r[key];
        });
      } else {
        Object.keys(r).forEach(function (key) {
          if (r[key] !== undefined && merged[key] === undefined) merged[key] = r[key];
        });
        guardArrays(l, r, merged);
      }
    }
    out[k] = merged;
  });
  return out;
}

// 同步我的昵称到家庭成员记录（编辑昵称后对方可见、退出重登可恢复）
async function setNickname(nickname) {
  if (!ready()) return;
  try { await callFamily({ action: 'setNickname', nickname: nickname || '' }); } catch (e) { console.warn('setNickname 失败', e); }
}

// 同步我的头像到家庭成员记录（解决换头像后对方看不到新头像）
async function setAvatar(avatarUrl) {
  if (!ready()) return;
  try { await callFamily({ action: 'setAvatar', avatarUrl: avatarUrl || '' }); } catch (e) { console.warn('setAvatar 失败', e); }
}

// 退出/解散家庭
async function leaveFamily() {
  if (!wx.cloud) return { ok: false, err: '云不可用' };
  try { return await callFamily({ action: 'leave' }); }
  catch (e) { return { ok: false, err: friendlyCloudErr(e) }; }
}

// 修改家庭名称（返回结果供调用方提示）
async function setName(name) {
  if (!ready()) return { ok: false, err: '尚未加入家庭' };
  try { return await callFamily({ action: 'setName', name: name }); }
  catch (e) { return { ok: false, err: friendlyCloudErr(e) }; }
}

// 更新我的性别（本地立即生效，云端同步到家庭成员）
async function setGender(gender) {
  wx.setStorageSync('myGender', gender);
  if (!ready()) return;
  try { await callFamily({ action: 'setGender', gender: gender }); } catch (e) { console.warn('setGender 失败', e); }
}

async function familyInfo() {
  if (!wx.cloud || !wx.cloud.callFunction) return null;
  try {
    const res = await callFamily({ action: 'info' });
    if (res && res.ok && res.data) {
      wx.setStorageSync('familyCode', res.data.code); // 登录后按账号自动绑回家庭
      if (res.data.myGender) wx.setStorageSync('myGender', res.data.myGender);
      return res.data;
    }
  } catch (e) { console.warn('familyInfo 失败', e); }
  return null;
}

async function pullHome() {
  if (!ready()) return null;
  try {
    const res = await callFamily({ action: 'pull' });
    if (res && res.ok && res.data) return res.data;
  } catch (e) { console.warn('pullHome 失败', e); }
  return null;
}

function pushHome(patch) {
  if (!ready()) return;
  wx.cloud.callFunction({ name: 'family', data: { action: 'push', data: patch } })
    .catch(function (e) { console.warn('pushHome 失败', e); });
}

// 冰箱本地增删的全局单调序号 + 推送确认：跨页面拉取时防止云端旧数据把「已吃掉/新增」的食材复活
let fridgeLocalChangeSeq = 0;
let fridgePushedSeq = 0;
function markFridgeLocalChange() { fridgeLocalChangeSeq += 1; }
function fridgeVersion() { return fridgeLocalChangeSeq; }
function fridgeSyncClean() { return fridgePushedSeq >= fridgeLocalChangeSeq; }
function fridgeChangedSince(v) { return typeof v === 'number' && fridgeLocalChangeSeq > v; }
function pushFridge(fridge) {
  const seq = fridgeLocalChangeSeq;
  if (!ready()) { fridgePushedSeq = Math.max(fridgePushedSeq, seq); return Promise.resolve(); }
  return wx.cloud.callFunction({ name: 'family', data: { action: 'push', data: { fridge: fridge } } })
    .then(function () { fridgePushedSeq = Math.max(fridgePushedSeq, seq); })
    .catch(function (e) { console.warn('pushFridge 失败', e); });
}

// 提交使用建议（文字 + 图片 fileID），供开发者/家人查看
async function suggestAdd(text, images) {
  if (!wx.cloud) return { ok: false, err: '云不可用，请检查网络' };
  try { return await callFamily({ action: 'suggestAdd', text: text || '', images: images || [] }); }
  catch (e) { return { ok: false, err: friendlyCloudErr(e) }; }
}

async function suggestList() {
  if (!wx.cloud) return [];
  try {
    const res = await callFamily({ action: 'suggestList' });
    return (res && res.ok && Array.isArray(res.data)) ? res.data : [];
  } catch (e) { console.warn('suggestList 失败', e); return []; }
}

async function suggestDelete(id) {
  if (!wx.cloud) return { ok: false, err: '云不可用' };
  try { return await callFamily({ action: 'suggestDelete', id: id }); }
  catch (e) { return { ok: false, err: friendlyCloudErr(e) }; }
}

async function hydrateTodayCheckins() {
  if (!ready()) return;
  try {
    const r = await wx.cloud.callFunction({
      name: 'syncCheckin', data: { action: 'pull', homeCode: familyCode(), date: date.todayStr() }
    });
    const list = (r.result && r.result.list) || [];
    list.forEach(function (it) {
      wx.setStorageSync('supps-' + it.person + '-' + it.date, it.supps || {});
      wx.setStorageSync('train-' + it.person + '-' + it.date, it.train);
      if (it.custom) wx.setStorageSync('custom-' + it.person + '-' + it.date, it.custom);
      else wx.removeStorageSync('custom-' + it.person + '-' + it.date); // 同步「取消自定义运动」到另一台手机
      if (it.meals) wx.setStorageSync('meals-' + it.person + '-' + it.date, it.meals);
      else wx.removeStorageSync('meals-' + it.person + '-' + it.date);
      if (it.habits) wx.setStorageSync('habit-' + it.person + '-' + it.date, it.habits);
      else wx.removeStorageSync('habit-' + it.person + '-' + it.date);
    });
  } catch (e) { console.warn('hydrateCheckins 失败', e); }
}

function pushCheckin(person, supps, train, custom, meals, habits) {
  if (!ready()) return;
  wx.cloud.callFunction({
    name: 'syncCheckin',
    data: { action: 'push', homeCode: familyCode(), person: person, date: date.todayStr(), supps: supps, train: train, custom: custom || null, meals: meals || null, habits: habits || null }
  }).catch(function (e) { console.warn('pushCheckin 失败', e); });
}

function requestRemind() {
  if (TEMPLATE_ID.indexOf('请替换') === 0) {
    wx.showToast({ title: '先配置订阅消息模板ID', icon: 'none' });
    return;
  }
  wx.requestSubscribeMessage({
    tmplIds: [TEMPLATE_ID],
    success: function () { wx.showToast({ title: '已开启每日提醒', icon: 'success' }); },
    fail: function (e) { console.warn('订阅失败', e); }
  });
}

module.exports = {
  ENV: ENV, TEMPLATE_ID: TEMPLATE_ID, familyCode: familyCode, myGender: myGender, init: init,
  login: login, createFamily: createFamily, joinFamily: joinFamily, setRelation: setRelation, setGender: setGender, setName: setName, setAvatar: setAvatar, setNickname: setNickname, leaveFamily: leaveFamily, familyInfo: familyInfo, mergeProfile: mergeProfile,
  pullHome: pullHome, pushHome: pushHome, suggestAdd: suggestAdd, suggestList: suggestList, suggestDelete: suggestDelete,
  markFridgeLocalChange: markFridgeLocalChange, fridgeVersion: fridgeVersion, fridgeSyncClean: fridgeSyncClean,
  fridgeChangedSince: fridgeChangedSince, pushFridge: pushFridge,
  hydrateTodayCheckins: hydrateTodayCheckins, pushCheckin: pushCheckin, requestRemind: requestRemind
};
