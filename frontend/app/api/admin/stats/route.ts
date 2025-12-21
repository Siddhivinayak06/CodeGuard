import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [studentsRes, facultyRes, subjectsRes, practicalsRes] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "student"),
      supabaseAdmin
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "faculty"),
      supabaseAdmin.from("subjects").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("practicals").select("*", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      students: studentsRes.count ?? 0,
      faculty: facultyRes.count ?? 0,
      subjects: subjectsRes.count ?? 0,
      practicals: practicalsRes.count ?? 0,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return NextResponse.json(
      { students: 0, faculty: 0, subjects: 0, practicals: 0 },
      { status: 500 }
    );
  }
}
