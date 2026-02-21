import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** PUT - update an existing schedule */
export async function PUT(request: Request) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { id, date, start_time, end_time } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing schedule id" }, { status: 400 });
        }

        const updates: Record<string, any> = {};
        if (date !== undefined) updates.date = date;
        if (start_time !== undefined) updates.start_time = start_time;
        if (end_time !== undefined) updates.end_time = end_time;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const { data, error } = await (supabase
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
        await supabase.from("schedule_allocations").delete().eq("schedule_id", id as any);

        // Delete the schedule
        const { error } = await supabase
            .from("schedules")
            .delete()
            .eq("id", id as any);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
