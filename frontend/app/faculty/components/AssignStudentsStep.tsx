"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users as UsersIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Student } from "../types";

// Helper for classNames
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface AssignStudentFilters {
  query: string;
  semester: string;
  batch: string;
  rollFrom: string;
  rollTo: string;
}

interface AssignStudentsStepProps {
  students: Student[];
  selectedStudents: Student[];
  setSelectedStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  filters: AssignStudentFilters;
  setFilters: React.Dispatch<React.SetStateAction<AssignStudentFilters>>;
  availableBatches?: string[]; // Batches assigned to the selected subject
}

const parseRollNumber = (rollNo: string | null | undefined): number | null => {
  const digitsOnly = String(rollNo || "").replace(/\D/g, "");
  if (!digitsOnly) return null;

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRangeBound = (value: string | null | undefined): number | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function AssignStudentsStep({
  students,
  selectedStudents,
  setSelectedStudents,
  filters,
  setFilters,
  availableBatches,
}: AssignStudentsStepProps) {
  const fromBound = parseRangeBound(filters.rollFrom);
  const toBound = parseRangeBound(filters.rollTo);

  const lowerBound =
    fromBound !== null && toBound !== null
      ? Math.min(fromBound, toBound)
      : fromBound;
  const upperBound =
    fromBound !== null && toBound !== null
      ? Math.max(fromBound, toBound)
      : toBound;

  // Use provided available batches, or extract from students if not provided
  const batches = availableBatches && availableBatches.length > 0
    ? availableBatches.filter(b => b !== "All").sort()
    : Array.from(
      new Set(students.map((s) => s.batch).filter((b): b is string => !!b)),
    ).sort();

  const filteredStudents = students
    .filter((s) => {
      const q = (filters.query || "").toLowerCase();
      const matchesQuery =
        !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.roll_no || "").toLowerCase().includes(q);
      const matchesBatch = !filters.batch || s.batch === filters.batch;

      const rollValue = parseRollNumber(s.roll_no);
      const matchesRollRange =
        lowerBound === null && upperBound === null
          ? true
          : rollValue !== null &&
            (lowerBound === null || rollValue >= lowerBound) &&
            (upperBound === null || rollValue <= upperBound);

      return matchesQuery && matchesBatch && matchesRollRange;
    })
    .sort((a, b) => {
      const rollA = String(a.roll_no || "");
      const rollB = String(b.roll_no || "");
      return rollA.localeCompare(rollB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

  const toggleStudent = (student: Student) => {
    setSelectedStudents((prev) =>
      prev.find((s) => s.uid === student.uid)
        ? prev.filter((s) => s.uid !== student.uid)
        : [...prev, student],
    );
  };

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) =>
      selectedStudents.some((sel) => sel.uid === s.uid)
    );

  const someFilteredSelected =
    !allFilteredSelected &&
    filteredStudents.some((s) =>
      selectedStudents.some((sel) => sel.uid === s.uid)
    );

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect only the filtered students
      const filteredUids = new Set(filteredStudents.map((s) => s.uid));
      setSelectedStudents((prev) =>
        prev.filter((s) => !filteredUids.has(s.uid))
      );
    } else {
      // Select all filtered students (merge with already selected)
      setSelectedStudents((prev) => {
        const existingUids = new Set(prev.map((s) => s.uid));
        const newStudents = filteredStudents.filter(
          (s) => !existingUids.has(s.uid)
        );
        return [...prev, ...newStudents];
      });
    }
  };

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-500/25">
            <UsersIcon size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Assign to Students
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select students who will receive this practical
            </p>
          </div>
        </div>

        <motion.div
          key={selectedStudents.length}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className={cx(
            "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors",
            selectedStudents.length > 0
              ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800"
              : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          )}
        >
          <UserCheck
            size={16}
            className={cx(
              selectedStudents.length > 0
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-400"
            )}
          />
          <span
            className={cx(
              "text-sm font-bold",
              selectedStudents.length > 0
                ? "text-indigo-700 dark:text-indigo-200"
                : "text-gray-500 dark:text-gray-400"
            )}
          >
            {selectedStudents.length} selected
          </span>
        </motion.div>
      </div>

      {/* Search & Filter Bar + Actions */}
      <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <SearchIcon className="text-gray-400" size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by name or roll number..."
            value={filters.query}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, query: e.target.value }))
            }
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
        </div>

        <div className="md:w-44">
          <select
            value={filters.batch}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, batch: e.target.value }))
            }
            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all text-sm text-gray-900 dark:text-white appearance-none cursor-pointer outline-none"
          >
            {batches.length === 1 ? (
              <option value={batches[0]}>Batch {batches[0]}</option>
            ) : (
              <>
                <option value="">All Batches ({batches.length})</option>
                {batches.map((batch) => (
                  <option key={batch} value={batch}>
                    Batch {batch}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 md:w-64">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Roll From"
            value={filters.rollFrom}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, rollFrom: e.target.value }))
            }
            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Roll To"
            value={filters.rollTo}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, rollTo: e.target.value }))
            }
            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
        </div>

        {/* Inline actions */}
        <div className="flex items-center gap-2 md:border-l md:border-gray-200 md:dark:border-gray-700 md:pl-3">
          {filteredStudents.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className={cx(
                "px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap",
                allFilteredSelected
                  ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  : "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
              )}
            >
              {allFilteredSelected ? "Deselect All" : `Select All (${filteredStudents.length})`}
            </button>
          )}
          {selectedStudents.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedStudents([])}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors whitespace-nowrap"
            >
              <XCircle size={13} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Student Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <div className="max-h-[460px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 w-12 text-center">
                  {/* Select-all checkbox in header */}
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={cx(
                      "w-5 h-5 mx-auto rounded flex items-center justify-center transition-all border-2",
                      allFilteredSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : someFilteredSelected
                          ? "bg-indigo-200 dark:bg-indigo-800 border-indigo-400 text-indigo-600 dark:text-indigo-200"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-transparent hover:border-indigo-400"
                    )}
                  >
                    {(allFilteredSelected || someFilteredSelected) && (
                      <CheckIcon size={12} strokeWidth={3} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                  #
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                  Roll No.
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 text-center">
                  Batch
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              <AnimatePresence>
                {filteredStudents.map((student, index) => {
                  const isSelected = selectedStudents.some(
                    (s) => s.uid === student.uid
                  );
                  return (
                    <motion.tr
                      key={student.uid}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => toggleStudent(student)}
                      className={cx(
                        "cursor-pointer group transition-colors duration-150",
                        isSelected
                          ? "bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 text-center">
                        <div
                          className={cx(
                            "w-[18px] h-[18px] mx-auto rounded flex items-center justify-center transition-all duration-150 border-2",
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-transparent group-hover:border-indigo-400"
                          )}
                        >
                          <CheckIcon size={11} strokeWidth={3} />
                        </div>
                      </td>
                      {/* Serial No */}
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-mono tabular-nums">
                        {index + 1}
                      </td>
                      {/* Roll No */}
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            "text-sm font-semibold tabular-nums",
                            isSelected
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-gray-900 dark:text-white"
                          )}
                        >
                          {student.roll_no || "-"}
                        </span>
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cx(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-150",
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-600 dark:text-gray-300 group-hover:from-indigo-100 group-hover:to-blue-100 dark:group-hover:from-indigo-900/40 dark:group-hover:to-blue-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                            )}
                          >
                            {(student.name || "S").charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={cx(
                              "text-sm font-medium truncate",
                              isSelected
                                ? "text-indigo-700 dark:text-indigo-200"
                                : "text-gray-800 dark:text-gray-200"
                            )}
                          >
                            {student.name}
                          </span>
                        </div>
                      </td>
                      {/* Email */}
                      <td
                        className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell truncate max-w-[220px]"
                        title={student.email}
                      >
                        {student.email}
                      </td>
                      {/* Batch */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-gray-100 dark:bg-gray-700/60 px-2.5 py-0.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {student.batch
                            ? `Batch ${student.batch}`
                            : student.semester}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-60">
                      <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <SearchIcon className="text-gray-400" size={24} />
                      </div>
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium text-sm">
                          No students found
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Try adjusting your search or filter
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer summary */}
        {filteredStudents.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Showing <strong className="text-gray-700 dark:text-gray-300">{filteredStudents.length}</strong>{" "}
              of <strong className="text-gray-700 dark:text-gray-300">{students.length}</strong> students
            </span>
            <span>
              <strong className="text-indigo-600 dark:text-indigo-400">{selectedStudents.length}</strong> selected
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
