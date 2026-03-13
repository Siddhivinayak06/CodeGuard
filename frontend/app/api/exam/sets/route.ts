import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/exam/sets?examId=<uuid>
 * Returns all question sets for an exam, with their linked level IDs
 */
export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);
        const examId = searchParams.get("examId");

        if (!examId) {
            return NextResponse.json({ error: "Missing examId" }, { status: 400 });
        }

        // Auth check
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch sets
        const { data: sets, error: setsErr } = await (supabase
            .from("exam_question_sets") as any)
            .select("*")
            .eq("exam_id", examId)
            .order("set_order", { ascending: true });

        if (setsErr) throw setsErr;

        if (!sets || sets.length === 0) {
            return NextResponse.json({ success: true, sets: [] });
        }

        // Fetch level mappings for all sets
        const setIds = sets.map((s: any) => s.id);
        const { data: levelMappings, error: levelsErr } = await (supabase
            .from("exam_set_levels") as any)
            .select("*")
            .in("question_set_id", setIds)
            .order("sort_order", { ascending: true });

        if (levelsErr) throw levelsErr;

        // Attach level_ids to each set
        const setsWithLevels = sets.map((s: any) => ({
            ...s,
            level_ids: (levelMappings || [])
                .filter((m: any) => m.question_set_id === s.id)
                .map((m: any) => m.level_id),
        }));

        return NextResponse.json({ success: true, sets: setsWithLevels });
    } catch (err: any) {
        console.error("Error fetching exam sets:", err);
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}

/**
 * POST /api/exam/sets
 * Body: { examId: string, sets: [{ set_name: string, level_ids: number[] }] }
 * Bulk upsert: replaces all sets for the exam
 */
export async function POST(req: Request) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { examId, sets } = await req.json();

        if (!examId || !Array.isArray(sets)) {
            return NextResponse.json({ error: "Missing examId or sets array" }, { status: 400 });
        }

        // Validate: no empty set names, each set must have at least 1 level
        for (const s of sets) {
            if (!s.set_name || !s.set_name.trim()) {
                return NextResponse.json({ error: "Set name cannot be empty" }, { status: 400 });
            }
            if (!Array.isArray(s.level_ids) || s.level_ids.length === 0) {
                return NextResponse.json(
                    { error: `Set "${s.set_name}" must have at least one sub-question` },
                    { status: 400 }
                );
            }
        }

        // Delete existing sets (cascade will delete exam_set_levels too)
        await (supabase
            .from("exam_question_sets") as any)
            .delete()
            .eq("exam_id", examId);

        if (sets.length === 0) {
            return NextResponse.json({ success: true, sets: [] });
        }

        // Insert new sets
        const setInserts = sets.map((s: any, idx: number) => ({
            exam_id: examId,
            set_name: s.set_name.trim(),
            set_order: idx,
        }));

        const { data: insertedSets, error: insertErr } = await (supabase
            .from("exam_question_sets") as any)
            .insert(setInserts)
            .select("*");

        if (insertErr) throw insertErr;

        // Insert level mappings
        const levelInserts: any[] = [];
        sets.forEach((s: any, idx: number) => {
            const insertedSet = insertedSets[idx];
            if (insertedSet) {
                s.level_ids.forEach((levelId: number, sortIdx: number) => {
                    levelInserts.push({
                        question_set_id: insertedSet.id,
                        level_id: levelId,
                        sort_order: sortIdx,
                    });
                });
            }
        });

        if (levelInserts.length > 0) {
            const { error: levelInsertErr } = await (supabase
                .from("exam_set_levels") as any)
                .insert(levelInserts);
            if (levelInsertErr) throw levelInsertErr;
        }

        // Return the full result
        const result = insertedSets.map((s: any, idx: number) => ({
            ...s,
            level_ids: sets[idx].level_ids,
        }));

        return NextResponse.json({ success: true, sets: result });
    } catch (err: any) {
        console.error("Error saving exam sets:", err);
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/exam/sets?setId=<uuid>
 * Delete a specific question set
 */
export async function DELETE(req: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);
        const setId = searchParams.get("setId");

        if (!setId) {
            return NextResponse.json({ error: "Missing setId" }, { status: 400 });
        }

        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { error } = await (supabase
            .from("exam_question_sets") as any)
            .delete()
            .eq("id", setId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Error deleting exam set:", err);
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}
