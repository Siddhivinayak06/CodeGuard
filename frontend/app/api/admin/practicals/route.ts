import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = 'force-dynamic';

/** Check if current user is faculty or admin */
async function isFacultyOrAdmin(supabaseServerClient: any) {
  try {
    const { data: userData, error: userErr } = await supabaseServerClient.auth.getUser();
    if (userErr) {
      console.error("Error getting user:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user) return false;

    // Check users table for role
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
    return row?.role === "faculty" || row?.role === "admin";
  } catch (err) {
    console.error("Unexpected error checking faculty/admin:", err);
    return false;
  }
}

/** GET: list all practicals with subject and faculty info */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("practicals")
      .select(`
        id,
        title,
        description,
        language,
        deadline,
        max_marks,
        subject_id,
        subjects (
          subject_name,
          faculty_id,
          users!faculty_id (name, email)
        )
      `)
      .order("deadline", { ascending: true });

    if (error) throw error;

    const practicals = data.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      language: p.language,
      deadline: p.deadline,
      max_marks: p.max_marks,
      subject_id: p.subject_id,
      subject_name: p.subjects?.subject_name,
      faculty_name: p.subjects?.users?.name ?? p.subjects?.users?.email,
    }));

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching practicals:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** POST: create a new practical */
export async function POST(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isFacultyOrAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: faculty/admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { title, subject_id, description, language, deadline, max_marks } = body;

    if (!title || !subject_id) {
      return NextResponse.json({ success: false, error: "Missing required fields (title, subject_id)." }, { status: 400 });
    }

    const payload: Record<string, any> = {
      title,
      subject_id,
      description,
      language,
      deadline,
      max_marks: max_marks || 100,
    };

    const { data, error } = await supabaseAdmin.from("practicals").insert([payload]).select();
    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating practical:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** PUT: update an existing practical */
export async function PUT(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isFacultyOrAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: faculty/admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, title, subject_id, description, language, deadline, max_marks } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing required field: id" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (subject_id !== undefined) updates.subject_id = subject_id;
    if (description !== undefined) updates.description = description;
    if (language !== undefined) updates.language = language;
    if (deadline !== undefined) updates.deadline = deadline;
    if (max_marks !== undefined) updates.max_marks = max_marks;

    const { data, error } = await supabaseAdmin.from("practicals").update(updates).eq("id", id).select();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error updating practical:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** DELETE: remove a practical by id */
export async function DELETE(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isFacultyOrAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: faculty/admin only" }, { status: 403 });
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

    const { data, error } = await supabaseAdmin.from("practicals").delete().eq("id", id).select();
    if (error) throw error;

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Error deleting practical:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}
