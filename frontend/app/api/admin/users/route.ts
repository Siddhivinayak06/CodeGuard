import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

// Helper: check if current user is admin
async function isAdminUsingCookieClient(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: userData } = await (supabase as any).auth.getUser();
    if (!userData?.user) return false;

    const user = userData.user;
    const { data: row } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("uid", user.id)
      .maybeSingle();

    return row?.role === "admin";
  } catch (err) {
    console.error("Admin check failed:", err);
    return false;
  }
}

// ---------------------------
// GET: list all users with student_details
// ---------------------------
export async function GET() {
  const isAdmin = await isAdminUsingCookieClient();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(`
        uid, name, email, role, created_at, updated_at,
        student_details(roll_no, semester)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten student_details to top level for frontend convenience
    const formatted = data.map((u: any) => ({
      ...u,
      roll_no: u.student_details?.roll_no ?? "",
      semester: u.student_details?.semester ?? "",
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error("GET /api/admin/users error:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

// ---------------------------
// POST: create new user
// ---------------------------
export async function POST(req: NextRequest) {
  const isAdmin = await isAdminUsingCookieClient();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { email, password, name, role = "student", roll_no, semester } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Missing email or password" }, { status: 400 });
    }
    if (!["student", "faculty", "admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    // Create Auth user
    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { role, name },
    });
    if (createErr) throw createErr;

    const uid = createData.user?.id;
    if (!uid) return NextResponse.json({ success: false, error: "Failed to get UID" }, { status: 500 });

    // Insert into users table
    const profile = { uid, name: name ?? email.split("@")[0], email, role };
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("users")
      .insert([profile])
      .select()
      .single();
    if (insertErr) throw insertErr;

    // Insert student_details if student
    let studentDetails = null;
    if (role === "student") {
      const { data: sd, error: sdErr } = await supabaseAdmin
        .from("student_details")
        .upsert(
          { student_id: uid, roll_no: roll_no ?? null, semester: semester ?? null },
          { onConflict: "student_id" }
        )
        .select()
        .single();
      if (sdErr) console.error("student_details insert failed:", sdErr);
      studentDetails = sd ?? null;
    }

    return NextResponse.json({
      success: true,
      data: { ...inserted, roll_no: studentDetails?.roll_no ?? "", semester: studentDetails?.semester ?? "" },
    }, { status: 201 });

  } catch (err: any) {
    console.error("POST /api/admin/users error:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

// ---------------------------
// PUT: update user by ID
// ---------------------------
export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const isAdmin = await isAdminUsingCookieClient();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { id } = context.params;
    if (!id) return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });

    const body = await req.json();
    const { name, role, roll_no, semester } = body;

    // Update users table
    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ name, role })
      .eq("uid", id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    // Update student_details if role is student
    let studentDetails = null;
    if (role === "student") {
      const { data: sd, error: sdErr } = await supabaseAdmin
        .from("student_details")
        .upsert({ student_id: id, roll_no, semester }, { onConflict: "student_id" })
        .select()
        .single();
      if (sdErr) console.error("student_details upsert failed:", sdErr);
      studentDetails = sd ?? null;
    }

    return NextResponse.json({
      success: true,
      data: { ...updatedUser, roll_no: studentDetails?.roll_no ?? "", semester: studentDetails?.semester ?? "" },
    });
  } catch (err: any) {
    console.error("PUT /api/admin/users/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

// ---------------------------
// DELETE: remove user by ID
// ---------------------------
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const isAdmin = await isAdminUsingCookieClient();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { id } = context.params;
    if (!id) return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });

    // Delete user and student_details
    const { error: delErr } = await supabaseAdmin.from("users").delete().eq("uid", id);
    if (delErr) throw delErr;

    await supabaseAdmin.from("student_details").delete().eq("student_id", id);

    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (err: any) {
    console.error("DELETE /api/admin/users/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}
