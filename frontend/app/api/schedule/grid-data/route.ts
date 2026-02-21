import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const subject_id = searchParams.get("subject_id");

        if (!subject_id) {
            // If no subject selected, return empty or list of subjects? 
            // Use existing subjects API for list. This API expects a subject.
            return NextResponse.json(
                { error: "Subject ID is required" },
                { status: 400 }
            );
        }
        const id = parseInt(subject_id);

        // 1. Fetch Practicals
        const { data: practicals, error: pracError } = (await supabase
            .from("practicals")
            .select("id, title, subject_id")
            .eq("subject_id", id)
            .order("id", { ascending: true })) as any as { data: any[] | null, error: any };

        if (pracError) throw pracError;

        // 2. Fetch Batches (from users or schedule? usually config. Let's assume unique batches from users or config exists)
        // Using simple unique batches from users for now, or just hardcoded/config if stored.
        // The previous code fetched from /api/batches/get which likely queries users.
        // Let's replicate that logic server-side or assume frontend passes batches?
        // Better: Fetch from users table distinct batches.
        const { data: batchData, error: batchError } = (await supabase
            .from("users")
            .select("batch")
            .not("batch", "is", null)) as any as { data: any[] | null, error: any }; // Get all batches

        // De-duplicate batches
        const batches = Array.from(new Set(batchData?.map(b => b.batch) || [])).sort();

        // 3. Fetch Schedules for this subject
        const { data: schedules, error: schedError } = (await supabase
            .from("schedules")
            .select("id, practical_id, batch_name, date, start_time, end_time, faculty_id")
            .in("practical_id", practicals?.map(p => p.id) || [])) as any as { data: any[] | null, error: any };

        if (schedError) throw schedError;

        // 4. Fetch Faculty Map for Auto-Assign
        const { data: facultyMap, error: facError } = (await supabase
            .from("subject_faculty_batches")
            .select("batch, faculty_id")
            .eq("subject_id", id)) as any as { data: any[] | null, error: any };

        if (facError) throw facError;

        // Structure data for easier frontend consumption
        // schedulesMap[practical_id][batch_name] = schedule
        const schedulesMap: Record<string, Record<string, any>> = {};

        schedules?.forEach(s => {
            if (!s.practical_id || !s.batch_name) return;
            // Force string conversion to be safe, though types should match
            const pid = String(s.practical_id);
            const bname = String(s.batch_name);
            if (!schedulesMap[pid]) schedulesMap[pid] = {};
            schedulesMap[pid][bname] = s;
        });

        // facultyLookup[batch] = faculty_id
        // Handle "All" batch by expanding to every batch without a specific assignment
        const facultyLookup: Record<string, string> = {};
        let allBatchFacultyId: string | null = null;
        facultyMap?.forEach(f => {
            if (f.batch === "All") {
                allBatchFacultyId = f.faculty_id;
                facultyLookup["All"] = f.faculty_id; // Include so frontend knows
            } else {
                facultyLookup[f.batch] = f.faculty_id;
            }
        });
        // Fill in "All" for batches with no specific faculty
        if (allBatchFacultyId) {
            batches.forEach(b => {
                if (b && !facultyLookup[b]) {
                    facultyLookup[b] = allBatchFacultyId!;
                }
            });
        }

        return NextResponse.json({
            practicals: practicals || [],
            batches: batches,
            schedulesMap,
            facultyLookup
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
