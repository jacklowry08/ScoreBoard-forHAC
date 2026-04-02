import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScalePressable from '../components/ScalePressable';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { GradeCacheService } from '../services/GradeCacheService';
import { Assignment } from '../services/webScraper';
import { gradeColor, FORMATIVE, SUMMATIVE } from '../constants/colors';

const SNAPSHOT_KEY = 'home_activity_snapshot';
const MAX_ITEMS = 25;

type ActivityItem = {
  key: string;
  classId: string;
  className: string;
  name: string;
  score: string;
  points: string;
  dateDue: string;
  category: string;
  isNew: boolean;
  isUpdated: boolean;
  isIncomplete: boolean;
};

/** Normalize a score string for stable snapshot comparison.
 *  Decodes &nbsp;, collapses whitespace, trims, and lower-cases.
 *  Numeric scores are converted to a canonical float string so
 *  "85" and "85.0" and "85.00" all compare equal. */
function normalizeScore(s: string): string {
  const clean = (s ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const n = parseFloat(clean);
  return isNaN(n) ? clean.toLowerCase() : String(n);
}

function parseDateDue(d: string): number {
  const parts = d.split('/');
  if (parts.length !== 3) return 0;
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1])).getTime();
}

function calcPct(score: string, points: string): number | null {
  const s = parseFloat(score), p = parseFloat(points);
  if (isNaN(s) || isNaN(p) || p === 0) return null;
  return (s / p) * 100;
}

const pctColor = gradeColor;

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [activity, setActivity]   = useState<ActivityItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const loadData = async () => {
    // ── Name ──────────────────────────────────────────────────────────────
    const cachedName = await AsyncStorage.getItem('student_first_name');
    if (cachedName) {
      setFirstName(cachedName);
    } else {
      const username = await SecureStore.getItemAsync('hac_username');
      if (username) {
        const lower = username.toLowerCase();
        if (!/^s?\d+$/.test(lower)) {
          const part = lower.split(/[._-]/)[0];
          setFirstName(part.charAt(0).toUpperCase() + part.slice(1));
        }
      }
    }

    // ── Current period ────────────────────────────────────────────────────
    const prefPeriod = await AsyncStorage.getItem('prefetched_current_period');
    const period = prefPeriod ? parseInt(prefPeriod) : 1;
    setPeriod(period);

    // ── Load grades from cache ────────────────────────────────────────────
    const grades = await GradeCacheService.getCachedGradesStale(period);
    if (!grades || grades.length === 0) {
      setLoading(false);
      return;
    }

    // ── Load all assignments from cache ───────────────────────────────────
    const allItems: { classId: string; className: string; a: Assignment }[] = [];
    for (const grade of grades) {
      try {
        const raw = await AsyncStorage.getItem(`assignments_cache_${grade.id}_p${period}`);
        if (!raw) continue;
        const assignments: Assignment[] = JSON.parse(raw);
        for (const a of assignments) allItems.push({ classId: grade.id, className: grade.className, a });
      } catch {}
    }

    // ── Load previous snapshot ────────────────────────────────────────────
    let snapshot: Record<string, string> = {};
    try {
      const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
      if (raw) snapshot = JSON.parse(raw);
    } catch {}
    const hasSnapshot = Object.keys(snapshot).length > 0;

    // ── Build activity items + new snapshot ───────────────────────────────
    const newSnapshot: Record<string, string> = {};
    const seenKeys = new Set<string>();
    const items: ActivityItem[] = [];

    for (const { classId, className, a } of allItems) {
      const rawScore = (a.score || '').toLowerCase().trim();
      const isIncomplete = rawScore.includes('inc');
      // Skip ungraded, EC, blank
      if (!rawScore || rawScore === 'n/a') continue;
      if (!isIncomplete && (!a.points || a.points === 'N/A')) continue;

      const key = `${classId}::${a.name}`;
      const normScore = normalizeScore(a.score);

      // Always keep the first occurrence's normalized score in the snapshot;
      // skip duplicate keys so only one item per assignment appears in the list.
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      newSnapshot[key] = normScore;

      const prev = snapshot[key];
      const normPrev = prev !== undefined ? normalizeScore(prev) : undefined;
      const isNew     = hasSnapshot && normPrev === undefined;
      const isUpdated = hasSnapshot && normPrev !== undefined && normPrev !== normScore;

      items.push({
        key,
        classId,
        className,
        name: a.name,
        score: a.score,
        points: a.points,
        dateDue: a.dateDue || '',
        category: a.category || '',
        isNew,
        isUpdated,
        isIncomplete,
      });
    }

    // Sort by due date descending, new/updated items first
    items.sort((a, b) => {
      const aFlag = a.isNew || a.isUpdated ? 1 : 0;
      const bFlag = b.isNew || b.isUpdated ? 1 : 0;
      if (aFlag !== bFlag) return bFlag - aFlag;
      return parseDateDue(b.dateDue) - parseDateDue(a.dateDue);
    });

    setActivity(items.slice(0, MAX_ITEMS));
    setLoading(false);

    // Save snapshot for next visit
    try { await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(newSnapshot)); } catch {}
  };

  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ).start();
    await loadData();
    setRefreshing(false);
    spinAnim.stopAnimation();
  };

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const pct = calcPct(item.score, item.points);
    const lc = item.category.toLowerCase();
    const stripeColor = lc.includes('summative') ? SUMMATIVE : lc.includes('formative') ? FORMATIVE : theme.primary;
    const badge = item.isNew ? 'New' : item.isUpdated ? 'Updated' : null;

    return (
      <ScalePressable
        style={[styles.item, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}
        onPress={() => navigation.navigate('Assignments', {
          classId: item.classId,
          className: item.className,
          selectedPeriod: period,
        })}>

        <View style={[styles.accentStripe, { backgroundColor: stripeColor }]} />
        <View style={styles.itemContent}>
          <View style={styles.itemLeft}>
            <Text style={[styles.itemClass, { color: theme.primary }]} numberOfLines={1}>
              {item.className}
            </Text>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            {item.dateDue ? (
              <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
                Due {item.dateDue}
              </Text>
            ) : null}
          </View>

          <View style={styles.itemRight}>
            {badge && (
              <View style={[styles.badge, { backgroundColor: theme.primary + '22' }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>{badge}</Text>
              </View>
            )}
            {item.isIncomplete ? (
              <View style={[styles.gradePill, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.gradePillText}>INC</Text>
              </View>
            ) : pct !== null ? (
              <View style={[styles.gradePill, { backgroundColor: pctColor(pct) }]}>
                <Text style={styles.gradePillText}>{pct.toFixed(1)}%</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScalePressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: theme.headerText }]}>
              {firstName ? `Welcome, ${firstName}!` : 'Welcome!'}
            </Text>
            <Text style={[styles.date, { color: theme.headerText, opacity: 0.7 }]}>
              {dateStr}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
              onPress={() => navigation.navigate('Schedule')}>
              <Ionicons name="calendar-outline" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
              onPress={() => navigation.navigate('Pet')}>
              <Ionicons name="paw" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>
      </GradientHeader>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : activity.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No activity yet.{'\n'}Open the Grades tab to load your assignments.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activity}
          renderItem={renderItem}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Recent Activity
              </Text>
              <TouchableOpacity onPress={handleRefresh} disabled={refreshing || loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Animated.View style={{ transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                  <Ionicons name="refresh" size={16} color={theme.textSecondary} />
                </Animated.View>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header:    { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting:  { fontSize: 26, fontWeight: 'bold', fontFamily: 'Inter_700Bold', marginBottom: 3 },
  date:      { fontSize: 13, fontWeight: '500' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  list:        { padding: 12, paddingBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginLeft: 2,
    marginRight: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  accentStripe: { width: 4 },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 10,
  },
  itemLeft:  { flex: 1, marginRight: 12 },
  itemClass: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  itemName:  { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  itemDate:  { fontSize: 11 },

  itemRight: { alignItems: 'flex-end' },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  itemScore: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  gradePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: 'center',
  },
  gradePillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});
