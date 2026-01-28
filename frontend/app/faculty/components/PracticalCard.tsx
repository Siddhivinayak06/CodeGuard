// components/PracticalCard.tsx
"use client";

import React from "react";

type Practical = {
  id: number;
  title: string;
  description?: string;
  language?: string;
  deadline: string; // ISO string
  max_marks?: number;
  created_at?: string;
  practical_number?: number;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function PracticalCard({
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
  const safeDeadline = (() => {
    try {
      return new Date(practical.deadline);
    } catch {
      return new Date(NaN);
    }
  })();

  const isValidDate = !Number.isNaN(safeDeadline.getTime());
  const isPast = isValidDate ? safeDeadline.getTime() < Date.now() : false;
  const timeUntil = isValidDate
    ? Math.ceil((safeDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : Infinity;

  const deadlineLabel = isValidDate
    ? safeDeadline.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " • " +
    safeDeadline.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "No deadline";

  return (
    <div
      className="group relative p-5 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/5 transition-all duration-300"
      role="article"
      aria-label={practical.title}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1.5 truncate">
              {practical.practical_number ? <span className="mr-2 font-mono opacity-60">#{practical.practical_number}</span> : null}
              {practical.title}
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border border-purple-500/20 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full backdrop-blur-sm">
                {subject}
              </span>

              {practical.language && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border border-blue-500/20 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full backdrop-blur-sm">
                  {practical.language}
                </span>
              )}

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full backdrop-blur-sm border",
                  isPast
                    ? "bg-gradient-to-br from-gray-500/10 to-gray-600/10 dark:from-gray-500/20 dark:to-gray-600/20 border-gray-500/20 dark:border-gray-500/30 text-gray-700 dark:text-gray-300"
                    : timeUntil <= 2
                      ? "bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 border-orange-500/20 dark:border-orange-500/30 text-orange-700 dark:text-orange-300"
                      : "bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 border-green-500/20 dark:border-green-500/30 text-green-700 dark:text-green-300",
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isPast
                      ? "bg-gray-400"
                      : timeUntil <= 2
                        ? "bg-orange-500 animate-pulse"
                        : "bg-green-500",
                  )}
                />
                {isPast ? "Closed" : timeUntil <= 2 ? "Due Soon" : "Active"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>

            <span className="font-medium">{deadlineLabel}</span>

            {!isPast && isFinite(timeUntil) && timeUntil >= 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full">
                {timeUntil === 0
                  ? "Due today"
                  : timeUntil === 1
                    ? "Due tomorrow"
                    : `${timeUntil} days left`}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(practical)}
            className="p-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/30 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 rounded-xl transition-all"
            title="Edit"
            aria-label={`Edit ${practical.title}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          <button
            onClick={() => onDelete(practical.id)}
            className="p-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/30 text-gray-700 dark:text-gray-300 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 rounded-xl transition-all"
            title="Delete"
            aria-label={`Delete ${practical.title}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
