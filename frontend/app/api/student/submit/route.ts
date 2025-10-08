import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Submission payload:", body);

    const { student_id, practical_id, code, language, output, status } = body;

    // Validate required fields
    if (!student_id || !practical_id || !code || !language) {
      console.error("Missing required fields:", { student_id, practical_id, code, language });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Prepare data without subject_id
    const insertData = { student_id, practical_id, code, language, output, status };

    const { data, error } = await supabaseAdmin.from("submissions").insert([insertData]);

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }

    console.log("Submission inserted:", data);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Insert submission error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
