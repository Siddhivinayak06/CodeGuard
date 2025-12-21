import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = 'force-dynamic';

// Allowed status values (must match DB check constraint)
const VALID_STATUSES = ["pending", "passed", "failed"];

export async function POST(req: Request) {
  try {
    const { submissionId, status, output, marks_obtained } = await req.json();

    if (!submissionId) {
      return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status value: ${status}` }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (output !== undefined) updateData.output = output ?? "";
    if (marks_obtained !== undefined) updateData.marks_obtained = marks_obtained;

    const { data, error } = await supabaseAdmin
      .from("submissions")
      .update(updateData)
      .eq("id", submissionId)
      .select("*")
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (err) {
    console.error("Server error in submission/update:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
