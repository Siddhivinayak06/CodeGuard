-- Fix 1: faculty_submissions_view - add security_invoker to use querying user's RLS
-- instead of the view owner's permissions (SECURITY DEFINER)
CREATE OR REPLACE VIEW public.faculty_submissions_view
WITH (security_invoker = true)
AS
SELECT s.id AS submission_id,
    s.student_id,
    u.name AS student_name,
    s.practical_id,
    p.title AS practical_title,
    s.code,
    s.output,
    s.status,
    s.marks_obtained,
    s.language,
    s.created_at
FROM public.submissions s
JOIN public.users u ON s.student_id = u.uid
JOIN public.practicals p ON s.practical_id = p.id
ORDER BY s.created_at DESC;

-- Fix 2: Remove insecure user_metadata reference from RLS policy
-- user_metadata is editable by end users, so use the users table lookup instead
DROP POLICY IF EXISTS "Admins can bulk delete batches" ON public.subject_faculty_batches;
CREATE POLICY "Admins can bulk delete batches" ON public.subject_faculty_batches
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.uid = auth.uid()
    AND users.role = 'admin'
  )
);
