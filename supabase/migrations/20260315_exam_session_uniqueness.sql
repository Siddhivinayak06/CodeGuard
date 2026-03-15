-- Enforce one exam session per (exam_id, student_id) and harden set mapping integrity.
-- This migration deduplicates existing buggy rows before adding constraints.

-- 1) Keep a single canonical exam_sessions row per (exam_id, student_id).
WITH ranked_sessions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY exam_id, student_id
      ORDER BY
        submitted_at DESC NULLS LAST,
        started_at DESC NULLS LAST,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.exam_sessions
)
DELETE FROM public.exam_sessions s
USING ranked_sessions r
WHERE s.id = r.id
  AND r.rn > 1;

-- 2) Ensure each student can have only one session per exam.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_sessions_exam_id_student_id_key'
      AND conrelid = 'public.exam_sessions'::regclass
  ) THEN
    ALTER TABLE public.exam_sessions
      ADD CONSTRAINT exam_sessions_exam_id_student_id_key
      UNIQUE (exam_id, student_id);
  END IF;
END
$$;

-- 3) Prevent duplicate level mappings inside a set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exam_set_levels_question_set_id_level_id_key'
      AND conrelid = 'public.exam_set_levels'::regclass
  ) THEN
    ALTER TABLE public.exam_set_levels
      ADD CONSTRAINT exam_set_levels_question_set_id_level_id_key
      UNIQUE (question_set_id, level_id);
  END IF;
END
$$;

-- 4) Helpful index for round-robin and status lookups.
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_assigned_set
  ON public.exam_sessions (exam_id, assigned_set_id)
  WHERE assigned_set_id IS NOT NULL;
