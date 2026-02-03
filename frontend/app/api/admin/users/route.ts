import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Helper: check if current user is admin
async function isAdminUser(supabase: any): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.log("Admin Check: No auth user found");
      return false;
    }

    const user = userData.user;
    console.log("Admin Check: Auth user found:", user.id);

    const { data: row, error } = await supabase
      .from("users")
      .select("role")
      .eq("uid", user.id)
      .maybeSingle();

    if (error) console.error("Admin Check: DB error:", error);
    console.log("Admin Check: DB row:", row);

    return row?.role === "admin";
  } catch (err) {
    console.error("Admin check failed:", err);
    return false;
  }
}

// ---------------------------
// GET: list all users
// ---------------------------
export async function GET() {
  const supabase = await createClient();
  const isAdmin = await isAdminUser(supabase);
  if (!isAdmin)
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        `
        uid, name, email, role, created_at, updated_at,
        roll_no, semester, department, batch
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("GET /api/admin/users error:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

// ---------------------------
// POST: create new user(s) - supports single and bulk creation
// ---------------------------
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const isAdmin = await isAdminUser(supabase);
  if (!isAdmin)
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );

  try {
    const body = await req.json();

    // Check if bulk creation
    if (body.bulk && Array.isArray(body.users)) {
      return handleBulkCreate(body.users);
    }

    // Single user creation
    return handleSingleCreate(body);
  } catch (err: any) {
    console.error("POST /api/admin/users error:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}

// Handle single user creation
async function handleSingleCreate(body: any) {
  const { email, name, role = "student", roll_no, semester, department, batch } = body;

  // Password is optional - generate a secure random one if not provided
  // This is useful for Azure/OAuth users who won't use password login
  let password = body.password;
  if (!password) {
    // Generate a secure random password (user won't need it for Azure login)
    password = crypto.randomUUID() + "Aa1!"; // Meets most password requirements
  }

  if (!email) {
    return NextResponse.json(
      { success: false, error: "Email is required" },
      { status: 400 },
    );
  }
  if (!["student", "faculty", "admin"].includes(role)) {
    return NextResponse.json(
      { success: false, error: "Invalid role" },
      { status: 400 },
    );
  }

  // Create Auth user
  const { data: createData, error: createErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { role, name },
      email_confirm: true, // Auto-confirm for local dev
    });
  if (createErr) {
    // Handle specific error for duplicate email
    if (createErr.code === "email_exists" || createErr.message?.includes("already been registered")) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists" },
        { status: 409 },
      );
    }
    throw createErr;
  }

  const uid = createData.user?.id;
  if (!uid)
    return NextResponse.json(
      { success: false, error: "Failed to get UID" },
      { status: 500 },
    );

  // Insert into users table (use upsert in case trigger already created the row)
  const profile = {
    uid,
    name: name ?? email.split("@")[0],
    email,
    role: role as "student" | "faculty" | "admin",
    roll_no,
    semester,
    department,
    batch,
  };
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("users")
    .upsert(profile, { onConflict: "uid" })
    .select()
    .single();
  if (insertErr) throw insertErr;

  return NextResponse.json(
    {
      success: true,
      data: inserted,
    },
    { status: 201 },
  );
}

// Handle bulk user creation
async function handleBulkCreate(users: any[]) {
  const results: {
    email: string;
    success: boolean;
    error?: string;
    data?: any;
  }[] = [];

  for (const user of users) {
    const { email, name, role = "student", roll_no, semester, department, batch } = user;

    // Password is optional - generate a secure random one if not provided
    let password = user.password;
    if (!password) {
      password = crypto.randomUUID() + "Aa1!";
    }

    // Validate required fields
    if (!email) {
      results.push({
        email: email || "unknown",
        success: false,
        error: "Email is required",
      });
      continue;
    }

    if (!["student", "faculty", "admin"].includes(role)) {
      results.push({
        email,
        success: false,
        error: "Invalid role",
      });
      continue;
    }

    try {
      // Create Auth user
      const { data: createData, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          user_metadata: { role, name },
          email_confirm: true,
        });

      if (createErr) {
        results.push({
          email,
          success: false,
          error: createErr.message || "Auth creation failed",
        });
        continue;
      }

      const uid = createData.user?.id;
      if (!uid) {
        results.push({
          email,
          success: false,
          error: "Failed to get UID after auth creation",
        });
        continue;
      }

      // Insert into users table (use upsert in case trigger already created the row)
      const profile = {
        uid,
        name: name ?? email.split("@")[0],
        email,
        role: role as "student" | "faculty" | "admin",
        roll_no,
        semester,
        department,
        batch,
      };

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("users")
        .upsert(profile, { onConflict: "uid" })
        .select()
        .single();

      if (insertErr) {
        results.push({
          email,
          success: false,
          error: insertErr.message || "Profile creation failed",
        });
        continue;
      }

      results.push({
        email,
        success: true,
        data: inserted,
      });
    } catch (err: any) {
      results.push({
        email,
        success: false,
        error: err.message || "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json(
    {
      success: true,
      bulk: true,
      summary: {
        total: users.length,
        success: successCount,
        failed: failCount,
      },
      results,
    },
    { status: 201 },
  );
}
