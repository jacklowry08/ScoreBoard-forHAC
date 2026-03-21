import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PullToRefresh } from '../components/PullToRefresh';
import ScalePressable from '../components/ScalePressable';
import { GradeCardSkeleton } from '../components/Skeleton';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Grade } from '../services/webScraper';
import { GradeSharingService, ClassAverageResult } from '../services/GradeSharingService';
import { GradeCacheService } from '../services/GradeCacheService';
import { hacFetchPeriod, hacFetchAllPeriods } from '../services/HACDirectClient';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { useFocusEffect } from '@react-navigation/native';
import { gradeColor, gradeGradient } from '../constants/colors';

const SHOW_AVERAGES_KEY = 'show_class_averages';


export default function GradesScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classAverages, setClassAverages] = useState<Record<string, ClassAverageResult>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAverages, setLoadingAverages] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [showAverages, setShowAverages] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(
    null,
  );
  const [selectedPeriod, setSelectedPeriod] = useState(0);
const selectedPeriodRef = useRef(0);
  const backgroundFetchRunningRef = useRef(false);
  const emptyPeriodsRef = useRef<Set<number>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      console.log('📊 Grades screen focused');
      checkSettings();
      initAndLoad();
    }, []),
  );

  const initAndLoad = async () => {
    if (selectedPeriodRef.current === 0) {
      const prefetched = await AsyncStorage.getItem('prefetched_current_period');
      if (prefetched) {
        const period = parseInt(prefetched);
        selectedPeriodRef.current = period;
        setSelectedPeriod(period);
      }
    }
    loadGrades(selectedPeriodRef.current);
  };

  /**
   * Fire-and-forget background fetch of all periods.
   * Uses hacFetchAllPeriods to make a single GET + parallel POSTs.
   */
  const triggerBackgroundPrefetch = async () => {
    if (backgroundFetchRunningRef.current) return;
    const current = selectedPeriodRef.current;
    if (current === 0) return;

    // Submit already-cached periods to Supabase; identify uncached ones
    const uncached: number[] = [];
    for (const p of [1, 2, 3, 4]) {
      if (p === current) continue;
      const cached = await GradeCacheService.getCachedGrades(p);
      if (!cached || cached.length === 0) {
        uncached.push(p);
      } else {
        const gradeData = cached.map(g => ({
          courseCode: g.courseCode,
          className: g.className,
          percentage: g.percentage,
        }));
        GradeSharingService.submitGrades(gradeData, p);
      }
    }
    if (uncached.length === 0) return;

    backgroundFetchRunningRef.current = true;
    console.log('🔄 BG fetch: fetching periods', uncached);

    hacFetchAllPeriods(async (periodIndex, data) => {
      if (!uncached.includes(periodIndex)) return;
      if (data.grades.length > 0) {
        await GradeCacheService.saveGrades(data.grades, periodIndex);
        for (const [classId, assignments] of Object.entries(data.assignments)) {
          if (assignments.length > 0) {
            await GradeCacheService.saveAssignments(`${classId}_p${periodIndex}`, assignments);
          }
        }
        console.log(`✅ BG fetch: cached period ${periodIndex}`);
        const gradeData = data.grades.map(g => ({
          courseCode: g.courseCode,
          className: g.className,
          percentage: g.percentage,
        }));
        GradeSharingService.submitGrades(gradeData, periodIndex);
      }
    })
      .catch(e => console.warn('BG fetch error:', e))
      .finally(() => {
        backgroundFetchRunningRef.current = false;
      });
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  const checkSettings = async () => {
    const enabled = await GradeSharingService.isEnabled();
    const shouldShow = await AsyncStorage.getItem(SHOW_AVERAGES_KEY);
    setSharingEnabled(enabled);
    setShowAverages(shouldShow === 'true');
  };

  const loadCredentials = async () => {
    const user = await SecureStore.getItemAsync('hac_username');
    const pass = await SecureStore.getItemAsync('hac_password');
    if (user && pass) setCredentials({ username: user, password: pass });
  };

  const fetchClassAverages = async (gradeList: Grade[], period: number) => {
    const enabled = await GradeSharingService.isEnabled();
    const shouldShow = await AsyncStorage.getItem(SHOW_AVERAGES_KEY);
    if (!enabled || shouldShow !== 'true') return;

    console.log('📊 Fetching class averages for period', period, '...');
    setLoadingAverages(true);
    const averages: Record<string, ClassAverageResult> = {};
    for (const grade of gradeList) {
      const result = await GradeSharingService.getClassAverage(
        grade.courseCode,
        grade.className,
        period,
      );
      averages[grade.courseCode] = result;
    }
    setClassAverages(averages);
    setLoadingAverages(false);
  };

  const liveRefresh = async (period: number) => {
    let data;
    try {
      data = await hacFetchPeriod(period);
    } catch (e) {
      console.warn('liveRefresh network error:', e);
      if (selectedPeriodRef.current === period) setNetworkError(true);
      return;
    }
    // Guard: user may have switched periods while this was running
    if (selectedPeriodRef.current !== period) return;
    setNetworkError(false);
    if (data && data.grades.length > 0) {
      setGrades(data.grades);
      await GradeCacheService.saveGrades(data.grades, period);
      for (const [classId, assignments] of Object.entries(data.assignments)) {
        if (assignments.length > 0) {
          await GradeCacheService.saveAssignments(`${classId}_p${period}`, assignments);
        }
      }
      triggerBackgroundPrefetch();
      const gradeData = data.grades.map(g => ({
        courseCode: g.courseCode,
        className: g.className,
        percentage: g.percentage,
      }));
      GradeSharingService.submitGrades(gradeData, period);
      fetchClassAverages(data.grades, period);
    } else {
      emptyPeriodsRef.current.add(period);
    }
  };

  const loadGrades = async (period = selectedPeriodRef.current) => {
    // ── Stale-while-revalidate ──────────────────────────────────────────────
    // Show any cached data immediately (even if past TTL), then refresh in
    // background if stale. This makes every period switch feel instant.
    const staleGrades = await GradeCacheService.getCachedGradesStale(period);

    if (staleGrades && staleGrades.length > 0) {
      setGrades(staleGrades);
      setLoading(false);
      setRefreshing(false);

      const isStale = await GradeCacheService.isCacheStale(period);
      if (!isStale) {
        // Still fresh — background tasks only
        await fetchClassAverages(staleGrades, period);
        triggerBackgroundPrefetch();
        GradeSharingService.submitGrades(
          staleGrades.map(g => ({ courseCode: g.courseCode, className: g.className, percentage: g.percentage })),
          period,
        );
      } else {
        // Stale — show old data, fetch class averages (Supabase, no session needed),
        // and silently refresh grades in background.
        fetchClassAverages(staleGrades, period);
        liveRefresh(period).catch(e => console.warn('Stale refresh error:', e));
      }
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    // Period already fetched this session and confirmed empty — skip fetch
    if (emptyPeriodsRef.current.has(period)) {
      setGrades([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // No cache at all — show spinner, live fetch
    setLoading(true);
    setRefreshing(false);

    await liveRefresh(period);

    setLoading(false);
    setRefreshing(false);
  };

  const handlePeriodSelect = async (period: number) => {
    if (period === selectedPeriodRef.current) return;
    selectedPeriodRef.current = period;
    setSelectedPeriod(period);
    setGrades([]);
    setClassAverages({});
    setNetworkError(false);
    setLoading(true);
    await loadGrades(period);
  };

  const handleRefresh = async () => {
    const period = selectedPeriodRef.current;
    await GradeCacheService.clearCacheForPeriod(period);
    emptyPeriodsRef.current.delete(period);
    setRefreshing(true);
    setGrades([]);
    setClassAverages({});
    await loadGrades(period);
  };


  const getComparisonText = (yourGrade: number, classAvg: number) => {
    const diff = yourGrade - classAvg;
    if (diff > 0) return { text: `+${diff}% above avg`, color: gradeColor(90) };
    if (diff < 0) return { text: `${diff}% below avg`, color: gradeColor(0) };
    return { text: 'At class avg', color: gradeColor(70) };
  };

  const renderGrade = ({ item }: { item: Grade }) => {
    const result = classAverages[item.courseCode];
    const classAvg = result?.average;
    const studentCount = result?.studentCount || 0;

    const comparison =
      classAvg !== null && classAvg !== undefined
        ? getComparisonText(item.percentage, classAvg)
        : null;

    return (
      <ScalePressable
        style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        onPress={() =>
          navigation.navigate('Assignments', {
            classId: item.id,
            className: item.className,
            courseCode: item.courseCode,
            classAverage: item.percentage,
            username: credentials?.username,
            password: credentials?.password,
            selectedPeriod: selectedPeriod,
          })
        }>
        <View style={styles.cardHeader}>
          <Text style={[styles.className, { color: theme.text }]} numberOfLines={1}>
            {item.className}
          </Text>
          <LinearGradient
            colors={gradeGradient(item.percentage)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{item.percentage}%</Text>
          </LinearGradient>
        </View>

        {sharingEnabled && showAverages && (
          <View style={styles.avgRow}>
            {loadingAverages ? (
              <Text style={[styles.avgLoading, { color: theme.textSecondary }]}>
                Loading class avg...
              </Text>
            ) : classAvg !== null && classAvg !== undefined ? (
              <View style={styles.avgContainer}>
                <Text style={[styles.avgText, { color: theme.textSecondary }]}>
                  Class avg: {classAvg}% ({studentCount} students)
                </Text>
                {comparison && (
                  <View
                    style={[styles.comparisonBadge, { backgroundColor: comparison.color + '22' }]}>
                    <Text style={[styles.comparisonText, { color: comparison.color }]}>
                      {comparison.text}
                    </Text>
                  </View>
                )}
              </View>
            ) : studentCount > 0 ? (
              <Text style={[styles.avgText, { color: theme.textSecondary }]}>
                {studentCount}/10 minimum students needed
              </Text>
            ) : (
              <Text style={[styles.avgText, { color: theme.textSecondary }]}>
                No data yet for this class
              </Text>
            )}
          </View>
        )}

      </ScalePressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <Text style={[styles.title, { color: theme.headerText }]}>Grades</Text>
      </GradientHeader>

      {/* Segmented control period selector */}
      <View
        style={[
          styles.periodBarWrapper,
          { backgroundColor: theme.cardBackground, borderBottomColor: theme.border },
        ]}>
        <View style={[styles.segmentedControl, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
          {['M1', 'M2', 'M3', 'M4'].map((label, index) => {
            const period = index + 1;
            const isSelected = selectedPeriod === period;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.segment, isSelected && [styles.segmentSelected, { backgroundColor: theme.primary, shadowColor: theme.primary }]]}

                onPress={() => handlePeriodSelect(period)}
                activeOpacity={0.7}>
                <Text style={[styles.segmentText, { color: isSelected ? '#fff' : theme.textSecondary }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        color={theme.primary}
        disabled={loading}
      >
        {(scrollProps) => loading ? (
          <View style={styles.list}>
            {[...Array(6)].map((_, i) => <GradeCardSkeleton key={i} />)}
          </View>
        ) : grades.length === 0 ? (
          <View style={[styles.emptyPeriod, { backgroundColor: theme.background }]}>
            <Text style={[styles.emptyPeriodText, { color: theme.textSecondary }]}>
              {networkError
                ? 'No connection — pull down to retry'
                : 'No grades available for this period yet.'}
            </Text>
          </View>
        ) : (
          <FlatList
            {...scrollProps}
            data={grades}
            renderItem={renderGrade}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
          />
        )}
      </PullToRefresh>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold' },
  periodBarWrapper: { height: 52, borderBottomWidth: 1, justifyContent: 'center', paddingHorizontal: 15 },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 7,
  },
  segmentSelected: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  emptyPeriod: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyPeriodText: { fontSize: 16 },
  list: { padding: 10, paddingBottom: 16 },
  card: {
    borderRadius: 16,
    padding: 10,
    marginBottom: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  className: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  gradeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 22,
    minWidth: 68,
    alignItems: 'center',
  },
  gradeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  avgRow: { marginTop: 5 },
  avgContainer: { gap: 4 },
  avgText: { fontSize: 12 },
  avgLoading: { fontSize: 12, fontStyle: 'italic' },
  comparisonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comparisonText: { fontSize: 11, fontWeight: '600' },
});
