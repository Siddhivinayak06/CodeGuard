import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubmissionSummaryRow = {
  practical_id: number;
  level_id: number | null;
  status: string | null;
  marks_obtained: number | null;
  updated_at?: string | null;
  created_at?: string | null;
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

const submissionRank = (status: string) => {
  const normalized = normalizeSubmissionStatus(status);
  if (PASS_STATUSES.has(normalized)) return 3;
  if (normalized === "pending" || normalized === "submitted") return 2;
  if (FAIL_STATUSES.has(normalized)) return 1;
  return 0;
};

const pickBetterSubmission = (
  a: SubmissionSummaryRow,
  b: SubmissionSummaryRow,
) => {
  const aRank = submissionRank(a.status || "pending");
  const bRank = submissionRank(b.status || "pending");

  if (aRank !== bRank) return bRank > aRank ? b : a;

  const aMarks = Number(a.marks_obtained || 0);
  const bMarks = Number(b.marks_obtained || 0);
  if (aMarks !== bMarks) return bMarks > aMarks ? b : a;

  const aTs = Math.max(toEpoch(a.updated_at), toEpoch(a.created_at));
  const bTs = Math.max(toEpoch(b.updated_at), toEpoch(b.created_at));
  return bTs >= aTs ? b : a;
};

const collapseSubmissionAttempts = (rows: SubmissionSummaryRow[]) => {
  const byLevel = new Map<string, SubmissionSummaryRow>();

  for (const row of rows) {
    const key = row.level_id === null || row.level_id === undefined
      ? "__single__"
      : String(row.level_id);
    const existing = byLevel.get(key);
    if (!existing) {
      byLevel.set(key, row);
      continue;
    }
    byLevel.set(key, pickBetterSubmission(existing, row));
  }

  return Array.from(byLevel.values());
};

/** GET: get assigned exams for the current student via exam_sessions */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = userData.user.id;

    // Verify user is a student
    const { data: userRole, error: roleError } = (await supabase
      .from("users")
      .select("role, batch, semester")
      .eq("uid", userId)
      .single()) as any;

    if (roleError || userRole?.role !== "student") {
      return NextResponse.json(
        { success: false, error: "Access denied: students only" },
        { status: 403 },
      );
    }

    // Fetch exam sessions for this student with all related data
    const { data: sessions, error: sessionsError } = await supabase
      .from("exam_sessions")
      .select(`
        id,
        exam_id,
        student_id,
        created_at,
        started_at,
        expires_at,
        submitted_at,
        is_active,
        assigned_set_id,
        exams (
          id,
          practical_id,
          duration_minutes,
          max_violations,
          allow_copy_paste,
          require_fullscreen,
          show_test_results,
          start_time,
          end_time,
          practicals (
            id,
            title,
            description,
            language,
            max_marks,
            practical_number,
            is_exam,
            subject_id,
            subjects (
              subject_name,
              subject_code,
              semester
            ),
            practical_levels (
              id,
              level,
              title,
              description,
              max_marks
            )
          )
        )
      `)
      .eq("student_id", userId);

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const assignedSetIds = [...new Set(sessions
      .map((s: any) => s.assigned_set_id)
      .filter(Boolean)
      .map((id: any) => String(id)))];

    const practicalIds = [...new Set(sessions
      .map((s: any) => (s.exams as any)?.practicals?.id)
      .filter((id: any) => Number.isFinite(Number(id)))
      .map((id: any) => Number(id)))];

    const [setsRes, setLevelsRes, submissionsRes, spRes] = await Promise.all([
      assignedSetIds.length > 0
        ? (supabase
            .from("exam_question_sets")
            .select("id, set_name")
            .in("id", assignedSetIds))
        : Promise.resolve({ data: [], error: null }),
      assignedSetIds.length > 0
        ? (supabase
            .from("exam_set_levels")
            .select("question_set_id, level_id")
            .in("question_set_id", assignedSetIds))
        : Promise.resolve({ data: [], error: null }),
      practicalIds.length > 0
        ? (supabase
            .from("submissions")
            .select(
              "practical_id, level_id, status, marks_obtained, updated_at, created_at",
            )
            .eq("student_id", userId)
            .in("practical_id", practicalIds))
        : Promise.resolve({ data: [], error: null }),
      practicalIds.length > 0
        ? (supabase
            .from("student_practicals")
            .select(
              "practical_id, status, attempt_count, max_attempts, is_locked, lock_reason, assigned_deadline, notes",
            )
            .eq("student_id", userId)
            .in("practical_id", practicalIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (setsRes?.error) throw setsRes.error;
    if (setLevelsRes?.error) throw setLevelsRes.error;
    if (submissionsRes?.error) throw submissionsRes.error;
    if (spRes?.error) throw spRes.error;

    const setsData = (setsRes?.data || []) as any[];
    const setLevelsData = (setLevelsRes?.data || []) as any[];
    const submissions = (submissionsRes?.data || []) as SubmissionSummaryRow[];
    const spData = (spRes?.data || []) as any[];

    const setLevelsMap = new Map<string, Set<number>>();
    const setNameMap = new Map<string, string>();
    setsData.forEach((s: any) => {
      setNameMap.set(String(s.id), s.set_name || "");
    });

    setLevelsData.forEach((sl: any) => {
      const key = String(sl.question_set_id);
      if (!setLevelsMap.has(key)) setLevelsMap.set(key, new Set());
      setLevelsMap.get(key)!.add(Number(sl.level_id));
    });

    const submissionGroupMap = new Map<number, SubmissionSummaryRow[]>();
    submissions.forEach((sub) => {
      const practicalId = Number(sub.practical_id);
      if (!Number.isFinite(practicalId)) return;
      if (!submissionGroupMap.has(practicalId)) {
        submissionGroupMap.set(practicalId, []);
      }
      submissionGroupMap.get(practicalId)!.push(sub);
    });

    const studentPracticalMap = new Map<number, any>();
    spData.forEach((sp: any) => {
      studentPracticalMap.set(sp.practical_id, sp);
    });

    // Map to desired format
    const practicals = sessions
      .filter((session: any) => session.exams?.practicals)
      .map((session: any) => {
        const exam = session.exams as any;
        const p = exam.practicals as any;
        const rawSubs = submissionGroupMap.get(Number(p.id)) || [];
        const collapsedSubs = collapseSubmissionAttempts(rawSubs);
        const sp = studentPracticalMap.get(p.id);
        const assignedSetId = session.assigned_set_id ? String(session.assigned_set_id) : null;
        const allowedLevelIds = assignedSetId ? setLevelsMap.get(assignedSetId) : null;
        const assignedSetName = assignedSetId ? setNameMap.get(assignedSetId) : null;

        // Filter levels based on assigned set
        let visibleLevels = allowedLevelIds && allowedLevelIds.size > 0
          ? (p.practical_levels || []).filter((lvl: any) =>
              allowedLevelIds.has(Number(lvl.id)),
            )
          : (p.practical_levels || []);

        // Defensive fallback by set name prefix
        if ((!allowedLevelIds || allowedLevelIds.size === 0) && assignedSetName) {
          const normalizedSet = assignedSetName.toLowerCase().trim();
          const bySetPrefix = (p.practical_levels || []).filter((lvl: any) => {
            const title = String(lvl?.title || "").toLowerCase().trim();
            return title.startsWith(`${normalizedSet} -`) || title.startsWith(`${normalizedSet}:`) || title === normalizedSet;
          });
          if (bySetPrefix.length > 0) {
            visibleLevels = bySetPrefix;
          }
        }

        const visibleLevelIds = new Set<number>(
          (visibleLevels || [])
            .map((lvl: any) => Number(lvl?.id))
            .filter((id: number) => Number.isFinite(id)),
        );

        let relevantSubs =
          visibleLevelIds.size > 0
            ? collapsedSubs.filter(
                (sub) =>
                  sub.level_id !== null &&
                  visibleLevelIds.has(Number(sub.level_id)),
              )
            : collapsedSubs.filter((sub) => sub.level_id === null);

        let requiredCount = visibleLevelIds.size > 0 ? visibleLevelIds.size : 1;

        if (visibleLevelIds.size > 0 && relevantSubs.length === 0) {
          const legacySubs = collapsedSubs.filter((sub) => sub.level_id === null);
          if (legacySubs.length > 0) {
            relevantSubs = legacySubs;
            requiredCount = 1;
          }
        }

        const sortedVisibleLevels = [...visibleLevels].sort((a: any, b: any) => {
          const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
          return (order[a.level] || 0) - (order[b.level] || 0);
        });

        // Determine final overall status
        let finalStatus = sp?.status || "assigned";
        if (relevantSubs.length > 0) {
          const hasFailed = relevantSubs.some((s) =>
            FAIL_STATUSES.has(normalizeSubmissionStatus(s.status)),
          );
          const passedCount =
            requiredCount > 1
              ? new Set(
                  relevantSubs
                    .filter((s) => PASS_STATUSES.has(normalizeSubmissionStatus(s.status)))
                    .map((s) => String(s.level_id)),
                ).size
              : relevantSubs.some((s) => PASS_STATUSES.has(normalizeSubmissionStatus(s.status)))
                ? 1
                : 0;

          if (passedCount >= requiredCount) finalStatus = "passed";
          else if (hasFailed) finalStatus = "failed";
          else finalStatus = "pending";
        } else if (sp?.status === "completed") {
          finalStatus = "completed";
        }

        const totalMarks = relevantSubs.reduce(
          (acc, curr) => acc + Number(curr.marks_obtained || 0),
          0,
        );

        return {
          id: p.id,
          exam_id: String(exam.id),
          exam_start_time: exam.start_time ?? null,
          exam_end_time: exam.end_time ?? null,
          assignment_id: session.id,
          practical_number: p.practical_number,
          is_exam: true,
          title: p.title,
          description: p.description,
          language: p.language,
          max_marks: p.max_marks,
          status: finalStatus,
          schedule_date: sp?.assigned_deadline || exam.start_time || null,
          schedule_time: null,
          assigned_deadline: sp?.assigned_deadline || exam.end_time || null,
          notes: sp?.notes || null,
          assigned_at: session.created_at,
          completed_at: session.submitted_at,
          subject_id: p.subject_id,
          subject_name: p.subjects?.subject_name,
          subject_code: p.subjects?.subject_code,
          subject_semester: p.subjects?.semester,
          hasLevels: sortedVisibleLevels.length > 0,
          levels: sortedVisibleLevels,
          attempt_count: sp?.attempt_count ?? 0,
          max_attempts: sp?.max_attempts ?? 1,
          is_locked: sp?.is_locked ?? false,
          lock_reason: sp?.lock_reason,
          marks_obtained: totalMarks,
          // Exam-specific fields
          duration_minutes: exam.duration_minutes,
          require_fullscreen: exam.require_fullscreen,
          session_id: session.id,
          session_started_at: session.started_at,
          session_expires_at: session.expires_at,
          session_is_active: session.is_active,
        };
      });

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching student exams:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
