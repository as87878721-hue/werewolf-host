import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../theme/colors';
import { GameLogEntry, useGameStore } from '../store/gameStore';

interface LogGroup {
  id: string;
  title: string;
  summary: string[];
  details: GameLogEntry[];
}

function getGroupKind(phase: string): 'day' | 'night' {
  return phase.includes('白天') || phase.includes('日') ? 'day' : 'night';
}

function isSummaryLine(entry: GameLogEntry) {
  if (!entry.phase.includes('結算')) return false;
  return (
    entry.text.includes('死亡') ||
    entry.text.includes('死訊') ||
    entry.text.includes('平安') ||
    entry.text.includes('新增死亡')
  );
}

function buildGroups(entries: GameLogEntry[]): LogGroup[] {
  const map = new Map<string, LogGroup>();

  for (const entry of entries) {
    const kind = getGroupKind(entry.phase);
    const id = `${entry.night}-${kind}`;
    const title = `第 ${entry.night} 晚${kind === 'night' ? '黑夜' : '白天'}`;
    const group = map.get(id) ?? { id, title, summary: [], details: [] };

    group.details.push(entry);
    if (isSummaryLine(entry)) group.summary.push(entry.text);
    map.set(id, group);
  }

  return [...map.values()].sort((a, b) => {
    const [nightA, kindA] = a.id.split('-');
    const [nightB, kindB] = b.id.split('-');
    const nightDiff = Number(nightA) - Number(nightB);
    if (nightDiff !== 0) return nightDiff;
    return kindA === kindB ? 0 : kindA === 'night' ? -1 : 1;
  });
}

export default function LogButton() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const gameLog = useGameStore(state => state.gameLog);
  const groups = useMemo(() => buildGroups(gameLog), [gameLog]);

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.buttonText}>日誌</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.title}>上帝日誌</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>關閉</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.list} contentContainerStyle={styles.listPad}>
              {gameLog.length === 0 ? (
                <Text style={styles.empty}>尚無紀錄</Text>
              ) : (
                groups.map(group => {
                  const isOpen = expanded[group.id] ?? false;
                  const summary = group.summary.length > 0 ? group.summary : ['尚無死亡資訊'];
                  return (
                    <View key={group.id} style={styles.row}>
                      <TouchableOpacity
                        style={styles.groupHead}
                        onPress={() => setExpanded(prev => ({ ...prev, [group.id]: !isOpen }))}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.meta}>{group.title}</Text>
                          <Text style={styles.text}>{summary.join('\n')}</Text>
                        </View>
                        <Text style={styles.expandText}>{isOpen ? '收起' : '展開'}</Text>
                      </TouchableOpacity>
                      {isOpen && (
                        <View style={styles.detailBox}>
                          <Text style={styles.detailTitle}>夜晚動作 / 階段紀錄</Text>
                          <Text style={styles.detailText}>
                            {group.details.map(entry => `${entry.phase}：${entry.text}`).join('\n')}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  buttonText: { color: Colors.text, fontSize: 12, fontWeight: 'bold' },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  panel: {
    width: '100%',
    maxHeight: '78%',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
  },
  title: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  closeBtn: {
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  closeText: { color: Colors.textDim, fontSize: 12, fontWeight: 'bold' },
  list: { maxHeight: 520 },
  listPad: { padding: 12, gap: 8 },
  empty: { color: Colors.textDim, textAlign: 'center', paddingVertical: 24 },
  row: {
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    borderRadius: 8,
    padding: 9,
    backgroundColor: Colors.background,
    gap: 4,
  },
  meta: { color: Colors.primary, fontSize: 11, fontWeight: 'bold' },
  text: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandText: { color: Colors.warning, fontSize: 12, fontWeight: 'bold' },
  detailBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceLight,
    marginTop: 8,
    paddingTop: 8,
    gap: 4,
  },
  detailTitle: { color: Colors.textDim, fontSize: 11, fontWeight: 'bold' },
  detailText: { color: Colors.textDim, fontSize: 12, lineHeight: 17 },
});
