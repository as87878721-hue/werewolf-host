const assert = require('assert');
const Module = require('module');
const ts = require('typescript');

Module._extensions['.ts'] = (m, f) => {
  m._compile(ts.transpileModule(require('fs').readFileSync(f, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText, f);
};

const { useGameStore } = require('./src/store/gameStore.ts');
const store = useGameStore;

function reset(mode = 'dual') {
  store.getState().startNewGame(mode);
}

function assertCleanState(fields) {
  const state = store.getState();
  for (const [field, expected] of Object.entries(fields)) {
    assert.deepStrictEqual(state[field], expected, `${field} should be reverted`);
  }
}

// 1. 白狼王自爆 → 補死亡身分 → 按上一步 → 再重做。
reset('dual');
store.setState({
  playerCardMap: { 2: { upper: 'white_wolf' } },
  roleMembersMap: { white_wolf: [2] },
});
store.getState().captureDayStepSnapshot(2);
store.getState().setPlayerCardRole(4, 'upper', 'golden_baby');
store.getState().setPlayerCardRole(2, 'lower', 'mummy');
store.getState().restoreDayStepSnapshot(2);
assertCleanState({
  playerCardMap: { 2: { upper: 'white_wolf' } },
  roleMembersMap: { white_wolf: [2] },
});
store.getState().captureDayStepSnapshot(2);
store.getState().setPlayerCardRole(2, 'lower', 'wolf_king');
assert.strictEqual(store.getState().playerCardMap[2].lower, 'wolf_king', 'redo should still work after undo');

// 2. 主教死亡 → 選傳承 → 按上一步 → 換選。
reset('single');
store.setState({ roleMembersMap: { bishop: [1], seer: [3], witch: [4] }, bishopHolder: 1 });
store.getState().captureDayStepSnapshot(4);
store.getState().setBishopHolder(3);
store.getState().restoreDayStepSnapshot(4);
assert.strictEqual(store.getState().bishopHolder, 1, 'bishop holder should revert after back');
store.getState().captureDayStepSnapshot(4);
store.getState().setBishopHolder(4);
assert.strictEqual(store.getState().bishopHolder, 4, 'bishop holder can be changed after undo');

// 3. 騎士決鬥 → 按上一步 → 再決鬥。
reset('single');
store.setState({ roleMembersMap: { knight: [1], werewolf: [2] } });
store.getState().captureDayStepSnapshot(2);
store.getState().setKnightUsed(true);
store.getState().restoreDayStepSnapshot(2);
assert.strictEqual(store.getState().knightUsed, false, 'knight use should revert after back');
store.getState().captureDayStepSnapshot(2);
store.getState().setKnightUsed(true);
assert.strictEqual(store.getState().knightUsed, true, 'knight can duel again after undo');

// 4. 夜晚木乃伊封印 → 上一步 → 改封別的角色。
reset('single');
store.setState({ nightOrder: ['mummy'], currentStep: 0, roleMembersMap: { mummy: [2] } });
store.getState().captureNightStepSnapshot(0);
store.getState().recordAction({ roleId: 'mummy', members: [2], mummySealedRole: 'hunter' });
store.getState().rewindNightStep(0);
assertCleanState({
  mummySealedRoles: [],
  nightActions: [],
  roleMembersMap: { mummy: [2] },
});
store.getState().captureNightStepSnapshot(0);
store.getState().recordAction({ roleId: 'mummy', members: [2], mummySealedRole: 'seer' });
assert.deepStrictEqual(store.getState().mummySealedRoles, ['seer'], 'mummy can reseal another role after undo');

// 5. 火狼燒牌 → 上一步 → 改目標。
reset('single');
store.setState({ nightOrder: ['fire_wolf'], currentStep: 0, roleMembersMap: { fire_wolf: [1], seer: [3], witch: [4] } });
store.getState().captureNightStepSnapshot(0);
store.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 3 });
assert.deepStrictEqual(store.getState().fireWolfBurnedPlayers, [3]);
assert.strictEqual(store.getState().fireWolfUsed, true);
store.getState().rewindNightStep(0);
assertCleanState({
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfUsed: false,
  nightActions: [],
  roleMembersMap: { fire_wolf: [1], seer: [3], witch: [4] },
});
store.getState().captureNightStepSnapshot(0);
store.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 4 });
assert.deepStrictEqual(store.getState().fireWolfBurnedPlayers, [4], 'fire wolf can burn another target after undo');

console.log('high risk undo regression tests passed');
