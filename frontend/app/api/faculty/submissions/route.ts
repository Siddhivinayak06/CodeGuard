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

const PASS_STATUSES = new Set([
  "passed",
  "completed",
  "accepted",
  "excellent",
  "very_good",
  "good",
]);

const FAIL_STATUSES = new Set([
  "failed",
  "poor",
  "needs_improvement",
  "compile_error",
  "runtime_error",
  "timeout",
  "time_limit_exceeded",
  "memory_limit_exceeded",
]);

const normalizeSubmissionStatus = (status: string | null | undefined) =>
  String(status || "pending").toLowerCase();

const toEpoch = (value?: string | null) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const submissionRank = (status: string | null | undefined) => {
  const normalized = normalizeSubmissionStatus(status);
  if (PASS_STATUSES.has(normalized)) return 3;
  if (normalized === "pending" || normalized === "submitted") return 2;
  if (FAIL_STATUSES.has(normalized)) return 1;
  return 0;
};

const pickBetterSubmission = (a: any, b: any) => {
  const aRank = submissionRank(a?.status);
  const bRank = submissionRank(b?.status);

  if (aRank !== bRank) return bRank > aRank ? b : a;

  const aMarks = Number(a?.marks_obtained || 0);
  const bMarks = Number(b?.marks_obtained || 0);
  if (aMarks !== bMarks) return bMarks > aMarks ? b : a;

  const aTs = Math.max(toEpoch(a?.updated_at), toEpoch(a?.created_at));
  const bTs = Math.max(toEpoch(b?.updated_at), toEpoch(b?.created_at));
  return bTs >= aTs ? b : a;
};

const collapseSubmissionAttempts = (rows: any[]) => {
  const byStudentPractical = new Map<string, any[]>();

  for (const row of rows) {
    const studentId = String(row?.student_id || "");
    const practicalId = Number(row?.practical_id || 0);
    if (!studentId || !Number.isFinite(practicalId) || practicalId <= 0) continue;

    const key = `${studentId}_${practicalId}`;
    if (!byStudentPractical.has(key)) {
      byStudentPractical.set(key, []);
    }
    byStudentPractical.get(key)!.push(row);
  }

  const collapsed: any[] = [];

  for (const [, groupRows] of byStudentPractical.entries()) {
    const hasLeveledRows = groupRows.some(
      (row) => row?.level_id !== null && row?.level_id !== undefined,
    );

    const byLevel = new Map<string, any>();
    for (const row of groupRows) {
      if (hasLeveledRows && (row?.level_id === null || row?.level_id === undefined)) {
        continue;
      }

      const levelKey =
        row?.level_id === null || row?.level_id === undefined
          ? "__single__"
          : String(row.level_id);
      const existing = byLevel.get(levelKey);
      if (!existing) {
        byLevel.set(levelKey, row);
        continue;
      }
      byLevel.set(levelKey, pickBetterSubmission(existing, row));
    }

    collapsed.push(...byLevel.values());
  }

  collapsed.sort((a, b) => {
    const aTs = Math.max(toEpoch(a?.updated_at), toEpoch(a?.created_at));
    const bTs = Math.max(toEpoch(b?.updated_at), toEpoch(b?.created_at));
    return bTs - aTs;
  });

  return collapsed;
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const scope = await getFacultyScope(supabase);

    if (!scope.ok) {
      return NextResponse.json(
        { success: false, error: scope.error || "Forbidden" },
        { status: scope.status || 403 },
      );
    }

    const subjectIds = scope.subjectIds || [];
    const allowedBatchMap = scope.isAdmin
      ? new Map<number, Set<string>>()
      : buildAllowedBatchMap(scope);

    if (subjectIds.length === 0) {
      return NextResponse.json({
        success: true,
        subjects: [],
        submissions: [],
      });
    }

    const practicalIdParam = req.nextUrl.searchParams.get("practicalId");
    const subjectIdParam = req.nextUrl.searchParams.get("subjectId");

    const practicalId = practicalIdParam ? Number(practicalIdParam) : null;
    const subjectId = subjectIdParam ? Number(subjectIdParam) : null;

    if (practicalId !== null && (!Number.isFinite(practicalId) || practicalId <= 0)) {
      return NextResponse.json(
        { success: false, error: "Invalid practicalId" },
        { status: 400 },
      );
    }

    if (subjectId !== null && (!Number.isFinite(subjectId) || subjectId <= 0)) {
      return NextResponse.json(
        { success: false, error: "Invalid subjectId" },
        { status: 400 },
      );
    }

    if (subjectId !== null && !subjectIds.includes(subjectId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: subject out of scope" },
        { status: 403 },
      );
    }

    const { data: subjectRows, error: subjectErr } = await (supabaseAdmin
      .from("subjects") as any)
      .select("id, subject_name, subject_code, practicals ( id, title )")
      .in("id", subjectIds)
      .order("subject_name", { ascending: true });

    if (subjectErr) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch subjects" },
        { status: 500 },
      );
    }

    const formattedSubjects = (subjectRows || []).map((subject: any) => ({
      id: subject.id,
      subject_name: subject.subject_name,
      subject_code: subject.subject_code,
      practicals: (subject.practicals || []).map((practical: any) => ({
        id: practical.id,
        title: practical.title,
      })),
    }));

    const practicalIdsBySubject = new Map<number, number[]>();
    const allPracticalIds: number[] = [];

    for (const subject of formattedSubjects) {
      const pids = (subject.practicals || [])
        .map((p: any) => Number(p?.id))
        .filter((id: number) => Number.isFinite(id) && id > 0);

      practicalIdsBySubject.set(Number(subject.id), pids);
      allPracticalIds.push(...pids);
    }

    const allScopedPracticalIds = Array.from(new Set(allPracticalIds));

    let targetPracticalIds: number[] = [];
    if (practicalId !== null) {
      if (!allScopedPracticalIds.includes(practicalId)) {
        return NextResponse.json(
          { success: false, error: "Forbidden: practical out of scope" },
          { status: 403 },
        );
      }
      targetPracticalIds = [practicalId];
    } else if (subjectId !== null) {
      targetPracticalIds = practicalIdsBySubject.get(subjectId) || [];
    } else {
      targetPracticalIds = allScopedPracticalIds;
    }

    if (targetPracticalIds.length === 0) {
      return NextResponse.json({
        success: true,
        subjects: formattedSubjects,
        submissions: [],
      });
    }

    const { data: rawSubmissionRows, error: rawSubmissionErr } = await (supabaseAdmin
      .from("submissions") as any)
      .select(
        "id, student_id, practical_id, level_id, language, status, marks_obtained, created_at, updated_at, practicals ( title, subject_id ), practical_levels ( title, max_marks )",
      )
      .in("practical_id", targetPracticalIds)
      .order("created_at", { ascending: false });

    if (rawSubmissionErr) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch submissions" },
        { status: 500 },
      );
    }

    const collapsedRows = collapseSubmissionAttempts(rawSubmissionRows || []);

    const candidateStudentIds = Array.from(
      new Set(
        collapsedRows
          .map((row: any) => String(row?.student_id || ""))
          .filter((id: string) => id.length > 0),
      ),
    );

    const candidatePracticalIds = Array.from(
      new Set(
        collapsedRows
          .map((row: any) => Number(row?.practical_id))
          .filter((id: number) => Number.isFinite(id) && id > 0),
      ),
    );

    const [studentRowsRes, studentPracticalRowsRes, examRowsRes] = await Promise.all([
      candidateStudentIds.length > 0
        ? (supabaseAdmin.from("users") as any)
            .select("uid, name, roll_no, batch")
            .in("uid", candidateStudentIds)
        : Promise.resolve({ data: [], error: null }),
      candidateStudentIds.length > 0 && candidatePracticalIds.length > 0
        ? (supabaseAdmin.from("student_practicals") as any)
            .select("student_id, practical_id, attempt_count, max_attempts")
            .in("student_id", candidateStudentIds)
            .in("practical_id", candidatePracticalIds)
        : Promise.resolve({ data: [], error: null }),
      candidatePracticalIds.length > 0
        ? (supabaseAdmin.from("exams") as any)
            .select("id, practical_id")
            .in("practical_id", candidatePracticalIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentRowsRes?.error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch students" },
        { status: 500 },
      );
    }

    if (studentPracticalRowsRes?.error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch attempt metadata" },
        { status: 500 },
      );
    }

    if (examRowsRes?.error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch exam metadata" },
        { status: 500 },
      );
    }

    const studentMap = new Map(
      ((studentRowsRes?.data as any[]) || []).map((row: any) => [String(row.uid), row]),
    );

    const scopedRows = scope.isAdmin
      ? collapsedRows
      : collapsedRows.filter((row: any) => {
          const subjectIdForRow = Number(row?.practicals?.subject_id || 0);
          const student = studentMap.get(String(row?.student_id || ""));
          return isStudentInScopeBatch(
            subjectIdForRow,
            student?.batch,
            allowedBatchMap,
          );
        });

    const studentIds = Array.from(
      new Set(
        scopedRows
          .map((row: any) => String(row?.student_id || ""))
          .filter((id: string) => id.length > 0),
      ),
    );

    const practicalIds = Array.from(
      new Set(
        scopedRows
          .map((row: any) => Number(row?.practical_id))
          .filter((id: number) => Number.isFinite(id) && id > 0),
      ),
    );

    const studentPracticalMap = new Map(
      ((studentPracticalRowsRes?.data as any[]) || []).map((row: any) => [
        `${row.student_id}_${row.practical_id}`,
        row,
      ]),
    );

    const examRows = (examRowsRes?.data as any[]) || [];
    const examPracticalMap = new Map<string, number>(
      examRows.map((row: any) => [String(row.id), Number(row.practical_id)]),
    );

    let examSetMap = new Map<string, string>();
    if (examRows.length > 0 && studentIds.length > 0) {
      const examIds = examRows
        .map((row: any) => String(row.id))
        .filter((id: string) => id.length > 0);

      if (examIds.length > 0) {
        const { data: sessionRows, error: sessionErr } = await (supabaseAdmin
          .from("exam_sessions") as any)
          .select("student_id, exam_id, assigned_set_id, exam_question_sets ( set_name )")
          .in("exam_id", examIds)
          .in("student_id", studentIds);

        if (!sessionErr) {
          examSetMap = new Map<string, string>(
            ((sessionRows as any[]) || [])
              .map((row: any) => {
                const practicalForExam = examPracticalMap.get(String(row.exam_id));
                const setName = row?.exam_question_sets?.set_name || null;
                if (!practicalForExam || !setName) return null;
                return [`${row.student_id}_${practicalForExam}`, String(setName)] as [
                  string,
                  string,
                ];
              })
              .filter(Boolean) as [string, string][],
          );
        }
      }
    }

    const submissions = scopedRows.map((row: any) => {
      const studentKey = String(row.student_id || "");
      const practicalKey = Number(row.practical_id || 0);
      const student = studentMap.get(studentKey);
      const studentPractical = studentPracticalMap.get(`${studentKey}_${practicalKey}`);

      return {
        id: Number(row.id),
        submission_id: Number(row.id),
        student_id: studentKey,
        student_name: student?.name || "Unknown",
        roll_no: student?.roll_no || "N/A",
        practical_id: practicalKey,
        practical_title: row?.practicals?.title || "Unknown",
        code: "",
        output: "",
        language: String(row.language || ""),
        status: String(row.status || "pending"),
        marks_obtained:
          row.marks_obtained === null || row.marks_obtained === undefined
            ? null
            : Number(row.marks_obtained),
        created_at: row.created_at,
        attempt_count: Number(studentPractical?.attempt_count || 0),
        max_attempts: Number(studentPractical?.max_attempts || 1),
        level_id:
          row.level_id === null || row.level_id === undefined
            ? null
            : Number(row.level_id),
        level_title: row?.practical_levels?.title || null,
        level_max_marks:
          row?.practical_levels?.max_marks === null || row?.practical_levels?.max_marks === undefined
            ? null
            : Number(row.practical_levels.max_marks),
        assigned_set_name: examSetMap.get(`${studentKey}_${practicalKey}`) || null,
      };
    });

    return NextResponse.json({
      success: true,
      subjects: formattedSubjects,
      submissions,
    });
  } catch (err: any) {
    console.error("GET /api/faculty/submissions error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
