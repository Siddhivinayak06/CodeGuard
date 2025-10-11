"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import PracticalForm from "../components/PracticalForm";
import PracticalList from "../components/PracticalList";

export default function FacultySchedulePage() {
  const supabase = useMemo(() => createClient(), []);
  const [practicals, setPracticals] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Fetch practicals
  const fetchPracticals = async () => {
    const { data, error } = await supabase
      .from("practicals")
      .select("*")
      .order("deadline", { ascending: true });
    if (error) console.error(error);
    else setPracticals(data ?? []);
  };

  // Fetch subjects
  const fetchSubjects = async () => {
    const { data, error } = await supabase.from("subjects").select("*");
    if (error) console.error(error);
    else setSubjects(data ?? []);
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
        <PracticalList
          practicals={practicals}
          subjects={subjects}       // pass subjects for name lookup
          onEdit={openEdit}
          onDelete={async (id: number) => {
            if (!confirm("Delete this practical?")) return;
            const { error } = await supabase.from("practicals").delete().eq("id", id);
            if (error) console.error(error);
            fetchPracticals();
          }}
        />

        {/* Modal */}
        {modalOpen && (
          <PracticalForm
            editing={editing}
            close={() => setModalOpen(false)}
            refresh={fetchPracticals}
          />
        )}
      </main>
    </div>
  );
}
