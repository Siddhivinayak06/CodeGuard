import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["pending", "passed", "failed"]);

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
      student_id,
      practical_id,
      code,
      language,
      status = "pending",
      marks_obtained = 0,
      execution_details,
      level_id = null,
    } = await req.json();

    const normalizedStudentId = String(student_id || "");
    const practicalIdNum = Number(practical_id);
    const levelIdNum =
      level_id === null || level_id === undefined || level_id === ""
        ? null
        : Number(level_id);
    const normalizedStatus = String(status || "pending").toLowerCase();
    const marksNum = Number(marks_obtained || 0);

    if (!normalizedStudentId || !practicalIdNum || !code || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(practicalIdNum) || practicalIdNum <= 0) {
      return NextResponse.json(
        { error: "Invalid practical_id" },
        { status: 400 },
      );
    }

    if (
      levelIdNum !== null &&
      (!Number.isFinite(levelIdNum) || levelIdNum <= 0)
    ) {
      return NextResponse.json(
        { error: "Invalid level_id" },
        { status: 400 },
      );
    }

    if (!VALID_STATUSES.has(normalizedStatus)) {
      return NextResponse.json(
        { error: `Invalid status value: ${status}` },
        { status: 400 },
      );
    }

    if (normalizedStudentId !== user.id && !["faculty", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: cannot create submission for another user" },
        { status: 403 },
      );
    }

    const [spResult, examResult, levelResult] = await Promise.all([
      (supabase
        .from("student_practicals")
        .select("attempt_count, max_attempts, is_locked, lock_reason, status")
        .eq("student_id", normalizedStudentId)
        .eq("practical_id", practicalIdNum)
        .maybeSingle()) as any,
      (supabase
        .from("exams")
        .select("end_time")
        .eq("practical_id", practicalIdNum)
        .maybeSingle()) as any,
      levelIdNum !== null
        ? (supabase
            .from("practical_levels")
            .select("id")
            .eq("practical_id", practicalIdNum)
            .eq("id", levelIdNum)
            .maybeSingle()) as any
        : Promise.resolve({ data: null, error: null }),
    ]);

    const spRecord = spResult?.data;
    const spError = spResult?.error;

    if (spError || !spRecord) {
      console.error("Failed to fetch student_practicals:", spError);
      return NextResponse.json(
        { error: "Practical allocation not found" },
        { status: 404 },
      );
    }

    if (levelResult?.error) {
      console.error("Failed to validate practical level:", levelResult.error);
      return NextResponse.json(
        { error: "Failed to validate practical level" },
        { status: 500 },
      );
    }

    if (levelIdNum !== null && !levelResult?.data) {
      return NextResponse.json(
        { error: "Invalid level_id for this practical" },
        { status: 400 },
      );
    }

    if (spRecord.is_locked) {
      // For multi-level practicals, skip lock only when the requested level is valid.
      const skipLock = levelIdNum !== null && Boolean(levelResult?.data);

      if (!skipLock) {
        return NextResponse.json(
          { error: spRecord.lock_reason || "Session locked by faculty" },
          { status: 403 },
        );
      }
    }

    const attempts = Number(spRecord.attempt_count || 0);
    const maxAttempts = Number(spRecord.max_attempts || 1);
    const currentStatus = String(spRecord.status || "").toLowerCase();
    const hasActiveAttempt =
      currentStatus === "in_progress" || currentStatus === "overdue";

    if (attempts > maxAttempts) {
      return NextResponse.json(
        { error: "Attempt limit exceeded" },
        { status: 403 },
      );
    }

    if (attempts >= maxAttempts && !hasActiveAttempt) {
      return NextResponse.json(
        { error: "Attempt limit exceeded" },
        { status: 403 },
      );
    }

    // Deadline check for exams
    const examData = examResult?.data;

    if (examResult?.error) {
      console.error("Failed to fetch exam metadata:", examResult.error);
      return NextResponse.json(
        { error: "Failed to validate exam window" },
        { status: 500 },
      );
    }

    if (examData?.end_time) {
      const now = new Date();
      const endTime = new Date(examData.end_time);
      // 5-min grace
      if (now.getTime() > endTime.getTime() + 300000) {
        return NextResponse.json({ error: "Exam submission window has closed" }, { status: 403 });
      }
    }

    // Check if submission already exists (per student + practical + level).
    // We intentionally read latest row only to remain robust if older duplicate
    // rows exist from legacy data.
    let existingQuery = supabase
      .from("submissions")
      .select(
        "id, student_id, practical_id, level_id, marks_obtained, status, language, code, output, execution_details, created_at, updated_at",
      )
      .eq("student_id", normalizedStudentId)
      .eq("practical_id", practicalIdNum);

    if (levelIdNum !== null) {
      existingQuery = existingQuery.eq("level_id", levelIdNum);
    } else {
      existingQuery = existingQuery.is("level_id", null);
    }

    const { data: existingRows, error: existingError } = await existingQuery
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingError) {
      console.error("Failed to fetch existing submission:", existingError);
      return NextResponse.json(
        { error: "Failed to fetch existing submission" },
        { status: 500 },
      );
    }

    const existingSubmission = (existingRows as any[] | null)?.[0] || null;

    if (existingSubmission) {
      const existingMarks = (existingSubmission as any).marks_obtained ?? 0;
      const newMarks = marksNum;

      // Keep the best submission to avoid stale/incorrect regression from lower-score attempts.
      const shouldUpdateCode = newMarks >= existingMarks;

      if (!shouldUpdateCode) {
        return NextResponse.json({
          submission: existingSubmission,
          keptHigherMarks: true,
          previousMarks: existingMarks,
          newMarks,
        });
      }

      const updateData: Record<string, unknown> = {
        language,
        status: normalizedStatus,
        code,
        marks_obtained: newMarks,
      };

      if (execution_details !== undefined)
        updateData.execution_details = execution_details;

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
        keptHigherMarks: false,
        previousMarks: existingMarks,
        newMarks,
      });
    }

    // Insert new submission if none exists
    const { data: submission, error } = await supabase
      .from("submissions")
      .insert({
        student_id: normalizedStudentId,
        practical_id: practicalIdNum,
        code,
        language,
        status: normalizedStatus,
        output: "",
        marks_obtained: marksNum,
        execution_details: execution_details || null,
        level_id: levelIdNum,
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
