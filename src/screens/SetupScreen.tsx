import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { ROLES } from '../data/roles';
import { useGameStore } from '../store/gameStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Setup'>;
type Tab = 'wolf' | 'special' | 'villager';

const TAB_CONFIG: { key: Tab; label: string; color: string }[] = [
  { key: 'wolf', label: '狼人', color: Colors.wolf },
  { key: 'special', label: '神職', color: Colors.warning },
  { key: 'villager', label: '平民', color: Colors.village },
];

const VILLAGER_IDS = new Set(['villager', 'wild_child']);
const EXTRA_OPTION_IDS = new Set(['golden_baby']);

const TAB_ROLES: Record<Tab, typeof ROLES> = {
  wolf: ROLES.filter(r => r.team === 'wolf'),
  special: ROLES.filter(r => r.team !== 'wolf' && !VILLAGER_IDS.has(r.id) && !EXTRA_OPTION_IDS.has(r.id)),
  villager: ROLES.filter(r => VILLAGER_IDS.has(r.id)),
};

const clampCount = (value: string, fallback: number) => {
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function SetupScreen() {
  const navigation = useNavigation<Nav>();
  const {
    gameMode,
    playerCount,
    selectedRoles,
    goldenBabyConfig,
    configName,
    addRole,
    removeRole,
    initNightOrder,
    setPlayerCount,
    setGoldenBabyConfig,
    setConfigName,
    saveCurrentConfig,
  } = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>('wolf');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const getCount = (roleId: string) =>
    selectedRoles.find(r => r.roleId === roleId)?.count ?? 0;

  const roleCardCount = selectedRoles.reduce((sum, r) => sum + r.count, 0);
  const thiefExtraCards = getCount('thief') > 0 ? 2 : 0;
  const baseRequiredCards = playerCount * (gameMode === 'dual' ? 2 : 1);
  const requiredCards = baseRequiredCards + thiefExtraCards;
  const missingCards = Math.max(0, requiredCards - roleCardCount);
  const goldenRangeValid = gameMode === 'single' || goldenBabyConfig.min <= goldenBabyConfig.max;
  const canNext = playerCount >= 4 && roleCardCount >= requiredCards && goldenRangeValid;

  const toggleDesc = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const setGoldenMin = (text: string) => {
    const min = clampCount(text, goldenBabyConfig.min);
    setGoldenBabyConfig({ min, max: goldenBabyConfig.max });
  };

  const setGoldenMax = (text: string) => {
    const max = clampCount(text, goldenBabyConfig.max);
    setGoldenBabyConfig({ min: goldenBabyConfig.min, max });
  };

  const handleNext = () => {
    if (!canNext) return;
    initNightOrder();
    navigation.navigate('Order');
  };

  const roles = TAB_ROLES[activeTab];
  const activeColor = TAB_CONFIG.find(t => t.key === activeTab)!.color;
  const pickedRoles = selectedRoles
    .filter(r => r.count > 0)
    .map(r => ({ def: ROLES.find(d => d.id === r.roleId), count: r.count }))
    .filter((r): r is { def: (typeof ROLES)[number]; count: number } => Boolean(r.def));

  return (
    <View style={styles.container}>
      <View style={styles.setupPanel}>
        <View style={styles.configNameBox}>
          <Text style={styles.fieldLabel}>配置名稱</Text>
          <TextInput
            value={configName}
            onChangeText={setConfigName}
            style={styles.input}
            placeholder="輸入配置名稱"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>遊戲人數</Text>
            <TextInput
              value={String(playerCount)}
              onChangeText={text => setPlayerCount(clampCount(text, playerCount))}
              keyboardType="number-pad"
              style={styles.input}
              maxLength={2}
            />
          </View>
          <View style={styles.cardStatus}>
            <Text style={styles.statusMain}>{roleCardCount}/{requiredCards}</Text>
            <Text style={styles.statusSub}>
              {missingCards > 0 ? `仍缺 ${missingCards} 張角色牌` : '角色牌足夠'}
            </Text>
          </View>
        </View>

        <View style={styles.ruleBox}>
          <Text style={styles.ruleText}>
            {gameMode === 'dual' ? '雙身分：玩家人數 x 2' : '單身分：玩家人數'}
            {thiefExtraCards > 0 ? '，盜賊額外 +2 張' : ''}
          </Text>
        </View>

        {gameMode === 'dual' && (
          <>
            <View style={styles.goldenBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>金寶寶數量範圍</Text>
                <Text style={styles.goldenHint}>金寶寶不是角色牌，不計入角色牌數。</Text>
              </View>
              <TextInput
                value={String(goldenBabyConfig.min)}
                onChangeText={setGoldenMin}
                keyboardType="number-pad"
                style={styles.smallInput}
                maxLength={2}
              />
              <Text style={styles.rangeDash}>-</Text>
              <TextInput
                value={String(goldenBabyConfig.max)}
                onChangeText={setGoldenMax}
                keyboardType="number-pad"
                style={styles.smallInput}
                maxLength={2}
              />
            </View>
            {!goldenRangeValid && <Text style={styles.errorText}>金寶寶下界不可大於上界</Text>}
          </>
        )}
      </View>

      <View style={styles.tabBar}>
        {TAB_CONFIG.map(tab => {
          const isActive = activeTab === tab.key;
          const tabCount = TAB_ROLES[tab.key].reduce((sum, r) => sum + getCount(r.id), 0);
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: tab.color }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, isActive && { color: tab.color }]}>{tab.label}</Text>
              {tabCount > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: tab.color }]}>
                  <Text style={styles.tabBadgeText}>{tabCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.list}>
        {roles.map(role => {
          const count = getCount(role.id);
          const isOpen = expanded.has(role.id);
          return (
            <View key={role.id} style={[styles.row, count > 0 && { borderLeftColor: activeColor }]}>
              <TouchableOpacity style={styles.emojiBtn} onPress={() => toggleDesc(role.id)} activeOpacity={0.6}>
                <Text style={styles.emoji}>{role.emoji}</Text>
                <Text style={styles.emojiHint}>{isOpen ? '收合' : '說明'}</Text>
              </TouchableOpacity>

              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.roleName}>{role.name}</Text>
                  {role.hasNightAction && (
                    <View style={styles.nightTag}>
                      <Text style={styles.nightTagText}>夜晚</Text>
                    </View>
                  )}
                </View>
                {isOpen && <Text style={styles.desc}>{role.description}</Text>}
              </View>

              <View style={styles.counter}>
                <TouchableOpacity
                  style={[styles.cBtn, count === 0 && styles.cBtnDisabled]}
                  onPress={() => removeRole(role.id)}
                  disabled={count === 0}
                >
                  <Text style={styles.cBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.cNum, count > 0 && { color: activeColor }]}>{count}</Text>
                <TouchableOpacity style={styles.cBtn} onPress={() => addRole(role.id)}>
                  <Text style={styles.cBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {pickedRoles.length > 0 && (
          <View style={styles.summaryWrap}>
            {pickedRoles.map(({ def, count }) => {
              const c = def.team === 'wolf' ? Colors.wolf
                : def.team === 'village' ? Colors.village
                : Colors.neutral;
              return (
                <View key={def.id} style={[styles.chip, { borderColor: c }]}>
                  <Text style={[styles.chipName, { color: c }]}>{def.name}</Text>
                  <Text style={[styles.chipCount, { color: c }]}>x{count}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footerBottom}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveCurrentConfig}>
            <Text style={styles.saveBtnText}>儲存配置</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, !canNext && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canNext}
          >
            <Text style={styles.nextBtnText}>
              {playerCount < 4 ? '至少 4 人' : missingCards > 0 ? `仍缺 ${missingCards} 張` : !goldenRangeValid ? '檢查金寶寶' : '下一步'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footerInfo}>玩家 {playerCount} 人 · 角色牌 {roleCardCount}/{requiredCards}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  setupPanel: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
    padding: 12,
    gap: 8,
  },
  configNameBox: { gap: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldBlock: { width: 92, gap: 4 },
  fieldLabel: { color: Colors.text, fontSize: 12, fontWeight: 'bold' },
  input: {
    backgroundColor: Colors.background,
    color: Colors.text,
    borderColor: Colors.surfaceLight,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 15,
    fontWeight: 'bold',
  },
  cardStatus: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    padding: 10,
  },
  statusMain: { color: Colors.primary, fontSize: 19, fontWeight: 'bold' },
  statusSub: { color: Colors.textDim, fontSize: 12, marginTop: 2 },
  ruleBox: { backgroundColor: Colors.background, borderRadius: 8, padding: 8 },
  ruleText: { color: Colors.textDim, fontSize: 12 },
  goldenBox: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  goldenHint: { color: Colors.textDim, fontSize: 11, marginTop: 2 },
  smallInput: {
    width: 42,
    backgroundColor: Colors.background,
    color: '#ffd54f',
    borderColor: '#ffd54f',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  rangeDash: { color: Colors.textDim, fontSize: 14 },
  errorText: { color: Colors.danger, fontSize: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { color: Colors.textDim, fontSize: 14, fontWeight: 'bold' },
  tabBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: { color: Colors.background, fontSize: 11, fontWeight: 'bold' },
  scrollArea: { flex: 1 },
  list: { paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  emojiBtn: { alignItems: 'center', width: 42 },
  emoji: { fontSize: 26, textAlign: 'center' },
  emojiHint: { fontSize: 9, color: Colors.textMuted, marginTop: 1 },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  roleName: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },
  nightTag: { backgroundColor: Colors.surfaceLight, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  nightTagText: { fontSize: 11, color: Colors.textDim },
  desc: { color: Colors.textDim, fontSize: 12, lineHeight: 17 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cBtn: {
    width: 32,
    height: 32,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
  },
  cBtnDisabled: { opacity: 0.3 },
  cBtnText: { color: Colors.text, fontSize: 18, fontWeight: 'bold', lineHeight: 22 },
  cNum: { color: Colors.text, fontSize: 16, fontWeight: 'bold', minWidth: 22, textAlign: 'center' },
  footer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceLight,
    paddingBottom: 18,
  },
  summaryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 2,
  },
  chipName: { fontSize: 13, fontWeight: 'bold' },
  chipCount: { fontSize: 12, fontWeight: 'bold' },
  footerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
  },
  saveBtn: {
    borderWidth: 1.5,
    borderColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: Colors.text, fontSize: 13, fontWeight: 'bold' },
  nextBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: Colors.textMuted },
  nextBtnText: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },
  footerInfo: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 },
});
