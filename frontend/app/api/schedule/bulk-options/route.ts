import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const subject_id = searchParams.get("subject_id");
        const batch_name = searchParams.get("batch");

        if (!subject_id || !batch_name) {
            return NextResponse.json(
                { error: "Subject ID and Batch Name are required" },
                { status: 400 }
            );
        }

        // 1. Fetch Assigned Faculty for this Subject + Batch
        const id = parseInt(subject_id);
        const { data: mapping, error: mappingError } = (await supabase
            .from("subject_faculty_batches")
            .select("faculty_id, users(email)")
            .eq("subject_id", id)
            .eq("batch", batch_name)
            .single()) as any;

        // 2. Fetch all practicals for this subject
        const { data: practicals, error: practicalsError } = (await supabase
            .from("practicals")
            .select("id, title, description, max_marks")
            .eq("subject_id", id)
            .order("id", { ascending: true })) as any as { data: any[] | null, error: any };

        if (practicalsError) {
            return NextResponse.json({ error: practicalsError.message }, { status: 500 });
        }

        // 3. Mark which practicals are already scheduled for this batch
        // We can do a second query or just return raw practicals and let frontend check?
        // Let's check schedules efficiently.
        const { data: existingSchedules } = (await supabase
            .from("schedules")
            .select("practical_id, date, start_time, end_time")
            .eq("batch_name", batch_name)
            // We might want to filter by subject's practicals only, but we already have practical IDs.
            .in("practical_id", practicals?.map(p => p.id) || [])) as any as { data: any[] | null };

        const scheduledMap = new Set(existingSchedules?.map(s => s.practical_id));

        const practicalsWithStatus = practicals?.map(p => ({
            ...p,
            is_scheduled: scheduledMap.has(p.id),
            existing_schedule: existingSchedules?.find(s => s.practical_id === p.id) || null
        }));

        return NextResponse.json({
            assigned_faculty: mapping ? { id: mapping.faculty_id, ...mapping.users } : null,
            practicals: practicalsWithStatus || []
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
