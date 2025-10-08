// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service"; // your admin Supabase client

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const { email, role, name } = body; // adapt fields according to your table

    // Update user in Supabase
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ email, role, name })
      .eq("uid", userId)
      .select() // return updated row

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User updated successfully", user: data[0] });
  } catch (err: any) {
    console.error("PUT /api/admin/users/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
