"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Practical, TestCase, ReferenceRow, Subject } from "@/types";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

type Props = {
  practical?: Practical | null;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
  supabase: any;
};

const initialTestCase: TestCase = {
  input: "",
  expected_output: "",
  is_hidden: false,
  time_limit_ms: 2000,
  memory_limit_kb: 65536,
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

export default function PracticalForm({ practical, subjects, onClose, onSaved, supabase }: Props) {
  const [formStep, setFormStep] = useState<"details" | "reference">("details");
  const [form, setForm] = useState<Practical>(initialPracticalForm);
  const [testCases, setTestCases] = useState<TestCase[]>([initialTestCase]);
  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");
  const [savedPracticalId, setSavedPracticalId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (practical) {
      setForm({ ...practical, deadline: practical.deadline.slice(0, 16) });
      setSavedPracticalId(practical.id);
      fetchTestCases(practical.id);
    }
  }, [practical]);

  const fetchTestCases = async (id: number) => {
    const { data: tcs } = await supabase.from("test_cases").select("*").eq("practical_id", id);
    setTestCases(tcs && tcs.length > 0 ? tcs : [initialTestCase]);
  };

  const savePractical = async () => {
    if (saving) return;
    setSaving(true);

    try {
      let practicalId = savedPracticalId;
      let practicalData: Practical;

      // Step 1: Save practical details
      if (formStep === "details") {
        if (!form.title || !form.subject_id || !form.deadline) {
          alert("Please fill all required fields");
          setSaving(false);
          return;
        }

        if (practical) {
          const { data } = await supabase.from("practicals").update(form).eq("id", practical.id).select().single();
          practicalData = data!;
          await supabase.from("test_cases").delete().eq("practical_id", practicalData.id);
        } else {
          const { data } = await supabase.from("practicals").insert(form).select().single();
          practicalData = data!;
        }

        // Insert test cases
        if (testCases.length > 0) {
          const tcsToInsert = testCases.map((tc) => ({ practical_id: practicalData.id, ...tc }));
          await supabase.from("test_cases").insert(tcsToInsert);
        }

        setSavedPracticalId(practicalData.id);
        setFormStep("reference");
        setSaving(false);
        return;
      }

      // Step 2: Save reference code
      if (formStep === "reference") {
        if (!practicalId) return alert("Practical not saved");
        const lang = sampleLanguage.toLowerCase();
        const { data: existing } = await supabase
          .from("reference_codes")
          .select("id")
          .eq("practical_id", practicalId)
          .eq("language", lang)
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase.from("reference_codes").update({ code: sampleCode, language: lang }).eq("id", existing[0].id);
        } else {
          await supabase
            .from("reference_codes")
            .insert({ practical_id: practicalId, code: sampleCode, language: lang, is_primary: true, version: 1 });
        }

        alert("Practical saved successfully!");
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save practical. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{formStep === "details" ? (practical ? "Edit Practical" : "Schedule Practical") : "Add Sample Code"}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className={`px-2 py-1 rounded ${formStep === "details" ? "bg-blue-100 text-blue-700" : "bg-gray-100 dark:bg-gray-800"}`}>1. Details</span>
          <span className={`px-2 py-1 rounded ${formStep === "reference" ? "bg-blue-100 text-blue-700" : "bg-gray-100 dark:bg-gray-800"}`}>2. Sample Code</span>
        </div>
      </div>

      {formStep === "details" && (
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
            <h4 className="font-semibold">Test Cases</h4>
            {testCases.map((tc, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={tc.input}
                  onChange={(e) => setTestCases((prev) => prev.map((t, i) => (i === idx ? { ...t, input: e.target.value } : t)))}
                  placeholder="Input"
                  className="px-2 py-1 border rounded w-1/2"
                />
                <input
                  value={tc.expected_output}
                  onChange={(e) => setTestCases((prev) => prev.map((t, i) => (i === idx ? { ...t, expected_output: e.target.value } : t)))}
                  placeholder="Expected Output"
                  className="px-2 py-1 border rounded w-1/2"
                />
              </div>
            ))}
            <button className="text-blue-600 text-sm hover:underline" onClick={() => setTestCases((prev) => [...prev, initialTestCase])}>
              + Add Test Case
            </button>
          </div>
        </div>
      )}

      {formStep === "reference" && (
        <div className="space-y-3">
          <select value={sampleLanguage} onChange={(e) => setSampleLanguage(e.target.value)} className="px-3 py-2 rounded border">
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
          </select>
          <CodeMirror value={sampleCode} onChange={setSampleCode} height="250px" className="border rounded" />
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {formStep === "reference" && (
          <button onClick={() => setFormStep("details")} className="px-4 py-2 border rounded hover:bg-gray-100">
            Back
          </button>
        )}
        <button onClick={savePractical} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
