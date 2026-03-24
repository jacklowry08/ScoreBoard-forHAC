import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hacFetchTranscript,
  TranscriptData,
  TranscriptCourse,
} from '../services/HACDirectClient';
import { useTheme } from '../context/ThemeContext';
import { letterGradeColor } from '../constants/colors';
import GradientHeader from '../components/GradientHeader';
import { PullToRefresh } from '../components/PullToRefresh';

const TRANSCRIPT_CACHE_KEY = 'transcript_cache_v2';
const TRANSCRIPT_CACHE_TIME_KEY = 'transcript_cache_time_v2';

function getCacheAgeDays(cachedTime: string | null): number | null {
  if (!cachedTime) return null;
  const ms = Date.now() - parseInt(cachedTime);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export default function TranscriptScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [data, setData] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [hacUnavailable, setHacUnavailable] = useState(false);
  const [cacheAgeDays, setCacheAgeDays] = useState<number | null>(null);

  const hasDataRef = useRef(false);

  useEffect(() => {
    loadTranscript();
  }, []);

  const loadTranscript = async () => {
    try {
      const cached = await AsyncStorage.getItem(TRANSCRIPT_CACHE_KEY);
      const cachedTime = await AsyncStorage.getItem(TRANSCRIPT_CACHE_TIME_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as TranscriptData;
        if (parsed.groups?.length > 0) {
          setData(parsed);
          hasDataRef.current = true;
          setCacheAgeDays(getCacheAgeDays(cachedTime));
          setLoading(false);
          // Always try to refresh in background — cache never expires
          setBackgroundRefreshing(true);
          await fetchAndUpdate();
          return;
        }
      }
    } catch (e) {
      console.warn('Transcript cache read error:', e);
    }
    // No usable cache — live fetch with spinner
    setLoading(true);
    setNetworkError(false);
    await fetchAndUpdate();
    setLoading(false);
  };

  const fetchAndUpdate = async () => {
    try {
      const fresh = await hacFetchTranscript();
      if (fresh && fresh.groups.length > 0) {
        setData(fresh);
        hasDataRef.current = true;
        setNetworkError(false);
        setHacUnavailable(false);
        setCacheAgeDays(0);
        await AsyncStorage.setItem(TRANSCRIPT_CACHE_KEY, JSON.stringify(fresh));
        await AsyncStorage.setItem(TRANSCRIPT_CACHE_TIME_KEY, Date.now().toString());
      } else if (!hasDataRef.current) {
        // No cache at all and HAC returned nothing — show error
        setNetworkError(true);
      } else {
        // HAC returned no transcript but we have cache — show unavailable banner
        setHacUnavailable(true);
      }
    } catch (e) {
      console.warn('Transcript fetch error:', e);
      if (!hasDataRef.current) setNetworkError(true);
      else setHacUnavailable(true);
    } finally {
      setBackgroundRefreshing(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setBackgroundRefreshing(false);
    setHacUnavailable(false);
    // Don't clear cache before fetching — only replace it on success
    await fetchAndUpdate();
  };

  const getGradeColor = (grade: string) => {
    return letterGradeColor(grade) || (theme.textSecondary as string);
  };

  const formatCredit = (credit: string) => {
    const n = parseFloat(credit);
    if (isNaN(n)) return credit;
    return n % 1 === 0 ? n.toFixed(0) : n.toString();
  };

  const sections = [...(data?.groups ?? [])].reverse().map(g => ({
    title: g.year,
    grade: g.grade,
    gpa: g.gpa,
    credit: g.credit,
    data: g.courses,
  }));

  const renderGpaCard = () => {
    if (!data?.gpaTable?.length) return null;
    return (
      <View style={[styles.gpaCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <Text style={[styles.gpaCardTitle, { color: theme.text }]}>GPA Summary</Text>
        {data.gpaTable.map((entry, i) => (
          <View key={i} style={styles.gpaRow}>
            <Text style={[styles.gpaType, { color: theme.textSecondary }]}>{entry.type}</Text>
            <View style={styles.gpaRight}>
              <Text style={[styles.gpaValue, { color: theme.text }]}>{entry.gpa}</Text>
              {!!entry.rank && (
                <Text style={[styles.gpaRank, { color: theme.textSecondary }]}>{entry.rank}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const currentYearGroup = data ? [...data.groups].reverse()[0] : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <Text style={[styles.title, { color: theme.headerText }]}>Transcript</Text>
        <TouchableOpacity
          style={[
            styles.calcBtn,
            { borderColor: 'rgba(255,255,255,0.7)', opacity: currentYearGroup ? 1 : 0.35 },
          ]}
          disabled={!currentYearGroup}
          onPress={() => navigation.navigate('GPACalculator', { allGroups: data!.groups })}>
          <Text style={[styles.calcBtnText, { color: theme.headerText }]}>Calculate GPA</Text>
        </TouchableOpacity>
      </GradientHeader>

      {backgroundRefreshing && (
        <View style={[styles.infoBanner, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
          <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.bannerText, { color: theme.textSecondary }]}>Checking for updates…</Text>
        </View>
      )}
      {!backgroundRefreshing && hacUnavailable && (
        <View style={[styles.infoBanner, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
          <Text style={[styles.bannerText, { color: theme.textSecondary }]}>
            Transcript unavailable on HAC — showing cached data
          </Text>
        </View>
      )}
      {!backgroundRefreshing && !hacUnavailable && cacheAgeDays !== null && cacheAgeDays > 0 && (
        <View style={[styles.infoBanner, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
          <Text style={[styles.bannerText, { color: theme.textSecondary }]}>
            {cacheAgeDays === 1 ? 'Cached 1 day ago' : `Cached ${cacheAgeDays} days ago`}
          </Text>
        </View>
      )}

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
              Loading transcript...
            </Text>
          </View>
        ) : !data || data.groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {'Transcript not available'}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SectionList
            {...scrollProps}
            sections={sections}
            keyExtractor={(item: TranscriptCourse, index) => item.courseCode + index}
            stickySectionHeadersEnabled
            ListHeaderComponent={renderGpaCard}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.sectionHeaderLeft}>
                  <Text style={[styles.sectionYear, { color: theme.text }]}>{section.title}</Text>
                  {!!section.grade && (
                    <Text style={[styles.sectionGrade, { color: theme.textSecondary }]}>
                      Grade {section.grade}
                    </Text>
                  )}
                </View>
                {(!!section.gpa || !!section.credit) && (
                  <Text style={[styles.sectionGpa, { color: theme.primary }]}>
                    {[section.gpa && `GPA ${section.gpa}`, section.credit && `${formatCredit(section.credit)} cr`].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
            )}
            renderSectionFooter={() => <View style={styles.sectionFooter} />}
            renderItem={({ item }: { item: TranscriptCourse }) => (
              <View style={[styles.courseRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.courseInfo}>
                  {!!item.courseCode && (
                    <Text style={[styles.courseCode, { color: theme.textSecondary }]}>
                      {item.courseCode}
                    </Text>
                  )}
                  <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                    {item.courseName}
                  </Text>
                  {!!item.creditEarned && (
                    <Text style={[styles.credit, { color: theme.textSecondary }]}>
                      {formatCredit(item.creditEarned)} credit
                    </Text>
                  )}
                </View>
                <View style={styles.gradeColumns}>
                  {[
                    { label: 'SM1', value: item.sm1 },
                    { label: 'SM2', value: item.sm2 },
                    { label: 'FIN', value: item.fin },
                  ].map(col => (
                    <View key={col.label} style={styles.gradeCol}>
                      <Text style={[styles.gradeColLabel, { color: theme.textSecondary }]}>{col.label}</Text>
                      <Text style={[
                        styles.gradeColValue,
                        { color: col.value ? getGradeColor(col.value) : theme.border as string },
                      ]}>
                        {col.value || '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </PullToRefresh>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  calcBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 2,
  },
  calcBtnText: { fontSize: 13, fontWeight: '600' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  bannerText: { fontSize: 13 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 18, marginBottom: 20, textAlign: 'center' },
  retryButton: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listContent: { paddingBottom: 32 },
  gpaCard: { margin: 15, borderRadius: 12, padding: 16, borderWidth: 1 },
  gpaCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  gpaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  gpaType: { fontSize: 14 },
  gpaRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gpaValue: { fontSize: 16, fontWeight: '700' },
  gpaRank: { fontSize: 13 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sectionHeaderLeft: { flex: 1 },
  sectionYear: { fontSize: 14, fontWeight: '700' },
  sectionGrade: { fontSize: 12, marginTop: 1 },
  sectionGpa: { fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: 8 },
  sectionFooter: { height: 12 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  courseInfo: { flex: 1, marginRight: 12 },
  courseCode: { fontSize: 11, fontWeight: '600', marginBottom: 2, letterSpacing: 0.3 },
  courseName: { fontSize: 14, fontWeight: '500' },
  credit: { fontSize: 11, marginTop: 3 },
  gradeColumns: { flexDirection: 'row', gap: 8 },
  gradeCol: { alignItems: 'center', minWidth: 32 },
  gradeColLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  gradeColValue: { fontSize: 14, fontWeight: '700' },
});
