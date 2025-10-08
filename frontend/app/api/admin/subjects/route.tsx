// app/api/admin/subjects/route.ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server"; // your server cookie-aware client
import { supabaseAdmin } from "@/lib/supabase/service";

/*
  This route uses:
  - createServerClient() (cookie-authenticated) to determine current user
  - supabaseAdmin to read/write subjects (bypass RLS for admin operations)
*/

async function isAdmin(supabaseServerClient: ReturnType<typeof createServerClient>) {
  try {
    const { data: userData, error: userErr } = await (supabaseServerClient as any).auth.getUser();
    if (userErr) {
      console.error("Error getting user from cookie client:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user) return false;

    // 1) check app_metadata.role first
    const metaRole = (user as any).app_metadata?.role || (user as any).user_metadata?.role;
    if (metaRole === "admin") return true;

    // 2) fallback: check users table (we store uid as column)
    const { data: row, error } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("uid", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching role from users table:", error);
      return false;
    }
    return row?.role === "admin";
  } catch (err) {
    console.error("Unexpected error checking admin:", err);
    return false;
  }
}

export async function GET() {
  try {
    // public list of subjects (or admin-only depending on your design)
    const { data, error } = await supabaseAdmin.from("subjects").select("*").order("id", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching subjects:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    const admin = await isAdmin(supabaseServerClient);
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const { subject_code, subject_name, faculty_id, faculty_name, semester } = body;

    if (!subject_code || !subject_name) {
      return NextResponse.json({ success: false, error: "Missing required fields (subject_code, subject_name)." }, { status: 400 });
    }

    const payload: Record<string, any> = { subject_code, subject_name };
    if (faculty_id !== undefined) payload.faculty_id = faculty_id;
    if (faculty_name !== undefined) payload.faculty_name = faculty_name;
    if (semester !== undefined) payload.semester = semester;

    const { data, error } = await supabaseAdmin.from("subjects").insert([payload]).select();
    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error("Error adding subject:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    const admin = await isAdmin(supabaseServerClient);
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const { id, subject_code, subject_name, faculty_id, faculty_name, semester } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing required field: id" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (subject_code !== undefined) updates.subject_code = subject_code;
    if (subject_name !== undefined) updates.subject_name = subject_name;
    if (faculty_id !== undefined) updates.faculty_id = faculty_id;
    if (faculty_name !== undefined) updates.faculty_name = faculty_name;
    if (semester !== undefined) updates.semester = semester;

    const { data, error } = await supabaseAdmin.from("subjects").update(updates).eq("id", id).select();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error updating subject:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    const admin = await isAdmin(supabaseServerClient);
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });

    const url = new URL(request.url);
    const idFromQuery = url.searchParams.get("id");

    let id: string | null = idFromQuery;
    if (!id) {
      const body = await request.json().catch(() => null);
      id = body?.id ?? null;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing required: id (query or JSON body)" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("subjects").delete().eq("id", id).select();
    if (error) throw error;
    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Error deleting subject:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}
