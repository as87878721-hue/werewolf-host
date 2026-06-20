import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

export interface RoleInfo {
  name: string;
  teamColor: string;
}

interface Props {
  num: number;
  size: number;
  bg: string;
  border: string;
  textColor: string;
  label?: string;
  sublabel?: string;
  isDead?: boolean;
  isDualMode?: boolean;
  upperRole?: RoleInfo;
  lowerRole?: RoleInfo;
  upperRoleTextColor?: string;
  lowerRoleTextColor?: string;
  upperDead?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function PlayerButton({
  num, size, bg, border, textColor, label, sublabel,
  isDead, isDualMode, upperRole, lowerRole, upperRoleTextColor, lowerRoleTextColor, upperDead, disabled,
  onPress,
}: Props) {
  const radius = size * 0.18;
  const numFontSize = Math.max(9, size * 0.26);
  const roleFontSize = Math.max(7, size * 0.15);
  const diagonalLen = Math.sqrt(2) * size;

  // Triangle fill colors
  const upperFill = isDead
    ? '#5c5c5c'
    : upperDead
    ? '#5c5c5c'
    : upperRole
    ? upperRole.teamColor + 'aa'
    : 'transparent';

  const lowerFill = isDead
    ? '#5c5c5c'
    : lowerRole
    ? lowerRole.teamColor + 'aa'
    : 'transparent';

  return (
    <View style={{ alignItems: 'center', opacity: isDead ? 0.42 : disabled ? 0.35 : 1 }}>
      {/* Number above the box */}
      <Text
        style={{
          fontSize: numFontSize,
          fontWeight: 'bold',
          color: isDead ? Colors.textMuted : textColor,
          lineHeight: numFontSize * 1.3,
          marginBottom: 3,
        }}
      >
        {num}
      </Text>

      {/* The box */}
      <TouchableOpacity
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1.5,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={onPress}
        activeOpacity={isDead || disabled ? 1 : 0.7}
        disabled={!!isDead || !!disabled}
      >
        {isDualMode ? (
          <>
            {/* Upper-left triangle fill (above "/" diagonal) */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderTopWidth: size,
                borderTopColor: upperFill,
                borderRightWidth: size,
                borderRightColor: 'transparent',
              }}
            />

            {/* Lower-right triangle fill (below "/" diagonal) */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 0,
                height: 0,
                borderStyle: 'solid',
                borderBottomWidth: size,
                borderBottomColor: lowerFill,
                borderLeftWidth: size,
                borderLeftColor: 'transparent',
              }}
            />

            {/* Diagonal "/" line */}
            <View
              style={{
                position: 'absolute',
                width: diagonalLen,
                height: 1.5,
                backgroundColor: isDead ? Colors.textMuted : border,
                opacity: 0.55,
                top: size / 2 - 0.75,
                left: (size - diagonalLen) / 2,
                transform: [{ rotate: '-45deg' }],
              }}
            />

            {/* Upper-left role name */}
            {upperRole && (
              <Text
                numberOfLines={1}
                style={{
                  position: 'absolute',
                  top: size * 0.04,
                  left: size * 0.05,
                  fontSize: roleFontSize,
                  fontWeight: 'bold',
                  color: upperRoleTextColor ?? Colors.text,
                  opacity: isDead ? 0.85 : upperDead ? 0.7 : 0.9,
                  maxWidth: size * 0.48,
                }}
              >
                {upperRole.name}
              </Text>
            )}

            {/* Lower-right role name */}
            {lowerRole && (
              <Text
                numberOfLines={1}
                style={{
                  position: 'absolute',
                  bottom: size * 0.04,
                  right: size * 0.05,
                  fontSize: roleFontSize,
                  fontWeight: 'bold',
                  color: lowerRoleTextColor ?? Colors.text,
                  opacity: 0.9,
                  maxWidth: size * 0.48,
                  textAlign: 'right',
                }}
              >
                {lowerRole.name}
              </Text>
            )}

            {/* Action label (shown in center) */}
            {label && (
              <Text
                style={{
                  fontSize: size * 0.22,
                  fontWeight: 'bold',
                  color: isDead ? Colors.textMuted : Colors.text,
                }}
              >
                {label}
              </Text>
            )}

            {/* Sublabel: top-right corner marker (e.g. bishop ✝️) */}
            {sublabel && (
              <Text
                style={{
                  position: 'absolute',
                  top: size * 0.03,
                  right: size * 0.05,
                  fontSize: size * 0.22,
                  lineHeight: size * 0.28,
                }}
              >
                {sublabel}
              </Text>
            )}
          </>
        ) : (
          /* Single mode: label in center + sublabel top-right */
          <>
            {label ? (
              <Text
                style={{
                  fontSize: size * 0.22,
                  fontWeight: 'bold',
                  color: isDead ? Colors.textMuted : border,
                }}
              >
                {label}
              </Text>
            ) : null}
            {sublabel && (
              <Text
                style={{
                  position: 'absolute',
                  top: size * 0.03,
                  right: size * 0.05,
                  fontSize: size * 0.22,
                  lineHeight: size * 0.28,
                }}
              >
                {sublabel}
              </Text>
            )}
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
