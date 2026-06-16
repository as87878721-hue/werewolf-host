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
  getEffectiveDreamwalkerTarget,
  resolveDreamwalkerCarryDeaths,
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

const dreamProtectsSix = { roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 6 };

expectEqual(
  'dreamwalker dies at night and carries current protected target',
  computeNightDeaths(
    [dreamProtectsSix, { roleId: 'werewolf', members: [1, 3, 4], killTarget: 2 }],
    { dreamwalker: [2] },
  ),
  [2, 6],
);

expectEqual(
  'protected target survives while dreamwalker lives',
  computeNightDeaths(
    [dreamProtectsSix, { roleId: 'werewolf', members: [1, 3, 4], killTarget: 6 }],
    { dreamwalker: [2] },
  ),
  [],
);

expectEqual(
  'consecutive protection kills same effective target',
  computeNightDeaths([dreamProtectsSix], { dreamwalker: [2] }, {}, [], 6),
  [6],
);

const previousSwappedTarget = getEffectiveDreamwalkerTarget([
  { roleId: 'magician', members: [9], magicianSwap: [1, 6] },
  { roleId: 'dreamwalker', members: [2], dreamwalkerTarget: 1 },
]);
expectEqual(
  'consecutive protection compares previous magician-swapped target',
  computeNightDeaths([dreamProtectsSix], { dreamwalker: [2] }, {}, [], previousSwappedTarget),
  [6],
);

const swappedDreamActions = [
  { roleId: 'magician', members: [9], magicianSwap: [6, 8] },
  dreamProtectsSix,
];

expectEqual(
  'magician changes effective dreamwalker target',
  getEffectiveDreamwalkerTarget(swappedDreamActions),
  8,
);

expectEqual(
  'dead dreamwalker carries magician-swapped target',
  computeNightDeaths(
    [...swappedDreamActions, { roleId: 'werewolf', members: [1, 3, 4], killTarget: 2 }],
    { dreamwalker: [2] },
  ),
  [2, 8],
);

expectEqual(
  'lover chain that kills dreamwalker also triggers carry death',
  computeNightDeaths(
    [dreamProtectsSix, { roleId: 'werewolf', members: [3], killTarget: 1 }],
    { dreamwalker: [2] },
    {},
    [],
    undefined,
    [1, 2],
    'single',
  ),
  [1, 2, 6],
);

expectEqual(
  'night hunter shot on dreamwalker resolves carry death before voting',
  resolveDreamwalkerCarryDeaths(
    [2],
    [dreamProtectsSix],
    { dreamwalker: [2] },
  ),
  [2, 6],
);

function setDayScenario() {
  useGameStore.getState().startNewGame('single');
  useGameStore.setState({
    nightActions: [dreamProtectsSix],
    nightHistory: [{
      nightNumber: 1,
      actions: [dreamProtectsSix],
      summary: [],
    }],
    roleMembersMap: { dreamwalker: [2] },
    playerCardMap: {},
    deadPlayers: [],
    upperDeadPlayers: [],
  });
}

setDayScenario();
useGameStore.getState().endDay({ exiledPlayer: 2 });
expectEqual(
  'day exile of dreamwalker carries current protected target',
  useGameStore.getState().deadPlayers,
  [2, 6],
);

setDayScenario();
useGameStore.getState().endDay({ dayKills: [2] });
expectEqual(
  'day ability kill of dreamwalker carries current protected target',
  useGameStore.getState().deadPlayers,
  [2, 6],
);

for (const test of tests) {
  console.log(
    `${test.pass ? 'PASS' : 'FAIL'} | ${test.name} | actual=${test.actual} expected=${test.expected}`,
  );
}

if (tests.some(test => !test.pass)) process.exit(1);
