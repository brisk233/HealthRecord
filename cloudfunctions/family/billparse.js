// 微信 + 支付宝 账单解析引擎 v5（基于真实支付宝OCR输出实测迭代）
// 与 v4 差异：
//  1. 金额支持行尾无¥数字（蚂蚁财富-永赢...421.04）
//  2. 日期「今天02:50/昨天15:24」无空格
//  3. 支持 ¥680,39 逗号小数点（先统一）
//  4. 过滤「限时福利/报销详情/已报销/开启通知/我的消费图鉴/收支分析」等噪声
function parseBillText(text) {
  // 预清洗：逗号小数点 -> 点（680,39 => 680.39），但保留中文文本中的逗号
  text = String(text || '').replace(/(\d+),(\d{2})(?!\d)/g, '$1.$2');
  const lines = text.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  let out = [];
  const amountRe = /^[-+]?[0-9]+\.[0-9]{1,2}$/;
  const amountInlineRe = /(?:[¥￥])\s*([0-9]+\.?[0-9]{0,2})/;
  // 行尾金额（无¥符号，如「...智选混合C...421.04」）：仅当行有中文且行尾是数字
  const amountTailRe = /([0-9]+\.[0-9]{1,2})\s*$/;
  // 日期：2026-08-03 12:38:13 | 2026年8月27日 09:12 | 8月27日 09:12 | 今天02:50 | 昨天15:24
  const dateRe = /^((\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?|(\d{4}年)?(\d{1,2})月(\d{1,2})日[\s]+(\d{1,2}:\d{2})|(今|昨)天[\s]*(\d{1,2}:\d{2}))$/;
  const incomeWords = ['提现', '充值', '退款', '转入', '收入', '红包', '收益', '发放', '利息', '返还', '到账'];
  const noiseWords = ['限时福利', '报销详情', '已报销', '开启通知', '我的消费图鉴', '收支分析', '今年累计', '本月已省', '搜索交易记录', '搜索'];
  // 行分类
  const rows = lines.map(function (line, i) {
    let kind = 'other', date = '', pre = (lines[i - 1] || ''), post = (lines[i + 1] || '');
    const dm = line.match(dateRe);
    if (dm) {
      kind = 'date';
      if (dm[2]) { date = dm[2] + '-' + dm[3].padStart(2, '0') + '-' + dm[4].padStart(2, '0'); }
      else if (dm[10]) {
        const today = new Date();
        const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (dm[10] === '昨') base.setDate(base.getDate() - 1);
        date = base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0');
      }
      else if (dm[7]) {
        const yr = dm[6] ? dm[6].slice(0, 4) : '';
        const today = new Date();
        date = (yr ? yr + '-' : '') + dm[7].padStart(2, '0') + '-' + dm[8].padStart(2, '0');
        if (!yr) { date = today.getFullYear() + '-' + date; }
      }
    }
    else if (noiseWords.some(function (w) { return line.indexOf(w) !== -1; })) { kind = 'noise'; }
    else if (/支出|收入|收支|统计/.test(line) && line.length > 4) { kind = 'summary'; }  // 汇总行优先
    else if (amountRe.test(line)) {
      // 汇总行/孤立金额噪声
      if (/支出|收入|收支|¥|￥/.test(pre) && pre.length > 2) { kind = 'noise'; }
      else if (pre.length <= 2 && pre !== '' && !dateRe.test(post)) { kind = 'noise'; }
      else { kind = 'amount'; }
    }
    else if (amountTailRe.test(line) && /[\u4e00-\u9fa5]/.test(line)) { kind = 'merchantTailAmount'; }
    else if (amountInlineRe.test(line)) {
      if (/支出|收入|收支|统计/.test(line) && line.length > 8) { kind = 'noise'; }
      else { kind = 'inlineAmount'; }
    }
    else if (/支出|收入|收支|统计/.test(line) && line.length > 4) { kind = 'summary'; }
    else if (line === '8月' || /^8月/.test(line)) { kind = 'noise'; }
    else if (line.length > 1 && /[\u4e00-\u9fa5A-Za-z]/.test(line)) { kind = 'merchant'; }
    return { text: line, i: i, kind: kind, date: date };
  });
  const usedDateIdx = [], usedMerchantIdx = [];
  rows.forEach(function (row) {
    if (row.kind === 'amount') {
      const val = row.text.match(amountRe)[0];
      const amount = Math.abs(parseFloat(val));
      let merchant = '未知商户';
      for (let k = row.i - 1; k >= Math.max(0, row.i - 3); k--) {
        const pk = rows[k];
        if (pk.kind === 'merchant' && usedMerchantIdx.indexOf(k) === -1 && pk.text.length <= 40) { merchant = pk.text; usedMerchantIdx.push(k); break; }
      }
      let date = '';
      for (let k = row.i + 1; k <= Math.min(rows.length - 1, row.i + 3); k++) {
        const nk = rows[k];
        if (nk.kind === 'date' && usedDateIdx.indexOf(k) === -1) { date = nk.date; usedDateIdx.push(k); break; }
      }
      const ctx = (rows[row.i - 1] ? rows[row.i - 1].text : '') + merchant;
      const income = incomeWords.some(function (w) { return ctx.indexOf(w) !== -1; });
      out.push({ merchant: merchant, amount: amount, amountText: val, date: date, time: '', type: income ? 'income' : 'expense', raw: row.text });
    }
    // 商户+行尾金额同行（蚂蚁财富...421.04）
    else if (row.kind === 'merchantTailAmount') {
      const m = row.text.match(amountTailRe);
      const amount = parseFloat(m[1]);
      let merchant = row.text.replace(amountTailRe, '').trim() || '未知商户';
      let date = '';
      for (let k = row.i + 1; k <= Math.min(rows.length - 1, row.i + 2); k++) {
        const nk = rows[k];
        if (nk.kind === 'date' && usedDateIdx.indexOf(k) === -1) { date = nk.date; usedDateIdx.push(k); break; }
      }
      const income = incomeWords.some(function (w) { return (row.text + merchant).indexOf(w) !== -1; });
      out.push({ merchant: merchant, amount: amount, amountText: m[0], date: date, time: '', type: income ? 'income' : 'expense', raw: row.text });
    }
    else if (row.kind === 'inlineAmount') {
      const m = row.text.match(amountInlineRe);
      if (!m) return;
      const amount = parseFloat(m[1]);
      let merchant = row.text.replace(amountInlineRe, '').replace(/[¥￥]/g, '').trim() || '未知商户';
      let date = '';
      for (let k = row.i - 1; k <= Math.min(rows.length - 1, row.i + 1); k++) {
        if (k < 0) continue;
        const nk = rows[k];
        if (nk.kind === 'date' && usedDateIdx.indexOf(k) === -1) { date = nk.date; usedDateIdx.push(k); break; }
      }
      const income = incomeWords.some(function (w) { return (row.text + merchant).indexOf(w) !== -1; });
      out.push({ merchant: merchant, amount: amount, amountText: m[0], date: date, time: '', type: income ? 'income' : 'expense', raw: row.text });
    }
  });
  out = out.filter(function (b) { return !(b.merchant === '未知商户' && !b.date); });
  const seen = {};
  return out.filter(function (b) {
    const key = b.merchant + '|' + b.amount + '|' + b.date;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
module.exports = { parseBillText: parseBillText };
