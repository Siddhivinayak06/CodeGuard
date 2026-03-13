-- ============================================================
-- Exam Question Sets Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. exam_question_sets: named sets (e.g. "Set A", "Set B") per exam
CREATE TABLE IF NOT EXISTS exam_question_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  set_name    text NOT NULL,
  set_order   integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(exam_id, set_name)
);

-- 2. exam_set_levels: links a set → specific practical_levels (sub-questions)
CREATE TABLE IF NOT EXISTS exam_set_levels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id uuid NOT NULL REFERENCES exam_question_sets(id) ON DELETE CASCADE,
  level_id        integer NOT NULL REFERENCES practical_levels(id) ON DELETE CASCADE,
  sort_order      integer NOT NULL DEFAULT 0,
  UNIQUE(question_set_id, level_id)
);

-- 3. Add assigned_set_id column to exam_sessions
ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS assigned_set_id uuid REFERENCES exam_question_sets(id);

-- 4. RLS Policies
ALTER TABLE exam_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_set_levels ENABLE ROW LEVEL SECURITY;

-- exam_question_sets: authenticated can read, faculty/admin can manage
DROP POLICY IF EXISTS "Allow authenticated read exam_question_sets" ON exam_question_sets;
CREATE POLICY "Allow authenticated read exam_question_sets" ON exam_question_sets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage exam_question_sets" ON exam_question_sets;
CREATE POLICY "Allow authenticated manage exam_question_sets" ON exam_question_sets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- exam_set_levels: authenticated can read, faculty/admin can manage
DROP POLICY IF EXISTS "Allow authenticated read exam_set_levels" ON exam_set_levels;
CREATE POLICY "Allow authenticated read exam_set_levels" ON exam_set_levels
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage exam_set_levels" ON exam_set_levels;
CREATE POLICY "Allow authenticated manage exam_set_levels" ON exam_set_levels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_question_sets_exam_id ON exam_question_sets(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_set_levels_set_id ON exam_set_levels(question_set_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_assigned_set ON exam_sessions(assigned_set_id);
