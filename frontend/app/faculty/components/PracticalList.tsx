"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";

/* Types */
type Practical = {
  id: number;
  subject_id: number | string;
  title: string;
  description?: string;
  language?: string;
  deadline: string;
  max_marks?: number;
  created_at?: string;
};

type Subject = { id: number | string; subject_name?: string; name?: string };

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
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const DotsIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const EmptyIcon = () => (
  <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
  const deadlineDate = useMemo(() => safeDate(practical.deadline), [practical.deadline]);
  const days = daysFromNow(deadlineDate);
  const isPast = deadlineDate ? deadlineDate.getTime() < Date.now() : false;

  const status = isPast ? "closed" : days <= 2 ? "due" : "active";

  const statusConfig = {
    closed: {
      bg: "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700",
      text: "text-gray-700 dark:text-gray-200",
      badge: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
      border: "border-gray-200 dark:border-gray-700"
    },
    due: {
      bg: "bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20",
      text: "text-orange-900 dark:text-orange-200",
      badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 border border-orange-200 dark:border-orange-800",
      border: "border-orange-200 dark:border-orange-800"
    },
    active: {
      bg: "bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10",
      text: "text-gray-900 dark:text-white",
      badge: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800",
      border: "border-gray-200 dark:border-gray-700"
    }
  };

  const config = statusConfig[status];

  return (
    <article
      tabIndex={0}
      className={cn(
        "group relative flex flex-col p-5 rounded-xl transition-all duration-300",
        "border shadow-sm hover:shadow-xl",
        "transform hover:-translate-y-1",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        config.bg,
        config.border
      )}
    >
      {/* Status stripe */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1 rounded-t-xl",
        status === "closed" ? "bg-gray-400" : status === "due" ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-gradient-to-r from-emerald-500 to-blue-500"
      )} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={cn("font-bold text-xl mb-3 line-clamp-2 leading-tight", config.text)}>
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
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {practical.language}
              </span>
            )}

            <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full", config.badge)}>
              {status === "closed" ? "Closed" : status === "due" ? (days <= 0 ? "Due Today" : `Due in ${days}d`) : "Active"}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 line-clamp-2 mb-4">
            {practical.description || "No description provided."}
          </p>

          {/* Footer info */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <CalendarIcon />
              <span className="font-medium">
                {deadlineDate ? deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "No deadline"}
              </span>
              {deadlineDate && (
                <span className="text-gray-500">
                  • {deadlineDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {deadlineDate && !isPast && days <= 7 && (
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold",
                days <= 1 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200" :
                  days <= 3 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200" :
                    "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-200"
              )}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `${days} days left`}
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-3">
          <ActionMenu
            onEdit={() => onEdit?.(practical)}
            onDelete={() => onDelete?.(practical.id)}
            onAssign={() => onAssign?.(practical.id)}
            disabledAssign={isPast}
          />

          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {practical.max_marks ?? "—"}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">pts</span>
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
            onClick={() => { setOpen(false); onEdit?.(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Practical
          </button>

          <button
            onClick={() => { setOpen(false); if (!disabledAssign) onAssign?.(); }}
            disabled={disabledAssign}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
              disabledAssign
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Assign to Students
          </button>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <button
            onClick={() => { setOpen(false); onDelete?.(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        <div key={i} className="animate-pulse rounded-xl p-5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 h-44 border border-gray-200 dark:border-gray-700" />
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
      const subjObj = subjects?.find((s) => String(s.id) === String(p.subject_id));
      const subj = subjObj?.subject_name ?? subjObj?.name ?? "";
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
        <h3 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">No practicals yet</h3>
        <p className="mt-2 text-center text-gray-600 dark:text-gray-400 max-w-md">
          Get started by creating your first practical assignment. It will appear here once created.
        </p>
        <button
          onClick={() => onEdit?.({} as Practical)}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create First Practical
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {filteredPracticals.length}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                practical{filteredPracticals.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 p-1 shadow-sm">
            <button
              onClick={() => setMode("list")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                mode === "list"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <ListIcon />
              List
            </button>
            <button
              onClick={() => setMode("grid")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                mode === "grid"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              )}
            >
              <GridIcon />
              Grid
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search practicals by title, description, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Clear search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className={mode === "grid" ? "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4" : "space-y-4"}>
        {filteredPracticals.map((p) => {
          const subjObj = subjects?.find((s) => String(s.id) === String(p.subject_id));
          const subj = subjObj?.subject_name ?? subjObj?.name ?? "Unknown";
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
          <h3 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">No practicals found</h3>
          <p className="mt-2 text-center text-gray-600 dark:text-gray-400 max-w-md">
            No practicals match your search for "{searchQuery}". Try adjusting your search terms.
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
