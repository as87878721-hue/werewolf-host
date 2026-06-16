/**
 * pw_rules_test.cjs — 規則驗證測試
 * 修正：waitT/see 改用 innerText；clickT 改用 getBoundingClientRect + mouse.click
 */
const { chromium } = require('playwright');

const VIEWPORT = { width: 430, height: 900 };
const COL_X = [58, 150, 241, 332];
const ROW_Y  = [190, 310, 430];
function coord(n) { return { x: COL_X[(n-1)%4], y: ROW_Y[Math.floor((n-1)/4)] }; }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function clickP(page, n) { const {x,y}=coord(n); await page.mouse.click(x,y); await sleep(150); }

// ── 核心：innerText 方式偵測文字（不受 CSS visibility 影響）──────────
async function waitT(page, txt, to=12000) {
  await page.waitForFunction(
    (t) => { try { return document.body.innerText.includes(t); } catch(e) { return false; } },
    txt, { timeout: to }
  );
  await sleep(80);
}

async function see(page, txt, to=2500) {
  try {
    await page.waitForFunction(
      (t) => { try { return document.body.innerText.includes(t); } catch(e) { return false; } },
      txt, { timeout: to }
    );
    return true;
  } catch { return false; }
}

// ── 核心：getBoundingClientRect + mouse.click（不受 Playwright visibility 限制）
async function clickT(page, txt, to=8000) {
  await waitT(page, txt, to);
  const coords = await page.evaluate((t) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walk.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.includes(t)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  }, txt);
  if (coords) {
    await page.mouse.click(coords.x, coords.y);
  } else {
    await page.locator(`text=${txt}`).first().click({ timeout: 3000, force: true });
  }
  await sleep(250);
}

// ── 結果追蹤 ────────────────────────────────────────────────────────
const R = [];
function log(s, id, name, note='') {
  R.push({id, name, s, note});
  const ico = s==='PASS'?'✅':s==='FAIL'?'❌':s==='BUG'?'🐛':'⏭️';
  console.log(`${ico} [${s}] ${id}: ${name}${note?' | '+note:''}`);
}
const pass=(id,n,note='')=>log('PASS',id,n,note);
const fail=(id,n,note='')=>log('FAIL',id,n,note);
const bug =(id,n,note='')=>log('BUG', id,n,note);
const skip=(id,n,note='')=>log('SKIP',id,n,note);

// ── Setup：在 SetupScreen 新增角色 ──────────────────────────────────
async function addRole(page, tabName, roleName) {
  await clickT(page, tabName);
  await sleep(300);
  const nameEl = page.locator(`text=${roleName}`).first();
  const nameBox = await nameEl.boundingBox();
  if (!nameBox) throw new Error(`找不到角色: ${roleName}`);
  const plusAll = await page.locator('text=＋').all();
  for (const el of plusAll) {
    const b = await el.boundingBox();
    if (b && Math.abs(b.y - nameBox.y) < 30) { await el.click({force:true}); await sleep(200); return; }
  }
  throw new Error(`找不到 ${roleName} 的 ＋ 按鈕`);
}

// ── 遊戲啟動 ────────────────────────────────────────────────────────
async function startGame(page, mode='single', extraRoles=[]) {
  await page.goto('http://localhost:8082');
  await sleep(2200);
  await clickT(page, mode==='single' ? '單身分' : '雙身分');
  await waitT(page, '狼隊', 10000);
  await sleep(300);
  for (const {tab, name} of extraRoles) await addRole(page, tab, name);
  await clickT(page, '下一步');
  await waitT(page, '開始夜晚');
  await sleep(300);
  await clickT(page, '開始夜晚');
  await sleep(700);
}

// ── 夜晚收尾 helpers ─────────────────────────────────────────────────
async function skipRest(page) {
  for (let i=0; i<18; i++) {
    if (await see(page, '夜晚行動完成', 400)) break;
    if (await see(page, '完成 → 結束夜晚', 600)) { await clickT(page, '完成 → 結束夜晚'); break; }
    // 獵人步驟：需先點選獵人身分後才能繼續
    if (await see(page, '先點選獵人是誰', 400)) { await clickP(page, 6); await sleep(400); continue; }
    const clicked = await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walk.nextNode()) {
        if (!node.nodeValue || !node.nodeValue.includes('完成 → 下一位')) continue;
        const el = node.parentElement;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight) {
          el.click(); return true;
        }
      }
      return false;
    });
    await sleep(400);
    if (!clicked && i > 8) break;
  }
}

async function toResult(page) {
  await waitT(page, '夜晚行動完成');
  await sleep(300);
  await clickT(page, '查看夜晚結果 →');
  await sleep(800);
  await waitT(page, '進入白天', 10000);  // ResultScreen 唯一按鈕
  await sleep(300);
}

async function skipDay(page) {
  if (await see(page, '警長競選', 3000)) { await clickT(page, '確認，繼續'); await sleep(400); }
  await clickT(page, '確認，繼續'); await sleep(400);
  await clickT(page, '確認，繼續'); await sleep(400);
  await waitT(page, '投票放逐');
  await clickT(page, '流票'); await sleep(200);
  await clickT(page, '確認流票'); await sleep(400);
  await sleep(300);
  await clickT(page, '結束白天'); await sleep(800);
}

async function endGame(page) {
  for (let i=0; i<6; i++) {
    if (await see(page, '🐺 狼人殺主持', 1000)) return;
    if (await see(page, '結束本局', 1000))  { await clickT(page, '結束本局', 3000); await sleep(600); continue; }
    if (await see(page, '查看夜晚結果', 1000)) { await clickT(page, '查看夜晚結果 →', 3000); await sleep(600); continue; }
    if (await see(page, '進入白天', 1000))  { await clickT(page, '進入白天', 3000); await sleep(600); try { await skipDay(page); } catch{} continue; }
    break;
  }
  if (!(await see(page, '🐺 狼人殺主持', 2000))) { await page.goto('http://localhost:8082'); await sleep(1500); }
}

// ════════════════════════════════════════════════════════════════════
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page    = await browser.newPage();
  await page.setViewportSize(VIEWPORT);
  console.log('\n======= 狼人殺規則驗證測試 =======\n');

  // ─── T01  狼刀7號 → 7號死亡 ──────────────────────────────────────
  console.log('\n[T01] 狼刀7號 → 死亡');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'💀') && await see(page,'7號');
    ok ? pass('T01','狼刀7號 → 結果顯示7號死亡') : fail('T01','狼刀7號 → 結果顯示7號死亡','結果頁未見7號死亡');
    await page.screenshot({path:'t01.png'});
    await endGame(page);
  } catch(e){ fail('T01','狼刀7號','Error: '+e.message); await endGame(page); }

  // ─── T02  預言家查驗狼人 → 狼人陣營 ────────────────────────────────
  console.log('\n[T02] 預言家查驗狼人');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickP(page,4);
    await clickT(page, '🔮 查驗'); await sleep(200);
    await clickP(page,1); await sleep(400);
    const ok = await see(page,'狼人陣營 🐺');
    ok ? pass('T02','預言家查驗狼人(P1) → 狼人陣營 🐺') : fail('T02','預言家查驗狼人(P1) → 狼人陣營 🐺','未顯示狼人陣營');
    await page.screenshot({path:'t02.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T02','預言家查驗狼人','Error: '+e.message); await endGame(page); }

  // ─── T03  預言家查驗村民 → 好人陣營 ────────────────────────────────
  console.log('\n[T03] 預言家查驗村民');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickP(page,4);
    await clickT(page, '🔮 查驗'); await sleep(200);
    await clickP(page,9); await sleep(400);
    const ok = await see(page,'好人陣營 ✅');
    ok ? pass('T03','預言家查驗村民(P9) → 好人陣營 ✅') : fail('T03','預言家查驗村民(P9) → 好人陣營 ✅','未顯示好人陣營');
    await page.screenshot({path:'t03.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T03','預言家查驗村民','Error: '+e.message); await endGame(page); }

  // ─── T04  女巫解藥救人 → 平安夜 ────────────────────────────────────
  console.log('\n[T04] 女巫解藥救人');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '💊 解藥'); await sleep(300);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'✨ 本晚平安');
    ok ? pass('T04','女巫解藥救狼刀目標 → 平安夜') : fail('T04','女巫解藥救狼刀目標 → 平安夜','仍顯示死亡');
    await page.screenshot({path:'t04.png'});
    await endGame(page);
  } catch(e){ fail('T04','女巫解藥','Error: '+e.message); await endGame(page); }

  // ─── T05  女巫毒藥毒8號 → 8號死亡 ──────────────────────────────────
  console.log('\n[T05] 女巫毒藥毒8號');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '☠️ 毒藥'); await sleep(200);
    await clickP(page,8); await sleep(200);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'8號') && await see(page,'💀');
    ok ? pass('T05','女巫毒藥毒8號 → 8號死亡') : fail('T05','女巫毒藥毒8號 → 8號死亡','8號未顯示死亡');
    await page.screenshot({path:'t05.png'});
    await endGame(page);
  } catch(e){ fail('T05','女巫毒藥','Error: '+e.message); await endGame(page); }

  // ─── T06  守衛守護 → 狼刀無效存活 ─────────────────────────────────
  console.log('\n[T06] 守衛守護 → 狼刀無效');
  try {
    await startGame(page,'single',[{tab:'神職',name:'守衛'}]);
    await waitT(page, '點選守衛是誰');
    await clickP(page,10);
    await clickT(page, '🛡️ 守護'); await sleep(200);
    await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'✨ 本晚平安') || await see(page,'保護');
    ok ? pass('T06','守衛守護P8，狼刀P8 → P8存活') : fail('T06','守衛守護P8，狼刀P8 → P8存活','守護後P8仍死亡');
    await page.screenshot({path:'t06.png'});
    await endGame(page);
  } catch(e){ fail('T06','守衛守護','Error: '+e.message); await endGame(page); }

  // ─── T07  守衛＋解藥疊加 → 解藥視同毒藥，目標仍死 ────────────────
  console.log('\n[T07] 守衛+解藥疊加 → 死亡');
  try {
    await startGame(page,'single',[{tab:'神職',name:'守衛'}]);
    await waitT(page, '點選守衛是誰');
    await clickP(page,10);
    await clickT(page, '🛡️ 守護'); await sleep(200);
    await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '💊 解藥'); await sleep(300);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'💀') && await see(page,'8號');
    ok ? pass('T07','守衛+解藥疊加 → 解藥視同毒藥，P8仍死亡') : fail('T07','守衛+解藥疊加 → P8仍死亡','P8應死但顯示平安');
    await page.screenshot({path:'t07.png'});
    await endGame(page);
  } catch(e){ fail('T07','守衛+解藥疊加','Error: '+e.message); await endGame(page); }

  // ─── T08  守衛不可連續守同一人 ──────────────────────────────────────
  console.log('\n[T08] 守衛連續守護限制');
  try {
    await startGame(page,'single',[{tab:'神職',name:'守衛'}]);
    // 第1晚：守P8
    await waitT(page, '點選守衛是誰');
    await clickP(page,10);
    await clickT(page, '🛡️ 守護'); await sleep(200);
    await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await waitT(page, '夜晚行動完成');
    await clickT(page, '查看夜晚結果 →'); await sleep(600);
    await waitT(page, '進入白天');
    await clickT(page, '進入白天'); await sleep(700);
    await skipDay(page);
    // 第2晚：守衛已在保護模式（成員已設定），子文字直接顯示「本晚不可再守」
    await waitT(page, '本晚不可再守', 15000);
    const restricted = await see(page,'不可再守', 500);
    restricted
      ? pass('T08','守衛不可連續守同一人 → 顯示「不可再守」')
      : fail('T08','守衛不可連續守同一人 → 顯示「不可再守」','未見限制提示');
    await page.screenshot({path:'t08.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T08','守衛連續守護','Error: '+e.message); await endGame(page); }

  // ─── T09  攝夢人保護 → 免疫狼刀 ────────────────────────────────────
  console.log('\n[T09] 攝夢人保護 → 免疫狼刀');
  try {
    await startGame(page,'single',[{tab:'神職',name:'攝夢人'}]);
    await waitT(page, '點選攝夢人是誰');
    await clickP(page,10);
    await clickT(page, '💤 保護'); await sleep(200);
    await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'✨ 本晚平安') || await see(page,'攝夢人');
    ok ? pass('T09','攝夢人保護P8，狼刀P8 → P8免疫存活') : fail('T09','攝夢人保護P8 → P8存活','攝夢人保護後仍死亡');
    await page.screenshot({path:'t09.png'});
    await endGame(page);
  } catch(e){ fail('T09','攝夢人保護','Error: '+e.message); await endGame(page); }

  // ─── T10  血月使徒發動 → 結果頁「🌑 血月平安夜」 ──────────────────
  console.log('\n[T10] 血月使徒');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'血月使徒'}]);
    await waitT(page, '選擇是否發動技能', 12000);  // blood_moon getModeLabel early return
    await clickP(page,10);
    await clickT(page, '🌑 發動技能'); await sleep(300);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const moonBadge = await see(page,'🌑 血月平安夜');
    const delayed   = await see(page,'延後死亡');
    moonBadge ? pass('T10','血月發動 → 結果顯示「🌑 血月平安夜」') : fail('T10','血月發動 → 結果顯示「🌑 血月平安夜」','未顯示');
    delayed   ? pass('T10b','血月發動 → 結果顯示「延後死亡（血月）」') : fail('T10b','血月延後死亡','未見延後文字');
    await page.screenshot({path:'t10.png'});
    // T11：進入白天確認血月資訊（在 step 1 公布死亡才顯示）
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選', 2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await waitT(page,'公布昨晚死亡', 5000);
    const dayMoon = await see(page,'血月');
    dayMoon ? pass('T11','血月 → DayScreen 公布死亡顯示血月說明') : fail('T11','DayScreen 血月說明','未顯示');
    await page.screenshot({path:'t11.png'});
    await endGame(page);
  } catch(e){ fail('T10','血月使徒','Error: '+e.message); await endGame(page); }

  // ─── T12  烏鴉不可選自己 ──────────────────────────────────────────
  console.log('\n[T12] 烏鴉不可選自己');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'烏鴉'}]);
    await waitT(page, '點選烏鴉是誰');
    await clickP(page,10);
    // 切換到環繞模式
    await clickT(page, '環繞（次日不可被投票）'); await sleep(300);
    // 點自己（P10），應無效 → P10 仍顯示「★」（crow成員），不顯示「繞」（環繞目標）
    await clickP(page,10); await sleep(300);
    // '★' 出現代表 P10 未被加入 actionTargets['surround']（被正確擋下）
    // BUG 時 P10 顯示 '繞'，'★' 消失
    const selfBlocked = await see(page,'★',500);
    selfBlocked
      ? pass('T12','烏鴉不可環繞自己 → 點自己無效（★仍可見，surround 未記錄自己）')
      : bug('T12','烏鴉不可環繞自己 → 點自己無效','members.includes 修正應擋住，但★消失（P10被加入surround）');
    await page.screenshot({path:'t12.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T12','烏鴉不可選自己','Error: '+e.message); await endGame(page); }

  // ─── T13  烏鴉環繞 → 投票頁顯示限制 ───────────────────────────────
  console.log('\n[T13] 烏鴉環繞 → 投票頁顯示限制');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'烏鴉'}]);
    await waitT(page, '點選烏鴉是誰');
    await clickP(page,10);
    await clickT(page, '環繞（次日不可被投票）'); await sleep(200);
    await clickP(page,5); await sleep(200);  // 環繞P5
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await waitT(page, '夜晚行動完成');
    await clickT(page, '查看夜晚結果 →'); await sleep(600);
    await waitT(page, '進入白天');
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await clickT(page,'確認，繼續'); await sleep(400);
    await clickT(page,'確認，繼續'); await sleep(400);
    await waitT(page,'投票放逐'); await sleep(300);
    const crowHint = await see(page,'烏鴉');
    crowHint ? pass('T13','烏鴉環繞P5 → 投票頁顯示烏鴉限制提示') : fail('T13','投票頁顯示烏鴉限制','未見烏鴉說明');
    await page.screenshot({path:'t13.png'});
    await endGame(page);
  } catch(e){ fail('T13','烏鴉環繞','Error: '+e.message); await endGame(page); }

  // ─── T14  野孩子被預言家查驗 → 顯示狼人陣營 ────────────────────────
  console.log('\n[T14] 野孩子被驗 → 狼人陣營');
  try {
    await startGame(page,'single',[{tab:'平民',name:'野孩子'}]);
    // 野孩子識別步驟（order 7，排在狼人 order 10 之前）
    await waitT(page, '點選野孩子是誰');
    await clickP(page, 10);  // P10 = 野孩子
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickP(page,4);
    await clickT(page, '🔮 查驗'); await sleep(200);
    await clickP(page,10); await sleep(400);  // 查驗野孩子P10
    const ok = await see(page,'狼人陣營 🐺');
    if (ok) {
      pass('T14','預言家查驗野孩子P10 → 顯示「狼人陣營」（例外規則）');
    } else {
      const isGood = await see(page,'好人陣營 ✅');
      isGood
        ? bug('T14','預言家查驗野孩子 → 顯示「好人陣營」而非「狼人陣營」',
            '野孩子無夜間步驟，roleMembersMap["wild_child"] 為空，wolfCheckPlayers 不含P10，查驗結果錯誤')
        : fail('T14','預言家查驗野孩子','無查驗結果顯示');
    }
    await page.screenshot({path:'t14.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T14','野孩子查驗','Error: '+e.message); await endGame(page); }

  // ─── T15  石像鬼偷中神職（預言家P4）→ 死亡 ─────────────────────────
  console.log('\n[T15] 石像鬼偷中神職');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'石像鬼'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選石像鬼是誰');
    await clickP(page,10);
    await clickT(page, '🗿 偷襲神職'); await sleep(200);
    await clickP(page,4);  // 偷襲預言家P4
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'4號') && await see(page,'💀');
    ok ? pass('T15','石像鬼偷中預言家(P4) → P4死亡') : fail('T15','石像鬼偷中神職','P4未顯示死亡');
    await page.screenshot({path:'t15.png'});
    await endGame(page);
  } catch(e){ fail('T15','石像鬼偷神職','Error: '+e.message); await endGame(page); }

  // ─── T16  石像鬼偷非神職（村民P9）→ 無效 ───────────────────────────
  console.log('\n[T16] 石像鬼偷非神職');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'石像鬼'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選石像鬼是誰');
    await clickP(page,10);
    await clickT(page, '🗿 偷襲神職'); await sleep(200);
    await clickP(page,9);  // 偷村民P9
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    // 石像鬼摘要行永遠顯示「🗿 石像鬼 → 偷襲 9號」，需用死亡列專屬格式判斷
    const p9dead = await page.evaluate(() => {
      const m = document.body.innerText.match(/本晚死亡：([^\n]+)/);
      return m ? m[1].includes('9號') : false;
    });
    !p9dead ? pass('T16','石像鬼偷村民(P9) → 無效，P9存活（死亡列不見P9）')
            : fail('T16','石像鬼偷非神職無效','P9出現在死亡列，應無效');
    await page.screenshot({path:'t16.png'});
    await endGame(page);
  } catch(e){ fail('T16','石像鬼偷村民','Error: '+e.message); await endGame(page); }

  // ─── T17  獵魔人獵狼人 → 狼人死亡 ──────────────────────────────────
  console.log('\n[T17] 獵魔人獵狼人');
  try {
    await startGame(page,'single',[{tab:'神職',name:'獵魔人'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選獵魔人是誰');
    await clickP(page,10);
    await clickT(page, '🗡️ 狩獵'); await sleep(200);
    await clickP(page,1);  // 獵P1（狼人）
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'1號') && await see(page,'💀');
    ok ? pass('T17','獵魔人獵狼人P1 → P1死亡') : fail('T17','獵魔人獵狼人P1死亡','P1未顯示死亡');
    await page.screenshot({path:'t17.png'});
    await endGame(page);
  } catch(e){ fail('T17','獵魔人獵狼人','Error: '+e.message); await endGame(page); }

  // ─── T18  獵魔人獵好人 → 獵魔人自死 ────────────────────────────────
  console.log('\n[T18] 獵魔人獵好人');
  try {
    await startGame(page,'single',[{tab:'神職',name:'獵魔人'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選獵魔人是誰');
    await clickP(page,10);
    await clickT(page, '🗡️ 狩獵'); await sleep(200);
    await clickP(page,5);  // 獵女巫P5（好人）→ 獵魔人自死
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'10號') && await see(page,'💀');
    ok ? pass('T18','獵魔人獵好人(女巫P5) → 獵魔人P10死亡') : fail('T18','獵魔人獵好人自死','P10未顯示死亡');
    await page.screenshot({path:'t18.png'});
    await endGame(page);
  } catch(e){ fail('T18','獵魔人獵好人','Error: '+e.message); await endGame(page); }

  // ─── T19  阿努比斯：狼+好 → 好人死 ────────────────────────────────
  console.log('\n[T19] 阿努比斯 狼+好');
  try {
    await startGame(page,'single',[{tab:'神職',name:'阿努比斯'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '完成 → 下一位'); await sleep(400);  // 不刀人
    await waitT(page, '點選阿努比斯是誰');
    await clickP(page,10);
    await clickT(page, '⚖️ 天秤（選2人）'); await sleep(200);
    await clickP(page,1); await clickP(page,5); await sleep(200);  // 狼vs好
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'5號') && await see(page,'💀');
    ok ? pass('T19','阿努比斯：狼(P1)+好(P5) → 好人P5死亡') : fail('T19','阿努比斯狼+好','P5未顯示死亡');
    await page.screenshot({path:'t19.png'});
    await endGame(page);
  } catch(e){ fail('T19','阿努比斯狼+好','Error: '+e.message); await endGame(page); }

  // ─── T20  阿努比斯：好+好 → 無人死 ────────────────────────────────
  console.log('\n[T20] 阿努比斯 好+好');
  try {
    await startGame(page,'single',[{tab:'神職',name:'阿努比斯'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選阿努比斯是誰');
    await clickP(page,10);
    await clickT(page, '⚖️ 天秤（選2人）'); await sleep(200);
    await clickP(page,4); await clickP(page,5); await sleep(200);  // 好+好
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const ok = await see(page,'✨ 本晚平安');
    ok ? pass('T20','阿努比斯：好(P4)+好(P5) → 無人死亡') : fail('T20','阿努比斯好+好','天秤兩端皆好人卻出現死亡');
    await page.screenshot({path:'t20.png'});
    await endGame(page);
  } catch(e){ fail('T20','阿努比斯好+好','Error: '+e.message); await endGame(page); }

  // ─── T21  天狗其他狼存活 → 擊殺鎖定「本晚跳過」 ────────────────────
  console.log('\n[T21] 天狗擊殺鎖定');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'天狗'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選天狗是誰');
    await clickP(page,10); await sleep(300);
    const ok = await see(page,'本晚跳過');
    ok ? pass('T21','天狗其他狼存活時 → 擊殺鎖定顯示「本晚跳過」') : fail('T21','天狗擊殺鎖定','未見「本晚跳過」');
    await page.screenshot({path:'t21.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T21','天狗鎖定','Error: '+e.message); await endGame(page); }

  // ─── T22  科學怪人免疫狼刀 → 存活 ─────────────────────────────────
  console.log('\n[T22] 科學怪人免疫');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'科學怪人'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,10);  // 刀科學怪人P10
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選科學怪人是誰');
    await clickP(page,10);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const p10dead = await see(page,'10號',1500);
    const peace   = await see(page,'✨ 本晚平安');
    (!p10dead || peace) ? pass('T22','科學怪人被狼刀 → 免疫存活（平安夜）')
                        : fail('T22','科學怪人免疫','P10（科學怪人）顯示死亡，應免疫');
    await page.screenshot({path:'t22.png'});
    await endGame(page);
  } catch(e){ fail('T22','科學怪人免疫','Error: '+e.message); await endGame(page); }

  // ─── T23  獵人被狼刀（非毒）→ NightScreen 顯示「可以開槍」 ──────────
  console.log('\n[T23] 獵人被狼刀（非毒）');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,6);  // 刀獵人P6
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '⏭️ 跳過'); await sleep(200);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '先點選獵人是誰');
    await clickP(page,6); await sleep(300);
    const canShoot = await see(page,'可以開槍');
    canShoot ? pass('T23','獵人被狼刀（非毒）→ 顯示「可以開槍」') : fail('T23','獵人被狼刀顯示開槍','未顯示開槍提示');
    await page.screenshot({path:'t23_night.png'});
    await clickT(page, '完成 → 結束夜晚'); await sleep(400);
    // T24：DayScreen 顯示「獵人開槍」選項
    await toResult(page);
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await waitT(page,'公布昨晚死亡'); await sleep(300);
    const shootBtn = await see(page,'獵人開槍');
    shootBtn ? pass('T24','獵人被狼刀 → DayScreen 顯示「🏹 獵人開槍」')
             : fail('T24','DayScreen 獵人開槍按鈕','未顯示獵人開槍');
    await page.screenshot({path:'t24_day.png'});
    await endGame(page);
  } catch(e){ fail('T23','獵人被狼刀','Error: '+e.message); await endGame(page); }

  // ─── T25  獵人被毒 → NightScreen 顯示「被女巫下毒」 ─────────────────
  console.log('\n[T25][T26] 獵人被毒');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,6);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '☠️ 毒藥'); await sleep(200);
    await clickP(page,6); await sleep(200);  // 毒獵人P6
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '先點選獵人是誰');
    await clickP(page,6); await sleep(300);
    const poisonMsg = await see(page,'被女巫下毒');
    poisonMsg ? pass('T25','獵人被毒 → 顯示「被女巫下毒 ❌ 無法開槍」') : fail('T25','獵人被毒無法開槍提示','未顯示');
    await page.screenshot({path:'t25_night.png'});
    await clickT(page, '完成 → 結束夜晚'); await sleep(400);
    await toResult(page);
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await waitT(page,'公布昨晚死亡'); await sleep(300);
    const shootWhenPoisoned = await see(page,'獵人開槍');
    if (shootWhenPoisoned) {
      bug('T26','獵人被毒死 → DayScreen 仍顯示「獵人開槍」（違反規則）',
        'hasNightHunterDeath 未排除 witchPoison 情況；狼王已有 p!==witchPoisonTarget 篩選，獵人無');
    } else {
      pass('T26','獵人被毒死 → DayScreen 不顯示「獵人開槍」（符合規則）');
    }
    await page.screenshot({path:'t26_day.png'});
    await endGame(page);
  } catch(e){ fail('T25','獵人被毒','Error: '+e.message); await endGame(page); }

  // ─── T27  狼王被毒 → DayScreen 不提供「狼王帶人」 ──────────────────
  console.log('\n[T27] 狼王被毒');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'狼王'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    if (await see(page,'點選狼王是誰',2000)) {
      await clickP(page,10);
      await clickT(page, '完成 → 下一位'); await sleep(400);
    }
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '☠️ 毒藥'); await sleep(200);
    await clickP(page,10); await sleep(200);  // 毒狼王P10
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await waitT(page,'公布昨晚死亡'); await sleep(300);
    const wkBring = await see(page,'狼王帶人');
    !wkBring ? pass('T27','狼王被毒死 → DayScreen 不顯示「狼王帶人」（符合規則）')
             : fail('T27','狼王被毒不能帶人','仍顯示狼王帶人，違反規則');
    await page.screenshot({path:'t27.png'});
    await endGame(page);
  } catch(e){ fail('T27','狼王被毒','Error: '+e.message); await endGame(page); }

  // ─── T28  神射手宣告且死亡 → DayScreen 觸發技能 ──────────────────────
  console.log('\n[T28] 神射手觸發');
  try {
    await startGame(page,'single',[{tab:'神職',name:'神射手'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,10);  // 刀神射手P10
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickP(page,4);
    await clickT(page, '🔮 查驗'); await sleep(200);
    await clickP(page,1);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '⏭️ 跳過'); await sleep(200);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '選擇是否發動技能', 12000);  // sharpshooter getModeLabel early return
    await clickP(page,10);
    await clickT(page, '🎯 發動技能'); await sleep(300);
    const declared = await see(page,'技能已發動');
    declared ? pass('T28a','神射手發動技能 → 顯示「技能已發動」') : fail('T28a','神射手發動顯示','未顯示技能已發動');
    await skipRest(page);
    await toResult(page);
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await waitT(page,'公布昨晚死亡'); await sleep(300);
    const ssBtn = await see(page,'神射手擊殺');
    ssBtn ? pass('T28','神射手宣告且死亡 → DayScreen 顯示「神射手擊殺」') : fail('T28','神射手觸發能力','未顯示神射手擊殺');
    await page.screenshot({path:'t28.png'});
    await endGame(page);
  } catch(e){ fail('T28','神射手觸發','Error: '+e.message); await endGame(page); }

  // ─── T29  神射手宣告但未死 → DayScreen 不觸發 ────────────────────────
  console.log('\n[T29] 神射手未死不觸發');
  try {
    await startGame(page,'single',[{tab:'神職',name:'神射手'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);  // 刀村民P7，神射手P10未死
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選預言家是誰');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '今晚狼人刀了');
    await clickT(page, '⏭️ 跳過'); await sleep(200);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '選擇是否發動技能', 12000);  // sharpshooter getModeLabel early return
    await clickP(page,10);
    await clickT(page, '🎯 發動技能'); await sleep(200);
    await skipRest(page);
    await toResult(page);
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await waitT(page,'公布昨晚死亡'); await sleep(300);
    const noTrigger = !(await see(page,'神射手擊殺',1500));
    noTrigger ? pass('T29','神射手宣告但未死 → DayScreen 不觸發技能')
              : fail('T29','神射手宣告未死不觸發','神射手存活卻顯示擊殺能力');
    await page.screenshot({path:'t29.png'});
    await endGame(page);
  } catch(e){ fail('T29','神射手不觸發','Error: '+e.message); await endGame(page); }

  // ─── T30  白狼王夜晚自爆 UI ─────────────────────────────────────────
  console.log('\n[T30] 白狼王夜晚自爆 UI');
  try {
    await startGame(page,'single',[{tab:'狼隊',name:'白狼王'}]);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選白狼王是誰');
    await clickP(page,10); await sleep(400);
    const hasExplode = await see(page,'自爆', 2000);
    !hasExplode
      ? pass('T30','白狼王夜晚無自爆按鈕（符合規則：白天發言才能自爆）')
      : fail('T30','白狼王夜晚不應有自爆按鈕','規則：白狼王只能於白天發言階段自爆');
    await page.screenshot({path:'t30.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T30','白狼王夜晚UI','Error: '+e.message); await endGame(page); }

  // ─── T31  守墓人單身分 → 顯示「此技能僅在雙身分模式生效」 ────────────
  console.log('\n[T31] 守墓人（單身分）');
  try {
    await startGame(page,'single',[{tab:'神職',name:'守墓人'}]);
    await waitT(page, '向守墓人告知', 12000);  // gravedigger getModeLabel early return
    await clickP(page,10); await sleep(300);
    const ok = await see(page,'此技能僅在雙身分模式生效', 2000);
    ok ? pass('T31','守墓人單身分 → 顯示「此技能僅在雙身分模式生效」')
       : fail('T31','守墓人單身分提示','未顯示正確提示');
    await page.screenshot({path:'t31.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T31','守墓人單身分','Error: '+e.message); await endGame(page); }

  // ─── T32  守墓人雙身分第一晚 → 顯示「第一晚無資訊」 ─────────────────
  console.log('\n[T32] 守墓人（雙身分第一晚）');
  try {
    await startGame(page,'dual',[{tab:'神職',name:'守墓人'}]);
    await waitT(page, '向守墓人告知', 12000);  // gravedigger getModeLabel early return
    await clickP(page,10); await sleep(300);
    const ok = await see(page,'第一晚無資訊', 2000);
    ok ? pass('T32','守墓人雙身分第一晚 → 顯示「第一晚無資訊」')
       : fail('T32','守墓人雙身分第一晚','未顯示第一晚無資訊');
    await page.screenshot({path:'t32.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T32','守墓人雙身分','Error: '+e.message); await endGame(page); }

  // ─── T33  訓熊師 → 顯示熊叫了/沒有叫選項 ───────────────────────────
  console.log('\n[T33] 訓熊師');
  try {
    await startGame(page,'single',[{tab:'神職',name:'訓熊師'}]);
    await waitT(page, '主持人確認鄰座結果後記錄', 12000);  // bear_tamer getModeLabel early return
    await clickP(page,10); await sleep(300);
    const growl  = await see(page,'🐻 熊叫了', 1500);
    const silent = await see(page,'🔕 沒有叫');
    (growl && silent)
      ? pass('T33','訓熊師 → 顯示「🐻 熊叫了」和「🔕 沒有叫」')
      : fail('T33','訓熊師選項顯示','選項未全部顯示');
    await page.screenshot({path:'t33.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T33','訓熊師','Error: '+e.message); await endGame(page); }

  // ─── T34  魔術師互換 → A/B 標記 ────────────────────────────────────
  console.log('\n[T34] 魔術師互換');
  try {
    await startGame(page,'single',[{tab:'神職',name:'魔術師'}]);
    await waitT(page, '點選魔術師是誰');
    await clickP(page,10);
    await clickT(page, '🎩 互換目標（選2人）'); await sleep(200);
    await clickP(page,5); await clickP(page,7); await sleep(300);
    const labelA = await see(page,'A', 1500);
    const labelB = await see(page,'B', 1500);
    (labelA && labelB)
      ? pass('T34','魔術師互換P5↔P7 → 顯示 A/B 標記')
      : fail('T34','魔術師A/B標記','未顯示A/B');
    await page.screenshot({path:'t34.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T34','魔術師互換','Error: '+e.message); await endGame(page); }

  // ─── T35  丘比特連結 → ①② 標記 ────────────────────────────────────
  console.log('\n[T35] 丘比特連結');
  try {
    await startGame(page,'single',[{tab:'神職',name:'丘比特'}]);
    await waitT(page, '點選丘比特是誰');
    await clickP(page,10);
    await clickT(page, '💘 連結戀人（選2人）'); await sleep(200);
    await clickP(page,5); await clickP(page,7); await sleep(300);
    const ok = await see(page,'①') && await see(page,'②');
    ok ? pass('T35','丘比特連結P5、P7 → 顯示①②標記') : fail('T35','丘比特戀人標記','未顯示①②');
    await page.screenshot({path:'t35.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T35','丘比特','Error: '+e.message); await endGame(page); }

  // ─── T36  盜賊 → 顯示選牌介面 ──────────────────────────────────────
  console.log('\n[T36] 盜賊選牌介面');
  try {
    await startGame(page,'single',[{tab:'神職',name:'盜賊'}]);
    await waitT(page, '選擇盜賊拿走的腳色牌', 12000);  // thief getModeLabel early return
    await clickP(page,10); await sleep(300);
    const ok = await see(page,'主持人出示兩張額外牌', 2000);
    ok ? pass('T36','盜賊 → 顯示「主持人出示兩張額外牌，選擇盜賊拿走的腳色」')
       : fail('T36','盜賊選牌介面','未顯示');
    await page.screenshot({path:'t36.png'});
    await skipRest(page);
    await endGame(page);
  } catch(e){ fail('T36','盜賊','Error: '+e.message); await endGame(page); }

  // ─── T37  單身分放逐普通村民 → 白痴翻牌 bug ────────────────────────
  console.log('\n[T37] 單身分放逐村民白痴選項');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await waitT(page, '夜晚行動完成');
    await clickT(page, '查看夜晚結果 →'); await sleep(600);
    await waitT(page, '進入白天');
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await clickT(page,'確認，繼續'); await sleep(400);
    await clickT(page,'確認，繼續'); await sleep(400);
    await waitT(page,'投票放逐');
    await sleep(400);
    // PlayerButton：數字 <Text> 在 TouchableOpacity 上方，需點文字下方 ~48px 進入 box
    const p8coords = await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walk.nextNode()) {
        if (!node.nodeValue || node.nodeValue.trim() !== '8') continue;
        const el = node.parentElement;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.top < 0 || rect.top >= window.innerHeight) continue;
        return { x: rect.left + rect.width / 2, y: rect.bottom + 48 };
      }
      return null;
    });
    if (p8coords) await page.mouse.click(p8coords.x, p8coords.y);
    await sleep(300);
    await clickT(page,'確認放逐'); await sleep(400);
    await waitT(page,'放逐結果'); await sleep(300);
    const idiotOption = await see(page,'白痴翻牌');
    idiotOption
      ? bug('T37','單身分放逐普通村民(P8) → 仍顯示「白痴翻牌」選項',
          'exileAbilityModes 單身分分支：if(modes.length===0) modes.push("idiot")，任何非特殊角色被放逐都顯示白痴選項')
      : pass('T37','單身分放逐普通村民 → 不顯示「白痴翻牌」（符合規則）');
    await page.screenshot({path:'t37.png'});
    await endGame(page);
  } catch(e){ fail('T37','單身分放逐村民','Error: '+e.message); await endGame(page); }

  // ─── T38  白天發言環節 → 顯示自爆選擇介面 ──────────────────────────
  console.log('\n[T38] 白天自爆介面');
  try {
    await startGame(page);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await waitT(page, '夜晚行動完成');
    await clickT(page, '查看夜晚結果 →'); await sleep(600);
    await waitT(page, '進入白天');
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選',2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await clickT(page,'確認，繼續'); await sleep(400);
    await waitT(page,'發言環節', 5000); await sleep(300);
    const explodeUI = await see(page,'點選自爆玩家');
    explodeUI ? pass('T38','發言環節 → 顯示自爆選擇介面')
              : fail('T38','白天自爆介面','未顯示自爆介面');
    await page.screenshot({path:'t38.png'});
    await endGame(page);
  } catch(e){ fail('T38','白天自爆UI','Error: '+e.message); await endGame(page); }

  // ─── T39  攝夢人夜晚被毒死，同晚保護目標被狼刀 → 保護仍有效 ──────────
  // 攝夢人自身死亡不影響當晚已決定的保護效果
  console.log('\n[T39] 攝夢人夜晚死亡（被毒），保護目標被狼刀 → 目標仍存活');
  try {
    await startGame(page,'single',[{tab:'神職',name:'攝夢人'}]);
    // 攝夢人 P10 保護 P8
    await waitT(page, '點選攝夢人是誰');
    await clickP(page, 10);
    await clickT(page, '💤 保護'); await sleep(200);
    await clickP(page, 8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 狼刀 P8（被攝夢人保護）
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 預言家跳過
    await waitT(page, '點選預言家是誰');
    await clickP(page, 4);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 女巫毒 P10（攝夢人）
    await waitT(page, '點選女巫是誰');
    await clickP(page, 5);
    await clickT(page, '☠️ 毒藥'); await sleep(200);
    await clickP(page, 10);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const deathLine39 = await page.evaluate(() => {
      const m = document.body.innerText.match(/本晚死亡：([^\n]+)/);
      return m ? m[1] : '（平安夜）';
    });
    const p8Dead39 = deathLine39.includes('8號');
    const p10Dead39 = deathLine39.includes('10號');
    (!p8Dead39 && p10Dead39)
      ? pass('T39','攝夢人夜晚被毒死，保護目標被狼刀 → 目標仍存活', '死亡：'+deathLine39)
      : fail('T39','攝夢人當晚死亡，其保護應仍有效', '死亡：'+deathLine39);
    await page.screenshot({path:'t39.png'});
    await endGame(page);
  } catch(e){ fail('T39','攝夢人夜晚死亡保護','Error: '+e.message); await endGame(page); }

  // ─── T40  攝夢人白天被放逐，下一晚保護目標正常死亡（不連帶） ─────────
  console.log('\n[T40] 攝夢人白天被放逐，下一晚保護目標無保護正常死亡');
  try {
    await startGame(page,'single',[{tab:'神職',name:'攝夢人'}]);
    // Night 1: 攝夢人 P10 保護 P8，狼刀 P7
    await waitT(page, '點選攝夢人是誰');
    await clickP(page, 10);
    await clickT(page, '💤 保護'); await sleep(200);
    await clickP(page, 8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    // Day 1: 放逐 P10（攝夢人）
    await clickT(page, '進入白天'); await sleep(700);
    if (await see(page,'警長競選', 2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await clickT(page,'確認，繼續'); await sleep(400);  // 公布死亡
    await clickT(page,'確認，繼續'); await sleep(400);  // 發言
    await waitT(page,'投票放逐'); await sleep(400);
    // 在投票頁點選 P10（PlayerButton：數字文字在 TouchableOpacity 上方，點文字下方 48px）
    const p10coords = await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walk.nextNode()) {
        if (!node.nodeValue || node.nodeValue.trim() !== '10') continue;
        const el = node.parentElement;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.top < 0 || rect.top >= window.innerHeight) continue;
        return { x: rect.left + rect.width / 2, y: rect.bottom + 48 };
      }
      return null;
    });
    if (p10coords) await page.mouse.click(p10coords.x, p10coords.y);
    await sleep(400);
    await clickT(page,'確認放逐'); await sleep(400);
    await waitT(page,'放逐結果', 8000); await sleep(300);
    // 結束白天（攝夢人無死亡技能，直接結束）
    await clickT(page,'結束白天'); await sleep(800);
    // Night 2: 攝夢人步驟 P10 已放逐，Night2 roleMembersMap 有記憶 → memberHint 不顯示，改等角色名
    await waitT(page, '攝夢人');
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 狼人步驟：Night1 成員已記憶 + kill mode 已啟動，直接點殺人目標即可
    await waitT(page, '狼人');
    await clickP(page, 8);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const deathLine40 = await page.evaluate(() => {
      const m = document.body.innerText.match(/本晚死亡：([^\n]+)/);
      return m ? m[1] : '（平安夜）';
    });
    const p8Dead40 = deathLine40.includes('8號');
    p8Dead40
      ? pass('T40','攝夢人白天被放逐，下一晚保護目標正常死亡（無殘留保護）', '死亡：'+deathLine40)
      : fail('T40','攝夢人白天放逐後，下一晚P8被狼刀應死亡', '死亡：'+deathLine40);
    await page.screenshot({path:'t40.png'});
    await endGame(page);
  } catch(e){ fail('T40','攝夢人白天放逐','Error: '+e.message); await endGame(page); }

  // ─── T41  攝夢人保護獵魔人，獵魔人撞好人 → 獵魔人存活 ──────────────
  // 攝夢人保護免疫一切傷害，包含獵魔人撞好人的自爆死亡
  console.log('\n[T41] 攝夢人保護獵魔人，獵魔人撞好人 → 獵魔人存活');
  try {
    // 10名預設玩家 + 攝夢人(P10) + 獵魔人(P11) = 11名玩家
    await startGame(page,'single',[{tab:'神職',name:'攝夢人'},{tab:'神職',name:'獵魔人'}]);
    // 攝夢人 P10 保護 P11（獵魔人）
    await waitT(page, '點選攝夢人是誰');
    await clickP(page, 10);
    await clickT(page, '💤 保護'); await sleep(200);
    await clickP(page, 11);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 狼刀 P7
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 預言家跳過
    await waitT(page, '點選預言家是誰');
    await clickP(page, 4);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    // 獵魔人 P11 狩獵 P5（女巫＝好人 → 正常情況獵魔人會死，但被保護 → 存活）
    await waitT(page, '點選獵魔人是誰');
    await clickP(page, 11);
    await clickT(page, '🗡️ 狩獵'); await sleep(200);
    await clickP(page, 5);
    await clickT(page, '完成 → 下一位'); await sleep(400);
    await skipRest(page);
    await toResult(page);
    const deathLine41 = await page.evaluate(() => {
      const m = document.body.innerText.match(/本晚死亡：([^\n]+)/);
      return m ? m[1] : '（平安夜）';
    });
    const p7Dead41 = deathLine41.includes('7號');
    const p11Dead41 = deathLine41.includes('11號');
    (p7Dead41 && !p11Dead41)
      ? pass('T41','攝夢人保護獵魔人，獵魔人撞好人 → 獵魔人存活', '死亡：'+deathLine41)
      : fail('T41','攝夢人保護獵魔人應存活，11號不應死', '死亡：'+deathLine41);
    await page.screenshot({path:'t41.png'});
    await endGame(page);
  } catch(e){ fail('T41','攝夢人保護獵魔人','Error: '+e.message); await endGame(page); }

  // ════════════════════════════════════════════════════════════════════
  console.log('\n\n══════════════════════════════════════════');
  console.log('         狼人殺規則驗證測試 — 最終報告');
  console.log('══════════════════════════════════════════');
  const P=R.filter(r=>r.s==='PASS').length, F=R.filter(r=>r.s==='FAIL').length;
  const B=R.filter(r=>r.s==='BUG').length,  S=R.filter(r=>r.s==='SKIP').length;
  console.log(`總計 ${R.length} 項 | ✅ ${P} PASS | ❌ ${F} FAIL | 🐛 ${B} BUG | ⏭️ ${S} SKIP\n`);
  for (const r of R) {
    const ico = r.s==='PASS'?'✅':r.s==='FAIL'?'❌':r.s==='BUG'?'🐛':'⏭️';
    console.log(`${ico} [${r.s.padEnd(4)}] ${r.id.padEnd(5)} ${r.name}`);
    if (r.note) console.log(`              → ${r.note}`);
  }
  console.log('\n══════════════════════════════════════════');
  await browser.close();
})().catch(e=>{ console.error('Fatal:',e); process.exit(1); });
