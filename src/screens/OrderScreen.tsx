import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  PanResponder, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Colors } from '../theme/colors';
import { ROLES } from '../data/roles';
import { useGameStore } from '../store/gameStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Order'>;

const ITEM_HEIGHT = 74;

// ── 拖曳把手：PanResponder 吸附在這顆點上，透過 ref 避免 stale closure ──
function DragHandle({
  index,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  index: number;
  onDragStart: (i: number) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
}) {
  const indexRef = useRef(index);
  indexRef.current = index;
  const cbRef = useRef({ onDragStart, onDragMove, onDragEnd });
  cbRef.current = { onDragStart, onDragMove, onDragEnd };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => cbRef.current.onDragStart(indexRef.current),
      onPanResponderMove: (_, gs) => cbRef.current.onDragMove(gs.dy),
      onPanResponderRelease: () => cbRef.current.onDragEnd(),
      onPanResponderTerminate: () => cbRef.current.onDragEnd(),
    })
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={styles.dragHandle}
    >
      <Text style={styles.dragIcon}>⠿</Text>
    </View>
  );
}

interface DragState {
  fromIndex: number;
  insertIndex: number;
  role: (typeof ROLES)[0];
}

export default function OrderScreen() {
  const navigation = useNavigation<Nav>();
  const { nightOrder, reorderNightOrder } = useGameStore();
  const [order, setOrder] = useState([...nightOrder]);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const orderRef = useRef(order);
  orderRef.current = order;
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const scrollOffsetYRef = useRef(0);

  const dragTranslateY = useRef(new Animated.Value(0)).current;

  // ── 拖曳開始：浮起物件 ──
  const handleDragStart = useCallback((fromIndex: number) => {
    const role = ROLES.find(r => r.id === orderRef.current[fromIndex]);
    if (!role) return;
    dragTranslateY.setValue(0);
    setDragState({ fromIndex, insertIndex: fromIndex, role });
  }, []);

  // ── 拖曳移動：更新 Animated.Value + 插入點 ──
  const handleDragMove = useCallback((dy: number) => {
    const curr = dragStateRef.current;
    if (!curr) return;
    const len = orderRef.current.length;
    // 限制在清單範圍內
    const maxUp = -(curr.fromIndex * ITEM_HEIGHT);
    const maxDown = (len - 1 - curr.fromIndex) * ITEM_HEIGHT;
    const clamped = Math.max(maxUp, Math.min(maxDown, dy));
    dragTranslateY.setValue(clamped);
    const newInsert = Math.max(0, Math.min(len - 1, Math.round(curr.fromIndex + clamped / ITEM_HEIGHT)));
    if (newInsert !== curr.insertIndex) {
      setDragState(prev => prev ? { ...prev, insertIndex: newInsert } : null);
    }
  }, []);

  // ── 拖曳放開：重新排序 ──
  const handleDragEnd = useCallback(() => {
    const curr = dragStateRef.current;
    if (!curr) return;
    const { fromIndex, insertIndex } = curr;
    if (fromIndex !== insertIndex) {
      const next = [...orderRef.current];
      next.splice(insertIndex, 0, next.splice(fromIndex, 1)[0]);
      orderRef.current = next;
      setOrder(next);
      reorderNightOrder(next);
    }
    dragTranslateY.setValue(0);
    setDragState(null);
  }, [reorderNightOrder]);

  // ── 計算非拖曳物件的位移（騰出插入空隙）──
  const getShift = (index: number): number => {
    if (!dragState || dragState.fromIndex === dragState.insertIndex) return 0;
    const { fromIndex, insertIndex } = dragState;
    if (fromIndex < insertIndex) {
      if (index > fromIndex && index <= insertIndex) return -ITEM_HEIGHT;
    } else {
      if (index >= insertIndex && index < fromIndex) return ITEM_HEIGHT;
    }
    return 0;
  };

  return (
    <View style={styles.container}>
      <View style={styles.hint}>
        <Text style={styles.hintText}>拖曳右側 ⠿ 調整夜晚行動順序</Text>
      </View>

      {/* 清單區 + 浮起覆蓋層 */}
      <View style={styles.listArea}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          scrollEnabled={dragState === null}
          onScroll={event => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {order.length === 0 && (
            <Text style={styles.emptyText}>本局沒有夜間行動的腳色</Text>
          )}
          {order.map((roleId, index) => {
            const role = ROLES.find(r => r.id === roleId);
            if (!role) return null;
            const isDragging = dragState?.fromIndex === index;
            const shift = getShift(index);
            return (
              <View
                key={roleId}
                style={[
                  styles.row,
                  isDragging && styles.rowGhosted,
                  shift !== 0 && { transform: [{ translateY: shift }] },
                ]}
              >
                <View style={styles.orderBadge}>
                  <Text style={styles.orderNum}>{index + 1}</Text>
                </View>
                <Text style={styles.emoji}>{role.emoji}</Text>
                <View style={styles.info}>
                  <Text style={styles.name}>{role.name}</Text>
                  <Text style={styles.prompt} numberOfLines={2}>{role.actionPrompt}</Text>
                </View>
                <DragHandle
                  index={index}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                />
              </View>
            );
          })}
        </ScrollView>

        {/* 浮起的拖曳中物件 */}
        {dragState && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.row,
              styles.rowFloating,
              {
                top: dragState.fromIndex * ITEM_HEIGHT - scrollOffsetYRef.current,
                transform: [{ translateY: dragTranslateY }],
              },
            ]}
          >
            <View style={[styles.orderBadge, styles.orderBadgeActive]}>
              <Text style={styles.orderNum}>{dragState.insertIndex + 1}</Text>
            </View>
            <Text style={styles.emoji}>{dragState.role.emoji}</Text>
            <View style={styles.info}>
              <Text style={styles.name}>{dragState.role.name}</Text>
              <Text style={styles.prompt} numberOfLines={2}>{dragState.role.actionPrompt}</Text>
            </View>
            <View style={styles.dragHandle}>
              <Text style={[styles.dragIcon, { color: Colors.primary }]}>⠿</Text>
            </View>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => navigation.navigate('Night')}
        >
          <Text style={styles.startBtnText}>🌙 開始夜晚</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  hint: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
  },
  hintText: { color: Colors.textDim, fontSize: 13, textAlign: 'center' },
  emptyText: { color: Colors.textDim, textAlign: 'center', marginTop: 60, fontSize: 15 },

  listArea: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceLight,
    gap: 12,
    height: ITEM_HEIGHT,
    backgroundColor: Colors.background,
    // 防止 web 拖曳時選取文字
    ...({ userSelect: 'none' } as object),
  },

  rowGhosted: {
    opacity: 0.2,
  },

  rowFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 0,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 100,
  },

  orderBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeActive: {
    backgroundColor: Colors.primary + '55',
  },
  orderNum: { color: Colors.primary, fontWeight: 'bold', fontSize: 14 },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { color: Colors.text, fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  prompt: { color: Colors.textDim, fontSize: 12, lineHeight: 17 },

  dragHandle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...({ cursor: 'grab' } as object),
  },
  dragIcon: { color: Colors.textDim, fontSize: 22 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceLight,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { color: Colors.text, fontSize: 17, fontWeight: 'bold' },
});
