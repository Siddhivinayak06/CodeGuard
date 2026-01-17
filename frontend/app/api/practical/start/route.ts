import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { practicalId } = await req.json();
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!practicalId) {
      return NextResponse.json(
        { success: false, error: "Missing Practical ID" },
        { status: 400 },
      );
    }

    // Fetch current status from student_practicals
    // Note: We need to find the record linking student and practical.
    // Assuming student_practicals has practical_id.

    const { data: spRecord, error: fetchError } = await supabaseAdmin
      .from("student_practicals")
      .select("id, attempt_count, max_attempts, is_locked, lock_reason")
      .eq("student_id", user.id)
      .eq("practical_id", practicalId) // specific practical
      .single();

    if (fetchError || !spRecord) {
      // Check if student is allocated via schedule (Implicit Assignment)
      const { data: allocation, error: allocError } = await supabaseAdmin
        .from("schedule_allocations")
        .select("id, schedule:schedules(practical_id, date)")
        .eq("student_id", user.id)
        .filter("schedule.practical_id", "eq", practicalId);
      // Note: The above filter on joined column syntax might vary depending on PostgREST version.
      // Alternative: select schedule_id, verify later.
      // Safest: select schedule_id first.

      // Allow simplified check:
      // We just try to insert a new record if we have a valid schedule allocation OR just proceed if authorized.
      // But we need to be careful about permissions.

      // Let's rely on a simpler check:
      // Does this student have ANY schedule allocation for this practical?
      // Since filtering on joined tables can be tricky in one go without !inner, let's do:
      // 1. Get schedules for this practical
      // 2. Check if student is in those schedules.

      const { data: schedules } = await supabaseAdmin
        .from("schedules")
        .select("id")
        .eq("practical_id", practicalId);

      const scheduleIds = schedules?.map((s) => s.id) || [];

      let isAllocated = false;

      if (scheduleIds.length > 0) {
        const { count } = await supabaseAdmin
          .from("schedule_allocations")
          .select("*", { count: "exact", head: true })
          .eq("student_id", user.id)
          .in("schedule_id", scheduleIds);
        if (count && count > 0) isAllocated = true;
      }

      if (!isAllocated) {
        return NextResponse.json(
          { success: false, error: "Practical allocation not found" },
          { status: 404 },
        );
      }

      // Create the record
      const { data: newRecord, error: createError } = await supabaseAdmin
        .from("student_practicals")
        .insert({
          student_id: user.id,
          practical_id: practicalId,
          status: "in_progress",
          attempt_count: 1, // First attempt
          max_attempts: 1,
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({ success: true, attempt: 1 });
    }

    // Check Lock Status
    if (spRecord.is_locked) {
      return NextResponse.json(
        {
          success: false,
          error: spRecord.lock_reason || "Session is locked by faculty.",
        },
        { status: 403 },
      );
    }

    // Check Attempts
    const currentAttempts = spRecord.attempt_count || 0;
    const maxAttempts = spRecord.max_attempts || 1;

    if (currentAttempts >= maxAttempts) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum attempts reached. Contact faculty to re-attempt.",
        },
        { status: 403 },
      );
    }

    // If Allowed: Increment Attempt Count
    const { error: updateError } = await supabaseAdmin
      .from("student_practicals")
      .update({
        attempt_count: currentAttempts + 1,
        // We could set status to 'in_progress' here too if needed
        status: "in_progress",
      })
      .eq("id", spRecord.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, attempt: currentAttempts + 1 });
  } catch (err: any) {
    console.error("Error starting practical:", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
