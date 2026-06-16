import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Result'>;

export default function ResultScreen() {
  const navigation = useNavigation<Nav>();
  const { nightHistory, resetNight } = useGameStore();

  const lastNight = nightHistory[nightHistory.length - 1];

  const handleNextNight = () => {
    // resetNight() is now handled by DayScreen via endDay()
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'Home' }, { name: 'Day' }],
      })
    );
  };

  const handleEndGame = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      })
    );
  };

  if (!lastNight) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>沒有夜晚記錄</Text>
      </View>
    );
  }

  const summaryLines = lastNight.summary;
  const bloodMoonActive = lastNight.actions.some(a => a.roleId === 'blood_moon' && a.bloodMoonActivated);
  const hasDeath = !bloodMoonActive && summaryLines.some(l => l.includes('💀'));

  // 血月發動：💀 死亡行改為延後顯示
  const displayLines = bloodMoonActive
    ? summaryLines.map(l =>
        l.startsWith('💀 本晚死亡')
          ? '🌑 延後死亡（血月）：' + l.replace('💀 本晚死亡：', '') + '（後天公布）'
          : l
      )
    : summaryLines;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.nightTitle}>第 {lastNight.nightNumber} 晚結果</Text>
        <View style={[styles.resultBadge, hasDeath ? styles.resultBadgeDeath : bloodMoonActive ? styles.resultBadgeMoon : styles.resultBadgeSafe]}>
          <Text style={styles.resultBadgeText}>
            {hasDeath ? '💀 有人死亡' : bloodMoonActive ? '🌑 血月平安夜' : '✨ 平安夜'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {displayLines.map((line, i) => {
          const isEmpty = line.trim() === '';
          const isFinal = line.startsWith('💀') || line.startsWith('✨');
          const isMoon = line.startsWith('🌑 延後死亡');
          if (isEmpty) return <View key={i} style={styles.divider} />;
          return (
            <View key={i} style={[styles.lineRow, isFinal && styles.lineRowFinal, isMoon && styles.lineRowMoon]}>
              <Text style={[styles.lineText, isFinal && styles.lineTextFinal, isMoon && styles.lineTextMoon]}>{line}</Text>
            </View>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextNightBtn} onPress={handleNextNight}>
          <Text style={styles.nextNightBtnText}>☀️ 進入白天 / 下一晚</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={handleEndGame}>
          <Text style={styles.endBtnText}>結束本局</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  errorText: { color: Colors.textDim, textAlign: 'center', marginTop: 60, fontSize: 16 },
  header: {
    padding: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
  },
  nightTitle: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  resultBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  resultBadgeDeath: { backgroundColor: Colors.danger + '30' },
  resultBadgeSafe: { backgroundColor: Colors.village + '30' },
  resultBadgeMoon: { backgroundColor: '#9c27b030' },
  resultBadgeText: { color: Colors.text, fontWeight: 'bold', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  lineRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 6,
  },
  lineRowFinal: { backgroundColor: Colors.primary + '15', borderLeftWidth: 3, borderLeftColor: Colors.primary },
  lineRowMoon: { backgroundColor: '#9c27b015', borderLeftWidth: 3, borderLeftColor: '#9c27b0' },
  lineText: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  lineTextFinal: { color: Colors.primary, fontWeight: 'bold', fontSize: 16 },
  lineTextMoon: { color: '#ce93d8', fontWeight: 'bold', fontSize: 15 },
  divider: { height: 8 },
  footer: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceLight,
    backgroundColor: Colors.background,
  },
  nextNightBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextNightBtnText: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  endBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
  },
  endBtnText: { color: Colors.textDim, fontSize: 15 },
});
