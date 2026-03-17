"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Clock, Code2, Lock, ArrowRight, RefreshCw, AlertTriangle, Loader2, Sparkles, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import { FormattedPractical } from "./types";

interface PracticalCardProps {
  p: FormattedPractical;
  onStart: (p: FormattedPractical) => void;
  onViewResult: (id: number, title: string) => void;
  onRequestReattempt: (p: FormattedPractical) => void;
  itemVariants: any;
}

const PracticalCard = memo(({
  p,
  onStart,
  onViewResult,
  onRequestReattempt,
  itemVariants,
}: PracticalCardProps) => {
  const isDone = ["passed", "failed", "completed"].includes(p.status);
  const isSubmitted = p.status === "submitted";
  const isUrgent = false;
  const showLocked = p.is_locked && !isDone && !isSubmitted;
  
  const hasExamEnded = (practical: FormattedPractical) => {
    if (!practical.exam_end_time) return false;
    const endTime = new Date(practical.exam_end_time);
    if (Number.isNaN(endTime.getTime())) return false;
    return Date.now() > endTime.getTime();
  };

  const examClosed = hasExamEnded(p);
  const hasNoAttemptsLeft = p.attempt_count >= p.max_attempts;

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
      <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300`}
          >
            <span className="text-lg font-black text-white drop-shadow-sm">
              {p.is_exam ? (
                <Sparkles className="w-6 h-6" />
              ) : (
                p.practical_number ?? p.id
              )}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug" title={p.title}>
              {p.title}
            </h4>
          </div>
        </div>

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

        {p.is_exam && p.exam_start_time ? (
          <div className="flex items-center gap-2 mb-3 text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80 bg-indigo-50/60 dark:bg-indigo-900/10 px-2.5 py-1.5 rounded-lg w-fit">
            <Clock className="w-3 h-3 shrink-0" />
            <span>
              {new Date(p.exam_start_time).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              {` · ${new Date(p.exam_start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
              {p.exam_end_time && ` – ${new Date(p.exam_end_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
        ) : p.schedule_date && (
          <div className="flex items-center gap-2 mb-3 text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80 bg-indigo-50/60 dark:bg-indigo-900/10 px-2.5 py-1.5 rounded-lg w-fit">
            <Clock className="w-3 h-3 shrink-0" />
            <span>
              {new Date(p.schedule_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              {p.schedule_time && ` · ${formatTime(p.schedule_time)}`}
            </span>
          </div>
        )}

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
              onClick={() => onStart(p)}
              disabled={p.is_locked || hasNoAttemptsLeft || examClosed}
            >
              <span className="flex items-center gap-2">
                {p.is_locked
                  ? "Locked"
                  : examClosed
                    ? "Closed"
                  : hasNoAttemptsLeft
                    ? "Attempts Exhausted"
                  : p.status === "in_progress"
                    ? "Continue"
                    : "Start"}
                {!p.is_locked && !hasNoAttemptsLeft && !examClosed && (
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                )}
              </span>
            </Button>
          ) : (
            <>
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
                {p.status === "failed" && p.attempt_count < p.max_attempts && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStart(p)}
                    className="gap-1 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 bg-orange-50/50 dark:border-orange-800/50 dark:bg-orange-900/10 dark:hover:bg-orange-900/20 dark:text-orange-400"
                    title={p.is_locked ? "Practical Locked" : "Try Again"}
                    disabled={p.is_locked}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </Button>
                )}

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
                      onClick={() => onRequestReattempt(p)}
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
                    onViewResult(p.id, p.title);
                  }}
                >
                  {isSubmitted ? "View Submission" : "Result"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});

PracticalCard.displayName = "PracticalCard";

export default PracticalCard;
