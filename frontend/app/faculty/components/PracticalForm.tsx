"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import StudentAssignmentForm from "./StudentAssignmentForm";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

// ---------------------- Types ----------------------
interface TestCase {
  input: string;
  expected_output: string;
  is_hidden?: boolean;
  time_limit_ms?: number;
  memory_limit_kb?: number;
}

interface Practical {
  id: number;
  title: string;
  subject_id: number;
  description?: string;
  language?: string;
  deadline: string;
  max_marks: number;
}

interface Subject {
  id: number;
  subject_name: string;
}

interface PracticalFormProps {
  practical: Practical | null;
  subjects: Subject[];
  supabase: any;
  sampleCode?: string;
  setSampleCode: (code: string) => void;
  sampleLanguage?: string;
  setSampleLanguage: (lang: string) => void;
  onClose: () => void;
  onSaved: () => void;
}

export default function PracticalForm({
  practical,
  subjects,
  supabase,
  sampleCode = "",
  setSampleCode,
  sampleLanguage = "c",
  setSampleLanguage,
  onClose,
  onSaved,
}: PracticalFormProps) {
  const [form, setForm] = useState<Practical>({
    id: 0,
    title: "",
    subject_id: subjects[0]?.id || 0,
    description: "",
    language: "",
    deadline: new Date().toISOString().slice(0, 16),
    max_marks: 100,
  });

  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expected_output: "", is_hidden: false, time_limit_ms: 2000, memory_limit_kb: 65536 },
  ]);

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // ------------------- Init -------------------
  useEffect(() => {
    if (practical) {
      setForm({ ...practical, deadline: practical.deadline.slice(0, 16) });
      supabase.from("test_cases").select("*").eq("practical_id", practical.id).then(({ data }) => {
        if (data && data.length > 0) setTestCases(data);
      });
    }
  }, [practical, supabase]);

  // ------------------- Handlers -------------------
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (step === 1 && (!form.title || !form.subject_id || !form.deadline)) {
      return alert("Please fill all required fields in Step 1.");
    }
    setStep((prev) => (prev === 3 ? 3 : (prev + 1) as 2 | 3));
  };

  const handleBack = () => setStep((prev) => (prev === 1 ? 1 : (prev - 1) as 1 | 2));

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const addTestCase = () =>
    setTestCases([...testCases, { input: "", expected_output: "", is_hidden: false, time_limit_ms: 2000, memory_limit_kb: 65536 }]);

  const removeTestCase = (index: number) => setTestCases(testCases.filter((_, i) => i !== index));

  const getLanguageExtension = () => (sampleLanguage?.toLowerCase() === "python" ? python() : cpp());

  // ------------------- Save -------------------
  const handleSave = async () => {
    setSaving(true);
    try {
      let practicalId = form.id;

      if (practicalId && practicalId > 0) {
        const { data } = await supabase.from("practicals").update(form).eq("id", practicalId).select().single();
        practicalId = data.id;
        await supabase.from("test_cases").delete().eq("practical_id", practicalId);
      } else {
        const { data } = await supabase.from("practicals").insert(form).select().single();
        practicalId = data.id;
      }

      if (practicalId && testCases.length > 0) {
        const tcsToInsert = testCases.map((tc) => ({ practical_id: practicalId, ...tc }));
        await supabase.from("test_cases").insert(tcsToInsert);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save practical. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // ------------------- Render -------------------
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{practical ? "Edit Practical" : "Add Practical"}</h2>

      {/* Step Progress */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? "bg-blue-500" : "bg-gray-300"}`}></div>
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? "bg-green-500" : "bg-gray-300"}`}></div>
        <div className={`flex-1 h-2 rounded-full ${step >= 3 ? "bg-purple-500" : "bg-gray-300"}`}></div>
      </div>

      {/* ------------------- STEP 1: Practical Details & Test Cases ------------------- */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" name="title" value={form.title} onChange={handleInput} placeholder="Practical Title" className="border rounded px-3 py-2 dark:bg-gray-700 dark:text-white" />
            <select name="subject_id" value={form.subject_id} onChange={handleInput} className="border rounded px-3 py-2 dark:bg-gray-700 dark:text-white">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
            <input type="datetime-local" name="deadline" value={form.deadline} onChange={handleInput} className="border rounded px-3 py-2 dark:bg-gray-700 dark:text-white" />
            <input type="number" name="max_marks" value={form.max_marks} onChange={handleInput} placeholder="Max Marks" className="border rounded px-3 py-2 dark:bg-gray-700 dark:text-white" />
          </div>
          <textarea name="description" value={form.description} onChange={handleInput} placeholder="Description (optional)" rows={3} className="border rounded px-3 py-2 dark:bg-gray-700 dark:text-white" />

          {/* Test Cases */}
          <div className="flex flex-col gap-2 mt-2">
            {testCases.map((tc, index) => (
              <div key={index} className="flex items-center gap-2">
                <input type="text" placeholder="Input" value={tc.input} onChange={(e) => handleTestCaseChange(index, "input", e.target.value)} className="flex-1 border rounded px-2 py-1 dark:bg-gray-700 dark:text-white" />
                <input type="text" placeholder="Output" value={tc.expected_output} onChange={(e) => handleTestCaseChange(index, "expected_output", e.target.value)} className="flex-1 border rounded px-2 py-1 dark:bg-gray-700 dark:text-white" />
                <button onClick={() => removeTestCase(index)} className="text-red-500 hover:text-red-700">×</button>
              </div>
            ))}
            <button onClick={addTestCase} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">+ Add Test Case</button>
          </div>

          <button onClick={handleNext} className="mt-4 px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition self-start">Next: Reference Code</button>
        </div>
      )}

      {/* ------------------- STEP 2: Reference Code ------------------- */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 flex flex-col gap-4">
          <select value={sampleLanguage || "c"} onChange={(e) => setSampleLanguage(e.target.value)} className="border rounded px-3 py-2 dark:bg-gray-700 dark:text-white">
            <option value="c">C / C++</option>
            <option value="python">Python</option>
          </select>
          <CodeMirror value={sampleCode} onChange={setSampleCode} height="250px" theme={oneDark} extensions={[getLanguageExtension()]} />

          <div className="flex gap-3 mt-4">
            <button onClick={handleBack} className="px-5 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition">Back</button>
            <button onClick={() => setStep(3)} className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Next: Assign Students</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 3: Assign Students ------------------- */}
      {step === 3 && (
        <StudentAssignmentForm
          practicalId={form.id}
          close={() => setStep(2)}
          refresh={() => {
            onSaved();
            setStep(2);
          }}
        />
      )}

      {/* Save button for Step 1/2 */}
      {step !== 3 && (
        <div className="mt-4 flex justify-end">
          <button onClick={handleSave} className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition" disabled={saving}>
            {saving ? "Saving..." : "Save Practical"}
          </button>
        </div>
      )}
    </div>
  );
}
