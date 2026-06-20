import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { ROLES } from '../data/roles';
import {
  useGameStore,
  NightAction,
  computeNightDeaths,
  getMagicSwap,
  applyMagicSwapTarget,
  getEffectiveDreamwalkerTarget,
  getActiveNightRoleMembers,
  canAssignNightRolePosition,
  getWolfNightParticipants,
  getNightDeathAbilityStatus,
  getActiveRoleAtPhaseStart,
  getGravediggerLowerInfo,
  getTenguKillAllowance,
  computeWinResult,
  projectDeathState,
} from '../store/gameStore';
import PlayerButton, { RoleInfo } from '../components/PlayerButton';
import HeaderMenuButton from '../components/HeaderMenuButton';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Night'>;

// ── 行動按鈕設定（女巫/預言家/獵人/血月/白狼王/訓熊師/守墓人/神射手/盜賊 單獨處理） ──
interface ActionDef { key: string; label: string; maxTargets: number; color: string; }
const ROLE_CONFIG: Record<string, { memberHint: string; actions: ActionDef[] }> = {
  cupid:       { memberHint: '點選丘比特是誰',      actions: [{ key: 'link',         label: '💘 連結戀人（選2人）', maxTargets: 2, color: Colors.warning }] },
  dreamwalker: { memberHint: '點選攝夢人是誰',      actions: [{ key: 'dreamprotect', label: '💤 保護',             maxTargets: 1, color: '#2196f3' }] },
  guard:       { memberHint: '點選守衛是誰',        actions: [{ key: 'protect',      label: '🛡️ 守護',            maxTargets: 1, color: '#2196f3' }] },
  crow:        { memberHint: '點選烏鴉是誰',        actions: [{ key: 'surround',     label: '🐦‍⬛ 環繞（次日不可被投票）', maxTargets: 1, color: '#607d8b' }] },
  werewolf:    { memberHint: '點選本局所有狼人',    actions: [{ key: 'kill',         label: '🔪 刀人',            maxTargets: 1, color: Colors.primary }] },
  shapeshifter:{ memberHint: '點選變形怪是誰（與狼人同時睜眼）', actions: [] },
  wolf_king:   { memberHint: '點選狼王是誰',        actions: [] },
  tengu:       { memberHint: '點選天狗是誰',        actions: [{ key: 'kill',         label: '⚡ 擊殺（1人）',      maxTargets: 1, color: Colors.wolf }] },
  gargoyle:    { memberHint: '點選石像鬼是誰',      actions: [{ key: 'ambush',       label: '🗿 偷襲神職',         maxTargets: 1, color: '#795548' }] },
  anubis:      { memberHint: '點選阿努比斯是誰',    actions: [{ key: 'scale',        label: '⚖️ 天秤（選2人）',   maxTargets: 2, color: '#ff9800' }] },
  seer:        { memberHint: '點選預言家是誰',      actions: [] },
  witch_hunter:{ memberHint: '點選獵魔人是誰',      actions: [{ key: 'hunt',         label: '🗡️ 狩獵',            maxTargets: 1, color: Colors.village }] },
  witch:       { memberHint: '點選女巫是誰',        actions: [] },
  magician:    { memberHint: '點選魔術師是誰',      actions: [{ key: 'swap',         label: '🎩 互換目標（選2人）',maxTargets: 2, color: '#9c27b0' }] },
  white_wolf:  { memberHint: '點選白狼王是誰',      actions: [] },
  hunter:      { memberHint: '點選獵人是誰',        actions: [] },
  blood_moon:  { memberHint: '點選血月使徒是誰',    actions: [] },
  bear_tamer:  { memberHint: '點選訓熊師是誰',      actions: [] },
  gravedigger: { memberHint: '點選守墓人是誰',      actions: [] },
  sharpshooter:{ memberHint: '點選神射手是誰',      actions: [] },
  thief:       { memberHint: '點選盜賊是誰',        actions: [] },
  frankenstein:{ memberHint: '點選科學怪人是誰',   actions: [] },
  wild_child:  { memberHint: '點選野孩子是誰',      actions: [] },
  bishop:      { memberHint: '點選主教是誰',        actions: [] },
  idiot:       { memberHint: '點選白痴是誰',        actions: [] },
  knight:      { memberHint: '點選騎士是誰',        actions: [] },
  old_rogue:   { memberHint: '點選老流氓是誰',      actions: [] },
  golden_baby: { memberHint: '點選金寶寶是誰',      actions: [] },
  spirit_wolf: { memberHint: '選擇靈狼玩家', actions: [
    { key: 'mimic', label: '👻 模仿出局者', maxTargets: 1, color: Colors.wolf },
    { key: 'spiritkill', label: '🔪 靈狼刀', maxTargets: 1, color: Colors.primary },
    { key: 'spiritcheck', label: '🔮 模仿查驗', maxTargets: 1, color: '#9c27b0' },
    { key: 'spiritsave', label: '💊 靈狼解藥', maxTargets: 1, color: Colors.village },
    { key: 'spiritpoison', label: '☠️ 靈狼毒藥', maxTargets: 1, color: Colors.danger },
  ] },
  shaman: { memberHint: '選擇薩滿玩家', actions: [{ key: 'shaman', label: '🪬 指定目標', maxTargets: 1, color: Colors.village }] },
  slave_trader: { memberHint: '選擇奴隸販子玩家', actions: [{ key: 'enslave', label: '⛓️ 奴役', maxTargets: 1, color: Colors.warning }] },
  fire_wolf: { memberHint: '選擇火狼玩家', actions: [
    { key: 'burn', label: '🔥 燒成平民', maxTargets: 1, color: Colors.wolf },
    { key: 'firekill', label: '🔪 代替狼刀', maxTargets: 1, color: Colors.primary },
  ] },
  blind_swordsman: { memberHint: '選擇盲人武士玩家', actions: [
    { key: 'monkstrike', label: '🙏 依僧侶票擊殺', maxTargets: 0, color: Colors.warning },
    { key: 'swordkill', label: '🗡️ 自行擊殺', maxTargets: 1, color: Colors.danger },
  ] },
  monk: { memberHint: '選擇僧侶玩家', actions: [] },
  explorer: { memberHint: '選擇探險家玩家', actions: [] },
  mummy: { memberHint: '選擇木乃伊玩家', actions: [] },
};

export default function NightScreen() {
  const navigation = useNavigation<Nav>();
  const {
    gameMode, playerCount, nightOrder, currentStep, currentNight, selectedRoles, singleWinRule,
    nightActions, nightHistory, saveUsed, poisonUsed, checkedPlayers,
    roleMembersMap, deadPlayers, upperDeadPlayers, playerCardMap,
    winResult,
    lastDayExileInfo, lastDayExiledRoleId, sharpshooterUsed, anubisScaledPlayers, anubisScaledCards, cupidLovers,
    goldenBabyConfig, goldenBabyPlayers, spiritWolfMimic, spiritWolfSaveUsed, spiritWolfPoisonUsed, mummySealedRoles, monkVoteTarget, monkVoteCard, fireWolfBurnedPlayers, fireWolfBurnedCards, fireWolfBurnRecords, fireWolfUsed, slaveTraderSlaves,
    recordAction, captureNightStepSnapshot, nextStep, prevStep, rewindNightStep, restoreDayCommitSnapshot, finishNight, resetNight, resetGameProgress, setRoleMembers, transformThief, setGoldenBabyPlayers,
  } = useGameStore();
  const isDualMode = gameMode === 'dual';
  const { width } = useWindowDimensions();

  const totalPlayers = playerCount;
  const playerNums = Array.from({ length: totalPlayers }, (_, i) => i + 1);
  const isAnubisScaledTargetLocked = (num: number): boolean => {
    if (!isDualMode) return anubisScaledPlayers.includes(num);
    return anubisScaledCards.some(card => {
      if (card.player !== num || deadPlayers.includes(num)) return false;
      if (card.slot === 'upper') return !upperDeadPlayers.includes(num);
      return upperDeadPlayers.includes(num);
    });
  };
  const COLS = totalPlayers > 12 ? 5 : 4;
  const GAP = 6;
  // 限制最大 390px（web 的 useWindowDimensions 回傳全瀏覽器寬）
  const effectiveWidth = Math.min(width, 390);
  const btnSize = Math.min(72, Math.floor((effectiveWidth - 32 - (COLS - 1) * GAP) / COLS));

  // ── 通用狀態 ──
  const [members, setMembers] = useState<number[]>([]);
  const [pendingRolePlayers, setPendingRolePlayers] = useState<number[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [actionTargets, setActionTargets] = useState<Record<string, number[]>>({});

  // ── 女巫專用 ──
  const [witchChoice, setWitchChoice] = useState<'save' | 'poison' | null>(null);
  const [poisonTarget, setPoisonTarget] = useState<number | undefined>();

  // ── 血月使徒 ──
  const [bloodMoonActivated, setBloodMoonActivated] = useState(false);
  // ── 訓熊師 ──
  const [bearTamerResult, setBearTamerResult] = useState<'growl' | 'silent' | null>(null);
  // ── 神射手 ──
  const [sharpshooterDeclared, setSharpshooterDeclared] = useState(false);
  const [sharpshooterKillTarget, setSharpshooterKillTarget] = useState<number | undefined>(undefined);
  // ── 盜賊 ──
  const [thiefChosenRole, setThiefChosenRole] = useState<string | null>(null);
  const [mummySelectedRole, setMummySelectedRole] = useState<string | null>(null);

  const isDone = currentStep >= nightOrder.length;
  const roleId = nightOrder[currentStep];
  const role = ROLES.find(r => r.id === roleId);
  const mummyInGame = selectedRoles.some(entry => entry.roleId === 'mummy' && entry.count > 0);
  const effectiveNightActions = mummyInGame
    ? nightActions
    : nightActions.filter(action => action.roleId !== 'mummy');
  const actionHasActiveMummy = (action: { members: number[] }) =>
    getActiveNightRoleMembers(
      'mummy',
      action.members,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      deadPlayers,
    ).length > 0;
  const sealedByMummy = effectiveNightActions.some(a =>
    a.roleId === 'mummy' &&
    actionHasActiveMummy(a) &&
    a.mummySealedRole === roleId
  );
  const roleConfig = ROLE_CONFIG[roleId] ?? { memberHint: '確認後繼續', actions: [] };
  const spiritMimicReady = spiritWolfMimic !== null && currentNight >= spiritWolfMimic.availableNight;
  const spiritAllowedActionKeys = (() => {
    if (roleId !== 'spirit_wolf') return null;
    if (!spiritWolfMimic) return new Set(['mimic']);
    if (!spiritMimicReady) return new Set<string>();
    const mimicRole = ROLES.find(r => r.id === spiritWolfMimic.roleId);
    if (mimicRole?.team === 'wolf') return new Set(['spiritkill']);
    if (spiritWolfMimic.roleId === 'seer') return new Set(['spiritcheck']);
    if (spiritWolfMimic.roleId === 'witch') {
      return new Set([
        ...(!spiritWolfSaveUsed ? ['spiritsave'] : []),
        ...(!spiritWolfPoisonUsed ? ['spiritpoison'] : []),
      ]);
    }
    return new Set<string>();
  })();
  const baseAvailableRoleActions = roleId === 'fire_wolf'
    ? roleConfig.actions.filter(action => !fireWolfUsed && action.key === 'burn')
    : roleConfig.actions;
  const availableRoleActions = spiritAllowedActionKeys
    ? baseAvailableRoleActions.filter(action => spiritAllowedActionKeys.has(action.key))
    : baseAvailableRoleActions;
  const maxMembers = roleId === 'golden_baby'
    ? goldenBabyConfig.max
    : selectedRoles.find(r => r.roleId === roleId)?.count ?? 1;
  const currentMagicSwap = getMagicSwap(effectiveNightActions);
  const transformedThiefMembers = roleId === 'thief'
    ? nightHistory.flatMap(night =>
        night.actions
          .filter(action => action.roleId === 'thief' && action.thiefRole)
          .flatMap(action => action.members),
      )
    : [];
  const knownRoleMembers = [
    ...new Set([
      ...(roleId === 'golden_baby' ? goldenBabyPlayers : (roleMembersMap[roleId] ?? [])),
      ...transformedThiefMembers,
    ]),
  ];
  const rolePositionKnown = knownRoleMembers.length > 0;
  const currentActiveMembers = getActiveNightRoleMembers(
    roleId,
    members,
    gameMode,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    deadPlayers,
  );
  const provisionalPlayerCardMap = pendingRolePlayers.reduce((cards, player) => {
    const current = cards[player] ?? {};
    const slot =
      gameMode === 'single' || roleId === 'thief'
        ? 'upper'
        : roleId === 'shapeshifter' || roleId === 'sharpshooter' || upperDeadPlayers.includes(player)
          ? 'lower'
          : 'upper';
    return { ...cards, [player]: { ...current, [slot]: roleId } };
  }, { ...playerCardMap });
  const roleMemberWriteList = [...members, ...pendingRolePlayers];
  const selectedRoleMembers = [...new Set(roleMemberWriteList)];
  const activeMembers = roleId === 'golden_baby'
    ? selectedRoleMembers.filter(player => !deadPlayers.includes(player))
    : getActiveNightRoleMembers(
        roleId,
        selectedRoleMembers,
        gameMode,
        roleMembersMap,
        provisionalPlayerCardMap,
        upperDeadPlayers,
        deadPlayers,
      );
  const knownRoleCount = roleId === 'golden_baby' || gameMode === 'single'
    ? selectedRoleMembers.length
    : playerNums.reduce((sum, player) => {
        const cards = provisionalPlayerCardMap[player];
        return sum + (cards?.upper === roleId ? 1 : 0) + (cards?.lower === roleId ? 1 : 0);
      }, 0);
  const needsMoreKnownRolePositions = knownRoleCount < maxMembers;
  const canAddSamePlayerLowerRole = (player: number) =>
    gameMode === 'dual' &&
    upperDeadPlayers.includes(player) &&
    !deadPlayers.includes(player) &&
    playerCardMap[player]?.upper === roleId &&
    provisionalPlayerCardMap[player]?.lower !== roleId &&
    knownRoleCount < maxMembers;
  const canEditRolePosition =
    !rolePositionKnown ||
    needsMoreKnownRolePositions ||
    pendingRolePlayers.length > 0 ||
    currentActiveMembers.length === 0;
  const knownWolfNightParticipants = roleId === 'werewolf'
    ? getWolfNightParticipants(
        gameMode,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        deadPlayers,
      )
    : [];
  const activeFireWolfMembers = roleId === 'werewolf'
    ? getActiveNightRoleMembers(
        'fire_wolf',
        roleMembersMap['fire_wolf'] ?? [],
        gameMode,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        deadPlayers,
      )
    : [];
  const fireWolfMayJoinWolfNight = roleId === 'werewolf' && (
    fireWolfUsed ||
    (knownWolfNightParticipants.length === 0 && activeFireWolfMembers.length > 0)
  );
  const wolfNightParticipants = roleId === 'werewolf'
    ? [...new Set([
        ...activeMembers,
        ...knownWolfNightParticipants,
        ...(fireWolfMayJoinWolfNight ? activeFireWolfMembers : []),
      ])]
    : [];
  const isBurnedByFireWolf = (player: number) => {
    if (role?.team !== 'village' || ['villager', 'wild_child', 'golden_baby'].includes(roleId)) return false;
    if (gameMode === 'single') return fireWolfBurnedPlayers.includes(player);
    const slot = upperDeadPlayers.includes(player) ? 'lower' : 'upper';
    return fireWolfBurnedCards.some(card => card.player === player && card.slot === slot);
  };
  const skillMembersRaw = roleId === 'werewolf' ? wolfNightParticipants : activeMembers;
  const burnedByFireWolf = skillMembersRaw.some(isBurnedByFireWolf);
  const skillMembers = skillMembersRaw.filter(player => !isBurnedByFireWolf(player));
  const canUseRoleSkill = skillMembers.length > 0 && !sealedByMummy;
  const hasSelectedRolePosition =
    rolePositionKnown || selectedRoleMembers.length > 0 || (roleId === 'werewolf' && wolfNightParticipants.length > 0);
  const shapeshifterMembers = roleMembersMap['shapeshifter'] ?? [];
  // 預言家查驗：依 active card 判斷（上牌存活→上牌，上牌死→下牌），野孩子視為狼
  const wolfCheckPlayers = (() => {
    const wolfTeamIds = new Set(ROLES.filter(r => r.team === 'wolf').map(r => r.id));
    const result = new Set<number>();
    if (isDualMode) {
      for (const num of playerNums) {
        if (deadPlayers.includes(num)) continue;
        const cards = playerCardMap[num];
        if (cards) {
          const activeRole = upperDeadPlayers.includes(num) ? cards.lower : cards.upper;
          if (activeRole && (wolfTeamIds.has(activeRole) || activeRole === 'wild_child')) result.add(num);
        }
      }
    } else {
      for (const [rid, ms] of Object.entries(roleMembersMap)) {
        if (wolfTeamIds.has(rid) || rid === 'wild_child') {
          for (const m of (ms ?? [])) result.add(m);
        }
      }
    }
    return [...result];
  })();
  const seerWolfCheckPlayers = playerNums.filter(num => {
    const effectiveTarget = applyMagicSwapTarget(num, currentMagicSwap);
    return effectiveTarget !== undefined && wolfCheckPlayers.includes(effectiveTarget);
  });

  // 天狗：除正在行動的天狗牌外，所有狼人角色牌死亡後才能出一刀。
  const tenguMaxKills = (() => {
    if (roleId !== 'tengu') return 0;
    return getTenguKillAllowance({
      gameMode,
      selectedRoles,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      deadPlayers,
      actingTenguPlayers: skillMembers,
    });
  })();

  // 前一晚攝夢人保護目標（供神射手判斷是否觸發使用）
  const prevDreamwalkerTarget = getEffectiveDreamwalkerTarget(nightHistory.at(-1)?.actions ?? []);
  const provisionalNightDeaths = roleId === 'sharpshooter'
    ? computeNightDeaths(
        effectiveNightActions,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        prevDreamwalkerTarget,
        cupidLovers,
        gameMode,
        true,
        [],
        fireWolfBurnRecords,
      )
    : [];
  const sharpshooterWillDie =
    roleId === 'sharpshooter' &&
    activeMembers.some(member => provisionalNightDeaths.includes(member));

  const witchIsInGame = selectedRoles.some(entry => entry.roleId === 'witch' && entry.count > 0);
  const witchHasActed = effectiveNightActions.some(action => action.roleId === 'witch');
  const deathAbilityStatusPending =
    (roleId === 'hunter' || roleId === 'wolf_king') &&
    skillMembers.length > 0 &&
    !sealedByMummy &&
    witchIsInGame &&
    !witchHasActed;
  const deathAbilityStatuses = (roleId === 'hunter' || roleId === 'wolf_king')
    ? skillMembers.map(player => ({
        player,
        status: getNightDeathAbilityStatus(
          player,
          effectiveNightActions,
          roleMembersMap,
          playerCardMap,
          upperDeadPlayers,
          prevDreamwalkerTarget,
          cupidLovers,
          gameMode,
          fireWolfBurnRecords,
        ),
      }))
    : [];

  // 守衛：上一晚守護的目標（不可連續守同一人）
  const lastGuardProtect = (() => {
    const prevNight = nightHistory[nightHistory.length - 1];
    if (!prevNight) return undefined;
    return prevNight.actions.find(a => a.roleId === 'guard')?.protectTarget;
  })();

  // 今晚狼人的刀人目標（給女巫用）
  const wolfKillTarget =
    effectiveNightActions.find(a => a.roleId === 'werewolf' || a.roleId === 'wolf_king')?.killTarget ??
    effectiveNightActions.find(a => a.roleId === 'tengu')?.tenguKillTargets?.[0];
  const shamanKnifeTarget = effectiveNightActions.find(a => a.roleId === 'shaman' && a.shamanMode === 'knife')?.shamanTarget;

  const getOriginalSingleRoleForPlayer = (player: number): string | undefined =>
    Object.entries(roleMembersMap).find(([, list]) => (list ?? []).includes(player))?.[0];
  const getEffectiveRoleForPlayer = (player: number): string | undefined =>
    getActiveRoleAtPhaseStart(
      player,
      gameMode,
      roleMembersMap,
      playerCardMap,
      upperDeadPlayers,
      fireWolfBurnRecords,
    );
  const getSingleRoleForPlayer = getEffectiveRoleForPlayer;
  const isGodRole = (rid: string | undefined) => {
    if (!rid || rid === 'villager' || rid === 'wild_child' || rid === 'golden_baby') return false;
    const def = ROLES.find(r => r.id === rid);
    return def?.team === 'village';
  };
  const wolfRoleIds = new Set(ROLES.filter(r => r.team === 'wolf').map(r => r.id));
  const activeWolfPlayers = playerNums.filter(player => {
    if (deadPlayers.includes(player)) return false;
    if (gameMode === 'dual') {
      const activeRole = upperDeadPlayers.includes(player) ? playerCardMap[player]?.lower : playerCardMap[player]?.upper;
      return activeRole !== undefined && (wolfRoleIds.has(activeRole) || activeRole === 'wild_child');
    }
    const activeRole = getEffectiveRoleForPlayer(player);
    return activeRole !== undefined && (wolfRoleIds.has(activeRole) || activeRole === 'wild_child');
  });
  const explorerResult: number | 'unknown' = (() => {
    const explorer = activeMembers[0];
    if (!explorer || sealedByMummy) return 'unknown';
    const getLivingDistance = (from: number, to: number, direction: 'cw' | 'ccw') => {
      let distance = 0;
      let cursor = from;
      for (let i = 0; i < totalPlayers; i++) {
        cursor = direction === 'cw'
          ? (cursor % totalPlayers) + 1
          : ((cursor + totalPlayers - 2) % totalPlayers) + 1;
        if (deadPlayers.includes(cursor)) continue;
        distance += 1;
        if (cursor === to) return distance;
      }
      return Infinity;
    };
    let nearestDistance = Infinity;
    let nearestWolves: number[] = [];
    for (const wolf of activeWolfPlayers) {
      if (wolf === explorer) continue;
      const cw = getLivingDistance(explorer, wolf, 'cw');
      const ccw = getLivingDistance(explorer, wolf, 'ccw');
      const distance = Math.min(cw, ccw);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestWolves = [wolf];
      } else if (distance === nearestDistance) {
        nearestWolves.push(wolf);
      }
    }
    if (!Number.isFinite(nearestDistance) || nearestWolves.length !== 1) return 'unknown';
    return nearestWolves[0];
  })();
  const mummyNightIndex = nightOrder.indexOf('mummy');
  const selectedRoleIdSet = new Set(selectedRoles.filter(entry => entry.count > 0).map(entry => entry.roleId));
  const mummyRoleOptions = ROLES.filter(r =>
    selectedRoleIdSet.has(r.id) &&
    r.team === 'village' &&
    r.id !== 'villager' &&
    r.id !== 'wild_child' &&
    r.id !== 'golden_baby' &&
    r.hasNightAction
  );
  const monkVoteCardDiedToday = (() => {
    if (!monkVoteCard || !lastDayExileInfo || lastDayExileInfo.player !== monkVoteCard.player) return false;
    if (gameMode === 'single') return true;
    const exiledSlot = lastDayExileInfo.upperWasAlive ? 'upper' : 'lower';
    return monkVoteCard.slot === exiledSlot;
  })();
  const effectiveMonkVoteTarget = monkVoteCardDiedToday ? undefined : monkVoteTarget ?? undefined;

  const handleBack = () => {
    if (currentStep > 0) {
      rewindNightStep(currentStep - 1);
      return;
    }
    if (currentNight > 1 && restoreDayCommitSnapshot()) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Day');
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: `第 ${currentNight} 晚`,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            resetGameProgress();
            navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
          }}
          style={{ paddingHorizontal: 4, paddingVertical: 6 }}
        >
          <Text style={{ color: Colors.text, fontSize: 22, fontWeight: 'bold' }}>⌂</Text>
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [navigation, currentNight, resetGameProgress]);
  // 盜賊僅第一晚出現，後續夜晚自動跳過
  useEffect(() => {
    const savedMembers = roleId === 'golden_baby'
      ? goldenBabyPlayers
      : roleId ? (roleMembersMap[roleId] ?? []) : [];

    const activeSavedMembers = roleId === 'golden_baby'
      ? savedMembers.filter(player => !deadPlayers.includes(player))
      : getActiveNightRoleMembers(
          roleId,
          savedMembers,
          gameMode,
          roleMembersMap,
          playerCardMap,
          upperDeadPlayers,
          deadPlayers,
        );
    const savedSkillMembers = roleId === 'werewolf'
      ? getWolfNightParticipants(
          gameMode,
          roleMembersMap,
          playerCardMap,
          upperDeadPlayers,
          deadPlayers,
        )
      : activeSavedMembers;
    const savedRoleCanAct = savedSkillMembers.length > 0;
    const savedNeedsMoreKnownRolePositions = savedMembers.length < maxMembers;

    setMembers(savedMembers);
    setPendingRolePlayers([]);
    setActionTargets({});
    setWitchChoice(null);
    setPoisonTarget(undefined);
    setBloodMoonActivated(false);
    setBearTamerResult(null);
    setSharpshooterDeclared(false);
    setSharpshooterKillTarget(undefined);
    setThiefChosenRole(null);
    setMummySelectedRole(null);

    if (savedRoleCanAct && !savedNeedsMoreKnownRolePositions) {
      if (roleId === 'seer') {
        setActiveKey('check');
      } else if (roleId !== 'witch') {
        setActiveKey(availableRoleActions[0]?.key ?? null);
      } else {
        setActiveKey(null);
      }
    } else {
      // 尚無活躍成員，停在角色位置選擇模式。
      setActiveKey(null);
    }
  }, [currentStep]);

  // ── 點擊玩家號碼 ──
  const togglePlayer = (num: number) => {
    const canSelectDeadForSpiritMimic = roleId === 'spirit_wolf' && activeKey === 'mimic';
    if (deadPlayers.includes(num) && !canSelectDeadForSpiritMimic) return;
    const isChoosingRolePosition =
      canEditRolePosition &&
      activeKey === null &&
      !(roleId === 'witch' && witchChoice !== null) &&
      !(roleId === 'sharpshooter' && sharpshooterDeclared && sharpshooterWillDie);
    if (
      isChoosingRolePosition &&
      roleId !== 'golden_baby' &&
      !canAssignNightRolePosition(
        roleId,
        num,
        gameMode,
        playerCardMap,
        upperDeadPlayers,
        deadPlayers,
      )
    ) return;
    if (roleId === 'sharpshooter' && sharpshooterDeclared && sharpshooterWillDie) {
      if (activeMembers.includes(num)) return;
      setSharpshooterKillTarget(prev => prev === num ? undefined : num);
      return;
    }
    if (roleId === 'witch') {
      if (witchChoice === 'poison') {
        if (!canUseRoleSkill) return;
        setPoisonTarget(prev => prev === num ? undefined : num);
      } else {
        if (witchChoice !== null) return;
        if (!canEditRolePosition) return;
        if (rolePositionKnown) {
          setPendingRolePlayers(prev => {
            if (prev.includes(num)) return prev.filter(n => n !== num);
            if (selectedRoleMembers.includes(num) && !canAddSamePlayerLowerRole(num)) return prev;
            if (knownRoleCount >= maxMembers) return prev;
            return [...prev, num];
          });
          return;
        }
        setMembers(prev => {
          if (prev.includes(num)) return prev.filter(n => n !== num);
          if (prev.length >= maxMembers) return prev;
          return [...prev, num];
        });
      }
      return;
    }
    if (roleId === 'seer') {
      if (activeKey === 'check') {
        if (!canUseRoleSkill) return;
        setActionTargets(prev => {
          const curr = prev['check'] ?? [];
          return curr.includes(num) ? { ...prev, check: [] } : { ...prev, check: [num] };
        });
      } else {
        if (!canEditRolePosition) return;
        if (rolePositionKnown) {
          setPendingRolePlayers(prev => {
            if (prev.includes(num)) return prev.filter(n => n !== num);
            if (selectedRoleMembers.includes(num) && !canAddSamePlayerLowerRole(num)) return prev;
            if (knownRoleCount >= maxMembers) return prev;
            return [...prev, num];
          });
          return;
        }
        setMembers(prev => {
          if (prev.includes(num)) return prev.filter(n => n !== num);
          if (prev.length >= maxMembers) return prev;
          return [...prev, num];
        });
      }
      return;
    }
    if (activeKey === null) {
      if (!canEditRolePosition) return;
      if (rolePositionKnown) {
        setPendingRolePlayers(prev => {
          if (prev.includes(num)) return prev.filter(n => n !== num);
          if (selectedRoleMembers.includes(num) && !canAddSamePlayerLowerRole(num)) return prev;
          if (knownRoleCount >= maxMembers) return prev;
          return [...prev, num];
        });
        return;
      }
      setMembers(prev => {
        if (prev.includes(num)) return prev.filter(n => n !== num);
        if (prev.length >= maxMembers) return prev;
        return [...prev, num];
      });
    } else {
      if (!canUseRoleSkill) return;
      const def = availableRoleActions.find(a => a.key === activeKey);
      if (!def || def.maxTargets === 0) return;
      // 烏鴉不可環繞自己（members 是本步驟已點選的烏鴉玩家）
      if (roleId === 'crow' && activeKey === 'surround' && members.includes(num)) return;
      // 守衛不可連續守同一人
      if (roleId === 'guard' && activeKey === 'protect' && num === lastGuardProtect) return;
      // 阿努比斯：已上過天平且仍存活的角色牌不可再選
      if (roleId === 'anubis' && activeKey === 'scale' && isAnubisScaledTargetLocked(num)) return;
      const effectiveMax = roleId === 'tengu' && activeKey === 'kill' ? tenguMaxKills : def.maxTargets;
      setActionTargets(prev => {
        const curr = prev[activeKey] ?? [];
        if (curr.includes(num)) return { ...prev, [activeKey]: curr.filter(n => n !== num) };
        if (curr.length < effectiveMax) return { ...prev, [activeKey]: [...curr, num] };
        return { ...prev, [activeKey]: [...curr.slice(curr.length - effectiveMax + 1), num] };
      });
    }
  };

  // ── 完成此步驟 ──
  const handleNext = () => {
    captureNightStepSnapshot(currentStep);
    if (roleId === 'golden_baby') {
      if (selectedRoleMembers.length < goldenBabyConfig.min || selectedRoleMembers.length > goldenBabyConfig.max) return;
      setGoldenBabyPlayers(selectedRoleMembers);
      recordAction({ roleId, members: selectedRoleMembers });
      nextStep();
      return;
    }
    if (!rolePositionKnown || pendingRolePlayers.length > 0) {
      setRoleMembers(roleId, roleMemberWriteList);
    }
    if (!canUseRoleSkill) {
      recordAction({
        roleId,
        members: sealedByMummy ? skillMembers : [],
        invalidatedByFireWolf: burnedByFireWolf,
        invalidatedPlayers: burnedByFireWolf ? skillMembersRaw.filter(isBurnedByFireWolf) : undefined,
      });
      nextStep();
      return;
    }

    const action: NightAction = { roleId, members: skillMembers };
    switch (roleId) {
      case 'witch':
        if (witchChoice === 'save' && wolfKillTarget !== undefined) action.saveTarget = wolfKillTarget;
        if (witchChoice === 'poison' && poisonTarget !== undefined) action.poisonTarget = poisonTarget;
        break;
      case 'seer':
        action.checkTarget = seerCheckTarget;
        action.checkResult = autoCheckResult;
        break;
      case 'blood_moon':
        action.bloodMoonActivated = bloodMoonActivated;
        break;
      case 'bear_tamer':
        // bearTamerResult 由 finishNight 自動計算，此處不手動設定
        break;
      case 'sharpshooter':
        action.sharpshooterDeclared = sharpshooterDeclared;
        if (sharpshooterDeclared && sharpshooterKillTarget !== undefined) {
          action.sharpshooterTarget = sharpshooterKillTarget;
        }
        break;
      case 'thief':
        if (thiefChosenRole) action.thiefRole = thiefChosenRole;
        break;
      case 'mummy':
        if (mummySelectedRole) action.mummySealedRole = mummySelectedRole;
        break;
      case 'explorer':
        action.explorerResult = explorerResult;
        break;
      case 'shaman':
        action.shamanTarget = actionTargets['shaman']?.[0];
        action.shamanMode = lastDayExiledRoleId
          ? (ROLES.find(r => r.id === lastDayExiledRoleId)?.team === 'wolf' ? 'knife' : 'shield')
          : 'none';
        break;
      case 'slave_trader':
        action.slaveTarget = actionTargets['enslave']?.[0];
        break;
      case 'spirit_wolf':
        action.spiritWolfMimicTarget = actionTargets['mimic']?.[0];
        action.spiritWolfKillTarget = actionTargets['spiritkill']?.[0];
        action.spiritWolfCheckTarget = actionTargets['spiritcheck']?.[0];
        action.spiritWolfSaveTarget = actionTargets['spiritsave']?.[0];
        action.spiritWolfPoisonTarget = actionTargets['spiritpoison']?.[0];
        if (action.spiritWolfCheckTarget !== undefined) {
          action.spiritWolfCheckRole = getEffectiveRoleForPlayer(action.spiritWolfCheckTarget);
        }
        action.spiritWolfMimicRole = spiritWolfMimic?.availableNight !== undefined && spiritWolfMimic.availableNight <= currentNight
          ? spiritWolfMimic.roleId
          : undefined;
        break;
      case 'fire_wolf':
        action.fireWolfTarget = actionTargets['burn']?.[0];
        action.fireWolfKillTarget = actionTargets['firekill']?.[0];
        break;
      case 'blind_swordsman':
        action.blindSwordsmanMode = activeKey === 'monkstrike' ? 'monk_vote' : activeKey === 'swordkill' ? 'kill' : undefined;
        action.blindSwordsmanTarget =
          action.blindSwordsmanMode === 'monk_vote'
            ? effectiveMonkVoteTarget
            : actionTargets['swordkill']?.[0];
        break;
      case 'tengu': {
        const kills = actionTargets['kill'] ?? [];
        if (kills.length > 0) action.tenguKillTargets = kills;
        break;
      }
      default:
        action.killTarget        = actionTargets['kill']?.[0];
        action.protectTarget     = actionTargets['protect']?.[0];
        action.dreamwalkerTarget = actionTargets['dreamprotect']?.[0];
        action.surroundTarget    = actionTargets['surround']?.[0];
        action.gargoyleTarget    = actionTargets['ambush']?.[0];
        action.witchHunterTarget = actionTargets['hunt']?.[0];
        if ((actionTargets['link'] ?? []).length === 2) action.linkTargets = actionTargets['link'];
        if ((actionTargets['scale'] ?? []).length === 2) action.anubisTargets = actionTargets['scale'] as [number, number];
        if ((actionTargets['swap'] ?? []).length === 2) action.magicianSwap = actionTargets['swap'] as [number, number];
        break;
    }
    recordAction(action);
    if (roleId === 'thief' && thiefChosenRole) {
      transformThief(activeMembers, thiefChosenRole);
    }
    nextStep();
  };

  // ── 玩家按鈕視覺 ──
  const getPlayerStyle = (num: number): { bg: string; border: string; textColor: string; dead?: boolean } => {
    if (deadPlayers.includes(num))
      return { bg: Colors.surface, border: Colors.textMuted, textColor: Colors.textMuted, dead: true };
    const isChoosingRolePosition =
      canEditRolePosition &&
      activeKey === null &&
      !(roleId === 'witch' && witchChoice !== null) &&
      !(roleId === 'sharpshooter' && sharpshooterDeclared && sharpshooterWillDie);
    if (
      isChoosingRolePosition &&
      roleId !== 'golden_baby' &&
      !canAssignNightRolePosition(
        roleId,
        num,
        gameMode,
        playerCardMap,
        upperDeadPlayers,
        deadPlayers,
      )
    ) {
      return { bg: Colors.surface, border: Colors.textMuted, textColor: Colors.textMuted };
    }
    if (isChoosingRolePosition && selectedRoleMembers.includes(num)) {
      if (roleId === 'golden_baby') {
        return { bg: '#ffd54f25', border: '#ffd54f', textColor: '#ffd54f' };
      }
      return { bg: '#ffffff15', border: Colors.textDim, textColor: Colors.text };
    }
    if (roleId === 'sharpshooter' && sharpshooterDeclared && sharpshooterWillDie) {
      if (activeMembers.includes(num))
        return { bg: Colors.textMuted + '20', border: Colors.textMuted, textColor: Colors.textMuted };
      if (sharpshooterKillTarget === num)
        return { bg: '#9c27b035', border: '#9c27b0', textColor: Colors.text };
      if (seerWolfCheckPlayers.includes(num))
        return { bg: Colors.wolf + '18', border: Colors.wolf + '90', textColor: Colors.text };
    }
    // 女巫毒藥目標
    if (roleId === 'witch' && witchChoice === 'poison' && poisonTarget === num)
      return { bg: Colors.danger + '35', border: Colors.danger, textColor: Colors.text };
    // 女巫解藥：高亮狼刀目標
    if (roleId === 'witch' && witchChoice === 'save' && num === wolfKillTarget)
      return { bg: Colors.village + '30', border: Colors.village, textColor: Colors.text };
    // 預言家查驗模式：選中目標→紫色，已知狼人→紅框提示
    if (roleId === 'seer' && activeKey === 'check') {
      if ((actionTargets['check'] ?? []).includes(num))
        return { bg: '#9c27b035', border: '#9c27b0', textColor: Colors.text };
      if (seerWolfCheckPlayers.includes(num))
        return { bg: Colors.wolf + '18', border: Colors.wolf + '90', textColor: Colors.text };
    }
    // 守衛不可守上一晚同一人 → 灰暗禁止
    if (roleId === 'guard' && activeKey === 'protect' && num === lastGuardProtect)
      return { bg: Colors.textMuted + '20', border: Colors.textMuted, textColor: Colors.textMuted };
    // 烏鴉不可選自己 → 灰暗禁止
    if (roleId === 'crow' && activeKey === 'surround' && members.includes(num))
      return { bg: Colors.textMuted + '20', border: Colors.textMuted, textColor: Colors.textMuted };
    // 阿努比斯：已上過天平且仍存活的角色牌禁止再選 → 灰暗禁止
    if (roleId === 'anubis' && activeKey === 'scale' && isAnubisScaledTargetLocked(num))
      return { bg: Colors.textMuted + '20', border: Colors.textMuted, textColor: Colors.textMuted };
    // 通用行動目標（預言家已在上方處理，不走此分支）
    for (const [key, targets] of Object.entries(actionTargets)) {
      if (targets.includes(num)) {
        const def = availableRoleActions.find(a => a.key === key);
        const c = def?.color ?? Colors.primary;
        return { bg: c + '35', border: c, textColor: Colors.text };
      }
    }
    // 成員
    if (goldenBabyPlayers.includes(num))
      return { bg: '#ffd54f18', border: '#ffd54f', textColor: '#ffd54f' };
    if (roleId === 'werewolf' && wolfNightParticipants.includes(num))
      return { bg: Colors.wolf + '22', border: Colors.wolf, textColor: Colors.text };
    if (members.includes(num))
      return { bg: '#ffffff15', border: Colors.textDim, textColor: Colors.text };
    return { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim };
  };

  const getPlayerLabel = (num: number): string => {
    if (deadPlayers.includes(num)) return '死';
    if (roleId === 'werewolf' && shapeshifterMembers.includes(num)) return '變';
    if (roleId === 'sharpshooter' && sharpshooterDeclared && sharpshooterWillDie) {
      if (activeMembers.includes(num)) return '本人';
      if (sharpshooterKillTarget === num) return '射';
    }
    if (roleId === 'witch' && witchChoice === 'poison' && poisonTarget === num) return '毒';
    if (roleId === 'witch' && witchChoice === 'save' && num === wolfKillTarget) return '救';
    if (roleId === 'anubis' && activeKey === 'scale' && isAnubisScaledTargetLocked(num)) return '⛔';
    for (const [key, targets] of Object.entries(actionTargets)) {
      const idx = targets.indexOf(num);
      if (idx !== -1) {
        if (key === 'kill')         return roleId === 'tengu' ? (idx === 0 ? '①' : '②') : '刀';
        if (key === 'protect')      return '護';
        if (key === 'dreamprotect') return '夢';
        if (key === 'check')        return '查';
        if (key === 'link')         return idx === 0 ? '①' : '②';
        if (key === 'surround')     return '繞';
        if (key === 'ambush')       return '襲';
        if (key === 'hunt')         return '獵';
        if (key === 'scale')        return idx === 0 ? '❶' : '❷';
        if (key === 'swap')         return idx === 0 ? 'A' : 'B';
        if (key === 'explode')      return '爆';
      }
    }
    if ((!rolePositionKnown && members.includes(num)) || pendingRolePlayers.includes(num)) return '★';
    return '';
  };

  // ── 雙身分：從 playerCardMap 取得上下牌角色 ──
  const getTeamColor = (roleId: string): string => {
    const r = ROLES.find(x => x.id === roleId);
    if (!r) return '#888';
    return r.team === 'wolf' ? Colors.wolf : r.team === 'village' ? Colors.village : Colors.neutral;
  };

  const toRoleInfo = (id: string | undefined): RoleInfo | undefined => {
    if (!id) return undefined;
    return { name: ROLES.find(r => r.id === id)?.name ?? '', teamColor: getTeamColor(id) };
  };

  const getDualRoles = (num: number): { upper?: RoleInfo; lower?: RoleInfo } => {
    const cards = playerCardMap[num];
    if (!cards) return {};
    return { upper: toRoleInfo(cards.upper), lower: toRoleInfo(cards.lower) };
  };

  // ── 模式說明 ──
  const getModeLabel = () => {
    if (!hasSelectedRolePosition) return '請先選擇至少一名角色位置';
    if (sealedByMummy) return '被封印';
    if (burnedByFireWolf) return '被燒成民了';
    if (rolePositionKnown && !canUseRoleSkill) return '場上無活躍角色，請手動跳過';
    if (roleId === 'werewolf' && wolfNightParticipants.some(player => shapeshifterMembers.includes(player))) {
      return '變形怪參與狼人行動';
    }
    if (roleId === 'witch') {
      if (witchChoice === 'save') return `💊 解藥 → 救 ${wolfKillTarget}號`;
      if (witchChoice === 'poison') return '☠️ 點選毒藥目標';
      if (members.length > 0) return '選擇是否使用藥水';
      return roleConfig.memberHint;
    }
    if (roleId === 'seer') {
      if (activeKey === 'check') return '🔮 點選查驗目標';
      return roleConfig.memberHint;
    }
    if (roleId === 'hunter' || roleId === 'wolf_king') {
      if (members.length > 0) {
        return deathAbilityStatusPending
          ? '女巫尚未行動，狀態仍待確認'
          : `確認狀態後告知${roleId === 'hunter' ? '獵人' : '狼王'}，完成繼續`;
      }
      return roleConfig.memberHint;
    }
    if (roleId === 'blood_moon')   return bloodMoonActivated ? '🌑 技能已發動' : '選擇是否發動技能';
    if (roleId === 'bear_tamer')   return bearTamerResult === 'growl' ? '🐻 熊叫了！' : bearTamerResult === 'silent' ? '🔕 熊沒有叫' : '主持人確認鄰座結果後記錄';
    if (roleId === 'gravedigger')  return '🪦 向守墓人告知下牌資訊';
    if (roleId === 'sharpshooter') return sharpshooterDeclared ? '🎯 技能已發動' : '選擇是否發動技能';
    if (roleId === 'thief') {
      const r = ROLES.find(x => x.id === thiefChosenRole);
      return r ? `已選：${r.emoji} ${r.name}` : '選擇盜賊拿走的腳色牌';
    }
    if (activeKey === null) return roleConfig.memberHint;
    const def = availableRoleActions.find(a => a.key === activeKey);
    return def ? `↑ 點選${def.label.replace(/^.+?\s/, '')}目標` : roleConfig.memberHint;
  };

  // ── 守墓人：昨日放逐的下牌資訊 ──
  const gravediggerInfo = isDualMode
    ? getGravediggerLowerInfo(lastDayExileInfo, playerCardMap, deadPlayers)
    : null;
  const previewNightDeaths = isDone
    ? computeNightDeaths(
        nightActions,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        prevDreamwalkerTarget,
        cupidLovers,
        gameMode,
        true,
        slaveTraderSlaves,
        fireWolfBurnRecords,
      )
    : [];
  const previewNightDeathState = projectDeathState(
    gameMode,
    deadPlayers,
    upperDeadPlayers,
    previewNightDeaths,
  );
  const previewNightWinResult = isDone
    ? computeWinResult({
        gameMode,
        singleWinRule,
        selectedRoles,
        roleMembersMap,
        deadPlayers: previewNightDeathState.deadPlayers,
        upperDeadPlayers: previewNightDeathState.upperDeadPlayers,
        playerCardMap,
        goldenBabyPlayers,
        fireWolfBurnedPlayers,
        resolutionPhase: 'night',
      })
    : null;
  const displayedWinResult = previewNightWinResult ?? winResult;
  const goHome = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));

  // ── 完成夜晚畫面 ──
  if (isDone) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneEmoji}>🌙</Text>
        <Text style={styles.doneTitle}>夜晚行動完成</Text>
        {displayedWinResult && (
          <View style={[
            styles.winCard,
            { borderColor: displayedWinResult.winner === 'wolf' ? Colors.wolf : Colors.village },
          ]}>
            <Text style={[
              styles.winTitle,
              { color: displayedWinResult.winner === 'wolf' ? Colors.wolf : Colors.village },
            ]}>
              {displayedWinResult.winner === 'wolf' ? '狼人勝利' : '好人勝利'}
            </Text>
            <Text style={styles.winReason}>{displayedWinResult.reason}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            if (displayedWinResult) {
              if (previewNightWinResult) {
                finishNight();
                resetNight();
              }
              goHome();
              return;
            }
            finishNight();
            navigation.navigate('Day');
          }}
        >
          <Text style={styles.doneBtnText}>{displayedWinResult ? '遊戲已結束，回首頁' : '☀️ 進入白天 →'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!role) return null;

  const progress = (currentStep / nightOrder.length) * 100;
  const isLastStep = currentStep === nightOrder.length - 1;
  const seerCheckTarget = actionTargets['check']?.[0];
  const effectiveSeerCheckTarget = applyMagicSwapTarget(seerCheckTarget, currentMagicSwap);
  // 自動判斷查驗結果（需要狼人成員已記錄）
  const autoCheckResult: 'wolf' | 'good' | undefined =
    effectiveSeerCheckTarget !== undefined
      ? (wolfCheckPlayers.includes(effectiveSeerCheckTarget) ? 'wolf' : 'good')
      : undefined;
  const witchSelfSaveBlocked = roleId === 'witch' && wolfKillTarget !== undefined && activeMembers.includes(wolfKillTarget);
  const canSave = !saveUsed && wolfKillTarget !== undefined && !witchSelfSaveBlocked;
  const canPoison = !poisonUsed;
  const goldenBabyCountInvalid =
    roleId === 'golden_baby' &&
    (selectedRoleMembers.length < goldenBabyConfig.min || selectedRoleMembers.length > goldenBabyConfig.max);

  return (
    <View style={styles.container}>
      {/* 進度條 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {displayedWinResult && (
        <View style={[
          styles.activeWinCard,
          { borderColor: displayedWinResult.winner === 'wolf' ? Colors.wolf : Colors.village },
        ]}>
          <Text style={[
            styles.activeWinTitle,
            { color: displayedWinResult.winner === 'wolf' ? Colors.wolf : Colors.village },
          ]}>
            {displayedWinResult.winner === 'wolf' ? '狼人勝利' : '好人勝利'}
          </Text>
          <Text style={styles.activeWinReason}>{displayedWinResult.reason}</Text>
        </View>
      )}

      {/* ── 上半部：腳色 + 號碼格 ── */}
      <View style={styles.topHalf}>
        <View style={styles.roleRow}>
          <Text style={styles.roleEmoji}>{role.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleName, burnedByFireWolf && { color: Colors.danger }]}>{role.name}</Text>
            <Text style={styles.modeLabel}>{getModeLabel()}</Text>
          </View>
          <HeaderMenuButton onBack={handleBack} />
          <Text style={styles.stepBadge}>{currentStep + 1}/{nightOrder.length}</Text>
        </View>

        <View style={styles.grid}>
          {playerNums.map(num => {
            const { bg, border, textColor, dead } = getPlayerStyle(num);
            const label = getPlayerLabel(num);
            const { upper: upperRole, lower: lowerRole } = isDualMode ? getDualRoles(num) : {};
            const isChoosingRolePosition =
              canEditRolePosition &&
              activeKey === null &&
              !(roleId === 'witch' && witchChoice !== null) &&
              !(roleId === 'sharpshooter' && sharpshooterDeclared && sharpshooterWillDie);
            const positionUnavailable =
              isChoosingRolePosition &&
              roleId !== 'golden_baby' &&
              !canAssignNightRolePosition(
                roleId,
                num,
                gameMode,
                playerCardMap,
                upperDeadPlayers,
                deadPlayers,
              );
            const knownRoleMarker =
              !isDualMode &&
              knownRoleMembers.includes(num) &&
              !transformedThiefMembers.includes(num)
                ? role.emoji
                : undefined;
            return (
              <PlayerButton
                key={num}
                num={num}
                size={btnSize}
                bg={bg}
                border={border}
                textColor={textColor}
                label={label !== '' ? label : undefined}
                sublabel={knownRoleMarker}
                isDead={dead}
                isDualMode={isDualMode}
                upperRole={upperRole}
                lowerRole={lowerRole}
                upperRoleTextColor={fireWolfBurnedCards.some(card => card.player === num && card.slot === 'upper') ? Colors.danger : undefined}
                lowerRoleTextColor={fireWolfBurnedCards.some(card => card.player === num && card.slot === 'lower') ? Colors.danger : undefined}
                upperDead={isDualMode && upperDeadPlayers.includes(num)}
                disabled={positionUnavailable}
                onPress={() => togglePlayer(num)}
              />
            );
          })}
        </View>
      </View>

      {/* ── 下半部：行動區 ── */}
      <View style={styles.bottomHalf}>
        {!canUseRoleSkill && (
          <View style={[styles.infoCard, { borderColor: sealedByMummy || burnedByFireWolf ? Colors.warning : Colors.textMuted }]}>
            <Text style={[styles.infoCardTitle, { color: sealedByMummy || burnedByFireWolf ? Colors.warning : Colors.textMuted }]}>
              {sealedByMummy ? '🪦 被封印' : burnedByFireWolf ? '🔥 被燒成民了' : hasSelectedRolePosition ? '⏭️ 場上無活躍角色' : '📍 尚未確認角色位置'}
            </Text>
            <Text style={styles.infoCardBody}>
              {sealedByMummy
                ? '被木乃伊封印'
                : burnedByFireWolf
                ? '火狼已將這張神職牌燒成平民，本晚技能失效'
                : hasSelectedRolePosition
                ? '此角色已死亡或目前不是活躍牌，標記保留，請確認後手動跳過'
                : '請先選擇至少一名角色位置，否則本晚跳過技能'}
            </Text>
          </View>
        )}

        {/* 女巫專用 */}
        {canUseRoleSkill && roleId === 'witch' && (
          <>
            <View style={styles.witchInfo}>
              <Text style={styles.witchInfoText}>
                今晚狼人刀了：
                <Text style={{ color: wolfKillTarget ? Colors.primary : Colors.textDim, fontWeight: 'bold' }}>
                  {wolfKillTarget ? `${wolfKillTarget}號` : '（未刀人）'}
                </Text>
              </Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { borderColor: canSave ? Colors.village : Colors.textMuted, opacity: (!canSave || witchChoice === 'poison') ? 0.4 : 1 },
                  witchChoice === 'save' && { backgroundColor: Colors.village + '30' },
                ]}
                onPress={() => canSave && witchChoice !== 'poison' && setWitchChoice(p => p === 'save' ? null : 'save')}
              >
                <Text style={[styles.actionBtnText, { color: canSave ? Colors.village : Colors.textMuted }]}>
                  {saveUsed ? '💊 解藥（已用完）' : `💊 解藥（救${wolfKillTarget ? ` ${wolfKillTarget}號` : ''}）`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { borderColor: canPoison ? Colors.danger : Colors.textMuted, opacity: (!canPoison || witchChoice === 'save') ? 0.4 : 1 },
                  witchChoice === 'poison' && { backgroundColor: Colors.danger + '30' },
                ]}
                onPress={() => canPoison && witchChoice !== 'save' && setWitchChoice(p => p === 'poison' ? null : 'poison')}
              >
                <Text style={[styles.actionBtnText, { color: canPoison ? Colors.danger : Colors.textMuted }]}>
                  {poisonUsed ? '☠️ 毒藥（已用完）' : '☠️ 毒藥'}
                </Text>
                {witchChoice === 'poison' && poisonTarget && (
                  <Text style={styles.actionSubText}>目標：{poisonTarget}號</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* 預言家專用 */}
        {canUseRoleSkill && roleId === 'seer' && (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#9c27b0' }, activeKey === 'check' && { backgroundColor: '#9c27b030' }]}
                onPress={() => setActiveKey(p => p === 'check' ? null : 'check')}
              >
                <Text style={[styles.actionBtnText, { color: '#9c27b0' }]}>🔮 查驗</Text>
                {seerCheckTarget && <Text style={styles.actionSubText}>目標：{seerCheckTarget}號</Text>}
              </TouchableOpacity>
            </View>
            {autoCheckResult !== undefined && seerCheckTarget !== undefined && (
              <View style={[styles.checkResultCard, { borderColor: autoCheckResult === 'wolf' ? Colors.wolf : Colors.village }]}>
                <Text style={[styles.checkResultText, { color: autoCheckResult === 'wolf' ? Colors.wolf : Colors.village }]}>
                  查驗結果：{seerCheckTarget}號 → {autoCheckResult === 'wolf' ? '狼人陣營 🐺' : '好人陣營 ✅'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* 獵人／狼王死亡技能狀態 */}
        {skillMembers.length > 0 && (roleId === 'hunter' || roleId === 'wolf_king') && (
          deathAbilityStatusPending ? (
            <View style={[styles.infoCard, { borderColor: Colors.warning }]}>
              <Text style={[styles.infoCardTitle, { color: Colors.warning }]}>⏳ 女巫尚未行動</Text>
              <Text style={styles.infoCardBody}>請先完成女巫回合，才能確認白天是否可發動死亡技能</Text>
            </View>
          ) : (
            <>
              {deathAbilityStatuses.map(({ player, status }) => {
                const isHunter = roleId === 'hunter';
                if (status === 'poisoned') {
                  return (
                    <View key={player} style={[styles.infoCard, { borderColor: Colors.danger }]}>
                      <Text style={[styles.infoCardTitle, { color: Colors.danger }]}>❌ {player}號無法發動技能</Text>
                      <Text style={styles.infoCardBody}>{isHunter ? '無法開槍' : '無法發動帶人'}</Text>
                    </View>
                  );
                }
                if (status === 'sealed') {
                  return (
                    <View key={player} style={[styles.infoCard, { borderColor: Colors.textMuted }]}>
                      <Text style={[styles.infoCardTitle, { color: Colors.textMuted }]}>木乃伊封印：{player}號不可發動</Text>
                      <Text style={styles.infoCardBody}>{isHunter ? '獵人不可開槍' : '狼王不可帶人'}</Text>
                    </View>
                  );
                }
                return (
                  <View key={player} style={[styles.infoCard, { borderColor: Colors.village }]}>
                    <Text style={[styles.infoCardTitle, { color: Colors.village }]}>✅ {player}號可以發動技能</Text>
                    <Text style={styles.infoCardBody}>{isHunter ? '可以開槍' : '可以發動帶人'}</Text>
                  </View>
                );
              })}
            </>
          )
        )}

        {/* 血月使徒專用 */}
        {canUseRoleSkill && roleId === 'blood_moon' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: Colors.wolf }, bloodMoonActivated && { backgroundColor: Colors.wolf + '30' }]}
              onPress={() => setBloodMoonActivated(true)}
            >
              <Text style={[styles.actionBtnText, { color: Colors.wolf }]}>🌑 發動技能</Text>
              <Text style={styles.actionSubText}>隔日宣布平安夜，技能延後</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: Colors.textDim }, !bloodMoonActivated && { backgroundColor: Colors.textDim + '20' }]}
              onPress={() => setBloodMoonActivated(false)}
            >
              <Text style={[styles.actionBtnText, { color: Colors.textDim }]}>⏭️ 跳過</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 訓熊師專用 */}
        {canUseRoleSkill && roleId === 'bear_tamer' && (
          <View style={[styles.infoCard, { borderColor: Colors.warning }]}>
            <Text style={[styles.infoCardTitle, { color: Colors.warning }]}>🐻 系統自動計算</Text>
            <Text style={styles.infoCardBody}>確認訓熊師是誰後繼續，夜晚結束時系統根據鄰座角色自動判定熊叫結果，並在結果頁顯示</Text>
          </View>
        )}

        {/* 守墓人專用 */}
        {canUseRoleSkill && roleId === 'gravedigger' && (
          <>
            {!isDualMode ? (
              <Text style={styles.noActionText}>此技能僅在雙身分模式生效</Text>
            ) : !lastDayExileInfo ? (
              <Text style={styles.noActionText}>第一晚無資訊（昨日無放逐）</Text>
            ) : gravediggerInfo === null ? (
              <View style={[styles.infoCard, { borderColor: Colors.textDim }]}>
                <Text style={[styles.infoCardTitle, { color: Colors.textDim }]}>🔇 無資訊</Text>
                <Text style={styles.infoCardBody}>上牌已死，不公布任何資訊</Text>
              </View>
            ) : (
              <View style={[styles.infoCard, { borderColor: gravediggerInfo.isWolf ? Colors.wolf : Colors.village }]}>
                <Text style={[styles.infoCardTitle, { color: gravediggerInfo.isWolf ? Colors.wolf : Colors.village }]}>
                  {gravediggerInfo.isWolf ? '🐺 狼人陣營' : '✅ 好人陣營'}
                </Text>
                <Text style={styles.infoCardBody}>
                  {lastDayExileInfo.player}號被票逐上牌；只公布下牌陣營，不公布角色
                </Text>
              </View>
            )}
          </>
        )}

        {/* 神射手專用 */}
        {canUseRoleSkill && roleId === 'sharpshooter' && (
          sharpshooterUsed ? (
            <View style={[styles.infoCard, { borderColor: Colors.textMuted }]}>
              <Text style={[styles.infoCardTitle, { color: Colors.textMuted }]}>🎯 技能已消耗</Text>
              <Text style={styles.infoCardBody}>神射手技能已在先前發動，本晚無法再使用</Text>
            </View>
          ) : members.length === 0 ? (
            <View style={[styles.infoCard, { borderColor: Colors.textMuted }]}>
              <Text style={[styles.infoCardBody, { color: Colors.textMuted }]}>請先選擇神射手的位置，才能發動技能</Text>
            </View>
          ) : (
            <>
              <View style={[styles.infoCard, { borderColor: Colors.wolf }]}>
                <Text style={[styles.infoCardTitle, { color: Colors.wolf }]}>🐺 活躍牌狼隊判定</Text>
                <Text style={styles.infoCardBody}>
                  {wolfCheckPlayers.length > 0
                    ? `${wolfCheckPlayers.map(player => `${player}號`).join('、')}（包含野孩子）`
                    : '目前沒有已確認為狼隊的活躍牌'}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: Colors.warning }, sharpshooterDeclared && { backgroundColor: Colors.warning + '30' }]}
                  onPress={() => { setSharpshooterDeclared(true); setSharpshooterKillTarget(undefined); }}
                >
                  <Text style={[styles.actionBtnText, { color: Colors.warning }]}>🎯 發動技能</Text>
                  <Text style={styles.actionSubText}>立刻判定；今晚確定死亡才能開槍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: Colors.textDim }, !sharpshooterDeclared && { backgroundColor: Colors.textDim + '20' }]}
                  onPress={() => { setSharpshooterDeclared(false); setSharpshooterKillTarget(undefined); }}
                >
                  <Text style={[styles.actionBtnText, { color: Colors.textDim }]}>⏭️ 跳過</Text>
                </TouchableOpacity>
              </View>
              {sharpshooterDeclared && members.length > 0 && (() => {
                if (sharpshooterWillDie) {
                  return (
                    <>
                      <View style={[styles.infoCard, { borderColor: Colors.warning }]}>
                        <Text style={[styles.infoCardTitle, { color: Colors.warning }]}>🎯 技能觸發！今晚確定死亡</Text>
                        <Text style={styles.infoCardBody}>
                          請直接在上方號碼格選擇開槍目標
                        </Text>
                      </View>
                      {sharpshooterKillTarget !== undefined && (
                        <Text style={styles.noActionText}>已選擇：{sharpshooterKillTarget}號</Text>
                      )}
                    </>
                  );
                }
                return (
                  <View style={[styles.infoCard, { borderColor: Colors.textMuted }]}>
                    <Text style={[styles.infoCardTitle, { color: Colors.textMuted }]}>❌ 技能未觸發</Text>
                    <Text style={styles.infoCardBody}>今晚確定不死，技能消耗但不觸發，無法開槍</Text>
                  </View>
                );
              })()}
            </>
          )
        )}

        {/* 盜賊專用 */}
        {canUseRoleSkill && roleId === 'explorer' && (
          <View style={[styles.infoCard, { borderColor: Colors.village }]}>
            <Text style={[styles.infoCardTitle, { color: Colors.village }]}>🧭 探險家資訊</Text>
            <Text style={styles.infoCardBody}>
              {explorerResult === 'unknown' ? '未知' : `最近的狼：${explorerResult}號`}
            </Text>
          </View>
        )}

        {canUseRoleSkill && roleId === 'spirit_wolf' && actionTargets['spiritcheck']?.[0] !== undefined && (
          <View style={[styles.infoCard, { borderColor: '#9c27b0' }]}>
            <Text style={[styles.infoCardTitle, { color: '#9c27b0' }]}>靈狼查驗結果</Text>
            <Text style={styles.infoCardBody}>
              {actionTargets['spiritcheck'][0]}號：
              {ROLES.find(r => r.id === (
                getEffectiveRoleForPlayer(actionTargets['spiritcheck'][0])
              ))?.name ?? '未知'}
            </Text>
          </View>
        )}

        {canUseRoleSkill && roleId === 'spirit_wolf' && spiritWolfMimic?.roleId === 'witch' && spiritMimicReady && (
          <View style={[styles.infoCard, { borderColor: Colors.village }]}>
            <Text style={[styles.infoCardTitle, { color: Colors.village }]}>靈狼女巫看到的刀口</Text>
            <Text style={styles.infoCardBody}>
              {shamanKnifeTarget ? `薩滿刀：${shamanKnifeTarget}號` : '今晚沒有薩滿刀口'}
            </Text>
          </View>
        )}

        {canUseRoleSkill && roleId === 'mummy' && (
          <>
            <Text style={styles.noActionText}>選擇今晚要封印的神職角色種類</Text>
            <View style={styles.thiefRoleGrid}>
              {mummyRoleOptions.map(r => {
                const optionNightIndex = nightOrder.indexOf(r.id);
                const disabled =
                  optionNightIndex === -1 ||
                  mummyNightIndex === -1 ||
                  optionNightIndex <= mummyNightIndex ||
                  mummySealedRoles.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.thiefRoleBtn,
                      { borderColor: disabled ? Colors.textMuted : Colors.warning, opacity: disabled ? 0.45 : 1 },
                      mummySelectedRole === r.id && { backgroundColor: Colors.warning + '30' },
                    ]}
                    disabled={disabled}
                    onPress={() => setMummySelectedRole(prev => prev === r.id ? null : r.id)}
                  >
                    <Text style={[styles.thiefRoleBtnText, { color: disabled ? Colors.textMuted : Colors.warning }]}>
                      {r.emoji} {r.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {canUseRoleSkill && roleId === 'thief' && (
          <>
            <Text style={styles.noActionText}>選擇盜賊從入局腳色中拿走的腳色牌</Text>
            <View style={styles.thiefRoleGrid}>
              {selectedRoles.filter(r => r.roleId !== 'thief').map(r => ROLES.find(x => x.id === r.roleId)).filter(Boolean).map(r => r!).map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.thiefRoleBtn,
                    { borderColor: r.team === 'wolf' ? Colors.wolf : Colors.village },
                    thiefChosenRole === r.id && { backgroundColor: (r.team === 'wolf' ? Colors.wolf : Colors.village) + '30' },
                  ]}
                  onPress={() => setThiefChosenRole(prev => prev === r.id ? null : r.id)}
                >
                  <Text style={[styles.thiefRoleBtnText, { color: r.team === 'wolf' ? Colors.wolf : Colors.village }]}>
                    {r.emoji} {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* 通用行動按鈕（排除已有特殊 UI 的腳色） */}
        {canUseRoleSkill && roleId !== 'witch' && roleId !== 'seer' && roleId !== 'hunter' && roleId !== 'wolf_king' &&
         roleId !== 'blood_moon' && roleId !== 'bear_tamer' && roleId !== 'gravedigger' &&
         roleId !== 'sharpshooter' && roleId !== 'thief' && roleId !== 'explorer' && roleId !== 'mummy' && (
          <>
            {availableRoleActions.length > 0 && skillMembers.length === 0 && (
              <View style={[styles.infoCard, { borderColor: Colors.textMuted }]}>
                <Text style={[styles.infoCardBody, { color: Colors.textMuted }]}>請先選擇{roleConfig.memberHint.replace('點選', '').replace('是誰', '')}的位置，才能發動技能</Text>
              </View>
            )}
            {availableRoleActions.length > 0 && skillMembers.length > 0 ? (
              <View style={styles.actionRow}>
                {availableRoleActions.map(def => {
                  const targets = actionTargets[def.key] ?? [];
                  const monkVoteCardLabel = monkVoteCard
                    ? `${monkVoteCard.player}號${gameMode === 'dual' ? (monkVoteCard.slot === 'upper' ? '上牌' : '下牌') : ''}`
                    : effectiveMonkVoteTarget !== undefined
                    ? `${effectiveMonkVoteTarget}號`
                    : '無有效票型';
                  return (
                    <TouchableOpacity
                      key={def.key}
                      style={[styles.actionBtn, { borderColor: def.color }, activeKey === def.key && { backgroundColor: def.color + '30' }]}
                      onPress={() => setActiveKey(p => p === def.key ? null : def.key)}
                    >
                      <Text style={[styles.actionBtnText, { color: roleId === 'tengu' && def.key === 'kill' && tenguMaxKills === 0 ? Colors.textMuted : def.color }]}>
                        {roleId === 'tengu' && def.key === 'kill'
                          ? tenguMaxKills === 0 ? '⚡ 擊殺（本晚跳過）' : `⚡ 擊殺（最多${tenguMaxKills}人）`
                          : roleId === 'blind_swordsman' && def.key === 'monkstrike'
                          ? `🙏 依僧侶票擊殺：${monkVoteCardLabel}`
                          : def.label}
                      </Text>
                      {roleId === 'tengu' && def.key === 'kill' && (
                        <Text style={styles.actionSubText}>
                          {tenguMaxKills === 1 ? '⚠️ 其他狼人角色牌已全滅，可出一刀' : '仍有其他狼人角色牌未死亡，本晚不出刀'}
                        </Text>
                      )}
                      {roleId === 'guard' && def.key === 'protect' && lastGuardProtect !== undefined && (
                        <Text style={styles.actionSubText}>⛔ {lastGuardProtect}號 本晚不可再守</Text>
                      )}
                      {roleId === 'crow' && def.key === 'surround' && (
                        <Text style={styles.actionSubText}>⛔ 烏鴉不可選自己</Text>
                      )}
                      {targets.length > 0 && (
                        <Text style={styles.actionSubText}>目標：{targets.map(n => `${n}號`).join(' / ')}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : availableRoleActions.length === 0 ? (
              <Text style={styles.noActionText}>此腳色無夜間行動，確認後繼續</Text>
            ) : null}
            {roleId === 'fire_wolf' && actionTargets['burn']?.[0] !== undefined && (() => {
              const target = actionTargets['burn'][0];
              const targetRole = gameMode === 'dual'
                ? playerCardMap[target]?.[upperDeadPlayers.includes(target) ? 'lower' : 'upper']
                : getOriginalSingleRoleForPlayer(target);
              if (!isGodRole(targetRole)) return null;
              return (
                <View style={[styles.infoCard, { borderColor: Colors.danger }]}>
                  <Text style={[styles.infoCardTitle, { color: Colors.danger }]}>🔥 {target}號被燒成民了</Text>
                  <Text style={styles.infoCardBody}>該神職本晚技能立即失效；若已行動，先前行動會在確認後撤銷</Text>
                </View>
              );
            })()}
          </>
        )}

        <TouchableOpacity
          style={[styles.nextBtn, goldenBabyCountInvalid && styles.nextBtnDisabled]}
          onPress={displayedWinResult ? goHome : handleNext}
          disabled={goldenBabyCountInvalid}
        >
          <Text style={styles.nextBtnText}>
            {displayedWinResult
              ? '遊戲已結束'
              : !canUseRoleSkill
              ? isLastStep ? '跳過 → 結束夜晚' : '跳過 → 下一位'
              : isLastStep ? '完成 → 結束夜晚' : '完成 → 下一位'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  progressBar: { height: 3, backgroundColor: Colors.surfaceLight },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  activeWinCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    gap: 4,
  },
  activeWinTitle: { fontSize: 18, fontWeight: 'bold' },
  activeWinReason: { color: Colors.textDim, fontSize: 12, textAlign: 'center' },

  topHalf: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  roleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  roleEmoji: { fontSize: 26 },
  roleName: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },
  modeLabel: { color: Colors.primary, fontSize: 11, marginTop: 1 },
  stepBadge: { color: Colors.textDim, fontSize: 12 },
  toolColumn: { alignItems: 'flex-end', gap: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  playerBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  playerNum: { fontSize: 17, fontWeight: 'bold' },
  playerTag: { fontSize: 9, fontWeight: 'bold', marginTop: 1 },
  deadBtn: { opacity: 0.35 },

  bottomHalf: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceLight,
    backgroundColor: Colors.surface,
    padding: 12,
    paddingBottom: 20,
    gap: 8,
  },

  witchInfo: { alignItems: 'center', paddingVertical: 4 },
  witchInfoText: { color: Colors.textDim, fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: Colors.surfaceLight,
    gap: 3,
  },
  actionBtnText: { fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  actionSubText: { color: Colors.textDim, fontSize: 11 },

  resultBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 11,
    alignItems: 'center', borderWidth: 2, borderColor: Colors.surfaceLight, backgroundColor: Colors.surfaceLight,
  },
  resultBtnText: { color: Colors.text, fontWeight: 'bold', fontSize: 13 },

  checkResultCard: {
    borderRadius: 10, borderWidth: 2, padding: 10, alignItems: 'center',
  },
  checkResultText: { fontWeight: 'bold', fontSize: 14 },

  noActionText: { color: Colors.textDim, textAlign: 'center', fontSize: 13, paddingVertical: 8 },

  infoCard: {
    borderRadius: 10, borderWidth: 2, padding: 12, alignItems: 'center', gap: 4,
  },
  infoCardTitle: { fontWeight: 'bold', fontSize: 15 },
  infoCardBody: { color: Colors.textDim, fontSize: 13 },

  thiefRoleBtn: {
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 2, backgroundColor: Colors.surfaceLight,
  },
  thiefRoleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thiefRoleBtnText: { fontSize: 12, fontWeight: 'bold' },

  nextBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  nextBtnDisabled: { backgroundColor: Colors.textMuted, opacity: 0.6 },
  nextBtnText: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },

  doneContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneEmoji: { fontSize: 72, marginBottom: 16 },
  doneTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginBottom: 40 },
  winCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    gap: 6,
  },
  winTitle: { fontSize: 22, fontWeight: 'bold' },
  winReason: { color: Colors.textDim, fontSize: 13, textAlign: 'center' },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: 13, paddingVertical: 16, alignItems: 'center', width: '100%' },
  doneBtnText: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
});

