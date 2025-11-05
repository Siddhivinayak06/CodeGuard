"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type TestCase = {
  input: string;
  expected_output: string;
  is_hidden?: boolean;
  time_limit_ms?: number;
  memory_limit_kb?: number;
};

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

  const emptyTestCase: TestCase = {
    input: "",
    expected_output: "",
    is_hidden: false,
    time_limit_ms: 2000,
    memory_limit_kb: 65536,
  };

  const [form, setForm] = useState(editing?.practical || empty);
  const [testCases, setTestCases] = useState<TestCase[]>(editing?.testCases || [emptyTestCase]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveRef = useRef(false);

  const save = async () => {
    if (saving || saveRef.current) return; // Prevent multiple saves
    saveRef.current = true;
    setSaving(true);
    setError(null);
    try {
      let practicalId: number;
      if (editing) {
        const { data } = await supabase
          .from("practicals")
          .update(form)
          .eq("id", editing.practical.id)
          .select()
          .single();
        practicalId = data.id;
        await supabase.from("test_cases").delete().eq("practical_id", practicalId); // remove old test cases
      } else {
        const { data } = await supabase.from("practicals").insert(form).select().single();
        practicalId = data.id;
      }

      if (testCases.length > 0) {
        const tcsToInsert = testCases.map((tc: TestCase) => ({
          ...tc,
          practical_id: practicalId,
        }));
        await supabase.from("test_cases").insert(tcsToInsert);
      }

      refresh();
      close();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to save practical");
    } finally {
      setSaving(false);
      saveRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close}></div>
      <div className="relative bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg mb-4">{editing ? "Edit Practical" : "Add Practical"}</h3>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="space-y-3">
          {/* Practical details */}
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
                {s.name || s.subject_name}
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

          {/* Test Cases */}
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Test Cases</h4>
            {testCases.map((tc: TestCase, idx: number) => (
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
                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 mt-1 md:mt-0"
                >
                  X
                </button>
              </div>
            ))}
            <button
              onClick={() => setTestCases((prev) => [...prev, emptyTestCase])}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              + Add Test Case
            </button>
          </div>

          {/* Modal actions */}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={close} className="px-3 py-1 border rounded">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
