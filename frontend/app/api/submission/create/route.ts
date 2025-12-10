import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function POST(req: Request) {
  try {
    const { student_id, practical_id, code, language, status = "pending", marks_obtained = 0 } = await req.json();

    if (!student_id || !practical_id || !code || !language) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if submission already exists
    const { data: existingSubmission } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("student_id", student_id)
      .eq("practical_id", practical_id)
      .single();

    if (existingSubmission) {
      // Return existing submission without modifying it (preserves marks)
      return NextResponse.json({ submission: existingSubmission });
    }

    // Insert new submission if none exists
    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .insert({
        student_id,
        practical_id,
        code,
        language,
        status,
        output: "",
        marks_obtained: marks_obtained || 0,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ submission });
  } catch (err) {
    console.error("Server error in submission/create:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
