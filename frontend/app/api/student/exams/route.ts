import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

async function pickSetRoundRobin(supabase: any, examId: string): Promise<string | null> {
  const { data: sets } = (await (supabase
    .from("exam_question_sets") as any)
    .select("id, set_order")
    .eq("exam_id", examId)
    .order("set_order", { ascending: true })) as any as {
      data: Array<{ id: string; set_order: number }> | null;
    };

  if (!sets || sets.length === 0) return null;

  const { data: sessions } = (await (supabase
    .from("exam_sessions") as any)
    .select("assigned_set_id")
    .eq("exam_id", examId)
    .not("assigned_set_id", "is", null)) as any as {
      data: Array<{ assigned_set_id: string | null }> | null;
    };

  const countMap = new Map<string, number>();
  sets.forEach((s) => countMap.set(String(s.id), 0));

  (sessions || []).forEach((s) => {
    const sid = String(s.assigned_set_id || "");
    if (sid && countMap.has(sid)) {
      countMap.set(sid, (countMap.get(sid) || 0) + 1);
    }
  });

  let minCount = Infinity;
  let pickedSetId: string | null = null;

  for (const s of sets) {
    const sid = String(s.id);
    const count = countMap.get(sid) || 0;
    if (count < minCount) {
      minCount = count;
      pickedSetId = sid;
    }
  }

  return pickedSetId;
}

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
      .eq("practicals.is_exam", true)
      .not("practicals", "is", null) // Ensures inner join behavior
      .order("assigned_deadline", { ascending: true });

    if (error) throw error;

    // Fetch submissions for marks & status override
    const { data: submissions } = (await supabase
      .from("submissions")
      .select("practical_id, status, marks_obtained")
      .eq("student_id", userId)) as any as { data: any[] | null };

    const submissionMap = new Map(submissions?.map((s) => [s.practical_id, s]));

    // Fetch Schedules for these practicals (matching batch or logic)
    // We want schedules where:
    // 1. practical_id is in our list
    // 2. batch matches userBatch OR it's a direct allocation (which we might not check here efficiently for all, so we'll fetch all schedules for these practicals and filter in code for now or refine query)
    // A simpler approach: Fetch all schedules for these practical IDs, then find the one that matches this student (via batch or allocation).
    // Note: 'schedule_allocations' links schedule -> student. 'schedules' has 'batch_name'.

    const practicalIds = data
      .map((d: any) => d.practicals?.id)
      .filter(Boolean);

    // Resolve assigned set -> allowed level_ids per practical for this student.
    const allowedLevelIdsByPractical = new Map<number, Set<number>>();
    const assignedSetNameByPractical = new Map<number, string>();
    const examIdByPractical = new Map<number, string>();
    const examWindowByPractical = new Map<number, { start_time?: string | null; end_time?: string | null }>();
    if (practicalIds.length > 0) {
      // exam per practical
      const { data: examsData } = (await supabase
        .from("exams")
        .select("id, practical_id, start_time, end_time")
        .in("practical_id", practicalIds)) as any as {
          data: Array<{ id: string; practical_id: number; start_time?: string | null; end_time?: string | null }> | null;
        };

      const practicalByExamId = new Map<string, number>();
      (examsData || []).forEach((row) => {
        practicalByExamId.set(String(row.id), Number(row.practical_id));
        examIdByPractical.set(Number(row.practical_id), String(row.id));
        examWindowByPractical.set(Number(row.practical_id), {
          start_time: row.start_time ?? null,
          end_time: row.end_time ?? null,
        });
      });

      const examIds = Array.from(practicalByExamId.keys());
      if (examIds.length > 0) {
        const { data: sessionsData } = (await supabase
          .from("exam_sessions")
          .select("id, exam_id, assigned_set_id")
          .eq("student_id", userId)
          .in("exam_id", examIds)) as any as {
            data: Array<{ id: string; exam_id: string; assigned_set_id: string | null }> | null;
          };

        const sessionByExamId = new Map<string, { id: string; exam_id: string; assigned_set_id: string | null }>();
        (sessionsData || []).forEach((row) => {
          sessionByExamId.set(String(row.exam_id), row);
        });

        const assignedSetByExamId = new Map<string, string>();
        (sessionsData || []).forEach((row) => {
          if (row.assigned_set_id) {
            assignedSetByExamId.set(String(row.exam_id), String(row.assigned_set_id));
          }
        });

        // Ensure every exam card has exactly one assigned set for this student.
        for (const examId of examIds) {
          if (assignedSetByExamId.has(examId)) continue;

          const pickedSetId = await pickSetRoundRobin(supabase, examId);
          if (!pickedSetId) continue;

          const existingSession = sessionByExamId.get(examId);
          if (existingSession?.id) {
            await (supabase
              .from("exam_sessions") as any)
              .update({ assigned_set_id: pickedSetId })
              .eq("id", existingSession.id);
          } else {
            const practicalId = practicalByExamId.get(examId);
            const examRow = (examsData || []).find((e) => String(e.id) === examId);
            const fallbackExpiry = examRow?.end_time
              ? new Date(examRow.end_time).toISOString()
              : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

            if (practicalId) {
              await (supabaseAdmin.from("exam_sessions") as any).insert({
                exam_id: examId,
                student_id: userId,
                started_at: null,
                expires_at: fallbackExpiry,
                is_active: true,
                assigned_set_id: pickedSetId,
              });
            }
          }

          assignedSetByExamId.set(examId, pickedSetId);
        }

        const assignedSetIds = Array.from(new Set(Array.from(assignedSetByExamId.values())));

        if (assignedSetIds.length > 0) {
          const { data: assignedSetsData } = (await supabase
            .from("exam_question_sets")
            .select("id, set_name")
            .in("id", assignedSetIds)) as any as {
              data: Array<{ id: string; set_name: string }> | null;
            };

          const { data: setLevelsData } = (await supabase
            .from("exam_set_levels")
            .select("question_set_id, level_id")
            .in("question_set_id", assignedSetIds)) as any as {
              data: Array<{ question_set_id: string; level_id: number }> | null;
            };

          const setNameBySetId = new Map<string, string>();
          (assignedSetsData || []).forEach((row) => {
            setNameBySetId.set(String(row.id), String(row.set_name || "").trim());
          });

          const levelIdsBySetId = new Map<string, Set<number>>();
          (setLevelsData || []).forEach((row) => {
            const key = String(row.question_set_id);
            const curr = levelIdsBySetId.get(key) || new Set<number>();
            curr.add(Number(row.level_id));
            levelIdsBySetId.set(key, curr);
          });

          assignedSetByExamId.forEach((setId, examId) => {
            const practicalId = practicalByExamId.get(examId);
            const allowed = levelIdsBySetId.get(setId);
            const setName = setNameBySetId.get(setId);
            if (practicalId && allowed && allowed.size > 0) {
              allowedLevelIdsByPractical.set(practicalId, allowed);
            }
            if (practicalId && setName) {
              assignedSetNameByPractical.set(practicalId, setName);
            }
          });
        }
      }
    }

    const scheduleMap = new Map();
    if (practicalIds.length > 0) {
      // Fetch schedules matching user batch
      const { data: batchSchedules } = (await supabase
        .from("schedules")
        .select("practical_id, date, start_time, end_time, batch_name")
        .in("practical_id", practicalIds)
        .eq("batch_name", userBatch || "")) as any as { data: any[] | null }; // Match user batch

      // Fetch allocated schedules (if any specific overrides/allocations existed - assuming distinct from batch for now, or just use batch if that's the primary method)
      // For now, let's prioritize batch schedules as per requirements.
      if (batchSchedules) {
        batchSchedules.forEach((s) => {
          // If multiple schedules exist for a practical (unlikely for same batch), take the latest or first? taking first.
          if (!scheduleMap.has(s.practical_id)) {
            scheduleMap.set(s.practical_id, s);
          }
        });
      }
    }

    // Map to desired format
    const practicals = data.map((sp: any) => {
      const p = sp.practicals;
      const sub = submissionMap.get(p.id);
      const schedule = scheduleMap.get(p.id);
      const examId = examIdByPractical.get(Number(p.id));
      const examWindow = examWindowByPractical.get(Number(p.id));
      const allowedLevelIds = allowedLevelIdsByPractical.get(Number(p.id));
      const assignedSetName = assignedSetNameByPractical.get(Number(p.id));

      let visibleLevels = allowedLevelIds
        ? (p.practical_levels || []).filter((lvl: any) =>
            allowedLevelIds.has(Number(lvl.id)),
          )
        : (p.practical_levels || []);

      // Defensive fallback: if level mappings are missing, infer by level title prefix.
      // Example title format: "Set A - Task 1".
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

      // Determine final status
      // Priority: Passed -> Completed (Manual) -> Submission Status -> Assigned Status
      let finalStatus = sp.status;
      if (sub?.status === "passed") finalStatus = "passed";
      else if (sp.status === "completed") finalStatus = "completed";
      else if (sub?.status) finalStatus = sub.status;

      return {
        id: p.id,
        exam_id: examId,
        exam_start_time: examWindow?.start_time ?? null,
        exam_end_time: examWindow?.end_time ?? null,
        assignment_id: sp.id,
        practical_number: p.practical_number,
        title: p.title,
        description: p.description,
        language: p.language,
        max_marks: p.max_marks,
        status: finalStatus,
        schedule_date: schedule?.date || sp.assigned_deadline || null,
        schedule_time: schedule
          ? `${schedule.start_time} - ${schedule.end_time}`
          : null,
        assigned_deadline: sp.assigned_deadline,
        notes: sp.notes,
        assigned_at: sp.assigned_at,
        completed_at: sp.completed_at,
        subject_id: p.subject_id,
        subject_name: p.subjects?.subject_name,
        subject_code: p.subjects?.subject_code,
        subject_semester: p.subjects?.semester,
        // Add levels
        hasLevels: visibleLevels.length > 0,
        levels: visibleLevels.sort((a: any, b: any) => {
          const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
          return (order[a.level] || 0) - (order[b.level] || 0);
        }),
        // Add meta
        attempt_count: sp.attempt_count ?? 0,
        max_attempts: sp.max_attempts ?? 1,
        is_locked: sp.is_locked ?? false,
        lock_reason: sp.lock_reason,
        marks_obtained: sub?.marks_obtained ?? undefined,
      };
    });

    return NextResponse.json({ success: true, data: practicals });
  } catch (err: any) {
    console.error("Error fetching student practicals:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Server error" },
      { status: 500 },
    );
  }
}
