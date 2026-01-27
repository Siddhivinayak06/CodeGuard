import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Admin check helper
async function isAdminUser(supabase: any): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return false;

    const user = userData.user;
    const { data: row } = await supabase
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
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const isAdmin = await isAdminUser(supabase);
  if (!isAdmin)
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );

  try {
    const { id } = await params;
    if (!id)
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 },
      );

    const body = await req.json();
    const { name, role, roll_no, semester } = body;

    // Update users table
    const { data: updatedUser, error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ name, role, roll_no, semester })
      .eq("uid", id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (err: any) {
    console.error("PUT /api/admin/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

// ---------------------------
// DELETE: remove user by ID
// ---------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const isAdmin = await isAdminUser(supabase);
  if (!isAdmin)
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );

  try {
    const { id } = await params;
    if (!id)
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 },
      );

    // Delete user from users table
    const { error: delErr } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("uid", id);
    if (delErr) throw delErr;

    // Also delete from auth (optional - uncomment if needed)
    // await supabaseAdmin.auth.admin.deleteUser(id);

    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (err: any) {
    console.error("DELETE /api/admin/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
