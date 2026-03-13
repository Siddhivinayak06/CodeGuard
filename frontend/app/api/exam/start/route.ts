import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Picks the set with the fewest existing assignments (round-robin).
 * Returns the set_id to assign, or null if no sets exist.
 */
async function pickSetRoundRobin(supabase: any, examId: string): Promise<string | null> {
    // Fetch all question sets for this exam
    const { data: sets } = await (supabase
        .from("exam_question_sets") as any)
        .select("id, set_name, set_order")
        .eq("exam_id", examId)
        .order("set_order", { ascending: true });

    if (!sets || sets.length === 0) return null;

    // Count existing assignments per set
    const { data: sessions } = await (supabase
        .from("exam_sessions") as any)
        .select("assigned_set_id")
        .eq("exam_id", examId)
        .not("assigned_set_id", "is", null);

    const countMap = new Map<string, number>();
    sets.forEach((s: any) => countMap.set(s.id, 0));

    if (sessions) {
        sessions.forEach((sess: any) => {
            if (sess.assigned_set_id && countMap.has(sess.assigned_set_id)) {
                countMap.set(sess.assigned_set_id, (countMap.get(sess.assigned_set_id) || 0) + 1);
            }
        });
    }

    // Pick the set with the fewest assignments (ties broken by set_order)
    let minCount = Infinity;
    let pickedSetId: string | null = null;

    for (const s of sets) {
        const count = countMap.get(s.id) || 0;
        if (count < minCount) {
            minCount = count;
            pickedSetId = s.id;
        }
    }

    return pickedSetId;
}

/**
 * Fetches the assigned set details (set info + level IDs) for a session.
 */
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

        // Fetch exam config
        const { data: exam, error: examErr } = await (supabase
            .from("exams") as any)
            .select("*")
            .eq("id", examId)
            .single();

        if (examErr || !exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 });
        }

        // Check time window
        const now = new Date();
        if (exam.start_time && now < new Date(exam.start_time)) {
            return NextResponse.json({ error: "Exam has not started yet" }, { status: 400 });
        }
        if (exam.end_time && now > new Date(exam.end_time)) {
            return NextResponse.json({ error: "Exam window has closed" }, { status: 400 });
        }

        const examConfig = {
            duration_minutes: exam.duration_minutes,
            max_violations: exam.max_violations,
            allow_copy_paste: exam.allow_copy_paste,
            require_fullscreen: exam.require_fullscreen,
            show_test_results: exam.show_test_results,
        };

        // Check if session already exists
        const { data: existingSession } = await (supabase
            .from("exam_sessions") as any)
            .select("*")
            .eq("exam_id", examId)
            .eq("student_id", user.id)
            .single();

        if (existingSession) {
            if (existingSession.submitted_at) {
                return NextResponse.json({ error: "You have already submitted this exam" }, { status: 400 });
            }

            const expiresAt = new Date(existingSession.expires_at);
            const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());

            // Fetch assigned set info
            const assignedSet = await fetchAssignedSet(supabase, existingSession.assigned_set_id);

            return NextResponse.json({
                session: existingSession,
                remainingMs,
                examConfig,
                assignedSet,
            });
        }

        // --- Create new session ---

        // Round-robin set assignment
        const assignedSetId = await pickSetRoundRobin(supabase, examId);

        const expiresAt = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);
        if (exam.end_time && expiresAt > new Date(exam.end_time)) {
            expiresAt.setTime(new Date(exam.end_time).getTime());
        }

        const { data: newSession, error: insertErr } = await (supabase
            .from("exam_sessions") as any)
            .insert({
                exam_id: examId,
                student_id: user.id,
                started_at: now.toISOString(),
                expires_at: expiresAt.toISOString(),
                is_active: true,
                assigned_set_id: assignedSetId,
            })
            .select("*")
            .single();

        if (insertErr) {
            console.error("Failed to create exam session:", insertErr);
            return NextResponse.json({ error: "Failed to start exam" }, { status: 500 });
        }

        const remainingMs = exam.duration_minutes * 60 * 1000;

        // Fetch assigned set details
        const assignedSet = await fetchAssignedSet(supabase, assignedSetId);

        return NextResponse.json({
            session: newSession,
            remainingMs,
            examConfig,
            assignedSet,
        });
    } catch (err) {
        console.error("Exam start error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
