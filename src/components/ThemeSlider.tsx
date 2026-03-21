import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type ThemeOption = 'light' | 'system' | 'dark';

const OPTIONS: { key: ThemeOption; label: string; icon: string; iconOutline: string }[] = [
  { key: 'light',  label: 'Light',  icon: 'sunny',         iconOutline: 'sunny-outline' },
  { key: 'system', label: 'System', icon: 'contrast',      iconOutline: 'contrast-outline' },
  { key: 'dark',   label: 'Dark',   icon: 'moon',          iconOutline: 'moon-outline' },
];

export default function ThemeSlider() {
  const { theme, isDark, syncToSystem, manualMode, setManualMode, setSyncToSystem } = useTheme();
  const slideAnim = useRef(new Animated.Value(syncToSystem ? 1 : (manualMode === 'light' ? 0 : 2))).current;

  const getCurrentOption = (): ThemeOption => {
    if (syncToSystem) return 'system';
    return manualMode;
  };

  const currentOption = getCurrentOption();

  useEffect(() => {
    const targetValue = currentOption === 'light' ? 0 : currentOption === 'system' ? 1 : 2;
    Animated.spring(slideAnim, {
      toValue: targetValue,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [currentOption]);

  const handleOptionPress = (option: ThemeOption) => {
    if (option === 'system') {
      setSyncToSystem(true);
    } else {
      setSyncToSystem(false);
      setManualMode(option);
    }
  };

  const sliderWidth = Dimensions.get('window').width - 80;
  const optionWidth = sliderWidth / 3;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, optionWidth, optionWidth * 2],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.sliderTrack, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Animated.View
          style={[
            styles.sliderThumb,
            {
              backgroundColor: theme.primary,
              width: optionWidth - 8,
              transform: [{ translateX }],
            },
          ]}
        />

        {OPTIONS.map((opt) => {
          const active = currentOption === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.option, { width: optionWidth }]}
              onPress={() => handleOptionPress(opt.key)}
              activeOpacity={0.7}>
              <Ionicons
                name={(active ? opt.icon : opt.iconOutline) as any}
                size={18}
                color={active ? '#fff' : theme.textSecondary as string}
                style={styles.icon}
              />
              <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.statusText, { color: theme.textSecondary }]}>
        Currently: {isDark ? 'Dark' : 'Light'} Mode
        {syncToSystem && ' (Following System)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  sliderTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    position: 'relative',
  },
  sliderThumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  option: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  icon: {
    marginBottom: 2,
  },
  optionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
