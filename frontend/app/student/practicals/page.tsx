"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Calendar,
  Clock,
  Code,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  ArrowRight,
} from "lucide-react";

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    completed: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    overdue: {
      bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-400",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    in_progress: {
      bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-400",
      icon: <Loader2 className="w-3.5 h-3.5" />,
    },
    pending: {
      bg: "bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700",
      text: "text-slate-700 dark:text-slate-400",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  };

  const style = styles[status] || styles.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${style.bg} ${style.text}`}
    >
      {style.icon}
      {status.replace(/_/g, " ")}
    </span>
  );
}

// Skeleton loader
function SkeletonRow() {
  return (
    <div className="p-5 glass-card rounded-2xl animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

interface PracticalLevel {
  id: number;
  level: string;
  title: string;
  description: string;
  max_marks: number;
}

interface StudentPracticalJoined {
  id: number;
  assigned_deadline: string;
  status: string;
  notes: string;
  practicals: {
    id: number;
    title: string;
    description: string;
    language: string;
    subject_id: number;
    subjects: { subject_name: string } | null;
    practical_levels: PracticalLevel[];
  };
}

interface FormattedPractical {
  id: number;
  title: string;
  description: string;
  language: string;
  deadline: string;
  subject_id: number;
  subject_name: string;
  status: string;
  notes: string;
  hasLevels: boolean;
  levels: PracticalLevel[];
}

export default function StudentPracticals() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [practicals, setPracticals] = useState<FormattedPractical[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch the logged-in user
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
      } catch (err) {
        console.error("Unexpected auth error:", err);
        router.push("/auth/login");
      }
    };

    fetchUser();

    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // Fetch personalized practicals
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchPracticals = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("student_practicals")
          .select(`
            id,
            assigned_deadline,
            status,
            notes,
            practicals (
              id,
              title,
              description,
              language,
              subject_id,
              subjects ( subject_name ),
              practical_levels ( id, level, title, description, max_marks )
            )
          `)
          .eq("student_id", user.id)
          .order("assigned_deadline", { ascending: true });

        if (error) {
          console.error("Supabase fetch error:", error.message);
          setPracticals([]);
          return;
        }

        const formatted = (data as unknown as StudentPracticalJoined[] || []).map((sp) => {
          const levels = sp.practicals?.practical_levels || [];
          return {
            id: sp.practicals.id,
            title: sp.practicals.title,
            description: sp.practicals.description,
            language: sp.practicals.language,
            deadline: sp.assigned_deadline,
            subject_id: sp.practicals.subject_id,
            subject_name: sp.practicals.subjects?.subject_name || "Unknown",
            status: sp.status,
            notes: sp.notes,
            hasLevels: levels.length > 0,
            levels: levels.sort((a, b) => {
              const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
              return (order[a.level] || 0) - (order[b.level] || 0);
            }),
          };
        });

        if (!signal.aborted && mountedRef.current) {
          setPracticals(formatted);
        }
        if (error) {
          if ((error as any).code !== "PGRST116" && (error as any).message !== "JSON object requested, multiple (or no) rows returned") {
            console.error("Error fetching practicals:", error);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Unexpected fetch error:", err);
        }
      } finally {
        if (!signal.aborted && mountedRef.current) setLoading(false);
      }
    };

    fetchPracticals();

    return () => {
      controller.abort();
    };
  }, [user?.id, supabase]);

  // Get language icon color
  const getLanguageColor = (lang: string) => {
    switch (lang?.toLowerCase()) {
      case "python":
        return "from-yellow-400 to-blue-500";
      case "java":
        return "from-red-500 to-orange-500";
      case "c":
        return "from-blue-500 to-cyan-500";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = practicals.length;
    const completed = practicals.filter(p => p.status === 'completed').length;
    const inProgress = practicals.filter(p => p.status === 'in_progress').length;
    const pending = total - completed;

    return { total, completed, inProgress, pending };
  }, [practicals]);

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-slideUp">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gradient">
              Assigned Practicals
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-14">
            Complete your assigned programming tasks
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-black dark:text-gray-400">
          <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Assigned</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-150 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : stats.pending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : stats.completed}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : practicals.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FileCode className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Practicals Assigned
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              You don't have any practicals assigned yet. Check back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {practicals.map((p, index) => {
              const isOverdue =
                p.deadline && new Date(p.deadline) < new Date() && p.status !== "completed";
              const daysLeft = p.deadline
                ? Math.ceil(
                  (new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
                : null;

              return (
                <div
                  key={p.id}
                  className="glass-card-premium rounded-3xl p-6 hover-lift animate-slideUp group relative overflow-hidden"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Decorative Gradient Blob */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      {/* Language Icon */}
                      <div
                        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getLanguageColor(p.language)} flex items-center justify-center shadow-lg shadow-indigo-500/20`}
                      >
                        <Code className="w-7 h-7 text-white" />
                      </div>
                      <StatusBadge status={isOverdue ? "overdue" : p.status} />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2 line-clamp-1">
                        {p.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 px-2.5 py-1 rounded-lg">
                          <BookOpen className="w-3.5 h-3.5" />
                          {p.subject_name}
                        </span>
                        {p.language && (
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50">
                            {p.language}
                          </span>
                        )}
                        {/* Level badges for multi-level practicals */}
                        {p.hasLevels && (
                          <div className="flex items-center gap-1">
                            {p.levels.map((level) => {
                              const colors: Record<string, string> = {
                                easy: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                                medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
                                hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
                              };
                              return (
                                <span
                                  key={level.id}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors[level.level] || colors.easy}`}
                                >
                                  {level.level.charAt(0).toUpperCase()}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 h-10">
                        {p.description || "No description provided."}
                      </p>
                    </div>


                    <div className="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800/50 flex items-center justify-between">
                      {/* Deadline */}
                      {p.deadline ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Due Date</span>
                            <span
                              className={`font-semibold ${isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : daysLeft !== null && daysLeft <= 2
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-gray-700 dark:text-gray-300"
                                }`}
                            >
                              {new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No deadline</span>
                      )}

                      {/* Action */}
                      <Button
                        onClick={() =>
                          router.push(
                            `/editor?practicalId=${encodeURIComponent(p.id)}&subject=${encodeURIComponent(p.subject_id)}&language=${encodeURIComponent(p.language || 'java')}${p.hasLevels ? '&hasLevels=true' : ''}`
                          )
                        }
                        className="rounded-xl px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all font-medium"
                      >
                        Start
                        <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
