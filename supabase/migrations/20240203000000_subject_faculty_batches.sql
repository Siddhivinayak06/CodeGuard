-- Migration: Subject Faculty Batches
-- Description: Add batch-wise faculty assignments for subjects

-- Step 1: Drop the dependent RLS policy
DROP POLICY IF EXISTS "Allow faculty to manage practical_levels" ON public.practical_levels;

-- Step 2: Create the new junction table
CREATE TABLE IF NOT EXISTS public.subject_faculty_batches (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch TEXT NOT NULL,
  faculty_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT subject_faculty_batches_unique UNIQUE (subject_id, batch)
);

ALTER TABLE public.subject_faculty_batches OWNER TO postgres;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sfb_subject ON public.subject_faculty_batches(subject_id);
CREATE INDEX IF NOT EXISTS idx_sfb_faculty ON public.subject_faculty_batches(faculty_id);
CREATE INDEX IF NOT EXISTS idx_sfb_batch ON public.subject_faculty_batches(batch);

-- Step 3: Migrate existing faculty assignments (if any exist)
INSERT INTO public.subject_faculty_batches (subject_id, batch, faculty_id)
SELECT id, 'All', faculty_id 
FROM public.subjects 
WHERE faculty_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 4: Drop the old column and its index
DROP INDEX IF EXISTS idx_subjects_faculty;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS faculty_id;

-- Step 5: Recreate the policy using the new junction table
CREATE POLICY "Allow faculty to manage practical_levels" 
ON public.practical_levels 
TO authenticated 
USING (
  EXISTS (
    SELECT 1
    FROM public.practicals p
    JOIN public.subject_faculty_batches sfb ON p.subject_id = sfb.subject_id
    WHERE p.id = practical_levels.practical_id 
    AND sfb.faculty_id = auth.uid()
  )
);

-- Step 6: Enable RLS on the new table
ALTER TABLE public.subject_faculty_batches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for subject_faculty_batches
CREATE POLICY "Admins and faculty can manage subject_faculty_batches"
ON public.subject_faculty_batches
USING (public.is_admin() OR public.is_faculty());

CREATE POLICY "Everyone can read subject_faculty_batches"
ON public.subject_faculty_batches
FOR SELECT
TO authenticated
USING (true);
