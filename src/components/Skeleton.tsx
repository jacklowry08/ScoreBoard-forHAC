import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const { isDark } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
    return () => shimmer.stopAnimation();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const base = isDark ? '#2A2A2A' : '#E4E4E4';
  const highlight = isDark ? '#3C3C3C' : '#F2F2F2';

  return (
    <Animated.View style={[{ overflow: 'hidden', opacity }, style]}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: base }]} />
      <LinearGradient
        colors={[base, highlight, base]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

export function GradeCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[sk.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={sk.row}>
        <SkeletonBlock style={sk.nameLine} />
        <SkeletonBlock style={sk.badge} />
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameLine: { height: 18, flex: 1, marginRight: 10, borderRadius: 6 },
  badge: { width: 62, height: 30, borderRadius: 22 },
});
