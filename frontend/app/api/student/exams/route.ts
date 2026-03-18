import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET: get assigned exams for the current student via exam_sessions */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = userData.user.id;

    // Verify user is a student
    const { data: userRole, error: roleError } = (await supabase
      .from("users")
      .select("role, batch, semester")
      .eq("uid", userId)
      .single()) as any;

    if (roleError || userRole?.role !== "student") {
      return NextResponse.json(
        { success: false, error: "Access denied: students only" },
        { status: 403 },
      );
    }

    // Fetch exam sessions for this student with all related data
    const { data: sessions, error: sessionsError } = await supabase
      .from("exam_sessions")
      .select(`
        id,
        exam_id,
        student_id,
        started_at,
        expires_at,
        submitted_at,
        is_active,
        assigned_set_id,
        exams (
          id,
          practical_id,
          duration_minutes,
          max_violations,
          allow_copy_paste,
          require_fullscreen,
          show_test_results,
          start_time,
          end_time,
          practicals (
            id,
            title,
            description,
            language,
            max_marks,
            practical_number,
            is_exam,
            subject_id,
            subjects (
              subject_name,
              subject_code,
              semester
            ),
            practical_levels (
              id,
              level,
              title,
              description,
              max_marks
            )
          )
        )
      `)
      .eq("student_id", userId);

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch assigned set details for level filtering
    const assignedSetIds = sessions
      .map((s: any) => s.assigned_set_id)
      .filter(Boolean);

    const setLevelsMap = new Map<string, Set<number>>();
    const setNameMap = new Map<string, string>();

    if (assignedSetIds.length > 0) {
      const { data: setsData } = await supabase
        .from("exam_question_sets")
        .select("id, set_name")
        .in("id", assignedSetIds);

      (setsData || []).forEach((s: any) => {
        setNameMap.set(String(s.id), s.set_name || "");
      });

      const { data: setLevelsData } = await supabase
        .from("exam_set_levels")
        .select("question_set_id, level_id")
        .in("question_set_id", assignedSetIds);

      (setLevelsData || []).forEach((sl: any) => {
        const key = String(sl.question_set_id);
        if (!setLevelsMap.has(key)) setLevelsMap.set(key, new Set());
        setLevelsMap.get(key)!.add(Number(sl.level_id));
      });
    }

    // Fetch submissions for marks & status
    const practicalIds = sessions
      .map((s: any) => (s.exams as any)?.practicals?.id)
      .filter(Boolean);

    const submissionMap = new Map<number, any>();
    if (practicalIds.length > 0) {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("practical_id, status, marks_obtained")
        .eq("student_id", userId)
        .in("practical_id", practicalIds);

      (submissions || []).forEach((sub: any) => {
        submissionMap.set(sub.practical_id, sub);
      });
    }

    // Also get student_practicals data for attempt tracking
    const studentPracticalMap = new Map<number, any>();
    if (practicalIds.length > 0) {
      const { data: spData } = await supabase
        .from("student_practicals")
        .select("practical_id, status, attempt_count, max_attempts, is_locked, lock_reason, assigned_deadline, notes")
        .eq("student_id", userId)
        .in("practical_id", practicalIds);

      (spData || []).forEach((sp: any) => {
        studentPracticalMap.set(sp.practical_id, sp);
      });
    }

    // Map to desired format
    const practicals = sessions
      .filter((session: any) => session.exams?.practicals)
      .map((session: any) => {
        const exam = session.exams as any;
        const p = exam.practicals as any;
        const sub = submissionMap.get(p.id);
        const sp = studentPracticalMap.get(p.id);
        const assignedSetId = session.assigned_set_id ? String(session.assigned_set_id) : null;
        const allowedLevelIds = assignedSetId ? setLevelsMap.get(assignedSetId) : null;
        const assignedSetName = assignedSetId ? setNameMap.get(assignedSetId) : null;

        // Filter levels based on assigned set
        let visibleLevels = allowedLevelIds && allowedLevelIds.size > 0
          ? (p.practical_levels || []).filter((lvl: any) =>
              allowedLevelIds.has(Number(lvl.id)),
            )
          : (p.practical_levels || []);

        // Defensive fallback by set name prefix
        if ((!allowedLevelIds || allowedLevelIds.size === 0) && assignedSetName) {
          const normalizedSet = assignedSetName.toLowerCase().trim();
          const bySetPrefix = (p.practical_levels || []).filter((lvl: any) => {
            const title = String(lvl?.title || "").toLowerCase().trim();
            return title.startsWith(`${normalizedSet} -`) || title.startsWith(`${normalizedSet}:`) || title === normalizedSet;
          });
          if (bySetPrefix.length > 0) {
            visibleLevels = bySetPrefix;
          }
        }

        // Determine final status
        let finalStatus = sp?.status || "assigned";
        if (sub?.status === "passed") finalStatus = "passed";
        else if (sp?.status === "completed") finalStatus = "completed";
        else if (sub?.status) finalStatus = sub.status;

        return {
          id: p.id,
          exam_id: String(exam.id),
          exam_start_time: exam.start_time ?? null,
          exam_end_time: exam.end_time ?? null,
          assignment_id: session.id,
          practical_number: p.practical_number,
          is_exam: true,
          title: p.title,
          description: p.description,
          language: p.language,
          max_marks: p.max_marks,
          status: finalStatus,
          schedule_date: sp?.assigned_deadline || exam.start_time || null,
          schedule_time: null,
          assigned_deadline: sp?.assigned_deadline || exam.end_time || null,
          notes: sp?.notes || null,
          assigned_at: session.created_at,
          completed_at: session.submitted_at,
          subject_id: p.subject_id,
          subject_name: p.subjects?.subject_name,
          subject_code: p.subjects?.subject_code,
          subject_semester: p.subjects?.semester,
          hasLevels: visibleLevels.length > 0,
          levels: visibleLevels.sort((a: any, b: any) => {
            const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
            return (order[a.level] || 0) - (order[b.level] || 0);
          }),
          attempt_count: sp?.attempt_count ?? 0,
          max_attempts: sp?.max_attempts ?? 1,
          is_locked: sp?.is_locked ?? false,
          lock_reason: sp?.lock_reason,
          marks_obtained: sub?.marks_obtained ?? undefined,
          // Exam-specific fields
          duration_minutes: exam.duration_minutes,
          require_fullscreen: exam.require_fullscreen,
          session_id: session.id,
          session_started_at: session.started_at,
          session_expires_at: session.expires_at,
          session_is_active: session.is_active,
        };
      });

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching student exams:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
