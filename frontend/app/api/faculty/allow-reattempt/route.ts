import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { studentId, practicalId, reason } = await req.json();

    if (!studentId || !practicalId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Verify faculty/admin role
    const { data: callerRow } = await supabase
      .from("users")
      .select("role")
      .eq("uid", user.id)
      .maybeSingle() as any;

    if (!callerRow || !["faculty", "admin"].includes(callerRow.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    // Find the record
    const { data: record, error: findError } = await supabase
      .from("student_practicals")
      .select("id, max_attempts, attempt_count")
      .eq("student_id", studentId)
      .eq("practical_id", practicalId)
      .single();

    if (findError || !record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 },
      );
    }

    // Update
    // We increment max_attempts to allow one more go.
    // And ensure is_locked is false.
    const newMax = ((record as any).max_attempts || 1) + 1;

    const { error: updateError } = await supabase
      .from("student_practicals")
      .update({
        max_attempts: newMax,
        is_locked: false,
        lock_reason: null, // Clear reason
        status: "assigned", // Reset status for fresh attempt
        completed_at: null, // Clear completion timestamp
        // We do NOT reset attempt_count, so history is preserved.
        // Since max > attempt_count, they can start.
      } as never)
      .eq("id", (record as any).id);

    if (updateError) throw updateError;

    // --- NEW: Reset exam sessions & submissions if this is an exam ---
    const { data: practical } = (await supabase
      .from("practicals")
      .select("id, is_exam, title")
      .eq("id", practicalId)
      .single()) as any;

    if (practical?.is_exam) {
      // 1. Delete existing exam session so they get a fresh start
      // Note: We need to find the exam_id using practical_id first
      const { data: examData } = (await supabase
        .from("exams")
        .select("id")
        .eq("practical_id", practicalId)
        .single()) as any;
        
      if (examData?.id) {
        const { count: deletedSessionCount } = await supabase
          .from("exam_sessions")
          .delete({ count: "exact" })
          .eq("exam_id", examData.id)
          .eq("student_id", studentId) as any;

        console.warn(`[Allow Re-attempt] Deleted ${deletedSessionCount ?? '?'} exam_session(s) for student ${studentId}, exam ${examData.id}, practical ${practicalId}. Initiated by faculty ${user.id}`);

        // Re-create a pre-assigned exam session (started_at=null) so the student
        // can start the exam fresh when they open the editor.
        // Round-robin set assignment (pick the set with fewest existing assignments).
        const { data: sets } = await (supabase
          .from("exam_question_sets") as any)
          .select("id, set_order")
          .eq("exam_id", examData.id)
          .order("set_order", { ascending: true });

        let pickedSetId: string | null = null;

        if (sets && sets.length > 0) {
          const { data: allSessions } = await (supabase
            .from("exam_sessions") as any)
            .select("assigned_set_id")
            .eq("exam_id", examData.id)
            .not("assigned_set_id", "is", null);

          const setLoad = new Map<string, number>();
          sets.forEach((s: any) => setLoad.set(s.id, 0));
          (allSessions || []).forEach((sess: any) => {
            const sid = String(sess.assigned_set_id || "");
            if (sid && setLoad.has(sid)) {
              setLoad.set(sid, (setLoad.get(sid) || 0) + 1);
            }
          });

          let minCount = Infinity;
          for (const s of sets) {
            const count = setLoad.get(s.id) || 0;
            if (count < minCount) {
              minCount = count;
              pickedSetId = s.id;
            }
          }
        }

        // Fetch exam end_time for fallback expiry
        const { data: examForExpiry } = await (supabase
          .from("exams") as any)
          .select("end_time")
          .eq("id", examData.id)
          .single();

        const fallbackExpiry = examForExpiry?.end_time
          ? new Date(examForExpiry.end_time).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        const { error: reInsertErr } = await (supabase
          .from("exam_sessions") as any)
          .insert({
            exam_id: examData.id,
            student_id: studentId,
            started_at: null,
            expires_at: fallbackExpiry,
            is_active: true,
            assigned_set_id: pickedSetId,
          });

        if (reInsertErr) {
          console.error("[Allow Re-attempt] Failed to re-create exam session:", reInsertErr);
        } else {
          console.log(`[Allow Re-attempt] Re-created exam session for student ${studentId}, exam ${examData.id}, assigned_set=${pickedSetId}`);
        }
      }

      // Old submissions are preserved for history/grading reference.
    }
    // -----------------------------------------------------------------

    // Log action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      type: "system",
      action: "allow_reattempt",
      details: { studentId, practicalId, newMaxAttempts: newMax, reason },
      created_at: new Date().toISOString(),
    } as any);

    // Notify student about the re-attempt
    try {
      const practicalTitle = (practical as any)?.title || "a practical";

      // Remove older grant notifications for the same practical to avoid duplicates.
      await (supabase
        .from("notifications") as any)
        .delete()
        .eq("user_id", studentId)
        .eq("title", "Re-attempt Granted")
        .ilike("message", `%"${practicalTitle}"%`);

      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "submission_graded",
        title: "Re-attempt Granted",
        message: `Your faculty has granted a re-attempt for "${practicalTitle}". You now have ${newMax} total attempts.`,
        link: `/student/practicals?notificationPracticalId=${practicalId}`,
        is_read: false,
        metadata: {
          practical_id: practicalId,
          practicalId,
          newMaxAttempts: newMax,
        },
      } as any);
    } catch (notifErr) {
      console.error("Failed to send re-attempt notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Re-attempt allowed",
      newMaxAttempts: newMax,
    });
  } catch (err: any) {
    console.error("Error allowing re-attempt:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
