import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function fetchAssignedSet(supabase: any, assignedSetId: string | null) {
    if (!assignedSetId) return null;

    const { data: set } = await (supabase
        .from("exam_question_sets") as any)
        .select("id, set_name, set_order")
        .eq("id", assignedSetId)
        .single();

    if (!set) return null;

    const { data: levelMappings } = await (supabase
        .from("exam_set_levels") as any)
        .select("level_id, sort_order")
        .eq("question_set_id", assignedSetId)
        .order("sort_order", { ascending: true });

    return {
        id: set.id,
        set_name: set.set_name,
        level_ids: (levelMappings || []).map((m: any) => m.level_id),
    };
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { examId } = await req.json();

        if (!examId) {
            return NextResponse.json({ error: "Missing examId" }, { status: 400 });
        }

        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch session
        const { data: session } = await (supabase
            .from("exam_sessions") as any)
            .select("*")
            .eq("exam_id", examId)
            .eq("student_id", user.id)
            .single();

        if (!session) {
            return NextResponse.json({ error: "No active exam session" }, { status: 404 });
        }

        // Fetch exam config
        const { data: exam } = await (supabase
            .from("exams") as any)
            .select("duration_minutes, max_violations, allow_copy_paste, require_fullscreen, show_test_results")
            .eq("id", examId)
            .single();

        const now = new Date();
        const expiresAt = new Date(session.expires_at);
        const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
        const isExpired = remainingMs <= 0;

        // Fetch assigned set details
        const assignedSet = await fetchAssignedSet(supabase, session.assigned_set_id);

        return NextResponse.json({
            session: {
                ...(session as any),
                isExpired,
            },
            remainingMs,
            examConfig: exam || {
                duration_minutes: 60,
                max_violations: 3,
                allow_copy_paste: false,
                require_fullscreen: true,
                show_test_results: false,
            },
            assignedSet,
        });
    } catch (err) {
        console.error("Exam status error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
