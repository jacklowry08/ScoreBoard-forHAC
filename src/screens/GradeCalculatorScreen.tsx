import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import GradientHeader from '../components/GradientHeader';
import { Assignment } from '../services/webScraper';
import { gradeColor as gradeColorUtil, FORMATIVE, SUMMATIVE } from '../constants/colors';

// ─── types ────────────────────────────────────────────────────────────────────

interface HypoAssignment {
  id: string;
  name: string;
  score: string;
  points: string;
  weight: string;
  isSummative: boolean;
  isEC: boolean;
}

type ListItem =
  | { kind: 'existing'; item: Assignment; idx: number }
  | { kind: 'divider' }
  | { kind: 'hypo'; item: HypoAssignment; idx: number };

// ─── helpers ──────────────────────────────────────────────────────────────────

function wAvg(items: Array<{ score: string; points: string; weight: string; isEC?: boolean }>): number | null {
  let sw = 0, pw = 0;
  for (const a of items) {
    if (a.isEC) {
      const ss = parseFloat(a.score);
      if (isNaN(ss)) continue; // unscored → skip
      sw += ss * (parseFloat(a.weight) || 1);
      continue;
    }

    const rawScore = (a.score || '').toLowerCase().trim();
    const isInc = rawScore.includes('incomplete') || rawScore === 'inc';

    // Blank / N/A and NOT explicitly incomplete → EC or ungraded → skip
    if (!isInc && (!rawScore || rawScore === 'n/a')) continue;

    let s: number, p: number;

    if (isInc) {
      s = 0;
      const pp = parseFloat(a.points);
      p = (!a.points || a.points === 'N/A' || isNaN(pp) || pp === 0) ? 100 : pp;
    } else {
      if (!a.points || a.points === 'N/A') continue;
      const pp = parseFloat(a.points);
      if (isNaN(pp) || pp === 0) continue;
      p = pp;
      const ss = parseFloat(a.score);
      if (isNaN(ss)) continue;
      s = ss;
    }

    const w = parseFloat(a.weight) || 1;
    sw += s * w;
    pw += p * w;
  }
  return pw > 0 ? (sw / pw) * 100 : null;
}

/** Format "100.00" → "100", "85.50" → "85.5" */
function fmtNum(s: string): string {
  const n = parseFloat(s);
  return isNaN(n) ? s : (n % 1 === 0 ? n.toFixed(0) : n.toString());
}

function gradeColor(pct: number | null, fallback: string): string {
  if (pct === null) return fallback;
  return gradeColorUtil(pct);
}

/** Incomplete is never EC — it counts as 0. EC = no score marker AND no max points. */
function isExistingEC(a: Assignment): boolean {
  const raw = (a.score || '').toLowerCase().trim();
  if (raw.includes('incomplete') || raw === 'inc') return false;
  return !a.points || a.points === 'N/A';
}

function newHypo(): HypoAssignment {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    score: '',
    points: '100',
    weight: '1',
    isSummative: false,
    isEC: false,
  };
}

// ─── component ────────────────────────────────────────────────────────────────

export default function GradeCalculatorScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { assignments, className }: {
    assignments: Assignment[];
    className: string;
  } = route.params;

  // Per-assignment score overrides (index → new score string)
  const [editedScores, setEditedScores] = useState<Record<number, string>>({});
  // Hypothetical assignments added by the user
  const [hypos, setHypos] = useState<HypoAssignment[]>([]);

  // ── edit existing score modal ──────────────────────────────────────────────
  const [scoreModalIdx, setScoreModalIdx] = useState<number | null>(null);
  const [scoreInput, setScoreInput] = useState('');

  // ── add / edit hypothetical modal ─────────────────────────────────────────
  const [hypoModalOpen, setHypoModalOpen] = useState(false);
  const [hypoEditIdx, setHypoEditIdx] = useState<number | null>(null);
  const [hypoForm, setHypoForm] = useState<HypoAssignment>(newHypo());

  // ── live grade computation ─────────────────────────────────────────────────
  const { faAvg, saAvg, overallAvg } = useMemo(() => {
    const fa: Array<{ score: string; points: string; weight: string; isEC?: boolean }> = [];
    const sa: Array<{ score: string; points: string; weight: string; isEC?: boolean }> = [];

    // Existing assignments with score overrides
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const ec = isExistingEC(a);
      const score = editedScores[i] !== undefined ? editedScores[i] : a.score;
      const item = { score, points: a.points, weight: a.weight, isEC: ec };
      if (a.category.toLowerCase().includes('summative')) sa.push(item);
      else fa.push(item);
    }

    // Hypothetical assignments
    for (const h of hypos) {
      if (!h.score) continue;
      const item = { score: h.score, points: h.isEC ? 'N/A' : h.points, weight: h.weight, isEC: h.isEC };
      if (h.isSummative) sa.push(item);
      else fa.push(item);
    }

    const faVal = wAvg(fa);
    const saVal = wAvg(sa);

    // Overall = 30% Formative + 70% Summative
    let overall: number | null = null;
    if (faVal !== null && saVal !== null) {
      overall = faVal * 0.3 + saVal * 0.7;
    } else if (faVal !== null) {
      overall = faVal;
    } else if (saVal !== null) {
      overall = saVal;
    }

    return { faAvg: faVal, saAvg: saVal, overallAvg: overall };
  }, [editedScores, hypos, assignments]);

  // ── handlers ──────────────────────────────────────────────────────────────

  const openScoreModal = (idx: number) => {
    setScoreInput('');
    setScoreModalIdx(idx);
  };

  const saveScoreOverride = () => {
    if (scoreModalIdx === null) return;
    setEditedScores(p => ({ ...p, [scoreModalIdx]: scoreInput }));
    setScoreModalIdx(null);
  };

  const clearScoreOverride = (idx: number) => {
    setEditedScores(p => { const n = { ...p }; delete n[idx]; return n; });
  };

  const openAddHypo = () => {
    setHypoEditIdx(null);
    setHypoForm(newHypo());
    setHypoModalOpen(true);
  };

  const openEditHypo = (idx: number) => {
    setHypoEditIdx(idx);
    setHypoForm({ ...hypos[idx] });
    setHypoModalOpen(true);
  };

  const saveHypo = () => {
    if (hypoEditIdx !== null) {
      setHypos(p => p.map((h, i) => i === hypoEditIdx ? { ...hypoForm } : h));
    } else {
      setHypos(p => [...p, { ...hypoForm, id: Math.random().toString(36).slice(2) }]);
    }
    setHypoModalOpen(false);
  };

  const deleteHypo = (idx: number) => {
    setHypos(p => p.filter((_, i) => i !== idx));
  };

  // ── list data ─────────────────────────────────────────────────────────────

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = assignments.map((item, idx) => ({ kind: 'existing', item, idx }));
    if (hypos.length > 0) {
      items.push({ kind: 'divider' });
      hypos.forEach((item, idx) => items.push({ kind: 'hypo', item, idx }));
    }
    return items;
  }, [assignments, hypos]);

  // ── render ────────────────────────────────────────────────────────────────

  const renderExisting = (item: Assignment, idx: number) => {
    const isOverridden = editedScores[idx] !== undefined;
    const displayScore = isOverridden ? editedScores[idx] : item.score;
    const isSA = item.category.toLowerCase().includes('summative');
    const catColor = isSA ? SUMMATIVE : FORMATIVE;
    const ec = isExistingEC(item);

    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
        onPress={() => openScoreModal(idx)}
        activeOpacity={0.7}>
        <View style={[
          styles.catDot,
          ec
            ? { borderColor: catColor, borderWidth: 1.5, backgroundColor: 'transparent' }
            : { backgroundColor: catColor },
        ]} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: ec ? theme.textSecondary : theme.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          {!!item.dateDue && (
            <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Due {item.dateDue}</Text>
          )}
        </View>
        <View style={styles.rowRight}>
          {ec ? (
            <>
              <View style={[
                styles.scoreBox,
                {
                  borderColor: isOverridden ? theme.primary : theme.border,
                  borderWidth: isOverridden ? 1.5 : 1,
                },
              ]}>
                <Text style={[styles.scoreBoxText, { color: isOverridden ? theme.primary : theme.text }]}>
                  {fmtNum(displayScore || '—')}
                </Text>
              </View>
              <Text style={[styles.ecText, { color: theme.textSecondary }]}>EC</Text>
              {isOverridden && (
                <TouchableOpacity
                  onPress={() => clearScoreOverride(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.resetIcon, { color: theme.textSecondary }]}>↺</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={[
                styles.scoreBox,
                {
                  borderColor: isOverridden ? theme.primary : theme.border,
                  borderWidth: isOverridden ? 1.5 : 1,
                },
              ]}>
                <Text style={[styles.scoreBoxText, { color: isOverridden ? theme.primary : theme.text }]}>
                  {fmtNum(displayScore || '—')}/{fmtNum(item.points)}
                </Text>
              </View>
              {isOverridden && (
                <TouchableOpacity
                  onPress={() => clearScoreOverride(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.resetIcon, { color: theme.textSecondary }]}>↺</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHypo = (item: HypoAssignment, idx: number) => {
    const catColor = item.isSummative ? SUMMATIVE : FORMATIVE;
    return (
      <TouchableOpacity
        style={[styles.row, styles.hypoRow, { backgroundColor: theme.cardBackground, borderColor: theme.border, borderLeftColor: catColor }]}
        onPress={() => openEditHypo(idx)}
        activeOpacity={0.7}>
        <View style={[
          styles.catDot,
          item.isEC
            ? { borderColor: catColor, borderWidth: 1.5, backgroundColor: 'transparent' }
            : { backgroundColor: catColor },
        ]} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, { color: item.isEC ? theme.textSecondary : theme.text }]}>
            {item.name || 'Hypothetical Grade'}
          </Text>
          <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
            {item.isSummative ? 'Summative' : 'Formative'}
            {parseFloat(item.weight) !== 1 ? ` · weight ${item.weight}` : ''}
            {item.isEC ? ' · Extra Credit' : ''}
          </Text>
        </View>
        <View style={styles.rowRight}>
          {item.isEC ? (
            <Text style={[styles.ecText, { color: theme.textSecondary }]}>EC</Text>
          ) : (
            <Text style={[styles.scoreText, { color: theme.text }]}>
              {item.score || '—'}/{item.points}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => deleteHypo(idx)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}>
            <Text style={[styles.deleteIcon, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'existing') return renderExisting(item.item, item.idx);
    if (item.kind === 'hypo') return renderHypo(item.item, item.idx);
    // divider
    return (
      <View style={[styles.divider, { borderColor: theme.border }]}>
        <Text style={[styles.dividerText, { color: theme.textSecondary }]}>Hypothetical</Text>
      </View>
    );
  };

  const txt = theme.textSecondary as string;
  const isScoreModalEC = scoreModalIdx !== null && isExistingEC(assignments[scoreModalIdx]);

  // ── main render ───────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <GradientHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.headerText} />
          <Text style={[styles.backText, { color: theme.headerText }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.headerText }]} numberOfLines={2}>
          {className}
        </Text>
      </GradientHeader>

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: FORMATIVE }]}>
            {faAvg != null ? `${faAvg.toFixed(1)}%` : '—'}
          </Text>
          <View style={styles.statLabelRow}>
            <View style={[styles.statDot, { backgroundColor: FORMATIVE }]} />
            <Text style={[styles.statLabel, { color: txt }]}>Formative</Text>
          </View>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: gradeColor(overallAvg, theme.text as string) }]}>
            {overallAvg != null ? `${overallAvg.toFixed(1)}%` : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: txt }]}>Overall</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: SUMMATIVE }]}>
            {saAvg != null ? `${saAvg.toFixed(1)}%` : '—'}
          </Text>
          <View style={styles.statLabelRow}>
            <View style={[styles.statDot, { backgroundColor: SUMMATIVE }]} />
            <Text style={[styles.statLabel, { color: txt }]}>Summative</Text>
          </View>
        </View>
      </View>

      {/* Assignment list */}
      <FlatList
        data={listData}
        keyExtractor={(d, i) => d.kind === 'existing' ? `e-${d.idx}` : d.kind === 'hypo' ? `h-${d.idx}` : `div-${i}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={[styles.sectionHeader, { borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              TAP A SCORE TO EDIT
            </Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: theme.primary }]}
            onPress={openAddHypo}>
            <Text style={[styles.addBtnText, { color: theme.primary }]}>+ Add Hypothetical Grade</Text>
          </TouchableOpacity>
        }
      />

      {/* ── Edit existing score modal ──────────────────────────────────────── */}
      <Modal
        visible={scoreModalIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setScoreModalIdx(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setScoreModalIdx(null)} />
          <View style={[styles.centeredCard, { backgroundColor: theme.cardBackground }]}>
            {scoreModalIdx !== null && (
              <>
                <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={2}>
                  {assignments[scoreModalIdx].name}
                </Text>
                <Text style={[styles.modalSub, { color: txt }]}>
                  {isScoreModalEC
                    ? `Original: ${assignments[scoreModalIdx].score} (EC bonus pts)`
                    : `Original: ${assignments[scoreModalIdx].score} / ${assignments[scoreModalIdx].points}`}
                </Text>
                <Text style={[styles.inputLabel, { color: txt }]}>
                  {isScoreModalEC ? 'EC Bonus Points' : 'New Score'}
                </Text>
                {isScoreModalEC ? (
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                    value={scoreInput}
                    onChangeText={setScoreInput}
                    keyboardType="decimal-pad"
                    placeholder={assignments[scoreModalIdx].score}
                    placeholderTextColor={txt}
                    autoFocus
                  />
                ) : (
                  <View style={styles.inputWithPoints}>
                    <TextInput
                      style={[styles.input, styles.inputFlex, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                      value={scoreInput}
                      onChangeText={setScoreInput}
                      keyboardType="decimal-pad"
                      placeholder={assignments[scoreModalIdx].score}
                      placeholderTextColor={txt}
                      autoFocus
                      selectTextOnFocus
                    />
                    <Text style={[styles.pointsSuffix, { color: theme.textSecondary }]}>
                      / {fmtNum(assignments[scoreModalIdx].points)}
                    </Text>
                  </View>
                )}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btn, { borderColor: theme.border }]}
                    onPress={() => setScoreModalIdx(null)}>
                    <Text style={[styles.btnText, { color: txt }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary }]}
                    onPress={saveScoreOverride}>
                    <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add / Edit hypothetical modal (bottom sheet) ──────────────────── */}
      <Modal
        visible={hypoModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHypoModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setHypoModalOpen(false)} />
          <View style={[styles.sheetCard, { backgroundColor: theme.cardBackground }]}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {hypoEditIdx !== null ? 'Edit Grade' : 'Add Hypothetical Grade'}
              </Text>

              {/* Category toggle */}
              <Text style={[styles.inputLabel, { color: txt }]}>Category</Text>
              <View style={styles.toggleRow}>
                {([
                  { label: 'Formative', isSA: false, color: FORMATIVE },
                  { label: 'Summative', isSA: true, color: SUMMATIVE },
                ] as const).map(({ label, isSA, color }) => {
                  const active = hypoForm.isSummative === isSA;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.toggleBtn,
                        active ? { backgroundColor: color } : { borderColor: theme.border, borderWidth: 1 },
                      ]}
                      onPress={() => setHypoForm(p => ({ ...p, isSummative: isSA }))}>
                      <Text style={[styles.toggleText, { color: active ? '#fff' : txt }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Name */}
              <Text style={[styles.inputLabel, { color: txt }]}>Name (optional)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                value={hypoForm.name}
                onChangeText={v => setHypoForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Test 3"
                placeholderTextColor={txt}
              />

              {/* Score / Max Points */}
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={[styles.inputLabel, { color: txt }]}>
                    {hypoForm.isEC ? 'EC Bonus Points' : 'Score'}
                  </Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                    value={hypoForm.score}
                    onChangeText={v => setHypoForm(p => ({ ...p, score: v }))}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 5"
                    placeholderTextColor={txt}
                  />
                </View>
                {!hypoForm.isEC && (
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabel, { color: txt }]}>Max Points</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                      value={hypoForm.points}
                      onChangeText={v => setHypoForm(p => ({ ...p, points: v }))}
                      keyboardType="decimal-pad"
                      placeholder="100"
                      placeholderTextColor={txt}
                    />
                  </View>
                )}
              </View>

              {/* Weight */}
              <Text style={[styles.inputLabel, { color: txt }]}>Weight</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                value={hypoForm.weight}
                onChangeText={v => setHypoForm(p => ({ ...p, weight: v }))}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={txt}
              />

              {/* Extra Credit */}
              <View style={styles.ecRow}>
                <Text style={[styles.ecLabel, { color: theme.text }]}>Extra Credit</Text>
                <Switch
                  value={hypoForm.isEC}
                  onValueChange={v => setHypoForm(p => ({ ...p, isEC: v, score: v ? '' : p.score }))}
                  trackColor={{ false: theme.border as string, true: theme.primary as string }}
                />
              </View>

              {/* Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, { borderColor: theme.border }]}
                  onPress={() => setHypoModalOpen(false)}>
                  <Text style={[styles.btnText, { color: txt }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary }]}
                  onPress={saveHypo}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    {hypoEditIdx !== null ? 'Save' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 40, opacity: 0.3 },

  sectionHeader: {
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  listContent: { paddingBottom: 32 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  hypoRow: { borderLeftWidth: 3 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  rowSub: { fontSize: 11 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBox: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  scoreBoxText: { fontSize: 14, fontWeight: '600' },
  scoreText: { fontSize: 14, fontWeight: '600' },
  resetIcon: { fontSize: 16 },
  ecText: { fontSize: 12, fontWeight: '600' },
  deleteBtn: { marginLeft: 2 },
  deleteIcon: { fontSize: 13, fontWeight: '600' },

  divider: {
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  dividerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

  addBtn: {
    margin: 15,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: { fontSize: 15, fontWeight: '600' },

  // modals
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  centeredCard: {
    width: '100%',
    borderRadius: 18,
    padding: 22,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 12 },

  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputWithPoints: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputFlex: { flex: 1 },
  pointsSuffix: { fontSize: 18, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '600' },

  ecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 4,
  },
  ecLabel: { fontSize: 15, fontWeight: '500' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
