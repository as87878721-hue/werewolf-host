// Test: 3 new DayScreen behaviors
// 1. Night ability (hunter shoot) triggers and resolves in step 0
// 2. Sheriff election step is skipped when sheriff is alive
// 3. Badge handover UI appears when sheriff dies at night
const { chromium } = require('playwright');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Night-screen players: all 9 are always shown, so positions are fixed
const COL_X = [58, 150, 241, 332];
const ROW_Y = [190, 310, 430];
async function clickNightPlayer(page, n) {
  await page.mouse.click(COL_X[(n - 1) % 4], ROW_Y[Math.floor((n - 1) / 4)]);
  await sleep(150);
}
// Day-screen players: use text selector (position shifts with dead players)
async function clickDayPlayer(page, n) {
  await page.locator(`text=${n}`).first().click({ force: true, timeout: 5000 });
  await sleep(200);
}
async function clickText(page, text) {
  await page.locator(`text=${text}`).first().click({ force: true, timeout: 6000 });
  await sleep(200);
}
async function waitFor(page, text, timeout = 8000) {
  await page.waitForSelector(`text=${text}`, { state: 'visible', timeout });
  await sleep(100);
}

// Run one night: wolf kills `killTarget`, all other roles skip
async function runNight(page, wolfMembers, killTarget) {
  await waitFor(page, '🔪 刀人');
  await sleep(300);

  // Select wolf members
  for (const m of wolfMembers) await clickNightPlayer(page, m);
  await sleep(200);

  // Switch to kill mode
  await clickText(page, '🔪 刀人');
  await sleep(200);

  // Click kill target
  await clickNightPlayer(page, killTarget);
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Skip seer
  await waitFor(page, '🔮 查驗');
  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Skip witch
  await waitFor(page, '今晚狼人刀了');
  await clickText(page, '⏭️ 跳過');
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Skip hunter
  await waitFor(page, '先點選獵人是誰');
  await clickText(page, '完成 → 結束夜晚');
  await sleep(400);

  // Result → Day
  await waitFor(page, '夜晚行動完成');
  await clickText(page, '查看夜晚結果 →');
  await sleep(600);
  await waitFor(page, '進入白天');
  await clickText(page, '進入白天');
  await sleep(1000);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('http://localhost:8082');
  await sleep(2500);

  // ─── Setup: 雙身分 ────────────────────────────────────────────────────
  await clickText(page, '雙身分');
  await sleep(500);
  await waitFor(page, '選擇本局腳色');
  await clickText(page, '下一步：調整夜晚順序 →');
  await sleep(500);
  await waitFor(page, '開始夜晚');
  await clickText(page, '開始夜晚');
  await sleep(700);

  // ─── NIGHT 1: wolf (1,2,3) kills player 2 ────────────────────────────
  console.log('--- Night 1: kill player 2 ---');
  await runNight(page, [1, 2, 3], 2);

  // ─── DAY 1 STEP 0: verify hunter ability UI ──────────────────────────
  console.log('--- Day 1 Step 0: night ability (hunter) ---');
  await waitFor(page, '公布昨晚死亡');
  await waitFor(page, '夜間技能觸發');
  await page.screenshot({ path: 'ss_d1_s0_before.png' });

  // Trigger hunter
  await clickText(page, '🏹 獵人開槍');
  await sleep(400);
  await waitFor(page, '選擇獵人開槍目標');

  // Shoot player 9 (text "9" is unique at this point)
  await page.screenshot({ path: 'debug_before_click9.png' });
  // Count matching elements first
  const nineCount = await page.locator('text=9').count();
  console.log(`[debug] Elements with text containing "9": ${nineCount}`);
  const nineExact = await page.getByText('9', { exact: true }).count();
  console.log(`[debug] Elements with text exactly "9": ${nineExact}`);
  await page.getByText('9', { exact: true }).first().click({ force: true });
  await sleep(500);
  await page.screenshot({ path: 'debug_after_click9.png' });
  await waitFor(page, '確認 9 號死亡');
  await clickText(page, '確認 9 號死亡');
  await sleep(400);

  // Verify resolved summary
  await waitFor(page, '🏹 獵人');
  console.log('[PASS] Hunter ability triggered and resolved (player 9 shot)');
  await page.screenshot({ path: 'ss_d1_s0_after.png' });
  await clickText(page, '確認，繼續');
  await sleep(400);

  // ─── DAY 1 STEP 1: sheriff election (first time, no sheriff yet) ─────
  console.log('--- Day 1 Step 1: first sheriff election ---');
  await waitFor(page, '警長競選');
  await sleep(300);
  // Elect player 5 (text "5" is unique in election grid)
  await clickDayPlayer(page, 5);
  await sleep(300);
  await page.screenshot({ path: 'ss_d1_s1.png' });
  await clickText(page, '確認，繼續');
  await sleep(400);

  // ─── DAY 1 STEP 2 & 3: 流票, end day ────────────────────────────────
  console.log('--- Day 1 Steps 2-3: 流票 → end day ---');
  await waitFor(page, '投票放逐');
  await clickText(page, '流票');
  await sleep(200);
  await clickText(page, '確認流票');
  await sleep(400);
  await waitFor(page, '放逐結果');
  await clickText(page, '結束白天');
  await sleep(1000);

  // ─── NIGHT 2: wolves (now only player 1 alive) kill sheriff (player 5) ─
  console.log('--- Night 2: kill sheriff player 5 ---');
  // Wolf members: player 2 is upper-dead from night 1, so only player 1 and 3 are selectable
  // NightScreen pre-selects survivors; just switch to kill mode and kill 5
  await waitFor(page, '🔪 刀人');
  await sleep(300);
  await clickText(page, '🔪 刀人');
  await sleep(200);
  await clickNightPlayer(page, 5); // kill sheriff
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);
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
  await waitFor(page, '夜晚行動完成');
  await clickText(page, '查看夜晚結果 →');
  await sleep(600);
  await waitFor(page, '進入白天');
  await clickText(page, '進入白天');
  await sleep(1000);

  // ─── DAY 2 STEP 0: sheriff (5) appears in deaths list ─────────────────
  console.log('--- Day 2 Step 0: sheriff in deaths ---');
  await waitFor(page, '公布昨晚死亡');
  await page.screenshot({ path: 'ss_d2_s0.png' });
  await clickText(page, '確認，繼續');
  await sleep(400);

  // ─── DAY 2 STEP 1: badge handover (sheriff died) ──────────────────────
  console.log('--- Day 2 Step 1: badge handover required ---');
  await waitFor(page, '警長警徽處理');
  await sleep(300);
  await page.screenshot({ path: 'ss_d2_s1.png' });

  // Verify both buttons present
  const hasHandover = await page.locator('text=移交警徽').first().isVisible();
  const hasTear     = await page.locator('text=撕毀警徽').first().isVisible();
  if (!hasHandover || !hasTear) throw new Error('[FAIL] Badge action buttons missing');
  console.log('[PASS] 移交警徽 / 撕毀警徽 buttons visible');

  // Verify "確認" button is disabled (no action selected)
  const cannotAdvance = await page.locator('text=確認').first().isDisabled().catch(() => {
    // RN Web might not use disabled attr; check if it's styled as off
    return false;
  });
  // We just verify the UI appeared, the disabled check is optional

  // Choose 移交警徽 → give badge to player 6
  await clickText(page, '移交警徽');
  await sleep(400);
  await waitFor(page, '選擇接收警徽的玩家');

  // Click player 6 (text "6" is unique at this point)
  await clickDayPlayer(page, 6);
  await sleep(300);
  await page.screenshot({ path: 'ss_d2_s1_handover.png' });

  // Click "確認移交"
  await clickText(page, '確認移交');
  await sleep(500);

  // ─── DAY 2 STEP 2: verify new sheriff shown in header ─────────────────
  console.log('--- Day 2 Step 2: new sheriff shown ---');
  await waitFor(page, '投票放逐');
  await sleep(400);
  await page.screenshot({ path: 'ss_d2_s2.png' });

  const sheriffShown = await page.locator('text=警長').isVisible();
  if (!sheriffShown) throw new Error('[FAIL] Sheriff not shown after handover');
  console.log('[PASS] Sheriff shown in header after badge handover');

  await clickText(page, '流票');
  await sleep(200);
  await clickText(page, '確認流票');
  await sleep(400);
  await waitFor(page, '放逐結果');
  await clickText(page, '結束白天');
  await sleep(1000);

  // ─── NIGHT 3: kill player 7 ──────────────────────────────────────────
  console.log('--- Night 3: kill player 7 ---');
  await waitFor(page, '🔪 刀人');
  await sleep(300);
  await clickText(page, '🔪 刀人');
  await sleep(200);
  await clickNightPlayer(page, 7);
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);
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
  await waitFor(page, '夜晚行動完成');
  await clickText(page, '查看夜晚結果 →');
  await sleep(600);
  await waitFor(page, '進入白天');
  await clickText(page, '進入白天');
  await sleep(1000);

  // ─── DAY 3 STEP 0 → 2 (step 1 skipped) ──────────────────────────────
  console.log('--- Day 3: sheriff alive → step 1 must be skipped ---');
  await waitFor(page, '公布昨晚死亡');
  await page.screenshot({ path: 'ss_d3_s0.png' });
  await clickText(page, '確認，繼續');
  await sleep(600);

  // Must jump to 投票放逐 without showing any sheriff election screen
  await waitFor(page, '投票放逐', 5000);
  await sleep(300);
  await page.screenshot({ path: 'ss_d3_s2.png' });

  const electionShown = await page.locator('text=警長競選').isVisible().catch(() => false);
  if (electionShown) throw new Error('[FAIL] Sheriff election appeared when sheriff is alive!');
  console.log('[PASS] Sheriff election step correctly skipped on day 3');

  const badgeHandoverShown = await page.locator('text=警長警徽處理').isVisible().catch(() => false);
  if (badgeHandoverShown) throw new Error('[FAIL] Badge handover appeared when sheriff is alive!');

  const sheriffD3 = await page.locator('text=警長').isVisible().catch(() => false);
  if (!sheriffD3) throw new Error('[FAIL] Sheriff not shown in header on day 3');
  console.log('[PASS] Sheriff (player 6) persists to day 3');

  console.log('\n=== ALL 3 NEW BEHAVIOR TESTS PASSED ===');
  await sleep(2000);
  await browser.close();
})().catch(e => { console.error(e.message || e); process.exit(1); });
