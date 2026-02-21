import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data: spRecord, error: fetchError } = await supabase
      .from("student_practicals")
      .select("id, attempt_count, max_attempts, is_locked, lock_reason")
      .eq("student_id", user.id)
      .eq("practical_id", practicalId) // specific practical
      .single();

    if (fetchError || !spRecord) {
      // Check if student is allocated via schedule (Implicit Assignment)
      const { data: allocation, error: allocError } = await supabase
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

      const { data: schedules } = await supabase
        .from("schedules")
        .select("id")
        .eq("practical_id", practicalId);

      const scheduleIds = (schedules as any[])?.map((s: any) => s.id) || [];

      let isAllocated = false;

      if (scheduleIds.length > 0) {
        const { count } = await supabase
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
      const { error: insertError } = await supabase
        .from("student_practicals")
        .insert({
          student_id: user.id,
          practical_id: practicalId,
          status: "started",
          attempt_count: 1,
          max_attempts: 1, // Default 1 attempt allowed
        } as never);

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({ success: true, attempt: 1 });
    }

    // 2. We have an existing record.
    // Check lock status
    if ((spRecord as any).is_locked) {
      return NextResponse.json(
        {
          success: false,
          error: (spRecord as any).lock_reason || "Session locked by faculty.",
        },
        { status: 403 },
      );
    }

    // Check attempts
    const attempts = (spRecord as any).attempt_count || 0;
    const max = (spRecord as any).max_attempts || 1;

    if (attempts >= max) {
      return NextResponse.json(
        {
          success: false,
          error: "You have already used your attempt. Refreshing is not allowed.",
        },
        { status: 403 },
      );
    }

    // Allow Start - Increment attempt count
    const { error: updateError } = await supabase
      .from("student_practicals")
      .update({
        attempt_count: attempts + 1,
        status: "in_progress",
      } as never)
      .eq("id", (spRecord as any).id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, attempt: attempts + 1 });
  } catch (err: any) {
    console.error("Error starting practical:", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
