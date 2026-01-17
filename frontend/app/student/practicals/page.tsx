"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Clock,
  Code,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ArrowRight,
  Search,
  Sparkles,
  Target,
  X,
  Loader2,
  Code2,
  FileText,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Tables } from "@/lib/supabase/database.types";

// ============================================================================
// ANIMATION VARIANTS (From Dashboard)
// ============================================================================

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

// ============================================================================
// TYPES
// ============================================================================

type PracticalLevel = Tables<"practical_levels">;
type Subject = Tables<"subjects">;

interface Submission {
  id: number;
  practical_id: number;
  practical_title: string;
  code: string;
  output: string;
  language: string;
  status: string;
  created_at: string;
  marks_obtained: number | null;
  testCaseResults: TestCaseResult[];
}

interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean | null;
}

interface TestCaseResult {
  test_case_id: number;
  status: string;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  memory_used_kb: number;
}

interface PracticalWithRelations extends Tables<"practicals"> {
  subjects: { subject_name: string; semester: number | string } | null;
  practical_levels: {
    id: number;
    level: "easy" | "medium" | "hard";
    title: string | null;
    description: string | null;
    max_marks: number;
  }[];
}

interface FormattedPractical {
  id: number;
  subject_id: number | null;
  practical_id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  status:
    | "assigned"
    | "in_progress"
    | "completed"
    | "overdue"
    | "passed"
    | "failed"
    | "submitted"
    | "pending";
  subject_name: string;
  language: string | null;
  hasLevels: boolean;
  attempt_count?: number;
  max_attempts?: number;
  is_locked?: boolean;
  marks_obtained?: number;
  max_marks?: number;
  notes?: string | null;
  levels?: {
    id: number;
    level: "easy" | "medium" | "hard";
    title: string | null;
    description: string | null;
    max_marks: number;
  }[];
}

type FilterType = "all" | "pending" | "overdue" | "completed";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimeRemaining(deadline: string): {
  text: string;
  urgency: "overdue" | "urgent" | "soon" | "normal";
  days: number;
} {
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      text: overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`,
      urgency: "overdue",
      days: -overdueDays,
    };
  }
  if (diffDays === 0) {
    if (diffHours <= 0)
      return { text: "Due now!", urgency: "overdue", days: 0 };
    return {
      text: diffHours === 1 ? "1 hour left" : `${diffHours} hours left`,
      urgency: "urgent",
      days: 0,
    };
  }
  if (diffDays === 1)
    return { text: "Due tomorrow", urgency: "urgent", days: 1 };
  if (diffDays <= 3)
    return { text: `${diffDays} days left`, urgency: "soon", days: diffDays };
  return { text: `${diffDays} days left`, urgency: "normal", days: diffDays };
}

function getLanguageGradient(lang: string) {
  switch (lang?.toLowerCase()) {
    case "python":
      return "from-yellow-400 via-amber-500 to-orange-500";
    case "java":
      return "from-orange-500 via-red-500 to-rose-600";
    case "c":
      return "from-blue-400 via-blue-500 to-indigo-600";
    case "c++":
      return "from-purple-500 via-violet-500 to-fuchsia-500";
    case "javascript":
      return "from-yellow-300 via-amber-400 to-orange-400";
    default:
      return "from-indigo-500 via-purple-500 to-pink-500";
  }
}

function getLanguageColor(lang: string) {
  switch (lang?.toLowerCase()) {
    case "python":
      return "from-yellow-400 to-blue-500";
    case "java":
      return "from-red-500 to-orange-500";
    case "c":
      return "from-blue-500 to-cyan-500";
    case "cpp":
      return "from-blue-600 to-blue-400";
    case "javascript":
      return "from-yellow-300 to-yellow-500";
    default:
      return "from-indigo-400 to-indigo-600";
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    passed: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    failed: {
      bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-400",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    pending: {
      bg: "bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700",
      text: "text-slate-700 dark:text-slate-400",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
  };

  const style = styles[status?.toLowerCase()] || styles.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${style.bg} ${style.text}`}
    >
      {style.icon}
      <span className="capitalize">
        {status?.replace(/_/g, " ") || "Unknown"}
      </span>
    </span>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  showLabel = true,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring -rotate-90">
        <circle
          className="stroke-gray-200 dark:stroke-gray-700"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className="progress-ring-circle"
          stroke="url(#gradient)"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset:
              circumference - (safeProgress / 100) * circumference,
          }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            {safeProgress}%
          </motion.span>
        </div>
      )}
    </div>
  );
}

function FilterTabs({
  activeFilter,
  onFilterChange,
  counts,
}: {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: { all: number; pending: number; overdue: number; completed: number };
}) {
  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div className="flex p-1 space-x-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50">
      {filters.map((f) => {
        const isActive = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`
                            relative flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200
                            ${
                              isActive
                                ? "text-gray-900 dark:text-white"
                                : "text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/40 dark:hover:bg-gray-700/40"
                            }
                        `}
          >
            {isActive && (
              <motion.div
                layoutId="activeFilter"
                className="absolute inset-0 bg-white dark:bg-gray-700 shadow-md ring-1 ring-black/5 dark:ring-white/10 rounded-lg"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span>{f.label}</span>
            <span
              className={`px-1.5 py-0.5 text-xs rounded-md ${
                isActive
                  ? "bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
                  : "bg-gray-200/50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              }`}
            >
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StudentPracticals() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [practicals, setPracticals] = useState<FormattedPractical[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Result Modal State
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(
    null,
  );
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // Attempt Warning Modal State
  const [attemptWarning, setAttemptWarning] = useState<{
    show: boolean;
    practical: FormattedPractical | null;
  }>({ show: false, practical: null });

  // Fetch user
  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          router.push("/auth/login");
          return;
        }
        if (mountedRef.current) setUser(user);
      } catch {
        router.push("/auth/login");
      }
    };
    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // Fetch practicals
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchPracticals = async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        // 1. Fetch Assignments
        const { data: manualData } = await supabase
          .from("student_practicals")
          .select(
            "practical_id, assigned_deadline, status, notes, is_locked, attempt_count, max_attempts",
          )
          .eq("student_id", user.id);

        const { data: batchData } = await supabase
          .from("schedule_allocations")
          .select("schedule:schedules (date, practical_id)")
          .eq("student_id", user.id);

        // 2. Collect IDs
        const practicalIds = new Set<number>();
        (manualData || []).forEach(
          (item) => item.practical_id && practicalIds.add(item.practical_id),
        );
        (batchData || []).forEach(
          (item: any) =>
            item.schedule?.practical_id &&
            practicalIds.add(item.schedule.practical_id),
        );

        if (practicalIds.size === 0) {
          if (mountedRef.current) setPracticals([]);
          return;
        }

        // 3. Details & Submissions
        const { data: practicalsDetails } = await supabase
          .from("practicals")
          .select(
            `id, title, description, language, subject_id, max_marks, subjects ( subject_name, semester ), practical_levels ( id, level, title, description, max_marks )`,
          )
          .in("id", Array.from(practicalIds));

        // Fetch User Semester
        const { data: userProfile } = await supabase
          .from("users")
          .select("semester")
          .eq("uid", user.id)
          .single();

        const studentSemester = userProfile?.semester;

        const { data: submissions } = await supabase
          .from("submissions")
          .select("practical_id, status, marks_obtained")
          .eq("student_id", user.id)
          .in("practical_id", Array.from(practicalIds));

        // 4. Merge
        const detailsMap = new Map(practicalsDetails?.map((p) => [p.id, p]));
        const submissionMap = new Map(
          submissions?.map((s) => [s.practical_id, s]),
        );

        const combinedPracticals: FormattedPractical[] = [];
        const processedIds = new Set<number>();

        // Helper to add practical
        const addPractical = (
          pid: number,
          assignedMeta: any,
          isBatch: boolean,
        ) => {
          if (processedIds.has(pid)) return;
          const p = detailsMap.get(pid);
          if (!p) return;

          processedIds.add(pid);
          const sub = submissionMap.get(pid);
          const levels = p.practical_levels || [];

          // Status Logic:
          // Priority: 1. Submission Status (if passed) -> 2. Manual Status (if completed) -> 3. Submission Status -> 4. Assigned status -> 5. 'assigned'
          let finalStatus = "assigned";
          if (sub?.status === "passed") finalStatus = "passed";
          else if (assignedMeta.status === "completed")
            finalStatus = "completed";
          else if (sub?.status) finalStatus = sub.status;
          else if (assignedMeta.status) finalStatus = assignedMeta.status;

          const subjectSemester = p.subjects?.semester;

          // Filter by semester if both exist (and strictly match)
          if (
            studentSemester &&
            subjectSemester &&
            studentSemester !== subjectSemester
          ) {
            return;
          }

          combinedPracticals.push({
            id: p.id,
            practical_id: p.id,
            title: p.title,
            description: p.description,
            language: p.language,
            deadline: isBatch
              ? assignedMeta.date
              : assignedMeta.assigned_deadline,
            subject_id: p.subject_id,
            subject_name: p.subjects?.subject_name || "Unknown",
            status: finalStatus as any,
            notes: isBatch ? "" : assignedMeta.notes,
            hasLevels: levels.length > 0,
            levels: levels.sort((a, b) => {
              const order = { easy: 0, medium: 1, hard: 2 };
              return (order[a.level] || 0) - (order[b.level] || 0);
            }),
            is_locked:
              !isBatch &&
              (assignedMeta.is_locked ||
                (assignedMeta.attempt_count || 0) >=
                  (assignedMeta.max_attempts || 1)),
            attempt_count: isBatch ? 0 : assignedMeta.attempt_count || 0,
            max_attempts: isBatch ? 1 : assignedMeta.max_attempts || 1,
            marks_obtained: sub?.marks_obtained ?? undefined,
            max_marks:
              p.max_marks ||
              levels.reduce(
                (acc: number, l: any) => acc + (l.max_marks || 0),
                0,
              ) ||
              100,
          });
        };

        (manualData || []).forEach(
          (sp) => sp.practical_id && addPractical(sp.practical_id, sp, false),
        );
        (batchData || []).forEach(
          (item: any) =>
            item.schedule?.practical_id &&
            addPractical(item.schedule.practical_id, item.schedule, true),
        );

        combinedPracticals.sort((a, b) => {
          const getPriority = (p: FormattedPractical) => {
            const isDone = ["passed", "completed"].includes(p.status);
            const isFailed = p.status === "failed";
            const canRetry =
              isFailed &&
              !p.is_locked &&
              (p.attempt_count || 0) < (p.max_attempts || 1);
            const isSubmitted = p.status === "submitted";

            // Done (passed/completed) - Lowest priority
            if (isDone) return 100;

            // Failed without retry option - Low priority
            if (isFailed && !canRetry) return 90;

            // Submitted (under review) - Medium-low priority
            if (isSubmitted) return 50;

            // Calculate deadline-based priority
            if (!p.deadline) {
              // Failed with retry but no deadline - Medium priority
              if (canRetry) return 15;
              return 20; // Pending but no urgency
            }

            const now = Date.now();
            const due = new Date(p.deadline).getTime();
            const diffHours = (due - now) / (1000 * 60 * 60);

            // Failed with retry option - treat like pending
            if (canRetry) {
              if (diffHours < 0) return -15; // Overdue retry
              if (diffHours < 72) return -5; // Urgent retry
              return 5; // Normal retry
            }

            // Pending practicals - highest priority based on deadline
            if (diffHours < 0) return -20; // Overdue (Highest)
            if (diffHours < 24) return -18; // Due within 24 hours
            if (diffHours < 72) return -10; // Urgent (< 3 days)

            return 0; // Normal pending
          };

          const prioA = getPriority(a);
          const prioB = getPriority(b);

          if (prioA !== prioB) return prioA - prioB;

          // Secondary sort: Deadline (earlier first)
          const timeA =
            a.deadline && typeof a.deadline === "string"
              ? new Date(a.deadline).getTime()
              : Infinity;
          const timeB =
            b.deadline && typeof b.deadline === "string"
              ? new Date(b.deadline).getTime()
              : Infinity;
          return timeA - timeB;
        });

        if (!signal.aborted && mountedRef.current)
          setPracticals(combinedPracticals);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        if (!signal.aborted && mountedRef.current && !isBackground)
          setLoading(false);
      }
    };

    fetchPracticals();
    // (Skipping detailed subscription setup for brevity, assuming standard refresh logic is fine or can be added back if needed)
  }, [user?.id, supabase]);

  // Derived Stats
  const stats = useMemo(() => {
    const doneStatuses = ["passed", "failed", "completed"];
    const total = practicals.length;
    const completed = practicals.filter((p) =>
      doneStatuses.includes(p.status),
    ).length;
    const pending = total - completed;
    const overdue = practicals.filter(
      (p) =>
        !doneStatuses.includes(p.status) &&
        p.deadline &&
        new Date(p.deadline) < new Date(),
    ).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, overdue, progress };
  }, [practicals]);

  // Filtered Content
  const filteredPracticals = useMemo(() => {
    const doneStatuses = ["passed", "failed", "completed"];
    let result = practicals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.language?.toLowerCase().includes(q) ||
          p.subject_name.toLowerCase().includes(q),
      );
    }
    switch (activeFilter) {
      case "pending":
        return result.filter((p) => !doneStatuses.includes(p.status));
      case "overdue":
        return result.filter(
          (p) =>
            !doneStatuses.includes(p.status) &&
            p.deadline &&
            new Date(p.deadline) < new Date(),
        );
      case "completed":
        return result.filter((p) => doneStatuses.includes(p.status));
      default:
        return result;
    }
  }, [practicals, activeFilter, searchQuery]);

  // Handle View Result: Fetch latest submission + test cases
  const handleViewResult = async (
    practicalId: number,
    practicalTitle: string,
  ) => {
    if (!user) return;
    setLoadingDetails(true);

    try {
      // 1. Fetch latest submission for this practical
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select(
          `
          id,
          code,
          output,
          language,
          status,
          created_at,
          practical_id,
          marks_obtained,
          execution_details
        `,
        )
        .eq("student_id", user.id)
        .eq("practical_id", practicalId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (subError) throw subError;

      // 2. Fetch Test Case Definitions
      const { data: testCasesData, error: tcError } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", practicalId)
        .order("id", { ascending: true });

      if (tcError) throw tcError;

      setTestCases(testCasesData || []);

      // 3. Set Viewing Submission
      setViewingSubmission({
        id: subData.id,
        practical_id: subData.practical_id ?? 0,
        practical_title: practicalTitle,
        code: subData.code || "",
        output: subData.output || "",
        language: subData.language || "unknown",
        status: subData.status || "pending",
        created_at: subData.created_at,
        marks_obtained: subData.marks_obtained,
        testCaseResults: (subData.execution_details as any)?.results || [],
      });
    } catch (err) {
      console.error("Failed to fetch result:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle Start Practical with Attempt Check
  const handleStartPractical = (practical: FormattedPractical) => {
    const remainingAttempts =
      (practical.max_attempts || 1) - (practical.attempt_count || 0);

    // If no attempts remaining, block
    if (remainingAttempts <= 0) {
      alert("You have no remaining attempts for this practical.");
      return;
    }

    // If only 1 attempt remaining, show warning
    if (remainingAttempts === 1) {
      setAttemptWarning({ show: true, practical });
      return;
    }

    // Otherwise, navigate directly
    navigateToPractical(practical);
  };

  const navigateToPractical = (practical: FormattedPractical) => {
    router.push(
      `/editor?practicalId=${practical.id}&subject=${practical.subject_id || 0}&language=${practical.language || "java"}${practical.hasLevels ? "&hasLevels=true" : ""}`,
    );
  };

  // Loading State
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        {/* Header */}
        <motion.div
          variants={shellVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8"
        >
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              My Practicals
              <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                {stats.total}
              </span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Track and conquer your assignments
            </p>
          </div>

          {/* Search */}
          {!loading && practicals.length > 0 && (
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search practicals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium placeholder:text-gray-400 h-10"
              />
            </div>
          )}
        </motion.div>

        {/* Progress Overview */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          {/* Ring Stats */}
          <motion.div
            variants={itemVariants}
            className="md:col-span-1 glass-card-premium rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[140px]"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
            <ProgressRing progress={stats.progress} size={80} strokeWidth={8} />
            <div className="mt-2 text-center">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Completion
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {stats.completed}/{stats.total} Done
              </p>
            </div>
          </motion.div>

          {/* Pending & Overdue */}
          <motion.div
            variants={itemVariants}
            className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center text-center hover-lift min-h-[140px] group transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-amber-100/50 dark:bg-amber-900/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {stats.pending}
              </h3>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Pending
              </p>
            </div>

            <div className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center text-center hover-lift min-h-[140px] group transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/50 dark:bg-emerald-900/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                {stats.completed}
              </h3>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Completed
              </p>
            </div>

            <div
              className={`rounded-2xl p-4 flex flex-col items-center justify-center text-center hover-lift min-h-[140px] border transition-all duration-300 group
                            ${
                              stats.overdue > 0
                                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 shadow-sm"
                                : "glass-card"
                            }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${stats.overdue > 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-gray-100/50 dark:bg-gray-800"}`}
              >
                <AlertCircle
                  className={`w-6 h-6 ${stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"}`}
                />
              </div>
              <h3
                className={`text-3xl font-black ${stats.overdue > 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white"}`}
              >
                {stats.overdue}
              </h3>
              <p
                className={`text-xs font-bold uppercase tracking-wide ${stats.overdue > 0 ? "text-red-600/80 dark:text-red-400/80" : "text-gray-500"}`}
              >
                Overdue
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <FilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={{
              all: practicals.length,
              pending: stats.pending,
              overdue: stats.overdue,
              completed: stats.completed,
            }}
          />
        </div>

        {/* Listing */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl w-full" />
            ))}
          </div>
        ) : filteredPracticals.length === 0 ? (
          <div className="text-center py-16 bg-white/50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <FileCode className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              No practicals found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try adjusting your filters or search query.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            {filteredPracticals.map((p) => {
              const isDone = ["passed", "failed", "completed"].includes(
                p.status,
              );
              const isSubmitted = p.status === "submitted";
              const isUrgent =
                !isDone &&
                !isSubmitted &&
                p.deadline &&
                new Date(p.deadline).getTime() - Date.now() <
                  3 * 24 * 60 * 60 * 1000;
              const timeInfo = p.deadline
                ? formatTimeRemaining(p.deadline)
                : null;
              const cleanDescription =
                p.description?.replace(/^Problem Statement:?\s*/i, "") ||
                (p.hasLevels
                  ? "Complete all levels to finish this challenge."
                  : "No description available.");

              // Deduplicate tags
              const tags = [];
              if (p.subject_name)
                tags.push({ text: p.subject_name, type: "subject" });
              // Only add language if it's different from subject name (case insensitive)
              if (
                p.language &&
                p.language.toLowerCase() !== p.subject_name.toLowerCase()
              ) {
                tags.push({ text: p.language, type: "language" });
              }
              if (isSubmitted)
                tags.push({ text: "Under Review", type: "status" });

              return (
                <motion.div
                  variants={itemVariants}
                  key={p.id}
                  className={`
                                        group relative glass-card rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
                                        flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6
                                        ${isUrgent ? "border-red-200/60 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10" : ""}
                                    `}
                >
                  {/* Icon / Status */}
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getLanguageGradient(p.language || "")} flex items-center justify-center shadow-lg shadow-indigo-500/10 flex-shrink-0 group-hover:scale-105 transition-transform`}
                  >
                    <Code className="w-7 h-7 text-white" />
                  </div>
                  {/* Urgent Dot Indicator */}
                  {isUrgent && (
                    <div className="absolute top-3 right-3 md:top-auto md:bottom-auto md:right-4 flex h-2 w-2 md:hidden">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-2">
                        {p.title}
                      </h4>
                      {isUrgent && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold whitespace-nowrap">
                          Due Soon
                        </span>
                      )}
                      {p.is_locked && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold flex items-center gap-1">
                          Locked
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-3 font-medium">
                      {cleanDescription}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold
                           ${
                             tag.type === "subject"
                               ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                               : tag.type === "language"
                                 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                                 : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                           }
                         `}
                        >
                          {tag.text}
                        </span>
                      ))}
                      {p.deadline && !isDone && !isSubmitted && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5
                            ${
                              timeInfo?.urgency === "overdue"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                : timeInfo?.urgency === "urgent"
                                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }
                          `}
                        >
                          {timeInfo?.urgency === "overdue" ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {timeInfo?.text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col gap-2 w-full md:w-auto md:items-end mt-4 md:mt-0 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-4 md:pt-0">
                    {/* Show remaining attempts for pending or failed practicals with attempts left */}
                    {((!isDone && !isSubmitted) ||
                      (p.status === "failed" && !p.is_locked)) &&
                      (p.max_attempts || 1) > 1 && (
                        <div
                          className={`text-xs font-medium px-2 py-1 rounded-lg mb-1 ${
                            (p.max_attempts || 1) - (p.attempt_count || 0) <= 1
                              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {(p.max_attempts || 1) - (p.attempt_count || 0)}{" "}
                          attempt
                          {(p.max_attempts || 1) - (p.attempt_count || 0) !== 1
                            ? "s"
                            : ""}{" "}
                          remaining
                        </div>
                      )}

                    {/* Show Start/Continue for pending practicals */}
                    {!isDone && !isSubmitted && p.status !== "failed" ? (
                      <Button
                        className="w-full md:w-auto shadow-sm"
                        size="sm"
                        variant={
                          timeInfo?.urgency === "overdue"
                            ? "destructive"
                            : "outline"
                        }
                        onClick={() => handleStartPractical(p)}
                        disabled={p.is_locked}
                      >
                        {p.is_locked ? (
                          <>No Attempts Left</>
                        ) : p.status === "in_progress" ? (
                          <>
                            Continue <ArrowRight className="ml-2 w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Start Challenge{" "}
                            <ArrowRight className="ml-2 w-4 h-4" />
                          </>
                        )}
                      </Button>
                    ) : (
                      /* Show View Result for passed, failed, completed, and submitted */
                      <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                          {p.marks_obtained !== undefined && (
                            <span
                              className={`text-sm font-bold px-2 py-0.5 rounded-md ${
                                p.status === "passed" ||
                                p.status === "completed"
                                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                  : p.status === "failed"
                                    ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                                    : "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                              }`}
                            >
                              {p.marks_obtained}/{p.max_marks}
                            </span>
                          )}
                          {/* Show attempts used */}
                          {(p.status === "failed" || p.status === "passed") &&
                            (p.max_attempts || 1) > 1 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {p.attempt_count}/{p.max_attempts} attempts
                              </span>
                            )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewResult(p.id, p.title);
                            }}
                          >
                            {isSubmitted ? "View Submission" : "View Result"}{" "}
                            <ArrowRight className="ml-2 w-4 h-4" />
                          </Button>
                        </div>

                        {/* Try Again button for failed practicals with attempts remaining */}
                        {p.status === "failed" &&
                          !p.is_locked &&
                          (p.attempt_count || 0) < (p.max_attempts || 1) && (
                            <Button
                              className="w-full md:w-auto shadow-sm bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                              size="sm"
                              onClick={() => handleStartPractical(p)}
                            >
                              Try Again <RefreshCw className="ml-2 w-4 h-4" />
                            </Button>
                          )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Enhanced View Modal */}
        {viewingSubmission && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getLanguageColor(viewingSubmission.language)} text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20`}
                  >
                    <Code2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
                      {viewingSubmission.practical_title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <StatusBadge status={viewingSubmission.status} />
                      {viewingSubmission.marks_obtained !== undefined &&
                        viewingSubmission.marks_obtained !== null && (
                          <>
                            <span className="text-gray-300 dark:text-gray-700">
                              •
                            </span>
                            <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
                              <Sparkles className="w-3.5 h-3.5" />
                              {viewingSubmission.marks_obtained}
                            </span>
                          </>
                        )}
                      <span className="text-gray-300 dark:text-gray-700">
                        •
                      </span>
                      <span className="font-mono text-xs">
                        {new Date(
                          viewingSubmission.created_at,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewingSubmission(null)}
                  className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-950/50">
                {/* Left: Code & Output */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 flex items-center justify-between">
                      <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Code className="w-4 h-4 text-indigo-500" /> Submitted
                        Code
                      </h4>
                      <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-md bg-gray-200/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        {viewingSubmission.language}
                      </span>
                    </div>
                    <div className="p-0 overflow-auto max-h-[400px]">
                      <pre className="p-4 text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {viewingSubmission.code}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50">
                      <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-500" />{" "}
                        Standard Output
                      </h4>
                    </div>
                    <div className="p-4 bg-gray-900 dark:bg-black text-gray-100 dark:text-gray-300 font-mono text-xs sm:text-sm max-h-[200px] overflow-auto whitespace-pre-wrap">
                      {viewingSubmission.output || (
                        <span className="opacity-40 italic">
                          No output generated.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Test Results */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm h-full flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 flex items-center justify-between sticky top-0">
                      <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />{" "}
                        Test Results
                      </h4>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {
                          viewingSubmission.testCaseResults?.filter(
                            (r) => r.status.toLowerCase() === "passed",
                          ).length
                        }
                        /{viewingSubmission.testCaseResults?.length} Passed
                      </span>
                    </div>
                    <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                      {loadingDetails ? (
                        <div className="text-center py-8">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                        </div>
                      ) : viewingSubmission.testCaseResults?.length > 0 ? (
                        viewingSubmission.testCaseResults.map((r, idx) => {
                          const tc = testCases.find(
                            (t) => t.id === r.test_case_id,
                          );
                          return (
                            <div
                              key={idx}
                              className="group rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900/40 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400">
                                    {idx + 1}
                                  </span>
                                  <span className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {tc?.is_hidden
                                      ? "Hidden Case"
                                      : "Public Case"}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                    r.status?.toLowerCase() === "passed"
                                      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                                      : "text-red-600 bg-red-50 dark:bg-red-900/20"
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <p className="text-gray-400 dark:text-gray-500 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                                    Input
                                  </p>
                                  <div className="bg-gray-50 dark:bg-black p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 font-mono text-gray-700 dark:text-gray-300 truncate">
                                    {tc?.input || "—"}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-gray-400 dark:text-gray-500 mb-1.5 font-semibold uppercase tracking-wider text-[10px]">
                                    Expected
                                  </p>
                                  <div className="bg-gray-50 dark:bg-black p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 font-mono text-gray-700 dark:text-gray-300 truncate">
                                    {tc?.expected_output || "—"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 flex flex-col items-center justify-center">
                          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                            <Code className="w-6 h-6 text-gray-400" />
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 font-medium">
                            No test results available for this submission.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Attempt Warning Modal */}
        {attemptWarning.show && attemptWarning.practical && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card-premium rounded-3xl w-full max-w-md p-6 animate-scaleIn">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Last Attempt Warning
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This is your final attempt
                  </p>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>⚠️ Warning:</strong> You have only{" "}
                  <strong>1 attempt</strong> remaining for
                  <strong className="text-orange-600 dark:text-orange-300">
                    {" "}
                    "{attemptWarning.practical.title}"
                  </strong>
                  . Once you start, you must complete and submit your solution.
                  Make sure you're ready before proceeding.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    setAttemptWarning({ show: false, practical: null })
                  }
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                  onClick={() => {
                    if (attemptWarning.practical) {
                      navigateToPractical(attemptWarning.practical);
                    }
                    setAttemptWarning({ show: false, practical: null });
                  }}
                >
                  I'm Ready, Start <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
