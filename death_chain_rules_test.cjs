const fs = require('fs');
const Module = require('module');
const ts = require('typescript');

Module._extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const {
  computeNightDeaths,
  getDeathSkillTriggers,
  resolveAutomaticDeathRounds,
  resolveTimedDeathSkillTarget,
  getGravediggerLowerInfo,
  useGameStore,
} = require('./src/store/gameStore.ts');

const tests = [];

function expectEqual(name, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  tests.push({
    name,
    pass: actualJson === expectedJson,
    actual: actualJson,
    expected: expectedJson,
  });
}

expectEqual(
  'dreamwalker death creates a second announcement round',
  resolveAutomaticDeathRounds(
    [2],
    'night',
    [{ roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 6 }],
    { dreamwalker: [2] },
  ),
  [[2], [6]],
);

expectEqual(
  'direct night death calculation keeps dreamwalker carry out of first round',
  computeNightDeaths(
    [
      { roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 6 },
      { roleId: 'werewolf', members: [1], killTarget: 2 },
    ],
    { dreamwalker: [2] },
    {},
    [],
    undefined,
    null,
    'single',
    false,
  ),
  [2],
);

expectEqual(
  'lover death can lead to dreamwalker carry in later rounds',
  resolveAutomaticDeathRounds(
    [1],
    'day',
    [{ roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 6 }],
    { dreamwalker: [2] },
    {},
    [],
    [],
    undefined,
    [1, 2],
    'single',
  ),
  [[1], [2], [6]],
);

expectEqual(
  'night death skill uses magician swap before checking dreamwalker immunity',
  resolveTimedDeathSkillTarget(
    5,
    'night',
    [
      { roleId: 'magician', members: [9], magicianSwap: [3, 5] },
      { roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 5 },
    ],
    { dreamwalker: [2] },
  ),
  undefined,
);

expectEqual(
  'day death skill ignores night-only protection',
  resolveTimedDeathSkillTarget(
    5,
    'day',
    [{ roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 5 }],
    { dreamwalker: [2] },
  ),
  5,
);

expectEqual(
  'frankenstein ignores night death skill',
  resolveTimedDeathSkillTarget(
    4,
    'night',
    [],
    { frankenstein: [4] },
  ),
  undefined,
);

expectEqual(
  'dual upper hunter triggers before the chain switches to lower card',
  getDeathSkillTriggers(
    [[3]],
    'night',
    [],
    { hunter: [3] },
    { 3: { upper: 'hunter', lower: 'villager' } },
    [],
    'dual',
  ),
  [{ player: 3, roleId: 'hunter' }],
);

expectEqual(
  'poisoned wolf king has no death skill trigger',
  getDeathSkillTriggers(
    [[5]],
    'night',
    [{ roleId: 'witch', members: [4], poisonTarget: 5 }],
    { wolf_king: [5] },
  ),
  [],
);

expectEqual(
  'tengu first knife can be saved but second knife cannot',
  computeNightDeaths(
    [
      { roleId: 'tengu', members: [1], tenguKillTargets: [5, 6] },
      { roleId: 'witch', members: [4], saveTarget: 5 },
    ],
  ),
  [6],
);

expectEqual(
  'guard protects tengu second knife',
  computeNightDeaths(
    [
      { roleId: 'guard', members: [2], protectTarget: 6 },
      { roleId: 'tengu', members: [1], tenguKillTargets: [5, 6] },
    ],
  ),
  [5],
);

useGameStore.setState({
  gameMode: 'dual',
  currentNight: 1,
  nightActions: [],
  nightHistory: [],
  roleMembersMap: { hunter: [3], villager: [3] },
  playerCardMap: { 3: { upper: 'hunter', lower: 'villager' } },
  upperDeadPlayers: [],
  deadPlayers: [],
  cupidLovers: null,
  selectedRoles: [
    { roleId: 'hunter', count: 1 },
    { roleId: 'villager', count: 1 },
  ],
});
useGameStore.getState().endDay({
  exiledPlayer: 3,
  nightChainDeaths: [3],
});
expectEqual(
  'night upper death then day exile kills the active lower card',
  {
    upperDeadPlayers: useGameStore.getState().upperDeadPlayers,
    deadPlayers: useGameStore.getState().deadPlayers,
  },
  { upperDeadPlayers: [], deadPlayers: [3] },
);

useGameStore.setState({
  gameMode: 'dual',
  roleMembersMap: { thief: [1] },
  playerCardMap: { 1: { upper: 'thief', lower: 'villager' } },
  upperDeadPlayers: [],
  deadPlayers: [],
});
useGameStore.getState().transformThief([1], 'seer');
expectEqual(
  'thief active card becomes the selected role',
  {
    card: useGameStore.getState().playerCardMap[1],
    thief: useGameStore.getState().roleMembersMap.thief,
    seer: useGameStore.getState().roleMembersMap.seer,
  },
  {
    card: { upper: 'seer', lower: 'villager' },
    thief: [],
    seer: [1],
  },
);

expectEqual(
  'gravedigger sees lower card faction after upper card exile',
  getGravediggerLowerInfo(
    { player: 3, upperWasAlive: true },
    { 3: { upper: 'seer', lower: 'werewolf' } },
    [],
  ),
  { player: 3, isWolf: true, roleName: '狼人' },
);

expectEqual(
  'gravedigger gets no info when exiled player is already fully dead',
  getGravediggerLowerInfo(
    { player: 3, upperWasAlive: true },
    { 3: { upper: 'seer', lower: 'werewolf' } },
    [3],
  ),
  null,
);

for (const test of tests) {
  console.log(
    `${test.pass ? 'PASS' : 'FAIL'} | ${test.name} | actual=${test.actual} expected=${test.expected}`,
  );
}

if (tests.some(test => !test.pass)) process.exit(1);
