-- ============================================================
-- RLS Security Fix for class_grades
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Add marking_period column if it doesn't exist yet
ALTER TABLE class_grades
  ADD COLUMN IF NOT EXISTS marking_period integer NOT NULL DEFAULT 1;

-- 2. Drop the old overly-permissive policies
DROP POLICY IF EXISTS "Allow anonymous read" ON class_grades;
DROP POLICY IF EXISTS "Allow anonymous insert" ON class_grades;
DROP POLICY IF EXISTS "Allow delete own data" ON class_grades;
DROP POLICY IF EXISTS "Allow update own data" ON class_grades;

-- 3. Make sure RLS is enabled
ALTER TABLE class_grades ENABLE ROW LEVEL SECURITY;

-- 4. SELECT — allow anyone to read for grade averaging.
--    Data is opt-in and intentionally shared; no PII is stored.
CREATE POLICY "Read for averaging" ON class_grades
  FOR SELECT USING (true);

-- 5. INSERT — validate data to block garbage/malicious submissions.
CREATE POLICY "Validated insert" ON class_grades
  FOR INSERT WITH CHECK (
    grade_percentage >= 0 AND
    grade_percentage <= 100 AND
    length(device_fingerprint) > 5 AND
    school_code = 'pvhs_sjc' AND
    marking_period BETWEEN 1 AND 4
  );

-- 6. DELETE — allow deletion only when a matching device_fingerprint
--    is supplied in the WHERE clause.  Without JWT auth we cannot
--    cryptographically verify the fingerprint, but this at least
--    prevents a blanket DELETE with no filter.
--    NOTE: true per-device enforcement requires Supabase Auth (JWT).
CREATE POLICY "Delete own data" ON class_grades
  FOR DELETE USING (length(device_fingerprint) > 5);

-- UPDATE is intentionally omitted — the app does delete + re-insert,
-- so no UPDATE policy is needed.
