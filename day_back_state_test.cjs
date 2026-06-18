const assert = require('assert');
const Module = require('module');
const ts = require('typescript');

Module._extensions['.ts'] = (m, f) => {
  m._compile(ts.transpileModule(require('fs').readFileSync(f, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText, f);
};

const { hasNightDeathStepTransientState } = require('./src/utils/dayBackState.ts');

const base = {
  nightDeathRounds: [[1]],
  initialNightDeathRounds: [[1]],
  handledNightDeathSkills: [],
  nightDeathSkillTarget: null,
  nightDeathSkillBlocked: null,
  nightDeathBadgeAction: null,
  nightDeathBadgeRecipient: null,
  nightDeathBadgeResolved: false,
  bishopTriggerStep: null,
  bishopRevealTarget: null,
  bishopResolved: false,
};

assert.strictEqual(
  hasNightDeathStepTransientState(base),
  false,
  'unchanged death announcement step should go back normally',
);

assert.strictEqual(
  hasNightDeathStepTransientState({
    ...base,
    nightDeathRounds: [[1], [2]],
    handledNightDeathSkills: [1],
  }),
  true,
  'night death chain should be cleared before leaving death announcement step',
);

assert.strictEqual(
  hasNightDeathStepTransientState({
    ...base,
    nightDeathSkillTarget: 2,
  }),
  true,
  'selected night death skill target should be cleared before leaving death announcement step',
);

assert.strictEqual(
  hasNightDeathStepTransientState({
    ...base,
    bishopTriggerStep: 1,
    bishopRevealTarget: 3,
  }),
  true,
  'bishop transfer in death announcement should be cleared before leaving the step',
);

console.log('day back state tests passed');
