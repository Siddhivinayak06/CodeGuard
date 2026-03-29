import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { response: authError } = await requireRole(supabase, ["admin"]);
    if (authError) return authError;

    const [studentsRes, facultyRes, subjectsRes, practicalsRes, examsRes] =
      await Promise.all([
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("role", "faculty"),
        supabase
          .from("subjects")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("practicals")
          .select("*", { count: "exact", head: true })
          .or("is_exam.eq.false,is_exam.is.null"),
        supabase
          .from("practicals")
          .select("*", { count: "exact", head: true })
          .eq("is_exam", true),
      ]);

    return NextResponse.json({
      students: studentsRes.count ?? 0,
      faculty: facultyRes.count ?? 0,
      subjects: subjectsRes.count ?? 0,
      practicals: practicalsRes.count ?? 0,
      exams: examsRes.count ?? 0,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return NextResponse.json(
      { students: 0, faculty: 0, subjects: 0, practicals: 0, exams: 0 },
      { status: 500 },
    );
  }
}
