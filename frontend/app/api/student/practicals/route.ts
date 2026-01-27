import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET: get assigned practicals for the current student */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: userData, error: userErr } =
      await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = userData.user.id;

    // Verify user is a student
    const { data: userRole, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("uid", userId)
      .single();

    if (roleError || userRole?.role !== "student") {
      return NextResponse.json(
        { success: false, error: "Access denied: students only" },
        { status: 403 },
      );
    }

    // Fetch personalized practicals
    const { data, error } = await supabase
      .from("student_practicals")
      .select(
        `
        id,
        assigned_deadline,
        status,
        notes,
        assigned_at,
        completed_at,
        practicals (
          id,
          title,
          description,
          language,
          max_marks,
          subject_id,
          subjects (
            subject_name,
            subject_code
          )
        )
      `,
      )
      .eq("student_id", userId)
      .order("assigned_deadline", { ascending: true });

    if (error) throw error;

    // Map to desired format
    const practicals = data.map((sp: any) => ({
      id: sp.practicals.id,
      assignment_id: sp.id,
      title: sp.practicals.title,
      description: sp.practicals.description,
      language: sp.practicals.language,
      max_marks: sp.practicals.max_marks,
      assigned_deadline: sp.assigned_deadline,
      status: sp.status,
      notes: sp.notes,
      assigned_at: sp.assigned_at,
      completed_at: sp.completed_at,
      subject_id: sp.practicals.subject_id,
      subject_name: sp.practicals.subjects?.subject_name,
      subject_code: sp.practicals.subjects?.subject_code,
    }));

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching student practicals:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
