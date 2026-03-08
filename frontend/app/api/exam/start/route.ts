import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

            return NextResponse.json({
                session: existingSession,
                remainingMs,
                examConfig: {
                    duration_minutes: exam.duration_minutes,
                    max_violations: exam.max_violations,
                    allow_copy_paste: exam.allow_copy_paste,
                    require_fullscreen: exam.require_fullscreen,
                    show_test_results: exam.show_test_results,
                },
            });
        }

        // Create new session
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
            })
            .select("*")
            .single();

        if (insertErr) {
            console.error("Failed to create exam session:", insertErr);
            return NextResponse.json({ error: "Failed to start exam" }, { status: 500 });
        }

        const remainingMs = exam.duration_minutes * 60 * 1000;

        return NextResponse.json({
            session: newSession,
            remainingMs,
            examConfig: {
                duration_minutes: exam.duration_minutes,
                max_violations: exam.max_violations,
                allow_copy_paste: exam.allow_copy_paste,
                require_fullscreen: exam.require_fullscreen,
                show_test_results: exam.show_test_results,
            },
        });
    } catch (err) {
        console.error("Exam start error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
