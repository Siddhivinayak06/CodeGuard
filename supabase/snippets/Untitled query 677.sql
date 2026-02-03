-- 1. Remove faculty_id from subjects table (it becomes redundant)

-- 2. Create new junction table
CREATE TABLE public.subject_faculty_batches (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch TEXT NOT NULL,                                    -- e.g., "A", "B", "2024-Batch1"
  faculty_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT subject_faculty_batches_unique UNIQUE (subject_id, batch)  -- One faculty per subject-batch combo
);

CREATE INDEX idx_subject_faculty_batches_subject ON subject_faculty_batches(subject_id);
CREATE INDEX idx_subject_faculty_batches_faculty ON subject_faculty_batches(faculty_id);
CREATE INDEX idx_subject_faculty_batches_batch ON subject_faculty_batches(batch);