import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

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

/** GET: get assigned practicals for the current student */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: userData, error: userErr } =
      await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = userData.user.id;

    // Verify user is a student and get batch
    const { data: userRole, error: roleError } = (await supabase
      .from("users")
      .select("role, batch")
      .eq("uid", userId)
      .single()) as any;

    if (roleError || userRole?.role !== "student") {
      return NextResponse.json(
        { success: false, error: "Access denied: students only" },
        { status: 403 },
      );
    }

    const userBatch = userRole.batch;

    // Backfill: auto-assign practicals from schedules that don't have student_practicals entries yet
    if (userBatch) {
      try {
        // Find all schedules for this student's batch
        const { data: batchSchedules } = (await supabase
          .from("schedules")
          .select("practical_id, date")
          .eq("batch_name", userBatch)
          .not("practical_id", "is", null)) as any as { data: any[] | null };

        if (batchSchedules && batchSchedules.length > 0) {
          const scheduledPracticalIds = [...new Set(batchSchedules.map((s: any) => s.practical_id))];

          // Check which are already assigned
          const { data: existing } = (await supabase
            .from("student_practicals")
            .select("practical_id")
            .eq("student_id", userId)
            .in("practical_id", scheduledPracticalIds)) as any as { data: any[] | null };

          const existingIds = new Set(existing?.map((e: any) => e.practical_id) || []);
          const missingPracticals = scheduledPracticalIds.filter((id: number) => !existingIds.has(id));

          if (missingPracticals.length > 0) {
            // Build a date map for deadlines
            const dateMap = new Map<number, string>();
            batchSchedules.forEach((s: any) => {
              if (!dateMap.has(s.practical_id)) dateMap.set(s.practical_id, s.date);
            });

            const inserts = missingPracticals.map((practical_id: number) => ({
              student_id: userId,
              practical_id,
              assigned_deadline: dateMap.get(practical_id) || null,
              status: "assigned",
            }));

            await (supabaseAdmin.from("student_practicals") as any).insert(inserts);
          }
        }
      } catch (backfillErr) {
        console.error("Backfill student_practicals error:", backfillErr);
        // Non-fatal: continue with existing data
      }
    }

    // Fetch personalized practicals
    const { data, error } = await supabase
      .from("student_practicals")
      .select(
        `
        id,
        assigned_deadline,
        status,
        notes,
        assigned_at,
        completed_at,
        attempt_count,
        max_attempts,
        is_locked,
        lock_reason,
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
      `
      )
      .eq("student_id", userId)
      .eq("practicals.is_exam", false)
      .not("practicals", "is", null) // Ensures inner join behavior
      .order("assigned_deadline", { ascending: true });

    if (error) throw error;

    const practicalIds = [...new Set((data || [])
      .map((d: any) => d.practicals?.id)
      .filter((id: any) => Number.isFinite(Number(id)))
      .map((id: any) => Number(id)))];

    let submissions: SubmissionSummaryRow[] = [];
    let batchSchedules: any[] = [];

    if (practicalIds.length > 0) {
      const [submissionsRes, schedulesRes] = await Promise.all([
        (supabase
          .from("submissions")
          .select(
            "practical_id, level_id, status, marks_obtained, updated_at, created_at",
          )
          .eq("student_id", userId)
          .in("practical_id", practicalIds)) as any,
        userBatch
          ? (supabase
              .from("schedules")
              .select("practical_id, date, start_time, end_time, batch_name")
              .in("practical_id", practicalIds)
              .eq("batch_name", userBatch)) as any
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (submissionsRes?.error) {
        console.error("Failed to fetch submissions:", submissionsRes.error);
      } else {
        submissions = (submissionsRes?.data || []) as SubmissionSummaryRow[];
      }

      if (schedulesRes?.error) {
        console.error("Failed to fetch schedules:", schedulesRes.error);
      } else {
        batchSchedules = (schedulesRes?.data || []) as any[];
      }
    }

    const submissionGroupMap = new Map<number, SubmissionSummaryRow[]>();
    submissions.forEach((sub) => {
      const practicalId = Number(sub.practical_id);
      if (!Number.isFinite(practicalId)) return;
      if (!submissionGroupMap.has(practicalId)) {
        submissionGroupMap.set(practicalId, []);
      }
      submissionGroupMap.get(practicalId)!.push(sub);
    });

    const scheduleMap = new Map();
    if (batchSchedules.length > 0) {
      batchSchedules.forEach((s) => {
        // If multiple schedules exist for a practical, keep the first one.
        if (!scheduleMap.has(s.practical_id)) {
          scheduleMap.set(s.practical_id, s);
        }
      });
    }

    // Map to desired format
    const practicals = (data || []).map((sp: any) => {
      const p = sp.practicals;
      if (!p?.id) return null;

      const rawSubs = submissionGroupMap.get(Number(p.id)) || [];
      const collapsedSubs = collapseSubmissionAttempts(rawSubs);
      const requiredLevelIds = new Set<number>(
        ((p.practical_levels || []) as any[])
          .map((lvl: any) => Number(lvl?.id))
          .filter((id: number) => Number.isFinite(id)),
      );

      let relevantSubs =
        requiredLevelIds.size > 0
          ? collapsedSubs.filter(
              (sub) =>
                sub.level_id !== null &&
                requiredLevelIds.has(Number(sub.level_id)),
            )
          : collapsedSubs.filter((sub) => sub.level_id === null);

      let requiredCount = requiredLevelIds.size > 0 ? requiredLevelIds.size : 1;

      if (requiredLevelIds.size > 0 && relevantSubs.length === 0) {
        const legacySubs = collapsedSubs.filter((sub) => sub.level_id === null);
        if (legacySubs.length > 0) {
          relevantSubs = legacySubs;
          requiredCount = 1;
        }
      }

      const schedule = scheduleMap.get(p.id);

      // Determine final status
      let finalStatus = sp.status;
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
      } else if (sp.status === "completed") {
        finalStatus = "completed";
      }

      const totalMarks = relevantSubs.reduce(
        (acc, curr) => acc + Number(curr.marks_obtained || 0),
        0,
      );

      return {
        id: p.id,
        assignment_id: sp.id,
        practical_number: p.practical_number,
        is_exam: p.is_exam,
        title: p.title,
        description: p.description,
        language: p.language,
        max_marks: p.max_marks,
        status: finalStatus,
        schedule_date: schedule?.date || null,
        schedule_time: schedule
          ? `${schedule.start_time} - ${schedule.end_time}`
          : null,
        notes: sp.notes,
        assigned_at: sp.assigned_at,
        completed_at: sp.completed_at,
        subject_id: p.subject_id,
        subject_name: p.subjects?.subject_name,
        subject_code: p.subjects?.subject_code,
        subject_semester: p.subjects?.semester,
        hasLevels: p.practical_levels && p.practical_levels.length > 0,
        levels: [...(p.practical_levels || [])].sort((a: any, b: any) => {
          const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
          return (order[a.level] || 0) - (order[b.level] || 0);
        }),
        attempt_count: sp.attempt_count ?? 0,
        max_attempts: sp.max_attempts ?? 1,
        is_locked: sp.is_locked ?? false,
        lock_reason: sp.lock_reason,
        marks_obtained: totalMarks,
      };
    }).filter(Boolean);

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching student practicals:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
