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

    // Verify faculty role (optional but recommended)
    // Here we assume only faculty can access this route (middleware or check)

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
    const newMax = (record.max_attempts || 1) + 1;

    const { error: updateError } = await supabase
      .from("student_practicals")
      .update({
        max_attempts: newMax,
        is_locked: false,
        lock_reason: null, // Clear reason
        // We do NOT reset attempt_count, so history is preserved.
        // Since max > attempt_count, they can start.
      })
      .eq("id", record.id);

    if (updateError) throw updateError;

    // Log action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      type: "system",
      action: "allow_reattempt",
      details: { studentId, practicalId, newMaxAttempts: newMax, reason },
      created_at: new Date().toISOString(),
    });

    // Notify student about the re-attempt
    try {
      const { data: practical } = await supabase
        .from("practicals")
        .select("title")
        .eq("id", practicalId)
        .single();

      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "submission_graded",
        title: "Re-attempt Granted",
        message: `Your faculty has granted a re-attempt for "${practical?.title || "a practical"}". You now have ${newMax} total attempts.`,
        link: "/student/practicals",
        is_read: false,
      });
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
