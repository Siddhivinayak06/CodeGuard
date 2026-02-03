import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET: get assigned practicals for the current student */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: userData, error: userErr } =
      await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = userData.user.id;

    // Verify user is a student
    const { data: userRole, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("uid", userId)
      .single();

    if (roleError || userRole?.role !== "student") {
      return NextResponse.json(
        { success: false, error: "Access denied: students only" },
        { status: 403 },
      );
    }

    // Fetch personalized practicals
    const { data, error } = await supabase
      .from("student_practicals")
      .select(
        `
        id,
        assigned_deadline,
        status,
        notes,
        assigned_at,
        completed_at,
        attempt_count,
        max_attempts,
        is_locked,
        lock_reason,
        practicals (
          id,
          title,
          description,
          language,
          max_marks,
          practical_number,
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
      `,
      )
      .eq("student_id", userId)
      .order("assigned_deadline", { ascending: true });

    if (error) throw error;

    // Fetch submissions for marks & status override
    const { data: submissions } = await supabase
      .from("submissions")
      .select("practical_id, status, marks_obtained")
      .eq("student_id", userId);

    const submissionMap = new Map(submissions?.map((s) => [s.practical_id, s]));

    // Map to desired format
    const practicals = data.map((sp: any) => {
      const p = sp.practicals;
      const sub = submissionMap.get(p.id);

      // Determine final status
      // Priority: Passed -> Completed (Manual) -> Submission Status -> Assigned Status
      let finalStatus = sp.status;
      if (sub?.status === "passed") finalStatus = "passed";
      else if (sp.status === "completed") finalStatus = "completed";
      else if (sub?.status) finalStatus = sub.status;

      return {
        id: p.id,
        assignment_id: sp.id,
        practical_number: p.practical_number,
        title: p.title,
        description: p.description,
        language: p.language,
        max_marks: p.max_marks,
        deadline: sp.assigned_deadline,
        status: finalStatus,
        notes: sp.notes,
        assigned_at: sp.assigned_at,
        completed_at: sp.completed_at,
        subject_id: p.subject_id,
        subject_name: p.subjects?.subject_name,
        subject_code: p.subjects?.subject_code,
        subject_semester: p.subjects?.semester,
        // Add levels
        hasLevels: p.practical_levels && p.practical_levels.length > 0,
        levels: p.practical_levels?.sort((a: any, b: any) => {
          const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
          return (order[a.level] || 0) - (order[b.level] || 0);
        }),
        // Add meta
        attempt_count: sp.attempt_count ?? 0,
        max_attempts: sp.max_attempts ?? 1,
        is_locked: sp.is_locked ?? false,
        lock_reason: sp.lock_reason,
        marks_obtained: sub?.marks_obtained ?? undefined,
      };
    });

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching student practicals:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
