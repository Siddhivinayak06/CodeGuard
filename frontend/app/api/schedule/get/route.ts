import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { response: authError } = await requireAuth(supabase);
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    // 1. Fetch schedules with joined faculty data
    const { data: schedules, error } = await supabase
      .from("schedules")
      .select(
        `
        *,
        practicals!inner (id, title, is_exam),
        schedule_allocations (count),
        faculty:users!faculty_id (uid, name, email, role)
      `,
      )
      .eq("practicals.is_exam", false)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Fetch holidays in this range
    const { data: holidays, error: holidayError } = await supabase
      .from("holidays")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);

    if (holidayError) {
      console.error("Error fetching holidays:", holidayError);
    }

    return NextResponse.json({
      schedules: schedules || [],
      holidays: holidays || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
