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

    // Verify user is a student and get batch
    const { data: userRole, error: roleError } = (await supabase
      .from("users")
      .select("role, batch")
      .eq("uid", userId)
      .single()) as any;

    if (roleError || userRole?.role !== "student") {
      return NextResponse.json(
        { success: false, error: "Access denied: students only" },
        { status: 403 },
      );
    }

    const userBatch = userRole.batch;

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
    const { data: submissions } = (await supabase
      .from("submissions")
      .select("practical_id, status, marks_obtained")
      .eq("student_id", userId)) as any as { data: any[] | null };

    const submissionMap = new Map(submissions?.map((s) => [s.practical_id, s]));

    // Fetch Schedules for these practicals (matching batch or logic)
    // We want schedules where:
    // 1. practical_id is in our list
    // 2. batch matches userBatch OR it's a direct allocation (which we might not check here efficiently for all, so we'll fetch all schedules for these practicals and filter in code for now or refine query)
    // A simpler approach: Fetch all schedules for these practical IDs, then find the one that matches this student (via batch or allocation).
    // Note: 'schedule_allocations' links schedule -> student. 'schedules' has 'batch_name'.

    const practicalIds = data
      .map((d: any) => d.practicals?.id)
      .filter(Boolean);

    const scheduleMap = new Map();
    if (practicalIds.length > 0) {
      // Fetch schedules matching user batch
      const { data: batchSchedules } = (await supabase
        .from("schedules")
        .select("practical_id, date, start_time, end_time, batch_name")
        .in("practical_id", practicalIds)
        .eq("batch_name", userBatch || "")) as any as { data: any[] | null }; // Match user batch

      // Fetch allocated schedules (if any specific overrides/allocations existed - assuming distinct from batch for now, or just use batch if that's the primary method)
      // For now, let's prioritize batch schedules as per requirements.
      if (batchSchedules) {
        batchSchedules.forEach((s) => {
          // If multiple schedules exist for a practical (unlikely for same batch), take the latest or first? taking first.
          if (!scheduleMap.has(s.practical_id)) {
            scheduleMap.set(s.practical_id, s);
          }
        });
      }
    }

    // Map to desired format
    const practicals = data.map((sp: any) => {
      const p = sp.practicals;
      const sub = submissionMap.get(p.id);
      const schedule = scheduleMap.get(p.id);

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
        status: finalStatus,
        schedule_date: schedule?.date || null,
        schedule_time: schedule
          ? `${schedule.start_time} - ${schedule.end_time}`
          : null,
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
