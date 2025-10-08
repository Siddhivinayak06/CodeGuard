import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function GET(
  req: Request,
  { params }: { params: { practicalId: string } }
) {
  const { practicalId } = params; // ✅ no need to await

  try {
    const { data, error } = await supabaseAdmin
      .from("practicals")
      .select(`
        id,
        title,
        description,
        language,
        deadline,
        subject_id,
        subjects ( subject_name )
      `)
      .eq("id", practicalId)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message || "Supabase error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Practical not found" }, { status: 404 });
    }

    const formatted = {
      id: data.id,
      title: data.title,
      description: data.description,
      language: data.language,
      deadline: data.deadline,
      subject_id: data.subject_id,
      subject_name: data.subjects?.subject_name || "Unknown",
    };

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
