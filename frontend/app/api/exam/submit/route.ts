import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { examId, practicalId } = await req.json();

    if (!examId || !practicalId) {
      return NextResponse.json(
        { error: "Missing examId or practicalId" },
        { status: 400 }
      );
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify and update exam_sessions
    const { data: session, error: sessionErr } = (await supabase
      .from("exam_sessions")
      .select("id, is_active, submitted_at, expires_at, exam:exams(end_time)")
      .eq("exam_id", examId)
      .eq("student_id", user.id)
      .single()) as any;

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
    }

    if (session.submitted_at) {
      // Already submitted - return success gracefully to avoid client-side errors
      return NextResponse.json({ success: true, message: "Exam already submitted" });
    }

    // Check exam deadline
    const now = new Date();
    if (session.exam?.end_time) {
      const endTime = new Date(session.exam.end_time);
      // Allow 5-minute grace period for network/latency/processing
      if (now.getTime() > endTime.getTime() + 300000) {
        return NextResponse.json({ error: "Exam submission window has closed" }, { status: 403 });
      }
    }

    // Update session to inactive and mark submit time
    await supabase
      .from("exam_sessions")
      .update({
        is_active: false,
        submitted_at: now.toISOString()
      } as never)
      .eq("id", session.id);

    // 2. Update student_practicals to mark attempt as completed
    const { data: spRecord, error: spErr } = (await supabase
      .from("student_practicals")
      .select("id, status, attempt_count, max_attempts")
      .eq("student_id", user.id)
      .eq("practical_id", practicalId)
      .single()) as any;

    if (!spErr && spRecord) {
      // If attempt wasn't already incremented at start, or if we want to ensure it represents the submission
      // Note: for an exam, we usually expect attempt_count to be 1 after submission.
      // Ensure attempt_count is at least 1, but increment if it's already been set
      // This provides resilience if start failed or for single-attempt exams.
      const currentAttempts = spRecord.attempt_count || 0;
      const newAttempts = currentAttempts === 0 ? 1 : currentAttempts;

      await supabase
        .from("student_practicals")
        .update({
          status: "completed",
          completed_at: now.toISOString(),
          attempt_count: newAttempts
        } as never)
        .eq("id", spRecord.id);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Exam submit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
