-- Reset the sequence for practicals table to avoid duplicate key errors
-- First, delete any invalid rows with id <= 0
DELETE FROM public.practicals WHERE id <= 0;

-- Then reset the sequence
DO $$
DECLARE
    max_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.practicals;
    EXECUTE 'ALTER SEQUENCE public.practicals_id_seq RESTART WITH ' || (max_id + 1);
END $$;
