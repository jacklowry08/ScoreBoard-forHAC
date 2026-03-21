import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

function darkenHex(hex: string, amount = 30): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface GradientHeaderProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function GradientHeader({ style, children }: GradientHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.shadow, { shadowColor: theme.primary }]}>
      <LinearGradient
        colors={[theme.primary, darkenHex(theme.primary, 30)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={style}>
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1,
  },
});
