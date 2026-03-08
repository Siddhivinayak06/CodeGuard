-- ============================================================
-- Exam System Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add is_exam flag to practicals
ALTER TABLE practicals ADD COLUMN IF NOT EXISTS is_exam boolean DEFAULT false;

-- 2. Create exams table (exam-specific metadata)
CREATE TABLE IF NOT EXISTS exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  practical_id integer NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  max_violations integer DEFAULT 3,
  allow_copy_paste boolean DEFAULT false,
  require_fullscreen boolean DEFAULT true,
  show_test_results boolean DEFAULT false,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES practicals(id) ON DELETE CASCADE,
  CONSTRAINT exams_practical_id_unique UNIQUE (practical_id)
);

-- 3. Create exam_sessions table (per-student exam timing)
CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  student_id uuid NOT NULL,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT exam_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT exam_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id),
  CONSTRAINT exam_sessions_unique_student UNIQUE (exam_id, student_id)
);

-- 4. RLS Policies
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

-- Exams: all authenticated users can read, faculty can manage
DROP POLICY IF EXISTS "Allow authenticated read exams" ON exams;
CREATE POLICY "Allow authenticated read exams" ON exams
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage exams" ON exams;
CREATE POLICY "Allow authenticated manage exams" ON exams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Exam sessions: all authenticated users can read/manage
DROP POLICY IF EXISTS "Allow authenticated read exam_sessions" ON exam_sessions;
CREATE POLICY "Allow authenticated read exam_sessions" ON exam_sessions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage exam_sessions" ON exam_sessions;
CREATE POLICY "Allow authenticated manage exam_sessions" ON exam_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
