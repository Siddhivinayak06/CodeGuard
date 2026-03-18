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

        // Auth + role check
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: callerRow } = await supabase
            .from("users")
            .select("role")
            .eq("uid", user.id)
            .maybeSingle() as any;

        if (!callerRow || !["faculty", "admin"].includes(callerRow.role)) {
            return NextResponse.json({ error: "Forbidden: faculty/admin only" }, { status: 403 });
        }

        const { examId, sets } = await req.json();

        if (!examId || !Array.isArray(sets)) {
            return NextResponse.json({ error: "Missing examId or sets array" }, { status: 400 });
        }

        // Validate: no empty set names, each set must have at least 1 level, and set names must be unique
        const setNames = new Set<string>();
        for (const s of sets) {
            const trimmedName = s.set_name?.trim();
            if (!trimmedName) {
                return NextResponse.json({ error: "Set name cannot be empty" }, { status: 400 });
            }
            if (setNames.has(trimmedName.toLowerCase())) {
                return NextResponse.json(
                    { error: `Duplicate set name "${trimmedName}" is not allowed` },
                    { status: 400 }
                );
            }
            setNames.add(trimmedName.toLowerCase());

            if (!Array.isArray(s.level_ids) || s.level_ids.length === 0) {
                return NextResponse.json(
                    { error: `Set "${trimmedName}" must have at least one sub-question` },
                    { status: 400 }
                );
            }
        }

        // Fetch existing sets
        const { data: existingSets, error: fetchErr } = await (supabase
            .from("exam_question_sets") as any)
            .select("id, set_name")
            .eq("exam_id", examId);

        if (fetchErr) {
            console.error("Error fetching existing sets:", fetchErr);
            return NextResponse.json({ error: "Failed to fetch existing sets" }, { status: 500 });
        }

        const existingSetMap = new Map((existingSets || []).map((s: any) => [s.set_name.toLowerCase(), s.id]));
        const incomingSetNames = new Set(sets.map((s: any) => s.set_name.trim().toLowerCase()));

        // 1. Delete sets that are no longer in the new payload (and unassign sessions)
        const setsToDelete = (existingSets || []).filter((s: any) => !incomingSetNames.has(s.set_name.toLowerCase()));
        if (setsToDelete.length > 0) {
            const deleteSetIds = setsToDelete.map((s: any) => s.id);
            
            // Unassign sessions mapped to these deleted sets
            await (supabase
                .from("exam_sessions") as any)
                .update({ assigned_set_id: null })
                .in("assigned_set_id", deleteSetIds);
                
            // Delete levels for these sets
            await (supabase
                .from("exam_set_levels") as any)
                .delete()
                .in("question_set_id", deleteSetIds);
                
            // Delete the sets themselves
            await (supabase
                .from("exam_question_sets") as any)
                .delete()
                .in("id", deleteSetIds);
        }

        if (sets.length === 0) {
            return NextResponse.json({ success: true, sets: [] });
        }

        const insertedSets = [];

        // 2. Upsert sets one by one
        for (let idx = 0; idx < sets.length; idx++) {
            const s = sets[idx];
            const trimmedName = s.set_name.trim();
            const lowerName = trimmedName.toLowerCase();
            let setId = existingSetMap.get(lowerName);

            if (setId) {
                // Update existing set order
                const { error: updateSetErr } = await (supabase
                    .from("exam_question_sets") as any)
                    .update({ set_order: idx })
                    .eq("id", setId);
                if (updateSetErr) throw updateSetErr;
            } else {
                // Insert new set
                const { data: newSet, error: insertSetErr } = await (supabase
                    .from("exam_question_sets") as any)
                    .insert({
                        exam_id: examId,
                        set_name: trimmedName,
                        set_order: idx,
                    })
                    .select("id")
                    .single();
                if (insertSetErr) throw insertSetErr;
                setId = newSet.id;
            }

            insertedSets.push({ id: setId, set_name: trimmedName, set_order: idx });

            // 3. Sync level mappings for this set
            // First, delete old level mappings for this set
            await (supabase
                .from("exam_set_levels") as any)
                .delete()
                .eq("question_set_id", setId);

            // Then, insert new level mappings
            const levelInserts = s.level_ids.map((levelId: number, sortIdx: number) => ({
                question_set_id: setId,
                level_id: levelId,
                sort_order: sortIdx,
            }));

            if (levelInserts.length > 0) {
                const { error: levelInsertErr } = await (supabase
                    .from("exam_set_levels") as any)
                    .insert(levelInserts);
                if (levelInsertErr) throw levelInsertErr;
            }
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

        const { data: callerRow } = await supabase
            .from("users")
            .select("role")
            .eq("uid", user.id)
            .maybeSingle() as any;

        if (!callerRow || !["faculty", "admin"].includes(callerRow.role)) {
            return NextResponse.json({ error: "Forbidden: faculty/admin only" }, { status: 403 });
        }

        // 1. Unassign sessions mapped to this set
        await (supabase
            .from("exam_sessions") as any)
            .update({ assigned_set_id: null })
            .eq("assigned_set_id", setId);

        // 2. Delete level mappings
        await (supabase
            .from("exam_set_levels") as any)
            .delete()
            .eq("question_set_id", setId);

        // 3. Delete the set itself
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
