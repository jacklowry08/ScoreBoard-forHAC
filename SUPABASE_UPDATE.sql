-- Drop the old table
DROP TABLE IF EXISTS class_grades;

-- Create new table with device_fingerprint instead of anonymous_user_id
CREATE TABLE class_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint text NOT NULL,
  school_code text NOT NULL,
  course_code text NOT NULL,
  class_name text NOT NULL,
  grade_percentage integer NOT NULL,
  updated_at timestamp DEFAULT now()
);

-- Create unique index to prevent duplicates per device per course
CREATE UNIQUE INDEX idx_unique_device_course ON class_grades(device_fingerprint, school_code, course_code);

-- Index for fast lookups
CREATE INDEX idx_class_lookup ON class_grades(school_code, course_code);

-- Enable RLS
ALTER TABLE class_grades ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow anonymous read" ON class_grades FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert" ON class_grades FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete own data" ON class_grades FOR DELETE USING (true);
CREATE POLICY "Allow update own data" ON class_grades FOR UPDATE USING (true);
