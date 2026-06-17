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

console.log('role rule regression tests passed');

