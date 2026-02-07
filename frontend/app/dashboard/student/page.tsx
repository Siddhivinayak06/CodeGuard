"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StudentDashboardSkeleton from "@/components/skeletons/StudentDashboardSkeleton";
import type { User } from "@supabase/supabase-js";
import {
  Code,
  FileText,
  ArrowUpRight,
  GraduationCap,
  CheckCircle2,
  Clock,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ProgressRing from "@/components/dashboard/ProgressRing";
import WelcomeCard from "@/components/dashboard/student/WelcomeCard";
import StatCard from "@/components/dashboard/student/StatCard";
import SubjectProgressList from "@/components/dashboard/student/SubjectProgressList";
import RecentSubmissionsList from "@/components/dashboard/student/RecentSubmissionsList";
import {
  StudentDetails,
  ProgressData,
  DashboardSubmission,
} from "@/types/dashboard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const shellVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
} as const;

const revealVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 30,
    },
  },
} as const;

const itemVariants = revealVariants;

export default function StudentDashboard() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("");
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(
    null,
  );
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [submissions, setSubmissions] = useState<DashboardSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const totalPracticals = progress.reduce((acc, p) => acc + p.total_count, 0);
  const passedPracticals = progress.reduce((acc, p) => acc + p.passed_count, 0);
  const failedPracticals = progress.reduce((acc, p) => acc + p.failed_count, 0);
  const overallProgress =
    totalPracticals > 0
      ? Math.round((passedPracticals / totalPracticals) * 100)
      : 0;

  // Auth check
  useEffect(() => {
    mountedRef.current = true;

    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user ?? null;

        if (!u) {
          router.push("/auth/login");
          return;
        }

        if (mountedRef.current) setUser(u);

        // Fetch user name
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("uid", u.id)
          .single();

        if (userData?.name) setUserName(userData.name);
      } catch {
        router.push("/auth/login");
      }
    };

    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // Fetch dashboard data
  useEffect(() => {
    if (!user?.id) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Student Details (Name & Semester)
        const { data: sd, error: sdErr } = await supabase
          .from("users")
          .select("semester, name")
          .eq("uid", user.id)
          .single();

        if (sdErr || !sd) throw new Error("Failed to fetch student details");

        setStudentDetails({
          semester: sd.semester || "1",
          name: sd.name || undefined,
        });

        // 2. Fetch ALL Assignments (Manual + Batch)
        // Manual Assignments
        const { data: manualData } = await supabase
          .from("student_practicals")
          .select(`practical_id, status`)
          .eq("student_id", user.id);

        // Batch Assignments
        const { data: batchData } = await supabase
          .from("schedule_allocations")
          .select(`schedule:schedules(practical_id)`)
          .eq("student_id", user.id);

        // 3. Consolidate Unique Practicals & Track Completion
        const assignedPracticalIds = new Set<number>();
        const manualStatusMap = new Map<number, string>(); // pid -> status

        (manualData || []).forEach((item: any) => {
          if (item.practical_id) {
            assignedPracticalIds.add(item.practical_id);
            if (item.status)
              manualStatusMap.set(item.practical_id, item.status);
          }
        });

        (batchData || []).forEach((item: any) => {
          if (item.schedule?.practical_id) {
            assignedPracticalIds.add(item.schedule.practical_id);
          }
        });

        if (assignedPracticalIds.size === 0) {
          setProgress([]);
          setSubmissions([]);
          setLoading(false);
          return;
        }

        const pids = Array.from(assignedPracticalIds);

        // 4. Fetch Practical Details (for Subjects & Semester Check)
        const { data: practicalsDetails } = await supabase
          .from("practicals")
          .select(`id, subject_id, subjects(id, subject_name, semester)`)
          .in("id", pids);

        // Filter PIDs by Semester (Strict Match)
        const semesterPids = new Set<number>();
        const filteredPracticalsDetails = (practicalsDetails || []).filter(
          (p: any) => {
            const subjectSemester = p.subjects?.semester;
            const studentSemester = (sd?.semester as string) || "1";

            // Keep if semester matches (or if subject has no semester defined, assuming global)
            // Requirement is "check semester", so we likely want strict matching if data exists.
            if (
              subjectSemester &&
              studentSemester &&
              subjectSemester != studentSemester
            ) {
              return false;
            }
            semesterPids.add(p.id);
            return true;
          },
        );

        const filteredPidsList = Array.from(semesterPids);

        if (filteredPidsList.length === 0) {
          setProgress([]);
          setSubmissions([]);
          setLoading(false);
          return;
        }

        // 5. Fetch Submissions for Status Counts
        const { data: statusSubmissions } = await supabase
          .from("submissions")
          .select("practical_id, status")
          .eq("student_id", user.id)
          .in("practical_id", filteredPidsList);

        const passedSet = new Set(
          statusSubmissions
            ?.filter((s) => s.status === "passed")
            .map((s) => s.practical_id),
        );
        const failedSet = new Set(
          statusSubmissions
            ?.filter((s) => s.status === "failed")
            .map((s) => s.practical_id),
        );

        // 6. Calculate Subject Progress (Using filtered details)
        const subjectMap = new Map<
          number,
          { name: string; total: number; passed: number; failed: number }
        >();

        (filteredPracticalsDetails || []).forEach((p: any) => {
          const sid = p.subjects?.id;
          const sname = p.subjects?.subject_name || "Unknown Subject";

          if (!sid) return;

          if (!subjectMap.has(sid)) {
            subjectMap.set(sid, {
              name: sname,
              total: 0,
              passed: 0,
              failed: 0,
            });
          }

          const entry = subjectMap.get(sid)!;
          entry.total += 1;

          // Passed Logic
          const manualStatus = manualStatusMap.get(p.id);
          const isManualComplete =
            manualStatus === "completed" || manualStatus === "passed";
          const isSubmissionPassed = passedSet.has(p.id);
          if (isManualComplete || isSubmissionPassed) {
            entry.passed += 1;
          }

          // Failed Logic (Strictly submission failure)
          if (failedSet.has(p.id) && !isSubmissionPassed && !isManualComplete) {
            entry.failed += 1;
          }
        });

        const progressData = Array.from(subjectMap.entries()).map(
          ([sid, data]) => ({
            subject_id: String(sid),
            subject_name: data.name,
            total_count: data.total,
            passed_count: data.passed,
            failed_count: data.failed,
          }),
        );

        setProgress(progressData);

        // 7. Recent Submissions (Limit to filtered practicals)
        const { data: recentSubs } = await supabase
          .from("submissions")
          .select(
            "id, practical_id, created_at, status, marks_obtained, language, practicals!inner(title)",
          )
          .eq("student_id", user.id)
          .in("practical_id", filteredPidsList)
          .order("created_at", { ascending: false })
          .limit(5);

        const formattedSubs = (recentSubs || []).map((s: any) => ({
          id: s.id,
          practical_title: s.practicals?.title || "Untitled Practical",
          language: s.language || "Unknown",
          status: s.status, // type will be handled by UI
          marks_obtained: s.marks_obtained,
          created_at: s.created_at,
        }));

        setSubmissions(formattedSubs);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [supabase, user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        {/* Header Section (Shell) */}
        <motion.div
          variants={shellVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
        >
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Welcome back,{" "}
              <span className="text-gradient">
                {userName ||
                  (loading ? "..." : user?.user_metadata?.name || "Student")}
              </span>{" "}
              👋
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Track your progress and upcoming practicals.
            </p>
          </div>
        </motion.div>

        {/* Main Content Area */}
        {loading || !user ? (
          <StudentDashboardSkeleton />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-4 gap-6"
          >
            {/* ===== WELCOME CARD - Large (2x1) ===== */}
            <WelcomeCard
              userName={userName}
              passedPracticals={passedPracticals}
              itemVariants={itemVariants}
            />

            {/* ===== OVERALL PROGRESS - Square ===== */}
            <motion.div
              variants={itemVariants}
              className="glass-card-premium rounded-3xl p-6 flex flex-col items-center justify-center text-center"
            >
              <ProgressRing
                progress={loading ? 0 : overallProgress}
                size={100}
                strokeWidth={10}
              />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">
                Overall Progress
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? "--" : `${passedPracticals}/${totalPracticals}`}{" "}
                passed
              </p>
            </motion.div>

            {/* ===== SEMESTER INFO - Square ===== */}
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-3xl p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 mb-3">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                Sem {studentDetails?.semester || "--"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current Semester
              </p>
            </motion.div>

            <StatCard
              label="Passed"
              value={passedPracticals}
              icon={CheckCircle2}
              colorClass="text-emerald-600 dark:text-emerald-400"
              itemVariants={itemVariants}
              loading={loading}
            />

            <StatCard
              label="Failed"
              value={failedPracticals}
              icon={Clock}
              colorClass="text-red-600 dark:text-red-400"
              itemVariants={itemVariants}
              loading={loading}
            />

            <StatCard
              label="Subjects"
              value={progress.length}
              icon={BookOpen}
              colorClass="text-blue-600 dark:text-blue-400"
              itemVariants={itemVariants}
              loading={loading}
            />

            <StatCard
              label="Submissions"
              value={submissions.length}
              icon={FileText}
              colorClass="text-pink-600 dark:text-pink-400"
              itemVariants={itemVariants}
              loading={loading}
            />

            {/* ===== QUICK ACTIONS - Wide (2x1) ===== */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 grid grid-cols-2 gap-4"
            >
              <Link
                href="/Interactive"
                className="glass-card rounded-2xl p-5 flex items-center gap-4 hover-lift group bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Code Editor
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Practice coding
                  </p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/student/practicals"
                className="glass-card rounded-2xl p-5 flex items-center gap-4 hover-lift group bg-gradient-to-br from-pink-50 to-orange-50 dark:from-pink-950/20 dark:to-orange-950/20"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Practicals
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    View assignments
                  </p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-pink-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </motion.div>

            {/* ===== SUBJECT PROGRESS - Tall (spans remaining) ===== */}
            <SubjectProgressList
              progress={progress}
              loading={loading}
              itemVariants={itemVariants}
            />

            {/* ===== RECENT SUBMISSIONS - Wide (2x1) ===== */}
            <RecentSubmissionsList
              submissions={submissions}
              loading={loading}
              itemVariants={itemVariants}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
