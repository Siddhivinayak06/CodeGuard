"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PracticalForm({ editing, close, refresh }: any) {
  const supabase = useMemo(() => createClient(), []);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data } = await supabase.from("subjects").select("*");
      setSubjects(data || []);
    };
    fetchSubjects();
  }, [supabase]);

  const empty = {
    title: "",
    subject_id: 0,
    description: "",
    language: "",
    deadline: new Date().toISOString().slice(0, 16),
    max_marks: 100,
  };

  const [form, setForm] = useState(editing || empty);

  const save = async () => {
    try {
      if (editing) {
        await supabase.from("practicals").update(form).eq("id", editing.id);
      } else {
        await supabase.from("practicals").insert(form);
      }
      refresh();
      close();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close}></div>
      <div className="relative bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h3 className="font-semibold text-lg mb-4">{editing ? "Edit Practical" : "Add Practical"}</h3>
        <div className="space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            className="w-full px-3 py-2 border rounded"
          />

          <select
            value={form.subject_id}
            onChange={(e) => setForm({ ...form, subject_id: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value={0}>Select Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="w-full px-3 py-2 border rounded h-24"
          />

          <input
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            placeholder="Language"
            className="w-full px-3 py-2 border rounded"
          />

          <input
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />

          <input
            type="number"
            value={form.max_marks}
            onChange={(e) => setForm({ ...form, max_marks: parseInt(e.target.value) })}
            placeholder="Max Marks"
            className="w-full px-3 py-2 border rounded"
          />

          <div className="flex justify-end gap-2 mt-3">
            <button onClick={close} className="px-3 py-1 border rounded">
              Cancel
            </button>
            <button onClick={save} className="px-3 py-1 bg-blue-600 text-white rounded">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
