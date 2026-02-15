-- Drop the existing constraint referencing auth.users
ALTER TABLE public.schedules
DROP CONSTRAINT IF EXISTS schedules_faculty_id_fkey;

-- Add the new constraint referencing public.users
ALTER TABLE public.schedules
ADD CONSTRAINT schedules_faculty_id_fkey
FOREIGN KEY (faculty_id)
REFERENCES public.users(uid);
