// app/api/admin/subjects/route.ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

/** Check if current user is admin */
async function isAdmin(supabaseServerClient: ReturnType<typeof createServerClient>) {
  try {
    const { data: userData, error: userErr } = await (supabaseServerClient as any).auth.getUser();
    if (userErr) {
      console.error("Error getting user:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user) return false;

    // 1) check app_metadata.role
    const metaRole = (user as any).app_metadata?.role || (user as any).user_metadata?.role;
    if (metaRole === "admin") return true;

    // 2) fallback: check users table
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

/** GET: list all subjects with faculty names */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("subjects")
      .select(`
        id,
        subject_name,
        subject_code,
        semester,
        faculty_id,
        users!faculty_id (name,email)
      `)
      .order("id", { ascending: true });

    if (error) throw error;

    // Map faculty_name for frontend convenience
    const subjects = data.map((s: any) => ({
      id: s.id,
      subject_name: s.subject_name,
      subject_code: s.subject_code,
      semester: s.semester,
      faculty_id: s.faculty_id,
      faculty_name: s.users?.name ?? s.users?.email ?? null,
    }));

    return NextResponse.json({ success: true, data: subjects });
  } catch (err: any) {
    console.error("Error fetching subjects:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** POST: add a new subject */
export async function POST(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { subject_code, subject_name, faculty_id, semester } = body;

    if (!subject_code || !subject_name) {
      return NextResponse.json({ success: false, error: "Missing required fields (subject_code, subject_name)." }, { status: 400 });
    }

    const payload: Record<string, any> = { subject_code, subject_name };
    if (faculty_id) payload.faculty_id = faculty_id;
    if (semester) payload.semester = semester;

    const { data, error } = await supabaseAdmin.from("subjects").insert([payload]).select();
    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error("Error adding subject:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** PUT: update an existing subject */
export async function PUT(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, subject_code, subject_name, faculty_id, semester } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing required field: id" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (subject_code !== undefined) updates.subject_code = subject_code;
    if (subject_name !== undefined) updates.subject_name = subject_name;
    if (faculty_id !== undefined) updates.faculty_id = faculty_id;
    if (semester !== undefined) updates.semester = semester;

    const { data, error } = await supabaseAdmin.from("subjects").update(updates).eq("id", id).select();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error updating subject:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** DELETE: remove a subject by id */
export async function DELETE(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });
    }

    const url = new URL(request.url);
    let id = url.searchParams.get("id");
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
