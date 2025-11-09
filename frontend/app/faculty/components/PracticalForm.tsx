"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";

// dynamic to avoid SSR issues
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
  subject_id: number | string;
  description?: string;
  language?: string;
  deadline: string;
  max_marks: number;
}

interface Subject {
  id: number | string;
  subject_name?: string;
  semester?: string;
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

// ---------------------- Small icons / helpers ----------------------
const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CodeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const TestIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// simple classnames helper
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------- Component ----------------------
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
  const { theme } = useTheme();

  const [form, setForm] = useState<Practical>({
    id: 0,
    title: "",
    subject_id: subjects[0]?.id ?? 0,
    description: "",
    language: "",
    deadline: new Date().toISOString().slice(0, 16),
    max_marks: 100,
  });

  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expected_output: "", is_hidden: false, time_limit_ms: 2000, memory_limit_kb: 65536 },
  ]);

  const [step, setStep] = useState<1 | 2>(1);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>(form.deadline);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({ query: "", semester: "" });

  // set initial state when practical prop changes
  useEffect(() => {
    if (practical) {
      setForm({
        ...practical,
        // ensure datetime-local format
        deadline: practical.deadline ? String(practical.deadline).slice(0, 16) : new Date().toISOString().slice(0, 16),
      });
      setAssignmentDeadline(practical.deadline ? String(practical.deadline).slice(0, 16) : new Date().toISOString().slice(0, 16));

      // load test cases for existing practical
      supabase.from("test_cases").select("*").eq("practical_id", practical.id).then(({ data }: any) => {
        if (data && data.length > 0) setTestCases(data);
      }).catch((e) => {
        console.error("Failed to fetch test cases:", e);
      });
    } else {
      // reset for new practical
      setForm(prev => ({
        ...prev,
        id: 0,
        title: "",
        description: "",
        language: "",
        deadline: new Date().toISOString().slice(0, 16),
        max_marks: 100,
        subject_id: subjects[0]?.id ?? prev.subject_id,
      }));
      setTestCases([{ input: "", expected_output: "", is_hidden: false, time_limit_ms: 2000, memory_limit_kb: 65536 }]);
      setAssignmentDeadline(new Date().toISOString().slice(0, 16));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practical, subjects]);

  // fetch students (with student_details) for assignment
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select(`
            uid,
            name,
            email,
            role,
            student_details (
              roll_no,
              semester
            )
          `)
          .eq("role", "student");

        if (error) {
          console.error("Failed to fetch students:", error);
          setError("Failed to load students.");
          setStudents([]);
          return;
        }

        if (!data) {
          setStudents([]);
          return;
        }

        const mapped = data.map((s: any) => ({
          uid: s.uid,
          name: s.name,
          email: s.email,
          roll: s.student_details?.roll_no || "",
          semester: s.student_details?.semester || "",
        }));
        setStudents(mapped);
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Failed to load students.");
      }
    };

    fetch();
  }, [supabase]);

  // ---------- handlers ----------
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    setForm(prev => ({ ...prev, [name]: name === "max_marks" ? Number(value) : value }));
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    setTestCases(prev => {
      const copy = [...prev];
      (copy[index] as any)[field] = value;
      return copy;
    });
  };

  const addTestCase = () => setTestCases(prev => [...prev, { input: "", expected_output: "", is_hidden: false, time_limit_ms: 2000, memory_limit_kb: 65536 }]);
  const removeTestCase = (index: number) => setTestCases(prev => prev.filter((_, i) => i !== index));

  const toggleStudent = (student: any) => {
    setSelectedStudents(prev => prev.find(s => s.uid === student.uid) ? prev.filter(s => s.uid !== student.uid) : [...prev, student]);
  };

  const filteredStudents = students.filter(s => {
    const q = (filters.query || "").toLowerCase();
    return !q || (s.name || "").toLowerCase().includes(q) || (s.roll || "").toLowerCase().includes(q);
  });

  const getLanguageExtension = useCallback(() => (String(sampleLanguage || "").toLowerCase() === "python" ? python() : cpp()), [sampleLanguage]);

  // Save practical (create/update)
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let practicalId = Number(form.id) || 0;
      const payload = {
        title: form.title,
        subject_id: form.subject_id,
        description: form.description,
        language: form.language,
        deadline: form.deadline,
        max_marks: form.max_marks,
      };

      if (practicalId && practicalId > 0) {
        const { data, error } = await supabase.from("practicals").update(payload).eq("id", practicalId).select().single();
        if (error) throw error;
        practicalId = data.id;
        // delete old test cases then re-insert below
        const { error: delErr } = await supabase.from("test_cases").delete().eq("practical_id", practicalId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from("practicals").insert(payload).select().single();
        if (error) throw error;
        practicalId = data.id;
      }

      if (practicalId && testCases.length > 0) {
        const insertData = testCases.map(tc => ({
          practical_id: practicalId,
          input: tc.input,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden || false,
          time_limit_ms: Number(tc.time_limit_ms) || 2000,
          memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
        }));
        const { error: tcErr } = await supabase.from("test_cases").insert(insertData);
        if (tcErr) throw tcErr;
      }

      // update local form id
      setForm(prev => ({ ...prev, id: practicalId }));
      onSaved();
    } catch (err: any) {
      console.error("Error saving practical:", err);
      alert("Failed to save practical: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  }, [form, testCases, onSaved, supabase]);

  // Assign practical to selected students
  const assign = async () => {
    if (!form.id && form.id !== 0) {
      alert("Save the practical before assigning.");
      return;
    }
    if (selectedStudents.length === 0) {
      alert("Select at least one student to assign.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/practicals/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practical_id: form.id,
          student_ids: selectedStudents.map(s => s.uid),
          assigned_deadline: assignmentDeadline,
          notes,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(result.message || "Assigned successfully");
        onSaved();
      } else {
        alert(result.error || "Failed to assign");
      }
    } catch (err) {
      console.error("Assign error:", err);
      alert("Failed to assign practical.");
    } finally {
      setLoading(false);
    }
  };

  // keyboard save: Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if ((isMac && e.metaKey && e.key === "s") || (!isMac && e.ctrlKey && e.key === "s")) {
        e.preventDefault();
        if (!saving) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, handleSave]);

  // small visual helpers
  const isPast = (() => {
    try {
      return new Date(form.deadline) < new Date();
    } catch {
      return false;
    }
  })();

  // ---------------------- Render ----------------------
  return (
    <div className="relative min-h-[60vh]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cx(
              "w-9 h-9 rounded-full flex items-center justify-center font-bold transition-all",
              step === 1 ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow" : "bg-gray-200 dark:bg-gray-700 text-gray-700"
            )}>
              {step === 1 ? "1" : <CheckIcon />}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {step === 1 ? "Practical Details" : "Assign Practical"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {step === 1 ? "Fill details & test cases" : "Select students & assign"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-md bg-transparent border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              title="Cancel and close"
              aria-label="Cancel"
            >
              Cancel
            </button>

            <button
              onClick={async () => { await handleSave(); if (step === 1) setStep(2); }}
              disabled={saving}
              title="Save practical (Ctrl/Cmd+S)"
              aria-label="Save practical"
              className={cx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-transform",
                saving ? "bg-gray-300 text-gray-700 cursor-wait" : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:scale-[1.02] shadow-sm"
              )}
            >
              {saving ? <LoadingSpinner /> : null}
              {saving ? "Saving..." : "Save & Next"}
            </button>
          </div>
        </div>
      </div>

      {/* Main content container */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Progress indicator (redundant but helpful) */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cx(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                step === 1 ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg" : "bg-emerald-600 text-white"
              )}>
                {step === 1 ? "1" : <CheckIcon />}
              </div>
              <span className={cx("font-semibold", step === 1 ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>Practical Details</span>
            </div>

            <div className={cx("h-1 w-16 rounded-full", step === 2 ? "bg-gradient-to-r from-blue-600 to-purple-600" : "bg-gray-200 dark:bg-gray-700")} />

            <div className="flex items-center gap-2">
              <div className={cx(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                step === 2 ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg" : "bg-gray-200 dark:bg-gray-700 text-gray-400"
              )}>2</div>
              <span className={cx("font-semibold", step === 2 ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>Assign to Students</span>
            </div>
          </div>
        </div>

        {/* ---------- STEP 1 ---------- */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: info & tests */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg text-white">
                      <InfoIcon />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Basic Information</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Practical Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleInput}
                        placeholder="e.g., Binary Search Implementation"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="subject_id"
                        value={form.subject_id}
                        onChange={handleInput}
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                      >
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Deadline <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="deadline"
                        value={form.deadline}
                        onChange={handleInput}
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Max Marks <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="max_marks"
                        value={form.max_marks}
                        onChange={handleInput}
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Programming Language
                      </label>
                      <input
                        type="text"
                        name="language"
                        value={form.language}
                        onChange={handleInput}
                        placeholder="e.g., C, Python, Java"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-lg text-white">
                        <TestIcon />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Test Cases</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Add input/output pairs</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-sm font-bold rounded-full">
                        {testCases.length}
                      </span>
                      <button
                        onClick={addTestCase}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:scale-[1.02] transition"
                        aria-label="Add test case"
                        title="Add test case"
                      >
                        <PlusIcon />
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {testCases.map((tc, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold">
                              {i + 1}
                            </div>
                            <span className="font-bold text-gray-800 dark:text-gray-200">Test Case</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={!!tc.is_hidden}
                                onChange={(e) => handleTestCaseChange(i, "is_hidden", e.target.checked)}
                                className="rounded"
                                aria-label={`Hide test case ${i + 1}`}
                              />
                              Hidden
                            </label>

                            <button
                              onClick={() => removeTestCase(i)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remove test case"
                              aria-label={`Remove test case ${i + 1}`}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Input</label>
                          <textarea
                            value={tc.input}
                            onChange={(e) => handleTestCaseChange(i, "input", e.target.value)}
                            placeholder="Enter input..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Expected Output</label>
                          <textarea
                            value={tc.expected_output}
                            onChange={(e) => handleTestCaseChange(i, "expected_output", e.target.value)}
                            placeholder="Enter expected output..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column: description & reference code */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">Description</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Problem statement and requirements</p>
                    </div>
                    <div className="ml-auto px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 text-xs font-bold rounded-full">
                      {String(form.description || "").length} chars
                    </div>
                  </div>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleInput}
                    placeholder="Write a detailed description of the practical, including problem statement, input/output, constraints, and examples..."
                    rows={12}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none text-gray-900 dark:text-white"
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-amber-600 to-orange-600 rounded-lg text-white">
                        <CodeIcon />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Reference Code</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Optional sample solution</p>
                      </div>
                    </div>

                    <select
                      value={sampleLanguage}
                      onChange={(e) => setSampleLanguage(e.target.value)}
                      className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                      aria-label="Reference code language"
                    >
                      <option value="c">C</option>
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                    </select>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="px-2 py-2 bg-gray-50 dark:bg-gray-900/60 text-xs text-gray-500 dark:text-gray-400">
                      Tip: use this area for short sample solutions (optional).
                    </div>
                    <div className="p-3">
                      <CodeMirror
                        value={sampleCode}
                        onChange={setSampleCode}
                        height="300px"
                        theme={theme === "dark" ? oneDark : undefined}
                        extensions={[getLanguageExtension()]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={async () => { await handleSave(); setStep(2); }}
                disabled={saving}
                className={cx(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all",
                  saving ? "bg-gray-300 text-gray-700 cursor-wait" : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                )}
              >
                {saving ? <LoadingSpinner /> : null}
                {saving ? "Saving..." : "Save & Next"}
              </button>
            </div>
          </div>
        )}

        {/* ---------- STEP 2: Assign ---------- */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-xl text-white">
                  <UsersIcon />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Assign to Students</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select students who will receive this practical</p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
                <CheckIcon />
                <span className="text-sm font-bold text-blue-700 dark:text-blue-200">
                  {selectedStudents.length} selected
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={filters.query}
                onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {filteredStudents.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (selectedStudents.length === filteredStudents.length) setSelectedStudents([]);
                    else setSelectedStudents([...filteredStudents]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  {selectedStudents.length === filteredStudents.length ? "Deselect All" : `Select All (${filteredStudents.length})`}
                </button>
                {selectedStudents.length > 0 && (
                  <button
                    onClick={() => setSelectedStudents([])}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            )}

            {/* student list */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="max-h-96 overflow-y-auto">
                {error ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full">
                      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" />
                    <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {filters.query ? "No students match your search" : "No students found"}
                    </p>
                    {filters.query && (
                      <button onClick={() => setFilters(prev => ({ ...prev, query: "" }))}
                        className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredStudents.map(student => {
                      const isSelected = selectedStudents.some(s => s.uid === student.uid);
                      return (
                        <div
                          key={student.uid}
                          onClick={() => toggleStudent(student)}
                          className={cx(
                            "flex items-center gap-4 px-5 py-4 cursor-pointer transition-all",
                            "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                            isSelected ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500" : ""
                          )}
                        >
                          <div className="flex-shrink-0">
                            <div className={cx(
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                              isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                            )}>
                              {isSelected && <CheckIcon />}
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                              {String(student.name || "U").charAt(0).toUpperCase()}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{student.name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">{student.roll || "N/A"}</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">Sem {student.semester || "N/A"}</span>
                            </div>
                            {student.email && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">{student.email}</p>}
                          </div>

                          {isSelected && (
                            <div className="flex-shrink-0">
                              <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">Selected</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            
          </div>
        )}
      </div>

      {/* Sticky bottom action for mobile */}
      <div className="fixed bottom-4 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-6xl mx-auto px-4">
          <div className="pointer-events-auto flex items-center justify-end gap-3">
            <button
              onClick={() => setStep(prev => (prev === 1 ? 2 : 1))}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 transition"
            >
              {step === 1 ? "Next" : "Back"}
            </button>

            <button
              onClick={async () => {
                if (step === 1) { await handleSave(); setStep(2); }
                else { await assign(); }
              }}
              disabled={saving || (step === 2 && selectedStudents.length === 0)}
              className={cx(
                "w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-transform pointer-events-auto",
                (saving || (step === 2 && selectedStudents.length === 0))
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:scale-[1.02]"
              )}
            >
              {saving ? <LoadingSpinner /> : (step === 1 ? "Save & Next" : `Assign (${selectedStudents.length})`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
