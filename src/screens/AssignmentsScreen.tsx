import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import { Assignment } from '../services/webScraper';
import { GradeCacheService } from '../services/GradeCacheService';
import { hacFetchPeriod } from '../services/HACDirectClient';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { PullToRefresh } from '../components/PullToRefresh';
import { gradeColor, FORMATIVE, SUMMATIVE } from '../constants/colors';

const StripedBadge = ({ color, size = 12 }: { color: string; size?: number }) => (
  <Svg height={size} width={size} style={{ borderRadius: size / 2 }}>
    <Defs>
      <Pattern
        id="stripe"
        patternUnits="userSpaceOnUse"
        width="4"
        height="4"
        patternTransform="rotate(45)">
        <Line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeWidth="2" />
      </Pattern>
    </Defs>
    <Rect x="0" y="0" width={size} height={size} fill="url(#stripe)" />
    <Rect x="0" y="0" width={size} height={size} fill={color} opacity="0.3" />
  </Svg>
);


function computeCategoryAvg(
  assignments: Assignment[],
  categoryKeyword: string,
): number | null {
  let scoreW = 0, pointsW = 0;
  for (const a of assignments) {
    if (!a.category.toLowerCase().includes(categoryKeyword)) continue;

    const rawScore = (a.score || '').toLowerCase().trim();
    const isInc = rawScore.includes('incomplete') || rawScore === 'inc';

    // Blank / N/A and NOT explicitly marked incomplete → EC or ungraded → skip
    if (!isInc && (!rawScore || rawScore === 'n/a')) continue;

    let s: number, p: number;

    if (isInc) {
      // Incomplete counts as 0; use max points if available, otherwise default 100
      s = 0;
      const pp = parseFloat(a.points);
      p = (!a.points || a.points === 'N/A' || isNaN(pp) || pp === 0) ? 100 : pp;
    } else {
      // Normal graded assignment
      if (!a.points || a.points === 'N/A') continue;
      const pp = parseFloat(a.points);
      if (isNaN(pp) || pp === 0) continue;
      p = pp;
      const ss = parseFloat(a.score);
      if (isNaN(ss)) continue;
      s = ss;
    }

    const w = parseFloat(a.weight) || 1;
    scoreW  += s * w;
    pointsW += p * w;
  }
  return pointsW > 0 ? scoreW / pointsW * 100 : null;
}

export default function AssignmentsScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { classId, className, classAverage, selectedPeriod = 0 } = route.params;
  const cacheKey = `${classId}_p${selectedPeriod}`;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);

    // Show stale cached data immediately, then refresh in background if needed
    const stale = await GradeCacheService.getCachedAssignmentsStale(cacheKey);
    if (stale) {
      setAssignments(stale);
      setLoading(false);

      const fresh = await GradeCacheService.getCachedAssignments(cacheKey);
      if (fresh) return; // still within TTL, no refresh needed

      // Cache is stale — refresh silently in background
      const data = await hacFetchPeriod(selectedPeriod);
      const classAssignments = data?.assignments[classId] ?? [];
      if (classAssignments.length > 0) {
        await GradeCacheService.saveAssignments(cacheKey, classAssignments);
        setAssignments(classAssignments);
      }
      return;
    }

    // No cache at all — live fetch with spinner
    const data = await hacFetchPeriod(selectedPeriod);
    const classAssignments = data?.assignments[classId] ?? [];
    if (classAssignments.length > 0) {
      await GradeCacheService.saveAssignments(cacheKey, classAssignments);
    }
    setAssignments(classAssignments);
    setLoading(false);
  };

  const handleRefresh = async () => {
    await GradeCacheService.clearAssignmentCache(cacheKey);
    setRefreshing(true);
    setAssignments([]);

    const data = await hacFetchPeriod(selectedPeriod);
    const classAssignments = data?.assignments[classId] ?? [];
    if (classAssignments.length > 0) {
      await GradeCacheService.saveAssignments(cacheKey, classAssignments);
    }
    setAssignments(classAssignments);
    setRefreshing(false);
  };

  const handleRetry = () => {
    setLoading(true);
    setAssignments([]);
    loadAssignments();
  };

  const getCategoryColor = (category: string): string => {
    const lc = category.toLowerCase();
    if (lc.includes('summative')) return SUMMATIVE;
    if (lc.includes('formative')) return FORMATIVE;
    return '#757575';
  };

  const isExtraCredit = (points: string): boolean => {
    return points === 'N/A' || points === '0' || points === '0.00';
  };

  const calculatePercentage = (score: string, points: string): string => {
    if (score === 'N/A' || !points || isExtraCredit(points)) return 'EC';
    const scoreNum = parseFloat(score);
    const pointsNum = parseFloat(points);
    if (isNaN(scoreNum) || isNaN(pointsNum) || pointsNum === 0) return 'N/A';
    return ((scoreNum / pointsNum) * 100).toFixed(1) + '%';
  };

  const renderAssignment = ({ item }: { item: Assignment }) => {
    const percentage = calculatePercentage(item.score, item.points);
    const categoryColor = getCategoryColor(item.category);
    const extraCredit = isExtraCredit(item.points);

    return (
      <View
        style={[
          styles.assignmentRow,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
        ]}>
        <View style={styles.leftSection}>
          {extraCredit ? (
            <StripedBadge color={categoryColor} size={12} />
          ) : (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]} />
          )}
          <View style={styles.assignmentInfo}>
            <Text style={[styles.assignmentName, { color: theme.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            {item.dateDue && (
              <Text style={[styles.dueDate, { color: theme.textSecondary }]}>
                Due: {item.dateDue}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          {extraCredit ? (
            <>
              <Text style={[styles.scoreText, { color: theme.text }]}>{item.score}</Text>
              <Text style={styles.extraCreditText}>EC</Text>
            </>
          ) : (
            <>
              <Text style={[styles.scoreText, { color: theme.text }]}>
                {item.score}/{item.points}
              </Text>
              {percentage !== 'N/A' && percentage !== 'EC' && (
                <Text
                  style={[
                    styles.percentageText,
                    { color: gradeColor(parseFloat(percentage)) },
                  ]}>
                  {percentage}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backButtonText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerBottom}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]} numberOfLines={2}>
            {className}
          </Text>
          <TouchableOpacity
            style={[styles.calcBtn, { borderColor: 'rgba(255,255,255,0.7)', opacity: !loading && assignments.length > 0 ? 1 : 0.35 }]}
            disabled={loading || assignments.length === 0}
            onPress={() => navigation.navigate('GradeCalculator', { assignments, className, classAverage })}>
            <Text style={[styles.calcBtnText, { color: theme.headerText }]}>Calculate</Text>
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {/* ── stats bar ────────────────────────────────────────────────── */}
      {(() => {
        const faAvg = assignments.length > 0
          ? computeCategoryAvg(assignments, 'formative') : null;
        const saAvg = assignments.length > 0
          ? computeCategoryAvg(assignments, 'summative') : null;
        const derivedOverall = faAvg != null && saAvg != null
          ? 0.3 * faAvg + 0.7 * saAvg
          : saAvg ?? faAvg;
        const displayOverall = classAverage != null ? classAverage : (derivedOverall != null ? derivedOverall.toFixed(1) : null);
        return (
          <View style={[styles.statsBar, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {displayOverall != null ? `${displayOverall}%` : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Overall</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: FORMATIVE }]}>
                {faAvg != null ? `${faAvg.toFixed(1)}%` : '—'}
              </Text>
              <View style={styles.statLabelRow}>
                <View style={[styles.statDot, { backgroundColor: FORMATIVE }]} />
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Formative</Text>
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: SUMMATIVE }]}>
                {saAvg != null ? `${saAvg.toFixed(1)}%` : '—'}
              </Text>
              <View style={styles.statLabelRow}>
                <View style={[styles.statDot, { backgroundColor: SUMMATIVE }]} />
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Summative</Text>
              </View>
            </View>
          </View>
        );
      })()}

      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        color={theme.primary}
        disabled={loading}
      >
        {(scrollProps) => loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading assignments...
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleRetry}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : assignments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No assignments found
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            {...scrollProps}
            data={assignments}
            renderItem={renderAssignment}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.listContainer}
            removeClippedSubviews={true}
            maxToRenderPerBatch={20}
            windowSize={10}
          />
        )}
      </PullToRefresh>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16 },
  retryButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  headerBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 1, marginRight: 8 },
  calcBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1.5 },
  calcBtnText: { fontSize: 12, fontWeight: '600' },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', marginBottom: 3 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 36, opacity: 0.4 },
  listContainer: { padding: 12 },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  categoryBadge: { width: 12, height: 12, borderRadius: 6 },
  assignmentInfo: { flex: 1 },
  assignmentName: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  dueDate: { fontSize: 11 },
  rightSection: { alignItems: 'flex-end', minWidth: 70 },
  scoreText: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  percentageText: { fontSize: 12, fontWeight: '600' },
  extraCreditText: { fontSize: 11, fontWeight: '600', color: '#FF6B35' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 18 },
});
