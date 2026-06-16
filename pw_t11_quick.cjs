/**
 * T11 快速驗證：血月發動後進入白天 step1 是否顯示「血月」說明
 */
const { chromium } = require('playwright');

const VIEWPORT = { width: 430, height: 900 };
const COL_X = [58, 150, 241, 332];
const ROW_Y  = [190, 310, 430];
function coord(n) { return { x: COL_X[(n-1)%4], y: ROW_Y[Math.floor((n-1)/4)] }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickP = async (page, n) => { const {x,y}=coord(n); await page.mouse.click(x,y); await sleep(150); };

async function waitT(page, txt, to=12000) {
  await page.waitForFunction(
    t => { try { return document.body.innerText.includes(t); } catch(e) { return false; } },
    txt, { timeout: to }
  );
  await sleep(80);
}
async function see(page, txt, to=2500) {
  try {
    await page.waitForFunction(
      t => { try { return document.body.innerText.includes(t); } catch(e) { return false; } },
      txt, { timeout: to }
    );
    return true;
  } catch { return false; }
}
async function clickT(page, txt, to=8000) {
  await waitT(page, txt, to);
  const coords = await page.evaluate(t => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walk.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.includes(t)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight)
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }, txt);
  if (coords) await page.mouse.click(coords.x, coords.y);
  else await page.locator(`text=${txt}`).first().click({ timeout: 3000, force: true });
  await sleep(250);
}

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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  try {
    // 啟動遊戲 + 加血月
    await page.goto('http://localhost:8082');
    await sleep(2200);
    await clickT(page, '單身分');
    await waitT(page, '狼隊', 10000);
    await sleep(300);
    await addRole(page, '狼隊', '血月使徒');
    await clickT(page, '下一步');
    await waitT(page, '開始夜晚');
    await sleep(300);
    await clickT(page, '開始夜晚');
    await sleep(700);

    // 血月步驟（order 8，排在狼前）
    await waitT(page, '選擇是否發動技能', 12000);
    await clickP(page, 10);  // 設定血月成員
    await clickT(page, '🌑 發動技能'); await sleep(300);
    await clickT(page, '完成 → 下一位'); await sleep(400);

    // 狼刀 P7
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);

    // 跳過其他步驟
    for (let i=0; i<18; i++) {
      if (await see(page, '夜晚行動完成', 400)) break;
      if (await see(page, '完成 → 結束夜晚', 600)) { await clickT(page, '完成 → 結束夜晚'); break; }
      const clicked = await page.evaluate(() => {
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walk.nextNode()) {
          if (!node.nodeValue || !node.nodeValue.includes('完成 → 下一位')) continue;
          const el = node.parentElement;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight)
            { el.click(); return true; }
        }
        return false;
      });
      await sleep(400);
      if (!clicked && i > 8) break;
    }

    // 進結果頁
    await waitT(page, '夜晚行動完成');
    await sleep(300);
    await clickT(page, '查看夜晚結果 →');
    await sleep(800);
    await waitT(page, '進入白天', 10000);
    await sleep(300);

    // 進入白天
    await clickT(page, '進入白天'); await sleep(700);

    // 跳過 step 0（警長）
    if (await see(page,'警長競選', 2000)) { await clickT(page,'確認，繼續'); await sleep(400); }

    // 到 step 1（公布昨晚死亡）
    await waitT(page,'公布昨晚死亡', 5000);
    await sleep(300);

    const found = await see(page,'血月');
    if (found) {
      console.log('✅ T11 PASS：DayScreen step1 顯示「血月」說明');
    } else {
      console.log('❌ T11 FAIL：step1 未見「血月」文字');
      // 印出 innerText 輔助診斷
      const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
      console.log('── 當前 innerText ──\n' + txt);
    }
    await page.screenshot({ path: 't11_quick.png' });
  } catch(e) {
    console.log('❌ T11 ERROR:', e.message);
    await page.screenshot({ path: 't11_quick_err.png' });
  }

  await browser.close();
})();
