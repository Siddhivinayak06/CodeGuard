import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// GET - Fetch user's notifications
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "20");
        const offset = parseInt(searchParams.get("offset") || "0");
        const unreadOnly = searchParams.get("unread") === "true";

        let query = supabase
            .from("notifications")
            .select("*", { count: "exact" })
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (unreadOnly) {
            query = query.eq("is_read", false);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error("Fetch notifications error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            data,
            total: count,
            hasMore: count ? offset + limit < count : false,
        });
    } catch (err) {
        console.error("Notifications API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Create a new notification (for system/admin use)
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const body = await request.json();
        const { user_id, type, title, message, link, metadata } = body;

        if (!user_id || !type || !title) {
            return NextResponse.json(
                { error: "user_id, type, and title are required" },
                { status: 400 }
            );
        }

        const validTypes = [
            "practical_assigned",
            "submission_graded",
            "deadline_reminder",
            "announcement",
            "submission_received",
        ];

        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("notifications")
            .insert({
                user_id,
                type,
                title,
                message: message || null,
                link: link || null,
                metadata: metadata || {},
            })
            .select()
            .single();

        if (error) {
            console.error("Create notification error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (err) {
        console.error("Create notification API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PATCH - Mark notification as read
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, is_read } = body;

        if (!id) {
            return NextResponse.json({ error: "Notification id is required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("notifications")
            .update({ is_read: is_read ?? true })
            .eq("id", id)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Update notification error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (err) {
        console.error("Update notification API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
    try {
        console.log("DELETE /api/notifications called");

        // Check for Service Role Key
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === "placeholder") {
            console.error("Critical: SUPABASE_SERVICE_ROLE_KEY is missing or invalid");
            return NextResponse.json({ error: "Server configuration error: Missing admin key" }, { status: 500 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("Auth error in delete:", authError);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Notification id is required" }, { status: 400 });
        }

        console.log(`Attempting to delete notification ${id} for user ${user.id}`);

        // Use supabaseAdmin to bypass RLS
        const { error, count } = await supabaseAdmin
            .from("notifications")
            .delete({ count: 'exact' })
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) {
            console.error("Supabase delete error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log generic success even if 0 rows deleted (id might be wrong or already deleted)
        console.log(`Delete operation completed. Rows affected: ${count}`);

        return NextResponse.json({ success: true, count });
    } catch (err: any) {
        console.error("Delete notification API error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
