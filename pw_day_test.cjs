// Quick smoke test for DayScreen
// Flow: 雙身分 → setup → order → night1(wolf kill 1, skip rest) → result → day screen
const { chromium } = require('playwright');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickText(page, text) {
  await page.locator(`text=${text}`).first().click({ force: true, timeout: 6000 });
  await sleep(200);
}
async function waitFor(page, text, timeout = 8000) {
  await page.waitForSelector(`text=${text}`, { state: 'visible', timeout });
  await sleep(100);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('http://localhost:8082');
  await sleep(2500);

  // Home → 雙身分
  await clickText(page, '雙身分');
  await sleep(500);

  // Setup → Order
  await waitFor(page, '選擇本局腳色');
  await clickText(page, '下一步：調整夜晚順序 →');
  await sleep(500);

  // Order → Night
  await waitFor(page, '開始夜晚');
  await clickText(page, '開始夜晚');
  await sleep(700);

  // Night 1: wolf step - click 1,2,3 then kill 1
  await waitFor(page, '🔪 刀人');
  await sleep(300);
  const COL_X = [58, 150, 241, 332];
  const ROW_Y = [190, 310, 430];
  const click = (n) => page.mouse.click(COL_X[(n-1)%4], ROW_Y[Math.floor((n-1)/4)]);
  await click(1); await click(2); await click(3); await sleep(200);
  await clickText(page, '🔪 刀人');
  await sleep(200);
  await click(1);
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Skip seer, witch, hunter
  await waitFor(page, '🔮 查驗');
  await clickText(page, '完成 → 下一位');
  await sleep(400);

  await waitFor(page, '今晚狼人刀了');
  await clickText(page, '⏭️ 跳過');
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);

  await waitFor(page, '先點選獵人是誰');
  await clickText(page, '完成 → 結束夜晚');
  await sleep(400);

  // Done → Result
  await waitFor(page, '夜晚行動完成');
  await clickText(page, '查看夜晚結果 →');
  await sleep(700);

  // Result → Day
  await waitFor(page, '進入白天');
  await page.screenshot({ path: 'ss_day_result.png' });
  console.log('[Result] screenshot saved');

  await clickText(page, '進入白天');
  await sleep(1000);

  // DayScreen step 0: deaths
  await waitFor(page, '公布昨晚死亡');
  await sleep(800);
  await page.screenshot({ path: 'ss_day_step0.png' });
  console.log('[Day Step 0] deaths screenshot saved');
  await clickText(page, '確認，繼續');
  await sleep(400);

  // Step 1: sheriff
  await waitFor(page, '警長競選');
  await sleep(600);
  await page.screenshot({ path: 'ss_day_step1.png' });
  console.log('[Day Step 1] sheriff screenshot saved');
  await clickText(page, '確認，繼續');
  await sleep(400);

  // Step 2: vote - click 流票
  await waitFor(page, '投票放逐');
  await sleep(600);
  await page.screenshot({ path: 'ss_day_step2.png' });
  console.log('[Day Step 2] vote screenshot saved');
  await clickText(page, '流票');
  await sleep(200);
  await clickText(page, '確認流票');
  await sleep(400);

  // Step 3: result
  await waitFor(page, '放逐結果');
  await sleep(800);
  await page.screenshot({ path: 'ss_day_step3.png' });
  console.log('[Day Step 3] result screenshot saved');

  // End day
  await clickText(page, '結束白天');
  await sleep(1000);

  // Should be on Night 2
  await waitFor(page, '🔪 刀人');
  await sleep(500);
  await page.screenshot({ path: 'ss_night2.png' });
  console.log('[Night 2] started successfully!');

  console.log('\n=== SMOKE TEST PASSED ===');
  await sleep(2000);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
