import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function pickSetRoundRobin(supabase: any, examId: string): Promise<string | null> {
    const { data: sets } = await (supabase
        .from("exam_question_sets") as any)
        .select("id, set_order")
        .eq("exam_id", examId)
        .order("set_order", { ascending: true });

    if (!sets || sets.length === 0) return null;

    const { data: sessions } = await (supabase
        .from("exam_sessions") as any)
        .select("assigned_set_id")
        .eq("exam_id", examId)
        .not("assigned_set_id", "is", null);

    const countMap = new Map<string, number>();
    sets.forEach((s: any) => countMap.set(String(s.id), 0));

    (sessions || []).forEach((sess: any) => {
        const sid = String(sess.assigned_set_id || "");
        if (sid && countMap.has(sid)) {
            countMap.set(sid, (countMap.get(sid) || 0) + 1);
        }
    });

    let minCount = Infinity;
    let pickedSetId: string | null = null;

    for (const s of sets) {
        const sid = String(s.id);
        const count = countMap.get(sid) || 0;
        if (count < minCount) {
            minCount = count;
            pickedSetId = sid;
        }
    }

    return pickedSetId;
}

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
            .select("duration_minutes, max_violations, allow_copy_paste, require_fullscreen, show_test_results, end_time")
            .eq("id", examId)
            .single();

        const now = new Date();

        if (exam?.end_time) {
            const endTime = new Date(exam.end_time);
            // 5-min grace
            if (now.getTime() > endTime.getTime() + 300000) {
                return NextResponse.json({ error: "Exam window has closed" }, { status: 403 });
            }
        }

        const expiresAt = new Date(session.expires_at);
        const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
        const isExpired = remainingMs <= 0;

        // Backfill legacy sessions with no assigned set so editor only shows one set.
        let assignedSetId = session.assigned_set_id ? String(session.assigned_set_id) : null;
        if (!assignedSetId) {
            assignedSetId = await pickSetRoundRobin(supabase, examId);
            if (assignedSetId) {
                await (supabase
                    .from("exam_sessions") as any)
                    .update({ assigned_set_id: assignedSetId })
                    .eq("id", session.id);
                (session as any).assigned_set_id = assignedSetId;
            }
        }

        const assignedSet = await fetchAssignedSet(supabase, assignedSetId);

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
