/**
 * Playwright dual-mode bug test
 *
 * Wait strategy (more robust, not modeLabel-dependent):
 *   Wolf step:   wait for "🔪 刀人"  button (always shown in wolf step)
 *   Seer step:   wait for "🔮 查驗"  button (always shown in seer step)
 *   Witch step:  wait for "今晚狼人刀了" text (always shown in witch step)
 *   Hunter step: wait for "先點選獵人是誰" text (no-member state in bottomHalf)
 *
 * Night 1: wolves=1,2,3, kill=1, skip all others
 * Night 2: wolves kill 1 again, player 1 (seer lower card) checks player 3, skip others
 * Night 3: screenshot wolf / seer / witch steps to verify bug fix
 */

const { chromium } = require('playwright');

const VIEWPORT = { width: 430, height: 900 };

// Player box coordinates (center of the TouchableOpacity box)
// effectiveWidth=390, btnSize=85, GAP=6, padH=16
const COL_X = [58, 150, 241, 332];
const ROW_Y = [190, 310, 430];

function playerCoord(n) {
  const col = (n - 1) % 4;
  const row = Math.floor((n - 1) / 4);
  return { x: COL_X[col], y: ROW_Y[row] };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickPlayer(page, n) {
  const { x, y } = playerCoord(n);
  await page.mouse.click(x, y);
  await sleep(200);
}

// force: true bypasses RN Web's CSS visibility quirks
async function clickText(page, text, timeout = 6000) {
  await page.locator(`text=${text}`).first().click({ timeout, force: true });
  await sleep(200);
}

async function waitForVisible(page, text, timeout = 10000) {
  await page.waitForSelector(`text=${text}`, { state: 'visible', timeout });
  await sleep(100);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  await page.goto('http://localhost:8082');
  await sleep(2500);
  await page.screenshot({ path: 'ss_t0_home.png' });
  console.log('[Home] loaded');

  // ── Home → Setup ──────────────────────────────────────────────────────
  await clickText(page, '雙身分');
  await sleep(600);

  // ── Setup → Order ─────────────────────────────────────────────────────
  await waitForVisible(page, '選擇本局腳色');
  await clickText(page, '下一步：調整夜晚順序 →');
  await sleep(600);

  // ── Order → Night ─────────────────────────────────────────────────────
  await waitForVisible(page, '開始夜晚');
  await clickText(page, '開始夜晚');
  await sleep(700);
  console.log('[Night 1] started');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── Night 1 ──────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Wolf step: members=[], activeKey=null → click players to add members
  await waitForVisible(page, '🔪 刀人');
  await sleep(300);
  await clickPlayer(page, 1);
  await clickPlayer(page, 2);
  await clickPlayer(page, 3);
  await sleep(200);
  await clickText(page, '🔪 刀人');
  await sleep(200);
  await clickPlayer(page, 1);
  await sleep(200);
  await page.screenshot({ path: 'ss_n1_wolf.png' });
  console.log('[N1 Wolf] wolves=1,2,3 kill=1');

  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Seer: skip
  await waitForVisible(page, '🔮 查驗');
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);
  console.log('[N1 Seer] skipped');

  // Witch: skip
  await waitForVisible(page, '今晚狼人刀了');
  await sleep(200);
  await clickText(page, '⏭️ 跳過');
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);
  console.log('[N1 Witch] skipped');

  // Hunter: last step
  await waitForVisible(page, '先點選獵人是誰');
  await sleep(200);
  await clickText(page, '完成 → 結束夜晚');
  await sleep(400);
  console.log('[N1 Hunter] skipped');

  // Done → Result
  await waitForVisible(page, '夜晚行動完成');
  await sleep(300);
  await clickText(page, '查看夜晚結果 →');
  await sleep(700);

  await waitForVisible(page, '進入白天');  // result screen unique text
  await sleep(300);
  await page.screenshot({ path: 'ss_n1_result.png' });
  console.log('[N1 Result] player 1 now in upperDeadPlayers');

  await clickText(page, '進入白天');
  await sleep(1000);
  console.log('[Night 2] started');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── Night 2 ──────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Wolf step: wolves 2,3 pre-selected, activeKey='kill' from start.
  // Clicking player 1 sets kill target (not member).
  await waitForVisible(page, '🔪 刀人');
  await sleep(500);
  await page.screenshot({ path: 'ss_n2_wolf_before.png' });
  console.log('[N2 Wolf] step loaded (2,3 pre-selected, activeKey=kill)');

  await clickPlayer(page, 1);  // kill target = 1
  await sleep(200);
  await page.screenshot({ path: 'ss_n2_wolf_kill.png' });
  console.log('[N2 Wolf] kill=1');

  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Seer: no pre-selection (members=[] from night 1 skip).
  // Click player 1 (in upperDeadPlayers, isDead=false) to mark as seer.
  await waitForVisible(page, '🔮 查驗');
  await sleep(300);
  await page.screenshot({ path: 'ss_n2_seer_before.png' });
  console.log('[N2 Seer] no pre-selection');

  await clickPlayer(page, 1);   // add player 1 as seer member
  await sleep(200);
  await clickText(page, '🔮 查驗');  // activate check mode
  await sleep(200);
  await clickPlayer(page, 3);   // check player 3
  await sleep(200);
  await page.screenshot({ path: 'ss_n2_seer_check.png' });
  console.log('[N2 Seer] p1 seer, checking p3 → playerCardMap[1].lower="seer"');

  await clickText(page, '完成 → 下一位');
  await sleep(400);

  // Witch: skip
  await waitForVisible(page, '今晚狼人刀了');
  await sleep(200);
  await clickText(page, '⏭️ 跳過');
  await sleep(200);
  await clickText(page, '完成 → 下一位');
  await sleep(400);
  console.log('[N2 Witch] skipped');

  // Hunter: last step
  await waitForVisible(page, '先點選獵人是誰');
  await sleep(200);
  await clickText(page, '完成 → 結束夜晚');
  await sleep(400);
  console.log('[N2 Hunter] skipped');

  // Done → Result
  await waitForVisible(page, '夜晚行動完成');
  await sleep(300);
  await clickText(page, '查看夜晚結果 →');
  await sleep(700);

  await waitForVisible(page, '進入白天');  // result screen unique text
  await sleep(300);
  await page.screenshot({ path: 'ss_n2_result.png' });
  console.log('[N2 Result] player 1 now fully dead (deadPlayers=[1])');

  await clickText(page, '進入白天');
  await sleep(1000);
  console.log('[Night 3] started');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── Night 3 ──────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Wolf step screenshot
  // playerCardMap[1]={upper:'werewolf',lower:'seer'}, isDead=true
  // Player 1 box: 狼人 upper-left, 預言家 lower-right, '死' center label
  await waitForVisible(page, '🔪 刀人');
  await sleep(800);
  await page.screenshot({ path: 'ss_n3_wolf.png' });
  console.log('[N3 Wolf] screenshot ← player 1 should show 狼人(upper) + 預言家(lower)');

  await clickText(page, '完成 → 下一位');
  await sleep(600);

  // Seer step screenshot
  // savedMembers=[] (player 1 excluded by deadPlayers filter)
  // BEFORE FIX: player 1 pre-selected → setRoleMembers('seer',[1]) → upper='seer'
  // AFTER FIX:  player 1 excluded → playerCardMap[1] unchanged {upper:'werewolf',lower:'seer'}
  await waitForVisible(page, '🔮 查驗');
  await sleep(800);
  await page.screenshot({ path: 'ss_n3_seer.png' });
  console.log('[N3 Seer] screenshot ← player 1 should STILL show 狼人(upper) + 預言家(lower)');

  await clickText(page, '完成 → 下一位');
  await sleep(600);

  // Witch step screenshot
  // BEFORE FIX: 預言家 in upper-left (bug!)
  // AFTER FIX:  預言家 in lower-right
  await waitForVisible(page, '今晚狼人刀了');
  await sleep(800);
  await page.screenshot({ path: 'ss_n3_witch.png' });
  console.log('[N3 Witch] screenshot ← 預言家 should be LOWER-RIGHT (not upper-left)');

  console.log('\n=== ALL DONE ===');
  console.log('ss_n3_wolf.png  : player 1 box — 狼人 upper-left?       YES → pass');
  console.log('ss_n3_seer.png  : player 1 box — 狼人 upper-left?       YES → pass');
  console.log('ss_n3_witch.png : player 1 box — 預言家 lower-right?    YES → pass (was bug: upper-left)');

  await sleep(3000);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
