import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { schedules } = body; // Expecting { schedules: [ { practical_id, faculty_id, date, start_time, end_time, batch_name } ] }

        if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
            return NextResponse.json(
                { error: "Invalid payload: 'schedules' array is required." },
                { status: 400 }
            );
        }

        const results = [];
        const errors = [];

        // We'll process sequentially for now to handle individual errors/conflicts gracefully, 
        // or we could try to validate all first. 
        // Let's validate all first for major conflicts.

        // 1. Fetch relevant data (students for batch)
        // Assuming all schedules are for the same batch/students for now, based on the wizard application.
        // If mixed batches, we need to fetch students for each batch.
        // Optimization: Fetch unique batches and students relative to them.
        const uniqueBatches = Array.from(new Set(schedules.map((s: any) => s.batch_name) as string[]));
        const batchStudentMap: Record<string, string[]> = {};

        for (const batch of uniqueBatches) {
            if (batch) {
                const { data: students } = await supabase
                    .from("users")
                    .select("uid")
                    .eq("batch", batch)
                    .eq("role", "student");
                if (students) {
                    batchStudentMap[batch] = students.map(s => s.uid);
                }
            }
        }

        // 2. Iterate and Insert
        for (const schedule of schedules) {
            const { practical_id, faculty_id, date, start_time, end_time, batch_name, title_placeholder } = schedule;

            // Basic Config Check
            if (!faculty_id || !date || !start_time || !end_time) {
                errors.push({ ...schedule, error: "Missing fields" });
                continue;
            }

            // Conflict Check (Simpler version for bulk: check DB)
            // Note: This is N queries. For 10-15 practicals it's fine. For 100s, need optimization.
            const { data: conflicts } = await supabase
                .from("schedules")
                .select("id")
                .eq("faculty_id", faculty_id)
                .eq("date", date)
                .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);

            if (conflicts && conflicts.length > 0) {
                errors.push({ ...schedule, error: "Faculty Conflict" });
                continue;
            }

            // Batch Conflict Check
            if (batch_name) {
                const { data: batchConflicts } = await supabase
                    .from("schedules")
                    .select("id")
                    .eq("batch_name", batch_name)
                    .eq("date", date)
                    .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`);

                if (batchConflicts && batchConflicts.length > 0) {
                    errors.push({ ...schedule, error: "Batch Conflict" });
                    continue;
                }
            }


            // Insert
            const { data: inserted, error: insertError } = await supabase
                .from("schedules")
                .insert({
                    practical_id: practical_id || null,
                    faculty_id,
                    date,
                    start_time,
                    end_time,
                    batch_name,
                    title_placeholder: title_placeholder || "Untitled Session",
                })
                .select()
                .single();

            if (insertError) {
                errors.push({ ...schedule, error: insertError.message });
                continue;
            }

            results.push(inserted);

            // Allocate Students
            const studentIds = batch_name ? batchStudentMap[batch_name] : [];
            if (studentIds && studentIds.length > 0) {
                const allocations = studentIds.map(uid => ({
                    schedule_id: inserted.id,
                    student_id: uid
                }));
                await supabase.from("schedule_allocations").insert(allocations);
            }
        }

        return NextResponse.json({
            success: true,
            created: results.length,
            failed: errors.length,
            results,
            errors
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
