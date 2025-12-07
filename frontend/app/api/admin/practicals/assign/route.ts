import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

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

/** POST: assign a practical to specific students */
export async function POST(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isFacultyOrAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: faculty/admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { practical_id, student_ids, assigned_deadline, notes } = body;

    if (!practical_id || !student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields (practical_id, student_ids array)."
      }, { status: 400 });
    }

    // Check if practical exists and user has access to it
    const { data: practical, error: practicalError } = await supabaseAdmin
      .from("practicals")
      .select("id, title, subject_id, subjects(faculty_id)")
      .eq("id", practical_id)
      .single<any>();

    if (practicalError || !practical) {
      return NextResponse.json({ success: false, error: "Practical not found" }, { status: 404 });
    }

    // Get current user
    const { data: userData } = await supabaseServerClient.auth.getUser();
    const userId = userData?.user?.id;

    // Check if user is faculty for this subject or admin
    const { data: userRole } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("uid", userId)
      .single();

    if (userRole?.role !== "admin" && practical.subjects?.faculty_id !== userId) {
      return NextResponse.json({
        success: false,
        error: "You can only assign practicals for subjects you teach"
      }, { status: 403 });
    }

    // Validate student_ids exist and are students
    const { data: validStudents, error: studentsError } = await supabaseAdmin
      .from("users")
      .select("uid")
      .in("uid", student_ids)
      .eq("role", "student");

    if (studentsError) throw studentsError;

    const validStudentIds = validStudents?.map(s => s.uid) || [];
    const invalidIds = student_ids.filter(id => !validStudentIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Invalid student IDs: ${invalidIds.join(", ")}`
      }, { status: 400 });
    }

    // Check for existing assignments to avoid duplicates
    const { data: existingAssignments } = await supabaseAdmin
      .from("student_practicals")
      .select("student_id")
      .eq("practical_id", practical_id)
      .in("student_id", student_ids);

    const existingStudentIds = existingAssignments?.map(a => a.student_id) || [];
    const newAssignments = student_ids.filter(id => !existingStudentIds.includes(id));

    if (newAssignments.length === 0) {
      return NextResponse.json({
        success: false,
        error: "All selected students are already assigned to this practical"
      }, { status: 400 });
    }

    // Create assignments
    const assignments = newAssignments.map(student_id => ({
      student_id,
      practical_id,
      assigned_deadline: assigned_deadline || null,
      notes: notes || null,
    }));

    const { data, error } = await supabaseAdmin
      .from("student_practicals")
      .insert(assignments)
      .select();

    if (error) throw error;

    // Create notifications for assigned students
    try {
      const notifications = newAssignments.map(student_id => ({
        user_id: student_id,
        type: "practical_assigned", // Corrected type to match frontend
        title: "New Practical Assigned",
        message: `You have been assigned practical: ${practical.title}`,
        link: `/editor?practicalId=${practical_id}`,
        metadata: { practical_id, subject_id: practical.subject_id }
      }));

      await supabaseAdmin.from("notifications").insert(notifications);
    } catch (notifyErr) {
      console.error("Error creating notifications:", notifyErr);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Assigned practical to ${newAssignments.length} student(s)${existingStudentIds.length > 0 ? ` (${existingStudentIds.length} were already assigned)` : ""
        }`
    }, { status: 201 });
  } catch (err: any) {
    console.error("Error assigning practical:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** GET: get assignments for a practical */
export async function GET(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isFacultyOrAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: faculty/admin only" }, { status: 403 });
    }

    const url = new URL(request.url);
    const practicalId = url.searchParams.get("practical_id");

    if (!practicalId) {
      return NextResponse.json({ success: false, error: "Missing practical_id parameter" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("student_practicals")
      .select(`
        id,
        assigned_deadline,
        status,
        notes,
        assigned_at,
        users!student_id (
          uid,
          name,
          email
        )
      `)
      .eq("practical_id", practicalId)
      .order("assigned_at", { ascending: false });

    if (error) throw error;

    const assignments = data.map((assignment: any) => ({
      id: assignment.id,
      student_id: assignment.users?.uid,
      student_name: assignment.users?.name,
      student_email: assignment.users?.email,
      assigned_deadline: assignment.assigned_deadline,
      status: assignment.status,
      notes: assignment.notes,
      assigned_at: assignment.assigned_at,
    }));

    return NextResponse.json({ success: true, data: assignments });
  } catch (err: any) {
    console.error("Error fetching assignments:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

/** DELETE: remove assignment */
export async function DELETE(request: Request) {
  try {
    const supabaseServerClient = await createServerClient();
    if (!(await isFacultyOrAdmin(supabaseServerClient))) {
      return NextResponse.json({ success: false, error: "Forbidden: faculty/admin only" }, { status: 403 });
    }

    const url = new URL(request.url);
    const assignmentId = url.searchParams.get("assignment_id");

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: "Missing assignment_id parameter" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("student_practicals")
      .delete()
      .eq("id", assignmentId)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Error deleting assignment:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}
