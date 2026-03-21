-- The old unique index only covered (device_fingerprint, course_code), which
-- means one device can only have one grade row per course across all periods.
-- Drop it and recreate it including marking_period so each device can have
-- one row per course per marking period (4 rows max per device per course).

DROP INDEX IF EXISTS idx_unique_device_course;

CREATE UNIQUE INDEX idx_unique_device_course
  ON class_grades (device_fingerprint, course_code, marking_period);
