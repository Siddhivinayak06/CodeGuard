import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = 'force-dynamic';

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
      // Update existing submission with new code (UPSERT behavior)
      const { data: updatedSubmission, error: updateError } = await supabaseAdmin
        .from("submissions")
        .update({
          code,
          language,
          status, // e.g. "pending"
          marks_obtained: marks_obtained || existingSubmission.marks_obtained,
        })
        .eq("id", existingSubmission.id)
        .select("*")
        .single();

      if (updateError) {
        console.error("Supabase update error during create/upsert:", updateError);
        return NextResponse.json({ error: updateError }, { status: 500 });
      }

      return NextResponse.json({ submission: updatedSubmission });
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
