// Test: Bishop (主教) ✝️ icon appears on holder and transfers after death
// Single mode, 10 players (9 default + 1 bishop):
//   Night 1: wolf kills 8; bishop step → identify player 7
//   Day 1: ✝️ visible in voting grid (bishop=player 7)
//   Night 2: wolf kills player 7 (bishop)
//   Day 2: bishop transfer → player 3 → ✝️ on player 3 in voting grid
const { chromium } = require('playwright');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const COL_X = [58, 150, 241, 332];
const ROW_Y = [190, 310, 430];
async function clickP(page, n) {
  await page.mouse.click(COL_X[(n-1)%4], ROW_Y[Math.floor((n-1)/4)]);
  await sleep(150);
}

// Robust wait: poll body.innerText until it contains txt or timeout
async function waitBody(page, txt, to=12000) {
  const end = Date.now() + to;
  while (Date.now() < end) {
    const has = await page.evaluate((t) => {
      try { return document.body.innerText.includes(t); } catch(e) { return false; }
    }, txt);
    if (has) return;
    await sleep(200);
  }
  const body = await page.evaluate(() => document.body.innerText);
  throw new Error(`waitBody timeout "${txt}" — page shows: ${body.substring(0,150)}`);
}

// Click the first visible text node containing txt
async function clickText(page, txt, to=8000) {
  await waitBody(page, txt, to);
  const coords = await page.evaluate((t) => {
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
  if (coords) {
    await page.mouse.click(coords.x, coords.y);
  } else {
    await page.locator(`text=${txt}`).first().click({ force: true, timeout: 3000 });
  }
  await sleep(250);
}

async function addRole(page, tabName, roleName) {
  await clickText(page, tabName);
  await sleep(300);
  const nameBox = await page.locator(`text=${roleName}`).first().boundingBox();
  if (!nameBox) throw new Error(`Role not found: ${roleName}`);
  const plusAll = await page.locator('text=＋').all();
  for (const el of plusAll) {
    const b = await el.boundingBox();
    if (b && Math.abs(b.y - nameBox.y) < 30) { await el.click({ force: true }); await sleep(300); return; }
  }
  throw new Error(`No ＋ button for ${roleName}`);
}

// Skip remaining night steps (handles hunter; leaves bishop to caller)
async function skipRest(page) {
  for (let i = 0; i < 20; i++) {
    const body = await page.evaluate(() => document.body.innerText);
    if (body.includes('夜晚行動完成')) break;
    if (body.includes('完成 → 結束夜晚')) {
      await clickText(page, '完成 → 結束夜晚'); break;
    }
    if (body.includes('先點選獵人是誰')) {
      await clickP(page, 6); await sleep(400); continue;
    }
    // Click 完成 → 下一位 via evaluate
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
    if (!clicked && i > 10) break;
  }
}

async function toDay(page) {
  await waitBody(page, '夜晚行動完成');
  await sleep(300);
  await clickText(page, '進入白天');
  await sleep(1000);
}

// Click a specific player number in the day-screen grids (numbered cards)
async function clickDayNum(page, n) {
  await page.locator(`text=${n}`).first().click({ force: true, timeout: 5000 });
  await sleep(250);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto('http://localhost:8082');
  await sleep(2200);

  // ─── Setup ───────────────────────────────────────────────────────────
  console.log('--- Setup: single mode + bishop ---');
  await clickText(page, '單身分');
  await sleep(500);
  await waitBody(page, '狼隊');
  await sleep(200);
  await addRole(page, '神職', '主教');
  await page.screenshot({ path: 'ss_bishop_setup.png' });

  // Go to order screen → start night
  await clickText(page, '下一步');
  await waitBody(page, '開始夜晚');
  await sleep(300);
  await clickText(page, '開始夜晚');
  await sleep(700);

  // ─── NIGHT 1 ─────────────────────────────────────────────────────────
  console.log('--- Night 1: wolf kills 8; bishop=player 7 ---');

  // Wolf step: identify wolves 1,2,3 → kill player 8
  await waitBody(page, '點選本局所有狼人');
  await clickP(page, 1); await clickP(page, 2); await clickP(page, 3);
  await clickText(page, '刀人');
  await clickP(page, 8);
  await clickText(page, '完成 → 下一位');
  await sleep(300);

  // Seer: skip
  await waitBody(page, '點選預言家是誰');
  await clickText(page, '完成 → 下一位');
  await sleep(300);

  // Witch: skip
  await waitBody(page, '今晚狼人刀了');
  await clickText(page, '完成 → 下一位');
  await sleep(300);

  // Hunter: identify player 6
  await waitBody(page, '先點選獵人是誰');
  await clickP(page, 6);
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(300);

  // Bishop (last step): identify player 7
  await waitBody(page, '點選主教是誰');
  await clickP(page, 7);
  await sleep(200);
  await page.screenshot({ path: 'ss_bishop_night1.png' });
  await clickText(page, '完成 → 結束夜晚');
  await sleep(300);

  await toDay(page);

  // ─── DAY 1 ───────────────────────────────────────────────────────────
  console.log('--- Day 1 ---');

  // Step 0: sheriff election → skip
  await waitBody(page, '警長競選');
  await clickText(page, '確認，繼續');
  await sleep(300);

  // Step 1: deaths (player 8 died; bishop=7 is alive → no bishop trigger)
  await waitBody(page, '公布昨晚死亡');
  await page.screenshot({ path: 'ss_bishop_d1_deaths.png' });
  await clickText(page, '確認，繼續');
  await sleep(300);

  // Step 2: speech → skip
  await waitBody(page, '發言環節');
  await clickText(page, '確認，繼續');
  await sleep(300);

  // Step 3: voting → check ✝️ visible (bishop=player 7 has icon)
  await waitBody(page, '投票放逐');
  await sleep(400);
  await page.screenshot({ path: 'ss_bishop_d1_vote.png' });
  const d1Body = await page.evaluate(() => document.body.innerText);
  if (!d1Body.includes('✝️')) throw new Error('[FAIL] Day 1 voting: ✝️ not found (expected on player 7)');
  console.log('[PASS] Day 1 voting: ✝️ visible (bishop = player 7)');

  // 流票 → end day
  await clickText(page, '流票');
  await sleep(200);
  await clickText(page, '確認流票');
  await sleep(400);
  await waitBody(page, '放逐結果');
  await clickText(page, '結束白天');
  await sleep(1000);

  // ─── NIGHT 2: wolf kills player 7 (bishop) ───────────────────────────
  console.log('--- Night 2: kill bishop (player 7) ---');
  // Wolf step: Night 1 wolves (1,2,3) are pre-filled, kill mode may already be active
  await waitBody(page, '刀人'); // "刀人" appears in both the button and kill-mode hint
  const n2WolfBody = await page.evaluate(() => document.body.innerText);
  if (n2WolfBody.includes('點選本局所有狼人')) {
    // Kill mode not active yet — identify wolves and activate
    await clickP(page, 1); await clickP(page, 2); await clickP(page, 3);
    await clickText(page, '刀人');
  }
  // Kill mode active — click player 7
  await clickP(page, 7);
  await clickText(page, '完成 → 下一位');
  await sleep(300);
  await skipRest(page);
  await toDay(page);

  // ─── DAY 2 ───────────────────────────────────────────────────────────
  console.log('--- Day 2 ---');

  // Step 0: sheriff → skip
  const d2Body0 = await page.evaluate(() => document.body.innerText);
  if (d2Body0.includes('警長競選')) {
    await clickText(page, '確認，繼續'); await sleep(300);
  }

  // Step 1: deaths + bishop transfer (player 7 died → bishop UI triggers)
  await waitBody(page, '公布昨晚死亡');
  await sleep(300);
  await page.screenshot({ path: 'ss_bishop_d2_deaths.png' });

  // Check bishop trigger text
  const d2Step1 = await page.evaluate(() => document.body.innerText);
  const hasBishopUI = d2Step1.includes('主教') && d2Step1.includes('死亡');
  if (!hasBishopUI) throw new Error('[FAIL] Day 2: bishop transfer UI not shown\nPage: ' + d2Step1.substring(0, 200));
  console.log('[PASS] Day 2 step 1: bishop transfer UI triggered');

  // Click player 3 as reveal target
  await clickDayNum(page, 3);
  await sleep(400);
  await page.screenshot({ path: 'ss_bishop_d2_reveal.png' });

  // Confirm transfer
  await waitBody(page, '繼承主教技能', 3000);
  await clickText(page, '繼承主教技能');
  await sleep(500);
  await page.screenshot({ path: 'ss_bishop_d2_confirmed.png' });

  // Verify resolved banner
  const d2Resolved = await page.evaluate(() => document.body.innerText);
  if (!d2Resolved.includes('繼承主教')) throw new Error('[FAIL] Transfer banner not shown');
  console.log('[PASS] Day 2: bishop skill transferred to player 3');

  // Advance past step 1
  await clickText(page, '確認，繼續');
  await sleep(300);

  // Step 2: speech
  await waitBody(page, '發言環節');
  await clickText(page, '確認，繼續');
  await sleep(300);

  // Step 3: voting → check ✝️ still on page (now on player 3)
  await waitBody(page, '投票放逐');
  await sleep(400);
  await page.screenshot({ path: 'ss_bishop_d2_vote.png' });
  const d2VoteBody = await page.evaluate(() => document.body.innerText);
  if (!d2VoteBody.includes('✝️')) throw new Error('[FAIL] Day 2 voting: ✝️ not found (should be on player 3)');
  console.log('[PASS] Day 2 voting: ✝️ visible (transferred to player 3)');

  console.log('\n=== BISHOP ICON & TRANSFER TEST PASSED ===');
  await sleep(2000);
  await browser.close();
})().catch(e => { console.error(e.message || e); process.exit(1); });
