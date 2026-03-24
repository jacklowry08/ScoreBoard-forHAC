import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { letterGradeColor, gpaColor } from '../constants/colors';

// ─── grade scale ─────────────────────────────────────────────────────────────
// Standard: A=4  |  Honors/Pre-AICE: A=4.5  |  AP/AICE/DE/IB: A=5.0

type CourseType = 'ap' | 'honors' | 'standard';

const GRADE_POINTS: Record<CourseType, Record<string, number>> = {
  ap:       { A: 5.0, B: 4.0, C: 3.0, D: 2.0, F: 0.0 },
  honors:   { A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.0 },
  standard: { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 },
};

const GRADE_OPTIONS = ['A', 'B', 'C', 'D', 'F'];

// ─── helpers ─────────────────────────────────────────────────────────────────

const DE_PREFIXES = new Set([
  'AMH','ANT','ARH','AST','BSC','CHM','ECO','ENC','ESC','EVR',
  'GLY','HUM','LIT','MAC','MGF','MUL','OCE','PHI','PHY','POS',
  'PSY','STA','THE',
]);

function isDualEnrollment(courseCode: string): boolean {
  const prefix = (courseCode ?? '').trim().toUpperCase().match(/^([A-Z]+)/)?.[1];
  return !!prefix && DE_PREFIXES.has(prefix);
}

function getCourseType(name: string, courseCode: string): CourseType {
  if (isDualEnrollment(courseCode)) return 'ap';
  if (/Pre-?AICE/i.test(name)) return 'honors';
  if (/\bAP\b|\bAICE\b|\bIB\b/i.test(name)) return 'ap';
  if (/\bHon(ors)?\b/i.test(name)) return 'honors';
  return 'standard';
}

/** Returns 'SKIP' for WP/WF/NG, 'INC' for Incomplete, A/B/C/D/F, or '' */
function normalizeGrade(g: string): string {
  const s = (g ?? '').trim().toUpperCase();
  if (!s) return '';
  if (s === 'NG' || s.startsWith('W')) return 'SKIP';
  if (s.startsWith('INC') || s === 'I') return 'INC';
  const first = s.charAt(0);
  return GRADE_OPTIONS.includes(first) ? first : '';
}

function gradeColor(grade: string, fallback: string): string {
  return letterGradeColor(grade) || fallback;
}

function formatCredit(credit: string): string {
  const n = parseFloat(credit);
  if (isNaN(n)) return credit;
  return n % 1 === 0 ? n.toFixed(0) : n.toString();
}

const TYPE_LABEL: Record<CourseType, string> = {
  ap: 'AP',
  honors: 'HON',
  standard: '',
};

// ─── types ───────────────────────────────────────────────────────────────────

interface TranscriptCourse {
  courseCode: string;
  courseName: string;
  sm1: string;
  sm2: string;
  fin: string;
  creditEarned: string;
}

interface TranscriptGroup {
  year: string;
  grade: string;
  gpa: string;
  credit: string;
  courses: TranscriptCourse[];
}

interface EditableGrades { sm1: string; sm2: string; fin: string; }
type GradeField = keyof EditableGrades;

const FIELD_LABELS: Record<GradeField, string> = { sm1: 'SM1', sm2: 'SM2', fin: 'FIN' };
const FIELD_NAMES:  Record<GradeField, string> = { sm1: 'Semester 1', sm2: 'Semester 2', fin: 'Final' };

// ─── component ───────────────────────────────────────────────────────────────

export default function GPACalculatorScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { allGroups } = route.params as { allGroups: TranscriptGroup[] };

  const currentGroup = allGroups[allGroups.length - 1];
  const pastGroups   = allGroups.slice(0, -1);

  // Show all current-year courses (including 0-credit in-progress courses)
  const editableCourses = currentGroup.courses;

  const [editableGrades, setEditableGrades] = useState<EditableGrades[]>(() =>
    editableCourses.map((c) => ({
      sm1: normalizeGrade(c.sm1),
      sm2: normalizeGrade(c.sm2),
      fin: normalizeGrade(c.fin),
    }))
  );

  const [weighted, setWeighted] = useState(false);
  const [editingCell, setEditingCell] = useState<{ idx: number; field: GradeField } | null>(null);

  // ── cumulative GPA: Σ(grade_points × credits) / Σ(credits) ──────────────
  const { gpa, courseCount } = useMemo(() => {
    let totalPts = 0, totalCredits = 0, count = 0;

    // GPA = Σ(grade_points × credits) / Σ(credits)
    const addCourse = (name: string, courseCode: string, sm1: string, sm2: string, fin: string, creditStr: string, isPast: boolean) => {
      const parsed = parseFloat(creditStr);

      // Past years: skip courses with 0 credit (middle school, PE transfer, etc.)
      if (isPast && !isNaN(parsed) && parsed <= 0) return;

      const normFin = normalizeGrade(fin);
      const normSm1 = normalizeGrade(sm1);
      const normSm2 = normalizeGrade(sm2);

      // WP / WF / NG on any grade → exclude entire course
      if (normFin === 'SKIP' || normSm1 === 'SKIP' || normSm2 === 'SKIP') return;

      const scale = weighted ? GRADE_POINTS[getCourseType(name, courseCode)] : GRADE_POINTS.standard;
      const ptsFor = (g: string) => g === 'INC' ? 0 : (scale[g] ?? 0);

      const sm1Valid = normSm1 !== '' && normSm1 !== 'SKIP';
      const sm2Valid = normSm2 !== '' && normSm2 !== 'SKIP';
      const finValid = normFin !== '' && normFin !== 'SKIP';

      let credit: number;
      if (isPast) {
        // Past years: always use actual creditEarned
        credit = isNaN(parsed) || parsed <= 0 ? 0.5 : parsed;
      } else {
        // Current year: derive credit from grades entered so that
        // SM1 only = 0.5 cr, SM1+SM2 = 1.0 cr for in-progress courses
        const semCount = (sm1Valid ? 1 : 0) + (sm2Valid ? 1 : 0);
        if (!isNaN(parsed) && parsed >= 1.0) {
          credit = parsed;   // already a full complete course
        } else if (semCount === 2) {
          credit = 1.0;      // both semesters entered → full year
        } else if (semCount === 1) {
          credit = 0.5;      // one semester entered
        } else if (finValid) {
          credit = (!isNaN(parsed) && parsed > 0) ? parsed : 0.5;
        } else {
          return; // no grades (e.g. Drivers Ed with 0 credit and no grades)
        }
      }

      if (sm1Valid && sm2Valid) {
        // Average SM1 + SM2 quality points (e.g. AP A+B → (5+4)/2 = 4.5)
        totalPts += (ptsFor(normSm1) + ptsFor(normSm2)) / 2 * credit;
        totalCredits += credit;
      } else if (sm1Valid && finValid && normFin !== 'INC') {
        // Average SM1 + FIN
        totalPts += (ptsFor(normSm1) + ptsFor(normFin)) / 2 * credit;
        totalCredits += credit;
      } else if (finValid) {
        // FIN only (INC → 0 pts, credit still counts)
        totalPts += ptsFor(normFin) * credit;
        totalCredits += credit;
      } else if (sm1Valid) {
        totalPts += ptsFor(normSm1) * credit;
        totalCredits += credit;
      } else if (sm2Valid) {
        totalPts += ptsFor(normSm2) * credit;
        totalCredits += credit;
      } else {
        return;
      }
      count++;
    };

    for (const group of pastGroups) {
      for (const c of group.courses) {
        addCourse(c.courseName, c.courseCode, c.sm1, c.sm2, c.fin, c.creditEarned, true);
      }
    }

    editableCourses.forEach((c, i) => {
      const eg = editableGrades[i];
      addCourse(c.courseName, c.courseCode, eg.sm1, eg.sm2, eg.fin, c.creditEarned, false);
    });

    return {
      gpa: totalCredits > 0 ? (totalPts / totalCredits).toFixed(3) : null,
      courseCount: count,
    };
  }, [editableGrades, weighted]);

  const gpaColorValue = gpa == null
    ? (theme.textSecondary as string)
    : gpaColor(parseFloat(gpa));

  const setGrade = (grade: string) => {
    if (!editingCell) return;
    const { idx, field } = editingCell;
    setEditableGrades((prev) =>
      prev.map((eg, i) => (i === idx ? { ...eg, [field]: grade } : eg))
    );
    setEditingCell(null);
  };

  const editingCurrentValue = editingCell
    ? editableGrades[editingCell.idx][editingCell.field]
    : '';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── header ───────────────────────────────────────────────────────── */}
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>GPA Calculator</Text>
      </GradientHeader>

      {/* ── summary card ─────────────────────────────────────────────────── */}
      <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.gpaNumber, { color: gpaColorValue }]}>{gpa ?? '—'}</Text>
          <Text style={[styles.gpaLabel, { color: theme.textSecondary }]}>
            {weighted ? 'Weighted' : 'Unweighted'} Cumulative GPA
          </Text>
          <Text style={[styles.gpaSubLabel, { color: theme.textSecondary }]}>
            {courseCount} courses · editing {currentGroup.year}
          </Text>
        </View>
        <View style={styles.toggleGroup}>
          {(['Unweighted', 'Weighted'] as const).map((label, i) => {
            const active = (i === 1) === weighted;
            return (
              <TouchableOpacity
                key={label}
                style={[
                  styles.toggleBtn,
                  active
                    ? { backgroundColor: theme.primary }
                    : { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 },
                ]}
                onPress={() => setWeighted(i === 1)}>
                <Text style={[styles.toggleText, { color: active ? '#fff' : theme.textSecondary }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── section label ────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.sectionLeft}>
          <Text style={[styles.sectionYear, { color: theme.text }]}>{currentGroup.year}</Text>
          {!!currentGroup.grade && (
            <Text style={[styles.sectionGrade, { color: theme.textSecondary }]}>
              Grade {currentGroup.grade}
            </Text>
          )}
        </View>
        <Text style={[styles.sectionHint, { color: theme.primary }]}>Tap a grade to edit</Text>
      </View>

      {/* ── course table ─────────────────────────────────────────────────── */}
      <FlatList
        data={editableCourses}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const eg  = editableGrades[index];
          const type = getCourseType(item.courseName);
          const typeLabel = TYPE_LABEL[type];

          return (
            <View style={[styles.courseRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={styles.courseInfo}>
                {!!item.courseCode && (
                  <Text style={[styles.courseCode, { color: theme.textSecondary }]}>
                    {item.courseCode}
                  </Text>
                )}
                <View style={styles.courseNameRow}>
                  <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                    {item.courseName}
                  </Text>
                  {!!typeLabel && (
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: type === 'ap' ? '#7C4DFF20' : '#00838F20' },
                    ]}>
                      <Text style={[
                        styles.typeBadgeText,
                        { color: type === 'ap' ? '#7C4DFF' : '#00838F' },
                      ]}>
                        {typeLabel}
                      </Text>
                    </View>
                  )}
                </View>
                {!!item.creditEarned && (
                  <Text style={[styles.credit, { color: theme.textSecondary }]}>
                    {formatCredit(item.creditEarned)} credit
                  </Text>
                )}
              </View>

              <View style={styles.gradeColumns}>
                {(['sm1', 'sm2', 'fin'] as GradeField[]).map((field) => {
                  const value = eg[field];
                  return (
                    <TouchableOpacity
                      key={field}
                      style={styles.gradeCol}
                      onPress={() => setEditingCell({ idx: index, field })}>
                      <Text style={[styles.gradeColLabel, { color: theme.textSecondary }]}>
                        {FIELD_LABELS[field]}
                      </Text>
                      <Text style={[
                        styles.gradeColValue,
                        { color: value ? gradeColor(value, theme.border as string) : theme.border as string },
                      ]}>
                        {value || '—'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        }}
      />

      {/* ── grade picker modal ────────────────────────────────────────────── */}
      <Modal
        visible={editingCell !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCell(null)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setEditingCell(null)}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}
            onPress={() => {}}>
            {editingCell && (
              <>
                <Text style={[styles.modalCourseName, { color: theme.text }]} numberOfLines={2}>
                  {editableCourses[editingCell.idx].courseName}
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {FIELD_NAMES[editingCell.field]} grade
                </Text>
              </>
            )}

            {/* Single row of A / B / C / D / F */}
            <View style={styles.gradeRow}>
              {GRADE_OPTIONS.map((g) => {
                const active = editingCurrentValue === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.gradeOption,
                      active
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
                    ]}
                    onPress={() => setGrade(g)}>
                    <Text style={[styles.gradeOptionText, { color: active ? '#fff' : theme.text }]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: theme.border }]}
              onPress={() => setGrade('')}>
              <Text style={[styles.clearBtnText, { color: theme.textSecondary }]}>Clear grade</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderTopColor: theme.border }]}
              onPress={() => setEditingCell(null)}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },

  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginTop: 12,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryLeft: { flex: 1 },
  gpaNumber: { fontSize: 52, fontWeight: '800', fontFamily: 'Inter_700Bold', lineHeight: 58 },
  gpaLabel: { fontSize: 13, marginTop: 2 },
  gpaSubLabel: { fontSize: 12, marginTop: 4 },
  toggleGroup: { gap: 8, alignItems: 'flex-end' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  toggleText: { fontSize: 12, fontWeight: '600' },

  legend: {
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendLabel: { fontSize: 11, fontWeight: '600', width: 68 },
  legendPts: { fontSize: 11 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  sectionLeft: { flex: 1 },
  sectionYear: { fontSize: 14, fontWeight: '700' },
  sectionGrade: { fontSize: 12, marginTop: 1 },
  sectionHint: { fontSize: 12, fontWeight: '600' },

  listContent: { paddingBottom: 32 },

  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  courseInfo: { flex: 1, marginRight: 12 },
  courseCode: { fontSize: 11, fontWeight: '600', marginBottom: 2, letterSpacing: 0.3 },
  courseNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  courseName: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  credit: { fontSize: 11, marginTop: 3 },
  typeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },

  gradeColumns: { flexDirection: 'row', gap: 8 },
  gradeCol: { alignItems: 'center', minWidth: 32 },
  gradeColLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  gradeColValue: { fontSize: 14, fontWeight: '700' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalCourseName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  modalSubtitle: { fontSize: 13, marginBottom: 18 },
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  gradeOption: {
    width: 52,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeOptionText: { fontSize: 18, fontWeight: '700' },
  clearBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 4,
  },
  clearBtnText: { fontSize: 14 },
  cancelBtn: { marginTop: 10, paddingTop: 12, borderTopWidth: 1, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});
