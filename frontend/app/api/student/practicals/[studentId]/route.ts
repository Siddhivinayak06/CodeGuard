import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service"; // ✅ service client

export async function GET(
  req: Request,
  { params }: { params: { studentId: string } }
) {
  const { studentId } = params;

  try {
    const { data, error } = await supabaseAdmin
      .from("practicals")
      .select(`
        id,
        title,
        deadline,
        subject_id,
        subjects ( subject_name )
      `)
      .order("deadline", { ascending: true });

    if (error) throw error;

    const formatted = data.map((p) => ({
      id: p.id,
      title: p.title,
      subject_id: p.subject_id,
      subject_name: p.subjects?.subject_name || "Unknown", // ✅ correct field
      deadline: p.deadline,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching practicals:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
