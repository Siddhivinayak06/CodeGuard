import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ✅ GET /api/student/submissions/:studentId
export async function GET(req: Request, { params }: { params: { studentId: string } }) {
  const supabase = createClient();
  const { studentId } = params;

  try {
    // Fetch all submissions for this student
    const { data, error } = await supabase
      .from("submissions")
      .select(`
        id,
        language,
        status,
        created_at,
        practicals ( title )
      `)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten nested structure (for easier frontend use)
    const formatted = data.map((s) => ({
      id: s.id,
      practical_title: s.practicals?.title || "Unknown",
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
