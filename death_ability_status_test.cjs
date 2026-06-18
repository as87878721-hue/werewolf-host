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

const { getNightDeathAbilityStatus } = require('./src/store/gameStore.ts');
const { ROLES } = require('./src/data/roles.ts');

const tests = [];

function expectEqual(name, actual, expected) {
  tests.push({ name, actual, expected, pass: actual === expected });
}

expectEqual(
  'wolf king killed by a night attack can trigger',
  getNightDeathAbilityStatus(
    5,
    [
      { roleId: 'werewolf', members: [1, 2, 3], killTarget: 5 },
      { roleId: 'witch', members: [4] },
    ],
    { wolf_king: [5] },
  ),
  'can_trigger',
);

expectEqual(
  'wolf king poisoned by witch cannot trigger',
  getNightDeathAbilityStatus(
    5,
    [{ roleId: 'witch', members: [4], poisonTarget: 5 }],
    { wolf_king: [5] },
  ),
  'poisoned',
);

expectEqual(
  'magician redirects poison onto wolf king',
  getNightDeathAbilityStatus(
    5,
    [
      { roleId: 'magician', members: [9], magicianSwap: [2, 5] },
      { roleId: 'witch', members: [4], poisonTarget: 2 },
    ],
    { wolf_king: [5] },
  ),
  'poisoned',
);

expectEqual(
  'dreamwalker protection means death ability remains available',
  getNightDeathAbilityStatus(
    5,
    [
      { roleId: 'dreamwalker', members: [6], dreamwalkerTarget: 5 },
      { roleId: 'witch', members: [4], poisonTarget: 5 },
    ],
    { wolf_king: [5], dreamwalker: [6] },
  ),
  'can_trigger',
);

expectEqual(
  'hunter uses the same poison restriction',
  getNightDeathAbilityStatus(
    7,
    [{ roleId: 'witch', members: [4], poisonTarget: 7 }],
    { hunter: [7] },
  ),
  'poisoned',
);

expectEqual(
  'inactive dual identity mummy seal does not block hunter',
  getNightDeathAbilityStatus(
    7,
    [{ roleId: 'mummy', members: [2], mummySealedRole: 'hunter' }],
    { mummy: [2], hunter: [7] },
    {
      2: { upper: 'mummy', lower: 'villager' },
      7: { upper: 'hunter' },
    },
    [2],
    undefined,
    null,
    'dual',
  ),
  'can_trigger',
);

expectEqual(
  'active dual identity mummy seal blocks hunter',
  getNightDeathAbilityStatus(
    7,
    [{ roleId: 'mummy', members: [2], mummySealedRole: 'hunter' }],
    { mummy: [2], hunter: [7] },
    {
      2: { upper: 'villager', lower: 'mummy' },
      7: { upper: 'hunter' },
    },
    [2],
    undefined,
    null,
    'dual',
  ),
  'sealed',
);

expectEqual(
  'living wolf king still sees that the death ability is available',
  getNightDeathAbilityStatus(
    5,
    [{ roleId: 'witch', members: [4] }],
    { wolf_king: [5] },
  ),
  'can_trigger',
);

const witchOrder = ROLES.find(role => role.id === 'witch').defaultOrder;
const wolfKingOrder = ROLES.find(role => role.id === 'wolf_king').defaultOrder;
expectEqual(
  'wolf king status step defaults after witch',
  wolfKingOrder > witchOrder,
  true,
);

for (const test of tests) {
  console.log(
    `${test.pass ? 'PASS' : 'FAIL'} | ${test.name} | actual=${JSON.stringify(test.actual)} expected=${JSON.stringify(test.expected)}`,
  );
}

if (tests.some(test => !test.pass)) process.exit(1);
