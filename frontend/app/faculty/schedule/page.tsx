"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import PracticalForm from "../components/PracticalForm";
import PracticalList from "../components/PracticalList";
import StudentAssignmentForm from "../components/StudentAssignmentForm";

export default function FacultySchedulePage() {
   const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const [practicals, setPracticals] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedPracticalId, setSelectedPracticalId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch practicals
  const fetchPracticals = async () => {
    try {
      const { data, error } = await supabase
        .from("practicals")
        .select("*")
        .order("deadline", { ascending: true });
      if (error) {
        console.error("Error fetching practicals:", error);
        setError("Failed to load practicals. Please try again.");
      } else {
        setPracticals(data ?? []);
        setError(null);
      }
    } catch (err) {
      console.error("Unexpected error fetching practicals:", err);
      setError("An unexpected error occurred while loading practicals.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch subjects
  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase.from("subjects").select("*");
      if (error) {
        console.error("Error fetching subjects:", error);
      } else {
        setSubjects(data ?? []);
      }
    } catch (err) {
      console.error("Unexpected error fetching subjects:", err);
    }
  };

  useEffect(() => {
    fetchPracticals();
    fetchSubjects();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setModalOpen(true);
  };

  const openAssign = (practicalId: number) => {
    setSelectedPracticalId(practicalId);
    setAssignmentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-5xl mx-auto p-6 pt-28">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Practical Schedule
          </h1>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            + Add Practical
          </button>
        </header>

        {/* Practical list */}
        {loading ? (
          <p className="text-center text-gray-500">Loading practicals...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : practicals.length === 0 ? (
          <p className="text-center text-gray-500">No practicals scheduled yet.</p>
        ) : (
          <PracticalList
            practicals={practicals}
            subjects={subjects}       // pass subjects for name lookup
            onEdit={openEdit}
            onAssign={openAssign}
            onDelete={async (id: number) => {
              if (!confirm("Delete this practical?")) return;
              const { error } = await supabase.from("practicals").delete().eq("id", id);
              if (error) console.error(error);
              fetchPracticals();
            }}
          />
        )}

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl shadow-lg overflow-y-auto max-h-[90vh]">
              <PracticalForm
                practical={editingPractical}
                subjects={subjects}
                supabase={supabase}
                onClose={() => setModalOpen(false)}
                onSaved={fetchPracticals}
              />
            </div>
          </div>
        )}

        {/* Student Assignment Modal */}
        {assignmentModalOpen && selectedPracticalId && (
          <StudentAssignmentForm
            practicalId={selectedPracticalId}
            close={() => setAssignmentModalOpen(false)}
            refresh={fetchPracticals}
          />
        )}
      </main>
    </div>
  );
}
