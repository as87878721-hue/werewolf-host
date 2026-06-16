/**
 * T37 快速驗證：單身分放逐普通村民是否出現「白痴翻牌」選項（bug 檢查）
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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  try {
    // 啟動預設遊戲（無額外角色）
    await page.goto('http://localhost:8082');
    await sleep(2200);
    await clickT(page, '單身分');
    await waitT(page, '狼隊', 10000);
    await sleep(300);
    await clickT(page, '下一步');
    await waitT(page, '開始夜晚');
    await sleep(300);
    await clickT(page, '開始夜晚');
    await sleep(700);

    // 狼刀 P7
    await waitT(page, '點選本局所有狼人');
    await clickP(page,1); await clickP(page,2); await clickP(page,3);
    await clickT(page, '🔪 刀人'); await clickP(page,7);
    await clickT(page, '完成 → 下一位'); await sleep(400);

    // 跳過其他步驟（預言家→女巫→獵人）
    for (let i=0; i<18; i++) {
      if (await see(page, '夜晚行動完成', 400)) break;
      if (await see(page, '完成 → 結束夜晚', 600)) { await clickT(page, '完成 → 結束夜晚'); break; }
      if (await see(page, '先點選獵人是誰', 400)) { await clickP(page, 6); await sleep(400); continue; }
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

    // 進結果頁 → 進白天
    await waitT(page, '夜晚行動完成');
    await sleep(300);
    await clickT(page, '查看夜晚結果 →');
    await sleep(800);
    await waitT(page, '進入白天', 10000);
    await sleep(300);
    await clickT(page, '進入白天'); await sleep(700);

    // 跳過 step 0（警長）、step 1（公布死亡）、step 2（發言）
    if (await see(page,'警長競選', 2000)) { await clickT(page,'確認，繼續'); await sleep(400); }
    await clickT(page,'確認，繼續'); await sleep(400);  // 公布死亡
    await clickT(page,'確認，繼續'); await sleep(400);  // 發言

    // step 3：投票放逐
    await waitT(page,'投票放逐');
    await sleep(400);

    // 印出可見文字，確認投票格子格式
    const visText = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('── 投票步驟 innerText ──\n' + visText + '\n──────────────────────');

    // 找 "8" 文字，點其下方 ~48px（PlayerButton box 中心）
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

    console.log('P8 click coords:', p8coords);

    if (p8coords) {
      await page.mouse.click(p8coords.x, p8coords.y);
    } else {
      console.log('⚠️  找不到 "8" 文字節點，嘗試截圖後中止');
      await page.screenshot({ path: 't37_no8text.png' });
      await browser.close(); return;
    }
    await sleep(500);

    // 確認是否選中 P8
    const afterClick = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('── 點擊後 innerText ──\n' + afterClick + '\n──────────────────────');

    // 點確認放逐
    await clickT(page,'確認放逐', 5000); await sleep(400);

    // step 4：放逐結果
    await waitT(page,'放逐結果', 8000); await sleep(300);
    await page.screenshot({ path: 't37_result.png' });

    const idiotOption = await see(page,'白痴翻牌');
    if (idiotOption) {
      console.log('🐛 T37 BUG：單身分放逐村民仍顯示「白痴翻牌」');
    } else {
      console.log('✅ T37 PASS：未顯示「白痴翻牌」（符合規則）');
    }

  } catch(e) {
    console.log('❌ T37 ERROR:', e.message);
    await page.screenshot({ path: 't37_err.png' });
  }

  await browser.close();
})();
