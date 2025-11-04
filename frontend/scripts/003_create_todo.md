# TODO: Implement Personalized Practical Scheduling

## Completed Tasks
- [x] Create StudentAssignmentForm component for assigning practicals to students
- [x] Update faculty schedule page to include assignment functionality
- [x] Add "Assign" button to PracticalList component
- [x] Modify student practicals page to fetch from student_practicals table
- [x] Add status column to student practicals table view

## Pending Tasks
- [ ] Test the assignment flow by creating a practical and assigning it to a student
- [ ] Verify that students only see their assigned practicals with personalized deadlines
- [ ] Check RLS policies for security (students can only see their own assignments)
- [ ] Test status updates (completed, overdue) via the database trigger
- [ ] Add bulk assignment feature if needed
- [ ] Consider adding deadline reminders or notifications

## Notes
- The student_practicals table has a trigger to automatically update status based on deadlines
- RLS policies are in place for student_practicals table
- Ensure the subjects table has the correct column name (subject_name vs name)
