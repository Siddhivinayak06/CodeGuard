// app/api/admin/subjects/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Check if current user is admin */
async function isAdmin(supabase: any) {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error("Error getting user:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user) return false;

    // 1) check app_metadata.role
    const metaRole =
      (user as any).app_metadata?.role || (user as any).user_metadata?.role;
    if (metaRole === "admin") return true;

    // 2) fallback: check users table
    const { data: row, error } = await supabase
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

interface FacultyBatch {
  batch: string;
  faculty_id: string;
}

/** GET: list all subjects with batch-wise faculty assignments */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get subjects
    const { data: subjectsData, error: subjectsError } = await supabase
      .from("subjects")
      .select(`id, subject_name, subject_code, semester`)
      .order("id", { ascending: true });

    if (subjectsError) throw subjectsError;

    // Get all batch-faculty assignments with faculty details
    const { data: facultyBatches, error: fbError } = await supabase
      .from("subject_faculty_batches")
      .select(`
        id,
        subject_id,
        batch,
        faculty_id,
        users!subject_faculty_batches_faculty_id_fkey (name, email)
      `);

    if (fbError) throw fbError;

    // Group faculty batches by subject_id
    const facultyBatchesBySubject: Record<number, any[]> = {};
    for (const fb of (facultyBatches as any[]) || []) {
      const subjectId = fb.subject_id;
      if (!facultyBatchesBySubject[subjectId]) {
        facultyBatchesBySubject[subjectId] = [];
      }
      facultyBatchesBySubject[subjectId].push({
        id: fb.id,
        batch: fb.batch,
        faculty_id: fb.faculty_id,
        faculty_name: (fb.users as any)?.name ?? (fb.users as any)?.email ?? null,
      });
    }

    // Map subjects with their faculty batches
    const subjects = (subjectsData || []).map((s: any) => ({
      id: s.id,
      subject_name: s.subject_name,
      subject_code: s.subject_code,
      semester: s.semester,
      faculty_batches: facultyBatchesBySubject[s.id] || [],
    }));

    return NextResponse.json({ success: true, data: subjects });
  } catch (err: any) {
    console.error("Error fetching subjects:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** POST: add a new subject with batch-wise faculty assignments */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin only" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { subject_code, subject_name, semester, faculty_batches } = body;

    if (!subject_code || !subject_name) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields (subject_code, subject_name).",
        },
        { status: 400 },
      );
    }

    // Insert the subject
    const { data: subjectData, error: subjectError } = await supabase
      .from("subjects")
      .insert({ subject_code, subject_name, semester } as any)
      .select()
      .single();

    if (subjectError) throw subjectError;

    const subjectId = (subjectData as any).id;

    // Insert faculty-batch assignments if provided
    if (faculty_batches && Array.isArray(faculty_batches) && faculty_batches.length > 0) {
      const fbInserts = faculty_batches.map((fb: FacultyBatch) => ({
        subject_id: subjectId,
        batch: fb.batch,
        faculty_id: fb.faculty_id,
      }));

      const { error: fbError } = await supabase
        .from("subject_faculty_batches")
        .insert(fbInserts as any);

      if (fbError) throw fbError;
    }

    return NextResponse.json({ success: true, data: subjectData }, { status: 201 });
  } catch (err: any) {
    console.error("Error adding subject:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** PUT: update an existing subject and its batch-faculty assignments */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin only" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { id, subject_code, subject_name, semester, faculty_batches } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: id" },
        { status: 400 },
      );
    }

    // Update subject fields if provided
    const updates: Record<string, any> = {};
    if (subject_code !== undefined) updates.subject_code = subject_code;
    if (subject_name !== undefined) updates.subject_name = subject_name;
    if (semester !== undefined) updates.semester = semester;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await (supabase.from("subjects") as any)
        .update(updates)
        .eq("id", id);
      if (updateError) throw updateError;
    }

    // Update faculty-batch assignments if provided
    if (faculty_batches !== undefined && Array.isArray(faculty_batches)) {
      // Delete existing assignments for this subject
      const { error: deleteError } = await supabase
        .from("subject_faculty_batches")
        .delete()
        .eq("subject_id", id);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (faculty_batches.length > 0) {
        const fbInserts = faculty_batches.map((fb: FacultyBatch) => ({
          subject_id: id,
          batch: fb.batch,
          faculty_id: fb.faculty_id,
        }));

        const { error: insertError } = await supabase
          .from("subject_faculty_batches")
          .insert(fbInserts as any);

        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error updating subject:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** DELETE: remove a subject by id (cascade will delete faculty_batches) */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: admin only" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    let id = url.searchParams.get("id");
    if (!id) {
      const body = await request.json().catch(() => null);
      id = body?.id ?? null;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required: id (query or JSON body)" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", Number(id))
      .select();
    if (error) throw error;

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Error deleting subject:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
