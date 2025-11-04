-- Create student_practicals table for many-to-many assignments
CREATE TABLE IF NOT EXISTS public.student_practicals (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  practical_id INTEGER REFERENCES public.practicals(id) ON DELETE CASCADE,
  assigned_deadline TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(student_id, practical_id)
);

-- Enable Row Level Security
ALTER TABLE public.student_practicals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for student_practicals
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_practicals_student_id ON public.student_practicals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_practicals_practical_id ON public.student_practicals(practical_id);
CREATE INDEX IF NOT EXISTS idx_student_practicals_status ON public.student_practicals(status);
CREATE INDEX IF NOT EXISTS idx_student_practicals_deadline ON public.student_practicals(assigned_deadline);

-- Function to update status based on deadline and completion
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
