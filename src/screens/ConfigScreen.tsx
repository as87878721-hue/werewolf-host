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

const summarizeRoles = (config: GameConfigSnapshot) =>
  config.selectedRoles
    .map(entry => {
      const role = ROLES.find(r => r.id === entry.roleId);
      return `${role?.name ?? entry.roleId}x${entry.count}`;
    })
    .join('、');

export default function ConfigScreen() {
  const navigation = useNavigation<Nav>();
  const { gameMode, savedConfigs, applyConfig } = useGameStore();
  const defaultConfig = gameMode === 'dual' ? DEFAULT_DUAL_CONFIG : DEFAULT_SINGLE_CONFIG;
  const savedConfig = savedConfigs[gameMode];

  const chooseConfig = (config: GameConfigSnapshot) => {
    applyConfig(config);
    navigation.navigate('Setup');
  };

  const renderConfig = (label: string, config: GameConfigSnapshot, variant: 'default' | 'saved') => (
    <TouchableOpacity
      key={label}
      style={[styles.configCard, variant === 'saved' && styles.savedCard]}
      onPress={() => chooseConfig(config)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{gameMode === 'dual' ? '雙身分配置' : '單身分配置'}</Text>
          <Text style={styles.subtitle}>選擇一組配置後進入角色設定，可再微調並儲存。</Text>
        </View>

        {renderConfig('預設配置', defaultConfig, 'default')}

        {savedConfig ? (
          renderConfig('上一輪配置', savedConfig, 'saved')
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>上一輪配置</Text>
            <Text style={styles.emptyText}>尚未儲存過此模式的配置</Text>
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
  configCard: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  savedCard: { borderColor: Colors.warning },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  playerCount: { color: Colors.primary, fontSize: 14, fontWeight: 'bold' },
  configName: { color: Colors.text, fontSize: 14 },
  summary: { color: Colors.textDim, fontSize: 12, lineHeight: 18 },
  extraLine: { color: '#ffd54f', fontSize: 12, fontWeight: 'bold' },
  emptyCard: {
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  emptyTitle: { color: Colors.textDim, fontSize: 15, fontWeight: 'bold' },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
});
