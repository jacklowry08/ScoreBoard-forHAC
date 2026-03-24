import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import ScalePressable from '../components/ScalePressable';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { GradeCacheService } from '../services/GradeCacheService';
import { Assignment } from '../services/webScraper';
import { gradeColor } from '../constants/colors';

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
  isNew: boolean;
  isUpdated: boolean;
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
      // Skip ungraded, EC, blank
      if (!rawScore || rawScore === 'n/a') continue;
      if (!a.points || a.points === 'N/A') continue;

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
        isNew,
        isUpdated,
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

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const pct = calcPct(item.score, item.points);
    const color = pct !== null ? pctColor(pct) : theme.textSecondary;
    const badge = item.isNew ? 'New' : item.isUpdated ? 'Updated' : null;

    return (
      <ScalePressable
        style={[styles.item, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}
        onPress={() => navigation.navigate('Assignments', {
          classId: item.classId,
          className: item.className,
          selectedPeriod: period,
        })}>

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
          <Text style={[styles.itemScore, { color: theme.text }]}>
            {item.score}/{item.points}
          </Text>
          {pct !== null && (
            <Text style={[styles.itemPct, { color }]}>
              {pct.toFixed(1)}%
            </Text>
          )}
        </View>
      </ScalePressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <Text style={[styles.greeting, { color: theme.headerText }]}>
          {firstName ? `Welcome, ${firstName}!` : 'Welcome!'}
        </Text>
        <Text style={[styles.date, { color: theme.headerText, opacity: 0.7 }]}>
          {dateStr}
        </Text>
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
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Recent Activity
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header:    { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  greeting:  { fontSize: 26, fontWeight: 'bold', fontFamily: 'Inter_700Bold', marginBottom: 3 },
  date:      { fontSize: 13, fontWeight: '500' },

  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  list:        { padding: 12, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },

  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  itemLeft:  { flex: 1, marginRight: 12 },
  itemClass: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  itemName:  { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  itemDate:  { fontSize: 11 },

  itemRight: { alignItems: 'flex-end', minWidth: 60 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  itemScore: { fontSize: 13, fontWeight: '600', marginBottom: 1 },
  itemPct:   { fontSize: 12, fontWeight: '600' },
});
