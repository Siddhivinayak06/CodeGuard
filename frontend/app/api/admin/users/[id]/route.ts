import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Admin check helper
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
  } catch {
    return false;
  }
}

// ---------------------------
// PUT: update a single user
// ---------------------------
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isAdmin = await isAdminUsingCookieClient();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
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

    return NextResponse.json({ success: true, data: { ...updatedUser, student_details: studentDetails } });
  } catch (err: any) {
    console.error("PUT /api/admin/users/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}

// ---------------------------
// DELETE: remove user by ID
// ---------------------------
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isAdmin = await isAdminUsingCookieClient();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
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
