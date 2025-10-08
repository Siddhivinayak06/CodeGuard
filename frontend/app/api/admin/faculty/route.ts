// app/api/admin/faculty/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("uid, name, email, role")
      .eq("role", "faculty")
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching faculty:", err);
    return NextResponse.json({ success: false, error: err.message ?? "Server error" }, { status: 500 });
  }
}
