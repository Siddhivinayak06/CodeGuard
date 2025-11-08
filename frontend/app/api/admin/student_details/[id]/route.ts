import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } } // destructure here
) {
  const studentId = params.id;

  if (!studentId) {
    return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { roll_no, semester } = body;

    const { error } = await supabaseAdmin
      .from("student_details")
      .upsert(
        { student_id: studentId, roll_no, semester },
        { onConflict: "student_id" }
      );

    if (error) {
      console.error("Supabase student_details upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Student details updated successfully" });
  } catch (err: any) {
    console.error("PUT /api/admin/student_details/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
