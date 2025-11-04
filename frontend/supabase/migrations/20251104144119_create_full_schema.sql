-- Full CodeGuard Database Schema
-- Run these queries in Supabase SQL Editor to set up the complete database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
  profile_pic text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (uid)
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id SERIAL PRIMARY KEY,
  subject_name text NOT NULL,
  subject_code text NOT NULL UNIQUE,
  faculty_id uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  semester text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create practicals table
CREATE TABLE IF NOT EXISTS public.practicals (
  id SERIAL PRIMARY KEY,
  subject_id integer REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  language text,
  deadline timestamp with time zone,
  max_marks integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  submitted boolean DEFAULT false
);

-- Create test_cases table
CREATE TABLE IF NOT EXISTS public.test_cases (
  id SERIAL PRIMARY KEY,
  practical_id integer REFERENCES public.practicals(id) ON DELETE CASCADE,
  input text NOT NULL,
  expected_output text NOT NULL,
  is_hidden boolean DEFAULT false,
  time_limit_ms integer DEFAULT 2000,
  memory_limit_kb integer DEFAULT 65536,
  created_at timestamp with time zone DEFAULT now()
);

-- Create student_practicals table for personalized assignments
CREATE TABLE IF NOT EXISTS public.student_practicals (
  id SERIAL PRIMARY KEY,
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  practical_id integer REFERENCES public.practicals(id) ON DELETE CASCADE,
  assigned_deadline timestamp with time zone,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
  assigned_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  notes text,
  UNIQUE(student_id, practical_id)
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id SERIAL PRIMARY KEY,
  student_id uuid REFERENCES public.users(uid) ON DELETE CASCADE,
  practical_id integer REFERENCES public.practicals(id) ON DELETE CASCADE,
  code text,
  output text,
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'evaluated', 'pending')),
  marks_obtained integer DEFAULT 0,
  comments text,
  language text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create execution_results table
CREATE TABLE IF NOT EXISTS public.execution_results (
  id SERIAL PRIMARY KEY,
  submission_id integer REFERENCES public.submissions(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('accepted', 'partial', 'wrong_answer', 'compile_error', 'runtime_error', 'time_limit_exceeded', 'error', 'pending')),
  details jsonb,
  judged_at timestamp with time zone DEFAULT now()
);

-- Create test_case_results table
CREATE TABLE IF NOT EXISTS public.test_case_results (
  id SERIAL PRIMARY KEY,
  submission_id integer REFERENCES public.submissions(id) ON DELETE CASCADE,
  test_case_id integer REFERENCES public.test_cases(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'timeout', 'runtime_error', 'compile_error')),
  execution_time_ms integer,
  memory_used_kb integer,
  stdout text,
  stderr text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create grades table
CREATE TABLE IF NOT EXISTS public.grades (
  id SERIAL PRIMARY KEY,
  student_id uuid REFERENCES public.users(uid) ON DELETE CASCADE,
  subject_id integer REFERENCES public.subjects(id) ON DELETE CASCADE,
  total_marks integer DEFAULT 0,
  grade text CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F')),
  generated_at timestamp with time zone DEFAULT now()
);

-- Create schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
  id SERIAL PRIMARY KEY,
  user_id uuid REFERENCES public.users(uid) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('class', 'meeting', 'submission_deadline', 'exam')),
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id SERIAL PRIMARY KEY,
  created_by uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_role text DEFAULT 'all' CHECK (target_role IN ('student', 'faculty', 'all')),
  created_at timestamp with time zone DEFAULT now()
);

-- Create authentication_logs table
CREATE TABLE IF NOT EXISTS public.authentication_logs (
  id SERIAL PRIMARY KEY,
  user_id uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  ip_address text,
  device_info text,
  timestamp timestamp with time zone DEFAULT now()
);

-- Create system_logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
  id SERIAL PRIMARY KEY,
  user_id uuid REFERENCES public.users(uid) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_practicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authentication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = uid);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = uid);

CREATE POLICY "Faculty and admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role IN ('faculty', 'admin')
    )
  );

CREATE POLICY "Admins can manage all users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for subjects table
CREATE POLICY "Faculty can view and manage their subjects"
  ON public.subjects FOR ALL
  USING (
    faculty_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Students can view subjects"
  ON public.subjects FOR SELECT
  USING (true);

-- Create RLS policies for practicals table
CREATE POLICY "Faculty can manage practicals for their subjects"
  ON public.practicals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE id = practicals.subject_id AND faculty_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Students can view practicals"
  ON public.practicals FOR SELECT
  USING (true);

-- Create RLS policies for test_cases table
CREATE POLICY "Faculty can manage test cases for their practicals"
  ON public.test_cases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.practicals p
      JOIN public.subjects s ON p.subject_id = s.id
      WHERE p.id = test_cases.practical_id AND s.faculty_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for student_practicals table
CREATE POLICY "Students can view their own assignments"
  ON public.student_practicals FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Faculty can view and manage assignments"
  ON public.student_practicals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role IN ('faculty', 'admin')
    )
  );

-- Create RLS policies for submissions table
CREATE POLICY "Students can manage their own submissions"
  ON public.submissions FOR ALL
  USING (auth.uid() = student_id);

CREATE POLICY "Faculty can view submissions for their practicals"
  ON public.submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practicals p
      JOIN public.subjects s ON p.subject_id = s.id
      WHERE p.id = submissions.practical_id AND s.faculty_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for execution_results table
CREATE POLICY "Students can view their submission results"
  ON public.execution_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE id = execution_results.submission_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can view execution results for their practicals"
  ON public.execution_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.practicals p ON s.practical_id = p.id
      JOIN public.subjects subj ON p.subject_id = subj.id
      WHERE s.id = execution_results.submission_id AND subj.faculty_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for test_case_results table
CREATE POLICY "Students can view their test case results"
  ON public.test_case_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE id = test_case_results.submission_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can view test case results for their practicals"
  ON public.test_case_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.practicals p ON s.practical_id = p.id
      JOIN public.subjects subj ON p.subject_id = subj.id
      WHERE s.id = test_case_results.submission_id AND subj.faculty_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for grades table
CREATE POLICY "Students can view their own grades"
  ON public.grades FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Faculty can manage grades for their subjects"
  ON public.grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE id = grades.subject_id AND faculty_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for schedules table
CREATE POLICY "Users can manage their own schedules"
  ON public.schedules FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Faculty and admins can view all schedules"
  ON public.schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role IN ('faculty', 'admin')
    )
  );

-- Create RLS policies for announcements table
CREATE POLICY "Users can view announcements for their role"
  ON public.announcements FOR SELECT
  USING (
    target_role = 'all' OR
    (target_role = 'student' AND EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND role = 'student')) OR
    (target_role = 'faculty' AND EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND role IN ('faculty', 'admin')))
  );

CREATE POLICY "Faculty and admins can manage announcements"
  ON public.announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role IN ('faculty', 'admin')
    )
  );

-- Create RLS policies for authentication_logs table
CREATE POLICY "Admins can view authentication logs"
  ON public.authentication_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for system_logs table
CREATE POLICY "Admins can view system logs"
  ON public.system_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_subjects_faculty_id ON public.subjects(faculty_id);
CREATE INDEX IF NOT EXISTS idx_subjects_subject_code ON public.subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_practicals_subject_id ON public.practicals(subject_id);
CREATE INDEX IF NOT EXISTS idx_practicals_deadline ON public.practicals(deadline);
CREATE INDEX IF NOT EXISTS idx_test_cases_practical_id ON public.test_cases(practical_id);
CREATE INDEX IF NOT EXISTS idx_student_practicals_student_id ON public.student_practicals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_practicals_practical_id ON public.student_practicals(practical_id);
CREATE INDEX IF NOT EXISTS idx_student_practicals_status ON public.student_practicals(status);
CREATE INDEX IF NOT EXISTS idx_student_practicals_deadline ON public.student_practicals(assigned_deadline);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_practical_id ON public.submissions(practical_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_submission_id ON public.execution_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_test_case_results_submission_id ON public.test_case_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_test_case_results_test_case_id ON public.test_case_results(test_case_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON public.grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON public.grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON public.schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_announcements_target_role ON public.announcements(target_role);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_authentication_logs_user_id ON public.authentication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_authentication_logs_timestamp ON public.authentication_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);

-- Function to update practical status based on deadline and completion
CREATE OR REPLACE FUNCTION update_practical_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If completed_at is set, mark as completed
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.status = 'completed';
  -- If deadline has passed and not completed, mark as overdue
  ELSIF NEW.assigned_deadline < NOW() AND NEW.completed_at IS NULL AND NEW.status != 'completed' THEN
    NEW.status = 'overdue';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update status
DROP TRIGGER IF EXISTS trigger_update_practical_status ON public.student_practicals;
CREATE TRIGGER trigger_update_practical_status
  BEFORE UPDATE ON public.student_practicals
  FOR EACH ROW EXECUTE FUNCTION update_practical_status();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_practicals_updated_at
  BEFORE UPDATE ON public.practicals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
