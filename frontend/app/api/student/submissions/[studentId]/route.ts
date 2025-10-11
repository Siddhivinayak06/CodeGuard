// GET submissions for a student including code and output
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function GET(
  req: Request,
  { params }: { params: { studentId: string } }
) {
  const { studentId } = params;

  try {
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select(`
        id,
        code,
        output,
        language,
        status,
        created_at,
        practicals ( title )
      `)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = data.map((s) => ({
      id: s.id,
      practical_title: s.practicals?.title || "Unknown",
      code: s.code,
      output: s.output,
      language: s.language,
      status: s.status,
      created_at: s.created_at,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching submissions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
