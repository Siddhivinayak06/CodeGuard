"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Calendar } from "@/components/ui/calendar";
import type { User } from "@supabase/supabase-js";

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

type TestCase = {
  id?: number;
  input: string;
  expected_output: string;
  is_hidden?: boolean;
  time_limit_ms?: number;
  memory_limit_kb?: number;
};

const initialPracticalForm: Practical = {
  id: 0,
  title: "",
  subject_id: 0,
  description: "",
  language: "",
  deadline: new Date().toISOString().slice(0, 16),
  max_marks: 100,
};

const initialTestCase: TestCase = {
  input: "",
  expected_output: "",
  is_hidden: false,
  time_limit_ms: 2000,
  memory_limit_kb: 65536,
};

export default function FacultyDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [form, setForm] = useState<Practical>(initialPracticalForm);
  const [testCases, setTestCases] = useState<TestCase[]>([initialTestCase]);

  // ------------------- Fetch user, subjects, practicals -------------------
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

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase.from("subjects").select("*");
      if (!error && data) setSubjects(data as Subject[]);
    };
    fetchSubjects();
  }, [supabase]);

  const fetchPracticals = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("practicals").select("*").order("deadline", { ascending: true });
    if (!error && data) setPracticals(data as Practical[]);
  };

  useEffect(() => {
    if (user) fetchPracticals();
  }, [user]);

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

  // ------------------- Modal logic -------------------
  const openCreate = (date?: Date) => {
    const deadline = date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);

    setEditingPractical(null);
    setForm({ ...initialPracticalForm, deadline });
    setTestCases([initialTestCase]);
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);
    setForm({ ...p, deadline: p.deadline.slice(0, 16) });
    const { data: tcs } = await supabase.from("test_cases").select("*").eq("practical_id", p.id);
    setTestCases(tcs && tcs.length > 0 ? tcs : [initialTestCase]);
    setModalOpen(true);
  };

  const savePractical = async () => {
    if (!form.title || !form.subject_id || !form.deadline) {
      return alert("Please fill title, subject, and deadline");
    }

    try {
      let practicalData;
      if (editingPractical) {
        const { data, error } = await supabase
          .from("practicals")
          .update({ ...form })
          .eq("id", editingPractical.id)
          .select()
          .single();
        if (error) throw error;
        practicalData = data;
        await supabase.from("test_cases").delete().eq("practical_id", practicalData.id);
      } else {
        const { data, error } = await supabase.from("practicals").insert({ ...form }).select().single();
        if (error) throw error;
        practicalData = data;
      }

      if (testCases.length > 0) {
        const tcsToInsert = testCases.map((tc) => ({
          practical_id: practicalData.id,
          input: tc.input,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden ?? false,
          time_limit_ms: tc.time_limit_ms ?? 2000,
          memory_limit_kb: tc.memory_limit_kb ?? 65536,
        }));
        await supabase.from("test_cases").insert(tcsToInsert);
      }

      fetchPracticals();
      setModalOpen(false);
      setForm(initialPracticalForm);
      setTestCases([initialTestCase]);
    } catch (err: any) {
      console.error(err);
      alert("Failed to save practical: " + (err.message ?? JSON.stringify(err)));
    }
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (!error) setPracticals((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 md:pt-28">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 md:gap-0">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Faculty Dashboard
          </h1>
          <button
            onClick={() => openCreate()}
            className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition"
          >
            + Schedule Practical
          </button>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar panel */}
          <div className="md:col-span-1 rounded-xl border shadow bg-white dark:bg-gray-900 p-4 flex flex-col">
            <h2 className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-200">
              Calendar
            </h2>
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => {
                if (!d || isNaN(d.getTime())) return;
                setSelected(d);
                openCreate(d);
              }}
              dayContent={(date) => {
                if (!(date instanceof Date) || isNaN(date.getTime())) return null;
                const iso = date.toISOString().slice(0, 10);
                const events = eventsByDate.get(iso) ?? [];
                const hasEvent = events.length > 0;
                return (
                  <div
                    className={`aspect-square w-full flex items-center justify-center rounded-md cursor-pointer select-none ${hasEvent
                        ? 'bg-blue-500 text-white font-semibold'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      } transition`}
                    title={events.map((e) => e.title).join("\n")}
                  >
                    {date.getDate()}
                  </div>
                );
              }}
              className="w-full"
            />
          </div>

          {/* Practicals panel */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Upcoming Practicals
            </h2>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] rounded-xl border shadow bg-white dark:bg-gray-900 p-4">
              {practicals.length === 0 ? (
                <p className="text-gray-500 text-sm">No practicals scheduled.</p>
              ) : (
                practicals.map((p) => {
                  const subj = subjects.find((s) => s.id === p.subject_id)?.subject_name || "Unknown";
                  return (
                    <div
                      key={p.id}
                      className="p-3 border rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-2 hover:shadow-md transition"
                    >
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">{p.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {subj} • {new Date(p.deadline).toLocaleString()}
                        </div>
                        {p.language && (
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Language: {p.language}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePractical(p.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
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

        {/* Modal for Practical */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl shadow-lg overflow-y-auto max-h-[90vh]">
              <h3 className="text-lg font-semibold mb-3">
                {editingPractical ? "Edit Practical" : "Schedule Practical"}
              </h3>
              <div className="space-y-3">
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

                {/* Test Cases */}
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium">Test Cases</h4>
                  {testCases.map((tc, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-2 items-start border p-2 rounded">
                      <textarea
                        value={tc.input}
                        onChange={(e) =>
                          setTestCases((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, input: e.target.value } : t))
                          )
                        }
                        placeholder="Input"
                        className="w-full md:w-1/2 px-2 py-1 border rounded"
                      />
                      <textarea
                        value={tc.expected_output}
                        onChange={(e) =>
                          setTestCases((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, expected_output: e.target.value } : t))
                          )
                        }
                        placeholder="Expected Output"
                        className="w-full md:w-1/2 px-2 py-1 border rounded"
                      />
                      <button
                        onClick={() => setTestCases((prev) => prev.filter((_, i) => i !== idx))}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition mt-1 md:mt-0"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setTestCases((prev) => [...prev, initialTestCase])}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    + Add Test Case
                  </button>
                </div>

                {/* Modal actions */}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setModalOpen(false)} className="px-3 py-1 rounded border">
                    Cancel
                  </button>
                  <button onClick={savePractical} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
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
