import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "startDate and endDate are required" },
                { status: 400 }
            );
        }

        // 1. Fetch schedules
        const { data: schedules, error } = await supabase
            .from("schedules")
            .select(`
        *,
        practicals (id, title),
        schedule_allocations (count)
      `)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 2. Fetch Faculty Details manual join
        // Collect all faculty IDs
        const facultyIds = Array.from(new Set(schedules.map((s) => s.faculty_id).filter((id): id is string => !!id)));

        const facultyMap: Record<string, any> = {};

        if (facultyIds.length > 0) {
            const { data: facultyData, error: facultyError } = await supabase
                .from("users")
                .select("uid, name, email, role")
                .in("uid", facultyIds);

            if (!facultyError && facultyData) {
                facultyData.forEach((f) => {
                    facultyMap[f.uid] = f;
                });
            } else {
                console.error("Error fetching faculty details:", facultyError);
            }
        }

        // 3. Merge faculty data into schedules
        const schedulesWithFaculty = schedules.map((s) => ({
            ...s,
            faculty: (s.faculty_id ? facultyMap[s.faculty_id] : null) || { email: "Unknown", name: "Unknown" },
        }));

        // 4. Also fetch holidays in this range
        const { data: holidays, error: holidayError } = await supabase
            .from("holidays")
            .select("*")
            .gte("date", startDate)
            .lte("date", endDate);

        if (holidayError) {
            console.error("Error fetching holidays:", holidayError);
        }

        return NextResponse.json({
            schedules: schedulesWithFaculty,
            holidays: holidays || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
