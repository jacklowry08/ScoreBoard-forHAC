import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import {
  hacFetchAttendanceMonth,
  hacNavigateAttendanceMonth,
  AttendanceMonthData,
} from '../services/HACDirectClient';

const CACHE_PREFIX = 'attendance_month_';
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const TODAY      = new Date();
const THIS_YEAR  = TODAY.getFullYear();
const THIS_MONTH = TODAY.getMonth() + 1;
const THIS_DAY   = TODAY.getDate();

type CalCell = {
  day: number;
  dow: number;
  color: string;
  description: string;
} | null;

function buildGrid(
  year: number,
  month: number,
  attendanceDays: { day: number; color: string; description: string }[],
): CalCell[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay();

  const eventMap = new Map<number, { color: string; description: string }>();
  for (const d of attendanceDays) eventMap.set(d.day, { color: d.color, description: d.description });

  const grid: CalCell[][] = [];
  let d = 1 - firstDow;

  while (d <= daysInMonth) {
    const row: CalCell[] = [];
    for (let col = 0; col < 7; col++, d++) {
      if (d >= 1 && d <= daysInMonth) {
        const ev = eventMap.get(d);
        row.push({ day: d, dow: col, color: ev?.color ?? '', description: ev?.description ?? '' });
      } else {
        row.push(null);
      }
    }
    grid.push(row);
  }
  return grid;
}

function cacheKey(y: number, m: number) {
  return `${CACHE_PREFIX}${y}_${String(m).padStart(2, '0')}`;
}

export default function AttendanceScreen() {
  const { theme } = useTheme();
  const [data, setData]             = useState<AttendanceMonthData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => { loadCurrentMonth(); }, []);

  const loadCurrentMonth = async () => {
    setLoading(true);
    setError(null);

    // Show stale cache immediately so UI isn't blank while fetching
    try {
      const cached = await AsyncStorage.getItem(cacheKey(THIS_YEAR, THIS_MONTH));
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}

    // Always live-fetch so hiddenInputs are fresh for navigation
    const result = await hacFetchAttendanceMonth();
    if (result) {
      setData(result);
      try { await AsyncStorage.setItem(cacheKey(result.year, result.month), JSON.stringify(result)); } catch {}
    } else {
      setError('Could not load attendance.');
    }
    setLoading(false);
  };

  const navigate = async (direction: 'prev' | 'next') => {
    if (!data || navigating) return;
    setNavigating(true);
    const result = await hacNavigateAttendanceMonth(direction, data);
    if (result) {
      setData(result);
      try { await AsyncStorage.setItem(cacheKey(result.year, result.month), JSON.stringify(result)); } catch {}
    }
    setNavigating(false);
  };

  const FUTURE_LIMIT = 3; // months ahead allowed
  const isAtFutureLimit = data
    ? (data.year - THIS_YEAR) * 12 + (data.month - THIS_MONTH) >= FUTURE_LIMIT
    : false;

  const grid = data ? buildGrid(data.year, data.month, data.days) : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <Text style={[styles.title, { color: theme.headerText }]}>Attendance</Text>
      </GradientHeader>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Month navigation bar ── */}
        <View style={[styles.monthNav, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigate('prev')} disabled={navigating}>
            <Text style={[styles.navArrow, { color: navigating ? theme.textSecondary : theme.primary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: theme.text }]}>
            {data ? data.monthName : ' '}
          </Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigate('next')}
            disabled={navigating || isAtFutureLimit}>
            <Text style={[styles.navArrow, { color: (navigating || isAtFutureLimit) ? theme.textSecondary : theme.primary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {loading && !data ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading attendance...</Text>
          </View>
        ) : error && !data ? (
          <View style={styles.centerBox}>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={loadCurrentMonth}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Calendar ── */}
            <View style={[styles.calCard, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
              {/* Day-of-week header */}
              <View style={[styles.dowRow, { borderBottomColor: theme.border }]}>
                {DOW.map((d, i) => (
                  <Text
                    key={d}
                    style={[styles.dowLabel, { color: i === 0 || i === 6 ? theme.textSecondary : theme.text }]}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Calendar rows */}
              {grid.map((week, ri) => (
                <View
                  key={ri}
                  style={[
                    styles.calRow,
                    ri < grid.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                  ]}>
                  {week.map((cell, ci) => {
                    if (!cell) return <View key={ci} style={styles.calCell} />;

                    const isToday   = data?.year === THIS_YEAR && data?.month === THIS_MONTH && cell.day === THIS_DAY;
                    const isWeekend = cell.dow === 0 || cell.dow === 6;

                    return (
                      <View key={ci} style={[styles.calCell, isWeekend && styles.calCellWeekend]}>
                        <View
                          style={[
                            styles.cellInner,
                            cell.color  && { backgroundColor: cell.color + '22' },
                            isToday     && { backgroundColor: theme.primary },
                          ]}>
                          <Text style={[
                            styles.dayNum,
                            { color: isWeekend ? theme.textSecondary : theme.text },
                            isToday && { color: '#fff', fontWeight: '700' },
                          ]}>
                            {cell.day}
                          </Text>
                          {cell.color ? (
                            <View style={[styles.colorDot, { backgroundColor: isToday ? 'rgba(255,255,255,0.8)' : cell.color }]} />
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* ── Legend (from HAC) ── */}
            {data && data.legend.length > 0 && (
              <View style={[styles.legend, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
                <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>Legend</Text>
                <View style={styles.legendGrid}>
                  {data.legend.map(({ color, label }) => (
                    <View key={color + label} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={[styles.legendText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {navigating && (
        <View style={styles.navOverlay}>
          <ActivityIndicator color={theme.primary} size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { padding: 20, paddingTop: 60 },
  title:      { fontSize: 28, fontWeight: 'bold' },
  scroll:     { padding: 12, paddingBottom: 32 },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    marginBottom: 10,
  },
  navBtn:     { paddingHorizontal: 16, paddingVertical: 10 },
  navArrow:   { fontSize: 28, lineHeight: 30 },
  monthLabel: { fontSize: 17, fontWeight: '700' },

  centerBox:   { paddingVertical: 60, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorText:   { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryBtn:    { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText:   { color: '#fff', fontWeight: '600', fontSize: 14 },

  calCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  dowRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 7,
  },
  dowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  calRow:         { flexDirection: 'row' },
  calCell:        { flex: 1, padding: 2 },
  calCellWeekend: { opacity: 0.4 },
  cellInner: {
    borderRadius: 7,
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 52,
  },
  dayNum:    { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  colorDot:  { width: 8, height: 8, borderRadius: 4 },

  legend: {
    borderRadius: 16,
    padding: 14,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  legendDot:  { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendText: { fontSize: 12, flexShrink: 1 },

  navOverlay: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
