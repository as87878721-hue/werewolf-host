import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ROLES } from '../data/roles';
import { gamePersistStorage } from './persistStorage';

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
  spiritWolfMimicTarget?: number;
  spiritWolfMimicRole?: string;
  spiritWolfKillTarget?: number;
  spiritWolfCheckTarget?: number;
  spiritWolfCheckRole?: string;
  spiritWolfSaveTarget?: number;
  spiritWolfPoisonTarget?: number;
  shamanTarget?: number;
  shamanMode?: 'knife' | 'shield' | 'none';
  slaveTarget?: number;
  fireWolfTarget?: number;
  fireWolfKillTarget?: number;
  blindSwordsmanMode?: 'monk_vote' | 'kill';
  blindSwordsmanTarget?: number;
  explorerResult?: number | 'unknown';
  mummySealedRole?: string;
  monkVoteTarget?: number;
  invalidatedByFireWolf?: boolean;
  invalidatedPlayers?: number[];
}

export interface NightRecord {
  nightNumber: number;
  actions: NightAction[];
  summary: string[];
}

type RoleCardSlot = 'upper' | 'lower';
type PlayerRoleCard = { player: number; slot: RoleCardSlot };

export interface FireWolfBurnRecord {
  player: number;
  slot: 'single' | RoleCardSlot;
  originalRoleId: string;
  night: number;
  step: number;
}

export interface GoldenBabyConfig {
  min: number;
  max: number;
}

export type SingleWinRule = 'edge' | 'city';
export type SheriffExplosionRule = 'none' | 'single' | 'double';

export function shouldShowSheriffStepForState(
  currentNight: number,
  sheriffDiedLastNight: boolean,
  sheriffPlayer: number | null,
  rule: SheriffExplosionRule,
  explosionCount: number,
  badgeDestroyed: boolean,
): boolean {
  return currentNight === 1 || sheriffDiedLastNight || (
    rule === 'double' &&
    explosionCount === 1 &&
    sheriffPlayer === null &&
    !badgeDestroyed
  );
}

export interface WinResult {
  winner: 'wolf' | 'village';
  reason: string;
}

export interface GameLogEntry {
  id: number;
  night: number;
  phase: string;
  text: string;
}

export type DeathCauseMap = Record<number, string>;

export interface DeathRecord {
  night: number;
  timing: 'night' | 'day';
  player: number;
  cause: string;
}

export interface GameConfigSnapshot {
  name: string;
  mode: GameMode;
  playerCount: number;
  selectedRoles: RoleEntry[];
  goldenBabyConfig: GoldenBabyConfig;
  singleWinRule: SingleWinRule;
  sheriffExplosionRule?: SheriffExplosionRule;
}

// 預設 9 人標準局
const DEFAULT_ROLES: RoleEntry[] = [
  { roleId: 'werewolf', count: 3 },
  { roleId: 'seer',     count: 1 },
  { roleId: 'witch',    count: 1 },
  { roleId: 'hunter',   count: 1 },
  { roleId: 'villager', count: 3 },
];

const VILLAGER_LIKE_IDS = new Set(['villager', 'wild_child']);
const EXTRA_OPTION_IDS = new Set(['golden_baby']);

function roleTeam(roleId: string | undefined): 'wolf' | 'village' | undefined {
  if (!roleId || EXTRA_OPTION_IDS.has(roleId)) return undefined;
  const team = ROLES.find(r => r.id === roleId)?.team;
  return team === 'wolf' || team === 'village' ? team : undefined;
}

function isGodRoleId(roleId: string | undefined): boolean {
  if (!roleId || VILLAGER_LIKE_IDS.has(roleId) || EXTRA_OPTION_IDS.has(roleId)) return false;
  const role = ROLES.find(r => r.id === roleId);
  return role?.team === 'village';
}

function isVillagerLikeRoleId(roleId: string | undefined): boolean {
  return roleId !== undefined && VILLAGER_LIKE_IDS.has(roleId);
}

function findSingleRoleForPlayer(player: number, roleMembersMap: Record<string, number[]>): string | undefined {
  return Object.entries(roleMembersMap).find(([, members]) => (members ?? []).includes(player))?.[0];
}

export function getFireWolfEffectiveRole(
  player: number,
  originalRoleId: string | undefined,
  gameMode: GameMode,
  upperDeadPlayers: number[] = [],
  burnRecords: FireWolfBurnRecord[] = [],
): string | undefined {
  if (!originalRoleId) return undefined;
  const activeSlot = gameMode === 'single'
    ? 'single'
    : upperDeadPlayers.includes(player) ? 'lower' : 'upper';
  return burnRecords.some(record => record.player === player && record.slot === activeSlot)
    ? 'villager'
    : originalRoleId;
}

const uniqueNums = (players: number[]) => [...new Set(players)];
export const GAME_PERSISTENCE_VERSION = 1;
export const MAX_GAME_LOG_ENTRIES = 500;

function membersForRoleIds(roleIds: string[], roleMembersMap: Record<string, number[]>): number[] {
  return uniqueNums(roleIds.flatMap(roleId => roleMembersMap[roleId] ?? []));
}

export function computeWinResult({
  gameMode,
  singleWinRule,
  selectedRoles,
  roleMembersMap,
  deadPlayers,
  upperDeadPlayers,
  playerCardMap,
  goldenBabyPlayers,
  fireWolfBurnedPlayers = [],
  resolutionPhase = 'day',
}: {
  gameMode: GameMode;
  singleWinRule: SingleWinRule;
  selectedRoles: RoleEntry[];
  roleMembersMap: Record<string, number[]>;
  deadPlayers: number[];
  upperDeadPlayers: number[];
  playerCardMap: Record<number, { upper?: string; lower?: string }>;
  goldenBabyPlayers: number[];
  fireWolfBurnedPlayers?: number[];
  resolutionPhase?: 'night' | 'day';
}): WinResult | null {
  const selectedRoleIds = new Set(selectedRoles.filter(r => r.count > 0).map(r => r.roleId));

  if (gameMode === 'dual') {
    const wolfCards = Object.entries(playerCardMap).flatMap(([playerStr, cards]) => {
      const player = Number(playerStr);
      return ([
        cards.upper && roleTeam(cards.upper) === 'wolf' ? { player, slot: 'upper' as const } : null,
        cards.lower && roleTeam(cards.lower) === 'wolf' ? { player, slot: 'lower' as const } : null,
      ]).filter((card): card is { player: number; slot: 'upper' | 'lower' } => Boolean(card));
    });
    const expectedWolfCardCount = selectedRoles
    .filter(role => roleTeam(role.roleId) === 'wolf')
    .reduce((sum, role) => sum + role.count, 0);

    const allWolfCardsRevealed =
    wolfCards.length > 0 &&
    (expectedWolfCardCount === 0 || wolfCards.length === expectedWolfCardCount) &&
    wolfCards.every(card =>
      card.slot === 'upper'
        ? upperDeadPlayers.includes(card.player) || deadPlayers.includes(card.player)
        : deadPlayers.includes(card.player)
    );

    const allGoldenBabiesDead = goldenBabyPlayers.length > 0 && goldenBabyPlayers.every(p => deadPlayers.includes(p));
    if (allWolfCardsRevealed && allGoldenBabiesDead) {
      return resolutionPhase === 'night'
        ? { winner: 'wolf', reason: '夜晚同時達成：所有金寶寶死亡，狼人勝利' }
        : { winner: 'village', reason: '白天同時達成：所有狼人角色牌翻出，好人勝利' };
    }
    if (allWolfCardsRevealed) {
      return { winner: 'village', reason: '所有狼人角色牌都已翻出' };
    }

    if (allGoldenBabiesDead) {
      return { winner: 'wolf', reason: '所有金寶寶都已上下牌死亡' };
    }

    return null;
  }

  const selectedRoleDefs = ROLES.filter(role => selectedRoleIds.has(role.id));
  const wolfRoleIds = selectedRoleDefs.filter(role => role.team === 'wolf').map(role => role.id);
  const expectedWolfCount = selectedRoles
    .filter(role => wolfRoleIds.includes(role.roleId))
    .reduce((sum, role) => sum + role.count, 0);
  const godRoleIds = selectedRoleDefs
    .filter(role => role.team === 'village' && !VILLAGER_LIKE_IDS.has(role.id) && !EXTRA_OPTION_IDS.has(role.id))
    .map(role => role.id);
  const villagerRoleIds = selectedRoleDefs
    .filter(role => VILLAGER_LIKE_IDS.has(role.id))
    .map(role => role.id);

  const burnedSet = new Set(fireWolfBurnedPlayers);
  const wolfPlayers = membersForRoleIds(wolfRoleIds, roleMembersMap);
  const godPlayers = membersForRoleIds(godRoleIds, roleMembersMap).filter(p => !burnedSet.has(p));
  const villagerPlayers = uniqueNums([
    ...membersForRoleIds(villagerRoleIds, roleMembersMap),
    ...fireWolfBurnedPlayers,
  ]);
  const goodPlayers = uniqueNums([...godPlayers, ...villagerPlayers]);
  const allDead = (players: number[]) => players.length > 0 && players.every(p => deadPlayers.includes(p));

  if (expectedWolfCount > 0 && wolfPlayers.length >= expectedWolfCount && allDead(wolfPlayers)) {
    return { winner: 'village', reason: '所有狼人陣營玩家死亡' };
  }

  if (singleWinRule === 'city') {
    if (allDead(goodPlayers)) return { winner: 'wolf', reason: '所有好人陣營玩家死亡' };
  } else {
    if (allDead(godPlayers)) return { winner: 'wolf', reason: '所有神職玩家死亡' };
    if (allDead(villagerPlayers)) return { winner: 'wolf', reason: '所有平民玩家死亡' };
  }

  return null;
}

export function projectDeathState(
  gameMode: GameMode,
  deadPlayers: number[],
  upperDeadPlayers: number[],
  deaths: number[],
): { deadPlayers: number[]; upperDeadPlayers: number[] } {
  if (gameMode !== 'dual') {
    return {
      deadPlayers: [...new Set([...deadPlayers, ...deaths])],
      upperDeadPlayers,
    };
  }

  const nextUpper = [...upperDeadPlayers];
  const nextFull = [...deadPlayers];
  for (const p of deaths) {
    if (nextFull.includes(p)) continue;
    if (nextUpper.includes(p)) {
      nextFull.push(p);
      const idx = nextUpper.indexOf(p);
      if (idx !== -1) nextUpper.splice(idx, 1);
    } else {
      nextUpper.push(p);
    }
  }

  return {
    deadPlayers: [...new Set(nextFull)],
    upperDeadPlayers: [...new Set(nextUpper)],
  };
}

export function getTenguKillAllowance({
  gameMode,
  selectedRoles,
  roleMembersMap,
  playerCardMap,
  upperDeadPlayers,
  deadPlayers,
  actingTenguPlayers,
}: {
  gameMode: GameMode;
  selectedRoles: RoleEntry[];
  roleMembersMap: Record<string, number[]>;
  playerCardMap: Record<number, { upper?: string; lower?: string }>;
  upperDeadPlayers: number[];
  deadPlayers: number[];
  actingTenguPlayers: number[];
}): number {
  const wolfRoleIds = new Set(ROLES.filter(role => role.team === 'wolf').map(role => role.id));
  const configuredWolfCards = selectedRoles
    .filter(entry => wolfRoleIds.has(entry.roleId))
    .reduce((sum, entry) => sum + entry.count, 0);
  const excludedTenguCards = Math.min(
    actingTenguPlayers.length,
    selectedRoles.find(entry => entry.roleId === 'tengu')?.count ?? 0,
  );
  const requiredDeadWolfCards = Math.max(0, configuredWolfCards - excludedTenguCards);

  if (gameMode === 'single') {
    const deadWolfPlayers = new Set<number>();
    for (const [roleId, members] of Object.entries(roleMembersMap)) {
      if (!wolfRoleIds.has(roleId)) continue;
      for (const player of members ?? []) {
        if (roleId === 'tengu' && actingTenguPlayers.includes(player)) continue;
        if (deadPlayers.includes(player)) deadWolfPlayers.add(player);
      }
    }
    return deadWolfPlayers.size >= requiredDeadWolfCards ? 1 : 0;
  }

  let deadWolfCards = 0;
  for (const [playerText, cards] of Object.entries(playerCardMap)) {
    const player = Number(playerText);
    for (const slot of ['upper', 'lower'] as const) {
      const roleId = cards[slot];
      if (!roleId || !wolfRoleIds.has(roleId)) continue;
      const isActingTenguCard =
        roleId === 'tengu' &&
        actingTenguPlayers.includes(player) &&
        (slot === 'upper' ? !upperDeadPlayers.includes(player) : upperDeadPlayers.includes(player));
      if (isActingTenguCard) continue;
      const cardIsDead = slot === 'upper'
        ? upperDeadPlayers.includes(player) || deadPlayers.includes(player)
        : deadPlayers.includes(player);
      if (cardIsDead) deadWolfCards += 1;
    }
  }
  return deadWolfCards >= requiredDeadWolfCards ? 1 : 0;
}

export type GameMode = 'single' | 'dual';

export const DEFAULT_SINGLE_CONFIG: GameConfigSnapshot = {
  name: '單身分預設',
  mode: 'single',
  playerCount: 9,
  selectedRoles: [...DEFAULT_ROLES],
  goldenBabyConfig: { min: 0, max: 0 },
  singleWinRule: 'edge',
  sheriffExplosionRule: 'none',
};

export const DEFAULT_DUAL_CONFIG: GameConfigSnapshot = {
  name: '雙身分 9 人預設',
  mode: 'dual',
  playerCount: 9,
  selectedRoles: [
    { roleId: 'villager', count: 5 },
    { roleId: 'wild_child', count: 1 },
    { roleId: 'seer', count: 1 },
    { roleId: 'witch', count: 1 },
    { roleId: 'guard', count: 1 },
    { roleId: 'hunter', count: 1 },
    { roleId: 'werewolf', count: 2 },
    { roleId: 'white_wolf', count: 1 },
    { roleId: 'dreamwalker', count: 1 },
    { roleId: 'gravedigger', count: 1 },
    { roleId: 'bear_tamer', count: 1 },
    { roleId: 'witch_hunter', count: 1 },
    { roleId: 'old_rogue', count: 1 },
  ],
  goldenBabyConfig: { min: 2, max: 2 },
  singleWinRule: 'edge',
  sheriffExplosionRule: 'none',
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
  sheriffExplosionCount: number;
  sheriffBadgeDestroyed: boolean;
  lostVotePlayers: number[];
  idiotFlippedPlayers: number[];
  anubisScaledPlayers: number[];
  anubisScaledCards: PlayerRoleCard[];
  cupidLovers: [number, number] | null;
  bishopHolder: number | null;
  knightUsed: boolean;
  lastDayExileInfo: { player: number; upperWasAlive: boolean } | null;
  lastDayExiledRoleId: string | null;
  slaveTraderSlaves: number[];
  fireWolfBurnedPlayers: number[];
  fireWolfBurnedCards: Array<{ player: number; slot: 'upper' | 'lower' }>;
  fireWolfBurnRecords: FireWolfBurnRecord[];
  fireWolfUsed: boolean;
  spiritWolfMimic: { target: number; roleId: string; availableNight: number } | null;
  spiritWolfSaveUsed: boolean;
  spiritWolfPoisonUsed: boolean;
  mummySealedRoles: string[];
  monkVoteTarget: number | null;
  monkVoteCard: { player: number; slot: 'upper' | 'lower' } | null;
  goldenBabyConfig: GoldenBabyConfig;
  goldenBabyPlayers: number[];
  singleWinRule: SingleWinRule;
  sheriffExplosionRule: SheriffExplosionRule;
  winResult: WinResult | null;
  gameLog: GameLogEntry[];
  deathRecords: DeathRecord[];
  nightStepSnapshots: Record<number, GameUndoSnapshot>;
  dayStepSnapshots: Record<number, GameUndoSnapshot>;
  dayCommitSnapshot: PhaseTransitionSnapshot | null;
  dayCommitRestoreVersion: number;
  configName: string;
  lastConfigs: Partial<Record<GameMode, GameConfigSnapshot>>;
  savedConfigs: Partial<Record<GameMode, GameConfigSnapshot[]>>;

  setPlayerCount: (count: number) => void;
  setGoldenBabyConfig: (config: GoldenBabyConfig) => void;
  setGoldenBabyPlayers: (players: number[]) => void;
  setSingleWinRule: (rule: SingleWinRule) => void;
  setSheriffExplosionRule: (rule: SheriffExplosionRule) => void;
  setConfigName: (name: string) => void;
  applyConfig: (config: GameConfigSnapshot) => void;
  saveCurrentConfig: () => void;
  deleteSavedConfig: (mode: GameMode, index: number) => void;
  appendLog: (phase: string, text: string) => void;
  setUpperDead: (players: number[]) => void;
  addRole: (roleId: string) => void;
  removeRole: (roleId: string) => void;
  initNightOrder: () => void;
  moveOrderUp: (index: number) => void;
  moveOrderDown: (index: number) => void;
  reorderNightOrder: (newOrder: string[]) => void;
  recordAction: (action: NightAction) => void;
  captureNightStepSnapshot: (step: number) => void;
  captureDayStepSnapshot: (step: number) => void;
  restoreDayStepSnapshot: (step: number) => void;
  restoreDayCommitSnapshot: () => boolean;
  nextStep: () => void;
  prevStep: () => void;
  rewindNightStep: (step: number) => void;
  setNightStep: (step: number) => void;
  finishNight: () => NightRecord;
  resetNight: () => void;
  resetGameProgress: () => void;
  startNewGame: (mode: GameMode) => void;
  setRoleMembers: (roleId: string, members: number[]) => void;
  setPlayerCardRole: (player: number, slot: 'upper' | 'lower', roleId: string) => void;
  setSheriff: (player: number | null) => void;
  setSheriffExplosionState: (count: number, badgeDestroyed: boolean) => void;
  setBishopHolder: (player: number | null) => void;
  setKnightUsed: (used: boolean) => void;
  setMonkVoteTarget: (player: number | null) => void;
  setMonkVoteCard: (card: { player: number; slot: 'upper' | 'lower' } | null) => void;
  endDay: (opts: {
    exiledPlayer?: number;
    isIdiotFlip?: boolean;
    nightChainDeaths?: number[];
    dayKills?: number[];
    deathCauses?: DeathCauseMap;
  }) => void;
  transformThief: (players: number[], roleId: string) => void;
}

interface GameUndoSnapshot {
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
  sheriffExplosionCount: number;
  sheriffBadgeDestroyed: boolean;
  lostVotePlayers: number[];
  idiotFlippedPlayers: number[];
  anubisScaledPlayers: number[];
  anubisScaledCards: PlayerRoleCard[];
  cupidLovers: [number, number] | null;
  bishopHolder: number | null;
  knightUsed: boolean;
  lastDayExileInfo: { player: number; upperWasAlive: boolean } | null;
  lastDayExiledRoleId: string | null;
  slaveTraderSlaves: number[];
  fireWolfBurnedPlayers: number[];
  fireWolfBurnedCards: Array<{ player: number; slot: 'upper' | 'lower' }>;
  fireWolfBurnRecords: FireWolfBurnRecord[];
  fireWolfUsed: boolean;
  spiritWolfMimic: { target: number; roleId: string; availableNight: number } | null;
  spiritWolfSaveUsed: boolean;
  spiritWolfPoisonUsed: boolean;
  mummySealedRoles: string[];
  monkVoteTarget: number | null;
  monkVoteCard: { player: number; slot: 'upper' | 'lower' } | null;
  goldenBabyPlayers: number[];
  winResult: WinResult | null;
  gameLog: GameLogEntry[];
  deathRecords: DeathRecord[];
}

interface PhaseTransitionSnapshot {
  state: GameUndoSnapshot;
  currentNight: number;
  currentStep: number;
  nightStepSnapshots: Record<number, GameUndoSnapshot>;
  dayStepSnapshots: Record<number, GameUndoSnapshot>;
}

function createGameUndoSnapshot(state: GameState): GameUndoSnapshot {
  const cloneRoleMembersMap = Object.fromEntries(
    Object.entries(state.roleMembersMap).map(([roleId, members]) => [roleId, [...members]]),
  );
  const clonePlayerCardMap = Object.fromEntries(
    Object.entries(state.playerCardMap).map(([player, cards]) => [Number(player), { ...cards }]),
  );
  return {
    nightActions: state.nightActions.map(action => ({ ...action })),
    nightHistory: state.nightHistory.map(record => ({
      ...record,
      actions: record.actions.map(action => ({ ...action })),
      summary: [...record.summary],
    })),
    saveUsed: state.saveUsed,
    poisonUsed: state.poisonUsed,
    sharpshooterUsed: state.sharpshooterUsed,
    checkedPlayers: { ...state.checkedPlayers },
    roleMembersMap: cloneRoleMembersMap,
    deadPlayers: [...state.deadPlayers],
    upperDeadPlayers: [...state.upperDeadPlayers],
    playerCardMap: clonePlayerCardMap,
    sheriffPlayer: state.sheriffPlayer,
    sheriffExplosionCount: state.sheriffExplosionCount,
    sheriffBadgeDestroyed: state.sheriffBadgeDestroyed,
    lostVotePlayers: [...state.lostVotePlayers],
    idiotFlippedPlayers: [...state.idiotFlippedPlayers],
    anubisScaledPlayers: [...state.anubisScaledPlayers],
    anubisScaledCards: state.anubisScaledCards.map(card => ({ ...card })),
    cupidLovers: state.cupidLovers ? [...state.cupidLovers] as [number, number] : null,
    bishopHolder: state.bishopHolder,
    knightUsed: state.knightUsed,
    lastDayExileInfo: state.lastDayExileInfo ? { ...state.lastDayExileInfo } : null,
    lastDayExiledRoleId: state.lastDayExiledRoleId,
    slaveTraderSlaves: [...state.slaveTraderSlaves],
    fireWolfBurnedPlayers: [...state.fireWolfBurnedPlayers],
    fireWolfBurnedCards: state.fireWolfBurnedCards.map(card => ({ ...card })),
    fireWolfBurnRecords: state.fireWolfBurnRecords.map(record => ({ ...record })),
    fireWolfUsed: state.fireWolfUsed,
    spiritWolfMimic: state.spiritWolfMimic ? { ...state.spiritWolfMimic } : null,
    spiritWolfSaveUsed: state.spiritWolfSaveUsed,
    spiritWolfPoisonUsed: state.spiritWolfPoisonUsed,
    mummySealedRoles: [...state.mummySealedRoles],
    monkVoteTarget: state.monkVoteTarget,
    monkVoteCard: state.monkVoteCard ? { ...state.monkVoteCard } : null,
    goldenBabyPlayers: [...state.goldenBabyPlayers],
    winResult: state.winResult ? { ...state.winResult } : null,
    gameLog: state.gameLog.map(log => ({ ...log })),
    deathRecords: state.deathRecords.map(record => ({ ...record })),
  };
}

function restoreGameUndoSnapshot(snapshot: GameUndoSnapshot) {
  return {
    nightActions: snapshot.nightActions.map(action => ({ ...action })),
    nightHistory: snapshot.nightHistory.map(record => ({
      ...record,
      actions: record.actions.map(action => ({ ...action })),
      summary: [...record.summary],
    })),
    saveUsed: snapshot.saveUsed,
    poisonUsed: snapshot.poisonUsed,
    sharpshooterUsed: snapshot.sharpshooterUsed,
    checkedPlayers: { ...snapshot.checkedPlayers },
    roleMembersMap: Object.fromEntries(
      Object.entries(snapshot.roleMembersMap).map(([roleId, members]) => [roleId, [...members]]),
    ),
    deadPlayers: [...snapshot.deadPlayers],
    upperDeadPlayers: [...snapshot.upperDeadPlayers],
    playerCardMap: Object.fromEntries(
      Object.entries(snapshot.playerCardMap).map(([player, cards]) => [Number(player), { ...cards }]),
    ),
    sheriffPlayer: snapshot.sheriffPlayer,
    sheriffExplosionCount: snapshot.sheriffExplosionCount,
    sheriffBadgeDestroyed: snapshot.sheriffBadgeDestroyed,
    lostVotePlayers: [...snapshot.lostVotePlayers],
    idiotFlippedPlayers: [...snapshot.idiotFlippedPlayers],
    anubisScaledPlayers: [...snapshot.anubisScaledPlayers],
    anubisScaledCards: snapshot.anubisScaledCards.map(card => ({ ...card })),
    cupidLovers: snapshot.cupidLovers ? [...snapshot.cupidLovers] as [number, number] : null,
    bishopHolder: snapshot.bishopHolder,
    knightUsed: snapshot.knightUsed,
    lastDayExileInfo: snapshot.lastDayExileInfo ? { ...snapshot.lastDayExileInfo } : null,
    lastDayExiledRoleId: snapshot.lastDayExiledRoleId,
    slaveTraderSlaves: [...snapshot.slaveTraderSlaves],
    fireWolfBurnedPlayers: [...snapshot.fireWolfBurnedPlayers],
    fireWolfBurnedCards: snapshot.fireWolfBurnedCards.map(card => ({ ...card })),
    fireWolfBurnRecords: snapshot.fireWolfBurnRecords.map(record => ({ ...record })),
    fireWolfUsed: snapshot.fireWolfUsed,
    spiritWolfMimic: snapshot.spiritWolfMimic ? { ...snapshot.spiritWolfMimic } : null,
    spiritWolfSaveUsed: snapshot.spiritWolfSaveUsed,
    spiritWolfPoisonUsed: snapshot.spiritWolfPoisonUsed,
    mummySealedRoles: [...snapshot.mummySealedRoles],
    monkVoteTarget: snapshot.monkVoteTarget,
    monkVoteCard: snapshot.monkVoteCard ? { ...snapshot.monkVoteCard } : null,
    goldenBabyPlayers: [...snapshot.goldenBabyPlayers],
    winResult: snapshot.winResult ? { ...snapshot.winResult } : null,
    gameLog: snapshot.gameLog.map(log => ({ ...log })),
    deathRecords: snapshot.deathRecords.map(record => ({ ...record })),
  };
}

function cloneUndoSnapshots(snapshots: Record<number, GameUndoSnapshot>) {
  return Object.fromEntries(
    Object.entries(snapshots).map(([step, snapshot]) => [Number(step), {
      ...restoreGameUndoSnapshot(snapshot),
    } as GameUndoSnapshot]),
  );
}

function createPhaseTransitionSnapshot(state: GameState): PhaseTransitionSnapshot {
  return {
    state: createGameUndoSnapshot(state),
    currentNight: state.currentNight,
    currentStep: state.currentStep,
    nightStepSnapshots: cloneUndoSnapshots(state.nightStepSnapshots),
    dayStepSnapshots: cloneUndoSnapshots(state.dayStepSnapshots),
  };
}

function getActiveRoleCardSlot(player: number, upperDeadPlayers: number[]): RoleCardSlot {
  return upperDeadPlayers.includes(player) ? 'lower' : 'upper';
}

function getAnubisScaledCardsForTargets(
  targets: number[],
  gameMode: GameMode,
  upperDeadPlayers: number[],
): PlayerRoleCard[] {
  if (gameMode !== 'dual') return [];
  return targets.map(player => ({
    player,
    slot: getActiveRoleCardSlot(player, upperDeadPlayers),
  }));
}

function mergeRoleCards(cards: PlayerRoleCard[]): PlayerRoleCard[] {
  const seen = new Set<string>();
  const result: PlayerRoleCard[] = [];
  for (const card of cards) {
    const key = `${card.player}:${card.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

export function mergePersistedGameState(persistedState: unknown, currentState: GameState): GameState {
  if (!persistedState || typeof persistedState !== 'object') return currentState;
  return {
    ...currentState,
    ...(persistedState as Partial<GameState>),
  };
}

export const useGameStore = create<GameState>()(persist((set, get) => ({
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
  sheriffExplosionCount: 0,
  sheriffBadgeDestroyed: false,
  lostVotePlayers: [],
  idiotFlippedPlayers: [],
  anubisScaledPlayers: [],
  anubisScaledCards: [],
  cupidLovers: null,
  bishopHolder: null,
  knightUsed: false,
  lastDayExileInfo: null,
  lastDayExiledRoleId: null,
  slaveTraderSlaves: [],
  fireWolfBurnedPlayers: [],
  fireWolfBurnedCards: [],
  fireWolfBurnRecords: [],
  fireWolfUsed: false,
  spiritWolfMimic: null,
  spiritWolfSaveUsed: false,
  spiritWolfPoisonUsed: false,
  mummySealedRoles: [],
  monkVoteTarget: null,
  monkVoteCard: null,
  goldenBabyConfig: { min: 0, max: 0 },
  goldenBabyPlayers: [],
  singleWinRule: DEFAULT_SINGLE_CONFIG.singleWinRule,
  sheriffExplosionRule: DEFAULT_SINGLE_CONFIG.sheriffExplosionRule ?? 'none',
  winResult: null,
  gameLog: [],
  deathRecords: [],
  nightStepSnapshots: {},
  dayStepSnapshots: {},
  dayCommitSnapshot: null,
  dayCommitRestoreVersion: 0,
  configName: DEFAULT_SINGLE_CONFIG.name,
  lastConfigs: {},
  savedConfigs: {},

  setPlayerCount: (count) => set({ playerCount: Math.max(1, Math.floor(count)) }),
  setGoldenBabyConfig: (config) => set({
    goldenBabyConfig: {
      min: Math.max(0, Math.floor(config.min)),
      max: Math.max(0, Math.floor(config.max)),
    },
  }),
  setGoldenBabyPlayers: (players) => set({ goldenBabyPlayers: [...new Set(players)] }),
  setSingleWinRule: (rule) => set({ singleWinRule: rule }),
  setSheriffExplosionRule: (rule) => set({ sheriffExplosionRule: rule }),
  setConfigName: (name) => set({ configName: name }),
  applyConfig: (config) => set({
    gameMode: config.mode,
    playerCount: config.playerCount,
    selectedRoles: config.selectedRoles.map(role => ({ ...role })),
    goldenBabyConfig: config.mode === 'dual' ? { ...config.goldenBabyConfig } : { min: 0, max: 0 },
    goldenBabyPlayers: [],
    singleWinRule: config.singleWinRule ?? 'edge',
    sheriffExplosionRule: config.sheriffExplosionRule ?? 'none',
    winResult: null,
    configName: config.name,
    nightOrder: [],
    currentStep: 0,
    nightActions: [],
    nightStepSnapshots: {},
    dayStepSnapshots: {},
    dayCommitSnapshot: null,
    dayCommitRestoreVersion: 0,
    roleMembersMap: {},
    playerCardMap: {},
    deadPlayers: [],
    upperDeadPlayers: [],
    sheriffPlayer: null,
    sheriffExplosionCount: 0,
    sheriffBadgeDestroyed: false,
    gameLog: [],
    deathRecords: [],
    lastDayExiledRoleId: null,
    slaveTraderSlaves: [],
    fireWolfBurnedPlayers: [],
    fireWolfBurnedCards: [],
    fireWolfBurnRecords: [],
    fireWolfUsed: false,
    spiritWolfMimic: null,
    spiritWolfSaveUsed: false,
    spiritWolfPoisonUsed: false,
    mummySealedRoles: [],
    monkVoteTarget: null,
    monkVoteCard: null,
  }),
  saveCurrentConfig: () => {
    const { gameMode, playerCount, selectedRoles, goldenBabyConfig, configName, singleWinRule, sheriffExplosionRule } = get();
    const snapshot: GameConfigSnapshot = {
      name: configName.trim() || (gameMode === 'dual' ? DEFAULT_DUAL_CONFIG.name : DEFAULT_SINGLE_CONFIG.name),
      mode: gameMode,
      playerCount,
      selectedRoles: selectedRoles.map(role => ({ ...role })),
      goldenBabyConfig: gameMode === 'dual' ? { ...goldenBabyConfig } : { min: 0, max: 0 },
      singleWinRule,
      sheriffExplosionRule,
    };
    set(state => ({
      configName: snapshot.name,
      savedConfigs: {
        ...state.savedConfigs,
        [gameMode]: [...(state.savedConfigs[gameMode] ?? []), snapshot],
      },
    }));
  },
  deleteSavedConfig: (mode, index) => set(state => ({
    savedConfigs: {
      ...state.savedConfigs,
      [mode]: (state.savedConfigs[mode] ?? []).filter((_, configIndex) => configIndex !== index),
    },
  })),
  appendLog: (phase, text) => set(state => ({
    gameLog: [
      ...state.gameLog,
      { id: (state.gameLog.at(-1)?.id ?? 0) + 1, night: state.currentNight, phase, text },
    ].slice(-MAX_GAME_LOG_ENTRIES),
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
    const { selectedRoles, goldenBabyConfig, gameMode, singleWinRule, sheriffExplosionRule } = get();
    const roleIds = new Set(selectedRoles.map(r => r.roleId));
    if (gameMode === 'dual' && goldenBabyConfig.max > 0) roleIds.add('golden_baby');
    const order = ROLES
      .filter(r => r.hasNightAction && roleIds.has(r.id))
      .sort((a, b) => a.defaultOrder - b.defaultOrder)
      .map(r => r.id);
    const { playerCount, configName } = get();
    const snapshot: GameConfigSnapshot = {
      name: configName.trim() || (gameMode === 'dual' ? DEFAULT_DUAL_CONFIG.name : DEFAULT_SINGLE_CONFIG.name),
      mode: gameMode,
      playerCount,
      selectedRoles: selectedRoles.map(role => ({ ...role })),
      goldenBabyConfig: gameMode === 'dual' ? { ...goldenBabyConfig } : { min: 0, max: 0 },
      singleWinRule,
      sheriffExplosionRule,
    };
    set(state => ({
      nightOrder: order,
      lastConfigs: { ...state.lastConfigs, [gameMode]: snapshot },
    }));
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
    const {
      nightActions, currentNight, currentStep, checkedPlayers, gameMode, upperDeadPlayers,
      playerCardMap, roleMembersMap, nightHistory,
    } = get();
    let updated = [...nightActions];
    updated[currentStep] = action;
    let invalidatedAction: NightAction | undefined;

    if (action.roleId === 'fire_wolf' && action.fireWolfTarget !== undefined) {
      const originalTargetRole = gameMode === 'dual'
        ? playerCardMap[action.fireWolfTarget]?.[upperDeadPlayers.includes(action.fireWolfTarget) ? 'lower' : 'upper']
        : findSingleRoleForPlayer(action.fireWolfTarget, roleMembersMap);
      const targetRole = getFireWolfEffectiveRole(
        action.fireWolfTarget,
        originalTargetRole,
        gameMode,
        upperDeadPlayers,
        get().fireWolfBurnRecords,
      );
      if (isGodRoleId(targetRole)) {
        updated = updated.map((existing, index) => {
          if (index === currentStep || existing.roleId !== targetRole || !existing.members.includes(action.fireWolfTarget!)) {
            return existing;
          }
          invalidatedAction = existing;
          const remainingMembers = existing.members.filter(player => player !== action.fireWolfTarget);
          return remainingMembers.length > 0
            ? {
                ...existing,
                members: remainingMembers,
                invalidatedByFireWolf: true,
                invalidatedPlayers: [...new Set([...(existing.invalidatedPlayers ?? []), action.fireWolfTarget!])],
              }
            : {
                roleId: existing.roleId,
                members: [],
                invalidatedByFireWolf: true,
                invalidatedPlayers: [...new Set([...(existing.invalidatedPlayers ?? []), action.fireWolfTarget!])],
              };
        });
      }
    }

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
      const resolvedTargets = applyMagicSwapTargets(action.anubisTargets, magicSwap)!;
      set(state => ({
        anubisScaledPlayers: [...new Set([...state.anubisScaledPlayers, ...resolvedTargets])],
        anubisScaledCards: mergeRoleCards([
          ...state.anubisScaledCards,
          ...getAnubisScaledCardsForTargets(resolvedTargets, gameMode, upperDeadPlayers),
        ]),
      }));
    }

    if (action.roleId === 'golden_baby') {
      set({ goldenBabyPlayers: [...new Set(action.members)] });
    }

    if (action.roleId === 'mummy' && action.mummySealedRole) {
      set(state => ({ mummySealedRoles: [...new Set([...state.mummySealedRoles, action.mummySealedRole!])] }));
    }

    if (action.roleId === 'slave_trader' && action.slaveTarget !== undefined) {
      const targetRole = getFireWolfEffectiveRole(
        action.slaveTarget,
        findSingleRoleForPlayer(action.slaveTarget, get().roleMembersMap),
        gameMode,
        upperDeadPlayers,
        get().fireWolfBurnRecords,
      );
      if (isVillagerLikeRoleId(targetRole)) {
        set(state => ({ slaveTraderSlaves: [...new Set([...state.slaveTraderSlaves, action.slaveTarget!])] }));
      }
    }

    if (action.roleId === 'fire_wolf' && action.fireWolfTarget !== undefined) {
      const { gameMode, upperDeadPlayers, playerCardMap, roleMembersMap, currentNight, currentStep } = get();
      if (gameMode === 'dual') {
        const slot = upperDeadPlayers.includes(action.fireWolfTarget) ? 'lower' : 'upper';
        const targetRole = getFireWolfEffectiveRole(
          action.fireWolfTarget,
          playerCardMap[action.fireWolfTarget]?.[slot],
          gameMode,
          upperDeadPlayers,
          get().fireWolfBurnRecords,
        );
        set(state => ({
          fireWolfBurnedCards: isGodRoleId(targetRole)
            ? [
                ...state.fireWolfBurnedCards.filter(card => !(card.player === action.fireWolfTarget && card.slot === slot)),
                { player: action.fireWolfTarget!, slot },
              ]
            : state.fireWolfBurnedCards,
          fireWolfBurnRecords: isGodRoleId(targetRole) && targetRole
            ? [
                ...state.fireWolfBurnRecords.filter(record => !(record.player === action.fireWolfTarget && record.slot === slot)),
                { player: action.fireWolfTarget!, slot, originalRoleId: targetRole, night: currentNight, step: currentStep },
              ]
            : state.fireWolfBurnRecords,
          bishopHolder: isGodRoleId(targetRole) && state.bishopHolder === action.fireWolfTarget
            ? null
            : state.bishopHolder,
          fireWolfUsed: true,
        }));
      } else {
        const targetRole = getFireWolfEffectiveRole(
          action.fireWolfTarget,
          findSingleRoleForPlayer(action.fireWolfTarget, roleMembersMap),
          gameMode,
          upperDeadPlayers,
          get().fireWolfBurnRecords,
        );
        if (isGodRoleId(targetRole)) {
          set(state => ({
            fireWolfBurnedPlayers: [...new Set([...state.fireWolfBurnedPlayers, action.fireWolfTarget!])],
            fireWolfBurnRecords: [
              ...state.fireWolfBurnRecords.filter(record => !(record.player === action.fireWolfTarget && record.slot === 'single')),
              { player: action.fireWolfTarget!, slot: 'single', originalRoleId: targetRole!, night: currentNight, step: currentStep },
            ],
            bishopHolder: state.bishopHolder === action.fireWolfTarget ? null : state.bishopHolder,
            fireWolfUsed: true,
          }));
        } else {
          set({ fireWolfUsed: true });
        }
      }
    }

    if (invalidatedAction) {
      const actionGroups = [
        ...nightHistory.map(record => record.actions),
        updated,
      ];
      const actionTimeline = [
        ...nightHistory.flatMap(record => record.actions.map((existing, step) => ({
          existing,
          night: record.nightNumber,
          step,
        }))),
        ...updated.map((existing, step) => ({ existing, night: currentNight, step })),
      ];
      const allEffectiveActions = actionTimeline.map(entry => entry.existing);
      const rebuiltCheckedPlayers: Record<number, 'wolf' | 'good'> = {};
      for (const existing of allEffectiveActions) {
        if (existing.roleId === 'seer' && existing.checkTarget !== undefined && existing.checkResult) {
          rebuiltCheckedPlayers[existing.checkTarget] = existing.checkResult;
        }
      }

      let rebuiltCupidLovers: [number, number] | null = null;
      for (const group of actionGroups) {
        const cupidAction = group.find(existing => existing.roleId === 'cupid' && existing.linkTargets?.length === 2);
        if (cupidAction?.linkTargets) {
          rebuiltCupidLovers = applyMagicSwapTargets(
            cupidAction.linkTargets,
            getMagicSwap(group),
          ) as [number, number];
        }
      }

      const rebuiltAnubisPlayers = uniqueNums(actionGroups.flatMap(group => {
        const groupMagicSwap = getMagicSwap(group);
        return group
          .filter(existing => existing.roleId === 'anubis' && existing.anubisTargets?.length === 2)
          .flatMap(existing => applyMagicSwapTargets(existing.anubisTargets, groupMagicSwap) ?? []);
      }));
      const rebuiltMummySeals = [...new Set(allEffectiveActions
        .filter(existing => existing.roleId === 'mummy' && existing.mummySealedRole)
        .map(existing => existing.mummySealedRole!))];
      const rebuiltSlaves = uniqueNums(actionTimeline
        .filter(({ existing }) => existing.roleId === 'slave_trader' && existing.slaveTarget !== undefined)
        .filter(({ existing, night, step }) => {
          const player = existing.slaveTarget!;
          const burnRecordsAtAction = get().fireWolfBurnRecords.filter(record =>
            record.night < night || (record.night === night && record.step < step)
          );
          const targetRole = getFireWolfEffectiveRole(
            player,
            findSingleRoleForPlayer(player, roleMembersMap),
            gameMode,
            upperDeadPlayers,
            burnRecordsAtAction,
          );
          return isVillagerLikeRoleId(targetRole);
        })
        .map(({ existing }) => existing.slaveTarget!));

      set(state => ({
        saveUsed: allEffectiveActions.some(existing => existing.roleId === 'witch' && existing.saveTarget !== undefined),
        poisonUsed: allEffectiveActions.some(existing => existing.roleId === 'witch' && existing.poisonTarget !== undefined),
        checkedPlayers: rebuiltCheckedPlayers,
        cupidLovers: rebuiltCupidLovers,
        anubisScaledPlayers: rebuiltAnubisPlayers,
        anubisScaledCards: state.anubisScaledCards.filter(card => rebuiltAnubisPlayers.includes(card.player)),
        mummySealedRoles: rebuiltMummySeals,
        slaveTraderSlaves: rebuiltSlaves,
      }));
    }

    if (action.roleId === 'spirit_wolf' && action.spiritWolfSaveTarget !== undefined) {
      set({ spiritWolfSaveUsed: true });
    }

    if (action.roleId === 'spirit_wolf' && action.spiritWolfPoisonTarget !== undefined) {
      set({ spiritWolfPoisonUsed: true });
    }

    if (action.roleId === 'spirit_wolf' && action.spiritWolfMimicTarget !== undefined && get().spiritWolfMimic === null) {
      const targetRole = getActiveRoleAtPhaseStart(
        action.spiritWolfMimicTarget,
        gameMode,
        get().roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        get().fireWolfBurnRecords,
      ) ?? 'villager';
      set(state => ({
        spiritWolfMimic: {
          target: action.spiritWolfMimicTarget!,
          roleId: targetRole,
          availableNight: state.currentNight + 1,
        },
      }));
    }

    const role = ROLES.find(r => r.id === action.roleId);
    const actorText = action.members.length > 0 ? action.members.map(p => `${p}號`).join('、') : '無活躍位置';
    get().appendLog('夜晚技能', `${role?.name ?? action.roleId}：${actorText}`);
  },

  captureNightStepSnapshot: (step) => {
    set(state => {
      if (state.nightStepSnapshots[step]) return {};
      return {
        nightStepSnapshots: {
          ...state.nightStepSnapshots,
          [step]: createGameUndoSnapshot(state),
        },
      };
    });
  },

  captureDayStepSnapshot: (step) => {
    set(state => {
      if (state.dayStepSnapshots[step]) return {};
      return {
        dayStepSnapshots: {
          ...state.dayStepSnapshots,
          [step]: createGameUndoSnapshot(state),
        },
      };
    });
  },

  restoreDayStepSnapshot: (step) => {
    set(state => {
      const snapshot = state.dayStepSnapshots[step];
      if (!snapshot) return {};
      const nextSnapshots = { ...state.dayStepSnapshots };
      for (const key of Object.keys(nextSnapshots)) {
        if (Number(key) >= step) delete nextSnapshots[Number(key)];
      }
      return {
        ...restoreGameUndoSnapshot(snapshot),
        dayStepSnapshots: nextSnapshots,
      };
    });
  },

  restoreDayCommitSnapshot: () => {
    const { dayCommitSnapshot: snapshot, dayCommitRestoreVersion } = get();
    if (!snapshot) return false;
    set({
      ...restoreGameUndoSnapshot(snapshot.state),
      currentNight: snapshot.currentNight,
      currentStep: snapshot.currentStep,
      nightStepSnapshots: cloneUndoSnapshots(snapshot.nightStepSnapshots),
      dayStepSnapshots: cloneUndoSnapshots(snapshot.dayStepSnapshots),
      dayCommitSnapshot: null,
      dayCommitRestoreVersion: dayCommitRestoreVersion + 1,
    });
    return true;
  },

  nextStep: () => {
    const { currentStep, nightOrder } = get();
    set({ currentStep: Math.min(currentStep + 1, nightOrder.length) });
  },

  prevStep: () => {
    const { currentStep } = get();
    set({ currentStep: Math.max(currentStep - 1, 0) });
  },

  rewindNightStep: (step) => {
    set(state => {
      const safeStep = Math.max(0, Math.min(step, state.nightOrder.length));
      const snapshot = state.nightStepSnapshots[safeStep];
      if (snapshot) {
        const nextSnapshots = { ...state.nightStepSnapshots };
        for (const key of Object.keys(nextSnapshots)) {
          if (Number(key) >= safeStep) delete nextSnapshots[Number(key)];
        }
        return {
          ...restoreGameUndoSnapshot(snapshot),
          currentStep: safeStep,
          nightStepSnapshots: nextSnapshots,
        };
      }
      const clearedRoleIds = state.nightOrder.slice(safeStep);
      const clearedRoleNames = new Set(clearedRoleIds.map(roleId => ROLES.find(role => role.id === roleId)?.name ?? roleId));
      const clearedRoleIdSet = new Set(clearedRoleIds);
      const nextRoleMembersMap = { ...state.roleMembersMap };
      for (const roleId of clearedRoleIds) {
        delete nextRoleMembersMap[roleId];
      }

      const nextCardMap: Record<number, { upper?: string; lower?: string }> = {};
      for (const [player, cards] of Object.entries(state.playerCardMap)) {
        const nextCards = { ...cards };
        if (nextCards.upper && clearedRoleIdSet.has(nextCards.upper)) nextCards.upper = undefined;
        if (nextCards.lower && clearedRoleIdSet.has(nextCards.lower)) nextCards.lower = undefined;
        if (nextCards.upper || nextCards.lower) nextCardMap[Number(player)] = nextCards;
      }

      return {
        currentStep: safeStep,
        nightActions: state.nightActions.slice(0, safeStep),
        roleMembersMap: nextRoleMembersMap,
        playerCardMap: nextCardMap,
        nightStepSnapshots: Object.fromEntries(
          Object.entries(state.nightStepSnapshots).filter(([snapshotStep]) => Number(snapshotStep) < safeStep),
        ),
        gameLog: state.gameLog.filter(log => {
          if (log.night !== state.currentNight || log.phase !== '夜晚技能') return true;
          return ![...clearedRoleNames].some(roleName => log.text.startsWith(`${roleName}：`));
        }),
      };
    });
  },

  setNightStep: (step) => {
    const { nightOrder } = get();
    set({ currentStep: Math.max(0, Math.min(step, nightOrder.length)) });
  },

  finishNight: () => {
    const { nightActions: rawActions, currentNight, roleMembersMap, playerCardMap, upperDeadPlayers, deadPlayers, playerCount, nightHistory, cupidLovers, gameMode, fireWolfBurnRecords } = get();
    const existingRecord = [...nightHistory]
      .reverse()
      .find(record => record.nightNumber === currentNight);
    if (existingRecord && JSON.stringify(existingRecord.actions) === JSON.stringify(rawActions)) {
      return existingRecord;
    }
    const totalPlayers = playerCount;
    const prevDreamwalkerTarget = getPreviousDreamwalkerTarget(nightHistory, currentNight);
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
    const summary = buildNightSummary(nightActions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, resolvedCupidLovers, gameMode, fireWolfBurnRecords);
    const record: NightRecord = { nightNumber: currentNight, actions: nightActions, summary };
    set(state => ({
      nightHistory: [
        ...state.nightHistory.filter(entry => entry.nightNumber !== currentNight),
        record,
      ],
      nightActions,
      cupidLovers: resolvedCupidLovers,
      anubisScaledPlayers: anubisAction
        ? [...new Set([
            ...state.anubisScaledPlayers.filter(p => !anubisAction.anubisTargets!.includes(p)),
            ...resolvedAnubisTargets,
          ])]
        : state.anubisScaledPlayers,
      anubisScaledCards: anubisAction
        ? mergeRoleCards([
            ...state.anubisScaledCards.filter(card => !anubisAction.anubisTargets!.includes(card.player)),
            ...getAnubisScaledCardsForTargets(resolvedAnubisTargets, gameMode, upperDeadPlayers),
          ])
        : state.anubisScaledCards,
    }));
    for (const line of summary) {
      if (line.trim() !== '') get().appendLog('夜晚結算', line);
    }
    return record;
  },

  resetNight: () => {
    const {
      nightActions, deadPlayers, upperDeadPlayers, gameMode, roleMembersMap, playerCardMap,
      nightHistory, cupidLovers, slaveTraderSlaves, singleWinRule, selectedRoles,
      goldenBabyPlayers, fireWolfBurnedPlayers, fireWolfBurnRecords, currentNight,
    } = get();
    const prevDreamwalkerTarget = getPreviousDreamwalkerTarget(nightHistory, currentNight);
    const newDeaths = computeNightDeaths(nightActions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, cupidLovers, gameMode, true, slaveTraderSlaves, fireWolfBurnRecords);

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
      const nextDead = [...new Set(nextFull)];
      const nextUpperDead = [...new Set(nextUpper)];
      const winResult = computeWinResult({
        gameMode,
        singleWinRule,
        selectedRoles,
        roleMembersMap,
        deadPlayers: nextDead,
        upperDeadPlayers: nextUpperDead,
        playerCardMap,
        goldenBabyPlayers,
        fireWolfBurnedPlayers,
        resolutionPhase: 'night',
      });
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        nightStepSnapshots: {},
        dayStepSnapshots: {},
        dayCommitSnapshot: null,
        deadPlayers: nextDead,
        upperDeadPlayers: nextUpperDead,
        winResult,
      }));
    } else {
      const allDead = [...new Set([...deadPlayers, ...newDeaths])];
      const winResult = computeWinResult({
        gameMode,
        singleWinRule,
        selectedRoles,
        roleMembersMap,
        deadPlayers: allDead,
        upperDeadPlayers,
        playerCardMap,
        goldenBabyPlayers,
        fireWolfBurnedPlayers,
        resolutionPhase: 'night',
      });
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        nightStepSnapshots: {},
        dayStepSnapshots: {},
        dayCommitSnapshot: null,
        deadPlayers: allDead,
        winResult,
      }));
    }
  },

  resetGameProgress: () => set({
    currentNight: 1,
    currentStep: 0,
    nightActions: [],
    nightHistory: [],
    nightStepSnapshots: {},
    dayStepSnapshots: {},
    dayCommitSnapshot: null,
    dayCommitRestoreVersion: 0,
    saveUsed: false,
    poisonUsed: false,
    sharpshooterUsed: false,
    checkedPlayers: {},
    roleMembersMap: {},
    playerCardMap: {},
    deadPlayers: [],
    upperDeadPlayers: [],
    sheriffPlayer: null,
    sheriffExplosionCount: 0,
    sheriffBadgeDestroyed: false,
    lostVotePlayers: [],
    idiotFlippedPlayers: [],
    anubisScaledPlayers: [],
    anubisScaledCards: [],
    cupidLovers: null,
    bishopHolder: null,
    knightUsed: false,
    lastDayExileInfo: null,
    lastDayExiledRoleId: null,
    slaveTraderSlaves: [],
    fireWolfBurnedPlayers: [],
    fireWolfBurnedCards: [],
    fireWolfBurnRecords: [],
    fireWolfUsed: false,
    spiritWolfMimic: null,
    spiritWolfSaveUsed: false,
    spiritWolfPoisonUsed: false,
    mummySealedRoles: [],
    monkVoteTarget: null,
    monkVoteCard: null,
    goldenBabyPlayers: [],
    winResult: null,
    gameLog: [],
    deathRecords: [],
  }),

  startNewGame: (mode) => {
    const baseConfig = mode === 'dual' ? DEFAULT_DUAL_CONFIG : DEFAULT_SINGLE_CONFIG;
    set({
      gameMode: mode,
      playerCount: baseConfig.playerCount,
      selectedRoles: baseConfig.selectedRoles.map(role => ({ ...role })),
      sheriffExplosionRule: baseConfig.sheriffExplosionRule ?? 'none',
      nightOrder: [],
      currentNight: 1,
      currentStep: 0,
      nightActions: [],
      nightHistory: [],
      nightStepSnapshots: {},
      dayStepSnapshots: {},
      dayCommitSnapshot: null,
      dayCommitRestoreVersion: 0,
      saveUsed: false,
      poisonUsed: false,
      sharpshooterUsed: false,
      checkedPlayers: {},
      roleMembersMap: {},
      playerCardMap: {},
      deadPlayers: [],
      upperDeadPlayers: [],
      sheriffPlayer: null,
      sheriffExplosionCount: 0,
      sheriffBadgeDestroyed: false,
      lostVotePlayers: [],
      idiotFlippedPlayers: [],
      anubisScaledPlayers: [],
      anubisScaledCards: [],
      cupidLovers: null,
      bishopHolder: null,
      knightUsed: false,
      lastDayExileInfo: null,
      lastDayExiledRoleId: null,
      slaveTraderSlaves: [],
      fireWolfBurnedPlayers: [],
      fireWolfBurnedCards: [],
      fireWolfBurnRecords: [],
      fireWolfUsed: false,
      spiritWolfMimic: null,
      spiritWolfSaveUsed: false,
      spiritWolfPoisonUsed: false,
      mummySealedRoles: [],
      monkVoteTarget: null,
      monkVoteCard: null,
      goldenBabyConfig: { ...baseConfig.goldenBabyConfig },
      goldenBabyPlayers: [],
      singleWinRule: baseConfig.singleWinRule,
      winResult: null,
      gameLog: [],
      deathRecords: [],
      configName: baseConfig.name,
    });
  },

  setSheriff: (player) => set({ sheriffPlayer: player }),
  setSheriffExplosionState: (count, badgeDestroyed) => set({
    sheriffExplosionCount: Math.max(0, Math.min(2, count)),
    sheriffBadgeDestroyed: badgeDestroyed,
  }),
  setBishopHolder: (player) => set({ bishopHolder: player }),
  setKnightUsed: (used) => set({ knightUsed: used }),
  setMonkVoteTarget: (player) => set({ monkVoteTarget: player }),
  setMonkVoteCard: (card) => set({ monkVoteCard: card }),

  endDay: ({ exiledPlayer, isIdiotFlip = false, nightChainDeaths, dayKills = [], deathCauses = {} }) => {
    const dayCommitSnapshot = createPhaseTransitionSnapshot(get());
    const {
      nightActions, deadPlayers, upperDeadPlayers, gameMode,
      lostVotePlayers, idiotFlippedPlayers, roleMembersMap, playerCardMap,
      nightHistory, cupidLovers, sharpshooterUsed, slaveTraderSlaves,
      singleWinRule, selectedRoles, goldenBabyPlayers, fireWolfBurnedPlayers, fireWolfBurnRecords,
      currentNight,
    } = get();
    const prevDreamwalkerTarget = getPreviousDreamwalkerTarget(nightHistory, currentNight);
    const computedNightDeaths = computeNightDeaths(nightActions, roleMembersMap, playerCardMap, upperDeadPlayers, prevDreamwalkerTarget, cupidLovers, gameMode, true, slaveTraderSlaves, fireWolfBurnRecords);
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
      fireWolfBurnRecords,
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
      `${exileText}；新增死亡：${uniqueNewDeaths.length > 0
        ? uniqueNewDeaths.map(player => `${player}號（${deathCauses[player] ?? '技能造成死亡'}）`).join('、')
        : '無'}`,
    );
    const nightDeathSet = new Set(nightDeaths);
    const newDeathRecords: DeathRecord[] = uniqueNewDeaths.map(player => ({
      night: currentNight,
      timing: nightDeathSet.has(player) ? 'night' : 'day',
      player,
      cause: deathCauses[player] ?? '技能造成死亡',
    }));
    newDeathRecords.forEach(record => {
      get().appendLog(
        record.timing === 'night' ? '夜晚死亡' : '白天死亡',
        `${record.player}號死亡（死因：${record.cause}）`,
      );
    });

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
    const lastDayExiledRoleId = exiledPlayer !== undefined && !isIdiotFlip
      ? getActiveRoleAtPhaseStart(
          exiledPlayer,
          gameMode,
          roleMembersMap,
          playerCardMap,
          dayPhaseUpperDeadPlayers,
          fireWolfBurnRecords,
        ) ?? null
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
      const nextDead = [...new Set(nextFull)];
      const nextUpperDead = [...new Set(nextUpper)];
      const winResult = computeWinResult({
        gameMode,
        singleWinRule,
        selectedRoles,
        roleMembersMap,
        deadPlayers: nextDead,
        upperDeadPlayers: nextUpperDead,
        playerCardMap,
        goldenBabyPlayers,
        fireWolfBurnedPlayers,
        resolutionPhase: 'day',
      });
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        nightStepSnapshots: {},
        dayStepSnapshots: {},
        dayCommitSnapshot,
        sharpshooterUsed: newSharpshooterUsed,
        deadPlayers: nextDead,
        upperDeadPlayers: nextUpperDead,
        lostVotePlayers: newLostVote,
        idiotFlippedPlayers: newIdiotFlipped,
        lastDayExileInfo: exileInfo,
        lastDayExiledRoleId,
        winResult,
        deathRecords: [...state.deathRecords, ...newDeathRecords],
      }));
    } else {
      const allDead = [...new Set([...deadPlayers, ...allNewDeaths])];
      const winResult = computeWinResult({
        gameMode,
        singleWinRule,
        selectedRoles,
        roleMembersMap,
        deadPlayers: allDead,
        upperDeadPlayers,
        playerCardMap,
        goldenBabyPlayers,
        fireWolfBurnedPlayers,
        resolutionPhase: 'day',
      });
      set(state => ({
        currentNight: state.currentNight + 1,
        currentStep: 0,
        nightActions: [],
        nightStepSnapshots: {},
        dayStepSnapshots: {},
        dayCommitSnapshot,
        sharpshooterUsed: newSharpshooterUsed,
        deadPlayers: allDead,
        lostVotePlayers: newLostVote,
        idiotFlippedPlayers: newIdiotFlipped,
        lastDayExileInfo: exileInfo,
        lastDayExiledRoleId,
        winResult,
        deathRecords: [...state.deathRecords, ...newDeathRecords],
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

  setPlayerCardRole: (player, slot, roleId) =>
    set(state => {
      const prevCards = state.playerCardMap[player] ?? {};
      const previousRole = prevCards[slot];
      const nextCards = { ...prevCards, [slot]: roleId };
      const nextRoleMembersMap = { ...state.roleMembersMap };

      if (previousRole && previousRole !== roleId && nextCards.upper !== previousRole && nextCards.lower !== previousRole) {
        nextRoleMembersMap[previousRole] = (nextRoleMembersMap[previousRole] ?? []).filter(p => p !== player);
      }

      nextRoleMembersMap[roleId] = [...new Set([...(nextRoleMembersMap[roleId] ?? []), player])];

      return {
        playerCardMap: {
          ...state.playerCardMap,
          [player]: nextCards,
        },
        roleMembersMap: nextRoleMembersMap,
      };
    }),

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
}), {
  name: 'werewolf-host-game-state',
  version: GAME_PERSISTENCE_VERSION,
  storage: createJSONStorage(() => gamePersistStorage),
  migrate: persistedState => persistedState as GameState,
  merge: (persistedState, currentState) => mergePersistedGameState(persistedState, currentState),
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
): { player: number; isWolf: boolean } | null {
  if (!lastDayExileInfo?.upperWasAlive) return null;
  const player = lastDayExileInfo.player;
  if (deadPlayers.includes(player)) return null;
  const lowerRoleId = playerCardMap[player]?.lower;
  if (!lowerRoleId) return { player, isWolf: false };
  return {
    player,
    isWolf: ROLES.find(r => r.id === lowerRoleId)?.team === 'wolf' || lowerRoleId === 'wild_child',
  };
}

export function getEffectiveDreamwalkerTarget(actions: NightAction[]): number | undefined {
  const target = actions.find(a => a.roleId === 'dreamwalker')?.dreamwalkerTarget;
  return applyMagicSwapTarget(target, getMagicSwap(actions));
}

export function getPreviousDreamwalkerTarget(
  history: NightRecord[],
  currentNight: number,
): number | undefined {
  const previousNight = [...history]
    .reverse()
    .find(record => record.nightNumber < currentNight);
  return getEffectiveDreamwalkerTarget(previousNight?.actions ?? []);
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
  const wolfRoleIds = new Set(ROLES.filter(role => role.team === 'wolf').map(role => role.id));
  const wolfPlayers = new Set<number>();

  if (gameMode === 'single') {
    for (const [roleId, members] of Object.entries(roleMembersMap)) {
      if (!wolfRoleIds.has(roleId) && roleId !== 'wild_child') continue;
      for (const player of members ?? []) {
        if (!deadPlayers.includes(player)) wolfPlayers.add(player);
      }
    }
    return [...wolfPlayers];
  }

  for (const [playerStr, cards] of Object.entries(playerCardMap)) {
    const player = Number(playerStr);
    if (deadPlayers.includes(player)) continue;
    const upperWolf = cards.upper !== undefined &&
      !upperDeadPlayers.includes(player) &&
      (wolfRoleIds.has(cards.upper) || cards.upper === 'wild_child');
    const lowerWolf = cards.lower !== undefined &&
      (wolfRoleIds.has(cards.lower) || cards.lower === 'wild_child');
    if (upperWolf || lowerWolf) {
      wolfPlayers.add(player);
    }
  }
  return [...wolfPlayers];
}

export type NightDeathAbilityStatus = 'can_trigger' | 'poisoned' | 'sealed';

export type DeathTiming = 'night' | 'day';

export interface DeathSkillTrigger {
  player: number;
  roleId: 'hunter' | 'wolf_king';
}

function hasActiveMummySeal(
  actions: NightAction[],
  sealedRoleId: string | undefined,
  gameMode: GameMode,
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  deadPlayers: number[] = [],
): boolean {
  if (!sealedRoleId) return false;
  return actions.some(action =>
    action.roleId === 'mummy' &&
    action.mummySealedRole === sealedRoleId &&
    getActiveNightRoleMembers(
      'mummy',
      action.members,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      deadPlayers,
    ).length > 0
  );
}

export function getActiveRoleAtPhaseStart(
  player: number,
  gameMode: GameMode,
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
): string | undefined {
  let originalRoleId: string | undefined;
  if (gameMode === 'dual') {
    const cards = playerCardMap[player];
    originalRoleId = upperDeadPlayers.includes(player) ? cards?.lower : cards?.upper;
  } else {
    originalRoleId = Object.entries(roleMembersMap)
      .find(([, members]) => (members ?? []).includes(player))?.[0];
  }
  return getFireWolfEffectiveRole(player, originalRoleId, gameMode, upperDeadPlayers, fireWolfBurnRecords);
}

function isNightSkillImmune(
  player: number,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]>,
  playerCardMap: Record<number, { upper?: string; lower?: string }>,
  upperDeadPlayers: number[],
  prevDreamwalkerTarget: number | undefined,
  gameMode: GameMode,
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
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
    fireWolfBurnRecords,
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
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
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
      fireWolfBurnRecords,
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
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
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
        fireWolfBurnRecords,
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
              fireWolfBurnRecords,
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

function appendDeathCause(causes: DeathCauseMap, player: number | undefined, cause: string) {
  if (player === undefined) return;
  const previous = causes[player];
  if (!previous) causes[player] = cause;
  else if (!previous.split('、').includes(cause)) causes[player] = `${previous}、${cause}`;
}

export function buildDeathCauseMap(
  rounds: number[][],
  firstRoundCauses: DeathCauseMap,
  actions: NightAction[] = [],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  cupidLovers?: [number, number] | null,
  gameMode: GameMode = 'single',
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
): DeathCauseMap {
  const causes: DeathCauseMap = { ...firstRoundCauses };
  const dreamwalkerTarget = getEffectiveDreamwalkerTarget(actions);

  rounds.forEach((round, roundIndex) => {
    if (roundIndex === 0) {
      round.forEach(player => {
        if (!causes[player]) causes[player] = '技能造成死亡';
      });
      return;
    }
    const previousRound = rounds[roundIndex - 1] ?? [];
    for (const player of round) {
      const dreamwalkerDied = dreamwalkerTarget === player && previousRound.some(previousPlayer =>
        getActiveRoleAtPhaseStart(
          previousPlayer,
          gameMode,
          roleMembersMap,
          playerCardMap,
          upperDeadPlayers,
          fireWolfBurnRecords,
        ) === 'dreamwalker'
      );
      if (dreamwalkerDied) appendDeathCause(causes, player, '攝夢人連帶死亡');

      if (cupidLovers && gameMode !== 'dual') {
        const [first, second] = cupidLovers;
        const linkedDeath = (player === first && previousRound.includes(second)) ||
          (player === second && previousRound.includes(first));
        if (linkedDeath) appendDeathCause(causes, player, '戀人殉情');
      }
      if (!causes[player]) causes[player] = '死亡連鎖';
    }
  });
  return causes;
}

export function getNightDeathCauseMap(
  rounds: number[][],
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  cupidLovers?: [number, number] | null,
  gameMode: GameMode = 'single',
  slaveTraderSlaves: number[] = [],
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
  prevDreamwalkerTarget?: number,
): DeathCauseMap {
  const firstRound = rounds[0] ?? [];
  const causes: DeathCauseMap = {};
  const magicSwap = getMagicSwap(actions);
  const addTarget = (target: number | undefined, cause: string) => {
    const effectiveTarget = applyMagicSwapTarget(target, magicSwap);
    if (effectiveTarget !== undefined && firstRound.includes(effectiveTarget)) {
      appendDeathCause(causes, effectiveTarget, cause);
    }
  };

  for (const action of actions) {
    if ((action.roleId === 'werewolf' || action.roleId === 'wolf_king')) addTarget(action.killTarget, '狼刀');
    if (action.roleId === 'witch') addTarget(action.poisonTarget, '女巫毒藥');
    if (action.roleId === 'spirit_wolf') {
      addTarget(action.spiritWolfKillTarget, '靈狼刀');
      addTarget(action.spiritWolfPoisonTarget, '靈狼毒藥');
    }
    if (action.roleId === 'shaman' && action.shamanMode === 'knife') addTarget(action.shamanTarget, '薩滿刀');
    if (action.roleId === 'tengu') action.tenguKillTargets?.forEach(target => addTarget(target, '天狗刀'));
    if (action.roleId === 'fire_wolf') addTarget(action.fireWolfKillTarget, '火狼刀');
    if (action.roleId === 'gargoyle') addTarget(action.gargoyleTarget, '石像鬼偷襲');
    if (action.roleId === 'anubis') action.anubisTargets?.forEach(target => addTarget(target, '阿努比斯天秤'));
    if (action.roleId === 'sharpshooter' && action.sharpshooterDeclared) addTarget(action.sharpshooterTarget, '神射手擊殺');
    if (action.roleId === 'blind_swordsman') {
      if (action.blindSwordsmanTarget !== undefined) addTarget(action.blindSwordsmanTarget, '盲人武士擊殺');
      action.members.forEach(player => {
        if (firstRound.includes(player)) appendDeathCause(causes, player, '盲人武士自殺');
      });
    }
    if (action.roleId === 'witch_hunter' && action.witchHunterTarget !== undefined) {
      const effectiveTarget = applyMagicSwapTarget(action.witchHunterTarget, magicSwap);
      if (effectiveTarget !== undefined && firstRound.includes(effectiveTarget)) {
        appendDeathCause(causes, effectiveTarget, '獵魔人狩獵');
      }
      action.members.forEach(player => {
        if (firstRound.includes(player)) appendDeathCause(causes, player, '獵魔人反噬');
      });
    }
  }

  const effectiveWolfKill = applyMagicSwapTarget(
    actions.find(action => action.roleId === 'werewolf' || action.roleId === 'wolf_king')?.killTarget,
    magicSwap,
  );
  const effectiveGuardTarget = applyMagicSwapTarget(
    actions.find(action => action.roleId === 'guard')?.protectTarget,
    magicSwap,
  );
  const effectiveWitchSave = applyMagicSwapTarget(
    actions.find(action => action.roleId === 'witch')?.saveTarget,
    magicSwap,
  );
  if (
    effectiveWolfKill !== undefined &&
    effectiveWolfKill === effectiveGuardTarget &&
    effectiveWolfKill === effectiveWitchSave &&
    firstRound.includes(effectiveWolfKill)
  ) {
    appendDeathCause(causes, effectiveWolfKill, '守衛與解藥同時使用');
  }

  const dreamwalkerTarget = getEffectiveDreamwalkerTarget(actions);
  if (
    dreamwalkerTarget !== undefined &&
    dreamwalkerTarget === prevDreamwalkerTarget &&
    firstRound.includes(dreamwalkerTarget)
  ) {
    appendDeathCause(causes, dreamwalkerTarget, '連續攝夢');
  }

  const slaveTrader = roleMembersMap['slave_trader']?.find(player =>
    getActiveRoleAtPhaseStart(
      player,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    ) === 'slave_trader'
  );
  if (slaveTrader !== undefined && !firstRound.includes(slaveTrader) && slaveTraderSlaves.length > 0) {
    const deathsBeforeSubstitution = computeNightDeaths(
      actions,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      prevDreamwalkerTarget,
      cupidLovers,
      gameMode,
      false,
      [],
      fireWolfBurnRecords,
    );
    if (deathsBeforeSubstitution.includes(slaveTrader)) {
      const substitute = slaveTraderSlaves.find(player =>
        player !== slaveTrader && !deathsBeforeSubstitution.includes(player)
      );
      if (substitute !== undefined && firstRound.includes(substitute)) causes[substitute] = '奴隸替死';
    }
  }

  return buildDeathCauseMap(
    rounds,
    causes,
    actions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    cupidLovers,
    gameMode,
    fireWolfBurnRecords,
  );
}

export function getDeathSkillTriggers(
  rounds: number[][],
  timing: DeathTiming,
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  gameMode: GameMode = 'single',
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
): DeathSkillTrigger[] {
  const magicSwap = getMagicSwap(actions);
  const poisonTargets = timing === 'night'
    ? new Set(actions
        .flatMap(action => [action.roleId === 'witch' ? action.poisonTarget : undefined, action.spiritWolfPoisonTarget])
        .map(target => applyMagicSwapTarget(target, magicSwap))
        .filter((target): target is number => target !== undefined))
    : new Set<number>();
  const triggers: DeathSkillTrigger[] = [];

  for (const player of rounds.flat()) {
    const roleId = getActiveRoleAtPhaseStart(
      player,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    );
    const sealedByMummy = timing === 'night' && hasActiveMummySeal(
      actions,
      roleId,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
    );
    if ((roleId === 'hunter' || roleId === 'wolf_king') && !poisonTargets.has(player) && !sealedByMummy) {
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
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
): NightDeathAbilityStatus {
  const deaths = computeNightDeaths(
    actions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    prevDreamwalkerTarget,
    cupidLovers,
    gameMode,
    true,
    [],
    fireWolfBurnRecords,
  );
  const magicSwap = getMagicSwap(actions);
  const effectivePoisonTargets = new Set(actions
    .flatMap(action => [action.roleId === 'witch' ? action.poisonTarget : undefined, action.spiritWolfPoisonTarget])
    .map(target => applyMagicSwapTarget(target, magicSwap))
    .filter((target): target is number => target !== undefined));
  const isPoisonDeath = deaths.includes(player) && effectivePoisonTargets.has(player);
  const activeRole = getActiveRoleAtPhaseStart(
    player,
    gameMode ?? 'single',
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    fireWolfBurnRecords,
  );
  const sealedByMummy = hasActiveMummySeal(
    actions,
    activeRole,
    gameMode ?? 'single',
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
  );
  if (sealedByMummy) return 'sealed';
  return isPoisonDeath ? 'poisoned' : 'can_trigger';
}

export function resolveDreamwalkerCarryDeaths(
  initialDeaths: number[],
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  pendingUpperDeaths: number[] = [],
  gameMode: GameMode = Object.keys(playerCardMap).length > 0 ? 'dual' : 'single',
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
): number[] {
  const deaths = new Set(initialDeaths);
  const dreamwalkerTarget = getEffectiveDreamwalkerTarget(actions);
  if (dreamwalkerTarget === undefined) return [...deaths];

  const isActiveDreamwalker = (player: number) => {
    const projectedUpperDeaths = [...upperDeadPlayers, ...pendingUpperDeaths];
    return getActiveRoleAtPhaseStart(
      player,
      gameMode,
      roleMembersMap,
      playerCardMap,
      projectedUpperDeaths,
      fireWolfBurnRecords,
    ) === 'dreamwalker';
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
  slaveTraderSlaves: number[] = [],
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
): number[] {
  let wolfKill: number | undefined;
  let guardProtect: number | undefined;
  let dreamwalkerProtect: number | undefined;
  let witchSave: number | undefined;
  let witchPoison: number | undefined;
  let shamanShield: number | undefined;
  const spiritWolfSaveTargets: number[] = [];
  const spiritWolfPoisonTargets: number[] = [];

  for (const a of actions) {
    if ((a.roleId === 'werewolf' || a.roleId === 'wolf_king') && a.killTarget !== undefined) wolfKill = a.killTarget;
    if (a.roleId === 'guard') guardProtect = a.protectTarget;
    if (a.roleId === 'dreamwalker') dreamwalkerProtect = a.dreamwalkerTarget;
    if (a.roleId === 'witch') { witchSave = a.saveTarget; witchPoison = a.poisonTarget; }
    if (a.roleId === 'shaman' && a.shamanMode === 'shield') shamanShield = a.shamanTarget;
    if (a.roleId === 'spirit_wolf' && a.spiritWolfSaveTarget !== undefined) spiritWolfSaveTargets.push(a.spiritWolfSaveTarget);
    if (a.roleId === 'spirit_wolf' && a.spiritWolfPoisonTarget !== undefined) spiritWolfPoisonTargets.push(a.spiritWolfPoisonTarget);
  }

  // 魔術師互換：重新導向所有夜晚技能目標（技能並非真的交換身分，而是物理位置互換）
  const magicSwap = getMagicSwap(actions);
  wolfKill      = applyMagicSwapTarget(wolfKill, magicSwap);
  guardProtect  = applyMagicSwapTarget(guardProtect, magicSwap);
  dreamwalkerProtect = applyMagicSwapTarget(dreamwalkerProtect, magicSwap);
  witchSave     = applyMagicSwapTarget(witchSave, magicSwap);
  witchPoison   = applyMagicSwapTarget(witchPoison, magicSwap);
  shamanShield  = applyMagicSwapTarget(shamanShield, magicSwap);
  const saveTargets = new Set([
    witchSave,
    ...spiritWolfSaveTargets.map(target => applyMagicSwapTarget(target, magicSwap)),
  ].filter((target): target is number => target !== undefined));
  const poisonTargets = [
    witchPoison,
    ...spiritWolfPoisonTargets.map(target => applyMagicSwapTarget(target, magicSwap)),
  ].filter((target): target is number => target !== undefined);

  // 科學怪人：免疫夜間所有傷害
  // 攝夢人連續守護同一人 → 保護失效且目標死亡
  const consecutiveDreamwalk =
    prevDreamwalkerTarget !== undefined &&
    dreamwalkerProtect !== undefined &&
    dreamwalkerProtect === prevDreamwalkerTarget;

  // 攝夢人保護（非連續）或科學怪人本體 → 免疫一切
  const isPassiveShielded = (p: number) => {
    if (p === dreamwalkerProtect && !consecutiveDreamwalk) return true;
    if (getActiveRoleAtPhaseStart(
      p,
      gameMode ?? 'single',
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    ) === 'frankenstein') return true;
    return false;
  };
  const isShielded = (p: number) => {
    if (p === guardProtect) return true;
    if (p === shamanShield) return true;
    return isPassiveShielded(p);
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
    return getActiveRoleAtPhaseStart(
      p,
      gameMode ?? 'single',
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    );
  };
  const isActiveDreamwalker = (p: number) => {
    const cards = playerCardMap[p];
    const activeRole = getActiveCardRoleId(p);
    if (cards) return activeRole === 'dreamwalker';
    if (activeRole !== undefined) return activeRole === 'dreamwalker';
    return getActiveRoleAtPhaseStart(
      p,
      gameMode ?? 'single',
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    ) === 'dreamwalker';
  };

  // 優先以 active card 判斷；playerCardMap 有記錄時不 fallback roleMembersMap
  const isWolfTeam = (p: number) => {
    const cards = playerCardMap[p];
    if (cards) {
      const activeRole = getActiveCardRoleId(p);
      return activeRole !== undefined && wolfTeamIds.has(activeRole);
    }
    const activeRole = getActiveCardRoleId(p);
    return activeRole !== undefined && wolfTeamIds.has(activeRole);
  };
  const isVillageNightRole = (p: number) => {
    const cards = playerCardMap[p];
    if (cards) {
      const activeRole = getActiveCardRoleId(p);
      return activeRole !== undefined && villageNightIds.has(activeRole);
    }
    const activeRole = getActiveCardRoleId(p);
    return activeRole !== undefined && villageNightIds.has(activeRole);
  };

  const deaths = new Set<number>();
  const knifeCounts = new Map<number, number>();
  const activeShieldCounts = new Map<number, number>();
  const addKnife = (target: number | undefined) => {
    if (target === undefined) return;
    knifeCounts.set(target, (knifeCounts.get(target) ?? 0) + 1);
  };
  const addActiveShield = (target: number | undefined) => {
    if (target === undefined) return;
    activeShieldCounts.set(target, (activeShieldCounts.get(target) ?? 0) + 1);
  };
  addKnife(wolfKill);
  addActiveShield(guardProtect);
  addActiveShield(shamanShield);

  // 狼刀：守衛或解藥擋住則存活；守衛＋解藥同時作用 → 解藥視為毒藥，目標死亡
  if (wolfKill !== undefined) {
  }

  // 女巫毒藥（獵魔人免疫毒藥）
  const isActiveWitchHunter = (p: number) => {
    const cards = playerCardMap[p];
    const activeRole = getActiveCardRoleId(p);
    if (cards) return activeRole === 'witch_hunter';
    if (activeRole !== undefined) return activeRole === 'witch_hunter';
    return getActiveRoleAtPhaseStart(
      p,
      gameMode ?? 'single',
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    ) === 'witch_hunter';
  };
  for (const poisonTarget of poisonTargets) {
    if (!isPassiveShielded(poisonTarget) && !isActiveWitchHunter(poisonTarget)) deaths.add(poisonTarget);
  }

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
        const cards = playerCardMap[p];
        const activeRole = getActiveCardRoleId(p);
        if (cards) return activeRole !== undefined && (wolfTeamIds.has(activeRole) || activeRole === 'wild_child');
        if (activeRole !== undefined) return wolfTeamIds.has(activeRole) || activeRole === 'wild_child';
        return getPlayerRoleIds(p).some(rid => wolfTeamIds.has(rid) || rid === 'wild_child');
      };
      const [t1, t2] = applyMagicSwapTargets(a.anubisTargets, magicSwap)!;
      const w1 = isWolfTeamForAnubis(t1), w2 = isWolfTeamForAnubis(t2);
      if (w1 && !w2 && !isShielded(t2)) deaths.add(t2);
      else if (!w1 && w2 && !isShielded(t1)) deaths.add(t1);
    }

    // 天狗刀視為狼刀。
    if (a.roleId === 'tengu' && a.tenguKillTargets) {
      const targets = (applyMagicSwapTargets(a.tenguKillTargets, magicSwap) ?? []).slice(0, 1);
      targets.forEach(target => addKnife(target));
    }

    if (a.roleId === 'shaman' && a.shamanMode === 'knife' && a.shamanTarget !== undefined) {
      const t = applyMagicSwapTarget(a.shamanTarget, magicSwap)!;
      addKnife(t);
    }

    if (a.roleId === 'spirit_wolf' && a.spiritWolfKillTarget !== undefined) {
      const t = applyMagicSwapTarget(a.spiritWolfKillTarget, magicSwap)!;
      addKnife(t);
    }

    if (a.roleId === 'fire_wolf' && a.fireWolfKillTarget !== undefined) {
      const t = applyMagicSwapTarget(a.fireWolfKillTarget, magicSwap)!;
      addKnife(t);
    }

    if (a.roleId === 'blind_swordsman') {
      const monkPlayers = gameMode === 'dual'
        ? Object.keys(playerCardMap).map(Number)
        : roleMembersMap['monk'] ?? [];
      const monkActive = monkPlayers.some(player =>
        !deaths.has(player) &&
        getActiveRoleAtPhaseStart(
          player,
          gameMode ?? 'single',
          roleMembersMap,
          playerCardMap,
          upperDeadPlayers,
          fireWolfBurnRecords,
        ) === 'monk'
      );
      if (a.blindSwordsmanMode === 'kill') {
        if (monkActive) {
          a.members.forEach(player => deaths.add(player));
        } else if (a.blindSwordsmanTarget !== undefined) {
          const t = applyMagicSwapTarget(a.blindSwordsmanTarget, magicSwap)!;
          if (!isPassiveShielded(t)) deaths.add(t);
        }
      } else if (
        a.blindSwordsmanMode === 'monk_vote' &&
        monkActive &&
        a.blindSwordsmanTarget !== undefined
      ) {
        const t = applyMagicSwapTarget(a.blindSwordsmanTarget, magicSwap)!;
        if (!isPassiveShielded(t)) deaths.add(t);
      }
    }

    // 白狼王自爆：白狼王本人＋目標皆死
  }

  // 攝夢人連續守護同一人 → 連續保護對象死亡（保護失效）
  for (const [target, knifeCount] of knifeCounts.entries()) {
    if (isPassiveShielded(target)) continue;
    const shieldCount = activeShieldCounts.get(target) ?? 0;
    let remainingKnives = Math.max(0, knifeCount - shieldCount);
    const saved = saveTargets.has(target);
    if (saved && remainingKnives > 0) remainingKnives -= 1;
    if (remainingKnives > 0) deaths.add(target);
    if (saved && remainingKnives === 0 && knifeCount > 0 && knifeCount <= shieldCount) deaths.add(target);
  }

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

  const resolvedDeaths = [...deaths];
  const slaveTrader = roleMembersMap['slave_trader']?.find(p =>
    resolvedDeaths.includes(p) &&
    getActiveRoleAtPhaseStart(
      p,
      gameMode ?? 'single',
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    ) === 'slave_trader'
  );
  if (slaveTrader !== undefined) {
    const substitute = slaveTraderSlaves.find(p => p !== slaveTrader && !resolvedDeaths.includes(p));
    if (substitute !== undefined) {
      return [...new Set(resolvedDeaths.map(p => p === slaveTrader ? substitute : p))];
    }
  }

  return resolvedDeaths;
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

export function buildNightSummary(
  actions: NightAction[],
  roleMembersMap: Record<string, number[]> = {},
  playerCardMap: Record<number, { upper?: string; lower?: string }> = {},
  upperDeadPlayers: number[] = [],
  prevDreamwalkerTarget?: number,
  cupidLovers?: [number, number] | null,
  gameMode?: 'single' | 'dual',
  fireWolfBurnRecords: FireWolfBurnRecord[] = [],
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
    if (a.invalidatedByFireWolf) {
      const invalidated = a.invalidatedPlayers?.length
        ? `（${a.invalidatedPlayers.join('、')}號）`
        : '';
      lines.push(`🔥 ${role.name}${invalidated} → 被火狼燒成民，本晚技能失效`);
      if (a.members.length === 0) continue;
    }
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
        lines.push(`${role.emoji} ${role.name}${who} → ${a.bloodMoonActivated ? '發動技能（清晨公布平安夜，延後夜晚資訊與死亡結算）' : '未發動'}`);
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
      case 'spirit_wolf': {
        const actionsTaken: string[] = [];
        if (a.spiritWolfMimicTarget !== undefined) actionsTaken.push(`模仿 ${fmt(a.spiritWolfMimicTarget)}`);
        if (a.spiritWolfKillTarget !== undefined) actionsTaken.push(`擊殺 ${fmt(a.spiritWolfKillTarget)}`);
        if (a.spiritWolfCheckTarget !== undefined) {
          const checkedRole = ROLES.find(item => item.id === a.spiritWolfCheckRole)?.name ?? '未知角色';
          actionsTaken.push(`查驗 ${fmt(a.spiritWolfCheckTarget)}：${checkedRole}`);
        }
        if (a.spiritWolfSaveTarget !== undefined) actionsTaken.push(`解藥救 ${fmt(a.spiritWolfSaveTarget)}`);
        if (a.spiritWolfPoisonTarget !== undefined) actionsTaken.push(`毒藥毒 ${fmt(a.spiritWolfPoisonTarget)}`);
        lines.push(`${role.emoji} ${role.name}${who} → ${actionsTaken.join('；') || '未發動技能'}`);
        break;
      }
      case 'shaman':
        lines.push(`${role.emoji} ${role.name}${who} → ${
          a.shamanTarget === undefined || a.shamanMode === 'none'
            ? '未發動'
            : `${a.shamanMode === 'knife' ? '薩滿刀' : '薩滿盾'}指定 ${fmt(a.shamanTarget)}`
        }`);
        break;
      case 'slave_trader':
        lines.push(`${role.emoji} ${role.name}${who} → ${a.slaveTarget !== undefined ? `奴役 ${fmt(a.slaveTarget)}` : '未奴役'}`);
        break;
      case 'fire_wolf': {
        const actionsTaken: string[] = [];
        if (a.fireWolfTarget !== undefined) actionsTaken.push(`燒成平民 ${fmt(a.fireWolfTarget)}`);
        if (a.fireWolfKillTarget !== undefined) actionsTaken.push(`代替狼刀攻擊 ${fmt(a.fireWolfKillTarget)}`);
        lines.push(`${role.emoji} ${role.name}${who} → ${actionsTaken.join('；') || '未發動技能'}`);
        break;
      }
      case 'blind_swordsman':
        if (a.blindSwordsmanMode === 'monk_vote') {
          lines.push(`${role.emoji} ${role.name}${who} → ${
            a.blindSwordsmanTarget !== undefined
              ? `依僧侶票嘗試擊殺 ${fmt(a.blindSwordsmanTarget)}`
              : '依僧侶票發動（無有效目標）'
          }`);
        } else {
          lines.push(`${role.emoji} ${role.name}${who} → ${a.blindSwordsmanTarget !== undefined ? `自行擊殺 ${fmt(a.blindSwordsmanTarget)}` : '未發動技能'}`);
        }
        break;
      case 'explorer':
        lines.push(`${role.emoji} ${role.name}${who} → 最近的狼：${typeof a.explorerResult === 'number' ? fmt(a.explorerResult) : '未知'}`);
        break;
      case 'mummy':
        lines.push(`${role.emoji} ${role.name}${who} → ${
          a.mummySealedRole
            ? `封印 ${ROLES.find(item => item.id === a.mummySealedRole)?.name ?? a.mummySealedRole}`
            : '未封印'
        }`);
        break;
      case 'gravedigger':
        lines.push(`${role.emoji} ${role.name}${who} → 查看前日放逐牌的下牌陣營`);
        break;
      default:
        lines.push(`${role.emoji} ${role.name}${who} → 無行動`);
    }
  }

  const guardBySave  = wolfKill !== undefined && wolfKill === guardProtect && wolfKill === witchSave;
  const killBlocked  = wolfKill !== undefined && !guardBySave && (wolfKill === guardProtect || wolfKill === witchSave);
  const poisonedByGuardSave = guardBySave;

  lines.push('');
  const consecutiveDreamwalk =
    prevDreamwalkerTarget !== undefined &&
    dreamwalkerProtect !== undefined &&
    dreamwalkerProtect === prevDreamwalkerTarget;
  if (dreamwalkerProtect !== undefined) {
    lines.push(consecutiveDreamwalk
      ? `💤 ${fmt(dreamwalkerProtect)} 被連續兩晚攝夢，保護失效並死亡`
      : `💤 ${fmt(dreamwalkerProtect)} 受攝夢人保護，免疫本晚所有傷害`);
  }
  if (killBlocked) lines.push(`（${fmt(wolfKill!)} 受到保護，免於死亡）`);
  if (poisonedByGuardSave) lines.push(`（${fmt(wolfKill!)} 守衛＋解藥同時作用，解藥視為毒藥，仍死亡）`);

  // 完整死亡列表（使用 computeNightDeaths 確保石像鬼、天狗等全部算入）
  const allDeaths = computeNightDeaths(
    actions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    prevDreamwalkerTarget,
    cupidLovers,
    gameMode,
    true,
    [],
    fireWolfBurnRecords,
  );
  const bloodMoonOn = actions.some(a => a.roleId === 'blood_moon' && a.bloodMoonActivated);
  const summaryDeaths = bloodMoonOn ? [] : allDeaths;
  const summaryDeathCauses = getNightDeathCauseMap(
    summaryDeaths.length > 0 ? [summaryDeaths] : [],
    actions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    cupidLovers,
    gameMode ?? 'single',
    [],
    fireWolfBurnRecords,
    prevDreamwalkerTarget,
  );

  lines.push(summaryDeaths.length === 0
    ? '✨ 本晚平安，無人死亡'
    : `💀 本晚死亡：${summaryDeaths.map(player => `${fmt(player)}（死因：${summaryDeathCauses[player]}）`).join('、')}`);
  return lines;
}
