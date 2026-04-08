import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type ScopeResult = {
  ok: boolean;
  status?: number;
  error?: string;
  userId?: string;
  isAdmin?: boolean;
  subjectIds?: number[];
  subjectBatchScope?: Record<number, string[]>;
};

const ALL_BATCH_SCOPE = "__all__";

const normalizeBatch = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const buildAllowedBatchMap = (scope: ScopeResult) => {
  const map = new Map<number, Set<string>>();
  const rawScope = scope.subjectBatchScope || {};

  for (const [subjectKey, batches] of Object.entries(rawScope)) {
    const subjectId = Number(subjectKey);
    if (!Number.isFinite(subjectId) || subjectId <= 0) continue;

    const normalizedSet = new Set<string>();
    for (const batch of batches || []) {
      const normalized = normalizeBatch(batch);
      if (!normalized) continue;
      if (normalized === "all") {
        normalizedSet.add(ALL_BATCH_SCOPE);
        break;
      }
      normalizedSet.add(normalized);
    }

    if (normalizedSet.size > 0) {
      map.set(subjectId, normalizedSet);
    }
  }

  return map;
};

const isStudentInScopeBatch = (
  subjectId: number,
  studentBatch: string | null | undefined,
  allowedBatchMap: Map<number, Set<string>>,
) => {
  const allowed = allowedBatchMap.get(subjectId);
  if (!allowed || allowed.size === 0) return false;
  if (allowed.has(ALL_BATCH_SCOPE)) return true;

  const normalizedStudentBatch = normalizeBatch(studentBatch);
  return normalizedStudentBatch.length > 0 && allowed.has(normalizedStudentBatch);
};

async function getFacultyScope(supabase: any): Promise<ScopeResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: callerRow } = await (supabaseAdmin.from("users") as any)
    .select("role")
    .eq("uid", user.id)
    .maybeSingle();

  const callerRole = String(callerRow?.role || "").toLowerCase();
  const isAdmin = callerRole === "admin";
  const isFaculty = callerRole === "faculty";

  if (!isAdmin && !isFaculty) {
    return { ok: false, status: 403, error: "Forbidden: faculty/admin only" };
  }

  if (isAdmin) {
    const { data: allSubjects, error: allSubjectsErr } = await (supabaseAdmin
      .from("subjects") as any)
      .select("id");

    if (allSubjectsErr) {
      return { ok: false, status: 500, error: "Failed to resolve subject scope" };
    }

    const subjectIds = Array.from(
      new Set<number>(
        (allSubjects || [])
          .map((row: any) => Number(row?.id))
          .filter((id: number) => Number.isFinite(id) && id > 0),
      ),
    );

    return { ok: true, userId: user.id, isAdmin: true, subjectIds };
  }

  const { data: assignments, error: assignmentErr } = await (supabaseAdmin
    .from("subject_faculty_batches") as any)
    .select("subject_id, batch")
    .eq("faculty_id", user.id);

  if (assignmentErr) {
    return { ok: false, status: 500, error: "Failed to resolve faculty assignments" };
  }

  const subjectBatchScope: Record<number, string[]> = {};

  for (const row of assignments || []) {
    const subjectId = Number(row?.subject_id);
    if (!Number.isFinite(subjectId) || subjectId <= 0) continue;

    if (!subjectBatchScope[subjectId]) {
      subjectBatchScope[subjectId] = [];
    }

    const batch = String(row?.batch ?? "").trim();
    if (batch.length > 0) {
      subjectBatchScope[subjectId].push(batch);
    }
  }

  const subjectIds = Object.keys(subjectBatchScope)
    .map((key) => Number(key))
    .filter((id) => Number.isFinite(id) && id > 0);

  return {
    ok: true,
    userId: user.id,
    isAdmin: false,
    subjectIds,
    subjectBatchScope,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  try {
    const { submissionId } = await params;
    const parsedSubmissionId = Number(submissionId);

    if (!Number.isFinite(parsedSubmissionId) || parsedSubmissionId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid submission id" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const scope = await getFacultyScope(supabase);
    const allowedBatchMap = scope.isAdmin
      ? new Map<number, Set<string>>()
      : buildAllowedBatchMap(scope);

    if (!scope.ok) {
      return NextResponse.json(
        { success: false, error: scope.error || "Forbidden" },
        { status: scope.status || 403 },
      );
    }

    const { data: submissionRow, error: submissionErr } = await (supabaseAdmin
      .from("submissions") as any)
      .select(
        "id, student_id, practical_id, level_id, code, output, language, status, marks_obtained, created_at, execution_details, practicals ( title, subject_id ), practical_levels ( title, max_marks )",
      )
      .eq("id", parsedSubmissionId)
      .maybeSingle();

    if (submissionErr) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch submission" },
        { status: 500 },
      );
    }

    if (!submissionRow) {
      return NextResponse.json(
        { success: false, error: "Submission not found" },
        { status: 404 },
      );
    }

    const subjectId = Number(submissionRow?.practicals?.subject_id || 0);
    const allowedSubjectIds = scope.subjectIds || [];
    if (!scope.isAdmin && (!subjectId || !allowedSubjectIds.includes(subjectId))) {
      return NextResponse.json(
        { success: false, error: "Forbidden: submission out of scope" },
        { status: 403 },
      );
    }

    const studentId = String(submissionRow.student_id || "");
    const practicalId = Number(submissionRow.practical_id || 0);

    const [studentRes, studentPracticalRes, testCaseRes, examRes] = await Promise.all([
      studentId
        ? (supabaseAdmin.from("users") as any)
            .select("uid, name, roll_no")
            .eq("uid", studentId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      studentId && practicalId
        ? (supabaseAdmin.from("student_practicals") as any)
            .select("attempt_count, max_attempts")
            .eq("student_id", studentId)
            .eq("practical_id", practicalId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      practicalId
        ? (supabaseAdmin.from("test_cases") as any)
            .select("id, practical_id, input, expected_output, is_hidden")
            .eq("practical_id", practicalId)
            .order("id", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      practicalId
        ? (supabaseAdmin.from("exams") as any)
            .select("id")
            .eq("practical_id", practicalId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (studentRes?.error || studentPracticalRes?.error || testCaseRes?.error || examRes?.error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch submission detail metadata" },
        { status: 500 },
      );
    }

    if (
      !scope.isAdmin &&
      !isStudentInScopeBatch(
        subjectId,
        studentRes?.data?.batch,
        allowedBatchMap,
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden: submission out of scope" },
        { status: 403 },
      );
    }

    let assignedSetName: string | null = null;
    const examId = String(examRes?.data?.id || "");

    if (examId && studentId) {
      const { data: sessionRes } = await (supabaseAdmin.from("exam_sessions") as any)
        .select("exam_question_sets ( set_name )")
        .eq("exam_id", examId)
        .eq("student_id", studentId)
        .maybeSingle();

      assignedSetName = sessionRes?.exam_question_sets?.set_name || null;
    }

    const student = studentRes?.data;
    const studentPractical = studentPracticalRes?.data;

    const formattedSubmission = {
      id: Number(submissionRow.id),
      submission_id: Number(submissionRow.id),
      student_id: studentId,
      student_name: student?.name || "Unknown",
      roll_no: student?.roll_no || "N/A",
      practical_id: practicalId,
      practical_title: submissionRow?.practicals?.title || "Unknown",
      attempt_count: Number(studentPractical?.attempt_count || 0),
      max_attempts: Number(studentPractical?.max_attempts || 1),
      code: String(submissionRow.code || ""),
      output: String(submissionRow.output || ""),
      language: String(submissionRow.language || ""),
      status: String(submissionRow.status || "pending"),
      marks_obtained:
        submissionRow.marks_obtained === null || submissionRow.marks_obtained === undefined
          ? null
          : Number(submissionRow.marks_obtained),
      created_at: submissionRow.created_at,
      testCaseResults: submissionRow?.execution_details?.results || [],
      level_id:
        submissionRow.level_id === null || submissionRow.level_id === undefined
          ? null
          : Number(submissionRow.level_id),
      level_title: submissionRow?.practical_levels?.title || null,
      level_max_marks:
        submissionRow?.practical_levels?.max_marks === null ||
        submissionRow?.practical_levels?.max_marks === undefined
          ? null
          : Number(submissionRow.practical_levels.max_marks),
      assigned_set_name: assignedSetName,
    };

    const testCases = ((testCaseRes?.data as any[]) || []).map((tc: any) => ({
      id: Number(tc.id),
      practical_id: Number(tc.practical_id),
      input: String(tc.input || ""),
      expected_output: String(tc.expected_output || ""),
      is_hidden: Boolean(tc.is_hidden),
    }));

    return NextResponse.json({
      success: true,
      submission: formattedSubmission,
      testCases,
    });
  } catch (err: any) {
    console.error("GET /api/faculty/submissions/[submissionId] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
