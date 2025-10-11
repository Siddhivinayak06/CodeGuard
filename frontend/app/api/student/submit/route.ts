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

    // Ensure status is valid
    const validStatuses = ["submitted", "evaluated", "pending"];
    const submissionStatus = validStatuses.includes(status) ? status : "submitted";

    const insertData = { student_id, practical_id, code, language, output, status: submissionStatus };

    // ✅ Upsert to handle duplicate submissions
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .upsert(insertData, { onConflict: ["student_id", "practical_id"], returning: "representation" })
      .select()
      .single();

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("Submission saved:", data);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("Insert submission error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
