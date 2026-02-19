
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const { practicalId } = await req.json();
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        if (!practicalId) {
            return NextResponse.json(
                { success: false, error: "Missing Practical ID" },
                { status: 400 }
            );
        }

        // 1. Fetch Student Practical Record
        const { data: spRecord, error: fetchError } = await supabase
            .from("student_practicals")
            .select("id, is_locked, lock_reason, practical_id")
            .eq("student_id", user.id)
            .eq("practical_id", practicalId)
            .single();

        if (fetchError || !spRecord) {
            return NextResponse.json(
                { success: false, error: "Practical record not found" },
                { status: 404 }
            );
        }

        // Check if already requested
        if (spRecord.lock_reason?.includes("| Re-attempt Requested")) {
            return NextResponse.json({
                success: true,
                message: "Request already sent",
            });
        }

        // 2. Identify Faculty
        // Strategy A: Check schedules
        let facultyId = null;
        const { data: schedule } = await supabase
            .from("schedules")
            .select("faculty_id")
            .eq("practical_id", practicalId)
            .order("date", { ascending: false })
            .limit(1)
            .single();

        if (schedule?.faculty_id) {
            facultyId = schedule.faculty_id;
        } else {
            // Strategy B: Check subject_faculty_batches
            // Need subject_id from practicals
            const { data: practical } = await supabase
                .from("practicals")
                .select("subject_id, title")
                .eq("id", practicalId)
                .single();

            const { data: userData } = await supabase
                .from("users")
                .select("batch") // Assuming user has batch
                .eq("uid", user.id)
                .single();

            if (practical?.subject_id && userData?.batch) {
                const { data: batchAlloc } = await supabase
                    .from("subject_faculty_batches")
                    .select("faculty_id")
                    .eq("subject_id", practical.subject_id)
                    .eq("batch", userData.batch)
                    .single();

                if (batchAlloc?.faculty_id) {
                    facultyId = batchAlloc.faculty_id;
                }
            }
        }

        // 3. Update Lock Reason to mark as "Pending"
        // We append a special string that UI can detect
        const newReason = spRecord.lock_reason
            ? `${spRecord.lock_reason} | Re-attempt Requested`
            : "Locked | Re-attempt Requested";

        const { error: updateError } = await supabase
            .from("student_practicals")
            .update({
                lock_reason: newReason,
            })
            .eq("id", spRecord.id);

        if (updateError) throw updateError;

        // 4. Send Notification to Faculty (if found)
        if (facultyId) {
            const { data: practical } = await supabase
                .from("practicals")
                .select("title")
                .eq("id", practicalId)
                .single();

            await supabase.from("notifications").insert({
                user_id: facultyId,
                type: "submission_received",
                title: "Re-attempt Request",
                message: `${user.email} has requested a re-attempt for practical: ${practical?.title || "Unknown"}`,
                link: `/faculty/submissions?practical=${practicalId}`,
                is_read: false,
                metadata: {
                    isReattemptRequest: true,
                    studentId: user.id,
                    practicalId: practicalId,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Re-attempt request error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
