"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import axios from "axios";
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
  List,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  practical_number?: number | null;
  title: string;
  description: string | null;

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
  subject_semester?: string | number | null;
  language: string | null;
  hasLevels: boolean;
  attempt_count: number;
  max_attempts: number;
  is_locked: boolean;
  lock_reason?: string | null;
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
  schedule_date?: string | null;
  schedule_time?: string | null;
}

type FilterType = "all" | "pending" | "overdue" | "completed";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================



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

function getStatusGradient(status: string) {
  switch (status?.toLowerCase()) {
    case "passed":
    case "completed":
      return "from-emerald-400 to-green-600";
    case "failed":
      return "from-red-400 to-rose-600";
    case "in_progress":
    case "submitted":
      return "from-blue-400 to-indigo-600";
    case "overdue":
      return "from-orange-400 to-red-500";
    default:
      // Pending / Assigned
      return "from-blue-400 to-indigo-600";
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [userSemester, setUserSemester] = useState<string | null>(null);

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

        // Fetch extra user details (semester)
        const { data: userDetails } = await supabase
          .from("users")
          .select("semester")
          .eq("uid", user.id)
          .single();

        if (mountedRef.current) {
          setUser(user);
          if (userDetails?.semester) {
            setUserSemester(String(userDetails.semester));
          }
        }
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

        // Check for overdue (Client-side logic)
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today

        data.forEach(p => {
          if (p.schedule_date && !["submitted", "completed", "passed", "failed"].includes(p.status)) {
            const schedDate = new Date(p.schedule_date);
            schedDate.setHours(0, 0, 0, 0);

            // If schedule date is strictly before today, it is overdue
            if (schedDate < now) {
              p.status = "overdue";
            }
          }
        });

        // Sort functionality
        data.sort((a, b) => {
          const getPriority = (p: FormattedPractical) => {
            if (p.status === "passed" || p.status === "completed") return 100;
            if (p.status === "failed") return 90;
            if (p.status === "overdue") return -10; // High priority
            if (p.status === "in_progress") return -5;
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

  // 0. Base Filter: Semester (Global)
  // This ensures stats and sidebar counts reflect only the current semester practicals
  const semesterFilteredPracticals = useMemo(() => {
    let result = practicals;
    if (userSemester) {
      result = result.filter(p => !p.subject_semester || String(p.subject_semester) == String(userSemester));
    }
    // Only show practicals that have been scheduled
    result = result.filter(p => !!p.schedule_date);
    return result;
  }, [practicals, userSemester]);

  // 0.5. Apply Sequential Locking
  const sequencedPracticals = useMemo(() => {
    // Group by subject to apply sequential logic PER SUBJECT
    const groups = new Map<number, FormattedPractical[]>();
    const others: FormattedPractical[] = [];

    semesterFilteredPracticals.forEach((p) => {
      if (p.subject_id) {
        if (!groups.has(p.subject_id)) groups.set(p.subject_id, []);
        groups.get(p.subject_id)!.push({ ...p }); // Clone to avoid mutation
      } else {
        others.push({ ...p });
      }
    });

    const result: FormattedPractical[] = [];

    // Process subject groups
    groups.forEach((groupPracticals) => {
      // Sort by practical number (ascending)
      groupPracticals.sort(
        (a, b) => (a.practical_number || a.id) - (b.practical_number || b.id)
      );

      let previousCompleted = true;
      groupPracticals.forEach((p) => {
        // Check Schedule Lock
        const now = new Date();
        let scheduleLocked = false;

        if (p.schedule_date) {
          const schedDate = new Date(p.schedule_date);
          if (p.schedule_time) {
            const [hours, minutes] = p.schedule_time.split(":").map(Number);
            schedDate.setHours(hours, minutes, 0, 0);
          } else {
            schedDate.setHours(0, 0, 0, 0);
          }

          if (now < schedDate) {
            p.is_locked = true;
            p.lock_reason = `Available on ${schedDate.toLocaleDateString()} at ${schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            scheduleLocked = true;
          }
        }

        // If previous not completed, lock this one (override schedule lock reason if needed, or maybe prioritize?)
        // Let's prioritize schedule lock over previous lock if previous is done, but previous lock over schedule lock if previous is not done.

        if (!previousCompleted) {
          p.is_locked = true;
          // Only overwrite reason if it wasn't already schedule locked (to be helpful)
          if (!scheduleLocked) {
            p.lock_reason = "Previous practical not submitted";
          }
        } else if (!scheduleLocked && p.is_locked && (p.max_attempts - p.attempt_count > 0)) {
          // Sequentially valid + attempts remaining + Not Schedule Locked -> Ensure unlocked (fix for stuck state)
          p.is_locked = false;
          p.lock_reason = null;
        }

        // Check completion status for the *next* iteration
        // "submitted", "completed", "passed", "failed" (assuming failed means attempt made)
        const isDone = ["passed", "completed", "submitted", "failed"].includes(
          p.status
        );

        if (!isDone) {
          previousCompleted = false;
        }
      });
      result.push(...groupPracticals);
    });

    // Handle 'others' (uncategorized) - assuming sequential logic applies if they have numbers
    if (others.length > 0) {
      others.sort(
        (a, b) => (a.practical_number || a.id) - (b.practical_number || b.id)
      );
      // Process 'others' with same logic
      let previousCompleted = true;
      others.forEach((p) => {
        const now = new Date();
        let scheduleLocked = false;

        if (p.schedule_date) {
          const schedDate = new Date(p.schedule_date);
          if (p.schedule_time) {
            const [hours, minutes] = p.schedule_time.split(":").map(Number);
            schedDate.setHours(hours, minutes, 0, 0);
          } else {
            schedDate.setHours(0, 0, 0, 0);
          }

          if (now < schedDate) {
            p.is_locked = true;
            p.lock_reason = `Available on ${schedDate.toLocaleDateString()} at ${schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            scheduleLocked = true;
          }
        }

        if (!previousCompleted) {
          p.is_locked = true;
          if (!scheduleLocked) {
            p.lock_reason = "Previous practical not submitted";
          }
        } else if (!scheduleLocked && p.is_locked && (p.max_attempts - p.attempt_count > 0)) {
          p.is_locked = false;
          p.lock_reason = null;
        }

        const isDone = ["passed", "completed", "submitted", "failed"].includes(
          p.status
        );
        if (!isDone) previousCompleted = false;
      });
      result.push(...others);
    }

    return result;
  }, [semesterFilteredPracticals]);

  // Extract Subjects (from semester-filtered list)
  const subjects = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code?: string; count: number }>();
    sequencedPracticals.forEach(p => {
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
  }, [sequencedPracticals]);


  // Derived Stats (Filtered)
  const stats = useMemo(() => {
    // Filter practicals for stats based on selected subject
    const relevantPracticals = selectedSubjectId === "all"
      ? sequencedPracticals
      : sequencedPracticals.filter(p => p.subject_id == selectedSubjectId);

    const doneStatuses = ["passed", "failed", "completed"];
    const total = relevantPracticals.length;
    const completed = relevantPracticals.filter((p) =>
      doneStatuses.includes(p.status),
    ).length;
    const pending = total - completed;
    const overdue = relevantPracticals.filter(p => p.status === "overdue").length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, overdue, progress };
  }, [sequencedPracticals, selectedSubjectId]);

  // Filtered Content (Search, Subject, Tabs)
  const filteredPracticals = useMemo(() => {
    let result = sequencedPracticals;

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
        return result.filter(p => p.status === "overdue");
      case "completed":
        return result.filter((p) => doneStatuses.includes(p.status));
      default:
        return result;
    }
  }, [sequencedPracticals, activeFilter, searchQuery, selectedSubjectId]);

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
    if (practical.is_locked) {
      toast.warning("This practical is locked. " + (practical.lock_reason || "Please complete the previous practical first."));
      return;
    }

    // Deadline check removed to allow late submissions
    //   return;
    // }

    const remainingAttempts = practical.max_attempts - practical.attempt_count;

    if (remainingAttempts <= 0) {
      toast.error("You have no remaining attempts for this practical.");
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

  const handleRequestReattempt = async (practical: FormattedPractical) => {
    try {
      // Optimistic Update
      setPracticals(prev => prev.map(p => {
        if (p.id === practical.id) {
          return {
            ...p,
            lock_reason: (p.lock_reason || "Locked") + " | Re-attempt Requested"
          };
        }
        return p;
      }));

      await axios.post("/api/practical/reattempt", {
        practicalId: practical.id
      });

      toast.success("Re-attempt request sent successfully!");
      router.refresh();
    } catch (err: any) {
      console.error("Re-attempt request failed:", err);
      toast.error(err.response?.data?.error || "Failed to send request.");
      router.refresh(); // Revert optimistic update by refetching
    }
  };

  const groupedPracticals = useMemo(() => {
    const groups: { [key: number]: FormattedPractical[] } = {};
    const others: FormattedPractical[] = [];

    // Sort practicals by ID/Number first
    const sorted = [...filteredPracticals].sort((a, b) =>
      (a.practical_number || a.id) - (b.practical_number || b.id)
    );

    sorted.forEach((p) => {
      if (p.subject_id) {
        if (!groups[p.subject_id]) groups[p.subject_id] = [];
        groups[p.subject_id].push(p);
      } else {
        others.push(p);
      }
    });

    return { groups, others };
  }, [filteredPracticals]);

  const renderPracticalCard = (p: FormattedPractical) => {
    const isDone = ["passed", "failed", "completed"].includes(p.status);
    const isSubmitted = p.status === "submitted";
    const isUrgent = false;
    const showLocked = p.is_locked && !isDone && !isSubmitted;

    // Status accent colors
    const accentMap: Record<string, string> = {
      passed: "from-emerald-500 to-green-400",
      completed: "from-emerald-500 to-green-400",
      failed: "from-red-500 to-rose-400",
      in_progress: "from-amber-500 to-orange-400",
      submitted: "from-blue-500 to-cyan-400",
    };
    const accent = accentMap[p.status] || "from-indigo-500 to-purple-500";

    const scorePercent = (p.marks_obtained !== undefined && p.max_marks)
      ? Math.round((p.marks_obtained / p.max_marks) * 100)
      : null;

    // Format schedule time (strip seconds): "09:00:00" → "09:00"
    const formatTime = (t: string) => t?.replace(/:(\d{2})$/, "").replace(/(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})/, (_, a, b) =>
      `${a.slice(0, 5)} – ${b.slice(0, 5)}`
    );

    return (
      <motion.div
        variants={itemVariants}
        key={p.id}
        className={cn(
          "group relative rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 flex flex-col h-full overflow-hidden",
          "bg-white dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/60 dark:border-gray-700/50",
          isUrgent && "ring-2 ring-red-500/30",
        )}
      >
        {/* Top Accent Bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />

        {/* Card Body */}
        <div className="p-5 flex flex-col flex-1">

          {/* Header: Number Badge + Title */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300`}
            >
              <span className="text-lg font-black text-white drop-shadow-sm">
                {p.practical_number ?? p.id}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[15px] font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug" title={p.title}>
                {p.title}
              </h4>
            </div>
          </div>

          {/* Tags Row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <Code2 className="w-2.5 h-2.5" />
              {p.language || "Any"}
            </span>
            {p.hasLevels && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                Multi-Level
              </span>
            )}
            <StatusBadge status={p.status} />
            {showLocked && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                <Lock className="w-2.5 h-2.5" />
                Locked
              </span>
            )}
          </div>

          {/* Schedule Pill */}
          {p.schedule_date && (
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-indigo-600/80 dark:text-indigo-400/80 bg-indigo-50/60 dark:bg-indigo-900/10 px-2.5 py-1.5 rounded-lg w-fit">
              <Clock className="w-3 h-3 shrink-0" />
              <span>
                {new Date(p.schedule_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                {p.schedule_time && ` · ${formatTime(p.schedule_time)}`}
              </span>
            </div>
          )}

          {/* Description / Levels */}
          <div className="flex-1 mb-1">
            {p.description ? (
              <p className="text-[13px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {p.description.replace(/^Problem Statement:?\s*/i, "")}
              </p>
            ) : p.hasLevels && p.levels && p.levels.length > 0 ? (
              <div className="space-y-1">
                {p.levels.map((lvl) => {
                  const levelColors: Record<string, string> = {
                    easy: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
                    medium: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
                    hard: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
                  };
                  return (
                    <div key={lvl.id} className="flex items-center gap-2 text-[13px]">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${levelColors[lvl.level] || "text-gray-500 bg-gray-100"}`}>
                        {lvl.level}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 line-clamp-1">
                        {lvl.title || lvl.description?.replace(/^Problem Statement:?\s*/i, "")?.slice(0, 50) || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-gray-400 dark:text-gray-500 italic">
                No description available.
              </p>
            )}
          </div>

          {/* Attempts Progress */}
          {p.max_attempts > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                  Attempts
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  p.max_attempts - p.attempt_count <= 1 ? "text-red-500" : "text-gray-500 dark:text-gray-400"
                )}>
                  {p.attempt_count}/{p.max_attempts}
                </span>
              </div>
              <div className="w-full h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    p.max_attempts - p.attempt_count <= 1
                      ? "bg-gradient-to-r from-red-500 to-rose-400"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  )}
                  style={{ width: `${Math.min((p.attempt_count / p.max_attempts) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={cn(
            "mt-auto pt-4 border-t border-gray-100 dark:border-gray-800/50",
            p.max_attempts <= 1 ? "mt-4" : "mt-3",
            (isDone || isSubmitted || p.status === "failed") ? "flex items-center justify-between gap-3" : ""
          )}>
            {!isDone && !isSubmitted && p.status !== "failed" ? (
              <Button
                className={cn(
                  "w-full transition-all duration-300 shadow-md font-semibold",
                  isUrgent
                    ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                    : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-indigo-500/25"
                )}
                size="sm"
                onClick={() => handleStartPractical(p)}
                disabled={p.is_locked}
              >
                <span className="flex items-center gap-2">
                  {p.is_locked
                    ? "Locked"
                    : p.status === "in_progress"
                      ? "Continue Solving"
                      : "Start Practical"}
                  {!p.is_locked && (
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  )}
                </span>
              </Button>
            ) : (
              <>
                {/* Score Ring */}
                {p.marks_obtained !== undefined && scorePercent !== null && (
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-11 h-11">
                      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 dark:text-gray-800" />
                        <circle
                          cx="22" cy="22" r="18" fill="none"
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${(scorePercent / 100) * 113} 113`}
                          className={cn(
                            p.status === "passed" ? "text-emerald-500" : p.status === "failed" ? "text-red-500" : "text-indigo-500",
                            "transition-all duration-700"
                          )}
                          stroke="currentColor"
                        />
                      </svg>
                      <span className={cn(
                        "absolute inset-0 flex items-center justify-center text-[10px] font-black",
                        p.status === "passed" ? "text-emerald-600" : p.status === "failed" ? "text-red-600" : "text-gray-900 dark:text-white"
                      )}>
                        {scorePercent}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider leading-none mb-0.5">Score</span>
                      <span className={cn("text-base font-black leading-none", p.status === "passed" ? "text-emerald-600" : "text-gray-900 dark:text-white")}>
                        {p.marks_obtained}<span className="text-xs font-medium text-gray-400">/{p.max_marks}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-1.5 ml-auto">
                  {/* Retry */}
                  {p.status === "failed" && p.attempt_count < p.max_attempts && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartPractical(p)}
                      className="gap-1 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 bg-orange-50/50 dark:border-orange-800/50 dark:bg-orange-900/10 dark:hover:bg-orange-900/20 dark:text-orange-400"
                      title={p.is_locked ? "Practical Locked" : "Try Again"}
                      disabled={p.is_locked}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </Button>
                  )}

                  {/* Request Reattempt */}
                  {p.status === "failed" && p.attempt_count >= p.max_attempts && (
                    (p.lock_reason?.includes("Re-attempt Requested")) ? (
                      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-[11px] font-bold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Requested
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRequestReattempt(p)}
                        className="gap-1 text-xs text-purple-600 border-purple-200 hover:bg-purple-50 bg-purple-50/50 dark:border-purple-800/50 dark:bg-purple-900/10 dark:hover:bg-purple-900/20 dark:text-purple-400"
                        title="Request Re-attempt from Faculty"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Request
                      </Button>
                    )
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewResult(p.id, p.title);
                    }}
                  >
                    {isSubmitted ? "View Submission" : "View Result"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPracticalListItem = (p: FormattedPractical) => {
    const isDone = ["passed", "failed", "completed"].includes(p.status);
    const isSubmitted = p.status === "submitted";
    const isUrgent = false;

    return (
      <motion.div
        variants={itemVariants}
        key={p.id}
        className={cn(
          "group w-full glass-card rounded-xl p-4 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-900/60 border border-white/50 dark:border-gray-700/50 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md",
          isUrgent && "border-l-4 border-l-red-500 dark:border-l-red-500"
        )}
      >
        <div className="flex items-center gap-4 flex-1 w-full min-w-0">
          <div
            className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${getStatusGradient(
              p.status,
            )} flex items-center justify-center shadow-md`}
          >
            <span className="text-sm font-black text-white">
              {p.practical_number ?? p.id}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate" title={p.title}>
                {p.title}
              </h4>
              <div className="flex items-center gap-1.5">
                {(p.is_locked) && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 border border-gray-200 uppercase font-bold tracking-wider">Locked</span>
                )}
                {isUrgent && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-600 border border-red-200 uppercase font-bold tracking-wider">Urgent</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Code2 className="w-3 h-3" />
                {p.language || "Any"}
              </span>

              {p.schedule_date && (
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-3 h-3" />
                  {new Date(p.schedule_date).toLocaleDateString()}
                  {p.schedule_time && <span className="text-gray-400">•</span>}
                  {p.schedule_time}
                </span>
              )}

              {(!isDone && p.max_attempts > 1) && (
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {p.max_attempts - p.attempt_count} attempts
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 justify-end">
          {isDone || isSubmitted || p.status === "failed" ? (
            <div className="flex items-center gap-3">
              {p.marks_obtained !== undefined && (
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Score</div>
                  <div className={cn("text-lg font-black leading-none", p.status === "passed" ? "text-emerald-600" : "text-gray-900 dark:text-white")}>
                    {p.marks_obtained}/{p.max_marks}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {/* Retry Button - Show if attempts are available */}
                {p.status === "failed" && p.attempt_count < p.max_attempts && (
                  <Button size="icon" variant="outline" className="w-8 h-8 text-orange-600 border-orange-200 bg-orange-50/50" onClick={() => handleStartPractical(p)} disabled={p.is_locked}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                )}

                {/* Request Reattempt - Only if attempts exhausted */}
                {p.status === "failed" && p.attempt_count >= p.max_attempts && (
                  (p.lock_reason?.includes("Re-attempt Requested")) ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800/50 text-xs font-bold animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Pending</span>
                    </div>
                  ) : (
                    <Button size="icon" variant="outline" className="w-8 h-8 text-purple-600 border-purple-200 bg-purple-50/50" onClick={() => handleRequestReattempt(p)}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </Button>
                  )
                )}

                <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleViewResult(p.id, p.title); }}>
                  {isSubmitted ? "View Submission" : "Result"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              className={cn("h-8 text-xs px-4", isUrgent ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700")}
              onClick={() => handleStartPractical(p)}
              disabled={p.is_locked}
            >
              {p.is_locked ? "Locked" : "Start"}
              {!p.is_locked && <ArrowRight className="w-3 h-3 ml-1.5" />}
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              My Practicals
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your assignments subject-wise
            </p>
          </div>
          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search practicals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

          {/* Sidebar - Subjects */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="hidden md:block md:col-span-3 lg:col-span-3 space-y-4 sticky top-24 z-20"
          >
            <div className="bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-140px)]">
              <div className="p-4 border-b border-gray-200/50 dark:border-gray-800 flex-shrink-0">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5" /> Subjects
                </h2>
              </div>
              <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                <button
                  onClick={() => {
                    setSelectedSubjectId("all");
                    setActiveFilter("all");
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-between group",
                    selectedSubjectId === "all"
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                >
                  <span className="font-bold text-sm">All Subjects</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                    selectedSubjectId === "all"
                      ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                  )}>
                    {sequencedPracticals.length}
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
                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                  >
                    <div>
                      <div className="font-bold text-sm">{subject.name}</div>
                      {subject.code && (
                        <div className={cn("text-[10px] uppercase font-bold mt-0.5 transition-colors",
                          selectedSubjectId === subject.id ? "text-indigo-400 dark:text-indigo-300" : "text-gray-400 group-hover:text-gray-500"
                        )}>
                          {subject.code}
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                      selectedSubjectId === subject.id
                        ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                    )}>
                      {subject.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="col-span-1 md:col-span-9 lg:col-span-9 space-y-6">
            {/* Stats Check */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {/* Simplified Stats for cleaner look */}
              <div className="glass-card rounded-2xl p-4 flex flex-col gap-1 items-start">
                <p className="text-xs text-gray-400 font-bold uppercase">Total</p>
                <div className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                  {stats.total}
                  <Layout className="w-5 h-5 text-indigo-500 opacity-50" />
                </div>
              </div>
              <div className="glass-card rounded-2xl p-4 flex flex-col gap-1 items-start">
                <p className="text-xs text-gray-400 font-bold uppercase">Completed</p>
                <div className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                  {stats.completed}
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-50" />
                </div>
              </div>
              <div className="glass-card rounded-2xl p-4 flex flex-col gap-1 items-start">
                <p className="text-xs text-gray-400 font-bold uppercase">Pending</p>
                <div className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                  {stats.pending}
                  <Clock className="w-5 h-5 text-amber-500 opacity-50" />
                </div>
              </div>
              <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <ProgressRing progress={stats.progress} size={48} strokeWidth={4} showLabel={false} />
                  <span className="absolute text-[10px] font-bold text-gray-700 dark:text-gray-300">{Math.round(stats.progress)}%</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">Progress</p>
                  <p className="text-[10px] text-gray-400">Current Scope</p>
                </div>
              </div>
            </motion.div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-24 z-40 py-3 bg-gray-50 dark:bg-gray-950 shadow-md rounded-xl px-4 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                  {selectedSubjectId === "all" ? "Assignment Overview" : subjects.find(s => s.id === selectedSubjectId)?.name || "Assignments"}
                </h2>
                <div className="flex p-0.5 rounded-lg bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      viewMode === "grid"
                        ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                    title="Grid View"
                  >
                    <Layout className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      viewMode === "list"
                        ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    )}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
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

            {/* Practicals Grid */}
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
                  Adjust your filters to see assignments.
                </p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {Object.keys(groupedPracticals.groups).map((subjectId) => {
                  const sId = Number(subjectId);
                  const subject = subjects.find(s => s.id === sId) || { name: "Unknown Subject", code: "" };
                  const practicals = groupedPracticals.groups[sId];

                  // If subject filter is active, we don't need group headers if there's only one.
                  // But if "All Subjects" is active, we definitely want headers.
                  const showHeader = selectedSubjectId === "all";

                  return (
                    <motion.div
                      key={subjectId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4"
                    >
                      {showHeader && (
                        <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-gray-800 mt-6 first:mt-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                              {subject.name}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">
                              {practicals.length} assignment{practicals.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className={cn(
                        "grid gap-4",
                        viewMode === "grid"
                          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                          : "grid-cols-1"
                      )}>
                        {practicals.map(viewMode === "grid" ? renderPracticalCard : renderPracticalListItem)}
                      </div>
                    </motion.div>
                  )
                })}

                {/* Others / Uncategorized */}
                {groupedPracticals.others.length > 0 && (
                  <motion.div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-500 uppercase tracking-wider mt-8">Uncategorized</h3>
                    <div className={cn(
                      "grid gap-4",
                      viewMode === "grid"
                        ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                        : "grid-cols-1"
                    )}>
                      {groupedPracticals.others.map(viewMode === "grid" ? renderPracticalCard : renderPracticalListItem)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

          </div>
        </div>
      </div>

      <AnimatePresence>
        {viewingSubmission && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-5">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getLanguageColor(viewingSubmission.language)} text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20`}
                  >
                    <Code2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                      {viewingSubmission.practical_title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <StatusBadge status={viewingSubmission.status} />
                      {viewingSubmission.marks_obtained !== null && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                            <Sparkles className="w-3.5 h-3.5" />
                            {viewingSubmission.marks_obtained} / {filteredPracticals.find(p => p.id === viewingSubmission.practical_id)?.max_marks || 10}
                          </span>
                        </>
                      )}
                      <span className="text-gray-300">•</span>
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                        {new Date(viewingSubmission.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewingSubmission(null)}
                  className="rounded-full w-10 h-10 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-950/50">
                {/* Left: Code */}
                <div className="space-y-6 flex flex-col min-h-0">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-1 flex flex-col group hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between flex-shrink-0">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Code className="w-4 h-4 text-indigo-500" /> Submitted Code
                      </h4>
                      <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase border border-gray-200 dark:border-gray-600">
                        {viewingSubmission.language}
                      </span>
                    </div>
                    <div className="p-0 overflow-auto flex-1 relative">
                      <pre className="p-5 text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                        {viewingSubmission.code}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Right: Output & Test Cases */}
                <div className="space-y-6 flex flex-col min-h-0">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-shrink-0 group hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-500" /> Standard Output
                      </h4>
                    </div>
                    <div className="p-4 bg-gray-900 text-gray-300 font-mono text-xs sm:text-sm max-h-[200px] overflow-auto whitespace-pre-wrap">
                      {viewingSubmission.output || (
                        <span className="opacity-50 italic">No output captured</span>
                      )}
                    </div>
                  </div>

                  {/* Test Cases Results (Simplified) */}
                  {viewingSubmission.testCaseResults && viewingSubmission.testCaseResults.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-1 flex flex-col group hover:shadow-md transition-shadow">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Test Case Results
                        </h4>
                      </div>
                      <div className="p-4 overflow-y-auto space-y-3">
                        {viewingSubmission.testCaseResults.map((tc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Test Case #{idx + 1}</span>
                            <StatusBadge status={tc.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
    </div>
  );
}
