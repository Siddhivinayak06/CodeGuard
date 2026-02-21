"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users as UsersIcon,
  Check as CheckIcon,
  Search as SearchIcon,
} from "lucide-react";
import { Student } from "../types";

// Helper for classNames
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface AssignStudentsStepProps {
  students: Student[];
  selectedStudents: Student[];
  setSelectedStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  filters: { query: string; semester: string; batch: string };
  setFilters: React.Dispatch<
    React.SetStateAction<{ query: string; semester: string; batch: string }>
  >;
  availableBatches?: string[]; // Batches assigned to the selected subject
}

export default function AssignStudentsStep({
  students,
  selectedStudents,
  setSelectedStudents,
  filters,
  setFilters,
  availableBatches,
}: AssignStudentsStepProps) {
  // Use provided available batches, or extract from students if not provided
  const batches = availableBatches && availableBatches.length > 0
    ? availableBatches.filter(b => b !== "All").sort()
    : Array.from(
      new Set(students.map((s) => s.batch).filter((b): b is string => !!b)),
    ).sort();

  const filteredStudents = students.filter((s) => {
    const q = (filters.query || "").toLowerCase();
    const matchesQuery =
      !q ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.roll_no || "").toLowerCase().includes(q);
    const matchesBatch = !filters.batch || s.batch === filters.batch;
    return matchesQuery && matchesBatch;
  });

  const toggleStudent = (student: Student) => {
    setSelectedStudents((prev) =>
      prev.find((s) => s.uid === student.uid)
        ? prev.filter((s) => s.uid !== student.uid)
        : [...prev, student],
    );
  };

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-xl text-white">
            <UsersIcon />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Assign to Students
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select students who will receive this practical
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
          <CheckIcon />
          <span className="text-sm font-bold text-blue-700 dark:text-blue-200">
            {selectedStudents.length} selected
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="text-gray-400" size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by name or roll number..."
            value={filters.query}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, query: e.target.value }))
            }
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="md:w-48">
          <select
            value={filters.batch}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, batch: e.target.value }))
            }
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white appearance-none cursor-pointer"
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
      </div>

      {filteredStudents.length > 0 && (
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => {
              if (selectedStudents.length === filteredStudents.length)
                setSelectedStudents([]);
              else setSelectedStudents([...filteredStudents]);
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            {selectedStudents.length === filteredStudents.length
              ? "Deselect All"
              : `Select All (${filteredStudents.length})`}
          </motion.button>
          {selectedStudents.length > 0 && (
            <motion.button
              onClick={() => setSelectedStudents([])}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear Selection
            </motion.button>
          )}
        </div>
      )}

      {/* Student Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence>
          {filteredStudents.map((student) => {
            const isSelected = selectedStudents.some(
              (s) => s.uid === student.uid,
            );
            return (
              <motion.div
                key={student.uid}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => toggleStudent(student)}
                className={cx(
                  "cursor-pointer group relative overflow-hidden rounded-xl border p-4 transition-all duration-200",
                  isSelected
                    ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 ring-1 ring-blue-500 shadow-md"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cx(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600 dark:group-hover:text-blue-400",
                      )}
                    >
                      {(student.name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4
                        className={cx(
                          "font-semibold text-sm transition-colors",
                          isSelected
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-900 dark:text-white",
                        )}
                      >
                        {student.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {student.roll_no}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cx(
                      "w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white scale-100"
                        : "border-gray-300 dark:border-gray-600 bg-transparent text-transparent scale-90 opacity-0 group-hover:opacity-100 placeholder-shown:opacity-100", // placeholder-shown is hack, just rely on group-hover
                    )}
                  >
                    <CheckIcon size={14} strokeWidth={3} />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{student.email}</span>
                  <span className="bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded text-xs font-medium">
                    {student.batch
                      ? `Batch ${student.batch}`
                      : student.semester}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredStudents.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <SearchIcon className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-900 dark:text-white font-medium">
              No students found
            </p>
            <p className="text-sm text-gray-500">
              Try adjusting your search terms
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
