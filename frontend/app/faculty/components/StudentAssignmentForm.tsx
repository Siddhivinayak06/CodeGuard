"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Icons
// Icons

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

const CalendarIcon = () => (
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
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const NotesIcon = () => (
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
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const UsersIcon = () => (
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
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const EmptyIcon = () => (
  <svg
    className="w-12 h-12 text-gray-300 dark:text-gray-600"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

interface Props {
  practicalId: number;
  close: () => void;
  refresh: () => void;
}

export default function StudentAssignmentForm({
  practicalId,
  close,
  refresh,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [deadline, setDeadline] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setError(null);
      setFetchingStudents(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("uid, name, email, role, roll_no, semester")
          .eq("role", "student");

        if (error) throw error;

        if (data) {
          setStudents(data);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Failed to load students. Please try again.");
      } finally {
        setFetchingStudents(false);
      }
    };

    fetchStudents();
  }, [supabase]);

  const toggleStudent = (student: any) => {
    setSelectedStudents((prev) =>
      prev.find((s) => s.uid === student.uid)
        ? prev.filter((s) => s.uid !== student.uid)
        : [...prev, student],
    );
  };

  const selectAll = () => {
    setSelectedStudents(filteredStudents);
  };

  const clearAll = () => {
    setSelectedStudents([]);
    setSelectedSemester("");
  };

  const semesters = useMemo(() => {
    const sems = new Set(students.map((s) => s.semester).filter(Boolean));
    return Array.from(sems).sort();
  }, [students]);

  const filteredStudents = students.filter((s) => {
    const matchQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_no?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (s.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchSemester = selectedSemester
      ? s.semester === selectedSemester
      : true;

    return matchQuery && matchSemester;
  });

  const assign = async () => {
    if (selectedStudents.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/practicals/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practical_id: practicalId,
          student_ids: selectedStudents.map((s) => s.uid),
          assigned_deadline: deadline,
          notes,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(result.message || "Practical assigned successfully!");
        refresh();
        close();
      } else {
        alert("Error: " + result.error);
      }
    } catch (err) {
      console.error("Assignment error:", err);
      alert("Failed to assign practical");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Assignment Details Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
            <CalendarIcon />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Assignment Details
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set deadline and add optional notes
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Deadline Input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <CalendarIcon />
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
            />
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <NotesIcon />
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add special instructions or notes for students..."
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Student Selection Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-lg">
              <UsersIcon />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Select Students
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose who will receive this assignment
              </p>
            </div>
          </div>

          {/* Selection Count Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
            <CheckIcon />
            <span className="text-sm font-bold text-blue-700 dark:text-blue-200">
              {selectedStudents.length} selected
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search by name, roll number, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Semester Filter */}
          <div className="min-w-[150px]">
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full h-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white appearance-none cursor-pointer"
            >
              <option value="">All Semesters</option>
              {semesters.map((sem) => (
                <option key={sem} value={sem || ""}>
                  {sem}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {filteredStudents.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Select All ({filteredStudents.length})
            </button>
            {selectedStudents.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            )}
          </div>
        )}

        {/* Student List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="max-h-96 overflow-y-auto">
            {fetchingStudents ? (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Loading students...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <EmptyIcon />
                <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? "No students match your search"
                    : "No students found"}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudents.some(
                    (s) => s.uid === student.uid,
                  );
                  return (
                    <div
                      key={student.uid}
                      onClick={() => toggleStudent(student)}
                      className={`
                        flex items-center gap-4 px-5 py-4 cursor-pointer transition-all
                        hover:bg-gray-50 dark:hover:bg-gray-700/50
                        ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500" : ""}
                      `}
                    >
                      {/* Checkbox */}
                      <div className="flex-shrink-0">
                        <div
                          className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                          ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          }
                        `}
                        >
                          {isSelected && <CheckIcon />}
                        </div>
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      {/* Student Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {student.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {student.roll_no || "N/A"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                            </svg>
                            Sem {student.semester || "N/A"}
                          </span>
                        </div>
                        {student.email && (
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">
                            {student.email}
                          </p>
                        )}
                      </div>

                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="flex-shrink-0">
                          <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                            Selected
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={close}
          className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={assign}
          disabled={selectedStudents.length === 0 || loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg"
        >
          {loading ? (
            <>
              <LoadingSpinner />
              <span>Assigning...</span>
            </>
          ) : (
            <>
              <CheckIcon />
              <span>
                Assign to {selectedStudents.length} Student
                {selectedStudents.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
