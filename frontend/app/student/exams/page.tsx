"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import axios from "axios";
import { Button } from "@/components/ui/button";
import StudentPracticalsSkeleton from "@/components/skeletons/StudentPracticalsSkeleton";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Clock,
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
  Layout,
  List,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Optimized Imports
import StatusBadge from "@/components/student/exams/StatusBadge";
import ProgressRing from "@/components/student/exams/ProgressRing";
import FilterTabs from "@/components/student/exams/FilterTabs";
import PracticalCard from "@/components/student/exams/PracticalCard";
import PracticalListItem from "@/components/student/exams/PracticalListItem";
import { FormattedPractical, FilterType, Submission, TestCase } from "@/components/student/exams/types";

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
// HELPER FUNCTIONS
// ============================================================================

function hasExamEnded(practical: FormattedPractical) {
  if (!practical.exam_end_time) return false;
  const endTime = new Date(practical.exam_end_time);
  if (Number.isNaN(endTime.getTime())) return false;
  return Date.now() > endTime.getTime();
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
      return "from-blue-400 to-indigo-600";
  }
}

function getLanguageColor(lang: string) {
  switch (lang?.toLowerCase()) {
    case "python": return "from-yellow-400 to-blue-500";
    case "java": return "from-red-500 to-orange-500";
    case "c": return "from-blue-500 to-cyan-500";
    case "cpp": return "from-blue-600 to-blue-400";
    case "javascript": return "from-yellow-300 to-yellow-500";
    default: return "from-indigo-400 to-indigo-600";
  }
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StudentExams() {
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
          if ((userDetails as any)?.semester) {
            setUserSemester(String((userDetails as any).semester));
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
        const res = await fetch("/api/student/exams");
        if (!res.ok) throw new Error("Failed to fetch exams");
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

    if (selectedSubjectId !== "all") {
      result = result.filter(p => p.subject_id == selectedSubjectId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.language?.toLowerCase().includes(q) ||
          p.subject_name.toLowerCase().includes(q),
      );
    }

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

  // Memoized Handlers
  const handleViewResult = useCallback(async (
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
        id: (subData as any).id,
        practical_id: (subData as any).practical_id ?? 0,
        practical_title: practicalTitle,
        code: (subData as any).code || "",
        output: (subData as any).output || "",
        language: (subData as any).language || "unknown",
        status: (subData as any).status || "pending",
        created_at: (subData as any).created_at,
        marks_obtained: (subData as any).marks_obtained,
        testCaseResults: ((subData as any).execution_details as any)?.results || [],
      });
    } catch (err) {
      console.error("Failed to fetch result:", err);
    } finally {
      setLoadingDetails(false);
    }
  }, [user, supabase]);

  const navigateToPractical = useCallback((practical: FormattedPractical) => {
    const examParams = practical.exam_id
      ? `&isExam=true&examId=${encodeURIComponent(practical.exam_id)}`
      : "";

    router.push(
      `/editor?practicalId=${practical.id}&subject=${practical.subject_id || 0}&language=${practical.language || "java"}${practical.hasLevels ? "&hasLevels=true" : ""}${examParams}`,
    );
  }, [router]);

  const handleStartPractical = useCallback((practical: FormattedPractical) => {
    if (hasExamEnded(practical)) {
      toast.error("This exam is closed.");
      return;
    }

    if (practical.is_locked) {
      toast.warning("This practical is locked. " + (practical.lock_reason || "Please complete the previous practical first."));
      return;
    }

    const remainingAttempts = practical.max_attempts - practical.attempt_count;

    if (remainingAttempts <= 0) {
      toast.error("You have no remaining attempts for this exam.");
      return;
    }

    if (remainingAttempts === 1) {
      setAttemptWarning({ show: true, practical });
      return;
    }

    navigateToPractical(practical);
  }, [navigateToPractical]);

  const handleRequestReattempt = useCallback(async (practical: FormattedPractical) => {
    try {
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
    } catch (err: any) {
      console.error("Re-attempt request failed:", err);
      toast.error(err.response?.data?.error || "Failed to send request.");
    }
  }, []);

  const groupedPracticals = useMemo(() => {
    const groups: { [key: number]: FormattedPractical[] } = {};
    const others: FormattedPractical[] = [];

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

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update filtered content to use debouncedSearch
  const filteredContent = useMemo(() => {
    let result = sequencedPracticals;

    if (selectedSubjectId !== "all") {
      result = result.filter(p => p.subject_id == selectedSubjectId);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.language?.toLowerCase().includes(q) ||
          p.subject_name.toLowerCase().includes(q),
      );
    }

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
  }, [sequencedPracticals, activeFilter, debouncedSearch, selectedSubjectId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              My Exams
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              View and take your scheduled exams
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
                  {selectedSubjectId === "all" ? "Assignment Overview" : subjects.find(s => s.id === selectedSubjectId)?.name}
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
            {filteredContent.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 bg-white/50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700"
              >
                <FileCode className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  No exams found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                  Adjust your filters to see exams.
                </p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {Object.entries(groupedPracticals.groups).map(([subjectId, items]) => {
                  const sId = Number(subjectId);
                  const subject = subjects.find(s => s.id === sId) || { name: "Unknown Subject" };
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
                          </div>
                        </div>
                      )}

                      <div className={cn(
                        "grid gap-4",
                        viewMode === "grid"
                          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                          : "grid-cols-1"
                      )}>
                        {items.map(p => viewMode === "grid" ? (
                          <PracticalCard 
                            key={p.id} 
                            p={p} 
                            onStart={handleStartPractical} 
                            onViewResult={handleViewResult} 
                            onRequestReattempt={handleRequestReattempt}
                            itemVariants={itemVariants}
                          />
                        ) : (
                          <PracticalListItem 
                            key={p.id} 
                            p={p} 
                            onStart={handleStartPractical} 
                            onViewResult={handleViewResult} 
                            onRequestReattempt={handleRequestReattempt}
                            itemVariants={itemVariants}
                            getStatusGradient={getStatusGradient}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
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
                            {viewingSubmission.marks_obtained} / {sequencedPracticals.find(p => p.id === viewingSubmission.practical_id)?.max_marks || 10}
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
                        <Code2 className="w-4 h-4 text-indigo-500" /> Submitted Code
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
                    const latestPractical = practicals.find(
                      (p) => p.id === attemptWarning.practical?.id,
                    );
                    const target = latestPractical || attemptWarning.practical;
                    const remainingAttempts = target.max_attempts - target.attempt_count;

                    if (remainingAttempts <= 0) {
                      toast.error("You have no remaining attempts for this exam.");
                    } else {
                      navigateToPractical(target);
                    }
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
