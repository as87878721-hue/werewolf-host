const assert = require('assert');
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

const { useGameStore } = require('./src/store/gameStore.ts');

useGameStore.getState().startNewGame('single');
useGameStore.setState({
  roleMembersMap: { werewolf: [1], witch: [2] },
  nightActions: [
    { roleId: 'werewolf', members: [1], killTarget: 3 },
    { roleId: 'witch', members: [2], saveTarget: 3, poisonTarget: 4 },
  ],
  saveUsed: true,
  poisonUsed: true,
});

useGameStore.getState().endDay({
  exiledPlayer: undefined,
  isIdiotFlip: false,
  nightChainDeaths: [],
  dayKills: [],
});

assert.strictEqual(useGameStore.getState().saveUsed, true, 'witch antidote should stay used after entering the next night');
assert.strictEqual(useGameStore.getState().poisonUsed, true, 'witch poison should stay used after entering the next night');

console.log('witch potion persistence tests passed');
