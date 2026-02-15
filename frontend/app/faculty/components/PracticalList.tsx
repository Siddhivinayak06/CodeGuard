"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";

import { Practical, Subject } from "../types";

/* Utilities */
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeDate(d?: string | null) {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function daysFromNow(d: Date | null) {
  if (!d) return Infinity;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/* Icons */
const CalendarIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const DotsIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const GridIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);

const ListIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

const EmptyIcon = () => (
  <svg
    className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="w-5 h-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

/* PracticalCard */
function PracticalCard({
  practical,
  subject,
  onEdit,
  onDelete,
  onAssign,
}: {
  practical: Practical;
  subject: string;
  onEdit?: (p: Practical) => void;
  onDelete?: (id: number) => void;
  onAssign?: (id: number) => void;
}) {
  const status = "active";

  const statusConfig = {
    active: {
      bg: "bg-white dark:bg-gray-900 border-l-4 border-l-indigo-500",
      text: "text-gray-900 dark:text-white",
      badge: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
      border: "border-indigo-100 dark:border-indigo-900/30",
      iconColor: "text-indigo-500",
      indicator: "bg-indigo-500"
    },
  };

  const config = statusConfig[status];

  return (
    <article
      tabIndex={0}
      className={cn(
        "group relative flex flex-col p-6 rounded-xl transition-all duration-300",
        "bg-white dark:bg-gray-900 border shadow-sm hover:shadow-lg hover:-translate-y-1",
        config.bg, // Apply left border
        "border-gray-100 dark:border-gray-800", // Default border
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-0 pointer-events-none group-hover:opacity-10 transition-opacity">
        <svg className={cn("w-24 h-24 transform rotate-12", config.iconColor)} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z" />
        </svg>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className={cn(
              "font-bold text-xl mb-3 line-clamp-2 leading-tight",
              config.text,
            )}
          >
            {practical.title}
          </h3>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              {subject}
            </span>

            {practical.language && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                {practical.language}
              </span>
            )}

            <span
              className={cn(
                "text-xs font-bold px-3 py-1.5 rounded-full",
                config.badge,
              )}
            >
              Active
            </span>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 line-clamp-2 mb-4">
            {practical.description || "No description provided."}
          </p>
        </div>

        {/* Right side - Actions & Marks */}
        <div className="flex flex-col items-end gap-3 z-10">
          <ActionMenu
            onEdit={() => onEdit?.(practical)}
            onDelete={() => onDelete?.(practical.id)}
            onAssign={() => onAssign?.(practical.id)}
          />

          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {practical.max_marks ?? "—"}
              </span>
              <span className="text-xs font-semibold text-gray-500 uppercase">pts</span>
            </div>
            <span className="text-[10px] font-medium text-gray-400">Total Marks</span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ActionMenu */
function ActionMenu({
  onEdit,
  onDelete,
  onAssign,
  disabledAssign,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onAssign?: () => void;
  disabledAssign?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="More actions"
      >
        <DotsIcon />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden backdrop-blur-sm">
          <button
            onClick={() => {
              setOpen(false);
              onEdit?.();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit Practical
          </button>

          <button
            onClick={() => {
              setOpen(false);
              if (!disabledAssign) onAssign?.();
            }}
            disabled={disabledAssign}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
              disabledAssign
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
            )}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Assign to Students
          </button>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <button
            onClick={() => {
              setOpen(false);
              onDelete?.();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Practical
          </button>
        </div>
      )}
    </div>
  );
}

/* Skeleton */
export function PracticalListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl p-5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 h-44 border border-gray-200 dark:border-gray-700"
        />
      ))}
    </div>
  );
}

/* Main Component */
export default function PracticalList({
  practicals,
  onEdit,
  onAssign,
  onDelete,
  subjects,
}: {
  practicals?: Practical[] | null;
  onEdit?: (p: Practical) => void;
  onAssign?: (id: number) => void;
  onDelete?: (id: number) => void;
  subjects?: Subject[] | null;
}) {
  const [mode, setMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter practicals based on search query
  const filteredPracticals = useMemo(() => {
    if (!practicals) return [];
    if (!searchQuery.trim()) return practicals;
    const query = searchQuery.toLowerCase();
    return practicals.filter((p) => {
      const subjObj = subjects?.find(
        (s) => String(s.id) === String(p.subject_id),
      );
      const subj = subjObj?.subject_name ?? "";
      return (
        p.title.toLowerCase().includes(query) ||
        (p.description || "").toLowerCase().includes(query) ||
        subj.toLowerCase().includes(query)
      );
    });
  }, [practicals, subjects, searchQuery]);

  if (!practicals) return <PracticalListSkeleton />;

  if (practicals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <EmptyIcon />
        <h3 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
          No practicals yet
        </h3>
        <p className="mt-2 text-center text-gray-600 dark:text-gray-400 max-w-md">
          Get started by creating your first practical assignment. It will
          appear here once created.
        </p>
        <button
          onClick={() => onEdit?.({} as Practical)}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create First Practical
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filters & Controls */}
      <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">

        {/* Search */}
        <div className="relative flex-1 w-full">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search practicals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {/* View Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setMode("list")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                mode === "list" ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <ListIcon />
            </button>
            <button
              onClick={() => setMode("grid")}
              className={cn(
                "p-1.5 rounded-md transition-all",
                mode === "grid" ? "bg-white dark:bg-gray-700 shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <GridIcon />
            </button>
          </div>

          {/* We could add Subject filter here if subjects are passed as props */}
          {subjects && subjects.length > 0 && (
            <select
              className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shrink-0"
              onChange={(e) => {
                // Implementing local filter logic for subject would require new state
                // For now just a placeholder or could filter searchQuery if simple
                setSearchQuery(e.target.value);
              }}
              value={subjects.some(s => s.subject_name === searchQuery) ? searchQuery : ""}
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.subject_name}>{s.subject_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Cards */}
      <div
        className={
          mode === "grid"
            ? "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4"
            : "space-y-4"
        }
      >
        {filteredPracticals.map((p) => {
          const subjObj = subjects?.find(
            (s) => String(s.id) === String(p.subject_id),
          );
          const subj = subjObj?.subject_name ?? "Unknown";
          return (
            <PracticalCard
              key={p.id}
              practical={p}
              subject={subj}
              onEdit={onEdit}
              onAssign={onAssign}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      {/* No results message */}
      {filteredPracticals.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <SearchIcon />
          <h3 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            No practicals found
          </h3>
          <p className="mt-2 text-center text-gray-600 dark:text-gray-400 max-w-md">
            No practicals match your search for "{searchQuery}". Try adjusting
            your search terms.
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            Clear Search
          </button>
        </div>
      )}
    </div>
  );
}
