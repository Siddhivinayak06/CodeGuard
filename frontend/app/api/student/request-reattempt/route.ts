import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function POST(req: Request) {
    try {
        const { practicalId, reason } = await req.json();

        if (!practicalId) {
            return NextResponse.json({ success: false, error: "Missing practical ID" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get student name
        const { data: studentData } = await supabaseAdmin
            .from('users')
            .select('name')
            .eq('uid', user.id)
            .single();

        // Get practical details
        const { data: practical } = await supabaseAdmin
            .from('practicals')
            .select('title, subject_id, subjects(faculty_id)')
            .eq('id', practicalId)
            .single();

        if (!practical) {
            return NextResponse.json({ success: false, error: "Practical not found" }, { status: 404 });
        }

        const facultyId = (practical.subjects as any)?.faculty_id;

        if (!facultyId) {
            return NextResponse.json({ success: false, error: "Faculty not found for this practical" }, { status: 404 });
        }

        // Create notification for faculty (using existing allowed types)
        const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
            user_id: facultyId,
            type: 'submission_received', // Using allowed type from schema
            title: 'Re-attempt Request',
            message: `${studentData?.name || 'A student'} has requested a re-attempt for "${practical.title}". Reason: ${reason || 'No reason provided'}`,
            metadata: {
                studentId: user.id,
                studentName: studentData?.name,
                practicalId,
                practicalTitle: practical.title,
                isReattemptRequest: true,
                reason: reason || 'No reason provided'
            },
            is_read: false,
            created_at: new Date().toISOString()
        });

        if (notificationError) {
            console.error("Notification error:", notificationError);
            throw notificationError;
        }

        return NextResponse.json({
            success: true,
            message: "Request submitted successfully. The faculty will review your request."
        });

    } catch (err: any) {
        console.error("Error requesting re-attempt:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
