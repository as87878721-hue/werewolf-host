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
  useGameStore,
  DEFAULT_DUAL_CONFIG,
  getActiveNightRoleMembers,
  canAssignNightRolePosition,
  getWolfNightParticipants,
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
  'single mode selected living role is active',
  getActiveNightRoleMembers('seer', [2], 'single', { seer: [2] }),
  [2],
);

expectEqual(
  'single mode dead role cannot act',
  getActiveNightRoleMembers('seer', [2], 'single', { seer: [2] }, {}, [], [2]),
  [],
);

expectEqual(
  'one living member is enough when a multi-member role is not fully selected',
  getActiveNightRoleMembers(
    'werewolf',
    [1],
    'single',
    { werewolf: [1] },
  ),
  [1],
);

expectEqual(
  'dual mode upper role is active before upper death',
  getActiveNightRoleMembers(
    'seer',
    [2],
    'dual',
    { seer: [2] },
    { 2: { upper: 'seer', lower: 'villager' } },
  ),
  [2],
);

expectEqual(
  'dual mode lower role is inactive before upper death',
  getActiveNightRoleMembers(
    'seer',
    [2],
    'dual',
    { seer: [2] },
    { 2: { upper: 'villager', lower: 'seer' } },
  ),
  [],
);

expectEqual(
  'dual mode lower role becomes active after upper death',
  getActiveNightRoleMembers(
    'seer',
    [2],
    'dual',
    { seer: [2] },
    { 2: { upper: 'villager', lower: 'seer' } },
    [2],
  ),
  [2],
);

expectEqual(
  'dual mode fully dead role cannot act',
  getActiveNightRoleMembers(
    'seer',
    [2],
    'dual',
    { seer: [2] },
    { 2: { upper: 'villager', lower: 'seer' } },
    [2],
    [2],
  ),
  [],
);

expectEqual(
  'new normal role selection uses empty upper card and is active',
  getActiveNightRoleMembers('guard', [3], 'dual', {}, {}),
  [3],
);

expectEqual(
  'new forced lower role is inactive before upper death',
  getActiveNightRoleMembers('sharpshooter', [3], 'dual', {}, { 3: { upper: 'villager' } }),
  [],
);

expectEqual(
  'new forced lower role is active after upper death',
  getActiveNightRoleMembers(
    'sharpshooter',
    [3],
    'dual',
    {},
    { 3: { upper: 'villager' } },
    [3],
  ),
  [3],
);

expectEqual(
  'single mode cannot replace another known role position',
  canAssignNightRolePosition(
    'witch',
    3,
    'single',
    { 3: { upper: 'seer' } },
  ),
  false,
);

expectEqual(
  'dual mode cannot replace another active upper role',
  canAssignNightRolePosition(
    'witch',
    3,
    'dual',
    { 3: { upper: 'seer' } },
  ),
  false,
);

expectEqual(
  'dual mode can assign an empty lower role after upper death',
  canAssignNightRolePosition(
    'witch',
    3,
    'dual',
    { 3: { upper: 'seer' } },
    [3],
  ),
  true,
);

expectEqual(
  'same role can be assigned to the lower card after its upper card dies',
  canAssignNightRolePosition(
    'seer',
    3,
    'dual',
    { 3: { upper: 'seer' } },
    [3],
  ),
  true,
);

expectEqual(
  'same lower role becomes active while its dead upper marker is preserved',
  getActiveNightRoleMembers(
    'seer',
    [3],
    'dual',
    { seer: [3] },
    { 3: { upper: 'seer', lower: 'seer' } },
    [3],
  ),
  [3],
);

expectEqual(
  'shapeshifter can be assigned to an empty lower card while upper is active',
  canAssignNightRolePosition(
    'shapeshifter',
    3,
    'dual',
    { 3: { upper: 'seer' } },
  ),
  true,
);

expectEqual(
  'shapeshifter cannot replace an occupied lower card',
  canAssignNightRolePosition(
    'shapeshifter',
    3,
    'dual',
    { 3: { upper: 'seer', lower: 'villager' } },
  ),
  false,
);

expectEqual(
  'dead player cannot receive a role position',
  canAssignNightRolePosition(
    'witch',
    3,
    'dual',
    { 3: { upper: 'seer', lower: 'villager' } },
    [3],
    [3],
  ),
  false,
);

expectEqual(
  'lower shapeshifter joins active werewolves before becoming the active card',
  getWolfNightParticipants(
    'dual',
    { werewolf: [1], shapeshifter: [3] },
    {
      1: { upper: 'werewolf' },
      3: { upper: 'seer', lower: 'shapeshifter' },
    },
  ),
  [1, 3],
);

expectEqual(
  'living lower shapeshifter can perform wolf action without a living werewolf',
  getWolfNightParticipants(
    'dual',
    { werewolf: [1], shapeshifter: [3] },
    {
      1: { upper: 'werewolf', lower: 'villager' },
      3: { upper: 'seer', lower: 'shapeshifter' },
    },
    [1],
  ),
  [3],
);

expectEqual(
  'fully dead shapeshifter does not join wolf action',
  getWolfNightParticipants(
    'dual',
    { shapeshifter: [3] },
    { 3: { upper: 'seer', lower: 'shapeshifter' } },
    [],
    [3],
  ),
  [],
);

useGameStore.setState({
  gameMode: 'dual',
  roleMembersMap: { werewolf: [1, 4, 8] },
  playerCardMap: {
    1: { upper: 'werewolf' },
    4: { upper: 'werewolf' },
    8: { upper: 'werewolf' },
  },
  upperDeadPlayers: [1],
  deadPlayers: [],
});
useGameStore.getState().setRoleMembers('werewolf', [1, 4, 8]);

expectEqual(
  're-saving known upper wolf after upper death does not create lower wolf',
  useGameStore.getState().playerCardMap[1],
  { upper: 'werewolf' },
);

expectEqual(
  're-saving known werewolves keeps exactly three wolf members',
  useGameStore.getState().roleMembersMap.werewolf,
  [1, 4, 8],
);

useGameStore.setState({
  gameMode: 'dual',
  roleMembersMap: { seer: [3] },
  playerCardMap: { 3: { upper: 'seer' } },
  upperDeadPlayers: [3],
  deadPlayers: [],
});
useGameStore.getState().setRoleMembers('seer', [3, 3]);

expectEqual(
  'explicit duplicate assigns same role to lower card',
  useGameStore.getState().playerCardMap[3],
  { upper: 'seer', lower: 'seer' },
);

expectEqual(
  'duplicate write stores unique role member list',
  useGameStore.getState().roleMembersMap.seer,
  [3],
);

useGameStore.getState().startNewGame('single');

expectEqual(
  'single mode new game has no golden baby',
  useGameStore.getState().goldenBabyConfig,
  { min: 0, max: 0 },
);

useGameStore.getState().startNewGame('dual');

expectEqual(
  'dual mode new game uses six player default',
  useGameStore.getState().playerCount,
  6,
);

expectEqual(
  'dual mode default role setup matches requested cards',
  useGameStore.getState().selectedRoles,
  DEFAULT_DUAL_CONFIG.selectedRoles,
);

expectEqual(
  'dual mode golden baby range defaults to one to one',
  useGameStore.getState().goldenBabyConfig,
  { min: 1, max: 1 },
);

useGameStore.getState().setConfigName('測試配置');
useGameStore.getState().saveCurrentConfig();

expectEqual(
  'saving current config stores it as last dual config',
  useGameStore.getState().savedConfigs.dual?.name,
  '測試配置',
);

for (const test of tests) {
  console.log(
    `${test.pass ? 'PASS' : 'FAIL'} | ${test.name} | actual=${test.actual} expected=${test.expected}`,
  );
}

if (tests.some(test => !test.pass)) process.exit(1);
