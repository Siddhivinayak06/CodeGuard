"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import { FilterType } from "./types";

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: { all: number; pending: number; overdue: number; completed: number };
}

const FilterTabs = memo(({
  activeFilter,
  onFilterChange,
  counts,
}: FilterTabsProps) => {
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
});

FilterTabs.displayName = "FilterTabs";

export default FilterTabs;
