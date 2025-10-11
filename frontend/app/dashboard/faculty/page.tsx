"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";
import { Calendar } from "@/components/ui/calendar";

type Subject = {
  id: number;
  subject_name: string;
};

type Practical = {
  id: number;
  subject_id: number;
  title: string;
  description?: string;
  language?: string;
  deadline: string;
  max_marks: number;
  created_at?: string;
  updated_at?: string;
};

export default function FacultyDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Practical | null>(null);

  const initialForm: Practical = {
    id: 0,
    title: "",
    subject_id: 0,
    description: "",
    language: "",
    deadline: new Date().toISOString().slice(0, 16),
    max_marks: 100,
  };

  const [form, setForm] = useState<Practical>(initialForm);

  // Fetch logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/auth/login");
        return;
      }
      setUser(data.user);
      setLoading(false);
    };
    fetchUser();
  }, [router, supabase]);

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase.from("subjects").select("*");
      if (error) {
        console.error("Fetch subjects error:", error);
        setSubjects([]);
        return;
      }
      setSubjects(data as Subject[]);
    };
    fetchSubjects();
  }, [supabase]);

  // Fetch practicals
  const fetchPracticals = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("practicals")
      .select("*")
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Fetch practicals error:", error);
      setPracticals([]);
      return;
    }
    setPracticals(data as Practical[]);
  };

  useEffect(() => {
    if (user) fetchPracticals();
  }, [user]);

  // Map practicals by date for calendar
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Practical[]>();
    practicals.forEach((p) => {
      const iso = new Date(p.deadline).toISOString().slice(0, 10);
      const arr = map.get(iso) ?? [];
      arr.push(p);
      map.set(iso, arr);
    });
    return map;
  }, [practicals]);

  // Open modal for creating a practical
  const openCreate = (date?: Date) => {
    const deadline = date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)
          .toISOString()
          .slice(0, 16)
      : new Date().toISOString().slice(0, 16);

    setEditing(null);
    setForm({ ...initialForm, deadline });
    setModalOpen(true);
  };

  // Open modal for editing a practical
  const openEdit = (p: Practical) => {
    setEditing(p);
    setForm({ ...p, deadline: p.deadline.slice(0, 16) });
    setModalOpen(true);
  };

  // Save practical (insert or update)
  const savePractical = async () => {
    if (!form.title || !form.subject_id || !form.deadline) {
      return alert("Please fill title, subject, and deadline");
    }

    try {
      if (editing) {
        // Update practical
        const { data, error } = await supabase
          .from("practicals")
          .update({
            title: form.title,
            subject_id: form.subject_id,
            description: form.description,
            language: form.language,
            deadline: form.deadline,
            max_marks: form.max_marks,
          })
          .eq("id", editing.id)
          .select()
          .single();

        if (error) throw error;

        setPracticals((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      } else {
        // Insert practical
        const { data, error } = await supabase
          .from("practicals")
          .insert({
            title: form.title,
            subject_id: form.subject_id,
            description: form.description,
            language: form.language,
            deadline: form.deadline,
            max_marks: form.max_marks,
          })
          .select()
          .single();

        if (error) throw error;

        setPracticals((prev) => [data, ...prev]);
      }

      setModalOpen(false);
      setForm(initialForm);
    } catch (err: any) {
      console.error("Save practical error:", err);
      alert("Failed to save practical: " + (err.message ?? JSON.stringify(err)));
    }
  };

  // Delete practical
  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;

    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (error) {
      console.error("Delete practical error:", error);
      alert("Delete failed");
      return;
    }

    setPracticals((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 md:pt-28">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Faculty Dashboard
          </h1>
          <button
            onClick={() => openCreate()}
            className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700"
          >
            + Schedule Practical
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="md:col-span-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow bg-white dark:bg-gray-900 overflow-hidden">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => {
                if (!d || isNaN(d.getTime())) return;
                setSelected(d);
                openCreate(d);
              }}
              className="w-full"
              dayContent={(date) => {
                if (!(date instanceof Date) || isNaN(date.getTime())) return null;
                const iso = date.toISOString().slice(0, 10);
                const events = eventsByDate.get(iso) ?? [];
                const bgColor = events.length ? "bg-blue-500 text-white" : "";
                return (
                  <div
                    className={`aspect-square w-full flex items-center justify-center rounded-md cursor-pointer select-none ${bgColor} hover:scale-105 hover:bg-gray-50 dark:hover:bg-gray-800`}
                    title={events.map((e) => e.title).join("\n")}
                  >
                    {date.getDate()}
                  </div>
                );
              }}
            />
          </div>

          {/* Upcoming practicals */}
          <div className="space-y-4 md:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Upcoming Practicals</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow bg-white dark:bg-gray-900 p-4">
              {practicals.length === 0 ? (
                <p className="text-gray-500 text-sm">No practicals scheduled.</p>
              ) : (
                practicals.map((p) => {
                  const subj = subjects.find((s) => s.id === p.subject_id)?.subject_name || "Unknown";
                  return (
                    <div
                      key={p.id}
                      className="p-2 border rounded flex items-start justify-between hover:shadow-md transition"
                    >
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-gray-500">
                          {subj} • {new Date(p.deadline).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePractical(p.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-3">{editing ? "Edit Practical" : "Schedule Practical"}</h3>
              <div className="space-y-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full px-3 py-2 rounded border"
                />
                <select
                  value={form.subject_id}
                  onChange={(e) => setForm((f) => ({ ...f, subject_id: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded border"
                >
                  <option value={0}>Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  className="w-full px-3 py-2 rounded border h-24"
                />
                <input
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  placeholder="Language"
                  className="w-full px-3 py-2 rounded border"
                />
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="px-3 py-2 rounded border w-full"
                />
                <input
                  type="number"
                  value={form.max_marks}
                  onChange={(e) => setForm((f) => ({ ...f, max_marks: parseInt(e.target.value) }))}
                  placeholder="Max Marks"
                  className="px-3 py-2 rounded border w-full"
                />

                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setModalOpen(false)} className="px-3 py-1 rounded border">
                    Cancel
                  </button>
                  <button onClick={savePractical} className="px-3 py-1 bg-blue-600 text-white rounded">
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
