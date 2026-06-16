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
  applyMagicSwapTarget,
  computeBearTamerResult,
  computeNightDeaths,
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

const magician = { roleId: 'magician', members: [9], magicianSwap: [1, 5] };

expectEqual('swap target', applyMagicSwapTarget(1, [1, 5]), 5);
expectEqual(
  'wolf kill swaps 1 to 5',
  computeNightDeaths([magician, { roleId: 'werewolf', members: [2, 3, 4], killTarget: 1 }]),
  [5],
);
expectEqual(
  'bear self swapped from 1 to 5 checks 4 and 6',
  computeBearTamerResult([1], { werewolf: [4] }, {}, [], [], 8, [1, 5]),
  'growl',
);
expectEqual(
  'bear at 3 with 4 and 6 swapped checks 2 and 6',
  computeBearTamerResult([3], { werewolf: [6] }, {}, [], [], 8, [4, 6]),
  'growl',
);
expectEqual(
  'gargoyle target swaps',
  computeNightDeaths([magician, { roleId: 'gargoyle', members: [8], gargoyleTarget: 1 }], { seer: [5] }),
  [5],
);
expectEqual(
  'witch hunter target swaps',
  computeNightDeaths([magician, { roleId: 'witch_hunter', members: [8], witchHunterTarget: 1 }], { werewolf: [5] }),
  [5],
);
expectEqual(
  'anubis targets swap',
  computeNightDeaths([magician, { roleId: 'anubis', members: [8], anubisTargets: [1, 6] }], { werewolf: [5] }),
  [6],
);
expectEqual(
  'tengu target swaps',
  computeNightDeaths([magician, { roleId: 'tengu', members: [8], tenguKillTargets: [1] }]),
  [5],
);
expectEqual(
  'sharpshooter target swaps',
  computeNightDeaths([
    magician,
    { roleId: 'werewolf', members: [2], killTarget: 8 },
    { roleId: 'sharpshooter', members: [8], sharpshooterDeclared: true, sharpshooterTarget: 1 },
  ]),
  [8, 5],
);
expectEqual(
  'white wolf cannot explode at night',
  computeNightDeaths([{ roleId: 'white_wolf', members: [2], explodeTarget: 7 }]),
  [],
);

for (const test of tests) {
  console.log(
    `${test.pass ? 'PASS' : 'FAIL'} | ${test.name} | actual=${test.actual} expected=${test.expected}`,
  );
}

if (tests.some(test => !test.pass)) process.exit(1);
