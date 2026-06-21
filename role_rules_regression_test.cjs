const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

Module._extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText, filename);
};

const {
  computeNightDeaths,
  getDeathSkillTriggers,
  computeWinResult,
  projectDeathState,
  getTenguKillAllowance,
  useGameStore,
  buildNightSummary,
  getFireWolfEffectiveRole,
  shouldShowSheriffStepForState,
  resolveAutomaticDeathRounds,
  buildDeathCauseMap,
  getNightDeathCauseMap,
} = require('./src/store/gameStore.ts');

const same = (actual, expected, label) => {
  assert.deepStrictEqual([...actual].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), label);
};

// Two knives + one active shield + one antidote leaves no death.
same(computeNightDeaths([
  { roleId: 'werewolf', members: [1], killTarget: 5 },
  { roleId: 'spirit_wolf', members: [2], spiritWolfKillTarget: 5, spiritWolfSaveTarget: 5 },
  { roleId: 'guard', members: [3], protectTarget: 5 },
]), [], 'wolf knife + spirit knife + shield + antidote should survive');

// Two knives + one antidote still leaves one knife.
same(computeNightDeaths([
  { roleId: 'werewolf', members: [1], killTarget: 5 },
  { roleId: 'spirit_wolf', members: [2], spiritWolfKillTarget: 5, spiritWolfSaveTarget: 5 },
]), [5], 'two knives one antidote should die');

// Shield blocks the knife; antidote on a non-dying target becomes poison.
same(computeNightDeaths([
  { roleId: 'werewolf', members: [1], killTarget: 5 },
  { roleId: 'guard', members: [3], protectTarget: 5 },
  { roleId: 'witch', members: [4], saveTarget: 5 },
]), [5], 'shielded knife plus antidote should poison');

// Witch hunter is immune to witch poison.
same(computeNightDeaths([
  { roleId: 'witch', members: [4], poisonTarget: 6 },
], { witch_hunter: [6] }), [], 'witch hunter should survive poison');

// Slave trader dies at night, earliest living slave replaces death.
same(computeNightDeaths([
  { roleId: 'werewolf', members: [1], killTarget: 7 },
], { slave_trader: [7] }, {}, [], undefined, null, 'single', true, [2, 3]), [2], 'slave should replace slave trader death');

// First slave also died, replacement rolls to next slave.
same(computeNightDeaths([
  { roleId: 'werewolf', members: [1], killTarget: 7 },
  { roleId: 'witch', members: [4], poisonTarget: 2 },
], { slave_trader: [7] }, {}, [], undefined, null, 'single', true, [2, 3]), [2, 3], 'dead slave should be skipped to next slave');

// Mummy-sealed hunter does not trigger night death skill.
same(getDeathSkillTriggers(
  [[5]],
  'night',
  [{ roleId: 'mummy', members: [1], mummySealedRole: 'hunter' }],
  { hunter: [5] },
), [], 'mummy sealed hunter should not trigger');

assert.deepStrictEqual(computeWinResult({
  gameMode: 'single',
  singleWinRule: 'edge',
  selectedRoles: [
    { roleId: 'werewolf', count: 1 },
    { roleId: 'seer', count: 1 },
    { roleId: 'villager', count: 1 },
  ],
  roleMembersMap: { werewolf: [1], seer: [2], villager: [3] },
  deadPlayers: [2],
  upperDeadPlayers: [],
  playerCardMap: {},
  goldenBabyPlayers: [],
}), { winner: 'wolf', reason: '所有神職玩家死亡' }, 'edge should let wolves win when gods are all dead');

assert.strictEqual(computeWinResult({
  gameMode: 'single',
  singleWinRule: 'city',
  selectedRoles: [
    { roleId: 'werewolf', count: 1 },
    { roleId: 'seer', count: 1 },
    { roleId: 'villager', count: 1 },
  ],
  roleMembersMap: { werewolf: [1], seer: [2], villager: [3] },
  deadPlayers: [2],
  upperDeadPlayers: [],
  playerCardMap: {},
  goldenBabyPlayers: [],
}), null, 'city should not let wolves win until all good players are dead');

assert.deepStrictEqual(computeWinResult({
  gameMode: 'dual',
  singleWinRule: 'edge',
  selectedRoles: [],
  roleMembersMap: {},
  deadPlayers: [4],
  upperDeadPlayers: [],
  playerCardMap: {
    1: { upper: 'werewolf', lower: 'villager' },
    2: { upper: 'seer', lower: 'white_wolf' },
  },
  goldenBabyPlayers: [4],
}), { winner: 'wolf', reason: '所有金寶寶都已上下牌死亡' }, 'dual wolves win when all golden babies are fully dead');

assert.deepStrictEqual(computeWinResult({
  gameMode: 'dual',
  singleWinRule: 'edge',
  selectedRoles: [],
  roleMembersMap: {},
  deadPlayers: [2],
  upperDeadPlayers: [1],
  playerCardMap: {
    1: { upper: 'werewolf', lower: 'villager' },
    2: { upper: 'seer', lower: 'white_wolf' },
  },
  goldenBabyPlayers: [4],
}), { winner: 'village', reason: '所有狼人角色牌都已翻出' }, 'dual village wins when all wolf cards are revealed');

assert.deepStrictEqual(computeWinResult({
  gameMode: 'dual',
  singleWinRule: 'edge',
  selectedRoles: [],
  roleMembersMap: {},
  deadPlayers: [2, 4],
  upperDeadPlayers: [1],
  playerCardMap: {
    1: { upper: 'werewolf', lower: 'villager' },
    2: { upper: 'seer', lower: 'white_wolf' },
  },
  goldenBabyPlayers: [4],
  resolutionPhase: 'night',
}), { winner: 'wolf', reason: '夜晚同時達成：所有金寶寶死亡，狼人勝利' }, 'dual night tie should prefer wolves');

assert.deepStrictEqual(computeWinResult({
  gameMode: 'dual',
  singleWinRule: 'edge',
  selectedRoles: [],
  roleMembersMap: {},
  deadPlayers: [2, 4],
  upperDeadPlayers: [1],
  playerCardMap: {
    1: { upper: 'werewolf', lower: 'villager' },
    2: { upper: 'seer', lower: 'white_wolf' },
  },
  goldenBabyPlayers: [4],
  resolutionPhase: 'day',
}), { winner: 'village', reason: '白天同時達成：所有狼人角色牌翻出，好人勝利' }, 'dual day tie should prefer village');

assert.deepStrictEqual(projectDeathState(
  'dual',
  [],
  [1],
  [1],
), { deadPlayers: [1], upperDeadPlayers: [] }, 'dual second death should preview as fully dead');

assert.strictEqual(getTenguKillAllowance({
  gameMode: 'dual',
  selectedRoles: [
    { roleId: 'tengu', count: 1 },
    { roleId: 'werewolf', count: 1 },
  ],
  roleMembersMap: { tengu: [1], werewolf: [2] },
  playerCardMap: {
    1: { upper: 'tengu', lower: 'villager' },
    2: { upper: 'villager', lower: 'werewolf' },
  },
  upperDeadPlayers: [],
  deadPlayers: [],
  actingTenguPlayers: [1],
}), 0, 'tengu must wait for a non-active lower wolf card to die');

assert.strictEqual(getTenguKillAllowance({
  gameMode: 'dual',
  selectedRoles: [
    { roleId: 'tengu', count: 1 },
    { roleId: 'werewolf', count: 1 },
  ],
  roleMembersMap: { tengu: [1], werewolf: [2] },
  playerCardMap: {
    1: { upper: 'tengu', lower: 'villager' },
    2: { upper: 'villager', lower: 'werewolf' },
  },
  upperDeadPlayers: [],
  deadPlayers: [2],
  actingTenguPlayers: [1],
}), 1, 'tengu gets exactly one kill after every other wolf card dies');

same(computeNightDeaths([
  { roleId: 'tengu', members: [1], tenguKillTargets: [4, 5] },
]), [4], 'legacy tengu actions must still resolve at most one kill');

same(computeNightDeaths([
  { roleId: 'dreamwalker', members: [3], dreamwalkerTarget: 5 },
  { roleId: 'blind_swordsman', members: [2], blindSwordsmanMode: 'kill', blindSwordsmanTarget: 5 },
]), [], 'blind swordsman cannot penetrate dreamwalker protection');

same(computeNightDeaths([
  { roleId: 'blind_swordsman', members: [2], blindSwordsmanMode: 'kill', blindSwordsmanTarget: 5 },
], { frankenstein: [5] }), [], 'blind swordsman cannot penetrate Frankenstein immunity');

same(computeNightDeaths([
  { roleId: 'blind_swordsman', members: [2], blindSwordsmanMode: 'monk_vote', blindSwordsmanTarget: 5 },
]), [], 'monk-vote strike can be selected but has no effect while monk is absent');

useGameStore.setState({
  gameMode: 'single',
  currentStep: 1,
  nightActions: [{ roleId: 'seer', members: [2], checkTarget: 3, checkResult: 'wolf' }],
  nightHistory: [],
  checkedPlayers: { 3: 'wolf' },
  upperDeadPlayers: [],
  playerCardMap: {},
  roleMembersMap: { seer: [2], fire_wolf: [1] },
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [],
});
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 2 });
assert.deepStrictEqual(
  useGameStore.getState().nightActions[0],
  { roleId: 'seer', members: [], invalidatedByFireWolf: true, invalidatedPlayers: [2] },
  'fire wolf must invalidate a god action that happened earlier the same night',
);
assert.deepStrictEqual(
  useGameStore.getState().checkedPlayers,
  {},
  'fire wolf must remove the invalidated same-night seer result',
);

useGameStore.setState({
  gameMode: 'single',
  currentStep: 1,
  nightActions: [{ roleId: 'witch', members: [2], saveTarget: 3 }],
  nightHistory: [],
  saveUsed: true,
  poisonUsed: false,
  upperDeadPlayers: [],
  playerCardMap: {},
  roleMembersMap: { witch: [2], fire_wolf: [1] },
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [],
});
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 2 });
assert.strictEqual(
  useGameStore.getState().saveUsed,
  false,
  'fire wolf must refund a potion whose same-night use was invalidated',
);

const upperBurn = [{ player: 3, slot: 'upper', originalRoleId: 'hunter', night: 1, step: 4 }];
assert.strictEqual(
  getFireWolfEffectiveRole(3, 'hunter', 'dual', [], upperBurn),
  'villager',
  'a burned upper card must be treated as villager',
);
assert.strictEqual(
  getFireWolfEffectiveRole(3, 'seer', 'dual', [3], upperBurn),
  'seer',
  'burning the upper card must not affect the lower active card',
);
assert.strictEqual(
  getFireWolfEffectiveRole(
    7,
    'old_rogue',
    'single',
    [],
    [{ player: 7, slot: 'single', originalRoleId: 'old_rogue', night: 1, step: 2 }],
  ),
  'villager',
  'a burned old rogue must lose the self-destruct role',
);
assert.strictEqual(
  getFireWolfEffectiveRole(
    8,
    'idiot',
    'single',
    [],
    [{ player: 8, slot: 'single', originalRoleId: 'idiot', night: 1, step: 2 }],
  ),
  'villager',
  'a burned idiot must be exiled as a villager instead of flipping',
);

const burnedWitchHunter = [{ player: 5, slot: 'single', originalRoleId: 'witch_hunter', night: 1, step: 2 }];
same(computeNightDeaths(
  [{ roleId: 'witch', members: [2], poisonTarget: 5 }],
  { witch_hunter: [5] },
  {},
  [],
  undefined,
  null,
  'single',
  true,
  [],
  burnedWitchHunter,
), [5], 'a burned witch hunter loses poison immunity');

const burnedFrankenstein = [{ player: 5, slot: 'single', originalRoleId: 'frankenstein', night: 1, step: 2 }];
same(computeNightDeaths(
  [{ roleId: 'blind_swordsman', members: [2], blindSwordsmanMode: 'kill', blindSwordsmanTarget: 5 }],
  { frankenstein: [5] },
  {},
  [],
  undefined,
  null,
  'single',
  true,
  [],
  burnedFrankenstein,
), [5], 'a burned Frankenstein loses night immunity');

assert.deepStrictEqual(getDeathSkillTriggers(
  [[5]],
  'day',
  [],
  { hunter: [5] },
  {},
  [],
  'single',
  [{ player: 5, slot: 'single', originalRoleId: 'hunter', night: 1, step: 2 }],
), [], 'a burned hunter must not trigger a death skill');

same(computeNightDeaths(
  [{ roleId: 'werewolf', members: [1], killTarget: 5 }],
  { slave_trader: [5], villager: [6] },
  {},
  [],
  undefined,
  null,
  'single',
  true,
  [6],
  [{ player: 5, slot: 'single', originalRoleId: 'slave_trader', night: 1, step: 2 }],
), [5], 'a burned slave trader cannot substitute a slave');

useGameStore.setState({
  gameMode: 'dual',
  currentNight: 2,
  currentStep: 0,
  nightActions: [],
  nightHistory: [],
  upperDeadPlayers: [],
  playerCardMap: { 4: { upper: 'seer', lower: 'hunter' } },
  roleMembersMap: { seer: [4], hunter: [4], fire_wolf: [1] },
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [],
});
useGameStore.getState().captureNightStepSnapshot(0);
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 4 });
assert.deepStrictEqual(
  useGameStore.getState().fireWolfBurnRecords,
  [{ player: 4, slot: 'upper', originalRoleId: 'seer', night: 2, step: 0 }],
  'fire wolf burn history must record the exact card slot and action time',
);
useGameStore.getState().rewindNightStep(0);
assert.deepStrictEqual(
  useGameStore.getState().fireWolfBurnRecords,
  [],
  'rewinding the fire wolf step must remove its burn record',
);

useGameStore.setState({
  gameMode: 'single',
  currentNight: 2,
  currentStep: 1,
  nightActions: [{ roleId: 'seer', members: [4], checkTarget: 5, checkResult: 'good' }],
  nightHistory: [{
    nightNumber: 1,
    actions: [
      { roleId: 'fire_wolf', members: [1], fireWolfTarget: 2 },
      { roleId: 'slave_trader', members: [3], slaveTarget: 2 },
    ],
    summary: [],
  }],
  roleMembersMap: { fire_wolf: [1], seer: [2, 4], slave_trader: [3] },
  playerCardMap: {},
  upperDeadPlayers: [],
  checkedPlayers: { 5: 'good' },
  slaveTraderSlaves: [2],
  fireWolfBurnedPlayers: [2],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [
    { player: 2, slot: 'single', originalRoleId: 'seer', night: 1, step: 0 },
  ],
});
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 4 });
assert.deepStrictEqual(
  useGameStore.getState().slaveTraderSlaves,
  [2],
  'state rebuild must preserve enslavement performed after the target was burned into a villager',
);

useGameStore.setState({
  gameMode: 'single',
  currentNight: 2,
  currentStep: 1,
  nightActions: [{ roleId: 'seer', members: [4], checkTarget: 5, checkResult: 'good' }],
  nightHistory: [{
    nightNumber: 1,
    actions: [
      { roleId: 'slave_trader', members: [3], slaveTarget: 2 },
      { roleId: 'fire_wolf', members: [1], fireWolfTarget: 2 },
    ],
    summary: [],
  }],
  roleMembersMap: { fire_wolf: [1], seer: [2, 4], slave_trader: [3] },
  playerCardMap: {},
  upperDeadPlayers: [],
  checkedPlayers: { 5: 'good' },
  slaveTraderSlaves: [],
  fireWolfBurnedPlayers: [2],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [
    { player: 2, slot: 'single', originalRoleId: 'seer', night: 1, step: 1 },
  ],
});
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 4 });
assert.deepStrictEqual(
  useGameStore.getState().slaveTraderSlaves,
  [],
  'state rebuild must not retroactively validate enslavement performed before the target was burned',
);

useGameStore.setState({
  gameMode: 'single',
  currentNight: 1,
  currentStep: 0,
  nightActions: [],
  nightHistory: [],
  roleMembersMap: { fire_wolf: [1], seer: [4] },
  playerCardMap: {},
  upperDeadPlayers: [],
  bishopHolder: 4,
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [],
});
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 4 });
assert.strictEqual(
  useGameStore.getState().bishopHolder,
  null,
  'burning the active card of the inherited bishop holder must remove the inherited skill',
);

useGameStore.setState({
  gameMode: 'single',
  currentNight: 1,
  currentStep: 0,
  nightActions: [],
  nightHistory: [],
  roleMembersMap: { fire_wolf: [1], villager: [4] },
  playerCardMap: {},
  upperDeadPlayers: [],
  bishopHolder: 4,
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [],
});
useGameStore.getState().recordAction({ roleId: 'fire_wolf', members: [1], fireWolfTarget: 4 });
assert.strictEqual(
  useGameStore.getState().bishopHolder,
  4,
  'an invalid fire wolf target must not remove an inherited bishop skill',
);

const newRoleSummary = buildNightSummary([
  { roleId: 'spirit_wolf', members: [1], spiritWolfKillTarget: 8 },
  { roleId: 'shaman', members: [2], shamanTarget: 7, shamanMode: 'shield' },
  { roleId: 'slave_trader', members: [3], slaveTarget: 6 },
  { roleId: 'fire_wolf', members: [4], fireWolfTarget: 5 },
  { roleId: 'blind_swordsman', members: [5], blindSwordsmanMode: 'monk_vote', blindSwordsmanTarget: 9 },
  { roleId: 'explorer', members: [6], explorerResult: 4 },
  { roleId: 'mummy', members: [7], mummySealedRole: 'seer' },
]);
assert.strictEqual(
  newRoleSummary.some(line => line.endsWith('無行動')),
  false,
  'implemented night skills must not fall through to the no-action summary',
);

assert.strictEqual(
  shouldShowSheriffStepForState(1, false, null, 'none', 0, false),
  true,
  'the first day must show the sheriff election',
);
assert.strictEqual(
  shouldShowSheriffStepForState(2, false, null, 'double', 1, false),
  true,
  'the first explosion in double-explosion mode must reopen the election next day',
);
assert.strictEqual(
  shouldShowSheriffStepForState(2, false, null, 'double', 2, true),
  false,
  'the second explosion must swallow the badge and stop future elections',
);
assert.strictEqual(
  shouldShowSheriffStepForState(2, false, 3, 'double', 1, false),
  false,
  'electing a sheriff on the second election must stop another automatic election',
);

useGameStore.getState().startNewGame('dual');
useGameStore.getState().setSheriffExplosionRule('double');
useGameStore.getState().captureDayStepSnapshot(0);
useGameStore.getState().setSheriffExplosionState(1, false);
useGameStore.getState().restoreDayStepSnapshot(0);
assert.strictEqual(
  useGameStore.getState().sheriffExplosionCount,
  0,
  'going back from a sheriff explosion must restore the previous explosion count',
);
assert.strictEqual(
  useGameStore.getState().sheriffBadgeDestroyed,
  false,
  'going back from a sheriff explosion must restore the badge state',
);

const sheriffExplosionFilteredNightRounds = resolveAutomaticDeathRounds(
  [5],
  'night',
  [{ roleId: 'werewolf', members: [1], killTarget: 5 }],
  { werewolf: [1] },
  {},
  [],
  [],
  undefined,
  null,
  'single',
  [5],
);
assert.deepStrictEqual(
  sheriffExplosionFilteredNightRounds,
  [],
  'a player who self-destructed during the sheriff election must be removed from the morning night deaths',
);

const nightCauseRounds = [[5]];
assert.deepStrictEqual(
  getNightDeathCauseMap(
    nightCauseRounds,
    [{ roleId: 'werewolf', members: [1], killTarget: 5 }],
    { werewolf: [1] },
  ),
  { 5: '狼刀' },
  'night death records must identify the lethal night action',
);

assert.deepStrictEqual(
  buildDeathCauseMap(
    [[2], [6]],
    { 2: '投票放逐' },
    [],
    {},
    {},
    [],
    [2, 6],
    'single',
  ),
  { 2: '投票放逐', 6: '戀人殉情' },
  'automatic death rounds must identify linked-death causes',
);

useGameStore.getState().startNewGame('single');
useGameStore.setState({
  nightActions: [{ roleId: 'werewolf', members: [1], killTarget: 5 }],
  roleMembersMap: { werewolf: [1] },
});
useGameStore.getState().endDay({
  nightChainDeaths: [5],
  deathCauses: { 5: '狼刀' },
});
assert.deepStrictEqual(
  useGameStore.getState().deathRecords,
  [{ night: 1, timing: 'night', player: 5, cause: '狼刀' }],
  'committed deaths must retain timing and cause',
);
assert.strictEqual(
  useGameStore.getState().gameLog.some(entry => entry.text.includes('5號死亡（死因：狼刀）')),
  true,
  'death logs must include the cause',
);

useGameStore.setState({
  savedConfigs: {
    single: [
      { name: '配置 A', mode: 'single', playerCount: 9, selectedRoles: [], goldenBabyConfig: { min: 0, max: 0 }, singleWinRule: 'edge' },
      { name: '配置 B', mode: 'single', playerCount: 12, selectedRoles: [], goldenBabyConfig: { min: 0, max: 0 }, singleWinRule: 'city' },
    ],
  },
});
useGameStore.getState().deleteSavedConfig('single', 0);
assert.deepStrictEqual(
  useGameStore.getState().savedConfigs.single?.map(config => config.name),
  ['配置 B'],
  'deleting a saved config must remove only the selected entry',
);
assert.strictEqual(
  typeof useGameStore.persist.rehydrate,
  'function',
  'game progress and configurations must use persistent storage',
);

console.log('role rule regression tests passed');

