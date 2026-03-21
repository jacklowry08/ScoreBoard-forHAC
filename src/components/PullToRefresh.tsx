import React, { useRef, useEffect } from 'react';
import {
  View,
  PanResponder,
  Animated,
  ActivityIndicator,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const THRESHOLD = 65;    // px to pull before refresh is armed
const HELD_HEIGHT = 46;  // px indicator holds at while refreshing

export interface PullScrollProps {
  scrollEnabled: boolean;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  bounces: boolean;
}

interface Props {
  onRefresh: () => void;
  refreshing: boolean;
  color: string;
  disabled?: boolean;
  children: (scrollProps: PullScrollProps) => React.ReactNode;
}

export function PullToRefresh({ onRefresh, refreshing, color, disabled, children }: Props) {
  const pullAnim = useRef(new Animated.Value(0)).current;
  const isAtTopRef = useRef(true);
  const isDraggingRef = useRef(false);
  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const distanceRef = useRef(0);

  // Keep refs in sync with props so panResponder callbacks (created once) see latest values
  const refreshingRef = useRef(refreshing);
  const disabledRef = useRef(disabled ?? false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);
  useEffect(() => { disabledRef.current = disabled ?? false; }, [disabled]);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  // When refreshing goes from true → false, animate indicator back to 0
  const prevRefreshing = useRef(refreshing);
  useEffect(() => {
    if (prevRefreshing.current && !refreshing && !isDraggingRef.current) {
      Animated.spring(pullAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      }).start();
    }
    prevRefreshing.current = refreshing;
  }, [refreshing]);

  const reset = () => {
    isDraggingRef.current = false;
    distanceRef.current = 0;
    setScrollEnabled(true);
    Animated.spring(pullAnim, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !disabledRef.current &&
        !refreshingRef.current &&
        isAtTopRef.current &&
        gs.dy > 5 &&
        Math.abs(gs.dy) > Math.abs(gs.dx),

      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        setScrollEnabled(false);
      },

      onPanResponderMove: (_, gs) => {
        if (gs.dy <= 0) {
          distanceRef.current = 0;
          pullAnim.setValue(0);
          return;
        }
        // Elastic feel: full speed to threshold, then slow past it
        const d = gs.dy <= THRESHOLD
          ? gs.dy
          : THRESHOLD + (gs.dy - THRESHOLD) * 0.3;
        distanceRef.current = Math.min(d, THRESHOLD * 1.7);
        pullAnim.setValue(distanceRef.current);
      },

      onPanResponderRelease: () => {
        const d = distanceRef.current;
        isDraggingRef.current = false;
        distanceRef.current = 0;
        setScrollEnabled(true);

        if (d >= THRESHOLD) {
          // Hold indicator in place and fire the refresh
          Animated.spring(pullAnim, {
            toValue: HELD_HEIGHT,
            useNativeDriver: false,
            friction: 8,
          }).start();
          onRefreshRef.current();
        } else {
          // Released before threshold — snap back without refreshing
          Animated.spring(pullAnim, {
            toValue: 0,
            useNativeDriver: false,
            friction: 8,
          }).start();
        }
      },

      onPanResponderTerminate: reset,
    }),
  ).current;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isAtTopRef.current = e.nativeEvent.contentOffset.y <= 0;
  };

  const iconOpacity = pullAnim.interpolate({
    inputRange: [15, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const iconRotate = pullAnim.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Animated indicator that grows in from the top */}
      <Animated.View style={[styles.indicator, { height: pullAnim }]}>
        <View style={styles.iconWrap}>
          {refreshing ? (
            <ActivityIndicator color={color} size="small" />
          ) : (
            <Animated.View style={{ opacity: iconOpacity, transform: [{ rotate: iconRotate }] }}>
              <Feather name="arrow-down" size={18} color={color} />
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {children({ scrollEnabled, onScroll, scrollEventThrottle: 16, bounces: false })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  indicator: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconWrap: {
    height: HELD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
