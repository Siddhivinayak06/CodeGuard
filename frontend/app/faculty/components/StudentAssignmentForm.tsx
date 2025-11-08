"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function StudentAssignmentForm({ practicalId, close, refresh }: any) {
  const supabase = useMemo(() => createClient(), []);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [deadline, setDeadline] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setError(null);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("uid, name, email, role, student_details(roll_no, semester)")
          .eq("role", "student");

        if (error) throw error;

        if (data) {
          const mappedStudents = data.map((s: any) => ({
            uid: s.uid,
            name: s.name,
            email: s.email,
            roll: s.student_details?.roll_no || "",
            semester: s.student_details?.semester || "",
          }));
          setStudents(mappedStudents);
        }
      } catch (err: any) {
        console.error("Error fetching students:", err);
        setError("Failed to load students. Check console for details.");
      }
    };

    fetchStudents();
  }, [supabase]);

  const toggleStudent = (student: any) => {
    setSelectedStudents((prev) =>
      prev.find((s) => s.uid === student.uid) ? prev.filter((s) => s.uid !== student.uid) : [...prev, student]
    );
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={close}
      />

      {/* Modal */}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl mx-auto flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Assign Practical
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select students and set a deadline
            </p>
          </div>
          <button
            onClick={close}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Assignment Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              Assignment Details
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes for students"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Student Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                Select Students
              </h3>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                {selectedStudents.length} selected
              </span>
            </div>
            <input
              type="text"
              placeholder="Search by name or roll number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />

            <div className="max-h-72 overflow-y-auto mt-3 border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 bg-gray-50 dark:bg-gray-900/50">
              {error ? (
                <p className="p-4 text-red-500">{error}</p>
              ) : filteredStudents.length === 0 ? (
                <p className="p-4 text-gray-500 dark:text-gray-400 text-center">No students found</p>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.uid}
                    className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                      selectedStudents.some((s) => s.uid === student.uid) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => toggleStudent(student)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedStudents.some((s) => s.uid === student.uid)}
                        readOnly
                        className="w-4 h-4 accent-blue-600"
                      />
                      <div>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{student.name}</span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {student.roll} • Sem {student.semester}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={close}
              className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={assign}
              disabled={selectedStudents.length === 0 || loading}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Assigning..." : `Assign to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? "s" : ""}`}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
