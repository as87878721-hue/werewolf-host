import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { ROLES } from '../data/roles';
import {
  DEFAULT_DUAL_CONFIG,
  DEFAULT_SINGLE_CONFIG,
  GameConfigSnapshot,
  useGameStore,
} from '../store/gameStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Config'>;
type ConfigVariant = 'default' | 'last' | 'saved';

const summarizeRoles = (config: GameConfigSnapshot) =>
  config.selectedRoles
    .map(entry => {
      const role = ROLES.find(r => r.id === entry.roleId);
      return `${role?.name ?? entry.roleId}×${entry.count}`;
    })
    .join('、');

export default function ConfigScreen() {
  const navigation = useNavigation<Nav>();
  const { gameMode, lastConfigs, savedConfigs, applyConfig, deleteSavedConfig } = useGameStore();
  const defaultConfig = gameMode === 'dual' ? DEFAULT_DUAL_CONFIG : DEFAULT_SINGLE_CONFIG;
  const lastConfig = lastConfigs[gameMode];
  const customConfigs = savedConfigs[gameMode] ?? [];

  const chooseConfig = (config: GameConfigSnapshot) => {
    applyConfig(config);
    navigation.navigate('Setup');
  };

  const renderConfig = (label: string, config: GameConfigSnapshot, variant: ConfigVariant, index?: number) => (
    <View
      key={`${variant}-${index ?? 0}-${config.name}`}
      style={[
        styles.configCard,
        variant === 'last' && styles.lastCard,
        variant === 'saved' && styles.savedCard,
      ]}
    >
      <TouchableOpacity
        style={styles.configSelect}
        onPress={() => chooseConfig(config)}
        activeOpacity={0.8}
      >
        <View style={[styles.cardHeader, variant === 'saved' && styles.savedCardHeader]}>
          <Text style={styles.cardTitle}>{label}</Text>
          <Text style={styles.playerCount}>{config.playerCount} 人</Text>
        </View>
        <Text style={styles.configName}>{config.name}</Text>
        <Text style={styles.summary} numberOfLines={4}>{summarizeRoles(config)}</Text>
        {config.mode === 'dual' && (
          <Text style={styles.extraLine}>
            金寶寶：{config.goldenBabyConfig.min}-{config.goldenBabyConfig.max}
          </Text>
        )}
        {config.mode === 'single' && (
          <Text style={styles.extraLine}>
            勝利條件：{config.singleWinRule === 'city' ? '屠城' : '屠邊'}
          </Text>
        )}
      </TouchableOpacity>
      {variant === 'saved' && index !== undefined && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteSavedConfig(gameMode, index)}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteButtonText}>刪除</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{gameMode === 'dual' ? '雙身分配置' : '單身分配置'}</Text>
          <Text style={styles.subtitle}>選擇一組配置後進入角色設定，也可以在設定頁另存新配置。</Text>
        </View>

        {renderConfig('預設配置', defaultConfig, 'default')}

        {lastConfig ? (
          renderConfig('上一輪配置', lastConfig, 'last')
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>上一輪配置</Text>
            <Text style={styles.emptyText}>開始一局後，系統會自動記錄該局使用的配置。</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>儲存配置</Text>
          <Text style={styles.sectionSub}>手動儲存的配置會出現在這裡</Text>
        </View>

        {customConfigs.length > 0 ? (
          customConfigs.map((config, index) => renderConfig(`儲存配置 ${index + 1}`, config, 'saved', index))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>尚無儲存配置</Text>
            <Text style={styles.emptyText}>在角色設定頁按「儲存配置」後，會新增到這一區。</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  header: { paddingVertical: 6, gap: 4 },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: Colors.textDim, fontSize: 13, lineHeight: 18 },
  sectionHeader: { marginTop: 4, gap: 2 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  sectionSub: { color: Colors.textDim, fontSize: 12 },
  configCard: {
    position: 'relative',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
  },
  configSelect: {
    padding: 14,
    gap: 8,
  },
  lastCard: { borderColor: Colors.warning },
  savedCard: { borderColor: Colors.village },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savedCardHeader: { paddingRight: 58 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  playerCount: { color: Colors.primary, fontSize: 14, fontWeight: 'bold' },
  configName: { color: Colors.text, fontSize: 14 },
  summary: { color: Colors.textDim, fontSize: 12, lineHeight: 18 },
  extraLine: { color: '#ffd54f', fontSize: 12, fontWeight: 'bold' },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 48,
    height: 34,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 6,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: Colors.danger, fontSize: 12, fontWeight: 'bold' },
  emptyCard: {
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  emptyTitle: { color: Colors.textDim, fontSize: 15, fontWeight: 'bold' },
  emptyText: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
});

