"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const Calendar = dynamic(() => import("@/components/ui/calendar").then(mod => mod.Calendar), { ssr: false, loading: () => <div className="h-64 w-full bg-gray-100/50 dark:bg-gray-800/50 rounded-xl animate-pulse" /> });
const ActivityChart = dynamic(() => import("../../faculty/components/ActivityChart"), { ssr: false, loading: () => <div className="h-full w-full bg-gray-100/50 dark:bg-gray-800/50 rounded-xl animate-pulse" /> });
const StatusChart = dynamic(() => import("../../faculty/components/StatusChart"), { ssr: false, loading: () => <div className="h-full w-full bg-gray-100/50 dark:bg-gray-800/50 rounded-xl animate-pulse" /> });
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";

const PracticalForm = dynamic(() => import("../../faculty/components/PracticalForm"), {
  ssr: false,
});

import {
  FileCheck,
  TrendingUp,
  Clock,
  Plus,
  ArrowUpRight,
  Pencil,
  Trash2,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import FacultyDashboardSkeleton from "@/components/skeletons/FacultyDashboardSkeleton";

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

const itemVariants = revealVariants; // Aliasing for compatibility with existing code

import { Practical, Subject, TestCase } from "../../faculty/types";

// ---------------------- Types ----------------------
interface Submission {
  id: number;
  status: string;
  created_at: string;
  practical_id: number;
}

// ---------------------- Initial States ----------------------
const initialPracticalForm: Practical = {
  id: 0,
  title: "",
  subject_id: 0,
  description: "",
  language: null,
  max_marks: 100,
  practical_number: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  submitted: false,
  is_exam: false,
};
const initialTestCase: TestCase = {
  id: 0,
  practical_id: null,
  input: "",
  expected_output: "",
  is_hidden: false,
  time_limit_ms: 2000,
  memory_limit_kb: 65536,
  created_at: new Date().toISOString(),
  level_id: null,
};

// ---------------------- Components ----------------------

function PracticalCard({
  practical,
  subject,
  onEdit,
  onDelete,
}: {
  practical: Practical;
  subject: string;
  onEdit: (p: Practical) => void;
  onDelete: (id: number) => void;
}) {


  return (
    <div className="group p-4 bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all duration-200">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
            {practical.title}
          </h4>
          <div className="flex items-center gap-2 mt-1.5 text-xs">
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              {subject}
            </span>
            {practical.language && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {practical.language}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Middle: Status & Type */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-md uppercase",
              practical.is_exam
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            )}
          >
            {practical.is_exam ? "EXAM" : "PRACTICAL"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full",
              "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(practical)}
            className="p-2.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(practical.id)}
            className="p-2.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------- Faculty Dashboard ----------------------
export default function FacultyDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const recoverFromStaleSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cg_session_id");
      document.cookie = "device_session_id=; path=/; max-age=0; SameSite=Lax";

      Object.keys(localStorage).forEach((key) => {
        const lowered = key.toLowerCase();
        if (lowered.startsWith("sb-") || lowered.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });

      window.location.href = "/auth/login?reset=1";
      return;
    }

    router.replace("/auth/login?reset=1");
  }, [router]);

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalHasMounted, setModalHasMounted] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      setModalHasMounted(true);
    }
  }, [modalOpen]);

  const [editingPractical, setEditingPractical] = useState<Practical | null>(
    null,
  );
  const [sampleCode, setSampleCode] = useState<string>("");
  const [starterCode, setStarterCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  // Fetch data
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Get user
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          recoverFromStaleSession();
          return;
        }
        setUser(data.user);

        // Get display name
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("uid", data.user.id)
          .single();
        if (userData) setUserName((userData as any).name);

        setLoading(false);

        // 2. Fetch subjects for this faculty via junction table
        setDataLoading(true);
        const { data: facultyBatches } = await supabase
          .from("subject_faculty_batches")
          .select("subject_id")
          .eq("faculty_id", data.user.id);

        const subjectIds = [...new Set(((facultyBatches as any[]) || []).map((fb) => fb.subject_id))];

        if (subjectIds.length > 0) {
          const { data: subjData, error: subjErr } = await supabase
            .from("subjects")
            .select("*")
            .in("id", subjectIds);

          if (!subjErr && subjData) {
            setSubjects(subjData as Subject[]);
          } else {
            setSubjects([]);
          }

          // 3. Fetch practicals using subjectIds from junction table
          const { data: pracData } = await supabase
            .from("practicals")
            .select("*")
            .in("subject_id", subjectIds)
            .order("created_at", { ascending: false });

          if (pracData) {
            let practicalsWithSchedules = pracData as Practical[];
            const pIds = (pracData as any[]).map((p) => p.id);

            if (pIds.length > 0) {
              // Fetch Schedules
              const { data: schedData } = await supabase
                .from("schedules")
                .select("practical_id, batch_name, date")
                .in("practical_id", pIds);

              // Fetch Exams
              const { data: examData } = await supabase
                .from("exams")
                .select("practical_id, start_time")
                .in("practical_id", pIds);

              const schedMap = new Map<number, { batch_name: string | null; date: string }[]>();

              if (schedData) {
                (schedData as any[]).forEach((s) => {
                  if (s.practical_id) {
                    const list = schedMap.get(s.practical_id) || [];
                    list.push({ batch_name: s.batch_name, date: s.date });
                    schedMap.set(s.practical_id, list);
                  }
                });
              }

              if (examData) {
                (examData as any[]).forEach((e) => {
                  if (e.practical_id && e.start_time) {
                    const list = schedMap.get(e.practical_id) || [];
                    list.push({ batch_name: "Exam", date: e.start_time });
                    schedMap.set(e.practical_id, list);
                  }
                });
              }

              practicalsWithSchedules = practicalsWithSchedules.map((p) => ({
                ...p,
                schedules: schedMap.get(p.id) || [],
              }));
            }
            setPracticals(practicalsWithSchedules);

            // 4. Fetch Submissions (for charts)
            const pIdsForSubs = (pracData as any[]).map((p) => p.id);
            if (pIdsForSubs.length > 0) {
              const { data: subData } = await supabase
                .from("submissions")
                .select("id, status, created_at, practical_id")
                .in("practical_id", pIdsForSubs);

              if (subData) {
                const mappedSubmissions = (subData as any[]).map((s) => ({
                  id: s.id,
                  status: s.status || "pending",
                  created_at: s.created_at,
                  practical_id: s.practical_id,
                }));
                setSubmissions(mappedSubmissions as Submission[]);
              }
            }
          }
        } else {
          setSubjects([]);
        }
      } catch (error) {
        console.error("Faculty dashboard session/data init failed:", error);
        recoverFromStaleSession();
      } finally {
        setLoading(false);
        setDataLoading(false);
      }
    };

    init();
  }, [supabase, recoverFromStaleSession]);

  const fetchPracticals = async () => {
    if (!user) return;
    const subjectIds = subjects.map((s) => s.id);
    if (subjectIds.length === 0) return;

    const { data } = await supabase
      .from("practicals")
      .select("*")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false });

    if (data) {
      let practicalsWithSchedules = data as Practical[];
      const pIds = (data as any[]).map((p) => p.id);
      if (pIds.length > 0) {
        const { data: schedData } = await supabase
          .from("schedules")
          .select("practical_id, batch_name, date")
          .in("practical_id", pIds);

        const { data: examData } = await supabase
          .from("exams")
          .select("practical_id, start_time")
          .in("practical_id", pIds);

        const schedMap = new Map<number, { batch_name: string | null; date: string }[]>();

        if (schedData) {
          (schedData as any[]).forEach((s) => {
            if (s.practical_id) {
              const list = schedMap.get(s.practical_id) || [];
              list.push({ batch_name: s.batch_name, date: s.date });
              schedMap.set(s.practical_id, list);
            }
          });
        }

        if (examData) {
          (examData as any[]).forEach((e) => {
            if (e.practical_id && e.start_time) {
              const list = schedMap.get(e.practical_id) || [];
              list.push({ batch_name: "Exam", date: e.start_time });
              schedMap.set(e.practical_id, list);
            }
          });
        }

        practicalsWithSchedules = practicalsWithSchedules.map((p) => ({
          ...p,
          schedules: schedMap.get(p.id) || [],
        }));
      }
      setPracticals(practicalsWithSchedules);
    }
  };

  const openCreate = (date?: Date) => {
    setEditingPractical(null);
    setSampleCode("");
    setStarterCode("");
    setSampleLanguage("c");
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);

    const { data: refsData } = await supabase
      .from("reference_codes")
      .select("*")
      .eq("practical_id", p.id)
      .order("created_at", { ascending: false });
    const refs = refsData as any[];
    if (refs && refs.length > 0) {
      setSampleCode(refs[0].code || "");
      setStarterCode(refs[0].starter_code || "");
      setSampleLanguage(refs[0].language || "c");
    }

    setModalOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (!error) setPracticals((prev) => prev.filter((p) => p.id !== id));
  };

  // --- Chart Data Preparation ---
  // 1. Status Distribution
  const statusData = useMemo(() => {
    const counts = { passed: 0, failed: 0, pending: 0 };
    submissions.forEach((s) => {
      const st = (s.status || "pending").toLowerCase();
      if (counts[st as keyof typeof counts] !== undefined)
        counts[st as keyof typeof counts]++;
      else counts.pending++;
    });
    return [
      { name: "Passed", value: counts.passed, color: "#10b981" }, // green
      { name: "Failed", value: counts.failed, color: "#ef4444" }, // red
      { name: "Pending", value: counts.pending, color: "#fbbf24" }, // amber
    ].filter((d) => d.value > 0);
  }, [submissions]);

  // 2. Activity (Submissions per day, last 7 days)
  const activityData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const data = last7Days.map((date) => {
      const count = submissions.filter((s) =>
        s.created_at.startsWith(date),
      ).length;
      return {
        date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        submissions: count,
      };
    });
    return data;
  }, [submissions]);

  const activePracticalsCount = practicals.filter(p => !p.is_exam).length;
  const activeExamsCount = practicals.filter(p => p.is_exam).length;
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Practical[]>();
    practicals.forEach((p) => {
      // No deadline, so effectively no events on calendar
    });
    return map;
  }, [practicals]);

  // Dates with events for Calendar modifiers
  const { practicalDates, examDates } = useMemo(() => {
    const pDates: Date[] = [];
    const eDates: Date[] = [];
    practicals.forEach((p) => {
      if (p.schedules) {
        p.schedules.forEach((s) => {
          if (s.date) {
            if (p.is_exam) {
              eDates.push(new Date(s.date));
            } else {
              pDates.push(new Date(s.date));
            }
          }
        });
      }
    });
    return { practicalDates: pDates, examDates: eDates };
  }, [practicals]);

  // Events specifically for the currently selected date
  const eventsForSelectedDate = useMemo(() => {
    if (!selected) return [];
    
    // Create a local date string robustly (YYYY-MM-DD)
    const targetDate = new Date(selected.getTime() - selected.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

    return practicals.filter((p) => {
      if (!p.schedules) return false;
      return p.schedules.some((s) => {
        if (!s.date) return false;
        // Parse the ISO string or pure date string
        const sDate = s.date.length > 10 ? s.date.split("T")[0] : s.date;
        return sDate === targetDate;
      });
    });
  }, [practicals, selected]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        {/* Header Section */}
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
                {userName || (loading ? "..." : "Faculty")}
              </span>{" "}
              👋
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Manage your practicals and track student performance.
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5"
          >
            <Plus size={20} />
            Create Practical
          </button>
        </motion.div>

        {/* BENTO GRID */}
        {loading || dataLoading ? (
          <FacultyDashboardSkeleton />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {/* 1. Quick Stats (Row 1) - Solid Gradient Icons */}
            <motion.div
              variants={itemVariants}
              className="glass-card-premium rounded-3xl p-6 hover-lift"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Active Practicals
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {activePracticalsCount}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="glass-card-premium rounded-3xl p-6 hover-lift"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Submissions
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {submissions.length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="glass-card-premium rounded-3xl p-6 hover-lift"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Active Exams
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {activeExamsCount}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              onClick={() => router.push("/faculty/submissions")}
              className="glass-card rounded-2xl p-5 flex items-center gap-4 hover-lift group bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Review Work
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  5 Pending Grinds
                </p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
            </motion.div>

            {/* 2. Charts Row (Row 2, split 2:2 or 3:1) */}

            {/* Activity Chart (Wide) - Reduced Height */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 lg:col-span-3 glass-card-premium rounded-3xl p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Submission Activity
              </h3>
              <div className="h-[200px] w-full">
                <ActivityChart data={activityData} />
              </div>
            </motion.div>

            {/* Status Donut Chart */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-1 glass-card-premium rounded-3xl p-6 flex flex-col"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Submission Status
              </h3>
              <div className="flex-1 h-[200px] relative">
                <StatusChart data={statusData} total={submissions.length} />
              </div>
            </motion.div>

            {/* 3. Main Content: List & Calendar */}

            {/* Practicals List (Wide) */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 lg:col-span-3 glass-card-premium rounded-3xl p-6 min-h-[400px]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Recent Assignments
                </h3>
                <button
                  onClick={() => router.push("/dashboard/faculty/practicals")}
                  className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  View All <ArrowRight size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {practicals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <FileCheck className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      No practicals found
                    </h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">
                      Create your first practical to start assigning work to
                      students.
                    </p>
                  </div>
                ) : (
                  practicals.slice(0, 5).map((p) => {
                    const subj =
                      subjects.find((s) => s.id === p.subject_id)
                        ?.subject_name || "Subject";
                    return (
                      <PracticalCard
                        key={p.id}
                        practical={p}
                        subject={subj}
                        onEdit={openEdit}
                        onDelete={deletePractical}
                      />
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Calendar (Narrow) */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-1 glass-card-premium rounded-3xl p-6 relative overflow-hidden"
            >
              {/* Gradient overlay */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-2xl" />

              <div className="relative z-10">
                {/* Header with icon */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                    <Clock size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Schedule
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click a date to create practical
                    </p>
                  </div>
                </div>

                {/* Calendar */}
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-3 backdrop-blur-sm border border-gray-100 dark:border-gray-700/50">
                  <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(d) => d && setSelected(d)}
                    className="rounded-xl border-none shadow-none"
                    modifiers={{
                      hasPractical: practicalDates,
                      hasExam: examDates,
                    }}
                    modifiersClassNames={{
                      hasPractical:
                        "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-blue-500 after:rounded-full",
                      hasExam:
                        "[&]:border-violet-500 [&]:bg-violet-50 dark:[&]:bg-violet-900/20 after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-violet-600 dark:after:bg-violet-400 after:rounded-full",
                    }}
                  />
                </div>

                {/* Selected Date Details */}
                <div className="mt-5 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-800">
                    {selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </h4>
                  
                  {eventsForSelectedDate.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl">
                      No assignments scheduled.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {eventsForSelectedDate.map((event) => (
                        <div key={event.id} className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl flex flex-col gap-1.5 shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight line-clamp-2 title">
                              {event.title}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase",
                                event.is_exam
                                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              )}
                            >
                              {event.is_exam ? "EXAM" : "PRAC"}
                            </span>
                          </div>
                          
                          {/* Schedule specific details for the day */}
                          {event.schedules
                            ?.filter(s => s.date && (s.date.length > 10 ? s.date.split("T")[0] : s.date) === (new Date(selected.getTime() - selected.getTimezoneOffset() * 60000).toISOString().split("T")[0]))
                            .map((s, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Clock size={12} />
                                {s.batch_name ? (
                                  <span>{s.batch_name}</span>
                                ) : (
                                  <span>{new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </motion.div >
        )
        }

        {/* Practical Modal */}
        {modalHasMounted && (
          <PracticalForm
            isOpen={modalOpen}
          practical={editingPractical}
          subjects={subjects}
          supabase={supabase}
          sampleCode={sampleCode}
          setSampleCode={setSampleCode}
          starterCode={starterCode}
          setStarterCode={setStarterCode}
          sampleLanguage={sampleLanguage}
          setSampleLanguage={setSampleLanguage}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            fetchPracticals();
            setModalOpen(false);
          }}
        />
        )}
      </main >
    </div >
  );
}
