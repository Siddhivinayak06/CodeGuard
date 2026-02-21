import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Check if current user is faculty or admin */
async function isFacultyOrAdmin(supabase: any) {
  try {
    const { data: userData, error: userErr } =
      await supabase.auth.getUser();
    if (userErr) {
      console.error("Error getting user:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user) return false;

    // Check users table for role
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
    return row?.role === "faculty" || row?.role === "admin";
  } catch (err) {
    console.error("Unexpected error checking faculty/admin:", err);
    return false;
  }
}

/** POST: assign a practical to specific students */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isFacultyOrAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    console.log("[Assign Debug] Received body:", body);
    const { practical_id, student_ids, assigned_deadline, notes } = body;

    if (
      !practical_id ||
      !student_ids ||
      !Array.isArray(student_ids) ||
      student_ids.length === 0
    ) {
      console.log("[Assign Debug] Missing fields. practical_id:", practical_id, "students:", student_ids);
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields (practical_id, student_ids array).",
        },
        { status: 400 },
      );
    }

    // Check if practical exists
    console.log("[Assign Debug] Checking practical permission for ID:", practical_id);
    const { data: practical, error: practicalError } = await supabase
      .from("practicals")
      .select("id, title, subject_id, language")
      .eq("id", practical_id)
      .single<any>();

    if (practicalError || !practical) {
      console.error("[Assign Debug] Practical query error:", practicalError);
      return NextResponse.json(
        { success: false, error: "Practical not found" },
        { status: 404 },
      );
    }

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // Check if user is faculty for this subject or admin
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { data: userRole } = await supabase
      .from("users")
      .select("role")
      .eq("uid", userId)
      .single();

    // Check if faculty teaches this subject via subject_faculty_batches junction table
    let hasFacultyAccess = false;
    if ((userRole as any)?.role === "admin") {
      hasFacultyAccess = true;
    } else if ((userRole as any)?.role === "faculty") {
      const { data: facultySubject } = await supabase
        .from("subject_faculty_batches")
        .select("id")
        .eq("faculty_id", userId)
        .eq("subject_id", practical.subject_id)
        .limit(1)
        .maybeSingle();

      hasFacultyAccess = !!facultySubject;
    }

    if (!hasFacultyAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only assign practicals for subjects you teach",
        },
        { status: 403 },
      );
    }

    // Validate student_ids exist and are students
    const { data: validStudents, error: studentsError } = await supabase
      .from("users")
      .select("uid")
      .in("uid", student_ids)
      .eq("role", "student");

    if (studentsError) throw studentsError;

    const validStudentIds = (validStudents as any[])?.map((s) => s.uid) || [];
    const invalidIds = student_ids.filter(
      (id) => !validStudentIds.includes(id),
    );

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid student IDs: ${invalidIds.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Check for existing assignments to avoid duplicates
    const { data: existingAssignments } = await supabase
      .from("student_practicals")
      .select("student_id")
      .eq("practical_id", practical_id)
      .in("student_id", student_ids);

    const existingStudentIds =
      (existingAssignments as any[])?.map((a) => a.student_id) || [];
    const newAssignments = student_ids.filter(
      (id) => !existingStudentIds.includes(id),
    );

    if (newAssignments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "All selected students are already assigned to this practical",
        },
        { status: 400 },
      );
    }

    // Create assignments
    const assignments = newAssignments.map((student_id) => ({
      student_id,
      practical_id,
      assigned_deadline: assigned_deadline || null,
      notes: notes || null,
    }));

    const { data, error } = await supabase
      .from("student_practicals")
      .insert(assignments as any)
      .select();

    if (error) throw error;

    // Create notifications for assigned students
    try {
      const notifications = newAssignments.map((student_id) => ({
        user_id: student_id,
        type: "practical_assigned" as const,
        title: "New Practical Assigned",
        message: `You have been assigned practical: ${practical.title}`,
        link: `/editor?practicalId=${practical_id}${practical.subject_id ? `&subject=${practical.subject_id}` : ""}${practical.language ? `&language=${practical.language}` : ""}`,
        metadata: { practical_id, subject_id: practical.subject_id },
      }));

      await supabase.from("notifications").insert(notifications as any);
    } catch (notifyErr) {
      console.error("Error creating notifications:", notifyErr);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Assigned practical to ${newAssignments.length} student(s)${existingStudentIds.length > 0
          ? ` (${existingStudentIds.length} were already assigned)`
          : ""
          }`,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("Error assigning practical:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** GET: get assignments for a practical */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isFacultyOrAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const practicalId = url.searchParams.get("practical_id");

    if (!practicalId) {
      return NextResponse.json(
        { success: false, error: "Missing practical_id parameter" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("student_practicals")
      .select(
        `
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
      `,
      )
      .eq("practical_id", Number(practicalId))
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
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

/** DELETE: remove assignment */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    if (!(await isFacultyOrAdmin(supabase))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: faculty/admin only" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const assignmentId = url.searchParams.get("assignment_id");

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: "Missing assignment_id parameter" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("student_practicals")
      .delete()
      .eq("id", Number(assignmentId))
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Error deleting assignment:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
