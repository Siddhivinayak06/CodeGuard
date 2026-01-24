-- 0. Extensions (Already in init_db.sql, but ensuring they are available for UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Core Table)
CREATE TABLE public.users (
  uid uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['student'::text, 'faculty'::text, 'admin'::text])),
  profile_pic text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  active_session_id uuid,
  session_updated_at timestamp with time zone,
  roll_no text,
  semester text,
  department text,
  batch text,
  CONSTRAINT users_pkey PRIMARY KEY (uid),
  CONSTRAINT users_uid_fkey FOREIGN KEY (uid) REFERENCES auth.users(id)
);

-- 2. Announcements
CREATE TABLE public.announcements (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_by uuid,
  title text NOT NULL,
  message text NOT NULL,
  target_role text DEFAULT 'all'::text CHECK (target_role = ANY (ARRAY['student'::text, 'faculty'::text, 'all'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(uid)
);

-- 3. Audit Logs
CREATE TABLE public.audit_logs (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['authentication'::text, 'system'::text, 'security'::text])),
  action text NOT NULL,
  details jsonb,
  ip_address text,
  device_info text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(uid)
);

-- 4. Faculty Availability
CREATE TABLE public.faculty_availability (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  faculty_id uuid,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_available boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_availability_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_availability_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES auth.users(id)
);

-- 5. Holidays
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  date date NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT holidays_pkey PRIMARY KEY (id)
);

-- 6. Notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['practical_assigned'::character varying, 'submission_graded'::character varying, 'deadline_reminder'::character varying, 'announcement'::character varying, 'submission_received'::character varying]::text[])),
  title character varying NOT NULL,
  message text,
  link character varying,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 7. Subjects
CREATE TABLE public.subjects (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  subject_name text NOT NULL,
  subject_code text NOT NULL UNIQUE,
  faculty_id uuid,
  semester text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.users(uid)
);

-- 8. Practicals
CREATE TABLE public.practicals (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  subject_id integer,
  title text NOT NULL,
  description text,
  language text,
  deadline timestamp with time zone,
  max_marks integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  submitted boolean DEFAULT false,
  CONSTRAINT practicals_pkey PRIMARY KEY (id),
  CONSTRAINT practicals_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);

-- 9. Practical Levels
CREATE TABLE public.practical_levels (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  practical_id integer NOT NULL,
  level text NOT NULL CHECK (level = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  title text,
  description text,
  max_marks integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT practical_levels_pkey PRIMARY KEY (id),
  CONSTRAINT practical_levels_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id)
);

-- 10. Grades
CREATE TABLE public.grades (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id uuid,
  subject_id integer,
  total_marks integer DEFAULT 0,
  grade text CHECK (grade = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text])),
  generated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grades_pkey PRIMARY KEY (id),
  CONSTRAINT grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(uid),
  CONSTRAINT grades_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);

-- 11. Reference Codes
CREATE TABLE public.reference_codes (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  practical_id integer NOT NULL,
  author uuid,
  language text NOT NULL,
  code text,
  is_primary boolean DEFAULT false,
  version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reference_codes_pkey PRIMARY KEY (id),
  CONSTRAINT reference_codes_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id),
  CONSTRAINT reference_codes_author_fkey FOREIGN KEY (author) REFERENCES public.users(uid)
);

-- 12. Schedules
CREATE TABLE public.schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  practical_id integer,
  faculty_id uuid,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  batch_name text,
  title_placeholder text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id),
  CONSTRAINT schedules_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES auth.users(id)
);

-- 13. Schedule Allocations
CREATE TABLE public.schedule_allocations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_id uuid,
  student_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_allocations_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id),
  CONSTRAINT schedule_allocations_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id)
);

-- 14. Student Practicals
CREATE TABLE public.student_practicals (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id uuid,
  practical_id integer,
  assigned_deadline timestamp with time zone,
  status text DEFAULT 'assigned'::text CHECK (status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text])),
  assigned_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  notes text,
  attempt_count integer DEFAULT 0,
  max_attempts integer DEFAULT 1,
  is_locked boolean DEFAULT false,
  lock_reason text,
  last_locked_at timestamp with time zone,
  CONSTRAINT student_practicals_pkey PRIMARY KEY (id),
  CONSTRAINT student_practicals_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id),
  CONSTRAINT student_practicals_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id)
);

-- 15. Submissions
CREATE TABLE public.submissions (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id uuid,
  practical_id integer,
  code text,
  output text,
  status text DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['passed'::text, 'failed'::text, 'pending'::text])),
  marks_obtained integer DEFAULT 0,
  comments text,
  language text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  test_cases_passed text,
  level_id integer,
  execution_details jsonb,
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(uid),
  CONSTRAINT submissions_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id),
  CONSTRAINT submissions_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.practical_levels(id)
);

-- 16. Test Cases
CREATE TABLE public.test_cases (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  practical_id integer,
  input text NOT NULL,
  expected_output text NOT NULL,
  is_hidden boolean DEFAULT false,
  time_limit_ms integer DEFAULT 2000,
  memory_limit_kb integer DEFAULT 65536,
  created_at timestamp with time zone DEFAULT now(),
  level_id integer,
  CONSTRAINT test_cases_pkey PRIMARY KEY (id),
  CONSTRAINT test_cases_practical_id_fkey FOREIGN KEY (practical_id) REFERENCES public.practicals(id),
  CONSTRAINT test_cases_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.practical_levels(id)
);

-- 17. Test Case Results
CREATE TABLE public.test_case_results (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  submission_id integer,
  test_case_id integer,
  status text NOT NULL CHECK (status = ANY (ARRAY['passed'::text, 'failed'::text, 'timeout'::text, 'runtime_error'::text, 'compile_error'::text])),
  execution_time_ms integer,
  memory_used_kb integer,
  stdout text,
  stderr text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT test_case_results_pkey PRIMARY KEY (id),
  CONSTRAINT test_case_results_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT test_case_results_test_case_id_fkey FOREIGN KEY (test_case_id) REFERENCES public.test_cases(id)
);


-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_practicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_results ENABLE ROW LEVEL SECURITY;

-- Helper function to check role
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE uid = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_faculty() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE uid = auth.uid() AND role = 'faculty'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Users Policies
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "Everyone can view basic user info" ON public.users FOR SELECT USING (true); -- Public profile visibility
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = uid);
CREATE POLICY "Admins can view and edit all users" ON public.users FOR ALL USING (public.is_admin());

-- 2. Announcements Policies
CREATE POLICY "Everyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Faculty and Admins can create announcements" ON public.announcements FOR INSERT WITH CHECK (public.is_faculty() OR public.is_admin());
CREATE POLICY "Creators and Admins can update announcements" ON public.announcements FOR UPDATE USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Creators and Admins can delete announcements" ON public.announcements FOR DELETE USING (auth.uid() = created_by OR public.is_admin());

-- 3. Audit Logs (Read-only for users, Full access for admins)
CREATE POLICY "Users can view their own logs" ON public.audit_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all logs" ON public.audit_logs FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policies for clients; logs should be created by system functions or triggers (security definer)

-- 4. Faculty Availability
CREATE POLICY "Everyone can view availability" ON public.faculty_availability FOR SELECT USING (true);
CREATE POLICY "Faculty can manage their own availability" ON public.faculty_availability FOR ALL USING (faculty_id = auth.uid());

-- 5. Holidays
CREATE POLICY "Everyone can view holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL USING (public.is_admin());

-- 6. Notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update (mark read) their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true); -- Often triggered by system, but if client-trigger needed, restriction applies.

-- 7. Subjects
CREATE POLICY "Everyone can view subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Faculty can manage their subjects" ON public.subjects FOR ALL USING (faculty_id = auth.uid() OR public.is_admin());

-- 8. Practicals & Levels
CREATE POLICY "Everyone can view practicals" ON public.practicals FOR SELECT USING (true);
CREATE POLICY "Faculty can manage practicals" ON public.practicals FOR ALL USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Everyone can view levels" ON public.practical_levels FOR SELECT USING (true);
CREATE POLICY "Faculty can manage levels" ON public.practical_levels FOR ALL USING (public.is_faculty() OR public.is_admin());

-- 9. Grades
CREATE POLICY "Students can view their own grades" ON public.grades FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Faculty can view and manage grades" ON public.grades FOR ALL USING (public.is_faculty() OR public.is_admin());

-- 10. Reference Codes (Protected intellectual property)
CREATE POLICY "Authors and Admins can view reference codes" ON public.reference_codes FOR SELECT USING (author = auth.uid() OR public.is_admin() OR public.is_faculty());
-- Students usually shouldn't see reference code unless explicitly allowed.
CREATE POLICY "Faculty can manage reference codes" ON public.reference_codes FOR ALL USING (public.is_faculty() OR public.is_admin());

-- 11. Schedules & Allocations
CREATE POLICY "Everyone can view schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Faculty can manage schedules" ON public.schedules FOR ALL USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Everyone can view allocations" ON public.schedule_allocations FOR SELECT USING (true);
CREATE POLICY "Faculty can manage allocations" ON public.schedule_allocations FOR ALL USING (public.is_faculty() OR public.is_admin());

-- 12. Student Practicals (Assignments)
CREATE POLICY "Students can view their assignments" ON public.student_practicals FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Faculty can view all assignments" ON public.student_practicals FOR SELECT USING (public.is_faculty() OR public.is_admin());
CREATE POLICY "System/Faculty can assign" ON public.student_practicals FOR INSERT WITH CHECK (public.is_faculty() OR public.is_admin());
CREATE POLICY "Students can update status (in progress)" ON public.student_practicals FOR UPDATE USING (student_id = auth.uid());

-- 13. Submissions
CREATE POLICY "Students can view their own submissions" ON public.submissions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Faculty can view all submissions" ON public.submissions FOR SELECT USING (public.is_faculty() OR public.is_admin());
CREATE POLICY "Students can create submissions" ON public.submissions FOR INSERT WITH CHECK (student_id = auth.uid());
-- Only system (autograder) or Faculty should update marks/status usually
CREATE POLICY "Faculty/System can update submissions" ON public.submissions FOR UPDATE USING (public.is_faculty() OR public.is_admin());

-- 14. Test Cases & Results
CREATE POLICY "Everyone can see NOT HIDDEN test cases" ON public.test_cases FOR SELECT USING (is_hidden = false OR public.is_faculty() OR public.is_admin());
CREATE POLICY "Faculty can manage test cases" ON public.test_cases FOR ALL USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Students can view their own results" ON public.test_case_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
);
CREATE POLICY "Faculty can view all results" ON public.test_case_results FOR SELECT USING (public.is_faculty() OR public.is_admin());
CREATE POLICY "System can create results" ON public.test_case_results FOR INSERT WITH CHECK (true);

-- ============================================================
-- RLS POLICIES FOR CODEGUARD
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- First, drop existing policies to avoid conflicts
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE uid = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_faculty() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE uid = auth.uid() AND role = 'faculty'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.faculty_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.practicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.practical_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reference_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedule_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_practicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_case_results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. USERS TABLE POLICIES
-- ============================================================

CREATE POLICY "Users can view their own profile" 
  ON public.users FOR SELECT 
  USING (auth.uid() = uid);

CREATE POLICY "Everyone can view basic user info" 
  ON public.users FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.users FOR UPDATE 
  USING (auth.uid() = uid);

CREATE POLICY "Admins can view and edit all users" 
  ON public.users FOR ALL 
  USING (public.is_admin());

-- Additional Users Policies
CREATE POLICY "Admins can insert users" 
  ON public.users FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can select all users" 
  ON public.users FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "Users can delete their own profile" 
  ON public.users FOR DELETE 
  USING (auth.uid() = uid);

CREATE POLICY "Users can insert their own row" 
  ON public.users FOR INSERT 
  WITH CHECK (auth.uid() = uid);

CREATE POLICY "Users can select their own row" 
  ON public.users FOR SELECT 
  USING (auth.uid() = uid);

CREATE POLICY "Users can update their own row" 
  ON public.users FOR UPDATE 
  USING (auth.uid() = uid);

CREATE POLICY "Users can update their own session" 
  ON public.users FOR UPDATE 
  USING (auth.uid() = uid)
  WITH CHECK (auth.uid() = uid);

-- ============================================================
-- 2. ANNOUNCEMENTS POLICIES
-- ============================================================

CREATE POLICY "Everyone can view announcements" 
  ON public.announcements FOR SELECT 
  USING (true);

CREATE POLICY "Faculty and Admins can create announcements" 
  ON public.announcements FOR INSERT 
  WITH CHECK (public.is_faculty() OR public.is_admin());

CREATE POLICY "Creators and Admins can update announcements" 
  ON public.announcements FOR UPDATE 
  USING (auth.uid() = created_by OR public.is_admin());

CREATE POLICY "Creators and Admins can delete announcements" 
  ON public.announcements FOR DELETE 
  USING (auth.uid() = created_by OR public.is_admin());

-- ============================================================
-- 3. AUDIT LOGS POLICIES
-- ============================================================

CREATE POLICY "Users can view their own logs" 
  ON public.audit_logs FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all logs" 
  ON public.audit_logs FOR SELECT 
  USING (public.is_admin());

-- ============================================================
-- 4. FACULTY AVAILABILITY POLICIES
-- ============================================================

CREATE POLICY "Everyone can view availability" 
  ON public.faculty_availability FOR SELECT 
  USING (true);

CREATE POLICY "Faculty can manage their own availability" 
  ON public.faculty_availability FOR ALL 
  USING (faculty_id = auth.uid());

-- ============================================================
-- 5. HOLIDAYS POLICIES
-- ============================================================

CREATE POLICY "Everyone can view holidays" 
  ON public.holidays FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage holidays" 
  ON public.holidays FOR ALL 
  USING (public.is_admin());

-- ============================================================
-- 6. NOTIFICATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update (mark read) their own notifications" 
  ON public.notifications FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (true);

-- ============================================================
-- 7. SUBJECTS POLICIES
-- ============================================================

CREATE POLICY "Everyone can view subjects" 
  ON public.subjects FOR SELECT 
  USING (true);

CREATE POLICY "Faculty can manage their subjects" 
  ON public.subjects FOR ALL 
  USING (faculty_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 8. PRACTICALS & LEVELS POLICIES
-- ============================================================

CREATE POLICY "Everyone can view practicals" 
  ON public.practicals FOR SELECT 
  USING (true);

CREATE POLICY "Faculty can manage practicals" 
  ON public.practicals FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Everyone can view levels" 
  ON public.practical_levels FOR SELECT 
  USING (true);

CREATE POLICY "Faculty can manage levels" 
  ON public.practical_levels FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

-- ============================================================
-- 9. GRADES POLICIES
-- ============================================================

CREATE POLICY "Students can view their own grades" 
  ON public.grades FOR SELECT 
  USING (student_id = auth.uid());

CREATE POLICY "Faculty can view and manage grades" 
  ON public.grades FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

-- ============================================================
-- 10. REFERENCE CODES POLICIES
-- ============================================================

CREATE POLICY "Authors and Admins can view reference codes" 
  ON public.reference_codes FOR SELECT 
  USING (author = auth.uid() OR public.is_admin() OR public.is_faculty());

CREATE POLICY "Faculty can manage reference codes" 
  ON public.reference_codes FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

-- ============================================================
-- 11. SCHEDULES & ALLOCATIONS POLICIES
-- ============================================================

CREATE POLICY "Everyone can view schedules" 
  ON public.schedules FOR SELECT 
  USING (true);

CREATE POLICY "Faculty can manage schedules" 
  ON public.schedules FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Everyone can view allocations" 
  ON public.schedule_allocations FOR SELECT 
  USING (true);

CREATE POLICY "Faculty can manage allocations" 
  ON public.schedule_allocations FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

-- ============================================================
-- 12. STUDENT PRACTICALS POLICIES
-- ============================================================

CREATE POLICY "Students can view their assignments" 
  ON public.student_practicals FOR SELECT 
  USING (student_id = auth.uid());

CREATE POLICY "Faculty can view all assignments" 
  ON public.student_practicals FOR SELECT 
  USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "System/Faculty can assign" 
  ON public.student_practicals FOR INSERT 
  WITH CHECK (public.is_faculty() OR public.is_admin());

CREATE POLICY "Students can update status (in progress)" 
  ON public.student_practicals FOR UPDATE 
  USING (student_id = auth.uid());

-- ============================================================
-- 13. SUBMISSIONS POLICIES
-- ============================================================

CREATE POLICY "Students can view their own submissions" 
  ON public.submissions FOR SELECT 
  USING (student_id = auth.uid());

CREATE POLICY "Faculty can view all submissions" 
  ON public.submissions FOR SELECT 
  USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Students can create submissions" 
  ON public.submissions FOR INSERT 
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Faculty/System can update submissions" 
  ON public.submissions FOR UPDATE 
  USING (public.is_faculty() OR public.is_admin());

-- ============================================================
-- 14. TEST CASES & RESULTS POLICIES
-- ============================================================

CREATE POLICY "Everyone can see NOT HIDDEN test cases" 
  ON public.test_cases FOR SELECT 
  USING (is_hidden = false OR public.is_faculty() OR public.is_admin());

CREATE POLICY "Faculty can manage test cases" 
  ON public.test_cases FOR ALL 
  USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "Students can view their own results" 
  ON public.test_case_results FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s 
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can view all results" 
  ON public.test_case_results FOR SELECT 
  USING (public.is_faculty() OR public.is_admin());

CREATE POLICY "System can create results" 
  ON public.test_case_results FOR INSERT 
  WITH CHECK (true);
