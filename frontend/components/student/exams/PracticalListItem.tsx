"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Clock, Code2, RefreshCw, AlertTriangle, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import { FormattedPractical } from "./types";

interface PracticalListItemProps {
  p: FormattedPractical;
  onStart: (p: FormattedPractical) => void;
  onViewResult: (id: number, title: string) => void;
  onRequestReattempt: (p: FormattedPractical) => void;
  itemVariants: any;
  getStatusGradient: (status: string) => string;
}

const PracticalListItem = memo(({
  p,
  onStart,
  onViewResult,
  onRequestReattempt,
  itemVariants,
  getStatusGradient,
}: PracticalListItemProps) => {
  const isDone = ["passed", "failed", "completed"].includes(p.status);
  const isSubmitted = p.status === "submitted";
  const isUrgent = false;

  const hasExamEnded = (practical: FormattedPractical) => {
    if (!practical.exam_end_time) return false;
    const endTime = new Date(practical.exam_end_time);
    if (Number.isNaN(endTime.getTime())) return false;
    return Date.now() > endTime.getTime();
  };

  const examClosed = hasExamEnded(p);

  return (
    <motion.div
      variants={itemVariants}
      key={p.id}
      className={cn(
        "group w-full rounded-xl p-4 transition-all duration-300 hover:bg-white/60 dark:hover:bg-gray-900/60 border border-gray-200 dark:border-gray-700/50 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md",
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
            {p.is_exam ? (
              <Sparkles className="w-5 h-5" />
            ) : (
              p.practical_number ?? p.id
            )}
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
                {p.max_attempts - p.attempt_count} attempts left
              </span>
            )}
            <StatusBadge status={p.status} />
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
              {p.status === "failed" && p.attempt_count < p.max_attempts && (
                <Button size="icon" variant="outline" className="w-8 h-8 text-orange-600 border-orange-200 bg-orange-50/50" onClick={() => onStart(p)} disabled={p.is_locked || examClosed}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}

              {p.status === "failed" && p.attempt_count >= p.max_attempts && (
                (p.lock_reason?.includes("Re-attempt Requested")) ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800/50 text-xs font-bold animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Pending</span>
                  </div>
                ) : (
                  <Button size="icon" variant="outline" className="w-8 h-8 text-purple-600 border-purple-200 bg-purple-50/50" onClick={() => onRequestReattempt(p)}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </Button>
                )
              )}

              <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); onViewResult(p.id, p.title); }}>
                {isSubmitted ? "View Submission" : "Result"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            className={cn("h-8 text-xs px-4", isUrgent ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700")}
            onClick={() => onStart(p)}
            disabled={p.is_locked || examClosed}
          >
            {p.is_locked ? "Locked" : examClosed ? "Closed" : "Start"}
            {!p.is_locked && !examClosed && <ArrowRight className="w-3 h-3 ml-1.5" />}
          </Button>
        )}
      </div>
    </motion.div>
  );
});

PracticalListItem.displayName = "PracticalListItem";

export default PracticalListItem;
