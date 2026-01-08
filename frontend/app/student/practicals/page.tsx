"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Clock,
  Code,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Target,
  Trophy,
  Zap,
  Calendar,
  Search,
  Sparkles,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

import { Tables } from "@/lib/supabase/database.types";

// ============================================================================
// TYPES
// ============================================================================

type PracticalLevel = Tables<"practical_levels">;
type Subject = Tables<"subjects">;

interface PracticalWithRelations extends Tables<"practicals"> {
  subjects: Pick<Subject, "subject_name"> | null;
  practical_levels: PracticalLevel[];
}

interface StudentPracticalJoined extends Tables<"student_practicals"> {
  practicals: PracticalWithRelations | null;
}

interface ScheduleAllocationJoined extends Tables<"schedule_allocations"> {
  schedule: (Tables<"schedules"> & {
    practicals: PracticalWithRelations | null;
  }) | null;
}

interface FormattedPractical {
  id: number;
  subject_id: number | null;
  practical_id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue' | 'passed' | 'failed' | 'submitted' | 'pending';
  subject_name: string;
  language: string | null;
  hasLevels: boolean;
  attempt_count?: number;
  max_attempts?: number;
  is_locked?: boolean;
  marks_obtained?: number;
  max_marks?: number;
  notes?: string | null;
  levels?: PracticalLevel[];
}

type FilterType = 'all' | 'pending' | 'overdue' | 'completed';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimeRemaining(deadline: string): { text: string; urgency: 'overdue' | 'urgent' | 'soon' | 'normal'; days: number } {
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    return { text: overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`, urgency: 'overdue', days: -overdueDays };
  }
  if (diffDays === 0) {
    if (diffHours <= 0) return { text: "Due now!", urgency: 'overdue', days: 0 };
    return { text: diffHours === 1 ? "1 hour left" : `${diffHours} hours left`, urgency: 'urgent', days: 0 };
  }
  if (diffDays === 1) return { text: "Due tomorrow", urgency: 'urgent', days: 1 };
  if (diffDays <= 3) return { text: `${diffDays} days left`, urgency: 'soon', days: diffDays };
  return { text: `${diffDays} days left`, urgency: 'normal', days: diffDays };
}

function getLanguageGradient(lang: string) {
  switch (lang?.toLowerCase()) {
    case "python": return "from-yellow-400 via-amber-500 to-orange-500";
    case "java": return "from-orange-500 via-red-500 to-rose-600";
    case "c": return "from-blue-400 via-blue-500 to-indigo-600";
    case "c++": return "from-purple-500 via-violet-500 to-fuchsia-500";
    case "javascript": return "from-yellow-300 via-amber-400 to-orange-400";
    default: return "from-indigo-500 via-purple-500 to-pink-500";
  }
}

function getMotivationalMessage(completed: number, pending: number, total: number): string {
  if (total === 0) return "Ready to start your journey? 🚀";
  if (pending === 0) return "Perfect score! You're amazing ⭐";
  if (completed === 0) return "Let's crush these practicals! 💪";
  const percent = (completed / total) * 100;
  if (percent >= 80) return `Almost there! Just ${pending} left 🎯`;
  if (percent >= 50) return `Amazing progress! ${pending} to go 🔥`;
  if (percent >= 25) return `Keep the momentum! ${pending} remaining 💪`;
  return `${pending} exciting practicals ahead 📚`;
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Animated background orbs
function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute top-20 -left-40 w-80 h-80 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-float" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-gradient-to-r from-blue-400/15 to-cyan-400/15 rounded-full blur-3xl animate-float-reverse" />
      <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 rounded-full blur-3xl animate-float-slow" />
    </div>
  );
}

// Progress Ring with glow effect
function ProgressRing({ progress, size = 90 }: { progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative animate-scaleIn" style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-20 blur-xl"
        style={{ transform: 'scale(0.8)' }}
      />
      <svg className="progress-ring drop-shadow-lg" width={size} height={size}>
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle
          className="stroke-gray-200/50 dark:stroke-gray-700/50"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke="url(#progressGradient)"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
          {Math.round(progress)}%
        </span>
        <span className="text-[9px] text-gray-400 uppercase tracking-widest">complete</span>
      </div>
    </div>
  );
}

// Clickable Progress Bar with gradient
function ProgressBar({ completed, pending, total, onSegmentClick }: {
  completed: number; pending: number; total: number;
  onSegmentClick: (filter: FilterType) => void;
}) {
  const completedPercent = total > 0 ? (completed / total) * 100 : 0;
  const pendingPercent = total > 0 ? (pending / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full overflow-hidden flex shadow-inner">
        <button
          onClick={() => onSegmentClick('completed')}
          className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 transition-all duration-1000 ease-out hover:brightness-110 cursor-pointer relative overflow-hidden"
          style={{ width: `${completedPercent}%` }}
          title={`${completed} completed`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
        </button>
        <button
          onClick={() => onSegmentClick('pending')}
          className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 transition-all duration-1000 ease-out hover:brightness-110 cursor-pointer relative overflow-hidden"
          style={{ width: `${pendingPercent}%` }}
          title={`${pending} pending`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
        </button>
      </div>
      <div className="flex items-center gap-6 mt-3">
        <button onClick={() => onSegmentClick('completed')} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-emerald-600 transition-colors group">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/30 group-hover:scale-110 transition-transform" />
          <span className="font-medium">{completed}</span> Done
        </button>
        <button onClick={() => onSegmentClick('pending')} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-amber-600 transition-colors group">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-sm shadow-amber-500/30 group-hover:scale-110 transition-transform" />
          <span className="font-medium">{pending}</span> Pending
        </button>
      </div>
    </div>
  );
}

// Glassmorphic Pill Filters
function PillFilters({ activeFilter, onFilterChange, counts }: {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: { all: number; pending: number; overdue: number; completed: number };
}) {
  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-full border border-white/20 dark:border-gray-700/50 shadow-lg shadow-black/5">
      {filters.map((f) => {
        const isActive = activeFilter === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${isActive
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/30"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
          >
            {f.label} <span className={isActive ? "text-white/80" : "text-gray-400"}>{f.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// Shimmer Skeleton Card
function SkeletonCard() {
  return (
    <div className="relative p-5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-800/50 overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg" />
          <div className="h-3 w-1/2 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg" />
        </div>
      </div>
      <div className="h-10 w-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-xl" />
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
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch user
  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) { router.push("/auth/login"); return; }
        if (mountedRef.current) setUser(user);
      } catch { router.push("/auth/login"); }
    };
    fetchUser();
    return () => { mountedRef.current = false; };
  }, [router, supabase]);

  // Fetch practicals with Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchPracticals = async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        // 1. Fetch Assignments (Manual & Batch)
        const { data: manualData, error: manualErr } = await supabase
          .from("student_practicals")
          .select("practical_id, assigned_deadline, status, notes, is_locked, attempt_count, max_attempts")
          .eq("student_id", user.id);

        if (manualErr) throw manualErr;

        const { data: batchData, error: batchErr } = await supabase
          .from("schedule_allocations")
          .select("schedule:schedules (date, practical_id)")
          .eq("student_id", user.id);

        if (batchErr) throw batchErr;

        // 2. Collect all Practical IDs
        const practicalIds = new Set<number>();
        (manualData || []).forEach(item => {
          if (item.practical_id) practicalIds.add(item.practical_id);
        });

        // Fix: correctly type the batch data explicitly or handle safely
        (batchData || []).forEach((item: any) => {
          if (item.schedule?.practical_id) {
            practicalIds.add(item.schedule.practical_id);
          }
        });

        if (practicalIds.size === 0) {
          if (mountedRef.current) setPracticals([]);
          return;
        }

        // 3. Fetch Practical Details
        const { data: practicalsDetails, error: detailsErr } = await supabase
          .from("practicals")
          .select(`
            id, title, description, language, subject_id, max_marks,
            subjects ( subject_name ),
            practical_levels ( id, level, title, description, max_marks )
          `)
          .in("id", Array.from(practicalIds));

        if (detailsErr) throw detailsErr;

        // 4. Fetch Submissions
        const { data: submissions, error: subsErr } = await supabase
          .from("submissions")
          .select("practical_id, status, marks_obtained")
          .eq("student_id", user.id)
          .in("practical_id", Array.from(practicalIds));

        if (subsErr) throw subsErr;

        // 5. Merge Data
        const detailsMap = new Map(practicalsDetails?.map(p => [p.id, p]));
        const submissionMap = new Map(submissions?.map(s => [s.practical_id, s]));

        const combinedPracticals: FormattedPractical[] = [];
        const processedIds = new Set<number>();

        // Process Manual Assignments
        (manualData || []).forEach(sp => {
          if (!sp.practical_id) return;
          const p = detailsMap.get(sp.practical_id);
          if (!p) return;

          processedIds.add(p.id);
          const sub = submissionMap.get(p.id);
          // @ts-ignore - Supabase types handling
          const levels = p.practical_levels || [];

          combinedPracticals.push({
            id: p.id,
            practical_id: p.id,
            title: p.title,
            description: p.description,
            language: p.language,
            deadline: sp.assigned_deadline,
            subject_id: p.subject_id,
            // @ts-ignore
            subject_name: p.subjects?.subject_name || "Unknown",
            status: (sub?.status || sp.status || 'assigned') as any,
            notes: sp.notes,
            hasLevels: levels.length > 0,
            // @ts-ignore
            levels: levels.sort((a, b) => {
              const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
              return (order[a.level] || 0) - (order[b.level] || 0);
            }),
            is_locked: sp.is_locked || (sp.attempt_count || 0) >= (sp.max_attempts || 1),
            attempt_count: sp.attempt_count || 0,
            max_attempts: sp.max_attempts || 1,
            marks_obtained: sub?.marks_obtained ?? undefined,
            max_marks: p.max_marks || levels.reduce((acc: number, l: any) => acc + (l.max_marks || 0), 0) || 100
          });
        });

        // Process Batch Assignments
        (batchData || []).forEach((item: any) => {
          const sched = item.schedule;
          if (!sched?.practical_id) return;
          if (processedIds.has(sched.practical_id)) return; // Don't duplicate if already added via manual

          const p = detailsMap.get(sched.practical_id);
          if (!p) return;

          processedIds.add(p.id);
          const sub = submissionMap.get(p.id);
          // @ts-ignore
          const levels = p.practical_levels || [];

          combinedPracticals.push({
            id: p.id,
            practical_id: p.id,
            title: p.title,
            description: p.description,
            language: p.language,
            deadline: sched.date,
            subject_id: p.subject_id,
            // @ts-ignore
            subject_name: p.subjects?.subject_name || "Unknown",
            status: (sub?.status || 'assigned') as any, // Batch assignments don't have separate status in allocation
            notes: "",
            hasLevels: levels.length > 0,
            // @ts-ignore
            levels: levels.sort((a, b) => {
              const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
              return (order[a.level] || 0) - (order[b.level] || 0);
            }),
            is_locked: false,
            attempt_count: 0,
            max_attempts: 1,
            marks_obtained: sub?.marks_obtained ?? undefined,
            max_marks: p.max_marks || levels.reduce((acc: number, l: any) => acc + (l.max_marks || 0), 0) || 100
          });
        });

        combinedPracticals.sort((a, b) => {
          const timeA = (a.deadline && typeof a.deadline === 'string') ? new Date(a.deadline).getTime() : Infinity;
          const timeB = (b.deadline && typeof b.deadline === 'string') ? new Date(b.deadline).getTime() : Infinity;
          return timeA - timeB;
        });

        if (!signal.aborted && mountedRef.current) setPracticals(combinedPracticals);

      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") console.error("Fetch Error:", err);
      } finally {
        if (!signal.aborted && mountedRef.current && !isBackground) setLoading(false);
      }
    };

    fetchPracticals();

    // subscriptions
    const channel = supabase
      .channel(`student-practicals-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_practicals', filter: `student_id=eq.${user.id}` },
        () => fetchPracticals(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_allocations', filter: `student_id=eq.${user.id}` },
        () => fetchPracticals(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `student_id=eq.${user.id}` },
        () => fetchPracticals(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      controller.abort();
    };
  }, [user?.id, supabase]);

  // Stats
  const stats = useMemo(() => {
    const doneStatuses = ['passed', 'failed', 'completed'];
    const total = practicals.length;
    const completed = practicals.filter(p => doneStatuses.includes(p.status)).length;
    const pending = total - completed;
    const overdue = practicals.filter(p => !doneStatuses.includes(p.status) && p.deadline && typeof p.deadline === 'string' && new Date(p.deadline).getTime() < Date.now()).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    // Sort logic handled in formatting, but to get next deadline we need sorting
    const nextDeadline = practicals
      .filter(p => !doneStatuses.includes(p.status) && p.deadline && typeof p.deadline === 'string' && new Date(p.deadline).getTime() > Date.now())
      .sort((a, b) => (new Date(a.deadline!).getTime()) - (new Date(b.deadline!).getTime()))[0];

    const nextDeadlineDays = nextDeadline && nextDeadline.deadline
      ? Math.ceil((new Date(nextDeadline.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return { total, completed, pending, overdue, progress, nextDeadlineDays };
  }, [practicals]);

  // Filter & search
  const filteredPracticals = useMemo(() => {
    const doneStatuses = ['passed', 'failed', 'completed'];
    let result = practicals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.language?.toLowerCase().includes(q) || p.subject_name.toLowerCase().includes(q));
    }
    switch (activeFilter) {
      case 'pending': return result.filter(p => !doneStatuses.includes(p.status));
      case 'overdue': return result.filter(p => !doneStatuses.includes(p.status) && p.deadline && typeof p.deadline === 'string' && new Date(p.deadline).getTime() < Date.now());
      case 'completed': return result.filter(p => doneStatuses.includes(p.status));
      default: return result;
    }
  }, [practicals, activeFilter, searchQuery]);

  // Categorize
  const doneStatuses = ['passed', 'failed', 'completed'];
  const pendingPracticals = filteredPracticals.filter(p => !doneStatuses.includes(p.status));
  const completedPracticals = filteredPracticals.filter(p => doneStatuses.includes(p.status));
  const urgentPracticals = pendingPracticals.filter(p => p.deadline && typeof p.deadline === 'string' && Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3)
    .sort((a, b) => (a.deadline && typeof a.deadline === 'string' && b.deadline && typeof b.deadline === 'string') ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime() : 0);

  const urgentIds = new Set(urgentPracticals.map(p => p.id));
  const regularPending = pendingPracticals.filter(p => !urgentIds.has(p.id));

  // Loading
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-200 dark:border-indigo-800" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-indigo-500 animate-spin" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Loading your practicals...</p>
        </div>
      </div>
    );
  }

  // Render Premium Card
  const renderCard = (p: FormattedPractical, index: number, variant: 'urgent' | 'pending' | 'completed') => {
    const isDone = doneStatuses.includes(p.status);
    const isOverdue = p.deadline && new Date(p.deadline) < new Date() && !isDone;
    const timeInfo = p.deadline ? formatTimeRemaining(p.deadline) : null;
    const isUrgent = variant === 'urgent';
    const isCompleted = variant === 'completed';

    return (
      <div
        key={p.id}
        className={`group relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden
          ${isUrgent
            ? "bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-950/40 dark:via-orange-950/30 dark:to-amber-950/20 border border-red-200/50 dark:border-red-800/30 shadow-lg shadow-red-500/10"
            : isCompleted
              ? "bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-800/50 opacity-75 hover:opacity-100"
              : "bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border border-white/50 dark:border-gray-700/50 shadow-lg shadow-indigo-500/5 hover:shadow-indigo-500/10"
          }`}
      // Removed animationDelay to prevent visibility issues
      >
        {/* Decorative gradient orb */}
        <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-50 ${isUrgent ? "bg-gradient-to-r from-red-400 to-orange-400" :
          isCompleted ? "bg-gradient-to-r from-emerald-400 to-teal-400" :
            "bg-gradient-to-r from-indigo-400 to-purple-400"
          }`} />

        {/* Urgent indicator */}
        {isUrgent && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />
        )}

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`w - 12 h - 12 rounded - xl bg - gradient - to - br ${getLanguageGradient(p.language || 'unknown')
              } flex items - center justify - center shadow - lg ${isUrgent ? "shadow-red-500/20" : "shadow-indigo-500/20"
              }`}>
              <Code className="w-6 h-6 text-white drop-shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font - bold text - base line - clamp - 1 mb - 1 ${isCompleted ? "text-gray-500" : "text-gray-900 dark:text-white"}`}>
                {p.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                {p.description || "Complete this practical assignment"}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-800/80 px-2.5 py-1 rounded-full">
              <BookOpen className="w-3 h-3" />
              {p.subject_name}
            </span>
            {p.language && (
              <span className={`text - [11px] font - bold px - 2.5 py - 1 rounded - full text - white bg - gradient - to - r ${getLanguageGradient(p.language)
                } shadow - sm`}>
                {p.language}
              </span>
            )}
            {isOverdue && timeInfo && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2.5 py-1 rounded-full animate-pulse">
                <AlertCircle className="w-3 h-3" />
                {timeInfo.text}
              </span>
            )}
          </div>


          {/* Footer - Derived State Machine */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            {(() => {
              const attempts = p.attempt_count || 0;
              const max = p.max_attempts || 1;
              // isCompleted variable from existing code might be based on schedule? 
              // Let's rely on p.status and is_locked for source of truth.
              const status = p.status || 'assigned';
              const lockedState = p.is_locked || attempts >= max;

              // Case 1: Completed / Passed
              if (status === 'completed' || status === 'passed') {
                return (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                    <Button size="sm" disabled className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800 cursor-not-allowed">
                      Score: {p.marks_obtained || p.max_marks}
                    </Button>
                  </>
                );
              }

              // Case 2: Failed + Attempts Left -> Retry
              if (status === 'failed' && !lockedState) {
                return (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      <AlertCircle className="w-3.5 h-3.5" /> Retry Available ({attempts}/{max})
                    </span>
                    <Button
                      onClick={() => router.push(`/editor?practicalId=${encodeURIComponent(p.id)}&subject=${encodeURIComponent(p.subject_id || 0)}&language=${encodeURIComponent(p.language || 'java')}${p.hasLevels ? '&hasLevels=true' : ''}`)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/25"
                    >
                      Retry Now <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                );
              }

              // Case 3: Exhausted / Locked
              if (lockedState) {
                return (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Attempts Exhausted ({attempts}/{max})
                    </span>
                    <Button size="sm" disabled className="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 border border-transparent font-bold cursor-not-allowed">
                      Locked
                    </Button>
                  </>
                );
              }

              // Case 4: Pending / Under Review (Submitted but not passed/failed yet?)
              if (status === 'in_progress' && attempts > 0) {
                // Could be 'in_progress' meaning they started but didn't finish?
                // Or 'pending' submission?
                // If in_progress and not locked, it's basically "Continue"
                return (
                  <>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      In Progress ({attempts}/{max})
                    </span>
                    <Button
                      onClick={() => router.push(`/editor?practicalId=${encodeURIComponent(p.id)}&subject=${encodeURIComponent(p.subject_id || 0)}&language=${encodeURIComponent(p.language || 'java')}${p.hasLevels ? '&hasLevels=true' : ''}`)}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/25"
                    >
                      Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                );
              }

              // Default: Start (Assigned)
              const isUrgentLocal = timeInfo && timeInfo.urgency === 'urgent';
              return (
                <>
                  {!timeInfo ? <span className="text-xs text-gray-400">No deadline</span> : (
                    <div className={`flex items - center gap - 1.5 text - xs font - medium ${isUrgentLocal ? 'text-orange-600' : 'text-gray-500'} `}>
                      <Clock className="w-3.5 h-3.5" /> {timeInfo.text}
                    </div>
                  )}
                  <Button
                    onClick={() => router.push(`/editor?practicalId=${encodeURIComponent(p.id)}&subject=${encodeURIComponent(p.subject_id || 0)}&language=${encodeURIComponent(p.language || 'java')}${p.hasLevels ? '&hasLevels=true' : ''}`)}
                    size="sm"
                    className={isUrgentLocal
                      ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/25 font-bold"
                      : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 font-bold"
                    }
                  >
                    {isUrgentLocal ? "Start Now" : "Start"} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/20">
      <BackgroundOrbs />

      <div className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* ====== HEADER ====== */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-500/30">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
                My Practicals
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Track and conquer your assignments
              </p>
            </div>
          </div>

          {/* Search */}
          {!loading && practicals.length > 0 && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search practicals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full lg:w-80 pl-12 pr-5 py-3 text-sm bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border border-white/50 dark:border-gray-700/50 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
          )}
        </div>

        {/* ====== CONTENT ====== */}
        {loading ? (
          <div className="space-y-8">
            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-gray-800/50 animate-pulse">
              <div className="flex items-center gap-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600" />
                <div className="flex-1 space-y-4">
                  <div className="h-3 w-full max-w-md bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full" />
                  <div className="h-5 w-48 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        ) : practicals.length === 0 ? (
          <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-16 text-center border border-white/50 dark:border-gray-800/50 max-w-lg mx-auto">
            <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center">
              <FileCode className="w-12 h-12 text-indigo-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Practicals Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Your instructor will assign practicals soon.</p>
            <div className="inline-flex items-center gap-2 text-sm text-indigo-500 font-medium">
              <Zap className="w-4 h-4" /> Check back later
            </div>
          </div>
        ) : (
          <div className="space-y-10">

            {/* Progress Card */}
            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 border border-white/50 dark:border-gray-800/50 shadow-xl shadow-indigo-500/5">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <ProgressRing progress={stats.progress} size={100} />
                <div className="flex-1 w-full">
                  <p className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    {getMotivationalMessage(stats.completed, stats.pending, stats.total)}
                  </p>
                  <ProgressBar completed={stats.completed} pending={stats.pending} total={stats.total} onSegmentClick={setActiveFilter} />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <PillFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} counts={{ all: practicals.length, pending: stats.pending, overdue: stats.overdue, completed: stats.completed }} />
              {stats.nextDeadlineDays !== null && activeFilter !== 'completed' && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  Next deadline in <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats.nextDeadlineDays}</span> day{stats.nextDeadlineDays !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Urgent Section */}
            {activeFilter !== 'completed' && urgentPracticals.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/25">
                    <Flame className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Needs Attention</h2>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                    {urgentPracticals.length} urgent
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {urgentPracticals.map((p, i) => renderCard(p, i, 'urgent'))}
                </div>
              </div>
            )}

            {/* Pending Section */}
            {activeFilter !== 'completed' && regularPending.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upcoming</h2>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    {regularPending.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularPending.map((p, i) => renderCard(p, i, 'pending'))}
                </div>
              </div>
            )}

            {/* All Caught Up */}
            {pendingPracticals.length === 0 && completedPracticals.length > 0 && activeFilter !== 'completed' && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-3xl p-10 text-center border border-emerald-200/50 dark:border-emerald-700/30">
                <Trophy className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">All Caught Up! 🎉</h3>
                <p className="text-emerald-600 dark:text-emerald-400">You&apos;ve completed all your practicals. Amazing work!</p>
              </div>
            )}

            {/* Completed Section */}
            {(activeFilter === 'all' || activeFilter === 'completed') && completedPracticals.length > 0 && (
              <div>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-800/50 hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all text-left"
                >
                  <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base font-bold text-gray-600 dark:text-gray-400">Completed</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    {completedPracticals.length}
                  </span>
                  <span className="text-sm text-gray-400 ml-auto mr-2">
                    {showCompleted ? '' : 'Well done! 💪'}
                  </span>
                  {showCompleted ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {showCompleted && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 animate-slideDown">
                    {completedPracticals.map((p, i) => renderCard(p, i, 'completed'))}
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {filteredPracticals.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No practicals found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
