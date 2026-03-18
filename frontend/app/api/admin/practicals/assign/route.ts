import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Check if current user is faculty or admin */
async function isFacultyOrAdmin(supabase: any) {
  try {
    const { data: userData, error: userErr } =
      await supabase.auth.getUser();
    if (userErr) {
      console.error("Error getting user:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user) return false;

    // Check users table for role
    const { data: row, error } = await supabase
      .from("users")
      .select("role")
      .eq("uid", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching role from users table:", error);
      return false;
    }
    return row?.role === "faculty" || row?.role === "admin";
  } catch (err) {
    console.error("Unexpected error checking faculty/admin:", err);
    return false;
  }
}

/** POST: assign a practical to specific students */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isFacultyOrAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    console.log("[Assign Debug] Received body:", body);
    const { practical_id, student_ids, assigned_deadline, notes } = body;

    if (
      !practical_id ||
      !student_ids ||
      !Array.isArray(student_ids) ||
      student_ids.length === 0
    ) {
      console.log("[Assign Debug] Missing fields. practical_id:", practical_id, "students:", student_ids);
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields (practical_id, student_ids array).",
        },
        { status: 400 },
      );
    }

    // Check if practical exists
    console.log("[Assign Debug] Checking practical permission for ID:", practical_id);
    const { data: practical, error: practicalError } = await supabase
      .from("practicals")
      .select("id, title, subject_id, language")
      .eq("id", practical_id)
      .single<any>();

    if (practicalError || !practical) {
      console.error("[Assign Debug] Practical query error:", practicalError);
      return NextResponse.json(
        { success: false, error: "Practical not found" },
        { status: 404 },
      );
    }

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // Check if user is faculty for this subject or admin
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { data: userRole } = await supabase
      .from("users")
      .select("role")
      .eq("uid", userId)
      .single();

    // Check if faculty teaches this subject via subject_faculty_batches junction table
    let hasFacultyAccess = false;
    if ((userRole as any)?.role === "admin") {
      hasFacultyAccess = true;
    } else if ((userRole as any)?.role === "faculty") {
      const { data: facultySubject } = await supabase
        .from("subject_faculty_batches")
        .select("id")
        .eq("faculty_id", userId)
        .eq("subject_id", practical.subject_id)
        .limit(1)
        .maybeSingle();

      hasFacultyAccess = !!facultySubject;
    }

    if (!hasFacultyAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only assign practicals for subjects you teach",
        },
        { status: 403 },
      );
    }

    // Validate student_ids exist and are students
    const { data: validStudents, error: studentsError } = await supabase
      .from("users")
      .select("uid")
      .in("uid", student_ids)
      .eq("role", "student");

    if (studentsError) throw studentsError;

    const validStudentIds = (validStudents as any[])?.map((s) => s.uid) || [];
    const invalidIds = student_ids.filter(
      (id) => !validStudentIds.includes(id),
    );

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid student IDs: ${invalidIds.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Check for existing assignments to avoid duplicates
    const { data: existingAssignments } = await supabase
      .from("student_practicals")
      .select("student_id")
      .eq("practical_id", practical_id)
      .in("student_id", student_ids);

    const existingStudentIds =
      (existingAssignments as any[])?.map((a) => a.student_id) || [];
    const newAssignments = student_ids.filter(
      (id) => !existingStudentIds.includes(id),
    );

    if (newAssignments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "All selected students are already assigned to this practical",
        },
        { status: 400 },
      );
    }

    // Create assignments
    const assignments = newAssignments.map((student_id) => ({
      student_id,
      practical_id,
      assigned_deadline: assigned_deadline || null,
      notes: notes || null,
    }));

    const { data, error } = await supabase
      .from("student_practicals")
      .insert(assignments as any)
      .select();

    if (error) throw error;

    // If this practical is an exam, pre-assign one random question set per newly assigned student.
    // This ensures Step 3 assignment locks one set per student before they open the editor.
    try {
      const { data: exam } = await (supabase
        .from("exams") as any)
        .select("id, duration_minutes, end_time")
        .eq("practical_id", practical_id)
        .maybeSingle();

      if (exam?.id && newAssignments.length > 0) {
        const { data: sets } = await (supabase
          .from("exam_question_sets") as any)
          .select("id")
          .eq("exam_id", exam.id);

        const setIds: string[] = (sets || []).map((s: any) => s.id);

        if (setIds.length > 0) {
          // Avoid duplicate exam_sessions for students who already have a session row.
          const { data: existingSessions } = await (supabase
            .from("exam_sessions") as any)
            .select("student_id")
            .eq("exam_id", exam.id)
            .in("student_id", newAssignments);

          const existingSessionStudentIds = new Set(
            (existingSessions || []).map((row: any) => row.student_id),
          );

          const studentsWithoutSession = newAssignments.filter(
            (studentId) => !existingSessionStudentIds.has(studentId),
          );

          if (studentsWithoutSession.length > 0) {
            const fallbackExpiry = exam.end_time
              ? new Date(exam.end_time).toISOString()
              : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

            // Build current load per set so we can distribute students across sets fairly.
            const { data: allExamSessions } = await (supabase
              .from("exam_sessions") as any)
              .select("assigned_set_id")
              .eq("exam_id", exam.id)
              .not("assigned_set_id", "is", null);

            const setLoad = new Map<string, number>();
            setIds.forEach((id) => setLoad.set(id, 0));
            (allExamSessions || []).forEach((row: any) => {
              const sid = String(row.assigned_set_id || "");
              if (sid && setLoad.has(sid)) {
                setLoad.set(sid, (setLoad.get(sid) || 0) + 1);
              }
            });

            // Shuffle students first so allocation order is random for each run.
            const shuffledStudents = [...studentsWithoutSession];
            for (let i = shuffledStudents.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffledStudents[i], shuffledStudents[j]] = [shuffledStudents[j], shuffledStudents[i]];
            }

            let previousPickedSetId: string | null = null;

            const sessionRows = shuffledStudents.map((studentId) => {
              const minLoad = Math.min(...Array.from(setLoad.values()));
              const candidateSetIds = setIds.filter(
                (id) => (setLoad.get(id) || 0) === minLoad,
              );

              // Prefer a different set than the immediately previous student when possible.
              const preferredCandidateSetIds =
                candidateSetIds.length > 1 && previousPickedSetId
                  ? candidateSetIds.filter((id) => id !== previousPickedSetId)
                  : candidateSetIds;

              const pickedSetId =
                preferredCandidateSetIds[Math.floor(Math.random() * preferredCandidateSetIds.length)] ||
                setIds[Math.floor(Math.random() * setIds.length)];

              setLoad.set(pickedSetId, (setLoad.get(pickedSetId) || 0) + 1);
              previousPickedSetId = pickedSetId;

              return {
                exam_id: exam.id,
                student_id: studentId,
                // Session is pre-created but not started; exam/start will set started_at/expires_at.
                started_at: null,
                expires_at: fallbackExpiry,
                is_active: true,
                assigned_set_id: pickedSetId,
              };
            });

            const { error: sessionInsertErr } = await (supabase
              .from("exam_sessions") as any)
              .insert(sessionRows);

            if (sessionInsertErr) {
              console.error("Failed to pre-create exam sessions:", sessionInsertErr);
            }
          }
        }
      }
    } catch (examAssignErr) {
      // Do not fail the practical assignment if exam set pre-assignment fails.
      console.error("Exam set pre-assignment error:", examAssignErr);
    }

    // Create notifications for assigned students
    try {
      const { data: examForNotification } = await (supabase
        .from("exams") as any)
        .select("id")
        .eq("practical_id", practical_id)
        .maybeSingle();

      const isExamPractical = Boolean(examForNotification?.id);

      const notifications = newAssignments.map((student_id) => ({
        user_id: student_id,
        type: isExamPractical ? "exam_assigned" : "practical_assigned",
        title: isExamPractical ? "New Exam Assigned" : "New Practical Assigned",
        message: isExamPractical
          ? `You have been assigned exam: ${practical.title}`
          : `You have been assigned practical: ${practical.title}`,
        link: isExamPractical
          ? "/student/exams"
          : `/editor?practicalId=${practical_id}${practical.subject_id ? `&subject=${practical.subject_id}` : ""}${practical.language ? `&language=${practical.language}` : ""}`,
        metadata: isExamPractical
          ? { practical_id, exam_id: examForNotification.id, subject_id: practical.subject_id }
          : { practical_id, subject_id: practical.subject_id },
      }));

      await supabase.from("notifications").insert(notifications as any);
    } catch (notifyErr) {
      console.error("Error creating notifications:", notifyErr);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Assigned practical to ${newAssignments.length} student(s)${existingStudentIds.length > 0
          ? ` (${existingStudentIds.length} were already assigned)`
          : ""
          }`,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("Error assigning practical:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** GET: get assignments for a practical */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isFacultyOrAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const practicalId = url.searchParams.get("practical_id");

    if (!practicalId) {
      return NextResponse.json(
        { success: false, error: "Missing practical_id parameter" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("student_practicals")
      .select(
        `
        id,
        student_id,
        assigned_deadline,
        status,
        notes,
        assigned_at
      `,
      )
      .eq("practical_id", Number(practicalId))
      .order("assigned_at", { ascending: false });

    if (error) throw error;

    const studentIds = Array.from(
      new Set((data || []).map((assignment: any) => assignment.student_id).filter(Boolean)),
    );

    let studentById = new Map<string, { name: string | null; email: string | null }>();
    if (studentIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("uid, name, email")
        .in("uid", studentIds);

      if (!usersError && usersData) {
        studentById = new Map(
          usersData.map((u: any) => [
            String(u.uid),
            {
              name: u.name ?? null,
              email: u.email ?? null,
            },
          ]),
        );
      }
    }

    const assignments = (data || []).map((assignment: any) => {
      const studentInfo = studentById.get(String(assignment.student_id));
      return {
        id: assignment.id,
        student_id: assignment.student_id,
        student_name: studentInfo?.name ?? null,
        student_email: studentInfo?.email ?? null,
        assigned_deadline: assignment.assigned_deadline,
        status: assignment.status,
        notes: assignment.notes,
        assigned_at: assignment.assigned_at,
      };
    });

    return NextResponse.json({ success: true, data: assignments });
  } catch (err: any) {
    console.error("Error fetching assignments:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** DELETE: remove assignments */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isFacultyOrAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const assignmentIdStr = url.searchParams.get("assignment_id");
    const assignmentIdsStr = url.searchParams.get("assignment_ids");

    let idsToDelete: number[] = [];
    if (assignmentIdStr) idsToDelete.push(Number(assignmentIdStr));
    if (assignmentIdsStr) {
      idsToDelete = idsToDelete.concat(
        assignmentIdsStr.split(",").map(id => Number(id)).filter(id => !isNaN(id))
      );
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing assignment_id or assignment_ids parameter" },
        { status: 400 },
      );
    }

    // Get current user and role for authorization
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRole } = await supabase.from("users").select("role").eq("uid", userId).single();
    
    // Check if faculty has access to the subject(s) of the practicals being unassigned
    if ((userRole as any)?.role === "faculty") {
      const { data: assignmentsToVerify } = await supabase
        .from("student_practicals")
        .select("practical_id, practicals(subject_id)")
        .in("id", idsToDelete);

      if (!assignmentsToVerify || assignmentsToVerify.length === 0) {
        return NextResponse.json({ success: true, deleted: 0 });
      }

      const subjectIds = Array.from(new Set(assignmentsToVerify.map((a: any) => a.practicals?.subject_id).filter(Boolean)));
      
      if (subjectIds.length > 0) {
        const { data: facultySubjects } = await supabase
          .from("subject_faculty_batches")
          .select("subject_id")
          .eq("faculty_id", userId)
          .in("subject_id", subjectIds);

        const allowedSubjectIds = new Set((facultySubjects || []).map((fs: any) => fs.subject_id));
        const hasAccessToAll = subjectIds.every(id => allowedSubjectIds.has(id));

        if (!hasAccessToAll) {
          return NextResponse.json(
            { success: false, error: "You can only remove assignments for subjects you teach" },
            { status: 403 },
          );
        }
      }
    }

    const { data: rawDeletedAssignments, error } = await supabase
      .from("student_practicals")
      .delete()
      .in("id", idsToDelete)
      .select("id, student_id, practical_id");

    if (error) throw error;
    
    const deletedAssignments = (rawDeletedAssignments || []) as any[];

    // If these assignments belong to exam practicals, remove related exam sessions too.
    try {
      if (deletedAssignments.length > 0) {
        // Find distinct practicals affected
        const practicalIds = Array.from(new Set<number>(deletedAssignments.map(a => Number(a.practical_id)).filter(Boolean)));
        
        // Find which practicals are exams
        const { data: exams } = await (supabase.from("exams") as any)
          .select("id, practical_id")
          .in("practical_id", practicalIds);
          
        const examMap = new Map<number, number>((exams || []).map((e: any) => [Number(e.practical_id), Number(e.id)]));
        
        // Group student IDs by exam_id
        const studentsByExam = new Map<number, Set<string>>();
        const allStudentIdsAffected = new Set<string>();

        for (const assignment of deletedAssignments) {
          if (!assignment.student_id || !assignment.practical_id) continue;
          allStudentIdsAffected.add(assignment.student_id);
          
          const examId = examMap.get(assignment.practical_id);
          if (examId) {
            if (!studentsByExam.has(examId)) studentsByExam.set(examId, new Set());
            studentsByExam.get(examId)!.add(assignment.student_id);
          }
        }

        // Bulk delete exam_sessions for each exam
        for (const [examId, studentSet] of studentsByExam.entries()) {
          const studentIds = Array.from(studentSet);
          if (studentIds.length > 0) {
            await (supabase.from("exam_sessions") as any)
              .delete()
              .eq("exam_id", examId)
              .in("student_id", studentIds);
          }
        }

        // Bulk delete assignment notifications
        const studentIdsList = Array.from(allStudentIdsAffected);
        if (studentIdsList.length > 0) {
          const { data: userNotifications } = await (supabase
            .from("notifications") as any)
            .select("id, link, metadata")
            .in("user_id", studentIdsList);

          const practicalIdsSet = new Set<string>(practicalIds.map(String));

          const relatedNotificationIds = (userNotifications || [])
            .filter((n: any) => {
              const metadata = n?.metadata || {};
              const metadataPracticalId = String(metadata?.practical_id ?? metadata?.practicalId ?? "");

              if (metadataPracticalId && practicalIdsSet.has(metadataPracticalId)) {
                return true;
              }

              const link = String(n?.link || "").toLowerCase();
              return Array.from(practicalIdsSet).some(pid => link.includes(`practicalid=${pid}`));
            })
            .map((n: any) => n.id)
            .filter(Boolean);

          if (relatedNotificationIds.length > 0) {
            await (supabase
              .from("notifications") as any)
              .delete()
              .in("id", relatedNotificationIds);
          }
        }
      }
    } catch (cleanupErr) {
      console.error("Error cleaning up exam session after assignment delete:", cleanupErr);
    }

    return NextResponse.json({ success: true, deleted: deletedAssignments?.length ?? 0 });
  } catch (err: any) {
    console.error("Error deleting assignments:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
