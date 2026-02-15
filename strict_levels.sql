-- DATA MIGRATION: Update any existing "easy" to "Task 1" and "hard" to "Task 2"
-- This must run BEFORE adding the strict constraint
UPDATE public.practical_levels SET level = 'Task 1' WHERE level = 'easy';
UPDATE public.practical_levels SET level = 'Task 2' WHERE level = 'hard';

-- Drop the existing constraint
ALTER TABLE public.practical_levels DROP CONSTRAINT IF EXISTS practical_levels_level_check;

-- Add the STRICT constraint allowing ONLY "Task 1" and "Task 2"
ALTER TABLE public.practical_levels 
ADD CONSTRAINT practical_levels_level_check 
CHECK (level IN ('Task 1', 'Task 2'));

-- Verify the change
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.practical_levels'::regclass;
