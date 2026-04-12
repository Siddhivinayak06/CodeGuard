import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** PUT - update an existing schedule */
export async function PUT(request: Request) {
    try {
        const supabase = await createClient();
        const { user, role, response: authError } = await requireRole(supabase, ["admin", "faculty"]);
        if (authError) return authError;
        const body = await request.json();
        const {
            id,
            date,
            start_time,
            end_time,
            faculty_id,
            practical_id,
            batch_name,
            title_placeholder,
        } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing schedule id" }, { status: 400 });
        }

        const { data: existingSchedule, error: existingError } = await (supabaseAdmin
            .from("schedules") as any)
            .select("id, faculty_id, practical_id, date, start_time, end_time, batch_name, title_placeholder")
            .eq("id", id)
            .single();

        if (existingError || !existingSchedule) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        // Faculty can update only their own schedules.
        if (role === "faculty" && existingSchedule.faculty_id !== user.id) {
            return NextResponse.json({ error: "Forbidden: cannot modify another faculty schedule" }, { status: 403 });
        }

        const updates: Record<string, any> = {};
        if (date !== undefined) updates.date = date;
        if (start_time !== undefined) updates.start_time = start_time;
        if (end_time !== undefined) updates.end_time = end_time;
        if (faculty_id !== undefined) updates.faculty_id = faculty_id;
        if (batch_name !== undefined) updates.batch_name = batch_name || null;
        if (title_placeholder !== undefined) updates.title_placeholder = title_placeholder || null;
        if (practical_id !== undefined) {
            updates.practical_id = practical_id === "_none" || practical_id === "" ? null : practical_id;
        }

        // Faculty is not allowed to reassign schedule ownership to another faculty.
        if (role === "faculty" && updates.faculty_id && updates.faculty_id !== user.id) {
            return NextResponse.json({ error: "Faculty cannot assign schedules to other faculty" }, { status: 403 });
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const targetFacultyId = updates.faculty_id ?? existingSchedule.faculty_id;
        const targetDate = updates.date ?? existingSchedule.date;
        const targetStart = updates.start_time ?? existingSchedule.start_time;
        const targetEnd = updates.end_time ?? existingSchedule.end_time;
        const targetBatch = updates.batch_name !== undefined
            ? updates.batch_name
            : existingSchedule.batch_name;

        if (!targetFacultyId || !targetDate || !targetStart || !targetEnd) {
            return NextResponse.json({ error: "Missing required schedule fields" }, { status: 400 });
        }

        if (String(targetEnd) <= String(targetStart)) {
            return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
        }

        // Holiday check
        const { data: holiday } = (await supabaseAdmin
            .from("holidays")
            .select("id, description")
            .eq("date", targetDate)
            .single()) as any;

        if (holiday) {
            return NextResponse.json(
                { error: `Cannot schedule on a holiday: ${holiday.description}` },
                { status: 409 },
            );
        }

        // Faculty overlap check (strict overlap allows back-to-back sessions)
        const { data: facultyConflicts } = await supabaseAdmin
            .from("schedules")
            .select("id")
            .eq("faculty_id", targetFacultyId)
            .eq("date", targetDate)
            .neq("id", id)
            .or(`and(start_time.lt.${targetEnd},end_time.gt.${targetStart})`);

        if (facultyConflicts && facultyConflicts.length > 0) {
            return NextResponse.json(
                { error: "Faculty is already scheduled for another session at this time." },
                { status: 409 },
            );
        }

        // Batch overlap check
        if (targetBatch) {
            const { data: batchConflicts } = await supabaseAdmin
                .from("schedules")
                .select("id")
                .eq("batch_name", targetBatch)
                .eq("date", targetDate)
                .neq("id", id)
                .or(`and(start_time.lt.${targetEnd},end_time.gt.${targetStart})`);

            if (batchConflicts && batchConflicts.length > 0) {
                return NextResponse.json(
                    { error: `Batch ${targetBatch} is already scheduled at this time.` },
                    { status: 409 },
                );
            }
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await (supabaseAdmin
            .from("schedules") as any)
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/** DELETE - remove a schedule by id */
export async function DELETE(request: Request) {
    try {
        const supabase = await createClient();
        const { response: authError } = await requireRole(supabase, ["admin", "faculty"]);
        if (authError) return authError;
        const { searchParams } = new URL(request.url);
        let id = searchParams.get("id");

        if (!id) {
            const body = await request.json().catch(() => null);
            id = body?.id?.toString() ?? null;
        }

        if (!id) {
            return NextResponse.json({ error: "Missing schedule id" }, { status: 400 });
        }

        // Delete allocations first
        await supabaseAdmin.from("schedule_allocations").delete().eq("schedule_id", id as any);

        // Delete the schedule
        const { error } = await supabaseAdmin
            .from("schedules")
            .delete()
            .eq("id", id as any);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
