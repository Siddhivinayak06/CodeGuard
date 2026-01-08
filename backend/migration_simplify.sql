-- Migration: Simplify Database Schema

BEGIN;

-- 1. Consolidate Student Details into Users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS roll_no text,
ADD COLUMN IF NOT EXISTS semester text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS batch text;

-- Migrate data from student_details to users
UPDATE public.users u
SET 
    roll_no = sd.roll_no,
    semester = sd.semester,
    department = sd.department,
    batch = sd.batch
FROM public.student_details sd
WHERE u.uid = sd.student_id;

-- Drop student_details table
DROP TABLE IF EXISTS public.student_details CASCADE;


-- 2. Consolidate Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES public.users(uid),
  type text NOT NULL CHECK (type IN ('authentication', 'system', 'security')),
  action text NOT NULL,
  details jsonb,
  ip_address text,
  device_info text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Migrate data from authentication_logs
INSERT INTO public.audit_logs (user_id, type, action, details, ip_address, device_info, created_at)
SELECT 
    user_id, 
    'authentication', 
    status, 
    jsonb_build_object('status', status), 
    ip_address, 
    device_info, 
    timestamp
FROM public.authentication_logs;

-- Migrate data from system_logs
INSERT INTO public.audit_logs (user_id, type, action, details, created_at)
SELECT 
    user_id, 
    'system', 
    action, 
    details, 
    created_at
FROM public.system_logs;

-- Drop old log tables
DROP TABLE IF EXISTS public.authentication_logs CASCADE;
DROP TABLE IF EXISTS public.system_logs CASCADE;


-- 3. Simplify Execution Results
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS execution_details jsonb;

-- Migrate data from execution_results
UPDATE public.submissions s
SET execution_details = jsonb_build_object(
    'verdict', er.verdict,
    'details', er.details,
    'judged_at', er.judged_at
)
FROM public.execution_results er
WHERE s.id = er.submission_id;

-- Drop execution_results table
DROP TABLE IF EXISTS public.execution_results CASCADE;


COMMIT;
