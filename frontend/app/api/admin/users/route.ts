// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server"; // cookie-aware server client
import { supabaseAdmin } from "@/lib/supabase/service"; // service-role client (must exist)
 
// Helper: check if the currently-signed-in user (from cookies) is admin
async function isAdminUsingCookieClient() {
  try {
    const supabase = await createServerClient();
    // cookie-authenticated client: get current user
    const { data: userData, error: userErr } = await (supabase as any).auth.getUser();
    if (userErr) {
      console.error("Error getting user from cookie client:", userErr);
      return false;
    }
    const user = userData?.user;
    if (!user?.id) return false;

    // lookup role with service-role client (bypass RLS safely)
    const { data: row, error } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("uid", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking role in users table:", error);
      return false;
    }
    return row?.role === "admin";
  } catch (err) {
    console.error("Unexpected error in isAdminUsingCookieClient:", err);
    return false;
  }
}
 
// GET -> list users (admin only)
export async function GET() {
  try {
    const isAdmin = await isAdminUsingCookieClient();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("uid, name, email, role, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing users:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/admin/users unexpected error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}
 
// POST -> create a new user (admin only)
export async function POST(request: Request) {
  try {
    const isAdmin = await isAdminUsingCookieClient();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { email, password, role = "student", name } = body ?? {};

    // Basic validation
    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Missing email or password" }, { status: 400 });
    }
    if (!["student", "faculty", "admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    // Create auth user using service-role client
    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { role, name },
    });

    if (createErr) {
      console.error("Error creating auth user:", createErr);
      return NextResponse.json({ success: false, error: createErr.message }, { status: 500 });
    }

    // create row in `users` table (uid references auth.users(id))
    const uid = createData?.user?.id;
    if (!uid) {
      console.warn("createUser returned no uid in data:", createData);
      return NextResponse.json({ success: true, data: createData }); // created but no uid? return whatever we have
    }

    const profile = {
      uid,
      name: name ?? (email.split("@")[0] || "User"),
      email,
      role,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("users")
      .insert([profile])
      .select()
      .single();

    if (insertErr) {
      // If profile creation fails, it's still useful to inform but the auth user exists.
      console.error("Created auth user but failed to insert into users table:", insertErr);
      return NextResponse.json({
        success: true,
        data: { authUser: createData?.user, profileInsertError: insertErr.message },
      }, { status: 201 });
    }

    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/users unexpected error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}
