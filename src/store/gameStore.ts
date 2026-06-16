import { create } from 'zustand';
import { ROLES } from '../data/roles';

export interface RoleEntry {
  roleId: string;
  count: number;
}

export interface NightAction {
  roleId: string;
  members: number[];
  killTarget?: number;
  checkTarget?: number;
  checkResult?: 'wolf' | 'good';
  protectTarget?: number;
  saveTarget?: number;
  poisonTarget?: number;
  linkTargets?: number[];
  dreamwalkerTarget?: number;
  surroundTarget?: number;
  bloodMoonActivated?: boolean;
  explodeTarget?: number;
  gargoyleTarget?: number;
  anubisTargets?: number[];
  witchHunterTarget?: number;
  tenguKillTargets?: number[];
  magicianSwap?: [number, number];
  sharpshooterDeclared?: boolean;
  sharpshooterTarget?: number;
  thiefRole?: string;
  bearTamerResult?: 'growl' | 'silent';
}

export interface NightRecord {
  nightNumber: number;
  actions: NightAction[];
  summary: string[];
}

export interface GoldenBabyConfig {
  min: number;
  max: number;
}

export interface GameLogEntry {
  id: number;
  night: number;
  phase: string;
  text: string;
}

export interface GameConfigSnapshot {
  name: string;
  mode: GameMode;
  playerCount: number;
  selectedRoles: RoleEntry[];
  goldenBabyConfig: GoldenBabyConfig;
}

// 預設 9 人標準局
const DEFAULT_ROLES: RoleEntry[] = [
  { roleId: 'werewolf', count: 3 },
  { roleId: 'seer',     count: 1 },
  { roleId: 'witch',    count: 1 },
  { roleId: 'hunter',   count: 1 },
  { roleId: 'villager', count: 3 },
];

export type GameMode = 'single' | 'dual';

export const DEFAULT_SINGLE_CONFIG: GameConfigSnapshot = {
  name: '單身分預設',
  mode: 'single',
  playerCount: 9,
  selectedRoles: [...DEFAULT_ROLES],
  goldenBabyConfig: { min: 0, max: 0 },
};

export const DEFAULT_DUAL_CONFIG: GameConfigSnapshot = {
  name: '雙身分 6 人預設',
  mode: 'dual',
  playerCount: 6,
  selectedRoles: [
    { roleId: 'villager', count: 5 },
    { roleId: 'wild_child', count: 1 },
    { roleId: 'seer', count: 1 },
    { roleId: 'witch', count: 1 },
    { roleId: 'guard', count: 1 },
    { roleId: 'hunter', count: 1 },
    { roleId: 'werewolf', count: 1 },
    { roleId: 'white_wolf', count: 1 },
  ],
  goldenBabyConfig: { min: 1, max: 1 },
};

interface GameState {
  gameMode: GameMode;
  playerCount: number;
  selectedRoles: RoleEntry[];
  nightOrder: string[];
  currentNight: number;
  currentStep: number;
  nightActions: NightAction[];
  nightHistory: NightRecord[];
  saveUsed: boolean;
  poisonUsed: boolean;
  sharpshooterUsed: boolean;
  checkedPlayers: Record<number, 'wolf' | 'good'>;
  roleMembersMap: Record<string, number[]>;
  deadPlayers: number[];
  upperDeadPlayers: number[];
  playerCardMap: Record<number, { upper?: string; lower?: string }>;
  sheriffPlayer: number | null;
  lostVotePlayers: number[];
  idiotFlippedPlayers: number[];
  anubisScaledPlayers: number[];
  cupidLovers: [number, number] | null;
  bishopHolder: number | null;
  knightUsed: boolean;
  lastDayExileInfo: { player: number; upperWasAlive: boolean } | null;
  goldenBabyConfig: GoldenBabyConfig;
  goldenBabyPlayers: number[];
  gameLog: GameLogEntry[];
  configName: string;
  savedConfigs: Partial<Record<GameMode, GameConfigSnapshot>>;

  setPlayerCount: (count: number) => void;
  setGoldenBabyConfig: (config: GoldenBabyConfig) => void;
  setGoldenBabyPlayers: (players: number[]) => void;
  setConfigName: (name: string) => void;
  applyConfig: (config: GameConfigSnapshot) => void;
  saveCurrentConfig: () => void;
  appendLog: (phase: string, text: string) => void;
  setUpperDead: (players: number[]) => void;
  addRole: (roleId: string) => void;
  removeRole: (roleId: string) => void;
  initNightOrder: () => void;
  moveOrderUp: (index: number) => void;
  moveOrderDown: (index: number) => void;
  reorderNightOrder: (newOrder: string[]) => void;
  recordAction: (action: NightAction) => void;
  nextStep: () => void;
  finishNight: () => NightRecord;
  resetNight: () => void;
  startNewGame: (mode: GameMode) => void;
  setRoleMembers: (roleId: string, members: number[]) => void;
  setSheriff: (player: number | null) => void;
  setBishopHolder: (player: number | null) => void;
  setKnightUsed: (used: boolean) => void;
  endDay: (opts: {
    exiledPlayer?: number;
    isIdiotFlip?: boolean;
    nightChainDeaths?: number[];
    dayKills?: number[];
  }) => void;
  transformThief: (players: number[], roleId: string) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  gameMode: 'single',
  playerCount: 9,
  selectedRoles: [...DEFAULT_ROLES],
  nightOrder: [],
  currentNight: 1,
  currentStep: 0,
  nightActions: [],
  nightHistory: [],
  saveUsed: false,
  poisonUsed: false,
  sharpshooterUsed: false,
  checkedPlayers: {},
  roleMembersMap: {},
  deadPlayers: [],
  upperDeadPlayers: [],
  playerCardMap: {},
  sheriffPlayer: null,
  lostVotePlayers: [],
  idiotFlippedPlayers: [],
  anubisScaledPlayers: [],
  cupidLovers: null,
  bishopHolder: null,
  knightUsed: false,
  lastDayExileInfo: null,
  goldenBabyConfig: { min: 0, max: 0 },
  goldenBabyPlayers: [],
  gameLog: [],
  configName: DEFAULT_SINGLE_CONFIG.name,
  savedConfigs: {},

  setPlayerCount: (count) => set({ playerCount: Math.max(1, Math.floor(count)) }),
  setGoldenBabyConfig: (config) => set({
    goldenBabyConfig: {
      min: Math.max(0, Math.floor(config.min)),
      max: Math.max(0, Math.floor(config.max)),
    },
  }),
  setGoldenBabyPlayers: (players) => set({ goldenBabyPlayers: [...new Set(players)] }),
  setConfigName: (name) => set({ configName: name }),
  applyConfig: (config) => set({
    gameMode: config.mode,
    playerCount: config.playerCount,
    selectedRoles: config.selectedRoles.map(role => ({ ...role })),
    goldenBabyConfig: config.mode === 'dual' ? { ...config.goldenBabyConfig } : { min: 0, max: 0 },
    goldenBabyPlayers: [],
    configName: config.name,
    nightOrder: [],
    currentStep: 0,
    nightActions: [],
    roleMembersMap: {},
    playerCardMap: {},
    deadPlayers: [],
    upperDeadPlayers: [],
  }),
  saveCurrentConfig: () => {
    const { gameMode, playerCount, selectedRoles, goldenBabyConfig, configName } = get();
    const snapshot: GameConfigSnapshot = {
      name: configName.trim() || (gameMode === 'dual' ? DEFAULT_DUAL_CONFIG.name : DEFAULT_SINGLE_CONFIG.name),
      mode: gameMode,
      playerCount,
      selectedRoles: selectedRoles.map(role => ({ ...role })),
      goldenBabyConfig: gameMode === 'dual' ? { ...goldenBabyConfig } : { min: 0, max: 0 },
    };
    set(state => ({
      configName: snapshot.name,
      savedConfigs: { ...state.savedConfigs, [gameMode]: snapshot },
    }));
  },
  appendLog: (phase, text) => set(state => ({
    gameLog: [
      ...state.gameLog,
      { id: state.gameLog.length + 1, night: state.currentNight, phase, text },
    ],
  })),

  setUpperDead: (players) => set({ upperDeadPlayers: players }),

  addRole: (roleId) => {
    const { selectedRoles } = get();
    const existing = selectedRoles.find(r => r.roleId === roleId);
    if (existing) {
      set({ selectedRoles: selectedRoles.map(r => r.roleId === roleId ? { ...r, count: r.count + 1 } : r) });
    } else {
      set({ selectedRoles: [...selectedRoles, { roleId, count: 1 }] });
    }
  },

  removeRole: (roleId) => {
    const { selectedRoles } = get();
    const existing = selectedRoles.find(r => r.roleId === roleId);
    if (!existing) return;
    if (existing.count <= 1) {
      set({ selectedRoles: selectedRoles.filter(r => r.roleId !== roleId) });
    } else {
      set({ selectedRoles: selectedRoles.map(r => r.roleId === roleId ? { ...r, count: r.count - 1 } : r) });
    }
  },

  initNightOrder: () => {
    const { selectedRoles, goldenBabyConfig, gameMode } = get();
    const roleIds = new Set(selectedRoles.map(r => r.roleId));
    if (gameMode === 'dual' && goldenBabyConfig.max > 0) roleIds.add('golden_baby');
    const order = ROLES
      .filter(r => r.hasNightAction && roleIds.has(r.id))
      .sort((a, b) => a.defaultOrder - b.defaultOrder)
      .map(r => r.id);
    set({ nightOrder: order });
  },

  moveOrderUp: (index) => {
    if (index <= 0) return;
    const order = [...get().nightOrder];
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    set({ nightOrder: order });
  },

  moveOrderDown: (index) => {
    const order = [...get().nightOrder];
    if (index >= order.length - 1) return;
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    set({ nightOrder: order });
  },

  reorderNightOrder: (newOrder) => {
    set({ nightOrder: newOrder });
  },

  recordAction: (action) => {
    const { nightActions, currentStep, checkedPlayers } = get();
    const updated = [...nightActions];
    updated[currentStep] = action;
    const magicSwap = getMagicSwap(updated);
    set({ nightActions: updated });

    if (action.roleId === 'witch') {
      if (action.saveTarget !== undefined) set({ saveUsed: true });
      if (action.poisonTarget !== undefined) set({ poisonUsed: true });
    }

    if (action.roleId === 'seer' && action.checkTarget !== undefined && action.checkResult) {
      set({ checkedPlayers: { ...checkedPlayers, [action.checkTarget]: action.checkResult } });
    }

    if (action.roleId === 'cupid' && (action.linkTargets?.length ?? 0) === 2) {
      set({ cupidLovers: applyMagicSwapTargets(action.linkTargets, magicSwap) as [number, number] });
    }

    if (action.roleId === 'anubis' && (action.anubisTargets?.length ?? 0) === 2) {
      set(state => ({ anubisScaledPlayers: [...new Set([...state.anubisScaledPlayers, ...applyMagicSwapTargets(action.anubisTargets, magicSwap)!])] }));
    }

    if (action.roleId === 'golden_baby') {
      set({ goldenBabyPlayers: [...new Set(action.members)] });
    }

    const role = ROLES.find(r => r.id === action.roleId);
    const actorText = action.members.length > 0 ? action.members.map(p => `${p}號`).join('、') : '無活躍位置';
    get().appendLog('夜晚技能', `${role?.name ?? action.roleId}：${actorText}`);
  },

  nextStep: () => {
    const { currentStep, nightOrder } = get();
    set({ currentStep: Math.min(currentStep + 1, nightOrder.length) });
  },

  finishNight: () => {
    const { nightActions: rawActions, currentNight, roleMembersMap, playerCardMap, upperDeadPlayers, deadPlayers, playerCount, nightHistory, cupidLovers, gameMode } = get();
    const totalPlayers = playerCount;
    const prevDreamwalkerTarget = getEffectiveDreamwalkerTarget(nightHistory.at(-1)?.actions ?? []);
    const finalMagicSwap = getMagicSwap(rawActions);
    // 夜晚所有角色記錄完畢後，自動計算訓熊師結果
    const nightActions = rawActions.map(a => {
      if (a.roleId === 'bear_tamer') {
        return { ...a, bearTamerResult: computeBearTamerResult(a.members, roleMembersMap, playerCardMap, upperDeadPlayers, deadPlayers, totalPlayers, finalMagicSwap) };
      }
      return a;
    });
    const cupidAction = nightActions.find(a => a.roleId === 'cupid' && (a.linkTargets?.length ?? 0) === 2);
    const resolvedCupidLovers = cupidAction
      ? applyMagicSwapTargets(cupidAction.linkTargets, finalMagicSwap) as [number, number]
      : cupidLovers;
    const anubisAction = nightActions.find(a => a.roleId === 'anubis' && (a.anubisTargets?.length ?? 0) === 2);
    const resolvedAnubisTargets = anubisAction
      ? applyMagicSwapTargets(anubisAction.anubisTargets, finalMagicSwap) ?? []
      : [];
    const summary = buildNightSummary(nightActions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, resolvedCupidLovers, gameMode);
    const record: NightRecord = { nightNumber: currentNight, actions: nightActions, summary };
    set(state => ({
      nightHistory: [...state.nightHistory, record],
      nightActions,
      cupidLovers: resolvedCupidLovers,
      anubisScaledPlayers: anubisAction
        ? [...new Set([
            ...state.anubisScaledPlayers.filter(p => !anubisAction.anubisTargets!.includes(p)),
            ...resolvedAnubisTargets,
          ])]
        : state.anubisScaledPlayers,
    }));
    for (const line of summary) {
      if (line.trim() !== '') get().appendLog('夜晚結算', line);
    }
    return record;
  },

  resetNight: () => {
    const { nightActions, deadPlayers, upperDeadPlayers, gameMode, roleMembersMap, playerCardMap, nightHistory, cupidLovers } = get();
    // finishNight already added current night to history; prev night is at -2
    const prevDreamwalkerTarget = getEffectiveDreamwalkerTarget(nightHistory.at(-2)?.actions ?? []);
    const newDeaths = computeNightDeaths(nightActions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, cupidLovers, gameMode);

    if (gameMode === 'dual') {
      // 雙身分：第一次死亡 → upperDeadPlayers（上牌死，仍可點）
      //         第二次死亡 → deadPlayers（兩牌皆死，不可點）
      const nextUpper = [...upperDeadPlayers];
      const nextFull  = [...deadPlayers];
      for (const p of newDeaths) {
        if (nextFull.includes(p)) continue; // 已全死，不再處理
        if (nextUpper.includes(p)) {
          // 上牌已死 → 下牌也死 → 移入 deadPlayers
          nextFull.push(p);
          const idx = nextUpper.indexOf(p);
          if (idx !== -1) nextUpper.splice(idx, 1);
        } else {
          // 第一次死亡 → 上牌死
          nextUpper.push(p);
        }
      }
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        deadPlayers: [...new Set(nextFull)],
        upperDeadPlayers: [...new Set(nextUpper)],
      }));
    } else {
      const allDead = [...new Set([...deadPlayers, ...newDeaths])];
      set(state => ({ currentNight: state.currentNight + 1, currentStep: 0, nightActions: [], deadPlayers: allDead }));
    }
  },

  startNewGame: (mode) => {
    const baseConfig = mode === 'dual' ? DEFAULT_DUAL_CONFIG : DEFAULT_SINGLE_CONFIG;
    set({
      gameMode: mode,
      playerCount: baseConfig.playerCount,
      selectedRoles: baseConfig.selectedRoles.map(role => ({ ...role })),
      nightOrder: [],
      currentNight: 1,
      currentStep: 0,
      nightActions: [],
      nightHistory: [],
      saveUsed: false,
      poisonUsed: false,
      sharpshooterUsed: false,
      checkedPlayers: {},
      roleMembersMap: {},
      playerCardMap: {},
      deadPlayers: [],
      upperDeadPlayers: [],
      sheriffPlayer: null,
      lostVotePlayers: [],
      idiotFlippedPlayers: [],
      anubisScaledPlayers: [],
      cupidLovers: null,
      bishopHolder: null,
      knightUsed: false,
      lastDayExileInfo: null,
      goldenBabyConfig: { ...baseConfig.goldenBabyConfig },
      goldenBabyPlayers: [],
      gameLog: [],
      configName: baseConfig.name,
    });
  },

  setSheriff: (player) => set({ sheriffPlayer: player }),
  setBishopHolder: (player) => set({ bishopHolder: player }),
  setKnightUsed: (used) => set({ knightUsed: used }),

  endDay: ({ exiledPlayer, isIdiotFlip = false, nightChainDeaths, dayKills = [] }) => {
    const {
      nightActions, deadPlayers, upperDeadPlayers, gameMode,
      lostVotePlayers, idiotFlippedPlayers, roleMembersMap, playerCardMap,
      nightHistory, cupidLovers, sharpshooterUsed,
    } = get();
    // finishNight already added current night to history; prev night is at -2
    const prevDreamwalkerTarget = getEffectiveDreamwalkerTarget(nightHistory.at(-2)?.actions ?? []);
    const computedNightDeaths = computeNightDeaths(nightActions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, cupidLovers, gameMode);
    const nightDeaths = [...new Set(nightChainDeaths ?? computedNightDeaths)];

    const directDayDeaths = [
      ...(exiledPlayer !== undefined && !isIdiotFlip ? [exiledPlayer] : []),
      ...dayKills,
    ];
    const dayPhaseUpperDeadPlayers = gameMode === 'dual'
      ? [...new Set([...upperDeadPlayers, ...nightDeaths])]
      : upperDeadPlayers;
    const resolvedDayDeaths = resolveAutomaticDeathRounds(
      directDayDeaths,
      'day',
      nightActions,
      roleMembersMap,
      playerCardMap,
      dayPhaseUpperDeadPlayers,
      deadPlayers,
      prevDreamwalkerTarget,
      cupidLovers,
      gameMode,
      gameMode === 'single' ? nightDeaths : [],
    ).flat();
    const allNewDeaths = [
      ...nightDeaths,
      ...resolvedDayDeaths,
    ];
    const uniqueNewDeaths = [...new Set(allNewDeaths)];
    const exileText = exiledPlayer === undefined
      ? '本日流票'
      : isIdiotFlip
      ? `${exiledPlayer}號翻牌，未出局`
      : `${exiledPlayer}號被放逐`;
    get().appendLog(
      '白天結算',
      `${exileText}；新增死亡：${uniqueNewDeaths.length > 0 ? uniqueNewDeaths.map(p => `${p}號`).join('、') : '無'}`,
    );

    // Idiot flip: no longer loses voting rights; track separately
    const newLostVote = lostVotePlayers;
    const newIdiotFlipped = (exiledPlayer !== undefined && isIdiotFlip)
      ? [...new Set([...idiotFlippedPlayers, exiledPlayer])]
      : idiotFlippedPlayers;

    // Sharpshooter: once declared, ability is permanently consumed
    const declaredThisNight = nightActions.some(a => a.roleId === 'sharpshooter' && a.sharpshooterDeclared);
    const newSharpshooterUsed = sharpshooterUsed || declaredThisNight;

    // 記錄今天放逐資訊供守墓人使用
    const exileInfo = (exiledPlayer !== undefined && !isIdiotFlip)
      ? {
          player: exiledPlayer,
          upperWasAlive:
            !upperDeadPlayers.includes(exiledPlayer) &&
            !nightDeaths.includes(exiledPlayer) &&
            !deadPlayers.includes(exiledPlayer),
        }
      : null;

    if (gameMode === 'dual') {
      const nextUpper = [...upperDeadPlayers];
      const nextFull  = [...deadPlayers];
      for (const p of allNewDeaths) {
        if (nextFull.includes(p)) continue;
        if (nextUpper.includes(p)) {
          nextFull.push(p);
          const idx = nextUpper.indexOf(p);
          if (idx !== -1) nextUpper.splice(idx, 1);
        } else {
          nextUpper.push(p);
        }
      }
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        saveUsed: false,
        poisonUsed: false,
        sharpshooterUsed: newSharpshooterUsed,
        deadPlayers: [...new Set(nextFull)],
        upperDeadPlayers: [...new Set(nextUpper)],
        lostVotePlayers: newLostVote,
        idiotFlippedPlayers: newIdiotFlipped,
        lastDayExileInfo: exileInfo,
      }));
    } else {
      const allDead = [...new Set([...deadPlayers, ...allNewDeaths])];
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        saveUsed: false,
        poisonUsed: false,
        sharpshooterUsed: newSharpshooterUsed,
        deadPlayers: allDead,
        lostVotePlayers: newLostVote,
        idiotFlippedPlayers: newIdiotFlipped,
        lastDayExileInfo: exileInfo,
      }));
    }
  },

  setRoleMembers: (roleId, members) => {
    const { upperDeadPlayers, deadPlayers, playerCardMap } = get();
    const forcedLowerRoles = new Set(['shapeshifter', 'sharpshooter']);
    const forcedUpperRoles = new Set(['thief']);
    const uniqueMembers = [...new Set(members)];
    const memberCounts = members.reduce<Record<number, number>>((counts, player) => {
      counts[player] = (counts[player] ?? 0) + 1;
      return counts;
    }, {});

    const newCardMap: Record<number, { upper?: string; lower?: string }> = {};
    for (const [pStr, cards] of Object.entries(playerCardMap)) {
      const p = Number(pStr);
      const isFullyDead = deadPlayers.includes(p);
      const isUpperDead = upperDeadPlayers.includes(p);

      if (isFullyDead) {
        newCardMap[p] = { upper: cards.upper, lower: cards.lower };
      } else if (isUpperDead) {
        newCardMap[p] = {
          upper: cards.upper,
          lower: cards.lower === roleId ? undefined : cards.lower,
        };
      } else {
        newCardMap[p] = {
          upper: cards.upper === roleId ? undefined : cards.upper,
          lower: cards.lower === roleId ? undefined : cards.lower,
        };
      }
    }

    for (const p of uniqueMembers) {
      if (deadPlayers.includes(p)) continue;
      const original = playerCardMap[p] ?? {};
      const slots = new Set<'upper' | 'lower'>();

      if (original.upper === roleId) slots.add('upper');
      if (original.lower === roleId) slots.add('lower');
      if ((memberCounts[p] ?? 0) > 1 && upperDeadPlayers.includes(p)) slots.add('lower');

      if (slots.size === 0) {
        if (forcedLowerRoles.has(roleId)) slots.add('lower');
        else if (forcedUpperRoles.has(roleId)) slots.add('upper');
        else if (upperDeadPlayers.includes(p)) slots.add('lower');
        else slots.add('upper');
      }

      const prev = newCardMap[p] ?? {};
      newCardMap[p] = { ...prev };
      for (const slot of slots) {
        newCardMap[p] = { ...newCardMap[p], [slot]: roleId };
      }
    }

    set(state => ({
      roleMembersMap: { ...state.roleMembersMap, [roleId]: uniqueMembers },
      playerCardMap: newCardMap,
    }));
  },

  /*
  setRoleMembersLegacy: (roleId, members) => {
    const { upperDeadPlayers, deadPlayers, playerCardMap } = get();

    // 強制下牌腳色（第二張）：変形怪、神射手
    const FORCED_LOWER = new Set(['shapeshifter', 'sharpshooter']);
    // 強制上牌腳色（第一張）：盜賊
    const FORCED_UPPER = new Set(['thief']);

    // 先清除舊有此 roleId 的 playerCardMap 記錄
    // 死亡玩家（上牌死 or 全死）的記錄是歷史，不可被後續步驟清除或覆寫
    const newCardMap: Record<number, { upper?: string; lower?: string }> = {};
    for (const [pStr, cards] of Object.entries(playerCardMap)) {
      const p = Number(pStr);
      const isFullyDead = deadPlayers.includes(p);
      const isUpperDead = upperDeadPlayers.includes(p);
      if (isFullyDead) {
        // 全死：保留所有記錄，不做任何清除
        newCardMap[p] = { upper: cards.upper, lower: cards.lower };
      } else if (isUpperDead) {
        // 上牌已死：保留 upper 歷史，只清除 lower
        newCardMap[p] = {
          upper: cards.upper,
          lower: cards.lower === roleId ? undefined : cards.lower,
        };
      } else {
        // 存活玩家：正常清除（兩個 slot 都清）
        newCardMap[p] = {
          upper: cards.upper === roleId ? undefined : cards.upper,
          lower: cards.lower === roleId ? undefined : cards.lower,
        };
      }
    }

    // 依規則決定指派到哪個 slot（全死玩家不可再指派）
    for (const p of members) {
      if (deadPlayers.includes(p)) continue;
      const prev = newCardMap[p] ?? {};
      let slot: 'upper' | 'lower';

      if (FORCED_LOWER.has(roleId)) {
        // 強制下牌
        slot = 'lower';
      } else if (FORCED_UPPER.has(roleId)) {
        // 強制上牌
        slot = 'upper';
      } else if (upperDeadPlayers.includes(p)) {
        // 上牌已死 → 這是其下牌身分
        slot = 'lower';
      } else {
        slot = 'upper';
      }

      newCardMap[p] = { ...prev, [slot]: roleId };
    }

    set(state => ({
      roleMembersMap: { ...state.roleMembersMap, [roleId]: members },
      playerCardMap: newCardMap,
    }));
  },

  */

  transformThief: (players, roleId) => {
    set(state => {
      const playerCardMap = { ...state.playerCardMap };
      const roleMembersMap = { ...state.roleMembersMap };
      const thiefMembers = new Set(roleMembersMap['thief'] ?? []);
      const targetMembers = new Set(roleMembersMap[roleId] ?? []);

      for (const player of players) {
        const cards = playerCardMap[player] ?? {};
        playerCardMap[player] = { ...cards, upper: roleId };
        thiefMembers.delete(player);
        targetMembers.add(player);
      }

      roleMembersMap['thief'] = [...thiefMembers];
      roleMembersMap[roleId] = [...targetMembers];
      return { playerCardMap, roleMembersMap };
    });
  },
}));

function fmt(n: number) { return `${n}號`; }

export function getMagicSwap(actions: NightAction[]): [number, number] | undefined {
  return actions.find(a => a.roleId === 'magician')?.magicianSwap;
}

export function applyMagicSwapTarget(target: number | undefined, magicSwap?: [number, number]): number | undefined {
  if (!magicSwap || target === undefined) return target;
  if (target === magicSwap[0]) return magicSwap[1];
  if (target === magicSwap[1]) return magicSwap[0];
  return target;
}

export function applyMagicSwapTargets(targets: number[] | undefined, magicSwap?: [number, number]): number[] | undefined {
  return targets?.map(t => applyMagicSwapTarget(t, magicSwap)!);
}

export function getGravediggerLowerInfo(
  lastDayExileInfo: { player: number; upperWasAlive: boolean } | null,
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  deadPlayers: number[] = [],
): { player: number; isWolf: boolean; roleName: string } | null {
  if (!lastDayExileInfo?.upperWasAlive) return null;
  const player = lastDayExileInfo.player;
  if (deadPlayers.includes(player)) return null;
  const lowerRoleId = playerCardMap[player]?.lower;
  if (!lowerRoleId) return null;
  const lowerRole = ROLES.find(r => r.id === lowerRoleId);
  return {
    player,
    isWolf: lowerRole?.team === 'wolf' || lowerRoleId === 'wild_child',
    roleName: lowerRole?.name ?? lowerRoleId,
  };
}

export function getEffectiveDreamwalkerTarget(actions: NightAction[]): number | undefined {
  const target = actions.find(a => a.roleId === 'dreamwalker')?.dreamwalkerTarget;
  return applyMagicSwapTarget(target, getMagicSwap(actions));
}

export function getActiveNightRoleMembers(
  roleId: string,
  selectedMembers: number[],
  gameMode: GameMode,
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  deadPlayers: number[] = [],
): number[] {
  const knownMembers = roleMembersMap[roleId] ?? [];
  const forcedLowerRoles = new Set(['shapeshifter', 'sharpshooter']);
  const forcedUpperRoles = new Set(['thief']);

  return selectedMembers.filter(player => {
    if (deadPlayers.includes(player)) return false;
    if (gameMode === 'single') return true;

    const cards = playerCardMap[player] ?? {};
    const upperIsDead = upperDeadPlayers.includes(player);
    const currentActiveRole = upperIsDead ? cards.lower : cards.upper;
    if (currentActiveRole === roleId) return true;

    // 已記錄的角色位置若目前不是活躍牌，不可發動技能。
    if (knownMembers.includes(player)) return false;

    // 新選擇的位置尚未寫入牌面，依 setRoleMembers 的分牌規則預判。
    if (forcedLowerRoles.has(roleId)) return upperIsDead;
    if (forcedUpperRoles.has(roleId)) return !upperIsDead;
    if (upperIsDead) return true;
    return cards.upper === undefined || cards.upper === roleId;
  });
}

export function canAssignNightRolePosition(
  roleId: string,
  player: number,
  gameMode: GameMode,
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  deadPlayers: number[] = [],
): boolean {
  if (deadPlayers.includes(player)) return false;
  const cards = playerCardMap[player] ?? {};
  if (gameMode === 'single') {
    return cards.upper === undefined || cards.upper === roleId;
  }

  const upperIsDead = upperDeadPlayers.includes(player);
  if (roleId === 'shapeshifter' || roleId === 'sharpshooter') {
    return cards.lower === undefined || cards.lower === roleId;
  }
  if (roleId === 'thief') {
    return !upperIsDead && (cards.upper === undefined || cards.upper === roleId);
  }
  if (upperIsDead) {
    return cards.lower === undefined || cards.lower === roleId;
  }
  return cards.upper === undefined || cards.upper === roleId;
}

export function getWolfNightParticipants(
  gameMode: GameMode,
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  deadPlayers: number[] = [],
): number[] {
  const activeWerewolves = getActiveNightRoleMembers(
    'werewolf',
    roleMembersMap['werewolf'] ?? [],
    gameMode,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    deadPlayers,
  );
  const shapeshifters = (roleMembersMap['shapeshifter'] ?? []).filter(player => {
    if (deadPlayers.includes(player)) return false;
    if (gameMode === 'single') return true;
    return playerCardMap[player]?.lower === 'shapeshifter';
  });
  return [...new Set([...activeWerewolves, ...shapeshifters])];
}

export type NightDeathAbilityStatus = 'can_trigger' | 'poisoned';

export type DeathTiming = 'night' | 'day';

export interface DeathSkillTrigger {
  player: number;
  roleId: 'hunter' | 'wolf_king';
}

export function getActiveRoleAtPhaseStart(
  player: number,
  gameMode: GameMode,
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
): string | undefined {
  if (gameMode === 'dual') {
    const cards = playerCardMap[player];
    return upperDeadPlayers.includes(player) ? cards?.lower : cards?.upper;
  }
  return Object.entries(roleMembersMap)
    .find(([, members]) => (members ?? []).includes(player))?.[0];
}

function isNightSkillImmune(
  player: number,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]>,
  playerCardMap: Record<number, { upper?: string; lower?: string }>,
  upperDeadPlayers: number[],
  prevDreamwalkerTarget: number | undefined,
  gameMode: GameMode,
): boolean {
  const currentDreamwalkerTarget = getEffectiveDreamwalkerTarget(actions);
  const isConsecutiveDreamwalk =
    currentDreamwalkerTarget !== undefined &&
    prevDreamwalkerTarget !== undefined &&
    currentDreamwalkerTarget === prevDreamwalkerTarget;
  if (currentDreamwalkerTarget === player && !isConsecutiveDreamwalk) return true;
  return getActiveRoleAtPhaseStart(
    player,
    gameMode,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
  ) === 'frankenstein';
}

export function resolveTimedDeathSkillTarget(
  selectedTarget: number,
  timing: DeathTiming,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  prevDreamwalkerTarget?: number,
  gameMode: GameMode = 'single',
): number | undefined {
  const effectiveTarget = timing === 'night'
    ? applyMagicSwapTarget(selectedTarget, getMagicSwap(actions))
    : selectedTarget;
  if (effectiveTarget === undefined) return undefined;
  if (
    timing === 'night' &&
    isNightSkillImmune(
      effectiveTarget,
      actions,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      prevDreamwalkerTarget,
      gameMode,
    )
  ) {
    return undefined;
  }
  return effectiveTarget;
}

export function resolveAutomaticDeathRounds(
  initialDeaths: number[],
  timing: DeathTiming,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  deadPlayers: number[] = [],
  prevDreamwalkerTarget?: number,
  cupidLovers?: [number, number] | null,
  gameMode: GameMode = 'single',
  existingChainDeaths: number[] = [],
): number[][] {
  const seen = new Set([...deadPlayers, ...existingChainDeaths]);
  const firstRound = [...new Set(initialDeaths)].filter(player => !seen.has(player));
  if (firstRound.length === 0) return [];

  const rounds: number[][] = [];
  let currentRound = firstRound;
  const dreamwalkerTarget = getEffectiveDreamwalkerTarget(actions);

  while (currentRound.length > 0) {
    rounds.push(currentRound);
    currentRound.forEach(player => seen.add(player));
    const nextRound = new Set<number>();

    for (const player of currentRound) {
      const activeRole = getActiveRoleAtPhaseStart(
        player,
        gameMode,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
      );
      if (
        activeRole === 'dreamwalker' &&
        dreamwalkerTarget !== undefined &&
        !seen.has(dreamwalkerTarget)
      ) {
        nextRound.add(dreamwalkerTarget);
      }

      if (cupidLovers && gameMode !== 'dual') {
        const [firstLover, secondLover] = cupidLovers;
        const linkedPlayer = player === firstLover
          ? secondLover
          : player === secondLover
          ? firstLover
          : undefined;
        if (
          linkedPlayer !== undefined &&
          !seen.has(linkedPlayer) &&
          (
            timing === 'day' ||
            !isNightSkillImmune(
              linkedPlayer,
              actions,
              roleMembersMap,
              playerCardMap,
              upperDeadPlayers,
              prevDreamwalkerTarget,
              gameMode,
            )
          )
        ) {
          nextRound.add(linkedPlayer);
        }
      }
    }

    currentRound = [...nextRound].filter(player => !seen.has(player));
  }

  return rounds;
}

export function getDeathSkillTriggers(
  rounds: number[][],
  timing: DeathTiming,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  gameMode: GameMode = 'single',
): DeathSkillTrigger[] {
  const poisonTarget = timing === 'night'
    ? applyMagicSwapTarget(
        actions.find(action => action.roleId === 'witch')?.poisonTarget,
        getMagicSwap(actions),
      )
    : undefined;
  const triggers: DeathSkillTrigger[] = [];

  for (const player of rounds.flat()) {
    const roleId = getActiveRoleAtPhaseStart(
      player,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
    );
    if ((roleId === 'hunter' || roleId === 'wolf_king') && player !== poisonTarget) {
      triggers.push({ player, roleId });
    }
  }
  return triggers;
}

export function getNightDeathAbilityStatus(
  player: number,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  prevDreamwalkerTarget?: number,
  cupidLovers?: [number, number] | null,
  gameMode?: GameMode,
): NightDeathAbilityStatus {
  const deaths = computeNightDeaths(
    actions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    prevDreamwalkerTarget,
    cupidLovers,
    gameMode,
  );
  const poisonTarget = actions.find(action => action.roleId === 'witch')?.poisonTarget;
  const effectivePoisonTarget = applyMagicSwapTarget(poisonTarget, getMagicSwap(actions));
  const isPoisonDeath = deaths.includes(player) && effectivePoisonTarget === player;
  return isPoisonDeath ? 'poisoned' : 'can_trigger';
}

export function resolveDreamwalkerCarryDeaths(
  initialDeaths: number[],
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  pendingUpperDeaths: number[] = [],
): number[] {
  const deaths = new Set(initialDeaths);
  const dreamwalkerTarget = getEffectiveDreamwalkerTarget(actions);
  if (dreamwalkerTarget === undefined) return [...deaths];

  const isActiveDreamwalker = (player: number) => {
    const cards = playerCardMap[player];
    if (cards) {
      const upperIsDead = upperDeadPlayers.includes(player) || pendingUpperDeaths.includes(player);
      return (upperIsDead ? cards.lower : cards.upper) === 'dreamwalker';
    }
    return (roleMembersMap['dreamwalker'] ?? []).includes(player);
  };

  if ([...deaths].some(isActiveDreamwalker)) deaths.add(dreamwalkerTarget);
  return [...deaths];
}

export function computeNightDeaths(
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  prevDreamwalkerTarget?: number,
  cupidLovers?: [number, number] | null,
  gameMode?: 'single' | 'dual',
  includeAutomaticEffects = true,
): number[] {
  let wolfKill: number | undefined;
  let guardProtect: number | undefined;
  let dreamwalkerProtect: number | undefined;
  let witchSave: number | undefined;
  let witchPoison: number | undefined;

  for (const a of actions) {
    if ((a.roleId === 'werewolf' || a.roleId === 'wolf_king') && a.killTarget !== undefined) wolfKill = a.killTarget;
    if (a.roleId === 'guard') guardProtect = a.protectTarget;
    if (a.roleId === 'dreamwalker') dreamwalkerProtect = a.dreamwalkerTarget;
    if (a.roleId === 'witch') { witchSave = a.saveTarget; witchPoison = a.poisonTarget; }
  }

  // 魔術師互換：重新導向所有夜晚技能目標（技能並非真的交換身分，而是物理位置互換）
  const magicSwap = getMagicSwap(actions);
  wolfKill      = applyMagicSwapTarget(wolfKill, magicSwap);
  guardProtect  = applyMagicSwapTarget(guardProtect, magicSwap);
  dreamwalkerProtect = applyMagicSwapTarget(dreamwalkerProtect, magicSwap);
  witchSave     = applyMagicSwapTarget(witchSave, magicSwap);
  witchPoison   = applyMagicSwapTarget(witchPoison, magicSwap);

  // 科學怪人：免疫夜間所有傷害
  const frankensteinMembers = new Set(roleMembersMap['frankenstein'] ?? []);

  // 攝夢人連續守護同一人 → 保護失效且目標死亡
  const consecutiveDreamwalk =
    prevDreamwalkerTarget !== undefined &&
    dreamwalkerProtect !== undefined &&
    dreamwalkerProtect === prevDreamwalkerTarget;

  // 攝夢人保護（非連續）或科學怪人本體 → 免疫一切
  const isShielded = (p: number) => {
    if (p === dreamwalkerProtect && !consecutiveDreamwalk) return true;
    if (frankensteinMembers.has(p)) return true;
    return false;
  };

  const wolfTeamIds = new Set(ROLES.filter(r => r.team === 'wolf').map(r => r.id));
  // wild_child 有夜間識別步驟但不是神職，排除在石像鬼偷中判定之外
  const villageNightIds = new Set(ROLES.filter(r => r.team === 'village' && r.hasNightAction && r.id !== 'wild_child').map(r => r.id));

  const getPlayerRoleIds = (player: number): string[] => {
    const ids: string[] = [];
    for (const [rid, members] of Object.entries(roleMembersMap)) {
      if ((members ?? []).includes(player)) ids.push(rid);
    }
    return ids;
  };

  // 從 playerCardMap 取得玩家當前活躍的角色（上牌存活→上牌，上牌死→下牌）
  const getActiveCardRoleId = (p: number): string | undefined => {
    const cards = playerCardMap[p];
    if (!cards) return undefined;
    return upperDeadPlayers.includes(p) ? cards.lower : cards.upper;
  };
  const isActiveDreamwalker = (p: number) => {
    const activeRole = getActiveCardRoleId(p);
    if (activeRole !== undefined) return activeRole === 'dreamwalker';
    return (roleMembersMap['dreamwalker'] ?? []).includes(p);
  };

  // 優先以 active card 判斷；playerCardMap 有記錄時不 fallback roleMembersMap
  const isWolfTeam = (p: number) => {
    const cards = playerCardMap[p];
    if (cards) {
      const activeRole = getActiveCardRoleId(p);
      return activeRole !== undefined && wolfTeamIds.has(activeRole);
    }
    return getPlayerRoleIds(p).some(rid => wolfTeamIds.has(rid));
  };
  const isVillageNightRole = (p: number) => {
    const cards = playerCardMap[p];
    if (cards) {
      const activeRole = getActiveCardRoleId(p);
      return activeRole !== undefined && villageNightIds.has(activeRole);
    }
    return getPlayerRoleIds(p).some(rid => villageNightIds.has(rid));
  };

  const deaths = new Set<number>();

  // 狼刀：守衛或解藥擋住則存活；守衛＋解藥同時作用 → 解藥視為毒藥，目標死亡
  if (wolfKill !== undefined) {
    const byGuard = wolfKill === guardProtect;
    const bySave  = wolfKill === witchSave;
    if (byGuard && bySave) {
      if (!isShielded(wolfKill)) deaths.add(wolfKill);
    } else if (!byGuard && !bySave) {
      if (!isShielded(wolfKill)) deaths.add(wolfKill);
    }
  }

  // 女巫毒藥（獵魔人免疫毒藥）
  const isActiveWitchHunter = (p: number) => {
    const activeRole = getActiveCardRoleId(p);
    if (activeRole !== undefined) return activeRole === 'witch_hunter';
    return (roleMembersMap['witch_hunter'] ?? []).includes(p);
  };
  if (witchPoison !== undefined && !isShielded(witchPoison) && !isActiveWitchHunter(witchPoison)) deaths.add(witchPoison);

  for (const a of actions) {
    // 石像鬼：偷中神職則神職死亡
    if (a.roleId === 'gargoyle' && a.gargoyleTarget !== undefined) {
      const t = applyMagicSwapTarget(a.gargoyleTarget, magicSwap)!;
      if (isVillageNightRole(t) && !isShielded(t)) deaths.add(t);
    }

    // 獵魔人：目標是狼人 → 目標死；目標不是狼人 → 獵魔人自己死
    if (a.roleId === 'witch_hunter' && a.witchHunterTarget !== undefined) {
      const t = applyMagicSwapTarget(a.witchHunterTarget, magicSwap)!;
      if (isWolfTeam(t)) {
        if (!isShielded(t)) deaths.add(t);
      } else {
        for (const wh of a.members) { if (!isShielded(wh)) deaths.add(wh); }
      }
    }

    // 阿努比斯：天秤一端狼一端好人 → 好人死（野孩子視為狼，依 active card 判斷）
    if (a.roleId === 'anubis' && (a.anubisTargets?.length ?? 0) === 2) {
      const isWolfTeamForAnubis = (p: number) => {
        const activeRole = getActiveCardRoleId(p);
        if (activeRole !== undefined) return wolfTeamIds.has(activeRole) || activeRole === 'wild_child';
        return getPlayerRoleIds(p).some(rid => wolfTeamIds.has(rid) || rid === 'wild_child');
      };
      const [t1, t2] = applyMagicSwapTargets(a.anubisTargets, magicSwap)!;
      const w1 = isWolfTeamForAnubis(t1), w2 = isWolfTeamForAnubis(t2);
      if (w1 && !w2 && !isShielded(t2)) deaths.add(t2);
      else if (!w1 && w2 && !isShielded(t1)) deaths.add(t1);
    }

    // 天狗雙刀視為狼刀：守衛可擋兩刀；女巫只可救第一刀。
    if (a.roleId === 'tengu' && a.tenguKillTargets) {
      const targets = applyMagicSwapTargets(a.tenguKillTargets, magicSwap) ?? [];
      targets.forEach((target, index) => {
        const byGuard = target === guardProtect;
        const bySave = index === 0 && target === witchSave;
        if (byGuard && bySave) {
          if (!isShielded(target)) deaths.add(target);
        } else if (!byGuard && !bySave) {
          if (!isShielded(target)) deaths.add(target);
        }
      });
    }

    // 白狼王自爆：白狼王本人＋目標皆死
  }

  // 攝夢人連續守護同一人 → 連續保護對象死亡（保護失效）
  if (consecutiveDreamwalk && dreamwalkerProtect !== undefined) {
    deaths.add(dreamwalkerProtect);
  }

  // 神射手：宣告發動且本晚確定死亡時，擊殺目標
  for (const a of actions) {
    if (a.roleId === 'sharpshooter' && a.sharpshooterDeclared && a.sharpshooterTarget !== undefined) {
      const swappedSharpshooterTarget = applyMagicSwapTarget(a.sharpshooterTarget, magicSwap)!;
      if (a.members.some(m => deaths.has(m)) && !isShielded(swappedSharpshooterTarget)) {
        deaths.add(swappedSharpshooterTarget);
      }
    }
  }

  if (includeAutomaticEffects) {
    // 死亡連帶效果需反覆結算：戀人死亡可能帶死攝夢人，攝夢人再帶走本晚實際守護目標。
    let deathEffectsChanged = true;
    while (deathEffectsChanged) {
      const previousSize = deaths.size;

      // 攝夢人本身死亡 → 本晚實際保護對象一起死亡；此效果不受攝夢保護阻擋。
      if ([...deaths].some(isActiveDreamwalker) && dreamwalkerProtect !== undefined) {
        deaths.add(dreamwalkerProtect);
      }

      // 丘比特戀人：單身分模式下一方死亡→另一方同死
      if (cupidLovers && gameMode !== 'dual') {
        const [la, lb] = cupidLovers;
        if (deaths.has(la) && !isShielded(lb)) deaths.add(lb);
        if (deaths.has(lb) && !isShielded(la)) deaths.add(la);
      }

      deathEffectsChanged = deaths.size !== previousSize;
    }
  }

  return [...deaths];
}

export function computeBearTamerResult(
  bearTamerMembers: number[],
  roleMembersMap: Record<string, number[]>,
  playerCardMap: Record<number, { upper?: string; lower?: string }>,
  upperDeadPlayers: number[],
  deadPlayers: number[],
  totalPlayers: number,
  magicSwap?: [number, number],
): 'growl' | 'silent' {
  if (!bearTamerMembers.length || totalPlayers < 2) return 'silent';
  const wolfTeamIds = new Set(ROLES.filter(r => r.team === 'wolf').map(r => r.id));
  const isAlive = (p: number) => !deadPlayers.includes(p);
  const checkIsWolf = (p: number): boolean => {
    const cards = playerCardMap[p];
    if (cards) {
      const activeRole = upperDeadPlayers.includes(p) ? cards.lower : cards.upper;
      return activeRole !== undefined && (wolfTeamIds.has(activeRole) || activeRole === 'wild_child');
    }
    for (const [rid, ms] of Object.entries(roleMembersMap)) {
      if ((ms ?? []).includes(p) && (wolfTeamIds.has(rid) || rid === 'wild_child')) return true;
    }
    return false;
  };
  const findNeighbors = (tamer: number): [number | null, number | null] => {
    const idx = tamer - 1;
    let left: number | null = null;
    let right: number | null = null;
    for (let i = 1; i < totalPlayers; i++) {
      const c = ((idx - i) % totalPlayers + totalPlayers) % totalPlayers + 1;
      if (isAlive(c) && c !== tamer) { left = c; break; }
    }
    for (let i = 1; i < totalPlayers; i++) {
      const c = (idx + i) % totalPlayers + 1;
      if (isAlive(c) && c !== tamer) { right = c; break; }
    }
    return [left, right];
  };
  for (const tamer of bearTamerMembers) {
    const effectiveTamer = applyMagicSwapTarget(tamer, magicSwap)!;
    const [left, right] = findNeighbors(effectiveTamer);
    const effectiveLeft = left === null ? null : applyMagicSwapTarget(left, magicSwap)!;
    const effectiveRight = right === null ? null : applyMagicSwapTarget(right, magicSwap)!;
    if ((effectiveLeft !== null && checkIsWolf(effectiveLeft)) || (effectiveRight !== null && checkIsWolf(effectiveRight))) return 'growl';
  }
  return 'silent';
}

function buildNightSummary(
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  prevDreamwalkerTarget?: number,
  cupidLovers?: [number, number] | null,
  gameMode?: 'single' | 'dual',
): string[] {
  const lines: string[] = [];
  let wolfKill: number | undefined;
  let guardProtect: number | undefined;
  let dreamwalkerProtect: number | undefined;
  let witchSave: number | undefined;
  let witchPoison: number | undefined;

  for (const a of actions) {
    if ((a.roleId === 'werewolf' || a.roleId === 'wolf_king') && a.killTarget !== undefined) wolfKill = a.killTarget;
    if (a.roleId === 'guard') guardProtect = a.protectTarget;
    if (a.roleId === 'dreamwalker') dreamwalkerProtect = a.dreamwalkerTarget;
    if (a.roleId === 'witch') { witchSave = a.saveTarget; witchPoison = a.poisonTarget; }
  }
  const magicSwap = getMagicSwap(actions);
  wolfKill = applyMagicSwapTarget(wolfKill, magicSwap);
  guardProtect = applyMagicSwapTarget(guardProtect, magicSwap);
  dreamwalkerProtect = applyMagicSwapTarget(dreamwalkerProtect, magicSwap);
  witchSave = applyMagicSwapTarget(witchSave, magicSwap);
  witchPoison = applyMagicSwapTarget(witchPoison, magicSwap);

  for (const a of actions) {
    const role = ROLES.find(r => r.id === a.roleId);
    if (!role) continue;
    const who = a.members.length ? `（${a.members.join('、')}號）` : '';
    switch (a.roleId) {
      case 'werewolf':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.killTarget ? `攻擊 ${fmt(a.killTarget)}` : '未達成攻擊'}`);
        break;
      case 'guard':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.protectTarget ? `守護 ${fmt(a.protectTarget)}` : '未守護'}`);
        break;
      case 'dreamwalker':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.dreamwalkerTarget ? `保護 ${fmt(a.dreamwalkerTarget)}` : '未保護'}`);
        break;
      case 'seer':
        if (a.checkTarget) {
          const res = a.checkResult === 'wolf' ? '狼人陣營 🐺' : '好人陣營 ✅';
          lines.push(`${role.emoji} ${role.name}${who} → 查驗 ${fmt(a.checkTarget)}：${res}`);
        }
        break;
      case 'witch':
        if (a.saveTarget) lines.push(`${role.emoji} ${role.name}${who} → 解藥救 ${fmt(a.saveTarget)}`);
        if (a.poisonTarget) lines.push(`${role.emoji} ${role.name}${who} → 毒藥毒 ${fmt(a.poisonTarget)}`);
        if (!a.saveTarget && !a.poisonTarget) lines.push(`${role.emoji} ${role.name}${who} → 未使用藥水`);
        break;
      case 'cupid':
        if (a.linkTargets?.length === 2)
          lines.push(`${role.emoji} ${role.name}${who} → 連結 ${fmt(a.linkTargets[0])} 和 ${fmt(a.linkTargets[1])} 為戀人`);
        break;
      case 'crow':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.surroundTarget ? `環繞 ${fmt(a.surroundTarget)}（次日不可被投票）` : '未環繞'}`);
        break;
      case 'blood_moon':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.bloodMoonActivated ? '發動技能（本晚公布平安夜，延後死亡）' : '未發動'}`);
        break;
      case 'white_wolf':
        lines.push(`${role.emoji} ${role.name}${who} → 夜晚不能自爆`);
        break;
      case 'tengu':
        if (a.tenguKillTargets?.length)
          lines.push(`${role.emoji} ${role.name}${who} → 擊殺 ${a.tenguKillTargets.map(fmt).join('、')}`);
        else
          lines.push(`${role.emoji} ${role.name}${who} → 未擊殺`);
        break;
      case 'gargoyle':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.gargoyleTarget ? `偷襲 ${fmt(a.gargoyleTarget)}` : '未偷襲'}`);
        break;
      case 'anubis':
        if (a.anubisTargets?.length === 2)
          lines.push(`${role.emoji} ${role.name}${who} → 天秤：${fmt(a.anubisTargets[0])} vs ${fmt(a.anubisTargets[1])}`);
        else
          lines.push(`${role.emoji} ${role.name}${who} → 未放天秤`);
        break;
      case 'witch_hunter':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.witchHunterTarget ? `狩獵 ${fmt(a.witchHunterTarget)}` : '未狩獵'}`);
        break;
      case 'magician':
        if (a.magicianSwap)
          lines.push(`${role.emoji} ${role.name}${who} → 互換 ${fmt(a.magicianSwap[0])} ↔ ${fmt(a.magicianSwap[1])}`);
        else
          lines.push(`${role.emoji} ${role.name}${who} → 未互換`);
        break;
      case 'thief':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.thiefRole ? `選擇：${ROLES.find(r => r.id === a.thiefRole)?.name ?? a.thiefRole}` : '未選牌'}`);
        break;
      case 'sharpshooter':
        if (a.sharpshooterDeclared && a.sharpshooterTarget !== undefined)
          lines.push(`${role.emoji} ${role.name}${who} → 宣告發動技能，觸發並擊殺 ${fmt(a.sharpshooterTarget)}`);
        else
          lines.push(`${role.emoji} ${role.name}${who} → ${a.sharpshooterDeclared ? '宣告發動技能（未觸發）' : '未宣告'}`);
        break;
      case 'bear_tamer':
        lines.push(`${role.emoji} ${role.name}${who} → 熊${a.bearTamerResult === 'growl' ? '叫了 🐻' : '沒有叫'}`);
        break;
      default:
        lines.push(`${role.emoji} ${role.name}${who} → 無行動`);
    }
  }

  const guardBySave  = wolfKill !== undefined && wolfKill === guardProtect && wolfKill === witchSave;
  const killBlocked  = wolfKill !== undefined && !guardBySave && (wolfKill === guardProtect || wolfKill === witchSave);
  const poisonedByGuardSave = guardBySave;

  lines.push('');
  if (dreamwalkerProtect !== undefined) lines.push(`💤 ${fmt(dreamwalkerProtect)} 受攝夢人保護，免疫本晚所有傷害`);
  if (killBlocked) lines.push(`（${fmt(wolfKill!)} 受到保護，免於死亡）`);
  if (poisonedByGuardSave) lines.push(`（${fmt(wolfKill!)} 守衛＋解藥同時作用，解藥視為毒藥，仍死亡）`);

  // 完整死亡列表（使用 computeNightDeaths 確保石像鬼、天狗等全部算入）
  const allDeaths = computeNightDeaths(actions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, cupidLovers, gameMode);
  const bloodMoonOn = actions.some(a => a.roleId === 'blood_moon' && a.bloodMoonActivated);
  const summaryDeaths = bloodMoonOn ? [] : allDeaths;

  lines.push(summaryDeaths.length === 0 ? '✨ 本晚平安，無人死亡' : `💀 本晚死亡：${summaryDeaths.map(fmt).join('、')}`);
  return lines;
}
