// 端到端账单识别测试（真实截图 → 腾讯OCR → 解析引擎）
// 用法：node tests/e2e-ocr.js [图片路径...]
// 无参数时自动用 tests/fixtures 下的截图（微信截图已在，支付宝截图放 alipay.* 即自动纳入）
const fs = require('fs');
const os = require('os');
const path = require('path');
const bp = require(path.join(__dirname, '..', 'cloudfunctions', 'family', 'billparse.js'));

// 凭据来源：环境变量优先；没有则读本地 gitignored 的 cloudbaserc.json（仓库内不落密钥）
function loadCredential() {
  if (process.env.TENCENT_OCR_SECRET_ID && process.env.TENCENT_OCR_SECRET_KEY) {
    return { id: process.env.TENCENT_OCR_SECRET_ID, key: process.env.TENCENT_OCR_SECRET_KEY };
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cloudbaserc.json'), 'utf8'));
    const fn = (cfg.functions || []).filter(function (f) { return f.name === 'family'; })[0] || {};
    const env = fn.envVariables || {};
    if (env.TENCENT_OCR_SECRET_ID && env.TENCENT_OCR_SECRET_KEY) {
      return { id: env.TENCENT_OCR_SECRET_ID, key: env.TENCENT_OCR_SECRET_KEY };
    }
  } catch (e) { /* 读取失败则走下面报错 */ }
  return null;
}

const CRED = loadCredential();
if (!CRED) {
  console.error('缺少 OCR 凭据：请设置环境变量 TENCENT_OCR_SECRET_ID / TENCENT_OCR_SECRET_KEY，'
    + '或确保本地 cloudbaserc.json（已 gitignore）里配置了这两个变量。');
  process.exit(1);
}
const SECRET_ID = CRED.id;
const SECRET_KEY = CRED.key;
const SDK_DIR = path.join(os.tmpdir(), 'ocr-e2e', 'node_modules', 'tencentcloud-sdk-nodejs');
const SDK_INSTALL_DIR = path.join(os.tmpdir(), 'ocr-e2e');

async function ensureSdk() {
  if (fs.existsSync(SDK_DIR)) return;
  const { execSync } = require('child_process');
  fs.mkdirSync(SDK_INSTALL_DIR, { recursive: true });
  execSync('npm install tencentcloud-sdk-nodejs --no-audit --no-fund', { cwd: SDK_INSTALL_DIR, stdio: 'ignore' });
}

async function ocr(imagePath) {
  const tencentcloud = require(SDK_DIR);
  const OcrClient = tencentcloud.ocr.v20181119.Client;
  const client = new OcrClient({
    credential: { secretId: SECRET_ID, secretKey: SECRET_KEY },
    region: 'ap-shanghai',
    profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com' } }
  });
  const img = fs.readFileSync(imagePath);
  const resp = await client.GeneralBasicOCR({ ImageBase64: img.toString('base64'), LanguageType: 'zh' });
  return (resp.TextDetections || []).map(function (t) { return t.DetectedText; }).join('\n');
}

// 期望断言（微信真实截图）：8 笔
function assertWechat(list) {
  const expect = [
    { merchant: '我心飞翔', amount: 6, dateSuffix: '08-27' },
    { merchant: '亲属卡交易-Aa好老婆爱老婆..', amount: 0.1, dateSuffix: '08-26' },
    { merchant: '扫二维码付款-给城邦梅子', amount: 4, dateSuffix: '08-26' },
    { merchant: '淘宝平台商户', amount: 3.5, dateSuffix: '08-25' },
    { merchant: '零钱提现-到长沙银行(0215)', amount: 3.11, dateSuffix: '08-25', type: 'income' },
    { merchant: '零钱充值-来自招商银行(2472)', amount: 3, dateSuffix: '08-25', type: 'income' },
    { merchant: '转账-转给我屋里菜好呷', amount: 18, dateSuffix: '08-24' },
    { merchant: '湘小包', amount: 5.5, dateSuffix: '08-24' }
  ];
  expect.forEach(function (e, i) {
    const b = list[i];
    if (!b) throw new Error('微信第' + (i + 1) + '笔缺失');
    if (b.merchant.indexOf(e.merchant.slice(0, 4)) === -1) throw new Error('微信第' + (i + 1) + '笔商户不符: ' + b.merchant + ' 期望 ' + e.merchant);
    if (b.amount !== e.amount) throw new Error('微信第' + (i + 1) + '笔金额不符: ' + b.amount + ' 期望 ' + e.amount);
    if (e.dateSuffix && b.date.indexOf(e.dateSuffix) === -1) throw new Error('微信第' + (i + 1) + '笔日期不符: ' + b.date + ' 期望含 ' + e.dateSuffix);
    if (e.type && b.type !== e.type) throw new Error('微信第' + (i + 1) + '笔类型不符: ' + b.type);
  });
  return '微信8笔全对 ✓';
}

// 支付宝期望（5 笔，日期为相对日期解析后未定年在前一年边界按今天推算）
function assertAlipay(list) {
  const expect = [
    { m: 'codex过验', amount: 4.89, date: '2026-08-03' },
    { m: '余额宝', amount: 0.13, type: 'income' },
    { m: '蚂蚁财富', amount: 421.04 },
    { m: '余额宝', amount: 0.13, type: 'income' },
    { m: '余额宝', amount: 0.12, type: 'income' }
  ];
  expect.forEach(function (e, i) {
    if (!list[i]) throw new Error('支付宝第' + (i + 1) + '笔缺失: ' + JSON.stringify(list));
    if (list[i].merchant.indexOf(e.m) === -1) throw new Error('支付宝第' + (i + 1) + '笔商户不符: ' + list[i].merchant + ' 期望含 ' + e.m);
    if (list[i].amount !== e.amount) throw new Error('支付宝第' + (i + 1) + '笔金额不符: ' + list[i].amount + ' 期望 ' + e.amount);
    if (e.date && list[i].date !== e.date) throw new Error('支付宝第' + (i + 1) + '笔日期不符: ' + list[i].date + ' 期望 ' + e.date);
    if (e.type && list[i].type !== e.type) throw new Error('支付宝第' + (i + 1) + '笔类型不符: ' + list[i].type);
  });
  return '支付宝5笔识别 ✓（' + list.length + '笔）';
}

(async function () {
  await ensureSdk();
  const fixtureDir = path.join(__dirname, 'fixtures');
  const targets = (process.argv.slice(2) || []).length
    ? process.argv.slice(2)
    : fs.readdirSync(fixtureDir).filter(function (f) { return /\.(png|jpg|jpeg)$/i.test(f); }).map(function (f) { return path.join(fixtureDir, f); });
  let pass = 0, fail = 0;
  for (const t of targets) {
    console.log('\n==== ' + path.basename(t) + ' ====');
    try {
      const text = await ocr(t);
      const out = bp.parseBillText(text);
      out.forEach(function (b) { console.log(' - ' + b.merchant + ' / ' + b.amount + '元 / ' + (b.date || '-') + ' / ' + b.type); });
      const base = path.basename(t).toLowerCase();
      let verdict;
      if (base.indexOf('wechat') !== -1 || base.indexOf('bill-') !== -1) verdict = assertWechat(out);
      else if (base.indexOf('alipay') !== -1) verdict = assertAlipay(out);
      else verdict = '识别 ' + out.length + ' 笔（无断言）';
      console.log(verdict);
      pass++;
    } catch (e) {
      console.log('FAIL: ' + (e.message || e));
      fail++;
    }
  }
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail > 0 ? 1 : 0);
})();
