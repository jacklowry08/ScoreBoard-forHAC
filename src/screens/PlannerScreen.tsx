import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { OVERDUE, INC_BG, INC_TEXT } from '../constants/colors';
import { GradeCacheService } from '../services/GradeCacheService';
import { Assignment } from '../services/webScraper';

const PLANNER_TASKS_KEY    = 'planner_tasks';
const DISMISSED_KEY        = 'planner_dismissed';
const DOW_SHORT   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type UserTask = {
  id: string;
  name: string;
  className: string;
  dateDue: string;
  completed: boolean;
  createdAt: number;
};

type PlannerItem = {
  key: string;
  name: string;
  className: string;
  dateDue: string;
  source: 'hac' | 'user';
  isIncomplete: boolean;
  completed: boolean;
  taskId?: string;
};

type PlannerSection = {
  title: string;
  sectionKey: string;
  data: PlannerItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDueMs(d: string): number {
  if (!d) return 0;
  const parts = d.split('/');
  if (parts.length !== 3) return 0;
  const dt = new Date(+parts[2], +parts[0] - 1, +parts[1]);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDisplayDate(mmddyyyy: string): string {
  if (!mmddyyyy) return '';
  const parts = mmddyyyy.split('/');
  if (parts.length !== 3) return mmddyyyy;
  const d = new Date(+parts[2], +parts[0] - 1, +parts[1]);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isHacUngraded(a: Assignment): boolean {
  const score  = (a.score  ?? '').toLowerCase().trim();
  const points = (a.points ?? '').toLowerCase().trim();
  if (!points || points === 'n/a' || points === '0' || points === '0.00') return false;
  if (score.includes('inc')) return true;
  if (!score || score === 'n/a') return true;
  return false;
}

function groupIntoSections(items: PlannerItem[]): PlannerSection[] {
  const now = todayMidnight();
  const DAY = 86_400_000;
  const bins: Record<string, PlannerItem[]> = {
    overdue: [], today: [], tomorrow: [], week: [], later: [], nodate: [],
  };
  for (const item of items) {
    const ms = parseDueMs(item.dateDue);
    if (!ms)                 { bins.nodate.push(item);   continue; }
    if (ms < now)            { bins.overdue.push(item);  continue; }
    if (ms < now + DAY)      { bins.today.push(item);    continue; }
    if (ms < now + 2 * DAY) { bins.tomorrow.push(item); continue; }
    if (ms < now + 7 * DAY) { bins.week.push(item);     continue; }
    bins.later.push(item);
  }
  const sections: PlannerSection[] = [];
  if (bins.overdue.length)  sections.push({ title: 'Overdue',   sectionKey: 'overdue',   data: bins.overdue });
  if (bins.today.length)    sections.push({ title: 'Today',     sectionKey: 'today',     data: bins.today });
  if (bins.tomorrow.length) sections.push({ title: 'Tomorrow',  sectionKey: 'tomorrow',  data: bins.tomorrow });
  if (bins.week.length)     sections.push({ title: 'This Week', sectionKey: 'week',      data: bins.week });
  if (bins.later.length)    sections.push({ title: 'Later',     sectionKey: 'later',     data: bins.later });
  if (bins.nodate.length)   sections.push({ title: 'No Date',   sectionKey: 'nodate',    data: bins.nodate });
  return sections;
}

function buildCalGrid(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay();
  const grid: (number | null)[][] = [];
  let d = 1 - firstDow;
  while (d <= daysInMonth) {
    const row: (number | null)[] = [];
    for (let col = 0; col < 7; col++, d++) {
      row.push(d >= 1 && d <= daysInMonth ? d : null);
    }
    grid.push(row);
  }
  return grid;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const { theme } = useTheme();

  const [sections, setSections]   = useState<PlannerSection[]>([]);
  const [loading, setLoading]     = useState(true);
  const [classList, setClassList] = useState<{ id: string; name: string }[]>([]);

  // Add modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [taskName, setTaskName]               = useState('');
  const [taskClassName, setTaskClassName]     = useState('');
  const [taskDate, setTaskDate]               = useState('');
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen]   = useState(false);
  const [pickerYear, setPickerYear]   = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth() + 1);

  useFocusEffect(
    useCallback(() => { loadData(); }, []),
  );

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);

    const periodStr = await AsyncStorage.getItem('prefetched_current_period');
    const period    = periodStr ? parseInt(periodStr, 10) : 1;

    const grades = await GradeCacheService.getCachedGradesStale(period);
    setClassList((grades ?? []).map(g => ({ id: g.id, name: g.className })));

    // Load dismissed set
    let dismissed = new Set<string>();
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      if (raw) dismissed = new Set(JSON.parse(raw));
    } catch {}

    // HAC ungraded / incomplete items
    const hacItems: PlannerItem[] = [];
    for (const grade of (grades ?? [])) {
      try {
        const raw = await AsyncStorage.getItem(`assignments_cache_${grade.id}_p${period}`);
        if (!raw) continue;
        const assignments: Assignment[] = JSON.parse(raw);
        for (const a of assignments) {
          if (!isHacUngraded(a)) continue;
          const key = `hac::${grade.id}::${a.name}`;
          if (dismissed.has(key)) continue;
          const score = (a.score ?? '').toLowerCase().trim();
          hacItems.push({
            key,
            name: a.name,
            className: grade.className,
            dateDue: a.dateDue || '',
            source: 'hac',
            isIncomplete: score.includes('inc'),
            completed: false,
          });
        }
      } catch {}
    }

    // User-added tasks
    let userTasks: UserTask[] = [];
    try {
      const raw = await AsyncStorage.getItem(PLANNER_TASKS_KEY);
      if (raw) userTasks = JSON.parse(raw);
    } catch {}

    const userItems: PlannerItem[] = userTasks.map(t => ({
      key: `user::${t.id}`,
      name: t.name,
      className: t.className,
      dateDue: t.dateDue,
      source: 'user' as const,
      isIncomplete: false,
      completed: t.completed,
      taskId: t.id,
    }));

    const allItems = [...hacItems, ...userItems].sort((a, b) => {
      const da = parseDueMs(a.dateDue), db = parseDueMs(b.dateDue);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

    setSections(groupIntoSections(allItems));
    setLoading(false);
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveTask = async () => {
    if (!taskName.trim()) return;
    const newTask: UserTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: taskName.trim(),
      className: taskClassName || 'Other',
      dateDue: taskDate,
      completed: false,
      createdAt: Date.now(),
    };
    try {
      const raw = await AsyncStorage.getItem(PLANNER_TASKS_KEY);
      const tasks: UserTask[] = raw ? JSON.parse(raw) : [];
      tasks.push(newTask);
      await AsyncStorage.setItem(PLANNER_TASKS_KEY, JSON.stringify(tasks));
    } catch {}
    setAddModalVisible(false);
    loadData(true);
  };

  const toggleComplete = async (taskId: string) => {
    try {
      const raw = await AsyncStorage.getItem(PLANNER_TASKS_KEY);
      const tasks: UserTask[] = raw ? JSON.parse(raw) : [];
      const i = tasks.findIndex(t => t.id === taskId);
      if (i >= 0) {
        tasks[i].completed = !tasks[i].completed;
        await AsyncStorage.setItem(PLANNER_TASKS_KEY, JSON.stringify(tasks));
      }
    } catch {}
    loadData(true);
  };

  const deleteTask = async (taskId: string) => {
    try {
      const raw = await AsyncStorage.getItem(PLANNER_TASKS_KEY);
      const tasks: UserTask[] = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(PLANNER_TASKS_KEY, JSON.stringify(tasks.filter(t => t.id !== taskId)));
    } catch {}
    loadData(true);
  };

  const dismissHacItem = async (key: string) => {
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      const set: string[] = raw ? JSON.parse(raw) : [];
      if (!set.includes(key)) set.push(key);
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(set));
    } catch {}
    loadData(true);
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openAddModal = () => {
    setTaskName('');
    setTaskClassName('');
    setTaskDate('');
    setClassPickerOpen(false);
    setDatePickerOpen(false);
    const now = new Date();
    setPickerYear(now.getFullYear());
    setPickerMonth(now.getMonth() + 1);
    setAddModalVisible(true);
  };

  const pickDay = (day: number) => {
    const m = String(pickerMonth).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setTaskDate(`${m}/${d}/${pickerYear}`);
    setDatePickerOpen(false);
  };

  const advancePicker = (dir: 'prev' | 'next') => {
    let m = pickerMonth + (dir === 'next' ? 1 : -1);
    let y = pickerYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setPickerMonth(m);
    setPickerYear(y);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderSectionHeader = ({ section }: { section: PlannerSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <Text style={[
        styles.sectionTitle,
        { color: section.sectionKey === 'overdue' ? OVERDUE : theme.textSecondary },
      ]}>
        {section.title}
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: PlannerItem }) => {
    const dateLabel = item.dateDue ? formatDisplayDate(item.dateDue) : null;

    if (item.source === 'hac') {
      return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <View style={[styles.hacBar, { backgroundColor: theme.primary }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.rowActions}>
                {item.isIncomplete && (
                  <View style={styles.incBadge}>
                    <Text style={styles.incBadgeText}>Inc</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => dismissHacItem(item.key)}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Ionicons name="close-circle-outline" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={[styles.itemClass, { color: theme.primary }]} numberOfLines={1}>
                {item.className}
              </Text>
              {dateLabel ? (
                <Text style={[styles.itemDate, { color: theme.textSecondary }]}>{dateLabel}</Text>
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    // User task
    return (
      <View style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.border, opacity: item.completed ? 0.55 : 1 },
      ]}>
        <TouchableOpacity style={styles.checkBtn} onPress={() => toggleComplete(item.taskId!)}>
          <View style={[
            styles.checkCircle,
            { borderColor: theme.primary, backgroundColor: item.completed ? theme.primary : 'transparent' },
          ]}>
            {item.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[
              styles.itemName,
              { color: theme.text, textDecorationLine: item.completed ? 'line-through' : 'none' },
            ]} numberOfLines={2}>
              {item.name}
            </Text>
            <TouchableOpacity
              onPress={() => deleteTask(item.taskId!)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.cardBottom}>
            {item.className ? (
              <Text style={[styles.itemClass, { color: theme.primary }]} numberOfLines={1}>
                {item.className}
              </Text>
            ) : null}
            {dateLabel ? (
              <Text style={[styles.itemDate, { color: theme.textSecondary }]}>{dateLabel}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  // ── Mini calendar ─────────────────────────────────────────────────────────

  const calGrid = buildCalGrid(pickerYear, pickerMonth);
  const nowDate = new Date();

  const renderMiniCalendar = () => (
    <View style={[styles.miniCal, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <View style={styles.calNavRow}>
        <TouchableOpacity onPress={() => advancePicker('prev')} style={styles.calNavBtn}>
          <Ionicons name="chevron-back" size={18} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.calNavLabel, { color: theme.text }]}>
          {MONTH_NAMES[pickerMonth - 1]} {pickerYear}
        </Text>
        <TouchableOpacity onPress={() => advancePicker('next')} style={styles.calNavBtn}>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.calDowRow}>
        {DOW_SHORT.map(d => (
          <Text key={d} style={[styles.calDowLabel, { color: theme.textSecondary }]}>{d}</Text>
        ))}
      </View>

      {calGrid.map((week, ri) => (
        <View key={ri} style={styles.calWeekRow}>
          {week.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.calDayCell} />;

            const isToday =
              day === nowDate.getDate() &&
              pickerMonth === nowDate.getMonth() + 1 &&
              pickerYear  === nowDate.getFullYear();

            const selParts = taskDate.split('/');
            const isSelected =
              selParts.length === 3 &&
              parseInt(selParts[0], 10) === pickerMonth &&
              parseInt(selParts[1], 10) === day &&
              parseInt(selParts[2], 10) === pickerYear;

            return (
              <TouchableOpacity
                key={ci}
                style={[
                  styles.calDayCell,
                  isSelected && [styles.calDaySelected, { backgroundColor: theme.primary }],
                  isToday && !isSelected && { borderWidth: 1.5, borderColor: theme.primary, borderRadius: 18 },
                ]}
                onPress={() => pickDay(day)}>
                <Text style={[
                  styles.calDayText,
                  { color: theme.text },
                  isSelected && { color: '#fff', fontWeight: '700' },
                  isToday && !isSelected && { color: theme.primary, fontWeight: '600' },
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  // ── Inline class list ─────────────────────────────────────────────────────

  const renderInlineClassPicker = () => (
    <View style={[styles.inlineList, { borderColor: theme.border, backgroundColor: theme.background }]}>
      {[...classList, { id: 'other', name: 'Other' }].map(cls => (
        <TouchableOpacity
          key={cls.id}
          style={[styles.inlineListRow, { borderBottomColor: theme.border }]}
          onPress={() => { setTaskClassName(cls.name); setClassPickerOpen(false); }}>
          <Text style={[styles.inlineListText, { color: theme.text }]}>{cls.name}</Text>
          {taskClassName === cls.name && (
            <Ionicons name="checkmark" size={16} color={theme.primary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  const totalCount = sections.reduce((s, sec) => s + sec.data.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <GradientHeader style={styles.header}>
        <Text style={[styles.title, { color: theme.headerText }]}>Planner</Text>
      </GradientHeader>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : totalCount === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={52} color={theme.textSecondary} style={{ marginBottom: 14 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up!</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            No pending assignments found.{'\n'}Tap + to add your own tasks.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={openAddModal}
        activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Add Task Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddModalVisible(false)}>
          <View
            style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}
            onStartShouldSetResponder={() => true}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Task</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* Name */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Assignment Name</Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                }]}
                placeholder="e.g. Chapter 5 Essay"
                placeholderTextColor={theme.textSecondary}
                value={taskName}
                onChangeText={setTaskName}
                autoFocus
                returnKeyType="next"
              />

              {/* Class — inline picker */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Class</Text>
              <TouchableOpacity
                style={[
                  styles.selectorRow,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  classPickerOpen && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
                ]}
                onPress={() => { setClassPickerOpen(v => !v); setDatePickerOpen(false); }}>
                <Text style={[styles.selectorText, { color: taskClassName ? theme.text : theme.textSecondary }]}>
                  {taskClassName || 'Select class…'}
                </Text>
                <Ionicons
                  name={classPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {classPickerOpen && renderInlineClassPicker()}

              {/* Due Date — inline calendar */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: classPickerOpen ? 0 : undefined }]}>
                Due Date
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectorRow,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  datePickerOpen && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
                ]}
                onPress={() => { setDatePickerOpen(v => !v); setClassPickerOpen(false); }}>
                <Text style={[styles.selectorText, { color: taskDate ? theme.text : theme.textSecondary }]}>
                  {taskDate ? formatDisplayDate(taskDate) : 'Select date (optional)'}
                </Text>
                <Ionicons
                  name={datePickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {datePickerOpen && renderMiniCalendar()}

              {/* Add button */}
              <TouchableOpacity
                style={[
                  styles.addTaskBtn,
                  { backgroundColor: taskName.trim() ? theme.primary : theme.border },
                ]}
                onPress={saveTask}
                disabled={!taskName.trim()}>
                <Text style={styles.addTaskBtnText}>Add Task</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  title:  { fontSize: 28, fontWeight: 'bold' },

  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  list: { padding: 12, paddingBottom: 100 },

  sectionHeader: { paddingVertical: 8, paddingHorizontal: 4 },
  sectionTitle:  {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hacBar:  { width: 4 },
  checkBtn: { paddingLeft: 14, justifyContent: 'center' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:   { flex: 1, padding: 12 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  itemName:  { flex: 1, fontSize: 14, fontWeight: '500', marginRight: 8, lineHeight: 20 },
  itemClass: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  itemDate:  { fontSize: 11 },
  incBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: INC_BG },
  incBadgeText: { fontSize: 10, fontWeight: '700', color: INC_TEXT },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 6, elevation: 6,
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 44, maxHeight: '92%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 22 },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8, marginTop: 4,
  },
  textInput: {
    height: 48, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 15, marginBottom: 18,
  },
  selectorRow: {
    height: 48, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', marginBottom: 0,
  },
  selectorText: { fontSize: 15, flex: 1 },

  // Inline class list (attaches flush below selectorRow)
  inlineList: {
    borderWidth: 1, borderTopWidth: 0,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    marginBottom: 18, overflow: 'hidden',
  },
  inlineListRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineListText: { fontSize: 15, flex: 1 },

  addTaskBtn: {
    height: 50, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', marginTop: 18, marginBottom: 8,
  },
  addTaskBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Mini calendar ──────────────────────────────────────────────────────────
  miniCal: {
    borderWidth: 1, borderTopWidth: 0,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    padding: 10, marginBottom: 18,
  },
  calNavRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNavBtn:   { padding: 4 },
  calNavLabel: { fontSize: 15, fontWeight: '600' },
  calDowRow:   { flexDirection: 'row', marginBottom: 4 },
  calDowLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calWeekRow:    { flexDirection: 'row', marginBottom: 2 },
  calDayCell:    { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  calDaySelected:{ borderRadius: 18 },
  calDayText:    { fontSize: 13 },
});
