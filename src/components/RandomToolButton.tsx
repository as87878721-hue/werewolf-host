import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';

export default function RandomToolButton() {
  const playerCount = useGameStore(state => state.playerCount);
  const [pick, setPick] = useState<{ player: number; direction: '順' | '逆' } | null>(null);

  const roll = () => {
    if (playerCount <= 0) return;
    const player = Math.floor(Math.random() * playerCount) + 1;
    const direction: '順' | '逆' = Math.random() < 0.5 ? '順' : '逆';
    setPick({ player, direction });
  };

  return (
    <TouchableOpacity style={styles.button} onPress={roll} activeOpacity={0.82}>
      <View style={styles.half}>
        <Text style={styles.value}>{pick ? `${pick.player}` : '抽'}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.half}>
        <Text style={styles.value}>{pick ? pick.direction : '順逆'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 26,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: 1, backgroundColor: Colors.surfaceLight },
  value: { color: Colors.text, fontSize: 11, fontWeight: 'bold' },
});
