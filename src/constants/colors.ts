// ─── Grade tier colors ────────────────────────────────────────────────────────

export const GRADE_A = {
  base:     '#4CAF50',
  gradient: ['#66BB6A', '#43A047'] as [string, string],
};
export const GRADE_B = {
  base:     '#8BC34A',
  gradient: ['#AED581', '#7CB342'] as [string, string],
};
export const GRADE_C = {
  base:     '#FFC107',
  gradient: ['#FFCA28', '#FB8C00'] as [string, string],
};
export const GRADE_D = {
  base:     '#FF9800',
  gradient: ['#FFA726', '#E64A19'] as [string, string],
};
export const GRADE_F = {
  base:     '#F44336',
  gradient: ['#EF5350', '#C62828'] as [string, string],
};

/** Returns the base color for a numeric percentage (0–100). */
export function gradeColor(pct: number): string {
  if (pct >= 90) return GRADE_A.base;
  if (pct >= 80) return GRADE_B.base;
  if (pct >= 70) return GRADE_C.base;
  if (pct >= 60) return GRADE_D.base;
  return GRADE_F.base;
}

/** Returns the gradient pair for a numeric percentage (0–100). */
export function gradeGradient(pct: number): [string, string] {
  if (pct >= 90) return GRADE_A.gradient;
  if (pct >= 80) return GRADE_B.gradient;
  if (pct >= 70) return GRADE_C.gradient;
  if (pct >= 60) return GRADE_D.gradient;
  return GRADE_F.gradient;
}

/** Returns the base color for a letter grade string (A, B+, C-, F, etc.). */
export function letterGradeColor(grade: string): string {
  const g = grade.trim().toUpperCase();
  if (g.startsWith('A')) return GRADE_A.base;
  if (g.startsWith('B')) return GRADE_B.base;
  if (g.startsWith('C')) return GRADE_C.base;
  if (g.startsWith('D')) return GRADE_D.base;
  if (g === 'F')         return GRADE_F.base;
  return '';
}

/** Returns the base color for a GPA value (0–5). */
export function gpaColor(gpa: number): string {
  if (gpa >= 4.0) return GRADE_A.base;
  if (gpa >= 3.0) return GRADE_B.base;
  if (gpa >= 2.0) return GRADE_C.base;
  return GRADE_F.base;
}

// ─── Semantic colors ──────────────────────────────────────────────────────────

/** Red used for destructive actions (logout button, etc.). */
export const DESTRUCTIVE = '#E53935';

/** Red used for overdue/urgency labels. */
export const OVERDUE = '#EF4444';

// ─── Assignment category colors ───────────────────────────────────────────────

export const FORMATIVE  = '#2196F3';
export const SUMMATIVE  = '#FF9800';

// ─── Inc badge ────────────────────────────────────────────────────────────────

export const INC_BG   = '#EF444422';
export const INC_TEXT = '#EF4444';
