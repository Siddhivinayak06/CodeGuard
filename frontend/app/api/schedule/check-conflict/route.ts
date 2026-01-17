import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { faculty_id, date, start_time, end_time } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    // 1. Check Holiday
    const { data: holiday } = await supabase
      .from("holidays")
      .select("id, description")
      .eq("date", date)
      .single();

    if (holiday) {
      return NextResponse.json({
        conflict: true,
        reason: `Holiday: ${holiday.description}`,
      });
    }

    // 2. Check Faculty Schedule
    if (faculty_id && start_time && end_time) {
      const { data: conflicts } = await supabase
        .from("schedules")
        .select("id, start_time, end_time")
        .eq("faculty_id", faculty_id)
        .eq("date", date)
        .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({
          conflict: true,
          reason: "Faculty is already scheduled at this time.",
        });
      }
    }

    // Default: No conflict found
    return NextResponse.json({ conflict: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
