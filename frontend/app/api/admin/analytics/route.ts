import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SetWiseRow = {
  setName: string;
  total: number;
  passed: number;
  failed: number;
  pending: number;
};

type SessionBucket = "passed" | "failed" | "pending";

type SessionSubmissionRow = {
  status: string;
  levelId: number | null;
  marks: number | null;
  levelMaxMarks: number;
};

const normalizeStatus = (status: string | null | undefined) =>
  String(status || "pending").toLowerCase();

const isPendingStatus = (status: string) =>
  status === "pending" || status === "submitted";

const bucketFromOverallStatus = (overallStatus: string): SessionBucket => {
  const normalized = normalizeStatus(overallStatus);

  if (isPendingStatus(normalized)) return "pending";

  if (
    [
      "poor",
      "failed",
      "needs_improvement",
      "compile_error",
      "runtime_error",
      "timeout",
    ].includes(normalized)
  ) {
    return "failed";
  }

  if (
    ["excellent", "very_good", "good", "passed", "completed", "accepted"].includes(
      normalized,
    )
  ) {
    return "passed";
  }

  return "pending";
};

// Matches faculty submissions grouping logic.
const computeOverallStatusForRows = (rows: SessionSubmissionRow[]): string => {
  if (!rows.length) return "pending";

  const hasLevels = rows.some((row) => row.levelId !== null && row.levelId !== undefined);

  if (hasLevels) {
    let totalMarks = 0;
    let totalMaxMarks = 0;
    let allGraded = true;

    rows.forEach((row) => {
      totalMaxMarks += Number(row.levelMaxMarks || 10);
      if (row.marks !== null && row.marks !== undefined) {
        totalMarks += Number(row.marks);
      }

      const status = normalizeStatus(row.status);
      if (isPendingStatus(status)) {
        allGraded = false;
      }
    });

    if (!allGraded) return "pending";

    const percentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
    if (percentage >= 90) return "excellent";
    if (percentage >= 75) return "very_good";
    if (percentage >= 60) return "good";
    if (percentage >= 40) return "needs_improvement";
    return "poor";
  }

  return normalizeStatus(rows[0].status);
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { response: authError } = await requireRole(supabase, ["admin"]);
    if (authError) return authError;

    const [studentsRes, facultyRes, adminsRes, subjectsRes, practicalsRes] =
      await Promise.all([
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("role", "faculty"),
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin"),
        supabase.from("subjects").select("*", { count: "exact", head: true }),
        supabase.from("practicals").select("*", { count: "exact", head: true }),
      ]);

    const { data: allSubmissionRows, error: allSubmissionRowsError } = await supabase
      .from("submissions")
      .select("student_id, practical_id, level_id, status, marks_obtained, practical_levels(max_marks)");

    if (allSubmissionRowsError) throw allSubmissionRowsError;

    const groupedSubmissionRows = new Map<string, SessionSubmissionRow[]>();

    (allSubmissionRows as any[] | undefined)?.forEach((submission) => {
      if (!submission.student_id || submission.practical_id === null || submission.practical_id === undefined) {
        return;
      }

      const key = `${submission.student_id}_${submission.practical_id}`;
      if (!groupedSubmissionRows.has(key)) {
        groupedSubmissionRows.set(key, []);
      }

      const practicalLevels = submission.practical_levels;
      const levelMaxMarks =
        practicalLevels && !Array.isArray(practicalLevels)
          ? Number(practicalLevels.max_marks || 10)
          : 10;

      groupedSubmissionRows.get(key)!.push({
        status: normalizeStatus(submission.status),
        levelId:
          submission.level_id === null || submission.level_id === undefined
            ? null
            : Number(submission.level_id),
        marks:
          submission.marks_obtained === null || submission.marks_obtained === undefined
            ? null
            : Number(submission.marks_obtained),
        levelMaxMarks,
      });
    });

    let groupedPassed = 0;
    let groupedFailed = 0;
    let groupedPending = 0;

    groupedSubmissionRows.forEach((rows) => {
      const overallStatus = computeOverallStatusForRows(rows);
      const bucket = bucketFromOverallStatus(overallStatus);

      if (bucket === "passed") groupedPassed++;
      else if (bucket === "failed") groupedFailed++;
      else groupedPending++;
    });

    // Set-wise analytics should count one student exam session per set,
    // with status derived only from set-matched questions.
    let setWiseSubmissions: SetWiseRow[] = [];

    try {
      const { data: examSessions, error: examSessionsError } = await (
        supabase.from("exam_sessions") as any
      )
        .select(
          "student_id, exam_id, assigned_set_id, exams ( practical_id ), exam_question_sets ( set_name, exam_set_levels ( level_id ) )",
        )
        .not("assigned_set_id", "is", null);

      if (examSessionsError) throw examSessionsError;

      const sessionByStudentPractical = new Map<
        string,
        {
          setName: string;
          levelIds: Set<number>;
        }
      >();

      (examSessions as any[] | undefined)?.forEach((session) => {
        const practicalId = session.exams?.practical_id;
        const studentId = session.student_id;
        if (!studentId || practicalId === null || practicalId === undefined) return;

        const setName =
          String(session.exam_question_sets?.set_name || "Unknown Set").trim() ||
          "Unknown Set";

        const levelIds = new Set<number>(
          ((session.exam_question_sets?.exam_set_levels as any[]) || [])
            .map((level) => Number(level?.level_id))
            .filter((levelId) => Number.isFinite(levelId)),
        );

        sessionByStudentPractical.set(`${studentId}_${practicalId}`, {
          setName,
          levelIds,
        });
      });

      const countsBySet = new Map<string, SetWiseRow>();

      sessionByStudentPractical.forEach((sessionMeta, sessionKey) => {
        if (!countsBySet.has(sessionMeta.setName)) {
          countsBySet.set(sessionMeta.setName, {
            setName: sessionMeta.setName,
            total: 0,
            passed: 0,
            failed: 0,
            pending: 0,
          });
        }

        const row = countsBySet.get(sessionMeta.setName)!;
        row.total++;

        const sessionSubmissions = groupedSubmissionRows.get(sessionKey) || [];
        if (sessionSubmissions.length === 0) {
          row.pending++;
          return;
        }

        let consideredSubmissions = sessionSubmissions;

        if (sessionMeta.levelIds.size > 0) {
          const matchedToSet = sessionSubmissions.filter(
            (submission) =>
              submission.levelId !== null && sessionMeta.levelIds.has(submission.levelId),
          );

          // Fallback for legacy rows where level_id might be null.
          if (matchedToSet.length > 0) {
            consideredSubmissions = matchedToSet;
          }
        }

        const overallStatus = computeOverallStatusForRows(consideredSubmissions);
        const bucket = bucketFromOverallStatus(overallStatus);

        if (bucket === "passed") row.passed++;
        else if (bucket === "failed") row.failed++;
        else row.pending++;
      });

      setWiseSubmissions = Array.from(countsBySet.values()).sort(
        (a, b) => b.total - a.total || a.setName.localeCompare(b.setName),
      );
    } catch (setWiseError) {
      console.error("Error building set-wise submission analytics:", setWiseError);
    }

    const totalSubmissions = groupedSubmissionRows.size;
    const totalEvaluated = groupedPassed + groupedFailed;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentSubmissions } = await supabase
      .from("submissions")
      .select("created_at, status")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    const activityByDay: Record<
      string,
      { total: number; evaluated: number; pending: number }
    > = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      activityByDay[dayName] = { total: 0, evaluated: 0, pending: 0 };
    }

    (recentSubmissions as any[] | undefined)?.forEach((submission) => {
      const date = new Date(submission.created_at);
      const dayName = days[date.getDay()];
      if (!activityByDay[dayName]) return;

      const status = normalizeStatus(submission.status);
      activityByDay[dayName].total++;
      if (isPendingStatus(status)) activityByDay[dayName].pending++;
      else activityByDay[dayName].evaluated++;
    });

    const activityData = Object.entries(activityByDay).map(([day, values]) => ({
      day,
      ...values,
    }));

    const { data: allSubjects } = await supabase
      .from("subjects")
      .select("id, subject_name, subject_code")
      .limit(10);

    const { data: allPracticals } = await supabase
      .from("practicals")
      .select("subject_id");

    const practicalCounts: Record<number, number> = {};
    (allPracticals as any[] | undefined)?.forEach((practical) => {
      if (!practical.subject_id) return;
      practicalCounts[practical.subject_id] =
        (practicalCounts[practical.subject_id] || 0) + 1;
    });

    const subjectsWithPracticals =
      (allSubjects as any[] | undefined)?.map((subject) => ({
        id: subject.id,
        name: subject.subject_name,
        code: subject.subject_code,
        practicalCount: practicalCounts[subject.id] || 0,
      })) || [];

    const studentSubmissionCounts: Record<string, number> = {};
    groupedSubmissionRows.forEach((_, sessionKey) => {
      const [studentId] = sessionKey.split("_");
      if (!studentId) return;
      studentSubmissionCounts[studentId] = (studentSubmissionCounts[studentId] || 0) + 1;
    });

    const topStudentIds = Object.entries(studentSubmissionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topStudentsList: Array<{
      id: string;
      name: string;
      email: string;
      count: number;
    }> = [];

    if (topStudentIds.length > 0) {
      const { data: studentUsers } = await supabase
        .from("users")
        .select("uid, name, email")
        .in("uid", topStudentIds);

      topStudentsList = topStudentIds.map((id) => {
        const user = (studentUsers as any[] | undefined)?.find((u) => u.uid === id);
        return {
          id,
          name: user?.name || "Unknown",
          email: user?.email || "",
          count: studentSubmissionCounts[id] || 0,
        };
      });
    }

    const successRate =
      totalEvaluated > 0 ? Math.round((groupedPassed / totalEvaluated) * 100) : 0;

    return NextResponse.json({
      overview: {
        students: studentsRes.count ?? 0,
        faculty: facultyRes.count ?? 0,
        admins: adminsRes.count ?? 0,
        subjects: subjectsRes.count ?? 0,
        practicals: practicalsRes.count ?? 0,
        totalSubmissions,
      },
      submissions: {
        submitted: totalSubmissions,
        evaluated: totalEvaluated,
        pending: groupedPending,
        accepted: groupedPassed,
        failed: groupedFailed,
        successRate,
      },
      activityData,
      setWiseSubmissions,
      subjectsWithPracticals,
      topStudents: topStudentsList,
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics", details: String(err) },
      { status: 500 },
    );
  }
}
