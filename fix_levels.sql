-- Drop the existing constraint on practical_levels if it exists
ALTER TABLE public.practical_levels DROP CONSTRAINT IF EXISTS practical_levels_level_check;

-- Add the updated constraint allowing "Task 1", "Task 2", "easy", "medium", "hard"
-- We keep the old ones for safety during migration
ALTER TABLE public.practical_levels 
ADD CONSTRAINT practical_levels_level_check 
CHECK (level IN ('Task 1', 'Task 2', 'easy', 'medium', 'hard'));

-- Verify the change by checking the constraints
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.practical_levels'::regclass;
