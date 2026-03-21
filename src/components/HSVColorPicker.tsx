import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Color math ───────────────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  return '#' + [f(5), f(3), f(1)]
    .map(x => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('');
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#4A90E2';
  const r = parseInt(safe.slice(1, 3), 16) / 255;
  const g = parseInt(safe.slice(3, 5), 16) / 255;
  const b = parseInt(safe.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, v };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PANEL_HEIGHT = 220;
const DOT = 24;
const SLIDER_H = 24;
const THUMB = 28;

const HUE_COLORS = [
  '#ff0000', '#ffff00', '#00ff00',
  '#00ffff', '#0000ff', '#ff00ff', '#ff0000',
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialColor: string;
  onSelect: (color: string) => void;
  onCancel: () => void;
}

export default function HSVColorPicker({ initialColor, onSelect, onCancel }: Props) {
  const init = hexToHsv(initialColor);
  const [h, setH] = useState(init.h);
  const [s, setS] = useState(init.s);
  const [v, setV] = useState(init.v);
  const [panelW, setPanelW] = useState(0);
  const [sliderW, setSliderW] = useState(0);

  // Refs so PanResponder callbacks (created once) always see latest values
  const hR = useRef(init.h);
  const sR = useRef(init.s);
  const vR = useRef(init.v);
  const panelWR = useRef(0);
  const sliderWR = useRef(0);

  const update = (nh: number, ns: number, nv: number) => {
    hR.current = nh; sR.current = ns; vR.current = nv;
    setH(nh); setS(ns); setV(nv);
  };

  const panelResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const ns = Math.max(0, Math.min(1, e.nativeEvent.locationX / panelWR.current));
      const nv = Math.max(0, Math.min(1, 1 - e.nativeEvent.locationY / PANEL_HEIGHT));
      update(hR.current, ns, nv);
    },
    onPanResponderMove: (e) => {
      const ns = Math.max(0, Math.min(1, e.nativeEvent.locationX / panelWR.current));
      const nv = Math.max(0, Math.min(1, 1 - e.nativeEvent.locationY / PANEL_HEIGHT));
      update(hR.current, ns, nv);
    },
  })).current;

  const hueResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const nh = Math.max(0, Math.min(360, (e.nativeEvent.locationX / sliderWR.current) * 360));
      update(nh, sR.current, vR.current);
    },
    onPanResponderMove: (e) => {
      const nh = Math.max(0, Math.min(360, (e.nativeEvent.locationX / sliderWR.current) * 360));
      update(nh, sR.current, vR.current);
    },
  })).current;

  const color = hsvToHex(h, s, v);
  const hueColor = hsvToHex(h, 1, 1);

  return (
    <View style={styles.root}>
      {/* ── SV panel ── */}
      <View
        style={styles.panel}
        onLayout={e => { const w = e.nativeEvent.layout.width; setPanelW(w); panelWR.current = w; }}
        {...panelResponder.panHandlers}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: hueColor }]} />
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          colors={['#ffffff', 'rgba(255,255,255,0)']}
        />
        <LinearGradient
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          colors={['rgba(0,0,0,0)', '#000000']}
        />
        {panelW > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.dot,
              {
                left: s * panelW - DOT / 2,
                top: (1 - v) * PANEL_HEIGHT - DOT / 2,
                backgroundColor: color,
                borderColor: v > 0.4 ? '#fff' : '#ccc',
              },
            ]}
          />
        )}
      </View>

      {/* ── Hue slider ── */}
      <View
        style={styles.sliderWrap}
        onLayout={e => { const w = e.nativeEvent.layout.width; setSliderW(w); sliderWR.current = w; }}
        {...hueResponder.panHandlers}
      >
        <LinearGradient
          pointerEvents="none"
          style={styles.slider}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          colors={HUE_COLORS}
        />
        {sliderW > 0 && (
          <View
            pointerEvents="none"
            style={[styles.thumb, {
              left: (h / 360) * sliderW - THUMB / 2,
              backgroundColor: hueColor,
            }]}
          />
        )}
      </View>

      {/* ── Preview + buttons ── */}
      <View style={styles.footer}>
        <View style={[styles.preview, { backgroundColor: color }]} />
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: color }]} onPress={() => onSelect(color)}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  panel: {
    width: '100%',
    height: PANEL_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  sliderWrap: {
    width: '100%',
    height: SLIDER_H,
    justifyContent: 'center',
  },
  slider: {
    height: SLIDER_H,
    borderRadius: SLIDER_H / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    top: (SLIDER_H - THUMB) / 2,
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  btnRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  cancelText: { fontWeight: '600', color: '#888', fontSize: 15 },
  doneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
  },
  doneText: { fontWeight: '700', color: '#fff', fontSize: 15 },
});
