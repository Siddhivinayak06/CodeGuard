"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import PracticalForm from "../components/PracticalForm";
import PracticalList from "../components/PracticalList";
import StudentAssignmentForm from "../components/StudentAssignmentForm";

// ---------------------- Types ----------------------
type Subject = { id: number; subject_name: string };
type Practical = {
  id: number;
  subject_id: number;
  title: string;
  description?: string;
  language?: string;
  deadline: string;
  max_marks: number;
};
type Student = { id: number; name: string };

export default function FacultySchedulePage() {
  const supabase = useMemo(() => createClient(), []);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);

  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedPracticalId, setSelectedPracticalId] = useState<number | null>(null);

  // ------------------- Fetch Data -------------------
  const fetchPracticals = async () => {
    try {
      const { data, error } = await supabase
        .from("practicals")
        .select("*")
        .order("deadline", { ascending: true });
      if (error) setError("Failed to load practicals.");
      else setPracticals(data ?? []);
    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase.from("subjects").select("*");
      if (!error && data) setSubjects(data as Subject[]);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "student");

      if (!error && data) setStudents(data as Student[]);
      else console.error("Failed to fetch students:", error);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPracticals();
    fetchSubjects();
    fetchStudents();
  }, []);

  // ------------------- Modal Handlers -------------------
  const openCreate = () => {
    setEditingPractical(null);
    setSampleCode("");
    setSampleLanguage("c");
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);

    // Fetch latest reference code for this practical
    const { data: refs, error } = await supabase
      .from("reference_codes")
      .select("*")
      .eq("practical_id", p.id)
      .order("created_at", { ascending: false });

    if (!error && refs && refs.length > 0) {
      setSampleCode(refs[0].code || "");
      setSampleLanguage(refs[0].language || "c");
    } else {
      setSampleCode("");
      setSampleLanguage("c");
    }

    setModalOpen(true);
  };

  const openAssign = (practicalId: number) => {
    setSelectedPracticalId(practicalId);
    setAssignmentModalOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (error) console.error(error);
    fetchPracticals();
  };

  // ------------------- Render -------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-5xl mx-auto p-6 pt-28">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Practical Schedule</h1>
          <button onClick={openCreate} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
            + Add Practical
          </button>
        </header>

        {loading ? (
          <p className="text-center text-gray-500">Loading practicals...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : practicals.length === 0 ? (
          <p className="text-center text-gray-500">No practicals scheduled yet.</p>
        ) : (
          <PracticalList
            practicals={practicals}
            subjects={subjects}
            onEdit={openEdit}
            onAssign={openAssign}
            onDelete={deletePractical}
          />
        )}

        {/* Practical Form Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl shadow-lg overflow-y-auto max-h-[90vh]">
              <PracticalForm
                practical={editingPractical}
                subjects={subjects}
                students={students}          // <-- Pass students here
                supabase={supabase}
                sampleCode={sampleCode}
                setSampleCode={setSampleCode}
                sampleLanguage={sampleLanguage}
                setSampleLanguage={setSampleLanguage}
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
