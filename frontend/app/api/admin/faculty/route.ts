// app/api/admin/faculty/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("uid, name, email, role")
      .eq("role", "faculty")
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching faculty:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
