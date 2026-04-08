import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Allowed status values (must match DB check constraint)
const VALID_STATUSES = ["pending", "passed", "failed"];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      user,
      role,
      response: authError,
    } = await requireAuth(supabase);
    if (authError) return authError;

    const {
      submissionId,
      status,
      output,
      marks_obtained,
      execution_details,
      code,
    } = await req.json();

    const submissionIdNum = Number(submissionId);
    const incomingStatus =
      status === undefined || status === null
        ? undefined
        : String(status).toLowerCase();
    const hasIncomingMarks =
      marks_obtained !== undefined && marks_obtained !== null;
    const incomingMarks = hasIncomingMarks ? Number(marks_obtained) : null;

    if (!submissionIdNum || !Number.isFinite(submissionIdNum) || submissionIdNum <= 0) {
      return NextResponse.json(
        { error: "Invalid submissionId" },
        { status: 400 },
      );
    }

    if (incomingStatus && !VALID_STATUSES.includes(incomingStatus)) {
      return NextResponse.json(
        { error: `Invalid status value: ${status}` },
        { status: 400 },
      );
    }

    if (
      hasIncomingMarks &&
      (incomingMarks === null || !Number.isFinite(incomingMarks))
    ) {
      return NextResponse.json(
        { error: "Invalid marks_obtained value" },
        { status: 400 },
      );
    }

    // Fetch existing submission to compare marks
    const { data: existingRows, error: fetchError } = await supabase
      .from("submissions")
      .select("id, student_id, marks_obtained, status, output, code, execution_details, updated_at")
      .eq("id", submissionIdNum)
      .limit(1);

    const existingSubmission = (existingRows as any[] | null)?.[0] || null;

    if (fetchError || !existingSubmission) {
      console.error("Failed to fetch existing submission:", fetchError);
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    if (
      existingSubmission.student_id !== user.id &&
      !["faculty", "admin"].includes(role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: cannot update another user's submission" },
        { status: 403 },
      );
    }

    const existingMarks = (existingSubmission as any).marks_obtained ?? 0;
    const newMarks = hasIncomingMarks ? (incomingMarks as number) : existingMarks;

    // Keep best submission immutable against lower-score regressions.
    const shouldUpdateCode = newMarks >= existingMarks;

    if (hasIncomingMarks && !shouldUpdateCode) {
      return NextResponse.json({
        success: true,
        submission: existingSubmission,
        keptHigherMarks: true,
        previousMarks: existingMarks,
        newMarks,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (incomingStatus) updateData.status = incomingStatus;
    if (output !== undefined) updateData.output = output ?? "";
    if (execution_details !== undefined)
      updateData.execution_details = execution_details;

    if (shouldUpdateCode) {
      if (hasIncomingMarks)
        updateData.marks_obtained = newMarks;
      if (code !== undefined) updateData.code = code;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        submission: existingSubmission,
        keptHigherMarks: !shouldUpdateCode,
        previousMarks: existingMarks,
        newMarks,
      });
    }

    const { data, error } = await supabase
      .from("submissions")
      .update(updateData as never)
      .eq("id", submissionIdNum)
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
