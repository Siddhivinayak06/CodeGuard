-- Run all these steps in Supabase SQL Editor

-- Step 1: Add level_id column (safe to re-run)
ALTER TABLE reference_codes
ADD COLUMN IF NOT EXISTS level_id BIGINT;

-- Step 2: Fix the FK to have ON DELETE CASCADE
ALTER TABLE reference_codes DROP CONSTRAINT IF EXISTS reference_codes_level_id_fkey;
ALTER TABLE reference_codes ADD CONSTRAINT reference_codes_level_id_fkey
  FOREIGN KEY (level_id) REFERENCES practical_levels(id) ON DELETE CASCADE;

-- Step 3: Drop the old unique constraint
DROP INDEX IF EXISTS reference_codes_practical_primary_idx;

-- Step 4: Create new unique constraint that includes level_id
CREATE UNIQUE INDEX reference_codes_practical_primary_idx
ON reference_codes (practical_id, language, COALESCE(level_id, 0));

-- Step 5: Clean up any orphaned reference_codes
DELETE FROM reference_codes
WHERE level_id IS NOT NULL
AND level_id NOT IN (SELECT id FROM practical_levels);

-- ============================================================
-- Step 6: FIX RLS - Allow authenticated users to read reference_codes
-- This is the KEY fix for starter code not showing in the editor!
-- ============================================================
ALTER TABLE reference_codes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read reference codes (students need this for starter code)
DROP POLICY IF EXISTS "Allow authenticated users to read reference_codes" ON reference_codes;
CREATE POLICY "Allow authenticated users to read reference_codes"
  ON reference_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete reference codes (faculty use)
DROP POLICY IF EXISTS "Allow authenticated users to manage reference_codes" ON reference_codes;
CREATE POLICY "Allow authenticated users to manage reference_codes"
  ON reference_codes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
