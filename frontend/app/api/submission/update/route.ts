import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Allowed status values (must match DB check constraint)
const VALID_STATUSES = ["pending", "passed", "failed"];

export async function POST(req: Request) {
  try {
    const {
      submissionId,
      status,
      output,
      marks_obtained,
      execution_details,
      code,
    } = await req.json();

    if (!submissionId) {
      return NextResponse.json(
        { error: "Missing submissionId" },
        { status: 400 },
      );
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status value: ${status}` },
        { status: 400 },
      );
    }

    // Fetch existing submission to compare marks
    const { data: existingSubmission, error: fetchError } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (fetchError || !existingSubmission) {
      console.error("Failed to fetch existing submission:", fetchError);
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    const existingMarks = existingSubmission.marks_obtained ?? 0;
    const newMarks = marks_obtained ?? 0;

    // Compare marks: only update if new marks are higher or equal
    // If new marks are lower, keep the existing submission data but still update status/output for tracking
    const shouldUpdateCode = newMarks >= existingMarks;

    const updateData: Record<string, unknown> = {};

    // Always update status and output for tracking purposes
    if (status) updateData.status = status;
    if (output !== undefined) updateData.output = output ?? "";
    if (execution_details !== undefined)
      updateData.execution_details = execution_details;

    // Only update marks and code if new submission is better or equal
    if (shouldUpdateCode) {
      if (marks_obtained !== undefined)
        updateData.marks_obtained = marks_obtained;
      if (code !== undefined) updateData.code = code;
    } else {
      // Keep the higher marks from existing submission
      console.log(
        `Keeping existing marks (${existingMarks}) as they are higher than new marks (${newMarks})`,
      );
    }

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

    return NextResponse.json({
      success: true,
      submission: data,
      keptHigherMarks: !shouldUpdateCode,
      previousMarks: existingMarks,
      newMarks: newMarks,
    });
  } catch (err) {
    console.error("Server error in submission/update:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
