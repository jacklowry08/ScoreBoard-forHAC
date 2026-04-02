import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { hacFetchSchedule, ScheduleCourse } from '../services/HACDirectClient';
import { supabase } from '../services/supabase';

const CACHE_KEY = 'schedule_cache';

type Classmate = {
  username: string;
  real_name: string | null;
  last_name: string | null;
};

type CourseWithClassmates = ScheduleCourse & {
  classmates: Classmate[];
};

function displayName(c: Classmate): string {
  if (c.real_name && c.last_name) return `${c.real_name} ${c.last_name}`;
  return c.real_name || 'Unknown';
}

export default function ScheduleScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [courses, setCourses] = useState<CourseWithClassmates[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseWithClassmates | null>(null);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openCourse = (course: CourseWithClassmates) => {
    setSelectedCourse(course);
    sheetAnim.setValue(SCREEN_HEIGHT);
    Animated.spring(sheetAnim, { toValue: 0, damping: 28, stiffness: 300, useNativeDriver: true }).start();
  };

  const closeCourse = () => {
    Animated.timing(sheetAnim, {
      toValue: SCREEN_HEIGHT, duration: 260,
      easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => setSelectedCourse(null));
  };

  useEffect(() => {
    (async () => {
      const username = (await SecureStore.getItemAsync('hac_username')) ?? '';
      setMyUsername(username);
      await loadSchedule(username, false);
    })();
  }, []);

  const loadSchedule = async (username: string, forceRefresh: boolean) => {
    setError(null);

    // Try cache first unless forcing refresh
    if (!forceRefresh) {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: ScheduleCourse[] = JSON.parse(raw);
          const withClassmates = await fetchClassmates(cached, username);
          setCourses(withClassmates);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // Fetch from HAC
    try {
      const fetched = await hacFetchSchedule();
      if (!fetched || fetched.length === 0) {
        setError('Could not load schedule. Try opening the Grades tab first to refresh your session.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fetched));

      // Upsert user's courses to Supabase for classmate matching
      if (username) {
        try {
          const [realName, lastName] = await Promise.all([
            AsyncStorage.getItem('student_first_name'),
            AsyncStorage.getItem('student_last_name'),
          ]);
          const rows = fetched.map(c => ({
            username,
            course_name: c.courseName,
            period_num: c.period,
            teacher: c.teacher,
            room: c.room,
            real_name: realName || null,
            last_name: lastName || null,
            updated_at: new Date().toISOString(),
          }));
          await supabase.from('user_schedule').upsert(rows, { onConflict: 'username,course_name' });

          // Remove old courses no longer in schedule
          const courseNames = fetched.map(c => c.courseName);
          await supabase
            .from('user_schedule')
            .delete()
            .eq('username', username)
            .not('course_name', 'in', `(${courseNames.map(n => `"${n}"`).join(',')})`);
        } catch (e) {
          console.warn('Schedule upsert error:', e);
        }
      }

      const withClassmates = await fetchClassmates(fetched, username);
      setCourses(withClassmates);
    } catch (e) {
      setError('Failed to load schedule.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const fetchClassmates = async (
    schedule: ScheduleCourse[],
    username: string,
  ): Promise<CourseWithClassmates[]> => {
    const courseNames = schedule.map(c => c.courseName);

    try {
      const { data: scheduleRows } = await supabase
        .from('user_schedule')
        .select('username, course_name, real_name, last_name')
        .in('course_name', courseNames)
        .neq('username', username);

      if (scheduleRows && scheduleRows.length > 0) {
        return schedule.map(course => ({
          ...course,
          classmates: scheduleRows
            .filter((r: any) => r.course_name === course.courseName)
            .map((r: any) => ({
              username: r.username,
              real_name: r.real_name ?? null,
              last_name: r.last_name ?? null,
            })),
        }));
      }
    } catch (e) {
      console.warn('fetchClassmates error:', e);
    }

    return schedule.map(course => ({ ...course, classmates: [] }));
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadSchedule(myUsername, true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backButtonText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>Schedule</Text>
          <TouchableOpacity onPress={handleRefresh} disabled={refreshing} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="refresh" size={20} color={theme.headerText} />
          </TouchableOpacity>
        </View>
      </GradientHeader>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            Your classes · {courses.length} courses
          </Text>
          {courses.map((course, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.75}
              onPress={() => openCourse(course)}
              style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
              <View style={[styles.periodBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.periodText}>{course.period}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                  {course.courseName}
                </Text>
                <View style={styles.metaRow}>
                  {course.teacher ? (
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>
                      {course.teacher}
                    </Text>
                  ) : null}
                  {course.room ? (
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>
                      Room {course.room}
                    </Text>
                  ) : null}
                </View>
                {course.classmates.length > 0 && (
                  <Text style={[styles.classmatesHint, { color: theme.primary }]}>
                    {course.classmates.length} classmate{course.classmates.length !== 1 ? 's' : ''} using the app
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary as string} style={{ alignSelf: 'center', marginRight: 12 }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Course detail modal */}
      <Modal visible={!!selectedCourse} transparent animationType="none" onRequestClose={closeCourse}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeCourse} />
        <Animated.View style={[styles.sheet, { backgroundColor: theme.cardBackground, transform: [{ translateY: sheetAnim }] }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />

          {selectedCourse && (
            <>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetPeriodBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.periodText}>{selectedCourse.period}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={2}>
                    {selectedCourse.courseName}
                  </Text>
                  <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>
                    {[selectedCourse.teacher, selectedCourse.room ? `Room ${selectedCourse.room}` : ''].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeCourse} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={theme.textSecondary as string} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.classmatesSectionLabel, { color: theme.textSecondary }]}>
                {selectedCourse.classmates.length > 0
                  ? `${selectedCourse.classmates.length} classmate${selectedCourse.classmates.length !== 1 ? 's' : ''} using the app`
                  : 'No classmates on the app yet'}
              </Text>

              <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
                {selectedCourse.classmates.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Share the app with your classmates!
                  </Text>
                ) : (
                  selectedCourse.classmates.map((c, i) => (
                    <View key={i} style={[styles.classmateRow, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: theme.cardBorderWidth }]}>
                      <View style={[styles.classmateAvatar, { backgroundColor: theme.primary + '22' }]}>
                        <Ionicons name="person" size={18} color={theme.primary as string} />
                      </View>
                      <Text style={[styles.classmateName, { color: theme.text }]}>
                        {displayName(c)}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', fontFamily: 'Inter_700Bold' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  list: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 12, marginLeft: 2,
  },

  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  periodBadge: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  cardBody: { flex: 1, padding: 12 },
  courseName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 12 },
  meta: { fontSize: 12 },

  classmatesHint: { fontSize: 12, fontWeight: '600', marginTop: 6 },

  // Modal sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.65,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, gap: 12, marginBottom: 16,
  },
  sheetPeriodBadge: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  sheetMeta: { fontSize: 12, marginTop: 2 },
  classmatesSectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 10,
  },
  sheetList: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 20 },
  classmateRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 8, gap: 12,
  },
  classmateAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  classmateName: { fontSize: 15, fontWeight: '500' },
});
