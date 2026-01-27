import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const [studentsRes, facultyRes, subjectsRes, practicalsRes] =
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
          .select("*", { count: "exact", head: true }),
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
      { status: 500 },
    );
  }
}
