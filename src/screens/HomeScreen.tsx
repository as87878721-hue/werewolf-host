import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { useGameStore, GameMode } from '../store/gameStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { startNewGame, nightHistory, nightOrder, currentNight, winResult } = useGameStore();

  const canContinue = nightOrder.length > 0 && winResult === null;
  const resumeScreen = nightHistory.some(record => record.nightNumber === currentNight) ? 'Day' : 'Night';

  const handleStart = (mode: GameMode) => {
    startNewGame(mode);
    navigation.navigate('Config');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.wolf}>🐺</Text>
      <Text style={styles.title}>狼人殺主持輔助</Text>
      <Text style={styles.subtitle}>協助主持人引導夜晚流程</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btn} onPress={() => handleStart('single')}>
          <Text style={styles.btnLabel}>單身分</Text>
          <Text style={styles.btnSub}>每人一張身分牌</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnDual]} onPress={() => handleStart('dual')}>
          {/* 雙身分示意小圖示 */}
          <View style={styles.dualIcon}>
            <View style={styles.dualIconInner}>
              <View style={styles.dualDiagonal} />
              <Text style={styles.dualIconTop}>上</Text>
              <Text style={styles.dualIconBottom}>下</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.btnLabel}>雙身分</Text>
            <Text style={styles.btnSub}>每人兩張身分牌，上下各一</Text>
          </View>
        </TouchableOpacity>

        {canContinue && (
          <TouchableOpacity
            style={[styles.btn, styles.btnContinue]}
            onPress={() => navigation.navigate(resumeScreen)}
          >
            <Text style={styles.btnLabel}>🌙 繼續第 {currentNight} {resumeScreen === 'Day' ? '天' : '晚'}</Text>
            <Text style={styles.btnSub}>延續上一局</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.tip}>設定腳色 → 調整夜晚順序 → 逐步引導行動 → 公布結果</Text>
    </View>
  );
}

const DUAL_ICON_SIZE = 36;
const diagonalLen = Math.sqrt(2) * DUAL_ICON_SIZE;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  wolf: { fontSize: 80, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textDim, marginBottom: 48 },

  buttons: { width: '100%', gap: 14 },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  btnDual: { backgroundColor: Colors.accent },
  btnContinue: { backgroundColor: Colors.surfaceLight },

  btnLabel: { color: Colors.text, fontSize: 17, fontWeight: 'bold' },
  btnSub: { color: Colors.text, fontSize: 12, opacity: 0.7, marginTop: 2 },

  // 雙身分示意圖示
  dualIcon: {
    width: DUAL_ICON_SIZE,
    height: DUAL_ICON_SIZE,
  },
  dualIconInner: {
    width: DUAL_ICON_SIZE,
    height: DUAL_ICON_SIZE,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.text,
    overflow: 'hidden',
  },
  dualDiagonal: {
    position: 'absolute',
    width: diagonalLen,
    height: 1.5,
    backgroundColor: Colors.text,
    top: DUAL_ICON_SIZE / 2 - 0.75,
    left: (DUAL_ICON_SIZE - diagonalLen) / 2,
    transform: [{ rotate: '-45deg' }],
  },
  dualIconTop: {
    position: 'absolute',
    top: 2,
    left: 3,
    fontSize: 9,
    color: Colors.text,
    fontWeight: 'bold',
  },
  dualIconBottom: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    fontSize: 9,
    color: Colors.text,
    fontWeight: 'bold',
    opacity: 0.6,
  },

  tip: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 48,
    lineHeight: 20,
  },
});
