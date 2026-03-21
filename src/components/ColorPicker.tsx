import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import HSVColorPicker from './HSVColorPicker';

const colorOptions = [
  { id: 'classic' as const, name: 'Classic', color: '#4A90E2' },
  { id: 'magenta' as const, name: 'Magenta', color: '#E91E63' },
  { id: 'purple'  as const, name: 'Purple',  color: '#9C27B0' },
  { id: 'green'   as const, name: 'Green',   color: '#4CAF50' },
  { id: 'forest'  as const, name: 'Forest',  color: '#4A7C59' },
  { id: 'slate'   as const, name: 'Slate',   color: '#5B7FA6' },
  { id: 'orange'  as const, name: 'Orange',  color: '#D4722A' },
  { id: 'yellow'  as const, name: 'Yellow',  color: '#FFC107' },
  { id: 'rose'    as const, name: 'Rose',    color: '#C4788A' },
];

const RAINBOW = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0088ff', '#8800ff', '#ff0000'] as const;

export default function ColorPicker() {
  const { theme, colorScheme, customColor, setColorScheme, setCustomColor } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const isCustom = colorScheme === 'custom';

  const handleCustomSelect = async (hex: string) => {
    await setCustomColor(hex);
    await setColorScheme('custom');
    setShowPicker(false);
  };

  return (
    <>
      <View style={styles.grid}>
        {colorOptions.map((option) => {
          const active = colorScheme === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.item}
              onPress={() => setColorScheme(option.id)}
              activeOpacity={0.7}>
              <View style={[styles.swatch, { backgroundColor: option.color }, active && styles.swatchActive]}>
                {active && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={[styles.name, { color: active ? option.color : theme.textSecondary }]}>
                {option.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Rainbow / custom swatch */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}>
          <LinearGradient
            colors={RAINBOW}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.swatch, isCustom && styles.swatchActive]}>
            {isCustom
              ? <Ionicons name="checkmark" size={18} color="#fff" />
              : <Ionicons name="color-palette-outline" size={18} color="#fff" />
            }
          </LinearGradient>
          <Text style={[styles.name, { color: isCustom ? customColor : theme.textSecondary }]}>
            Custom
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Color picker modal ── */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.sheet, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Custom Color</Text>
                <HSVColorPicker
                  initialColor={isCustom ? customColor : '#4A90E2'}
                  onSelect={handleCustomSelect}
                  onCancel={() => setShowPicker(false)}
                />
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  item: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  swatchActive: {
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
