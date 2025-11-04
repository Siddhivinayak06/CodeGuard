"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function StudentAssignmentForm({ practicalId, close, refresh }: any) {
  const supabase = useMemo(() => createClient(), []);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [deadline, setDeadline] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setError(null);

      // quick client sanity checks
      try {
        console.log("Supabase client:", supabase);
        // optional: check session/connection
        if (typeof supabase.auth?.getSession === "function") {
          const sess = await supabase.auth.getSession();
          console.log("supabase session:", sess);
        }
      } catch (err) {
        console.warn("Supabase client check failed:", err);
      }

      try {
        // be explicit about columns (helps with RLS/policy debugging)
        const { data, error, status } = await supabase
          .from("users")          // <-- confirm this is correct table name
          .select("uid, name, email, role")
          .eq("role", "student");

        // log raw response for debugging
        console.log("fetchStudents response:", { status, data, error });

        if (error) {
          // stringify to reveal possible hidden fields
          console.error("Error fetching students (raw):", JSON.stringify(error, Object.getOwnPropertyNames(error)));
          // Provide helpful message
          setError(
            // if RLS is common culprit, hint it
            `Failed to load students. ${error.message ?? ""} 
            (Check env keys, table name, network/CORS, or Row Level Security policies.)`
          );
          return;
        }

        if (!data || data.length === 0) {
          setStudents([]);
          setError(null);
          return;
        }

        setStudents(data);
        setError(null);
      } catch (err: any) {
        console.error("Unexpected error fetching students:", err);
        setError("An unexpected error occurred while loading students. See console for details.");
      }
    };

    fetchStudents();
  }, [supabase]);

  const toggleStudent = (student: any) => {
    setSelectedStudents((prev) =>
      prev.find((s) => s.uid === student.uid) ? prev.filter((s) => s.uid !== student.uid) : [...prev, student]
    );
  };

  const assign = async () => {
    if (selectedStudents.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/practicals/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practical_id: practicalId,
          student_ids: selectedStudents.map(s => s.uid),
          assigned_deadline: deadline,
          notes: notes,
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
    } catch (error) {
      console.error("Assignment error:", error);
      alert("Failed to assign practical");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close}></div>
      <div className="relative bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg mb-4">Assign Practical to Students</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full px-3 py-2 border rounded h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Select Students ({selectedStudents.length} selected)</label>
            <div className="max-h-40 overflow-y-auto border rounded p-2">
              {error ? (
                <p className="text-red-500 text-sm">{error}</p>
              ) : students.length === 0 ? (
                <p className="text-gray-500 text-sm">No students available to assign. (Check console/network/RLS)</p>
              ) : (
                students.map((student) => (
                  <label key={student.uid} className="flex items-center space-x-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                    <input
                      type="checkbox"
                      checked={selectedStudents.some((s) => s.uid === student.uid)}
                      onChange={() => toggleStudent(student)}
                    />
                    <span>{student.name} ({student.email})</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={close} className="px-3 py-1 border rounded" disabled={loading}>
              Cancel
            </button>
            <button
              onClick={assign}
              disabled={selectedStudents.length === 0 || loading}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? "Assigning..." : `Assign to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
