import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

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

    // Check if submission already exists
    const { data: existingSubmission } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", student_id)
      .eq("practical_id", practical_id)
      .single();

    if (existingSubmission) {
      const existingMarks = existingSubmission.marks_obtained ?? 0;
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
          .update(updateData)
          .eq("id", existingSubmission.id)
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
      })
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
