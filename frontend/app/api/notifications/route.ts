import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch user's notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread") === "true";

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Fetch notifications error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich notifications with practical links & lock status (batched)
    if (data) {
      // Collect all practical_ids that need enrichment
      const practicalNotifications = data.filter(
        (n: any) => n.type === "practical_assigned" && n.metadata?.practical_id
      );
      const practicalIds = [
        ...new Set(practicalNotifications.map((n: any) => n.metadata.practical_id)),
      ];

      // Batch query 1: Fetch all student_practicals for these practical_ids in ONE call
      const spMap = new Map<string, any>();
      if (practicalIds.length > 0) {
        const { data: spRecords } = await supabase
          .from("student_practicals")
          .select(`
            practical_id,
            is_locked, 
            attempt_count, 
            max_attempts,
            practicals (
              subject_id,
              practical_number,
              language
            )
          `)
          .eq("student_id", user.id)
          .in("practical_id", practicalIds);

        if (spRecords) {
          for (const sp of spRecords as any[]) {
            spMap.set(String(sp.practical_id), sp);
          }
        }
      }

      // Batch query 2: Fetch all subject assignments for sequential lock checking in ONE call
      const subjectIds = [
        ...new Set(
          Array.from(spMap.values())
            .map((sp: any) => sp.practicals?.subject_id)
            .filter(Boolean)
        ),
      ];
      const subjectAssignmentsMap = new Map<string, any[]>();
      if (subjectIds.length > 0) {
        const { data: allSubjectAssignments } = await supabase
          .from("student_practicals")
          .select(`
            status,
            practicals!inner (
              subject_id,
              practical_number
            )
          `)
          .eq("student_id", user.id)
          .in("practicals.subject_id", subjectIds);

        if (allSubjectAssignments) {
          for (const a of allSubjectAssignments as any[]) {
            const sid = a.practicals?.subject_id;
            if (sid) {
              if (!subjectAssignmentsMap.has(String(sid))) {
                subjectAssignmentsMap.set(String(sid), []);
              }
              subjectAssignmentsMap.get(String(sid))!.push(a);
            }
          }
        }
      }

      // Enrich in-memory (no more DB calls)
      const enriched = data.map((n: any) => {
        if (n.type === "practical_assigned" && n.metadata?.practical_id) {
          const spRecord = spMap.get(String(n.metadata.practical_id));
          if (spRecord) {
            const practical = spRecord.practicals;
            const link = `/editor?practicalId=${n.metadata.practical_id}${practical?.subject_id ? `&subject=${practical.subject_id}` : ""}${practical?.language ? `&language=${practical.language}` : ""}`;
            n.link = link;

            const isStrictLocked = spRecord.is_locked;
            const attemptsExhausted =
              (spRecord.attempt_count || 0) >= (spRecord.max_attempts || 1);

            if (isStrictLocked || attemptsExhausted) {
              n.metadata = {
                ...n.metadata,
                is_locked: true,
                lock_reason: isStrictLocked
                  ? "Session locked by faculty."
                  : "Maximum attempts reached.",
              };
            } else if (
              practical?.subject_id &&
              practical.practical_number !== null
            ) {
              const assignments =
                subjectAssignmentsMap.get(String(practical.subject_id)) || [];
              const curNum = practical.practical_number || 0;
              const precedingNotDone = assignments.some((a: any) => {
                const num = a.practicals?.practical_number || 0;
                if (num > 0 && num < curNum) {
                  return !["passed", "completed", "submitted", "failed"].includes(a.status);
                }
                return false;
              });

              if (precedingNotDone) {
                n.metadata = {
                  ...n.metadata,
                  is_locked: true,
                  lock_reason:
                    "Previous practicals in this subject are not completed.",
                };
              }
            }
          }
        }
        return n;
      });

      return NextResponse.json({
        data: enriched,
        total: count,
        hasMore: count ? offset + limit < count : false,
      });
    }

    return NextResponse.json({
      data: data || [],
      total: count,
      hasMore: count ? offset + limit < count : false,
    });
  } catch (err) {
    console.error("Notifications API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Create a new notification (for system/admin use)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, type, title, message, link, metadata } = body;

    if (!user_id || !type || !title) {
      return NextResponse.json(
        { error: "user_id, type, and title are required" },
        { status: 400 },
      );
    }

    const validTypes = [
      "practical_assigned",
      "submission_graded",
      "deadline_reminder",
      "announcement",
      "submission_received",
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }


    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id,
        type,
        title,
        message: message || null,
        link: link || null,
        metadata: metadata || {},
      } as never)
      .select()
      .single();

    if (error) {
      console.error("Create notification error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("Create notification API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH - Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_read } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Notification id is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: is_read ?? true } as never)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Update notification error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Update notification API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Notification id is required" },
        { status: 400 },
      );
    }

    // Use authenticated client - RLS ensures user can only delete their own notifications
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    console.error("Delete notification API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
