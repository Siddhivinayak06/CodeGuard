// app/api/faculty/subjects/[facultyId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: { facultyId: string } }
) {
  try {
    const supabase = createClient();

    // Ensure facultyId exists
    const facultyId = params?.facultyId;
    if (!facultyId) {
      return NextResponse.json({ error: "Faculty ID is required" }, { status: 400 });
    }

    // Fetch subjects
    const { data, error } = await supabase
      .from("faculty_subjects_view")
      .select("*")
      .eq("faculty_id", facultyId);

    if (error) throw error;

    // Always return an array
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error("Error fetching faculty subjects:", err);
    // Return empty array instead of object to prevent frontend crashes
    return NextResponse.json([], { status: 500 });
  }
}
