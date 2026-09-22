const automator = require('miniprogram-automator');
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
(async function () {
  const mp = await automator.connect({ wsEndpoint: process.env.ZZJ_WS || 'ws://127.0.0.1:9420' });
  console.log('connected');
  const cur = await mp.currentPage();
  console.log('currentPage:', cur ? cur.path : '(none)');

  // 对照组：完全无关的既有页面
  const targets = ['/pages/fridge/fridge', '/pages/bills/bills', '/pages/zzj/zzj', '/pages/zzj/knowledge'];
  for (const url of targets) {
    const t0 = Date.now();
    try {
      const p = await p2(mp, url);
      await sleep(1200);
      console.log(url, '-> OK (' + (Date.now()-t0) + 'ms)');
    } catch (e) {
      console.log(url, '-> 失败 (' + (Date.now()-t0) + 'ms):', String(e.message).slice(0,70));
    }
  }
  async function p2(mp, url) {
    const pg = await mp.navigateTo(url);
    await pg.waitFor(800);
    return pg;
  }
  await mp.close();
})().catch(e => { console.error('probe error:', e.message); process.exit(1); });
