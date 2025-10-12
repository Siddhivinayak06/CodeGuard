import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function POST(req: Request) {
  try {
    const { student_id, practical_id, code, language, status = "submitted", marks_obtained = 0 } = await req.json();

    if (!student_id || !practical_id || !code || !language) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Upsert submission: if student already has submission for this practical, update code
    const { data: submission, error } = await supabaseAdmin
      .from("submissions")
      .upsert(
        {
          student_id,
          practical_id,
          code,
          language,
          status,
          output: "",
          marks_obtained,
        },
        { onConflict: "student_id,practical_id", ignoreDuplicates: false }
      )
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
