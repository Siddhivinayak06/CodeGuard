"use client";

import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { memo } from "react";

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = memo(({ status }: StatusBadgeProps) => {
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
    completed: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    submitted: {
      bg: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
      text: "text-blue-700 dark:text-blue-400",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    in_progress: {
        bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
        text: "text-amber-700 dark:text-amber-400",
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
    overdue: {
        bg: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
        text: "text-orange-700 dark:text-orange-400",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
    }
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
});

StatusBadge.displayName = "StatusBadge";

export default StatusBadge;
