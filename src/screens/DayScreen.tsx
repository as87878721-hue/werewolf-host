import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions,
} from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { ROLES } from '../data/roles';
import {
  useGameStore,
  computeNightDeaths,
  getMagicSwap,
  applyMagicSwapTarget,
  getEffectiveDreamwalkerTarget,
  resolveDreamwalkerCarryDeaths,
  resolveAutomaticDeathRounds,
  getDeathSkillTriggers,
  resolveTimedDeathSkillTarget,
  computeWinResult,
  projectDeathState,
  WinResult,
} from '../store/gameStore';
import PlayerButton, { RoleInfo } from '../components/PlayerButton';
import HeaderMenuButton from '../components/HeaderMenuButton';
import { hasNightDeathStepTransientState } from '../utils/dayBackState';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Day'>;
type NightAbility = 'none' | 'hunter' | 'wolfking';
type ExileAbility = 'none' | 'hunter' | 'wolfking' | 'idiot';
type BadgeAction  = 'handover' | 'tear' | null;
type KnightResult = 'wolf' | 'good' | null;
type SpeechDeathNotice = 'self_destruct' | 'knight_good' | 'knight_wolf' | null;

export default function DayScreen() {
  const navigation = useNavigation<Nav>();
  const {
    gameMode, playerCount, currentNight, selectedRoles, nightOrder,
    nightActions, nightHistory, deadPlayers, upperDeadPlayers, playerCardMap, roleMembersMap,
    singleWinRule, winResult,
    sheriffPlayer, lostVotePlayers, idiotFlippedPlayers,
    cupidLovers, bishopHolder, knightUsed, goldenBabyPlayers, monkVoteTarget, slaveTraderSlaves, fireWolfBurnedPlayers,
    setSheriff, endDay, setBishopHolder, setKnightUsed, setRoleMembers, setPlayerCardRole, setNightStep, resetGameProgress,
    setMonkVoteTarget, setMonkVoteCard, captureDayStepSnapshot, restoreDayStepSnapshot,
  } = useGameStore();

  const isDualMode = gameMode === 'dual';
  const { width } = useWindowDimensions();
  const totalPlayers = playerCount;
  const playerNums = Array.from({ length: totalPlayers }, (_, i) => i + 1);
  const COLS = totalPlayers > 12 ? 5 : 4;
  const GAP = 6;
  const effectiveWidth = Math.min(width, 390);
  const btnSize = Math.min(72, Math.floor((effectiveWidth - 32 - (COLS - 1) * GAP) / COLS));

  // Actual deaths (regardless of blood moon)
  // finishNight added current night at -1; previous night's dreamwalker target is at -2
  const prevDreamwalkerTarget = getEffectiveDreamwalkerTarget(nightHistory.at(-2)?.actions ?? []);
  const directNightDeaths = computeNightDeaths(
    nightActions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    prevDreamwalkerTarget,
    cupidLovers,
    gameMode,
    false,
    slaveTraderSlaves,
  );

  // 血月：上一晚是否發動（延後夜晚資訊與夜晚死亡結算）
  const bloodMoonActivated = nightActions.find(a => a.roleId === 'blood_moon')?.bloodMoonActivated ?? false;
  const bearTamerInGame = selectedRoles.some(entry => entry.roleId === 'bear_tamer');
  // 訓熊師真實結果（血月發動時延後公布）
  const bearTamerResult = nightActions.find(a => a.roleId === 'bear_tamer')?.bearTamerResult;

  const currentMagicSwap = getMagicSwap(nightActions);

  // 烏鴉環繞：次日不可被投票
  const crowSurroundTarget = applyMagicSwapTarget(
    nightActions.find(a => a.roleId === 'crow')?.surroundTarget,
    currentMagicSwap,
  );
  const resolvedNightDeathRounds = resolveAutomaticDeathRounds(
    directNightDeaths,
    'night',
    nightActions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    deadPlayers,
    prevDreamwalkerTarget,
    cupidLovers,
    gameMode,
  );
  // 血月發動時，真實夜晚死亡延後到放逐結果後才套用。
  const initialNightDeathRounds = bloodMoonActivated ? [] : resolvedNightDeathRounds;
  const [nightDeathRounds, setNightDeathRounds] = useState<number[][]>(initialNightDeathRounds);
  const [handledNightDeathSkills, setHandledNightDeathSkills] = useState<number[]>([]);
  const [nightDeathSkillTarget, setNightDeathSkillTarget] = useState<number | null>(null);
  const [nightDeathSkillBlocked, setNightDeathSkillBlocked] = useState<number | null>(null);
  const nightChainDeaths = [...new Set(nightDeathRounds.flat())];
  const pendingNightDeathSkill = getDeathSkillTriggers(
    nightDeathRounds,
    'night',
    nightActions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    gameMode,
  ).find(trigger => !handledNightDeathSkills.includes(trigger.player));
  const nightChainComplete = pendingNightDeathSkill === undefined;

  const getDeathRole = (p: number): string | undefined => {
    if (isDualMode) {
      return upperDeadPlayers.includes(p) ? playerCardMap[p]?.lower : playerCardMap[p]?.upper;
    }
    return undefined;
  };

  const revealableRoles = selectedRoles
    .filter(entry => entry.roleId !== 'golden_baby')
    .map(entry => ROLES.find(role => role.id === entry.roleId))
    .filter((role): role is (typeof ROLES)[number] => Boolean(role));

  // 雙身分白天有效身分：上牌已死（含昨晚剛死）→ 下牌；否則 → 上牌
  const getActiveDayRole = (p: number): string | undefined => {
    if (!isDualMode) return undefined;
    const upperIsDead =
      upperDeadPlayers.includes(p) ||
      (nightChainComplete && nightChainDeaths.includes(p));
    return upperIsDead ? playerCardMap[p]?.lower : playerCardMap[p]?.upper;
  };

  const sheriffDiedLastNight = sheriffPlayer !== null && nightChainDeaths.includes(sheriffPlayer);
  const shouldShowSheriffStep = currentNight === 1 || sheriffDiedLastNight;

  useEffect(() => {
    navigation.setOptions({
      title: `第 ${currentNight} 天`,
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

  // 0=警長  1=公布死亡  2=發言  3=投票  4=放逐結果
  const [step, setStep] = useState(shouldShowSheriffStep ? 0 : 1);

  const clearDayStepState = (fromStep: number) => {
    restoreDayStepSnapshot(fromStep);
    if (fromStep === 0) {
      setBadgeAction(null);
      setBadgeRecipient(null);
      setLocalSheriff(() => {
        if (!sheriffPlayer) return null;
        if (nightChainDeaths.includes(sheriffPlayer) || deadPlayers.includes(sheriffPlayer)) return null;
        return sheriffPlayer;
      });
    }
    if (fromStep >= 4) {
      setDayResolvedWinResult(null);
      setExileBadgeAction(null);
      setExileBadgeRecipient(null);
      setExileBadgeResolved(false);
      setExileAbility('none');
      setExileAbilityTarget(null);
      setExileAbilityResolved(false);
      setBmHunterTarget(null);
      setBmHunterResolved(false);
      setBmWolfKingTarget(null);
      setBmWolfKingResolved(false);
      setBloodMoonDeathsAnnounced(false);
    }
    if (fromStep >= 3) {
      setDayResolvedWinResult(null);
      setExiledPlayer(null);
      setMonkVoteMode(false);
      setMonkVoteTarget(null);
      setMonkVoteCard(null);
      setDayDeathRounds([]);
      setHandledDayDeathSkills([]);
      setDayDeathSkillTarget(null);
    }
    if (fromStep >= 2) {
      setDayResolvedWinResult(null);
      setPendingSelfDestruct(null);
      setLastWordsPlayer(null);
      setSpeechDeaths([]);
      setSpeechAbility('none');
      setSpeechAbilityTarget(null);
      setSpeechAbilityResolved(false);
      setSpeechAbilityKills([]);
      setWwBringTarget(null);
      setWwBringResolved(false);
      setDayDeathRounds([]);
      setHandledDayDeathSkills([]);
      setDayDeathSkillTarget(null);
      setSpeechBadgeAction(null);
      setSpeechBadgeRecipient(null);
      setSpeechBadgeResolved(false);
      setSpeechRevealPlayer(null);
      setSpeechDeathNotice(null);
      setKnightDuelActive(false);
      setKnightPlayer(null);
      setKnightTarget(null);
      setKnightResult(null);
      setKnightDuelResolved(false);
      setKnightDuelKills([]);
      setKnightEndsDay(false);
    }
    if (fromStep >= 1) {
      setDayResolvedWinResult(null);
      setNightDeathRounds(initialNightDeathRounds);
      setHandledNightDeathSkills([]);
      setNightDeathSkillTarget(null);
      setNightDeathSkillBlocked(null);
      setNightDeathBadgeAction(null);
      setNightDeathBadgeRecipient(null);
      setNightDeathBadgeResolved(false);
      setBishopTriggerStep(null);
      setBishopRevealTarget(null);
      setBishopResolved(false);
    }
  };

  // Sheriff
  const [localSheriff, setLocalSheriff] = useState<number | null>(() => {
    if (!sheriffPlayer) return null;
    if (nightChainDeaths.includes(sheriffPlayer) || deadPlayers.includes(sheriffPlayer)) return null;
    return sheriffPlayer;
  });

  // Step 0: badge handover when sheriff died last night
  const [badgeAction, setBadgeAction] = useState<BadgeAction>(null);
  const [badgeRecipient, setBadgeRecipient] = useState<number | null>(null);

  // Step 1: 夜晚摘要展開狀態
  const [showNightSummary, setShowNightSummary] = useState(false);

  // Badge when localSheriff is in effectiveNightDeaths（含步驟0新當選但昨晚牌已死）
  const [nightDeathBadgeAction, setNightDeathBadgeAction] = useState<BadgeAction>(null);
  const [nightDeathBadgeRecipient, setNightDeathBadgeRecipient] = useState<number | null>(null);
  const [nightDeathBadgeResolved, setNightDeathBadgeResolved] = useState(false);

  // Step 2: speech phase
  const [pendingSelfDestruct, setPendingSelfDestruct] = useState<number | null>(null);
  const [lastWordsPlayer, setLastWordsPlayer] = useState<number | null>(null);
  const [speechDeaths, setSpeechDeaths] = useState<number[]>([]);
  const [speechAbility, setSpeechAbility] = useState<NightAbility>('none');
  const [speechAbilityTarget, setSpeechAbilityTarget] = useState<number | null>(null);
  const [speechAbilityResolved, setSpeechAbilityResolved] = useState(false);
  const [speechAbilityKills, setSpeechAbilityKills] = useState<number[]>([]);
  // 白狼王白天帶人
  const [wwBringTarget, setWwBringTarget] = useState<number | null>(null);
  const [wwBringResolved, setWwBringResolved] = useState(false);
  const [dayDeathRounds, setDayDeathRounds] = useState<number[][]>([]);
  const [handledDayDeathSkills, setHandledDayDeathSkills] = useState<number[]>([]);
  const [dayDeathSkillTarget, setDayDeathSkillTarget] = useState<number | null>(null);
  // Badge when sheriff self-destructs
  const [speechBadgeAction, setSpeechBadgeAction] = useState<BadgeAction>(null);
  const [speechBadgeRecipient, setSpeechBadgeRecipient] = useState<number | null>(null);
  const [speechBadgeResolved, setSpeechBadgeResolved] = useState(false);
  const [speechRevealPlayer, setSpeechRevealPlayer] = useState<number | null>(null);
  const [speechDeathNotice, setSpeechDeathNotice] = useState<SpeechDeathNotice>(null);

  // Step 3: exile (null=未選, undefined=流票, number=放逐對象)
  const [exiledPlayer, setExiledPlayer] = useState<number | null | undefined>(null);
  const [monkVoteMode, setMonkVoteMode] = useState(false);

  // Step 4: badge handover when sheriff is exiled
  const [exileBadgeAction, setExileBadgeAction] = useState<BadgeAction>(null);
  const [exileBadgeRecipient, setExileBadgeRecipient] = useState<number | null>(null);
  const [exileBadgeResolved, setExileBadgeResolved] = useState(false);

  // Step 4: exile ability (hunter/wolf king/idiot)
  const [exileAbility, setExileAbility] = useState<ExileAbility>('none');
  const [exileAbilityTarget, setExileAbilityTarget] = useState<number | null>(null);
  const [exileAbilityResolved, setExileAbilityResolved] = useState(false);

  // 主教：查驗並傳遞技能 (step 1 and step 4)
  const [bishopTriggerStep, setBishopTriggerStep] = useState<1 | 4 | null>(null);
  const [bishopRevealTarget, setBishopRevealTarget] = useState<number | null>(null);
  const [bishopResolved, setBishopResolved] = useState(false);

  // 騎士：白天決鬥 (step 2)
  const [knightDuelActive, setKnightDuelActive] = useState(false);
  const [knightPlayer, setKnightPlayer] = useState<number | null>(null);
  const [knightTarget, setKnightTarget] = useState<number | null>(null);
  const [knightResult, setKnightResult] = useState<KnightResult>(null);
  const [knightDuelResolved, setKnightDuelResolved] = useState(false);
  const [knightDuelKills, setKnightDuelKills] = useState<number[]>([]);
  const [knightEndsDay, setKnightEndsDay] = useState(false);

  // 血月延後技能觸發（step 4）
  const [bloodMoonDeathsAnnounced, setBloodMoonDeathsAnnounced] = useState(false);
  const [bmHunterTarget, setBmHunterTarget] = useState<number | null>(null);
  const [bmHunterResolved, setBmHunterResolved] = useState(false);
  const [bmWolfKingTarget, setBmWolfKingTarget] = useState<number | null>(null);
  const [bmWolfKingResolved, setBmWolfKingResolved] = useState(false);
  const [dayResolvedWinResult, setDayResolvedWinResult] = useState<WinResult | null>(null);

  useEffect(() => {
    captureDayStepSnapshot(step);
  }, [captureDayStepSnapshot, step]);

  const handleBack = () => {
    const shouldClearNightDeathStep = hasNightDeathStepTransientState({
      nightDeathRounds,
      initialNightDeathRounds,
      handledNightDeathSkills,
      nightDeathSkillTarget,
      nightDeathSkillBlocked,
      nightDeathBadgeAction,
      nightDeathBadgeRecipient,
      nightDeathBadgeResolved,
      bishopTriggerStep,
      bishopRevealTarget,
      bishopResolved,
    });

    if (step === 0) {
      setNightStep(Math.max(nightOrder.length - 1, 0));
      navigation.goBack();
    } else if (step === 1 && shouldClearNightDeathStep) {
      clearDayStepState(1);
    } else if (step === 1 && !shouldShowSheriffStep) {
      setNightStep(Math.max(nightOrder.length - 1, 0));
      navigation.goBack();
    } else if (
      step === 2 &&
      (
        pendingSelfDestruct !== null ||
        lastWordsPlayer !== null ||
        speechDeathNotice !== null ||
        speechDeaths.length > 0 ||
        dayDeathRounds.length > 0 ||
        handledDayDeathSkills.length > 0 ||
        knightDuelActive ||
        knightDuelResolved ||
        knightDuelKills.length > 0
      )
    ) {
      clearDayStepState(2);
    } else if (
      step === 3 &&
      (exiledPlayer !== null || monkVoteMode || monkVoteTarget !== null)
    ) {
      clearDayStepState(3);
    } else if (step === 4) {
      clearDayStepState(4);
      setStep(3);
    } else {
      clearDayStepState(step - 1);
      setStep(previous => Math.max(previous - 1, 0));
    }
  };

  const dayPhaseUpperDeadPlayers = [
    ...new Set([...upperDeadPlayers, ...nightChainDeaths]),
  ];
  const dayChainDeaths = [...new Set(dayDeathRounds.flat())];
  const resolveBloodMoonSkillTarget = (target: number | null) => target === null
    ? undefined
    : resolveTimedDeathSkillTarget(
        target,
        'night',
        nightActions,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        prevDreamwalkerTarget,
        gameMode,
      );
  const resolvedBmHunterTarget = resolveBloodMoonSkillTarget(bmHunterTarget);
  const resolvedBmWolfKingTarget = resolveBloodMoonSkillTarget(bmWolfKingTarget);
  const extraDirectDayDeathRounds = [
    ...knightDuelKills,
    ...(bmHunterResolved && resolvedBmHunterTarget !== undefined ? [resolvedBmHunterTarget] : []),
    ...(bmWolfKingResolved && resolvedBmWolfKingTarget !== undefined ? [resolvedBmWolfKingTarget] : []),
  ].map(player => [player]);
  const dayDeathTriggerRounds = [
    ...dayDeathRounds,
    ...extraDirectDayDeathRounds,
  ];
  const pendingDayDeathSkill = getDeathSkillTriggers(
    dayDeathTriggerRounds,
    'day',
    nightActions,
    roleMembersMap,
    playerCardMap,
    dayPhaseUpperDeadPlayers,
    gameMode,
  ).find(trigger => !handledDayDeathSkills.includes(trigger.player));

  const directDayDeaths = [...new Set([
    ...dayChainDeaths,
    ...extraDirectDayDeathRounds.flat(),
  ])];
  const resolvedDayDeaths = resolveDreamwalkerCarryDeaths(
    directDayDeaths,
    nightActions,
    roleMembersMap,
    playerCardMap,
    upperDeadPlayers,
    nightChainDeaths,
  );
  // 血月延後結算時，先排除白天已死亡者，再重新建立夜晚死亡連鎖。
  // 這可避免已在白天死亡的原始目標仍觸發殉情、夢遊者等夜晚連鎖。
  const delayedNightDeathRounds = bloodMoonActivated
    ? resolveAutomaticDeathRounds(
        directNightDeaths,
        'night',
        nightActions,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        deadPlayers,
        prevDreamwalkerTarget,
        cupidLovers,
        gameMode,
        resolvedDayDeaths,
      )
    : [];
  const delayedNightDeaths = [...new Set(delayedNightDeathRounds.flat())];
  const settledNightDeaths = bloodMoonActivated && step >= 4
    ? delayedNightDeaths
    : nightChainDeaths;
  const dreamwalkerCarryDeaths = resolvedDayDeaths.filter(p => !directDayDeaths.includes(p));
  const previewDeaths = [
    ...settledNightDeaths,
    ...resolvedDayDeaths,
  ];
  const previewDeathState = projectDeathState(
    gameMode,
    deadPlayers,
    upperDeadPlayers,
    previewDeaths,
  );
  const visualDeathState = step >= 1
    ? previewDeathState
    : { deadPlayers, upperDeadPlayers };

  // 公布死訊前（step 0 警長競選）：死亡尚未生效，所有非前一局確認死亡者皆可競選
  const sheriffCandidates = playerNums.filter(p => !deadPlayers.includes(p));

  // Alive players（死亡公布後使用）
  // 雙身分：昨晚上牌死 → 以下牌繼續，有全程白天參與權
  const aliveNums = playerNums.filter(p => {
    if (deadPlayers.includes(p)) return false;
    if (resolvedDayDeaths.includes(p)) return false;
    if (nightChainDeaths.includes(p)) {
      if (isDualMode && !upperDeadPlayers.includes(p)) return true;
      return false;
    }
    return true;
  });

  // ── Role detection helpers ─────────────────────────────────────────────
  const hasActiveRole = (p: number, roleId: string): boolean => {
    if (isDualMode) return getActiveDayRole(p) === roleId;
    return (roleMembersMap[roleId] ?? []).includes(p);
  };

  const isActiveWolf = (p: number): boolean => {
    const wolfTeamIds = new Set(ROLES.filter(r => r.team === 'wolf').map(r => r.id));
    if (isDualMode) {
      const active = getActiveDayRole(p);
      return active !== undefined && wolfTeamIds.has(active);
    }
    for (const [rid, mems] of Object.entries(roleMembersMap)) {
      if (wolfTeamIds.has(rid) && (mems ?? []).includes(p)) return true;
    }
    return false;
  };

  const appendDayDeathRounds = (initialDeaths: number[]) => {
    setDayDeathRounds(previous => {
      const existingDeaths = previous.flat();
      const addedRounds = resolveAutomaticDeathRounds(
        initialDeaths,
        'day',
        nightActions,
        roleMembersMap,
        playerCardMap,
        dayPhaseUpperDeadPlayers,
        deadPlayers,
        prevDreamwalkerTarget,
        cupidLovers,
        gameMode,
        existingDeaths,
      );
      return addedRounds.length > 0 ? [...previous, ...addedRounds] : previous;
    });
  };

  // Bishop: detect current holder's death
  const currentBishopHolder = bishopHolder;
  const bishopInGame = selectedRoles.some(r => r.roleId === 'bishop');
  const bishopDiedNight = currentBishopHolder !== null &&
    nightChainDeaths.includes(currentBishopHolder) && !bishopResolved;
  const bishopDiedExile = currentBishopHolder !== null &&
    typeof exiledPlayer === 'number' && exiledPlayer === currentBishopHolder && !bishopResolved;
  const bishopLastWords = bishopInGame && currentBishopHolder !== null &&
    lastWordsPlayer === currentBishopHolder && !bishopResolved;
  const bishopDiedDayChain = bishopInGame && currentBishopHolder !== null &&
    dayChainDeaths.includes(currentBishopHolder) && !bishopResolved;

  // 主教持有者自動偵測：所有神職夜晚睜眼，系統已知誰持有主教活躍牌
  useEffect(() => {
    if (!bishopInGame || currentBishopHolder !== null || bishopResolved) return;
    let holder: number | undefined;
    if (isDualMode) {
      // First check alive players, then fallback to this-night deaths (upper card just died)
      holder = [...aliveNums, ...nightChainDeaths].find(p => {
        const cards = playerCardMap[p];
        if (!cards) return false;
        return cards.upper === 'bishop';
      });
    } else {
      const bishopMembers = roleMembersMap['bishop'] ?? [];
      holder = bishopMembers.find(p => aliveNums.includes(p))
             ?? bishopMembers.find(p => nightChainDeaths.includes(p));
    }
    if (holder !== undefined) setBishopHolder(holder);
  }, [bishopInGame, currentBishopHolder, bishopResolved]);

  // 白痴第一次被票逐自動翻牌存活（強制，非選填）
  useEffect(() => {
    if (step !== 4 || typeof exiledPlayer !== 'number') return;
    if (exileAbilityResolved || exileAbility !== 'none') return;
    if (idiotFlippedPlayers.includes(exiledPlayer)) return;
    const isIdiot = isDualMode
      ? getActiveDayRole(exiledPlayer) === 'idiot'
      : (roleMembersMap['idiot'] ?? []).includes(exiledPlayer);
    if (isIdiot) {
      setExileAbility('idiot');
      setExileAbilityResolved(true);
    }
  }, [step, exiledPlayer]);

  // 血月延後死亡仍屬夜晚死亡，沿用夜晚的毒殺、木乃伊封印等技能判定。
  const bloodMoonDeathSkillTriggers = bloodMoonActivated
    ? getDeathSkillTriggers(
        delayedNightDeathRounds,
        'night',
        nightActions,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        gameMode,
      )
    : [];
  const bmHunterPlayer = bloodMoonDeathSkillTriggers.find(trigger => trigger.roleId === 'hunter')?.player;
  const bmWolfKingPlayer = bloodMoonDeathSkillTriggers.find(trigger => trigger.roleId === 'wolf_king')?.player;
  const bishopDiedBloodMoon = bishopInGame && bloodMoonActivated &&
    currentBishopHolder !== null && delayedNightDeaths.includes(currentBishopHolder) && !bishopResolved;
  const lastWordsRoleForPreview = lastWordsPlayer !== null
    ? isDualMode
      ? getActiveDayRole(lastWordsPlayer)
      : Object.entries(roleMembersMap).find(([, members]) => (members ?? []).includes(lastWordsPlayer))?.[0]
    : undefined;
  const whiteWolfBringChainComplete =
    lastWordsRoleForPreview !== 'white_wolf' ||
    wwBringResolved;
  const bloodMoonDeathChainComplete =
    !bloodMoonActivated ||
    step < 4 ||
    (bloodMoonDeathsAnnounced &&
     (bmHunterPlayer === undefined || bmHunterResolved) &&
     (bmWolfKingPlayer === undefined || bmWolfKingResolved));
  const dayDeathChainComplete =
    step >= 1 &&
    nightChainComplete &&
    pendingDayDeathSkill === undefined &&
    pendingSelfDestruct === null &&
    whiteWolfBringChainComplete &&
    bloodMoonDeathChainComplete &&
    !(step === 2 && knightDuelActive);
  const computeCurrentDayWinResult = (extraDeaths: number[] = []) => {
    const deathState = extraDeaths.length > 0
      ? projectDeathState(
          gameMode,
          deadPlayers,
          upperDeadPlayers,
          [...settledNightDeaths, ...new Set([...resolvedDayDeaths, ...extraDeaths])],
        )
      : previewDeathState;
    return computeWinResult({
      gameMode,
      singleWinRule,
      selectedRoles,
      roleMembersMap,
      deadPlayers: deathState.deadPlayers,
      upperDeadPlayers: deathState.upperDeadPlayers,
      playerCardMap,
      goldenBabyPlayers,
      fireWolfBurnedPlayers,
      resolutionPhase: 'day',
    });
  };
  const previewWinResult = dayDeathChainComplete ? computeCurrentDayWinResult() : null;
  const displayedWinResult = dayResolvedWinResult ?? previewWinResult ?? winResult;
  const stopIfDayWin = (extraDeaths: number[] = []): boolean => {
    const canCheckWithExtraDeaths =
      extraDeaths.length > 0 &&
      step >= 1 &&
      nightChainComplete &&
      pendingDayDeathSkill === undefined &&
      pendingSelfDestruct === null &&
      whiteWolfBringChainComplete &&
      bloodMoonDeathChainComplete;
    if (!dayDeathChainComplete && !canCheckWithExtraDeaths) return false;
    const result = computeCurrentDayWinResult(extraDeaths);
    if (!result) return false;
    setDayResolvedWinResult(result);
    return true;
  };

  // Knight: detect if in game
  const knightInGame = selectedRoles.some(r => r.roleId === 'knight');

  // Tengu: detect if died this day phase
  const tenguDiedThisPhase = (() => {
    const allDeadSoFar = [...settledNightDeaths, ...resolvedDayDeaths];
    return allDeadSoFar.some(p => hasActiveRole(p, 'tengu') || (roleMembersMap['tengu'] ?? []).includes(p));
  })();

  // ── Self-destruct helpers ──────────────────────────────────────────────
  const canSelfDestruct = (n: number): boolean => {
    const role = isDualMode
      ? getActiveDayRole(n)
      : Object.entries(roleMembersMap).find(([, members]) => (members ?? []).includes(n))?.[0];
    if (!role) return false;
    const def = ROLES.find(r => r.id === role);
    return def?.team === 'wolf' || role === 'old_rogue';
  };

  const selfDestructEndsDay = (n: number): boolean => {
    const role = isDualMode
      ? getActiveDayRole(n)
      : Object.entries(roleMembersMap).find(([, members]) => (members ?? []).includes(n))?.[0];
    return ROLES.find(r => r.id === role)?.team === 'wolf';
  };

  const getSpeechRole = (n: number): string | undefined => {
    if (isDualMode) return getActiveDayRole(n);
    return Object.entries(roleMembersMap).find(([, members]) => (members ?? []).includes(n))?.[0];
  };

  const getSpeechRoleSlot = (n: number): 'upper' | 'lower' => {
    if (!isDualMode) return 'upper';
    const upperIsDead =
      upperDeadPlayers.includes(n) ||
      (nightChainComplete && nightChainDeaths.includes(n));
    return upperIsDead ? 'lower' : 'upper';
  };

  const handleWolfSelfDestructEnd = (finalSheriff: number | null, extraDayKills: number[] = []) => {
    if (stopIfDayWin(extraDayKills)) return;
    if (bloodMoonActivated) {
      setLocalSheriff(finalSheriff);
      setExiledPlayer(undefined);
      setLastWordsPlayer(null);
      setStep(4);
      return;
    }
    setSheriff(finalSheriff);
    endDay({
      exiledPlayer: undefined,
      isIdiotFlip: false,
      nightChainDeaths: bloodMoonActivated ? delayedNightDeaths : nightChainDeaths,
      dayKills: [...dayChainDeaths, ...extraDayKills, ...knightDuelKills],
    });
    navigation.navigate('Night');
  };

  // ── Role info helpers ──────────────────────────────────────────────────
  const toRoleInfo = (id: string | undefined): RoleInfo | undefined => {
    if (!id) return undefined;
    const r = ROLES.find(x => x.id === id);
    if (!r) return undefined;
    const teamColor = r.team === 'wolf' ? Colors.wolf
      : r.team === 'village' ? Colors.village
      : Colors.neutral;
    return { name: r.name, teamColor };
  };
  const getDualRoles = (num: number) => {
    const cards = playerCardMap[num];
    if (!cards) return {};
    return { upper: toRoleInfo(cards.upper), lower: toRoleInfo(cards.lower) };
  };

  // ── Badge helper UI ────────────────────────────────────────────────────
  const renderBadgeUI = (
    deadPlayer: number,
    action: BadgeAction,
    setAction: (a: BadgeAction) => void,
    recipient: number | null,
    setRecipient: (n: number | null) => void,
    resolved: boolean,
    onConfirm: (action: BadgeAction, recipient: number | null) => void,
    candidateNums: number[],
  ) => {
    if (resolved) {
      return (
        <View style={[styles.banner, { borderColor: Colors.warning }]}>
          <Text style={[styles.bannerText, { color: Colors.warning }]}>
            {action === 'tear'
              ? '🗑️  警徽已撕毀'
              : `⭐ 警徽移交給 ${recipient} 號`}
          </Text>
        </View>
      );
    }
    return (
      <>
        <Text style={[styles.hint, { marginTop: 4 }]}>
          ⚠️ 警長 {deadPlayer} 號死亡，警徽如何處理？（必選）
        </Text>
        <View style={styles.abilityRow}>
          <TouchableOpacity
            style={[styles.abilityBtn, action === 'handover' && styles.abilityBtnOn]}
            onPress={() => { setAction('handover'); setRecipient(null); }}
          >
            <Text style={[styles.abilityBtnText, action === 'handover' && { color: Colors.warning }]}>
              ⭐ 移交警徽
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.abilityBtn, action === 'tear' && styles.abilityBtnOn]}
            onPress={() => { setAction('tear'); setRecipient(null); }}
          >
            <Text style={[styles.abilityBtnText, action === 'tear' && { color: Colors.warning }]}>
              🗑️ 撕毀警徽
            </Text>
          </TouchableOpacity>
        </View>

        {action === 'handover' && (
          <>
            <Text style={styles.hint}>選擇接收警徽的玩家</Text>
            {renderGrid(
              playerNums,
              n => !candidateNums.includes(n)
                ? disabledGridStyle
                : n === recipient
                ? { bg: Colors.warning + '25', border: Colors.warning, textColor: Colors.warning }
                : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim },
              n => n === recipient ? '⭐' : undefined,
              n => {
                if (!candidateNums.includes(n)) return;
                setRecipient(recipient === n ? null : n);
              },
              { isDisabled: n => !candidateNums.includes(n) },
            )}
          </>
        )}

      </>
    );
  };

  // ── Shared player grid ─────────────────────────────────────────────────
  const renderGrid = (
    nums: number[],
    getStyle: (n: number) => { bg: string; border: string; textColor: string },
    getLabel: (n: number) => string | undefined,
    onPress: (n: number) => void,
    opts?: { hideRoles?: boolean; isDisabled?: (n: number) => boolean },
  ) => (
    <View style={styles.grid}>
      {nums.map(num => {
        const { bg, border, textColor } = getStyle(num);
        const isGoldenBaby = goldenBabyPlayers.includes(num);
        const finalBorder = isGoldenBaby && border === Colors.surfaceLight ? '#ffd54f' : border;
        const finalTextColor = isGoldenBaby ? '#ffd54f' : textColor;
        const { upper, lower } = (isDualMode && !opts?.hideRoles) ? getDualRoles(num) : {};
        const isBishopHolder = bishopInGame && num === currentBishopHolder;
        const isSheriff = displayedSheriffPlayer !== null && num === displayedSheriffPlayer;
        const statusIcons = `${isSheriff ? '⭐' : ''}${isBishopHolder ? '✝️' : ''}`;
        return (
          <PlayerButton
            key={num}
            num={num}
            size={btnSize}
            bg={bg}
            border={finalBorder}
            textColor={finalTextColor}
            label={getLabel(num)}
            sublabel={statusIcons !== '' ? statusIcons : undefined}
            isDead={visualDeathState.deadPlayers.includes(num)}
            isDualMode={isDualMode}
            upperRole={upper}
            lowerRole={lower}
            upperDead={
              isDualMode &&
              visualDeathState.upperDeadPlayers.includes(num)
            }
            disabled={opts?.isDisabled?.(num)}
            onPress={() => onPress(num)}
          />
        );
      })}
    </View>
  );

  const defaultGridStyle = (n: number, selected: boolean) =>
    selected
      ? { bg: Colors.danger + '25', border: Colors.danger, textColor: Colors.danger }
      : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim };

  const disabledGridStyle = { bg: Colors.surface, border: Colors.textMuted, textColor: Colors.textMuted };
  const sheriffBadgeTorn =
    badgeAction === 'tear' ||
    nightDeathBadgeAction === 'tear' ||
    speechBadgeAction === 'tear' ||
    exileBadgeAction === 'tear';
  const displayedSheriffPlayer =
    localSheriff !== null
      ? localSheriff
      : !sheriffBadgeTorn && sheriffPlayer !== null && !deadPlayers.includes(sheriffPlayer)
      ? sheriffPlayer
      : null;
  const deathRoundTitle = (index: number) => index === 0 ? '第一輪死訊' : `連鎖死訊 ${index}`;
  const renderDeathRoundNotices = (rounds: number[][], keyPrefix: string) => (
    <>
      {rounds.map((round, index) => (
        <View
          key={`${keyPrefix}-${index}`}
          style={[styles.banner, { borderColor: index === 0 ? Colors.danger : Colors.warning }]}
        >
          <Text style={[styles.bannerText, { color: index === 0 ? Colors.danger : Colors.warning }]}>
            {deathRoundTitle(index)}：{round.map(player => `${player}號`).join('、')}
          </Text>
        </View>
      ))}
    </>
  );

  // ── Step 0: 警長事宜 ──────────────────────────────────────────────────
  const renderSheriff = () => {
    // Case A: sheriff died last night → badge handover/tear
    if (sheriffDiedLastNight) {
      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, styles.bannerDanger]}>
            <Text style={styles.bannerText}>⚠️  警長 {sheriffPlayer} 號昨晚死亡</Text>
          </View>
          {renderBadgeUI(
            sheriffPlayer!,
            badgeAction, setBadgeAction,
            badgeRecipient, setBadgeRecipient,
            false,
            (a, r) => {
              if (a === 'tear') setLocalSheriff(null);
              else if (a === 'handover' && r !== null) setLocalSheriff(r);
              setBadgeAction(a);
              setBadgeRecipient(r);
            },
            sheriffCandidates.filter(n => n !== sheriffPlayer),
          )}
        </ScrollView>
      );
    }

    // Case B: sheriff alive → show and confirm
    if (localSheriff !== null) {
      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, { borderColor: Colors.warning }]}>
            <Text style={[styles.bannerText, { color: Colors.warning }]}>⭐ 現任警長：{localSheriff} 號</Text>
          </View>
          <Text style={styles.hint}>確認後進行死亡公布</Text>
        </ScrollView>
      );
    }

    // Case C: no sheriff → election
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        <Text style={styles.hint}>點選當選玩家（再次點擊取消，可不設警長）</Text>
        {renderGrid(
          playerNums,
          n => !sheriffCandidates.includes(n)
            ? disabledGridStyle
            : n === localSheriff
            ? { bg: Colors.warning + '25', border: Colors.warning, textColor: Colors.warning }
            : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim },
          n => n === localSheriff ? '⭐' : undefined,
          n => {
            if (!sheriffCandidates.includes(n)) return;
            setLocalSheriff(p => p === n ? null : n);
          },
          { isDisabled: n => !sheriffCandidates.includes(n) },
        )}
      </ScrollView>
    );
  };

  // ── Step 1: 公布死亡 + 夜間技能觸發 ──────────────────────────────────
  const nightDeathKilledSheriff = localSheriff !== null && nightChainDeaths.includes(localSheriff);

  const lastNightSummary = nightHistory.at(-1)?.summary ?? [];
  const canSelectNightDeathSkillTarget = (player: number) =>
    !deadPlayers.includes(player) &&
    !nightChainDeaths.includes(player) &&
    player !== pendingNightDeathSkill?.player;

  const renderDeaths = () => {
    if (pendingNightDeathSkill) {
      const isHunter = pendingNightDeathSkill.roleId === 'hunter';
      const resolvedTarget = nightDeathSkillTarget === null
        ? undefined
        : resolveTimedDeathSkillTarget(
            nightDeathSkillTarget,
            'night',
            nightActions,
            roleMembersMap,
            playerCardMap,
            upperDeadPlayers,
            prevDreamwalkerTarget,
            gameMode,
          );
      return (
        <View style={styles.skillScreen}>
          <View style={styles.skillHeader}>
            <Text style={styles.skillTitle}>
              {isHunter ? '🏹 獵人開槍' : '👑 狼王帶人'}
            </Text>
            <Text style={styles.skillActor}>{pendingNightDeathSkill.player}號</Text>
          </View>

          <Text style={styles.hint}>
            {isHunter
              ? '選擇獵人開槍目標，再按下方按鈕完成'
              : '選擇狼王帶走的玩家，再按下方按鈕完成'}
          </Text>
          {renderDeathRoundNotices(nightDeathRounds, 'pending-night-round')}
          {renderGrid(
            playerNums,
            n => canSelectNightDeathSkillTarget(n)
              ? defaultGridStyle(n, n === nightDeathSkillTarget)
              : disabledGridStyle,
            n => n === nightDeathSkillTarget ? '💀' : undefined,
            n => {
              if (!canSelectNightDeathSkillTarget(n)) return;
              setNightDeathSkillTarget(previous => previous === n ? null : n);
              setNightDeathSkillBlocked(null);
            },
            { isDisabled: n => !canSelectNightDeathSkillTarget(n) },
          )}

          {nightDeathSkillTarget !== null && (
            <View style={styles.skillSelection}>
              <Text style={styles.skillSelectionText}>
                {resolvedTarget === undefined
                  ? '目標具有夜間免疫，本次技能不會造成死亡'
                  : `實際目標：${resolvedTarget}號`}
              </Text>
            </View>
          )}
          {nightDeathSkillBlocked !== null && (
            <View style={[styles.banner, { borderColor: Colors.textMuted }]}>
              <Text style={styles.hint}>🛡️ {nightDeathSkillBlocked}號受到夜間抗性保護，未加入死訊</Text>
            </View>
          )}
        </View>
      );
    }

    return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>

      {/* 夜晚摘要（可展開） */}
      <TouchableOpacity
        style={styles.summaryToggleBtn}
        onPress={() => setShowNightSummary(p => !p)}
      >
        <Text style={styles.summaryToggleBtnText}>
          📋 夜晚摘要（主持人參考）{showNightSummary ? ' ▲' : ' ▼'}
        </Text>
      </TouchableOpacity>
      {showNightSummary && (
        <View style={styles.summaryBox}>
          {lastNightSummary.map((line, i) => {
            if (line.trim() === '') return <View key={i} style={{ height: 4 }} />;
            const isFinal = line.startsWith('💀') || line.startsWith('✨');
            return (
              <Text key={i} style={[styles.summaryLine, isFinal && styles.summaryLineFinal]}>
                {line}
              </Text>
            );
          })}
        </View>
      )}

      {/* 公布昨晚資訊 */}
      {!bloodMoonActivated && bearTamerResult && (
        <View style={[styles.banner, { borderColor: Colors.warning }]}>
          <Text style={[styles.bannerText, { color: Colors.warning }]}>
            🐻 訓熊師：熊{bearTamerResult === 'growl' ? '叫了！（鄰座有狼人陣營）' : '沒有叫（鄰座全為好人）'}
          </Text>
          <Text style={styles.hint}>← 向玩家宣布此結果</Text>
        </View>
      )}
      {!bloodMoonActivated && crowSurroundTarget !== undefined && (
        <View style={[styles.banner, { borderColor: Colors.textMuted }]}>
          <Text style={[styles.bannerText, { color: Colors.text }]}>
            🐦‍⬛ 烏鴉環繞：{crowSurroundTarget}號，本日不可被投票
          </Text>
        </View>
      )}

      {/* 血月：對玩家宣布平安夜 */}
      {bloodMoonActivated ? (
        <>
          <View style={styles.peaceBox}>
            <Text style={styles.peaceEmoji}>🌑</Text>
            <Text style={styles.peaceText}>血月發動 — 對玩家宣布：昨晚平安夜</Text>
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 4 }]}>
              延後夜晚資訊請見放逐結果頁公布
            </Text>
          </View>
          {bearTamerInGame && (
            <View style={[styles.banner, { borderColor: Colors.warning }]}>
              <Text style={[styles.bannerText, { color: Colors.warning }]}>
                🐻 訓熊師：熊沒有叫
              </Text>
              <Text style={styles.hint}>← 血月期間向玩家宣布此結果</Text>
            </View>
          )}
        </>
      ) : nightDeathRounds.length === 0 ? (
        <View style={styles.peaceBox}>
          <Text style={styles.peaceEmoji}>✨</Text>
          <Text style={styles.peaceText}>昨晚平安，無人死亡</Text>
        </View>
      ) : (
        nightDeathRounds.map((round, roundIndex) => (
          <View key={`round-${roundIndex}`} style={[styles.banner, { borderColor: roundIndex === 0 ? Colors.danger : Colors.warning }]}>
            <Text style={[styles.bannerText, { color: roundIndex === 0 ? Colors.danger : Colors.warning }]}>
              {roundIndex === 0 ? '第一輪死訊' : `連鎖死訊 ${roundIndex}`}：{round.map(player => `${player}號`).join('、')}
            </Text>
            {round.map(p => {
              const { upper, lower } = isDualMode ? getDualRoles(p) : {};
              const isSecondDeath = upperDeadPlayers.includes(p);
              return (
                <View key={p} style={[styles.deathRow, { marginTop: 6 }]}>
                  <View style={styles.deathNumBox}>
                    <Text style={styles.deathNum}>{p}</Text>
                    <Text style={styles.deathNumLabel}>號</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {isDualMode ? (
                      <>
                        <Text style={styles.deathSubTitle}>
                          {isSecondDeath ? '下牌死亡（完全出局）' : '上牌死亡'}
                        </Text>
                        <View style={styles.chipRow}>
                          {upper && <Chip text={`上 ${upper.name}`} color={upper.teamColor} faded={isSecondDeath} />}
                          {lower && <Chip text={`下 ${lower.name}`} color={lower.teamColor} faded={!isSecondDeath} />}
                        </View>
                        {getDeathRole(p) === undefined && (
                          <View style={styles.revealRoleBox}>
                            <Text style={styles.revealRoleHint}>死亡身分未定，請補上身分：</Text>
                            <View style={styles.revealRoleGrid}>
                              {revealableRoles.map(role => (
                                <TouchableOpacity
                                  key={`${p}-${role.id}`}
                                  style={[
                                    styles.revealRoleBtn,
                                    { borderColor: role.team === 'wolf' ? Colors.wolf : Colors.village },
                                  ]}
                                  onPress={() => setRoleMembers(role.id, [...(roleMembersMap[role.id] ?? []), p])}
                                >
                                  <Text
                                    style={[
                                      styles.revealRoleText,
                                      { color: role.team === 'wolf' ? Colors.wolf : Colors.village },
                                    ]}
                                  >
                                    {role.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.deathSubTitle}>本輪出局</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      {nightChainComplete && nightDeathRounds.length > 0 && (
        <View style={[styles.banner, { borderColor: Colors.success }]}>
          <Text style={[styles.bannerText, { color: Colors.success }]}>
            死亡連鎖已結束：{nightChainDeaths.map(player => `${player}號`).join('、')}
          </Text>
        </View>
      )}
      {nightDeathSkillBlocked !== null && (
        <View style={[styles.banner, { borderColor: Colors.textMuted }]}>
          <Text style={styles.hint}>
            🛡️ {nightDeathSkillBlocked}號受到夜間抗性保護，沒有新增死訊
          </Text>
        </View>
      )}

      {/* 主教：設定持有者 or 夜晚死亡時觸發查驗傳承 */}
      {bishopInGame && currentBishopHolder === null && !bishopResolved && (
        <>
          <Text style={[styles.hint, { marginTop: 4 }]}>✝️ 主教在局 — 設定主教持有者（首次使用）</Text>
          {renderGrid(
            playerNums,
            n => aliveNums.includes(n)
              ? { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim }
              : disabledGridStyle,
            () => undefined,
            n => {
              if (!aliveNums.includes(n)) return;
              setBishopHolder(n);
            },
            { isDisabled: n => !aliveNums.includes(n) },
          )}
        </>
      )}
      {bishopInGame && bishopDiedNight && renderBishopUI()}

      {/* 夜晚死亡的持徽角色 → 警徽處理 */}
      {nightDeathKilledSheriff && renderBadgeUI(
        localSheriff!,
        nightDeathBadgeAction, setNightDeathBadgeAction,
        nightDeathBadgeRecipient, setNightDeathBadgeRecipient,
        nightDeathBadgeResolved,
        (a, r) => {
          if (a === 'tear') setLocalSheriff(null);
          else if (a === 'handover' && r !== null) setLocalSheriff(r);
          setNightDeathBadgeAction(a);
          setNightDeathBadgeRecipient(r);
          setNightDeathBadgeResolved(true);
        },
        aliveNums.filter(n => n !== localSheriff),
      )}
    </ScrollView>
    );
  };

  // ── Step 2: 發言環節 ──────────────────────────────────────────────────
  const renderDayDeathSkill = () => {
    if (!pendingDayDeathSkill) return null;
    const isHunter = pendingDayDeathSkill.roleId === 'hunter';
    const canSelectDayDeathSkillTarget = (player: number) =>
      !deadPlayers.includes(player) &&
      !dayChainDeaths.includes(player) &&
      player !== pendingDayDeathSkill.player;
    return (
      <View style={styles.skillScreen}>
        <View style={styles.skillHeader}>
          <Text style={styles.skillTitle}>{isHunter ? '🏹 獵人開槍' : '👑 狼王帶人'}</Text>
          <Text style={styles.skillActor}>{pendingDayDeathSkill.player}號</Text>
        </View>
        <Text style={styles.hint}>本次死亡屬於白天，選擇目標後繼續結算連鎖</Text>
        {renderDeathRoundNotices(dayDeathRounds, 'pending-day-round')}
        {renderGrid(
          playerNums,
          n => canSelectDayDeathSkillTarget(n)
            ? defaultGridStyle(n, n === dayDeathSkillTarget)
            : disabledGridStyle,
          n => n === dayDeathSkillTarget ? '💀' : undefined,
          n => {
            if (!canSelectDayDeathSkillTarget(n)) return;
            setDayDeathSkillTarget(previous => previous === n ? null : n);
          },
          { isDisabled: n => !canSelectDayDeathSkillTarget(n) },
        )}
        {dayDeathSkillTarget !== null && (
          <View style={styles.skillSelection}>
            <Text style={styles.skillSelectionText}>已選擇：{dayDeathSkillTarget}號</Text>
          </View>
        )}
      </View>
    );
  };

  const renderDeathRoundDetails = (rounds: number[][], keyPrefix: string) => (
    <>
      {rounds.map((round, roundIndex) => (
        <View
          key={`${keyPrefix}-${roundIndex}`}
          style={[styles.banner, { borderColor: roundIndex === 0 ? Colors.danger : Colors.warning }]}
        >
          <Text style={[styles.bannerText, { color: roundIndex === 0 ? Colors.danger : Colors.warning }]}>
            {roundIndex === 0 ? '第一輪死訊' : `連鎖死訊 ${roundIndex}`}：{round.map(player => `${player}號`).join('、')}
          </Text>
          {round.map(p => {
            const previousDayDeaths = rounds.slice(0, roundIndex).flat();
            const deathSlot: 'upper' | 'lower' =
              upperDeadPlayers.includes(p) || nightChainDeaths.includes(p) || previousDayDeaths.includes(p)
                ? 'lower'
                : 'upper';
            const { upper, lower } = isDualMode ? getDualRoles(p) : {};
            const isSecondDeath = deathSlot === 'lower';
            const currentDeathRole = playerCardMap[p]?.[deathSlot];
            return (
              <View key={`${keyPrefix}-${roundIndex}-${p}`} style={[styles.deathRow, { marginTop: 6 }]}>
                <View style={styles.deathNumBox}>
                  <Text style={styles.deathNum}>{p}</Text>
                  <Text style={styles.deathNumLabel}>號</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {isDualMode ? (
                    <>
                      <Text style={styles.deathSubTitle}>
                        {isSecondDeath ? '下牌死亡（完全出局）' : '上牌死亡'}
                      </Text>
                      <View style={styles.chipRow}>
                        {upper && <Chip text={`上 ${upper.name}`} color={upper.teamColor} faded={isSecondDeath} />}
                        {lower && <Chip text={`下 ${lower.name}`} color={lower.teamColor} faded={!isSecondDeath} />}
                      </View>
                      {currentDeathRole === undefined && (
                        <View style={styles.revealRoleBox}>
                          <Text style={styles.revealRoleHint}>死亡身分未定，請補上身分：</Text>
                          <View style={styles.revealRoleGrid}>
                            {revealableRoles.map(role => (
                              <TouchableOpacity
                                key={`${keyPrefix}-${roundIndex}-${p}-${role.id}`}
                                style={[
                                  styles.revealRoleBtn,
                                  { borderColor: role.team === 'wolf' ? Colors.wolf : Colors.village },
                                ]}
                                onPress={() => {
                                  setPlayerCardRole(p, deathSlot, role.id);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.revealRoleText,
                                    { color: role.team === 'wolf' ? Colors.wolf : Colors.village },
                                  ]}
                                >
                                  {role.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.deathSubTitle}>本輪出局</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );

  const renderSpeech = () => {
    if (pendingDayDeathSkill) return renderDayDeathSkill();

    if (speechDeathNotice !== null) {
      const noticeSheriffDeathPlayer =
        localSheriff !== null && dayChainDeaths.includes(localSheriff)
          ? localSheriff
          : null;
      const noticeCanProceed =
        (
          noticeSheriffDeathPlayer === null ||
          (speechBadgeAction !== null && (speechBadgeAction !== 'handover' || speechBadgeRecipient !== null))
        ) &&
        (!bishopDiedDayChain || bishopRevealTarget !== null);
      const noticeButtonText = speechDeathNotice === 'self_destruct'
        ? '確認死訊，發表遺言'
        : speechDeathNotice === 'knight_good'
        ? '確認死訊，進入投票'
        : '確認死訊，進入夜晚';

      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, styles.bannerDanger]}>
            <Text style={styles.bannerText}>白天死亡連鎖</Text>
          </View>
          {renderDeathRoundDetails(dayDeathRounds, 'speech-death-notice')}
          {noticeSheriffDeathPlayer !== null && renderBadgeUI(
            noticeSheriffDeathPlayer,
            speechBadgeAction, setSpeechBadgeAction,
            speechBadgeRecipient, setSpeechBadgeRecipient,
            speechBadgeResolved,
            (a, r) => {
              if (a === 'tear') setLocalSheriff(null);
              else if (a === 'handover' && r !== null) setLocalSheriff(r);
              setSpeechBadgeAction(a);
              setSpeechBadgeRecipient(r);
              setSpeechBadgeResolved(true);
            },
            aliveNums,
          )}
          {bishopDiedDayChain && renderBishopUI()}
          <TouchableOpacity
            style={[styles.nextBtn, !noticeCanProceed && styles.nextBtnOff, { marginTop: 8 }]}
            disabled={!noticeCanProceed}
            onPress={() => {
              if (bishopDiedDayChain && bishopRevealTarget !== null) {
                setBishopHolder(bishopRevealTarget);
              }
              let finalSheriff = localSheriff;
              if (noticeSheriffDeathPlayer !== null) {
                if (speechBadgeAction === 'tear') finalSheriff = null;
                else if (speechBadgeAction === 'handover' && speechBadgeRecipient !== null) {
                  finalSheriff = speechBadgeRecipient;
                }
              }
              if (stopIfDayWin()) {
                setSpeechDeathNotice(null);
                setLastWordsPlayer(null);
                return;
              }
              if (speechDeathNotice === 'knight_wolf' && bloodMoonActivated) {
                setLocalSheriff(finalSheriff);
                setExiledPlayer(undefined);
                setSpeechDeathNotice(null);
                setStep(4);
                return;
              }
              if (speechDeathNotice === 'knight_wolf') {
                setSheriff(finalSheriff);
                endDay({
                  exiledPlayer: undefined,
                  isIdiotFlip: false,
                  nightChainDeaths,
                  dayKills: dayChainDeaths,
                });
                navigation.navigate('Night');
                return;
              }
              if (noticeSheriffDeathPlayer !== null) setLocalSheriff(finalSheriff);
              const resumeAtVote = speechDeathNotice === 'knight_good';
              setSpeechDeathNotice(null);
              if (resumeAtVote) setStep(3);
            }}
          >
            <Text style={styles.nextBtnText}>{noticeButtonText}</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (speechRevealPlayer !== null) {
      const slot = getSpeechRoleSlot(speechRevealPlayer);
      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, { borderColor: Colors.warning }]}>
            <Text style={[styles.bannerText, { color: Colors.warning }]}>
              {speechRevealPlayer} 號身分未定
            </Text>
            <Text style={[styles.hint, { marginTop: 6, textAlign: 'center' }]}>
              請補上{isDualMode ? (slot === 'upper' ? '上牌' : '下牌') : ''}身分
            </Text>
          </View>
          <View style={styles.revealRoleGrid}>
            {revealableRoles.map(role => (
              <TouchableOpacity
                key={`speech-${speechRevealPlayer}-${role.id}`}
                style={[
                  styles.revealRoleBtn,
                  { borderColor: role.team === 'wolf' ? Colors.wolf : Colors.village },
                ]}
                onPress={() => {
                  setPlayerCardRole(speechRevealPlayer, slot, role.id);
                  setSpeechRevealPlayer(null);
                }}
              >
                <Text
                  style={[
                    styles.revealRoleText,
                    { color: role.team === 'wolf' ? Colors.wolf : Colors.village },
                  ]}
                >
                  {role.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.abilityBtn, { marginTop: 8 }]}
            onPress={() => setSpeechRevealPlayer(null)}
          >
            <Text style={styles.abilityBtnText}>取消</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // Sub-phase: last words
    if (lastWordsPlayer !== null) {
      const lwRole = isDualMode ? getActiveDayRole(lastWordsPlayer) : undefined;
      const lwIsHunter = isDualMode
        ? lwRole === 'hunter'
        : (roleMembersMap['hunter'] ?? []).includes(lastWordsPlayer);
      const lwIsWhiteWolf = isDualMode
        ? lwRole === 'white_wolf'
        : (roleMembersMap['white_wolf'] ?? []).includes(lastWordsPlayer);
      const lwEndsDay = selfDestructEndsDay(lastWordsPlayer);
      const lwIsSheriff = lastWordsPlayer === localSheriff;
      const dayChainKilledSheriff =
        localSheriff !== null && dayChainDeaths.includes(localSheriff);
      const speechSheriffDeathPlayer = lwIsSheriff
        ? lastWordsPlayer
        : dayChainKilledSheriff
        ? localSheriff
        : null;
      const lwCanProceed =
        (!lwIsHunter || handledDayDeathSkills.includes(lastWordsPlayer)) &&
        (!lwIsWhiteWolf || wwBringResolved) &&
        (
          speechSheriffDeathPlayer === null ||
          (speechBadgeAction !== null && (speechBadgeAction !== 'handover' || speechBadgeRecipient !== null))
        ) &&
        (!(bishopLastWords || bishopDiedDayChain) || bishopRevealTarget !== null);

      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, styles.bannerDanger]}>
            <Text style={styles.bannerText}>☠️ {lastWordsPlayer} 號 自爆出局</Text>
          </View>

          <View style={styles.peaceBox}>
            <Text style={styles.peaceEmoji}>🗣️</Text>
            <Text style={styles.peaceText}>遺言發表中...</Text>
          </View>

          {/* 獵人技能 */}
          {lwIsHunter && !handledDayDeathSkills.includes(lastWordsPlayer) && (
            <>
              <Text style={[styles.hint, { marginTop: 4 }]}>獵人技能（可跳過）</Text>
              <View style={styles.abilityRow}>
                <TouchableOpacity
                  style={[styles.abilityBtn, speechAbility === 'hunter' && styles.abilityBtnOn]}
                  onPress={() => { setSpeechAbility(p => p === 'hunter' ? 'none' : 'hunter'); setSpeechAbilityTarget(null); }}
                >
                  <Text style={[styles.abilityBtnText, speechAbility === 'hunter' && { color: Colors.warning }]}>
                    🏹 獵人開槍
                  </Text>
                </TouchableOpacity>
              </View>
              {speechAbility === 'hunter' && (
                <>
                  <Text style={styles.hint}>選擇獵人開槍目標</Text>
                  {renderGrid(
                    playerNums,
                    n => aliveNums.includes(n)
                      ? defaultGridStyle(n, n === speechAbilityTarget)
                      : disabledGridStyle,
                    n => n === speechAbilityTarget ? '💀' : undefined,
                    n => {
                      if (!aliveNums.includes(n)) return;
                      setSpeechAbilityTarget(p => p === n ? null : n);
                    },
                    { isDisabled: n => !aliveNums.includes(n) },
                  )}
                  {speechAbilityTarget !== null && (
                    <View style={styles.skillSelection}>
                      <Text style={styles.skillSelectionText}>已選擇：{speechAbilityTarget}號</Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {speechAbilityResolved && speechAbilityKills.length > 0 && (
            <View style={[styles.banner, { borderColor: Colors.warning }]}>
              <Text style={[styles.bannerText, { color: Colors.warning }]}>
                💀 🏹 獵人帶走 {speechAbilityKills[0]} 號
              </Text>
            </View>
          )}

          {/* 白狼王帶人（白天自爆時） */}
          {lwIsWhiteWolf && !wwBringResolved && (
            <>
              <Text style={[styles.hint, { marginTop: 4 }]}>🤍 白狼王帶走一名玩家</Text>
              {renderGrid(
                playerNums,
                n => aliveNums.includes(n)
                  ? defaultGridStyle(n, n === wwBringTarget)
                  : disabledGridStyle,
                n => n === wwBringTarget ? '帶' : undefined,
                n => {
                  if (!aliveNums.includes(n)) return;
                  setWwBringTarget(p => p === n ? null : n);
                },
                { isDisabled: n => !aliveNums.includes(n) },
              )}
              <View style={styles.abilityRow}>
                {wwBringTarget !== null && (
                  <TouchableOpacity
                    style={[styles.confirmBtn, { flex: 2 }]}
                    onPress={() => {
                      appendDayDeathRounds([wwBringTarget]);
                      setWwBringResolved(true);
                    }}
                  >
                    <Text style={styles.confirmBtnText}>確認帶走 {wwBringTarget} 號</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.abilityBtn, { flex: 1 }]}
                  onPress={() => setWwBringResolved(true)}
                >
                  <Text style={styles.abilityBtnText}>跳過</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {wwBringResolved && wwBringTarget !== null && (
            <View style={[styles.banner, { borderColor: Colors.wolf }]}>
              <Text style={[styles.bannerText, { color: Colors.wolf }]}>
                💀 🤍 白狼王帶走 {wwBringTarget} 號
              </Text>
            </View>
          )}
          {renderDeathRoundDetails(dayDeathRounds, 'speech-chain')}

          {/* 警長自爆 → 警徽處理（必須在遺言前完成） */}
          {speechSheriffDeathPlayer !== null && renderBadgeUI(
            speechSheriffDeathPlayer,
            speechBadgeAction, setSpeechBadgeAction,
            speechBadgeRecipient, setSpeechBadgeRecipient,
            speechBadgeResolved,
            (a, r) => {
              if (a === 'tear') setLocalSheriff(null);
              else if (a === 'handover' && r !== null) setLocalSheriff(r);
              setSpeechBadgeAction(a);
              setSpeechBadgeRecipient(r);
              setSpeechBadgeResolved(true);
            },
            aliveNums,
          )}

          {/* 主教自爆 → 查驗並傳遞技能 */}
          {(bishopLastWords || bishopDiedDayChain) && renderBishopUI()}

          <TouchableOpacity
            style={[styles.nextBtn, !lwCanProceed && styles.nextBtnOff, { marginTop: 8 }]}
            disabled={!lwCanProceed}
            onPress={() => {
              const confirmedHunterTarget =
                lwIsHunter &&
                speechAbility === 'hunter' &&
                !speechAbilityResolved &&
                speechAbilityTarget !== null
                  ? speechAbilityTarget
                  : null;
              if (confirmedHunterTarget !== null) {
                appendDayDeathRounds([confirmedHunterTarget]);
                setSpeechAbilityResolved(true);
              }
              if ((bishopLastWords || bishopDiedDayChain) && bishopRevealTarget !== null) {
                setBishopHolder(bishopRevealTarget);
              }
              let finalSheriff = localSheriff;
              if (speechSheriffDeathPlayer !== null) {
                if (speechBadgeAction === 'tear') finalSheriff = null;
                else if (speechBadgeAction === 'handover' && speechBadgeRecipient !== null) finalSheriff = speechBadgeRecipient;
              }
              if (lwEndsDay) {
                handleWolfSelfDestructEnd(
                  finalSheriff,
                  confirmedHunterTarget !== null ? [confirmedHunterTarget] : [],
                );
              } else {
                if (speechSheriffDeathPlayer !== null) setLocalSheriff(finalSheriff);
                setLastWordsPlayer(null);
                setSpeechAbility('none');
                setSpeechAbilityTarget(null);
                setSpeechAbilityResolved(false);
                setSpeechBadgeAction(null);
                setSpeechBadgeRecipient(null);
                setSpeechBadgeResolved(false);
              }
            }}
          >
            <Text style={styles.nextBtnText}>
              {speechAbility === 'hunter' && !speechAbilityResolved && speechAbilityTarget !== null
                ? `確認獵殺 ${speechAbilityTarget} 號並繼續`
                : lwEndsDay ? '進入夜晚 →' : '結束遺言，繼續'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // Sub-phase: pending confirmation
    if (pendingSelfDestruct !== null) {
      const pdRole = isDualMode ? getActiveDayRole(pendingSelfDestruct) : undefined;
      const pdDef = ROLES.find(r => r.id === pdRole);
      const pdEndsDay = selfDestructEndsDay(pendingSelfDestruct);

      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, styles.bannerDanger]}>
            <Text style={styles.bannerText}>💥 {pendingSelfDestruct} 號 宣布自爆</Text>
            {pdDef && (
              <Text style={[styles.hint, { marginTop: 6, textAlign: 'center' }]}>
                {pdEndsDay ? '（狼隊）→ 白天立即結束，直接進夜晚' : '（老流氓）→ 遊戲繼續'}
              </Text>
            )}
          </View>

          <View style={styles.abilityRow}>
            <TouchableOpacity
              style={styles.abilityBtn}
              onPress={() => setPendingSelfDestruct(null)}
            >
              <Text style={styles.abilityBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { flex: 1 }]}
              onPress={() => {
                setSpeechDeaths(prev => [...prev, pendingSelfDestruct]);
                appendDayDeathRounds([pendingSelfDestruct]);
                setLastWordsPlayer(pendingSelfDestruct);
                setSpeechDeathNotice('self_destruct');
                setPendingSelfDestruct(null);
              }}
            >
              <Text style={styles.confirmBtnText}>確認 {pendingSelfDestruct} 號自爆</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const knightActivePlayer = (knightInGame && !knightUsed && !knightDuelResolved)
      ? aliveNums.find(p => hasActiveRole(p, 'knight'))
      : undefined;

    const speechNums = playerNums;
    const canSpeak = (p: number) => aliveNums.includes(p);
    const getSpeechActionLabel = (p: number): string | undefined => {
      if (!canSpeak(p)) return undefined;
      if (getSpeechRole(p) === undefined) return '?';
      if (p === knightActivePlayer) return '⚔️';
      if (canSelfDestruct(p)) return '爆';
      return undefined;
    };

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        {!knightDuelActive ? (
          <>
            <Text style={styles.hint}>點選發言玩家；未定義身分可先補身分</Text>
            {renderGrid(
              speechNums,
              n => !canSpeak(n)
                ? disabledGridStyle
                : n === knightActivePlayer
                ? { bg: Colors.village + '25', border: Colors.village, textColor: Colors.village }
                : canSelfDestruct(n)
                ? { bg: Colors.wolf + '18', border: Colors.wolf, textColor: Colors.wolf }
                : getSpeechRole(n) === undefined
                ? { bg: Colors.warning + '12', border: Colors.warning, textColor: Colors.warning }
                : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim },
              getSpeechActionLabel,
              n => {
                if (!canSpeak(n)) return;
                if (getSpeechRole(n) === undefined) {
                  setSpeechRevealPlayer(n);
                  return;
                }
                if (n === knightActivePlayer) {
                  setKnightPlayer(n);
                  setKnightDuelActive(true);
                  return;
                }
                if (canSelfDestruct(n)) {
                  setPendingSelfDestruct(n);
                }
              },
              { isDisabled: n => !canSpeak(n) },
            )}
          </>
        ) : (
          <>
            <Text style={styles.hint}>⚔️ 騎士（{knightPlayer} 號）發動決鬥 — 選擇決鬥對象</Text>
            {renderGrid(
              playerNums,
              n => !aliveNums.includes(n) || n === knightPlayer
                ? disabledGridStyle
                : n === knightTarget
                ? { bg: Colors.danger + '25', border: Colors.danger, textColor: Colors.danger }
                : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim },
              n => n === knightTarget ? '⚔' : undefined,
              n => {
                if (!aliveNums.includes(n) || n === knightPlayer) return;
                setKnightTarget(p => p === n ? null : n);
              },
              { isDisabled: n => !aliveNums.includes(n) || n === knightPlayer },
            )}
            {knightTarget !== null && (() => {
              const targetIsWolf = isActiveWolf(knightTarget);
              return (
                <View style={[styles.banner, { borderColor: targetIsWolf ? Colors.wolf : Colors.village, marginTop: 8 }]}>
                  <Text style={[styles.bannerText, { color: targetIsWolf ? Colors.wolf : Colors.village }]}>
                    {targetIsWolf
                      ? `🐺 ${knightTarget} 號是狼人 → ${knightTarget} 號死亡，直接進夜晚`
                      : `✅ ${knightTarget} 號是好人 → ${knightPlayer !== null ? `${knightPlayer} 號` : '騎士'}死亡，遊戲繼續`}
                  </Text>
                </View>
              );
            })()}
            <TouchableOpacity
              style={[styles.abilityBtn, { marginTop: 4 }]}
              onPress={() => { setKnightDuelActive(false); setKnightTarget(null); setKnightPlayer(null); }}
            >
              <Text style={styles.abilityBtnText}>取消</Text>
            </TouchableOpacity>
          </>
        )}

        {speechDeaths.length > 0 && (
          <View style={[styles.banner, styles.bannerDanger]}>
            <Text style={styles.bannerText}>💥 已自爆：{speechDeaths.join('、')} 號</Text>
          </View>
        )}

        {knightDuelResolved && (
          <View style={[styles.banner, { borderColor: knightEndsDay ? Colors.wolf : Colors.village }]}>
            <Text style={[styles.bannerText, { color: knightEndsDay ? Colors.wolf : Colors.village }]}>
              ⚔️ 騎士決鬥：{knightEndsDay
                ? `${knightTarget} 號（狼人）死亡 — 白天結束`
                : `${knightDuelKills[0] ?? '?'} 號（騎士）死亡 — 遊戲繼續`}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ── Step 3: 投票放逐 ──────────────────────────────────────────────────
  const renderVote = () => {
    const canVoteTarget = (n: number) => aliveNums.includes(n) && n !== crowSurroundTarget;
    const monkActive = playerNums.some(n => {
      if (!aliveNums.includes(n)) return false;
      if (isDualMode) return getActiveDayRole(n) === 'monk';
      return (roleMembersMap['monk'] ?? []).includes(n);
    });
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        {monkActive && (
          <TouchableOpacity
            style={[styles.abilityBtn, monkVoteMode && { borderColor: Colors.warning, backgroundColor: Colors.warning + '20' }]}
            onPress={() => setMonkVoteMode(prev => !prev)}
          >
            <Text style={[styles.abilityBtnText, monkVoteMode && { color: Colors.warning }]}>
              {monkVoteMode ? '正在選擇僧侶投票' : `僧侶投票${monkVoteTarget ? `：${monkVoteTarget}號` : ''}`}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.hint}>點選被放逐的玩家</Text>
        {tenguDiedThisPhase && (
          <View style={[styles.banner, { borderColor: Colors.wolf }]}>
            <Text style={[styles.bannerText, { color: Colors.wolf }]}>⚡ 天狗已出局 — 本輪投票結果不公開</Text>
          </View>
        )}
        {crowSurroundTarget !== undefined && aliveNums.includes(crowSurroundTarget) && (
          <Text style={styles.hintWarn}>
            🐦‍⬛ 烏鴉：{crowSurroundTarget} 號本回合不可被投票
          </Text>
        )}
        {lostVotePlayers.length > 0 && (
          <Text style={styles.hintWarn}>
            注意：{lostVotePlayers.join('、')} 號已失去投票權
          </Text>
        )}
        {renderGrid(
          playerNums,
          n => !aliveNums.includes(n) || n === crowSurroundTarget
            ? { bg: Colors.textMuted + '18', border: Colors.textMuted, textColor: Colors.textMuted }
            : monkVoteMode && n === monkVoteTarget
            ? { bg: Colors.warning + '25', border: Colors.warning, textColor: Colors.warning }
            : n === exiledPlayer
            ? { bg: Colors.danger + '25', border: Colors.danger, textColor: Colors.danger }
            : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim },
          n => monkVoteMode && n === monkVoteTarget ? '僧' : n === exiledPlayer ? '放' : undefined,
          n => {
            if (!canVoteTarget(n)) return;
            if (monkVoteMode) {
              const nextPlayer = monkVoteTarget === n ? null : n;
              setMonkVoteTarget(nextPlayer);
              setMonkVoteCard(nextPlayer === null ? null : {
                player: nextPlayer,
                slot: isDualMode && upperDeadPlayers.includes(nextPlayer) ? 'lower' : 'upper',
              });
              return;
            }
            setExiledPlayer(p => p === n ? null : n);
          },
          { isDisabled: n => !canVoteTarget(n) },
        )}
      </ScrollView>
    );
  };

  // ── Step 4: 放逐結果 + 警徽處理 + 特殊技能 ───────────────────────────
  const renderResult = () => {
    if (pendingDayDeathSkill) return renderDayDeathSkill();

    const noVote       = exiledPlayer === undefined;
    const sheriffExiled = !noVote && typeof exiledPlayer === 'number' && exiledPlayer === localSheriff;
    const sheriffKilledByDayChain =
      localSheriff !== null &&
      dayChainDeaths.includes(localSheriff) &&
      !sheriffExiled;
    const sheriffKilledByBloodMoon =
      bloodMoonActivated &&
      localSheriff !== null &&
      delayedNightDeaths.includes(localSheriff) &&
      !sheriffExiled &&
      !sheriffKilledByDayChain;
    const resultSheriffDeathPlayer = sheriffExiled
      ? exiledPlayer as number
      : sheriffKilledByDayChain
      ? localSheriff
      : sheriffKilledByBloodMoon
      ? localSheriff
      : null;
    const isIdiotFlip  = exileAbilityResolved && exileAbility === 'idiot';
    const needBadge =
      resultSheriffDeathPlayer !== null &&
      !(sheriffExiled && isIdiotFlip) &&
      !exileBadgeResolved;
    const targetNums   = aliveNums.filter(p =>
      !delayedNightDeaths.includes(p) && (isIdiotFlip || p !== exiledPlayer)
    );
    const canSelectExileAbilityTarget = (player: number) => targetNums.includes(player);

    const exileAbilityModes: ExileAbility[] = (() => {
      if (noVote || typeof exiledPlayer !== 'number') return [];
      const alreadyFlipped = idiotFlippedPlayers.includes(exiledPlayer);
      if (dayChainDeaths.includes(exiledPlayer)) return [];
      if (isDualMode) {
        const role = getActiveDayRole(exiledPlayer);
        if (role === 'hunter')    return ['hunter'];
        if (role === 'wolf_king') return ['wolfking'];
        if (role === 'idiot' && !alreadyFlipped) return ['idiot'];
        return [];
      }
      const modes: ExileAbility[] = [];
      if ((roleMembersMap['hunter']   ?? []).includes(exiledPlayer)) modes.push('hunter');
      if ((roleMembersMap['wolf_king'] ?? []).includes(exiledPlayer)) modes.push('wolfking');
      if ((roleMembersMap['idiot'] ?? []).includes(exiledPlayer) && !alreadyFlipped) modes.push('idiot');
      return modes;
    })();
    const bloodMoonCandidates = playerNums.filter(p => {
      if (deadPlayers.includes(p)) return false;
      if (resolvedDayDeaths.includes(p)) return false;
      if (delayedNightDeaths.includes(p)) return false;
      if (typeof exiledPlayer === 'number' && p === exiledPlayer) return false;
      return true;
    });
    const canSelectBloodMoonTarget = (player: number) => bloodMoonCandidates.includes(player);

    if (bloodMoonActivated && !bloodMoonDeathsAnnounced) {
      return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
          <View style={[styles.banner, noVote ? styles.bannerNeutral : styles.bannerDanger]}>
            <Text style={styles.bannerText}>
              {noVote ? '🗳️  流票 — 今天無人被放逐' : `☠️  ${exiledPlayer} 號 被放逐出局`}
            </Text>
          </View>

          <View style={[styles.banner, { borderColor: Colors.wolf, marginTop: 8 }]}>
            <Text style={[styles.bannerText, { color: Colors.wolf }]}>🌑 血月延後資訊 — 現在公布給玩家</Text>
            {delayedNightDeathRounds.length === 0 && (
              <Text style={[styles.hint, { marginTop: 4 }]}>昨晚平安夜</Text>
            )}
            {bearTamerResult && (
              <Text style={[styles.hint, { color: Colors.text, marginTop: 4 }]}>
                🐻 訓熊師真實結果：熊{bearTamerResult === 'growl' ? '叫了' : '沒有叫'}
              </Text>
            )}
            {crowSurroundTarget !== undefined && (
              <Text style={[styles.hint, { color: Colors.text, marginTop: 4 }]}>
                🐦‍⬛ 烏鴉環繞：{crowSurroundTarget}號
              </Text>
            )}
          </View>

          {renderDeathRoundDetails(delayedNightDeathRounds, 'blood-moon-delayed')}
          {delayedNightDeathRounds.length > 0 && (
            <View style={[styles.banner, { borderColor: Colors.success }]}>
              <Text style={[styles.bannerText, { color: Colors.success }]}>死亡連鎖已公布，確認後處理死亡角色技能</Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (bloodMoonActivated && bmHunterPlayer !== undefined && !bmHunterResolved) {
      return (
        <View style={styles.skillScreen}>
          <View style={styles.skillHeader}>
            <Text style={styles.skillTitle}>🏹 血月延後：獵人開槍</Text>
            <Text style={styles.skillActor}>{bmHunterPlayer}號獵人</Text>
          </View>
          <Text style={styles.hint}>選擇目標；不選目標即放棄開槍</Text>
          {renderGrid(
            playerNums,
            n => canSelectBloodMoonTarget(n)
              ? defaultGridStyle(n, n === bmHunterTarget)
              : disabledGridStyle,
            n => n === bmHunterTarget ? '💀' : undefined,
            n => {
              if (!canSelectBloodMoonTarget(n)) return;
              setBmHunterTarget(p => p === n ? null : n);
            },
            { isDisabled: n => !canSelectBloodMoonTarget(n) },
          )}
          {bmHunterTarget !== null && (
            <View style={styles.skillSelection}>
              <Text style={styles.skillSelectionText}>
                {resolvedBmHunterTarget === undefined
                  ? '目標受到夜晚規則保護，本次不會死亡'
                  : resolvedBmHunterTarget === bmHunterTarget
                  ? `已選擇：${bmHunterTarget}號`
                  : `已選擇：${bmHunterTarget}號，實際目標：${resolvedBmHunterTarget}號`}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (bloodMoonActivated && bmWolfKingPlayer !== undefined && !bmWolfKingResolved) {
      return (
        <View style={styles.skillScreen}>
          <View style={styles.skillHeader}>
            <Text style={styles.skillTitle}>👑 血月延後：狼王帶人</Text>
            <Text style={styles.skillActor}>{bmWolfKingPlayer}號狼王</Text>
          </View>
          <Text style={styles.hint}>選擇目標；不選目標即放棄帶人</Text>
          {renderGrid(
            playerNums,
            n => canSelectBloodMoonTarget(n)
              ? defaultGridStyle(n, n === bmWolfKingTarget)
              : disabledGridStyle,
            n => n === bmWolfKingTarget ? '💀' : undefined,
            n => {
              if (!canSelectBloodMoonTarget(n)) return;
              setBmWolfKingTarget(p => p === n ? null : n);
            },
            { isDisabled: n => !canSelectBloodMoonTarget(n) },
          )}
          {bmWolfKingTarget !== null && (
            <View style={styles.skillSelection}>
              <Text style={styles.skillSelectionText}>
                {resolvedBmWolfKingTarget === undefined
                  ? '目標受到夜晚規則保護，本次不會死亡'
                  : resolvedBmWolfKingTarget === bmWolfKingTarget
                  ? `已選擇：${bmWolfKingTarget}號`
                  : `已選擇：${bmWolfKingTarget}號，實際目標：${resolvedBmWolfKingTarget}號`}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (!exileAbilityResolved && (exileAbility === 'hunter' || exileAbility === 'wolfking')) {
      return (
        <View style={styles.skillScreen}>
          <View style={styles.skillHeader}>
            <Text style={styles.skillTitle}>
              {exileAbility === 'hunter' ? '🏹 放逐後獵人開槍' : '👑 放逐後狼王帶人'}
            </Text>
            <TouchableOpacity
              style={styles.skillCancelBtn}
              onPress={() => {
                setExileAbility('none');
                setExileAbilityTarget(null);
              }}
            >
              <Text style={styles.skillCancelText}>取消技能</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>選擇目標，再按下方按鈕完成</Text>
          {renderGrid(
            playerNums,
            n => canSelectExileAbilityTarget(n)
              ? defaultGridStyle(n, n === exileAbilityTarget)
              : disabledGridStyle,
            n => n === exileAbilityTarget ? '💀' : undefined,
            n => {
              if (!canSelectExileAbilityTarget(n)) return;
              setExileAbilityTarget(p => p === n ? null : n);
            },
            { isDisabled: n => !canSelectExileAbilityTarget(n) },
          )}
          {exileAbilityTarget !== null && (
            <View style={styles.skillSelection}>
              <Text style={styles.skillSelectionText}>已選擇：{exileAbilityTarget}號</Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        <View style={[styles.banner, noVote ? styles.bannerNeutral : styles.bannerDanger]}>
          <Text style={styles.bannerText}>
            {noVote ? '🗳️  流票 — 今天無人被放逐' : `☠️  ${exiledPlayer} 號 被放逐出局`}
          </Text>
        </View>

        {/* 放逐警長 → 警徽處理 */}
        {resultSheriffDeathPlayer !== null && !(sheriffExiled && isIdiotFlip) && renderBadgeUI(
          resultSheriffDeathPlayer,
          exileBadgeAction, setExileBadgeAction,
          exileBadgeRecipient, setExileBadgeRecipient,
          exileBadgeResolved,
          (a, r) => {
            if (a === 'tear') setLocalSheriff(null);
            else if (a === 'handover' && r !== null) setLocalSheriff(r);
            setExileBadgeAction(a);
            setExileBadgeRecipient(r);
            setExileBadgeResolved(true);
          },
          targetNums,
        )}

        {/* 血月延後死亡技能處理結果 */}
        {bloodMoonActivated && (() => {
          return (
            <>
              {/* 血月延後技能：獵人 */}
              {bmHunterPlayer !== undefined && bmHunterResolved && (
                <View style={[styles.banner, { borderColor: Colors.warning, marginTop: 8 }]}>
                  <Text style={[styles.bannerText, { color: Colors.warning }]}>
                    🏹 獵人（{bmHunterPlayer} 號）{
                      bmHunterTarget === null
                        ? '放棄開槍'
                        : resolvedBmHunterTarget === undefined
                        ? '目標受到夜晚保護，未造成死亡'
                        : `擊殺 ${resolvedBmHunterTarget} 號`
                    }
                  </Text>
                </View>
              )}

              {/* 血月延後技能：狼王 */}
              {bmWolfKingPlayer !== undefined && bmWolfKingResolved && (
                <View style={[styles.banner, { borderColor: Colors.warning, marginTop: 8 }]}>
                  <Text style={[styles.bannerText, { color: Colors.warning }]}>
                    👑 狼王（{bmWolfKingPlayer} 號）{
                      bmWolfKingTarget === null
                        ? '放棄帶人'
                        : resolvedBmWolfKingTarget === undefined
                        ? '目標受到夜晚保護，未造成死亡'
                        : `帶走 ${resolvedBmWolfKingTarget} 號`
                    }
                  </Text>
                </View>
              )}

              {/* 血月延後技能：主教 */}
              {bishopDiedBloodMoon && renderBishopUI()}
            </>
          );
        })()}

        {/* Special abilities */}
        {!noVote && !needBadge && !exileAbilityResolved && exileAbilityModes.length > 0 && (
          <>
            <Text style={[styles.hint, { marginTop: 8 }]}>特殊技能觸發（可跳過）</Text>
            <View style={styles.abilityRow}>
              {exileAbilityModes.map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.abilityBtn, exileAbility === mode && styles.abilityBtnOn]}
                  onPress={() => { setExileAbility(p => p === mode ? 'none' : mode); setExileAbilityTarget(null); }}
                >
                  <Text style={[styles.abilityBtnText, exileAbility === mode && { color: Colors.warning }]}>
                    {mode === 'hunter' ? '🏹 獵人開槍' : mode === 'wolfking' ? '👑 狼王帶人' : '😶 白痴翻牌'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {exileAbility === 'idiot' && (
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setExileAbilityResolved(true)}>
                <Text style={styles.confirmBtnText}>確認：{exiledPlayer} 號翻牌存活，不失去投票權</Text>
              </TouchableOpacity>
            )}

          </>
        )}

        {exileAbilityResolved && (
          <View style={[styles.banner, { borderColor: Colors.warning }]}>
            <Text style={[styles.bannerText, { color: Colors.warning }]}>
              {exileAbility === 'idiot'
                ? `😶  ${exiledPlayer} 號翻牌存活（不失去投票權）`
                : `💀  ${exileAbility === 'hunter' ? '🏹 獵人' : '👑 狼王'} 帶走 ${exileAbilityTarget} 號`}
            </Text>
          </View>
        )}
          {renderDeathRoundDetails(dayDeathRounds, 'day-chain')}

        {/* 主教：放逐時觸發查驗傳承 */}
        {bishopInGame && bishopDiedExile && renderBishopUI()}
        {bishopDiedDayChain && !bishopDiedExile && renderBishopUI()}
      </ScrollView>
    );
  };

  // ── 主教技能 UI ────────────────────────────────────────────────────────
  const renderBishopUI = () => {
    const getRevealColor = (target: number | null, resolved: boolean) => {
      if (target === null) return Colors.village;
      const rid = isDualMode
        ? (upperDeadPlayers.includes(target) ? playerCardMap[target]?.lower : playerCardMap[target]?.upper)
        : Object.entries(roleMembersMap).find(([, ms]) => (ms ?? []).includes(target))?.[0];
      const def = ROLES.find(r => r.id === rid);
      return def ? Colors[def.team] : Colors.village;
    };

    if (bishopResolved) {
      const revealedRole = isDualMode
        ? (upperDeadPlayers.includes(bishopRevealTarget!) ? playerCardMap[bishopRevealTarget!]?.lower : playerCardMap[bishopRevealTarget!]?.upper)
        : Object.entries(roleMembersMap).find(([, ms]) => (ms ?? []).includes(bishopRevealTarget!))?.[ 0];
      const revealedDef = ROLES.find(r => r.id === revealedRole);
      const resolvedColor = revealedDef ? Colors[revealedDef.team] : Colors.village;
      return (
        <View style={[styles.banner, { borderColor: resolvedColor }]}>
          <Text style={[styles.bannerText, { color: resolvedColor }]}>
            ✝️ 主教技能：{bishopRevealTarget} 號（{revealedDef ? `${revealedDef.emoji}${revealedDef.name}` : '未知'}）已公布身分並繼承主教
          </Text>
        </View>
      );
    }

    const candidates = aliveNums.filter(n => n !== currentBishopHolder);
    const targetColor = getRevealColor(bishopRevealTarget, false);
    const targetRid = bishopRevealTarget !== null
      ? isDualMode
        ? (upperDeadPlayers.includes(bishopRevealTarget) ? playerCardMap[bishopRevealTarget]?.lower : playerCardMap[bishopRevealTarget]?.upper)
        : Object.entries(roleMembersMap).find(([, ms]) => (ms ?? []).includes(bishopRevealTarget!))?.[0]
      : undefined;
    const targetDef = ROLES.find(r => r.id === targetRid);

    return (
      <>
        <Text style={[styles.hint, { marginTop: 4 }]}>
          ✝️ 主教（{currentBishopHolder ?? '?'} 號）死亡 — 選擇一名玩家查驗並公布身分，查驗者繼承技能
        </Text>
        {renderGrid(
          playerNums,
          n => !candidates.includes(n)
            ? disabledGridStyle
            : n === bishopRevealTarget
            ? { bg: targetColor + '25', border: targetColor, textColor: targetColor }
            : { bg: Colors.surface, border: Colors.surfaceLight, textColor: Colors.textDim },
          n => n === bishopRevealTarget ? '✝️' : undefined,
          n => {
            if (!candidates.includes(n)) return;
            setBishopRevealTarget(p => p === n ? null : n);
          },
          { isDisabled: n => !candidates.includes(n) },
        )}
        {bishopRevealTarget !== null && (
          <View style={[styles.banner, { borderColor: targetColor }]}>
            <Text style={[styles.bannerText, { color: targetColor }]}>
              {targetDef ? `${targetDef.emoji} ${targetDef.name}（${targetDef.team === 'wolf' ? '狼人陣營' : '好人陣營'}）` : '好人陣營（未記錄）'}
            </Text>
          </View>
        )}
      </>
    );
  };

  // ── Navigation ─────────────────────────────────────────────────────────
  const goHome = () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));

  const handleNext = () => {
    if (displayedWinResult) {
      goHome();
      return;
    }

    if (pendingDayDeathSkill) {
      if (dayDeathSkillTarget !== null) {
        appendDayDeathRounds([dayDeathSkillTarget]);
      }
      if (pendingDayDeathSkill.player === exiledPlayer) {
        setExileAbility(pendingDayDeathSkill.roleId === 'hunter' ? 'hunter' : 'wolfking');
        setExileAbilityResolved(true);
      }
      setHandledDayDeathSkills(previous => [
        ...new Set([...previous, pendingDayDeathSkill.player]),
      ]);
      setDayDeathSkillTarget(null);
      return;
    }

    if (step === 0) {
      if (sheriffDiedLastNight) {
        if (badgeAction === 'tear') setLocalSheriff(null);
        else if (badgeAction === 'handover' && badgeRecipient !== null) setLocalSheriff(badgeRecipient);
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (pendingNightDeathSkill) {
        const resolvedTarget = nightDeathSkillTarget === null
          ? undefined
          : resolveTimedDeathSkillTarget(
              nightDeathSkillTarget,
              'night',
              nightActions,
              roleMembersMap,
              playerCardMap,
              upperDeadPlayers,
              prevDreamwalkerTarget,
              gameMode,
            );
        if (nightDeathSkillTarget !== null && resolvedTarget === undefined) {
          setNightDeathSkillBlocked(nightDeathSkillTarget);
        }
        if (resolvedTarget !== undefined) {
          const addedRounds = resolveAutomaticDeathRounds(
            [resolvedTarget],
            'night',
            nightActions,
            roleMembersMap,
            playerCardMap,
            upperDeadPlayers,
            deadPlayers,
            prevDreamwalkerTarget,
            cupidLovers,
            gameMode,
            nightChainDeaths,
          );
          if (addedRounds.length > 0) {
            setNightDeathRounds(previous => [...previous, ...addedRounds]);
          }
        }
        setHandledNightDeathSkills(previous => [
          ...new Set([...previous, pendingNightDeathSkill.player]),
        ]);
        setNightDeathSkillTarget(null);
        return;
      }

      let newSheriff = localSheriff;
      if (nightDeathKilledSheriff && !nightDeathBadgeResolved) {
        if (nightDeathBadgeAction === 'tear') newSheriff = null;
        else if (nightDeathBadgeAction === 'handover' && nightDeathBadgeRecipient !== null) newSheriff = nightDeathBadgeRecipient;
        setNightDeathBadgeResolved(true);
      }
      if (newSheriff !== localSheriff) setLocalSheriff(newSheriff);
      if (bishopDiedNight && bishopRevealTarget !== null) {
        setBishopHolder(bishopRevealTarget);
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (knightDuelActive && knightTarget !== null) {
        // 系統自動判斷決鬥結果，套用並前進
        const targetIsWolf = isActiveWolf(knightTarget);
        const kills: number[] = targetIsWolf ? [knightTarget] : (knightPlayer !== null ? [knightPlayer] : []);
        setKnightDuelKills(kills);
        setKnightEndsDay(targetIsWolf);
        setKnightDuelResolved(true);
        setKnightUsed(true);
        setKnightDuelActive(false);
        appendDayDeathRounds(kills);
        setSpeechDeathNotice(targetIsWolf ? 'knight_wolf' : 'knight_good');
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (typeof exiledPlayer === 'number') {
        const activeRole = isDualMode
          ? getActiveDayRole(exiledPlayer)
          : Object.entries(roleMembersMap)
              .find(([, members]) => (members ?? []).includes(exiledPlayer))?.[0];
        if (activeRole !== 'idiot') appendDayDeathRounds([exiledPlayer]);
      }
      setStep(4);
      return;
    }

    // Step 4 → end day
    if (bloodMoonActivated && !bloodMoonDeathsAnnounced) {
      setBloodMoonDeathsAnnounced(true);
      return;
    }
    if (bloodMoonActivated && bmHunterPlayer !== undefined && !bmHunterResolved) {
      setBmHunterResolved(true);
      return;
    }
    if (bloodMoonActivated && bmWolfKingPlayer !== undefined && !bmWolfKingResolved) {
      setBmWolfKingResolved(true);
      return;
    }

    const isIdiotFlip = exileAbilityResolved && exileAbility === 'idiot';
    const exileKills: number[] = [];
    if ((exileAbilityResolved || exileAbility === 'hunter' || exileAbility === 'wolfking') &&
        exileAbilityTarget !== null &&
        (exileAbility === 'hunter' || exileAbility === 'wolfking')) {
      exileKills.push(exileAbilityTarget);
    }
    let finalSheriff = localSheriff;
    const sheriffExiledNow = typeof exiledPlayer === 'number' && exiledPlayer === localSheriff;
    const sheriffKilledInDayChain = localSheriff !== null && dayChainDeaths.includes(localSheriff);
    const sheriffKilledInDelayedNight = bloodMoonActivated &&
      localSheriff !== null && delayedNightDeaths.includes(localSheriff);
    if ((sheriffKilledInDayChain || sheriffKilledInDelayedNight || (sheriffExiledNow && !isIdiotFlip))) {
      if (exileBadgeAction === 'tear') finalSheriff = null;
      else if (exileBadgeAction === 'handover' && exileBadgeRecipient !== null) finalSheriff = exileBadgeRecipient;
    }
    setSheriff(finalSheriff);
    if ((bishopDiedExile || bishopDiedBloodMoon || bishopDiedDayChain) && bishopRevealTarget !== null) {
      setBishopHolder(bishopRevealTarget);
    }
    endDay({
      exiledPlayer: typeof exiledPlayer === 'number' ? exiledPlayer : undefined,
      isIdiotFlip,
      nightChainDeaths: bloodMoonActivated ? delayedNightDeaths : nightChainDeaths,
      dayKills: [...dayChainDeaths, ...exileKills,
        ...knightDuelKills,
        ...(bmHunterResolved && resolvedBmHunterTarget !== undefined ? [resolvedBmHunterTarget] : []),
        ...(bmWolfKingResolved && resolvedBmWolfKingTarget !== undefined ? [resolvedBmWolfKingTarget] : [])],
    });
    navigation.navigate('Night');
  };

  const canAdvance = (): boolean => {
    if (displayedWinResult) return true;
    if (pendingDayDeathSkill) return true;
    if (step === 0 && sheriffDiedLastNight) {
      return badgeAction === 'tear' || (badgeAction === 'handover' && badgeRecipient !== null);
    }
    if (step === 1 && pendingNightDeathSkill) return true;
    if (step === 1 && nightDeathKilledSheriff && !nightDeathBadgeResolved) {
      if (!nightDeathBadgeAction) return false;
      if (nightDeathBadgeAction === 'handover' && nightDeathBadgeRecipient === null) return false;
    }
    if (step === 1 && bishopDiedNight && !bishopResolved) return bishopRevealTarget !== null;
    if (step === 2) {
      if (pendingSelfDestruct !== null || lastWordsPlayer !== null) return false;
      if (knightDuelActive) return knightTarget !== null;
      return true;
    }
    if (step === 3) return exiledPlayer !== null;
    if (step === 4) {
      const noVote = exiledPlayer === undefined;
      const isIdiotFlip = exileAbilityResolved && exileAbility === 'idiot';
      const sheriffExiled = !noVote && typeof exiledPlayer === 'number' && exiledPlayer === localSheriff;
      const sheriffKilledInDayChain = localSheriff !== null && dayChainDeaths.includes(localSheriff);
      const sheriffKilledInDelayedNight = bloodMoonActivated &&
        localSheriff !== null && delayedNightDeaths.includes(localSheriff);
      if (bloodMoonActivated && !bloodMoonDeathsAnnounced) return true;
      if (bloodMoonActivated && bmHunterPlayer !== undefined && !bmHunterResolved) return true;
      if (bloodMoonActivated && bmWolfKingPlayer !== undefined && !bmWolfKingResolved) return true;
      if (!exileAbilityResolved && (exileAbility === 'hunter' || exileAbility === 'wolfking')) {
        return exileAbilityTarget !== null;
      }
      if (
        (sheriffKilledInDayChain || sheriffKilledInDelayedNight || (sheriffExiled && !isIdiotFlip)) &&
        !exileBadgeResolved
      ) {
        if (!exileBadgeAction) return false;
        if (exileBadgeAction === 'handover' && exileBadgeRecipient === null) return false;
      }
      if (bishopDiedBloodMoon && !bishopResolved) return bishopRevealTarget !== null;
      if (bishopDiedExile && !bishopResolved) return bishopRevealTarget !== null;
      if (bishopDiedDayChain && !bishopResolved) return bishopRevealTarget !== null;
    }
    return true;
  };

  // ── Step display metadata ──────────────────────────────────────────────
  const STEP_EMOJI  = ['⭐', '☠️', '💬', '🗳️', '📢'];
  const STEP_TITLE  = [
    sheriffDiedLastNight ? '警長警徽處理' : (localSheriff !== null ? `警長：${localSheriff}號` : '警長競選'),
    '公布昨晚資訊',
    '發言環節',
    '投票放逐',
    '放逐結果',
  ];
  const nextLabel = (() => {
    if (displayedWinResult) return '遊戲已結束';
    if (pendingDayDeathSkill) {
      const action = pendingDayDeathSkill.roleId === 'hunter' ? '開槍' : '帶人';
      return dayDeathSkillTarget === null
        ? `放棄${action}並繼續`
        : `確認${action} ${dayDeathSkillTarget}號並公布連鎖死訊`;
    }
    if (step === 0 && sheriffDiedLastNight) {
      return badgeAction === 'tear' ? '確認撕毀' : badgeAction === 'handover' ? '確認移交' : '確認';
    }
    if (step === 2 && knightDuelActive && knightTarget !== null)
      return isActiveWolf(knightTarget) ? '⚔️ 騎士擊殺狼人 — 進入夜晚' : '⚔️ 確認決鬥 — 遊戲繼續';
    if (step === 2 && knightDuelResolved && knightEndsDay) return '⚔️ 騎士擊殺狼人 — 進入夜晚';
    if (step === 1 && pendingNightDeathSkill) {
      const action = pendingNightDeathSkill.roleId === 'hunter' ? '開槍' : '帶人';
      if (nightDeathSkillTarget === null) return `放棄${action}並繼續`;
      const resolvedTarget = resolveTimedDeathSkillTarget(
        nightDeathSkillTarget,
        'night',
        nightActions,
        roleMembersMap,
        playerCardMap,
        upperDeadPlayers,
        prevDreamwalkerTarget,
        gameMode,
      );
      return resolvedTarget === undefined
        ? `確認目標受保護並繼續`
        : `確認${action} ${resolvedTarget}號並公布連鎖死訊`;
    }
    if (step === 4 && bloodMoonActivated && !bloodMoonDeathsAnnounced) {
      return delayedNightDeathRounds.length === 0
        ? '確認平安夜，繼續'
        : '確認連鎖死訊，處理死亡技能';
    }
    if (step === 4 && bloodMoonActivated && bmHunterPlayer !== undefined && !bmHunterResolved) {
      return bmHunterTarget === null
        ? '放棄開槍並繼續'
        : resolvedBmHunterTarget === undefined
        ? '確認目標受保護並繼續'
        : `確認獵殺 ${resolvedBmHunterTarget} 號並繼續`;
    }
    if (step === 4 && bloodMoonActivated && bmWolfKingPlayer !== undefined && !bmWolfKingResolved) {
      return bmWolfKingTarget === null
        ? '放棄帶人並繼續'
        : resolvedBmWolfKingTarget === undefined
        ? '確認目標受保護並繼續'
        : `確認帶走 ${resolvedBmWolfKingTarget} 號並繼續`;
    }
    if (step === 4 && !exileAbilityResolved && exileAbility === 'hunter') {
      return exileAbilityTarget === null
        ? '請選擇獵殺目標'
        : `確認獵殺 ${exileAbilityTarget} 號並結束白天`;
    }
    if (step === 4 && !exileAbilityResolved && exileAbility === 'wolfking') {
      return exileAbilityTarget === null
        ? '請選擇帶走目標'
        : `確認帶走 ${exileAbilityTarget} 號並結束白天`;
    }
    if (step === 3) return exiledPlayer === undefined ? '確認流票' : '確認放逐';
    if (step === 4) return '☀️  結束白天，進入下一晚';
    return '確認，繼續';
  })();

  return (
    <View style={styles.container}>
      {/* 進度條 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` as any }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{STEP_EMOJI[step]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>第 {currentNight} 天 · {STEP_TITLE[step]}</Text>
          {localSheriff !== null && step >= 1 && (
            <Text style={styles.sheriffLine}>⭐ 警長：{localSheriff} 號</Text>
          )}
        </View>
        <HeaderMenuButton onBack={handleBack} />
      </View>

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

      {/* Content */}
      <View style={{ flex: 1 }}>
        {step === 0 && renderSheriff()}
        {step === 1 && renderDeaths()}
        {step === 2 && renderSpeech()}
        {step === 3 && renderVote()}
        {step === 4 && renderResult()}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {step === 3 && (
          <TouchableOpacity
            style={[styles.noVoteBtn, exiledPlayer === undefined && styles.noVoteBtnOn]}
            onPress={() => setExiledPlayer(p => p === undefined ? null : undefined)}
          >
            <Text style={[
              styles.noVoteBtnText,
              exiledPlayer === undefined && { color: Colors.success },
            ]}>
              {exiledPlayer === undefined ? '✓ 已選擇流票' : '🗳️  流票（今天無人出局）'}
            </Text>
          </TouchableOpacity>
        )}
        {!(step === 2 && (
          pendingSelfDestruct !== null ||
          speechDeathNotice !== null ||
          (lastWordsPlayer !== null && !pendingDayDeathSkill)
        )) && (
          <TouchableOpacity
            style={[styles.nextBtn, !canAdvance() && styles.nextBtnOff]}
            onPress={handleNext}
            disabled={!canAdvance()}
          >
            <Text style={styles.nextBtnText}>{nextLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────
function Chip({ text, color, faded }: { text: string; color: string; faded?: boolean }) {
  return (
    <View style={[chipSt.wrap, { borderColor: color, opacity: faded ? 0.35 : 1 }]}>
      <Text style={[chipSt.text, { color }]}>{text}</Text>
    </View>
  );
}
const chipSt = StyleSheet.create({
  wrap: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 12, fontWeight: 'bold' },
});

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  progressBar: { height: 3, backgroundColor: Colors.surfaceLight },
  progressFill: { height: '100%' as any, backgroundColor: Colors.warning },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
  },
  headerEmoji: { fontSize: 24 },
  headerTitle: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },
  sheriffLine: { color: Colors.warning, fontSize: 11, marginTop: 2 },
  toolColumn: { alignItems: 'flex-end', gap: 4 },
  winCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  winTitle: { fontSize: 18, fontWeight: 'bold' },
  winReason: { color: Colors.textDim, fontSize: 12, textAlign: 'center' },

  scroll: { flex: 1 },
  scrollPad: { padding: 16, gap: 10 },
  skillScreen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  skillTitle: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  skillActor: { color: Colors.textDim, fontSize: 12, fontWeight: 'bold' },
  skillCancelBtn: {
    borderWidth: 1,
    borderColor: Colors.textMuted,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skillCancelText: { color: Colors.textDim, fontSize: 11, fontWeight: 'bold' },
  skillSelection: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
  },
  skillSelectionText: { color: Colors.danger, fontSize: 13, fontWeight: 'bold' },

  hint: { color: Colors.textDim, fontSize: 12 },
  hintWarn: { color: Colors.warning, fontSize: 11 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  peaceBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  peaceEmoji: { fontSize: 48 },
  peaceText: { color: Colors.textDim, fontSize: 16 },

  deathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.danger + '50',
  },
  deathNumBox: { alignItems: 'center', minWidth: 36 },
  deathNum: { color: Colors.danger, fontSize: 22, fontWeight: 'bold', lineHeight: 26 },
  deathNumLabel: { color: Colors.textDim, fontSize: 11 },
  deathSubTitle: { color: Colors.text, fontSize: 13, fontWeight: 'bold' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  revealRoleBox: { gap: 6, marginTop: 4 },
  revealRoleHint: { color: Colors.warning, fontSize: 12, fontWeight: 'bold' },
  revealRoleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  revealRoleBtn: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: Colors.background,
  },
  revealRoleText: { fontSize: 12, fontWeight: 'bold' },

  banner: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  bannerNeutral: { borderColor: Colors.textDim },
  bannerDanger: { borderColor: Colors.danger + '80' },
  bannerText: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },

  abilityRow: { flexDirection: 'row', gap: 8 },
  abilityBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  abilityBtnOn: { borderColor: Colors.warning, backgroundColor: Colors.warning + '18' },
  abilityBtnText: { color: Colors.textDim, fontSize: 12, fontWeight: 'bold' },

  confirmBtn: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.danger + '18',
  },
  confirmBtnText: { color: Colors.danger, fontSize: 14, fontWeight: 'bold' },

  footer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceLight,
    padding: 12,
    paddingBottom: 20,
    gap: 8,
  },
  noVoteBtn: {
    borderWidth: 1.5,
    borderColor: Colors.textDim,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  noVoteBtnOn: { borderColor: Colors.success, backgroundColor: Colors.success + '15' },
  noVoteBtnText: { color: Colors.textMuted, fontSize: 13 },

  nextBtn: {
    backgroundColor: Colors.warning,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnOff: { backgroundColor: Colors.textMuted },
  nextBtnText: { color: Colors.background, fontSize: 15, fontWeight: 'bold' },

  summaryToggleBtn: {
    borderWidth: 1.5,
    borderColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  summaryToggleBtnText: { color: Colors.textDim, fontSize: 13, fontWeight: 'bold' },
  summaryBox: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.surfaceLight,
    backgroundColor: Colors.surface,
    padding: 12,
    gap: 4,
  },
  summaryLine: { color: Colors.text, fontSize: 13, lineHeight: 20 },
  summaryLineFinal: { color: Colors.primary, fontWeight: 'bold', fontSize: 14 },
});

