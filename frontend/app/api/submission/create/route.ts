import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { response: authError } = await requireAuth(supabase);
    if (authError) return authError;

    const {
      student_id,
      practical_id,
      code,
      language,
      status = "pending",
      marks_obtained = 0,
      execution_details,
    } = await req.json();

    if (!student_id || !practical_id || !code || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify attempt limit has not been exceeded
    const { data: spRecord, error: spError } = (await supabase
      .from("student_practicals")
      .select("attempt_count, max_attempts, is_locked, lock_reason")
      .eq("student_id", student_id)
      .eq("practical_id", practical_id)
      .single()) as any;

    if (spError || !spRecord) {
      console.error("Failed to fetch student_practicals:", spError);
      return NextResponse.json(
        { error: "Practical allocation not found" },
        { status: 404 },
      );
    }

    if (spRecord.is_locked) {
      return NextResponse.json(
        { error: spRecord.lock_reason || "Session locked by faculty" },
        { status: 403 },
      );
    }

    const attempts = spRecord.attempt_count || 0;
    const maxAttempts = spRecord.max_attempts || 1;

    if (attempts > maxAttempts) {
      return NextResponse.json(
        { error: "Attempt limit exceeded" },
        { status: 403 },
      );
    }

    // Deadline check for exams
    const { data: examData } = (await supabase
      .from("exams")
      .select("end_time")
      .eq("practical_id", practical_id)
      .maybeSingle()) as any;

    if (examData?.end_time) {
      const now = new Date();
      const endTime = new Date(examData.end_time);
      // 5-min grace
      if (now.getTime() > endTime.getTime() + 300000) {
        return NextResponse.json({ error: "Exam submission window has closed" }, { status: 403 });
      }
    }

    // Check if submission already exists
    const { data: existingSubmission } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", student_id)
      .eq("practical_id", practical_id)
      .single();

    if (existingSubmission) {
      const existingMarks = (existingSubmission as any).marks_obtained ?? 0;
      const newMarks = marks_obtained ?? 0;

      // Compare marks: only update code and marks if new submission is better or equal
      const shouldUpdateCode = newMarks >= existingMarks;

      const updateData: Record<string, unknown> = {
        language,
        status,
      };

      if (shouldUpdateCode) {
        // New submission is better - update everything
        updateData.code = code;
        updateData.marks_obtained = marks_obtained;
        if (execution_details !== undefined)
          updateData.execution_details = execution_details;
      } else {
        // Keep existing code and marks, but still track this attempt
        console.log(
          `Keeping existing submission (${existingMarks} marks) as it has higher marks than new attempt (${newMarks} marks)`,
        );
        // Don't update code, marks, or execution_details - keep the better submission
      }

      const { data: updatedSubmission, error: updateError } =
        await supabase
          .from("submissions")
          .update(updateData as never)
          .eq("id", (existingSubmission as any).id)
          .select("*")
          .single();

      if (updateError) {
        console.error(
          "Supabase update error during create/upsert:",
          updateError,
        );
        return NextResponse.json({ error: updateError }, { status: 500 });
      }

      return NextResponse.json({
        submission: updatedSubmission,
        keptHigherMarks: !shouldUpdateCode,
        previousMarks: existingMarks,
        newMarks: newMarks,
      });
    }

    // Insert new submission if none exists
    const { data: submission, error } = await supabase
      .from("submissions")
      .insert({
        student_id,
        practical_id,
        code,
        language,
        status,
        output: "",
        marks_obtained: marks_obtained || 0,
        execution_details: execution_details || null,
      } as never)
      .select("*")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ submission });
  } catch (err) {
    console.error("Server error in submission/create:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
