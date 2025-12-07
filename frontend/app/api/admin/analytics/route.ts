import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function GET() {
    try {
        // Get basic counts
        const [
            studentsRes,
            facultyRes,
            adminsRes,
            subjectsRes,
            practicalsRes,
            submissionsRes,
        ] = await Promise.all([
            supabaseAdmin
                .from("users")
                .select("*", { count: "exact", head: true })
                .eq("role", "student"),
            supabaseAdmin
                .from("users")
                .select("*", { count: "exact", head: true })
                .eq("role", "faculty"),
            supabaseAdmin
                .from("users")
                .select("*", { count: "exact", head: true })
                .eq("role", "admin"),
            supabaseAdmin.from("subjects").select("*", { count: "exact", head: true }),
            supabaseAdmin.from("practicals").select("*", { count: "exact", head: true }),
            supabaseAdmin.from("submissions").select("*", { count: "exact", head: true }),
        ]);

        // Get submission status breakdown (using correct status values from schema)
        const [submittedRes, evaluatedRes, pendingRes] = await Promise.all([
            supabaseAdmin
                .from("submissions")
                .select("*", { count: "exact", head: true })
                .eq("status", "submitted"),
            supabaseAdmin
                .from("submissions")
                .select("*", { count: "exact", head: true })
                .eq("status", "evaluated"),
            supabaseAdmin
                .from("submissions")
                .select("*", { count: "exact", head: true })
                .eq("status", "pending"),
        ]);

        // Get execution results breakdown (actual pass/fail from execution_results table)
        const [acceptedRes, failedRes] = await Promise.all([
            supabaseAdmin
                .from("execution_results")
                .select("*", { count: "exact", head: true })
                .eq("verdict", "accepted"),
            supabaseAdmin
                .from("execution_results")
                .select("*", { count: "exact", head: true })
                .in("verdict", ["wrong_answer", "compile_error", "runtime_error", "time_limit_exceeded", "error"]),
        ]);

        // Get recent submissions for activity chart (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentSubmissions } = await supabaseAdmin
            .from("submissions")
            .select("created_at, status")
            .gte("created_at", sevenDaysAgo.toISOString())
            .order("created_at", { ascending: true });

        // Group submissions by day
        const activityByDay: Record<string, { total: number; evaluated: number; pending: number }> = {};
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        // Initialize all 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayName = days[date.getDay()];
            activityByDay[dayName] = { total: 0, evaluated: 0, pending: 0 };
        }

        // Count submissions per day
        recentSubmissions?.forEach((sub) => {
            const date = new Date(sub.created_at);
            const dayName = days[date.getDay()];
            if (activityByDay[dayName]) {
                activityByDay[dayName].total++;
                if (sub.status === "evaluated") activityByDay[dayName].evaluated++;
                if (sub.status === "pending" || sub.status === "submitted") activityByDay[dayName].pending++;
            }
        });

        // Convert to array for charts
        const activityData = Object.entries(activityByDay).map(([day, data]) => ({
            day,
            ...data,
        }));

        // Get practicals with deadline info
        const { data: practicalDeadlines } = await supabaseAdmin
            .from("practicals")
            .select("id, title, deadline, subject_id")
            .not("deadline", "is", null)
            .order("deadline", { ascending: true })
            .limit(10);

        // Categorize practicals by deadline status
        const now = new Date();
        const upcomingDeadlines = practicalDeadlines?.filter(
            (p) => p.deadline && new Date(p.deadline) > now
        ) || [];
        const pastDeadlines = practicalDeadlines?.filter(
            (p) => p.deadline && new Date(p.deadline) <= now
        ) || [];

        // Get subjects with practical counts - using a simpler approach
        const { data: allSubjects } = await supabaseAdmin
            .from("subjects")
            .select("id, subject_name, subject_code")
            .limit(10);

        const { data: allPracticals } = await supabaseAdmin
            .from("practicals")
            .select("subject_id");

        // Count practicals per subject manually
        const practicalCounts: Record<number, number> = {};
        allPracticals?.forEach((p) => {
            if (p.subject_id) {
                practicalCounts[p.subject_id] = (practicalCounts[p.subject_id] || 0) + 1;
            }
        });

        const subjectsWithPracticals = allSubjects?.map((s) => ({
            id: s.id,
            name: s.subject_name,
            code: s.subject_code,
            practicalCount: practicalCounts[s.id] || 0,
        })) || [];

        // Get top students by submissions - simpler query
        const { data: allSubmissions } = await supabaseAdmin
            .from("submissions")
            .select("student_id")
            .limit(500);

        // Count submissions per student
        const studentSubmissionCounts: Record<string, number> = {};
        allSubmissions?.forEach((sub) => {
            if (sub.student_id) {
                studentSubmissionCounts[sub.student_id] = (studentSubmissionCounts[sub.student_id] || 0) + 1;
            }
        });

        // Get top 5 student IDs
        const topStudentIds = Object.entries(studentSubmissionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);

        // Fetch student details
        let topStudentsList: Array<{ id: string; name: string; email: string; count: number }> = [];
        if (topStudentIds.length > 0) {
            const { data: studentUsers } = await supabaseAdmin
                .from("users")
                .select("uid, name, email")
                .in("uid", topStudentIds);

            topStudentsList = topStudentIds.map((id) => {
                const user = studentUsers?.find((u) => u.uid === id);
                return {
                    id,
                    name: user?.name || "Unknown",
                    email: user?.email || "",
                    count: studentSubmissionCounts[id] || 0,
                };
            });
        }

        // Calculate success rate from execution_results
        const totalExecutions = (acceptedRes.count ?? 0) + (failedRes.count ?? 0);
        const successRate = totalExecutions > 0
            ? Math.round(((acceptedRes.count ?? 0) / totalExecutions) * 100)
            : 0;

        return NextResponse.json({
            overview: {
                students: studentsRes.count ?? 0,
                faculty: facultyRes.count ?? 0,
                admins: adminsRes.count ?? 0,
                subjects: subjectsRes.count ?? 0,
                practicals: practicalsRes.count ?? 0,
                totalSubmissions: submissionsRes.count ?? 0,
            },
            submissions: {
                submitted: submittedRes.count ?? 0,
                evaluated: evaluatedRes.count ?? 0,
                pending: pendingRes.count ?? 0,
                // From execution_results
                accepted: acceptedRes.count ?? 0,
                failed: failedRes.count ?? 0,
                successRate,
            },
            activityData,
            deadlines: {
                upcoming: upcomingDeadlines.slice(0, 5),
                past: pastDeadlines.length,
            },
            subjectsWithPracticals,
            topStudents: topStudentsList,
        });
    } catch (err) {
        console.error("Error fetching analytics:", err);
        return NextResponse.json(
            { error: "Failed to fetch analytics", details: String(err) },
            { status: 500 }
        );
    }
}
