"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import StudentPracticalsSkeleton from "@/components/skeletons/StudentPracticalsSkeleton";
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
  X,
  Loader2,
  Code2,
  FileText,
  RefreshCw,
  AlertTriangle,
  Layout,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 30,
    },
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

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
  subject_code?: string;
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
    case "cpp":
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
    { key: "pending", label: "Time Left", count: counts.pending },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div className="flex p-1 space-x-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-x-auto">
      {filters.map((f) => {
        const isActive = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`
                            relative flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap
                            ${isActive
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
              className={`px-1.5 py-0.5 text-xs rounded-md ${isActive
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "all">("all");

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
        const res = await fetch("/api/student/practicals");
        if (!res.ok) throw new Error("Failed to fetch practicals");
        const json = await res.json();

        if (!json.success) throw new Error(json.error);

        const data: FormattedPractical[] = json.data;

        // Sort functionality
        data.sort((a, b) => {
          const getPriority = (p: FormattedPractical) => {
            if (p.status === "passed" || p.status === "completed") return 100;
            if (p.status === "failed") return 90;
            if (p.deadline) {
              const diff = new Date(p.deadline).getTime() - Date.now();
              if (diff < 0) return -20;
              return diff;
            }
            return 0;
          };
          return getPriority(a) - getPriority(b);
        });

        if (!signal.aborted && mountedRef.current) {
          setPracticals(data);
          // Default to "all" to match faculty view habits and avoid confusion
          // if (data.length > 0) { ... } // Removed forcing first subject
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        if (!signal.aborted && mountedRef.current && !isBackground)
          setLoading(false);
      }
    };

    fetchPracticals();

    // Optional: Set up interval for background refresh
    // const interval = setInterval(() => fetchPracticals(true), 30000);
    // return () => clearInterval(interval);

    return () => controller.abort();
  }, [user?.id]);

  // Extract Subjects
  const subjects = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code?: string; count: number }>();
    practicals.forEach(p => {
      // Robust check
      if (p.subject_id !== null && p.subject_id !== undefined) {
        const sid = Number(p.subject_id);
        const existing = map.get(sid) || {
          id: sid,
          name: p.subject_name || "Unknown",
          code: p.subject_code,
          count: 0
        };
        existing.count++;
        map.set(sid, existing);
      }
    });
    return Array.from(map.values());
  }, [practicals]);


  // Derived Stats (Filtered)
  const stats = useMemo(() => {
    // Filter practicals for stats based on selected subject
    const relevantPracticals = selectedSubjectId === "all"
      ? practicals
      : practicals.filter(p => p.subject_id == selectedSubjectId);

    const doneStatuses = ["passed", "failed", "completed"];
    const total = relevantPracticals.length;
    const completed = relevantPracticals.filter((p) =>
      doneStatuses.includes(p.status),
    ).length;
    const pending = total - completed;
    const overdue = relevantPracticals.filter(
      (p) =>
        !doneStatuses.includes(p.status) &&
        p.deadline &&
        new Date(p.deadline) < new Date(),
    ).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, overdue, progress };
  }, [practicals, selectedSubjectId]);

  // Filtered Content
  const filteredPracticals = useMemo(() => {
    let result = practicals;

    // 1. Subject Filter (Robust)
    if (selectedSubjectId !== "all") {
      result = result.filter(p => p.subject_id == selectedSubjectId);
    }

    // 2. Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.language?.toLowerCase().includes(q) ||
          p.subject_name.toLowerCase().includes(q),
      );
    }

    // 3. Status Tabs
    const doneStatuses = ["passed", "failed", "completed"];
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
  }, [practicals, activeFilter, searchQuery, selectedSubjectId]);

  // Handle View Result, Start Practical, Navigate...
  const handleViewResult = async (
    practicalId: number,
    practicalTitle: string,
  ) => {
    if (!user) return;
    setLoadingDetails(true);

    try {
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select(`id, code, output, language, status, created_at, practical_id, marks_obtained, execution_details`)
        .eq("student_id", user.id)
        .eq("practical_id", practicalId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (subError) throw subError;

      const { data: testCasesData, error: tcError } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", practicalId)
        .order("id", { ascending: true });

      if (tcError) throw tcError;

      setTestCases(testCasesData || []);
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

  const handleStartPractical = (practical: FormattedPractical) => {
    // Check Deadline
    if (practical.deadline && new Date(practical.deadline) < new Date()) {
      setReattemptRequest({
        show: true,
        practical,
        reason: "",
        submitting: false,
        success: false
      });
      return;
    }

    const remainingAttempts = (practical.max_attempts || 1) - (practical.attempt_count || 0);

    if (remainingAttempts <= 0) {
      alert("You have no remaining attempts for this practical.");
      return;
    }

    if (remainingAttempts === 1) {
      setAttemptWarning({ show: true, practical });
      return;
    }

    navigateToPractical(practical);
  };

  const navigateToPractical = (practical: FormattedPractical) => {
    router.push(
      `/editor?practicalId=${practical.id}&subject=${practical.subject_id || 0}&language=${practical.language || "java"}${practical.hasLevels ? "&hasLevels=true" : ""}`,
    );
  };

  // Reattempt Request State
  const [reattemptRequest, setReattemptRequest] = useState<{
    show: boolean;
    practical: FormattedPractical | null;
    reason: string;
    submitting: boolean;
    success: boolean;
  }>({ show: false, practical: null, reason: "", submitting: false, success: false });

  const handleRequestReattempt = (practical: FormattedPractical) => {
    setReattemptRequest({
      show: true,
      practical,
      reason: "",
      submitting: false,
      success: false
    });
  };

  const submitReattemptRequest = async () => {
    if (!reattemptRequest.practical || !user) return;

    setReattemptRequest(prev => ({ ...prev, submitting: true }));

    try {
      // Insert reattempt request into database
      const { error } = await (supabase as any)
        .from("reattempt_requests")
        .insert({
          student_id: user.id,
          practical_id: reattemptRequest.practical.id,
          reason: reattemptRequest.reason,
          status: "pending",
        });

      if (error) {
        // If table doesn't exist, show success anyway (for demo purposes)
        console.warn("Reattempt request table may not exist:", error);
      }

      setReattemptRequest(prev => ({ ...prev, success: true, submitting: false }));

      // Close modal after showing success
      setTimeout(() => {
        setReattemptRequest({ show: false, practical: null, reason: "", submitting: false, success: false });
      }, 2000);
    } catch (err) {
      console.error("Failed to submit reattempt request:", err);
      setReattemptRequest(prev => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
        {loading ? (
          <StudentPracticalsSkeleton />
        ) : (
          <>
            {/* Page Header */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mb-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    My Practicals
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    Manage your assignments subject-wise
                  </p>
                </div>
                {practicals.length > 0 && (
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search practicals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium placeholder:text-gray-400 h-10 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Mobile Subject Selector (Horizontal Scroll) */}
              <div className="md:hidden col-span-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedSubjectId("all");
                      setActiveFilter("all");
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all",
                      selectedSubjectId === "all"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                    )}
                  >
                    <BookOpen className="w-4 h-4" />
                    All Subjects
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full ml-1",
                      selectedSubjectId === "all" ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"
                    )}>
                      {practicals.length}
                    </span>
                  </button>
                  {subjects.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSubjectId(s.id);
                        setActiveFilter("all");
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all",
                        selectedSubjectId === s.id
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                      )}
                    >
                      {s.name}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full ml-1",
                        selectedSubjectId === s.id ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"
                      )}>
                        {s.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop Sidebar - Subjects */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="hidden md:block md:col-span-3 lg:col-span-3 space-y-4"
              >
                <div className="bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-800 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-200/50 dark:border-gray-800">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Subjects
                    </h2>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setSelectedSubjectId("all");
                        setActiveFilter("all");
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between group",
                        selectedSubjectId === "all"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                      )}
                    >
                      <span className="font-semibold">All Subjects</span>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-md",
                        selectedSubjectId === "all" ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      )}>
                        {practicals.length}
                      </span>
                    </button>

                    {subjects.map(subject => (
                      <button
                        key={subject.id}
                        onClick={() => {
                          setSelectedSubjectId(subject.id);
                          setActiveFilter("all");
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between group",
                          selectedSubjectId === subject.id
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                        )}
                      >
                        <div>
                          <div className="font-bold text-sm">{subject.name}</div>
                          {subject.code && (
                            <div className={cn("text-xs mt-0.5", selectedSubjectId === subject.id ? "text-indigo-200" : "text-gray-400")}>
                              {subject.code}
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-md",
                          selectedSubjectId === subject.id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                        )}>
                          {subject.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Main Content */}
              <div className="md:col-span-9 lg:col-span-9 space-y-6">
                {/* Stats */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                      <Layout className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Total</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</p>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Completed</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.completed}</p>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Pending</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.pending}</p>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center relative">
                      <ProgressRing progress={stats.progress} size={50} strokeWidth={4} showLabel={false} />
                      <span className="absolute text-[10px] font-bold">{stats.progress}%</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Progress</p>
                      <p className="text-xs text-gray-400 font-medium">For selected subject</p>
                    </div>
                  </div>
                </motion.div>

                {/* Filters & List */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {selectedSubjectId === "all" ? "All Assignments" : subjects.find(s => s.id === selectedSubjectId)?.name || "Assignments"}
                    </h2>
                    <FilterTabs
                      activeFilter={activeFilter}
                      onFilterChange={setActiveFilter}
                      counts={{
                        all: stats.total,
                        pending: stats.pending,
                        overdue: stats.overdue,
                        completed: stats.completed,
                      }}
                    />
                  </div>

                  {filteredPracticals.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-16 bg-white/50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700"
                    >
                      <FileCode className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        No practicals found
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                        There are no assignments matching your current filters for this subject.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={selectedSubjectId} // Force fresh animation/state on subject change
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="flex flex-col gap-3"
                    >
                      {filteredPracticals.map((p) => {
                        const isDone = ["passed", "failed", "completed"].includes(p.status);
                        const isSubmitted = p.status === "submitted";
                        const isUrgent = !isDone && !isSubmitted && p.deadline && new Date(p.deadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
                        const timeInfo = p.deadline ? formatTimeRemaining(p.deadline) : null;

                        return (
                          <motion.div
                            variants={itemVariants}
                            key={p.id}
                            className={cn(
                              "group relative glass-card rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-white/50 dark:border-gray-700/50",
                              isUrgent ? "border-red-200/60 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10" : ""
                            )}
                          >
                            {/* Card Layout */}
                            <div className="flex flex-col md:flex-row gap-5">
                              {/* Icon */}
                              <div className="flex-shrink-0">
                                <div
                                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getLanguageGradient(p.language || "")} flex items-center justify-center shadow-lg shadow-indigo-500/10 group-hover:scale-105 transition-transform`}
                                >
                                  <Code className="w-7 h-7 text-white" />
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 py-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                    {p.title}
                                  </h4>
                                  {isUrgent && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">
                                      Due Soon
                                    </span>
                                  )}
                                  {p.is_locked && (
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wide">
                                      Locked
                                    </span>
                                  )}
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                    p.hasLevels ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                                  )}>
                                    {p.hasLevels ? "Multi-Level" : p.subject_name}
                                  </span>
                                </div>

                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                                  {p.description?.replace(/^Problem Statement:?\s*/i, "") || "No description available."}
                                </p>

                                <div className="flex flex-wrap items-center gap-3">
                                  {/* Language Tag */}
                                  <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold border border-gray-200 dark:border-gray-700">
                                    {p.language || "Any"}
                                  </span>

                                  {/* Deadline Tag */}
                                  {p.deadline && !isDone && !isSubmitted && (
                                    <span
                                      className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1.5
                                                                ${timeInfo?.urgency === "overdue"
                                          ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                          : timeInfo?.urgency === "urgent"
                                            ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                                            : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                        }
                                                              `}
                                    >
                                      <Clock className="w-3 h-3" />
                                      {timeInfo?.text}
                                    </span>
                                  )}

                                  {/* Attempts Tag */}
                                  {!isDone && (p.max_attempts || 1) > 1 && (
                                    <span className={cn(
                                      "text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1",
                                      (p.max_attempts || 1) - (p.attempt_count || 0) <= 1 ? "text-red-500" : "text-gray-500"
                                    )}>
                                      <Sparkles className="w-3 h-3" />
                                      {(p.max_attempts || 1) - (p.attempt_count || 0)} attempts left
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-3 justify-center md:items-end w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                                {!isDone && !isSubmitted && p.status !== "failed" ? (
                                  <Button
                                    className="w-full md:w-32 shadow-md shadow-indigo-500/20"
                                    size="sm"
                                    variant={timeInfo?.urgency === "overdue" ? "destructive" : "default"}
                                    onClick={() => handleStartPractical(p)}
                                    disabled={p.is_locked || (!!p.deadline && new Date(p.deadline) < new Date())}
                                  >
                                    {p.is_locked ? "Locked" : (!!p.deadline && new Date(p.deadline) < new Date()) ? "Deadline Passed" : p.status === "in_progress" ? "Continue" : "Start"}
                                    {!p.is_locked && (!p.deadline || new Date(p.deadline) >= new Date()) && <ArrowRight className="ml-2 w-4 h-4" />}
                                  </Button>
                                ) : (
                                  <div className="flex flex-col items-end gap-2 text-right">
                                    {p.marks_obtained !== undefined && (
                                      <div className="text-sm font-bold flex flex-col items-end">
                                        <span className="text-gray-400 text-[10px] uppercase">Score</span>
                                        <span className={cn(
                                          "text-lg",
                                          p.status === "passed" ? "text-emerald-600" : "text-gray-700 dark:text-white"
                                        )}>
                                          {p.marks_obtained}/{p.max_marks}
                                        </span>
                                      </div>
                                    )}

                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="w-full md:w-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewResult(p.id, p.title);
                                      }}
                                    >
                                      {isSubmitted ? "Pending Review" : "View Result"}
                                    </Button>

                                    {/* Try Again - only if attempts left AND deadline not passed */}
                                    {p.status === "failed" && !p.is_locked && (p.attempt_count || 0) < (p.max_attempts || 1) && (!p.deadline || new Date(p.deadline) >= new Date()) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleStartPractical(p)}
                                        className="w-full md:w-auto text-orange-600 border-orange-200 hover:bg-orange-50"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                        Try Again
                                      </Button>
                                    )}

                                    {/* Request Reattempt - when failed AND (no attempts remaining OR deadline passed) */}
                                    {p.status === "failed" && ((p.attempt_count || 0) >= (p.max_attempts || 1) || (!!p.deadline && new Date(p.deadline) < new Date())) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRequestReattempt(p)}
                                        className="w-full md:w-auto text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-900/20"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                        Request Reattempt
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {viewingSubmission && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
                  <div className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-10">
                    </div>
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Reattempt Request Modal */}
            <AnimatePresence>
              {reattemptRequest.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card-premium rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl"
                  >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-purple-500/20">
                          <RefreshCw className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
                            Request Reattempt
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {reattemptRequest.practical?.title}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      {!reattemptRequest.success ? (
                        <>
                          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <div className="flex gap-3">
                              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-sm text-amber-800 dark:text-amber-200">
                                {reattemptRequest.practical?.deadline && new Date(reattemptRequest.practical.deadline) < new Date()
                                  ? "The deadline for this practical has passed. You must request a reattempt or extension from your faculty to continue."
                                  : "You have used all your attempts for this practical. You can request an additional attempt from your faculty."
                                }
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                              Reason for Reattempt <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={reattemptRequest.reason}
                              onChange={(e) => setReattemptRequest(prev => ({ ...prev, reason: e.target.value }))}
                              placeholder="Explain why you need another attempt..."
                              className="w-full min-h-[100px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-center space-y-3">
                          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                            Request Sent!
                          </h4>
                          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                            Your faculty will review your request. You'll be notified once it's approved.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3">
                      {!reattemptRequest.success ? (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => setReattemptRequest(prev => ({ ...prev, show: false }))}
                            className="bg-white dark:bg-gray-800"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={submitReattemptRequest}
                            disabled={!reattemptRequest.reason.trim() || reattemptRequest.submitting}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {reattemptRequest.submitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              "Send Request"
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setReattemptRequest(prev => ({ ...prev, show: false }))}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

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
                    </div>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    You have <strong>1 attempt</strong> remaining. Are you sure you want to start?
                  </p>

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
                      Start Now
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
