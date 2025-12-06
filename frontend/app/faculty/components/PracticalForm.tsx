"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Sparkles, Info as InfoIcon, Code as CodeIcon, FlaskConical as TestIcon, Plus as PlusIcon, Trash2 as TrashIcon, Users as UsersIcon, FileText, Search as SearchIcon, Check as CheckIcon, Loader2 } from "lucide-react";

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

interface Student {
  uid: string;
  name: string;
  email?: string;
  roll?: string;
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
  isOpen?: boolean;
}

// ---------------------- Small icons / helpers ----------------------
const LoadingSpinner = () => <Loader2 className="animate-spin h-5 w-5" />;

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
  isOpen = false,
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
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>(form.deadline);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
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
      }).catch((e: any) => {
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

  const generateTestCases = async () => {
    if (!form.description || form.description.length < 10) {
      alert("Please enter a detailed description first.");
      return;
    }

    setGeneratingTests(true);
    try {
      const prompt = `
        Generate 3-5 diverse test cases (input and expected output) for a programming problem with this description:
        "${form.description}"
        
        ${sampleCode ? `Reference Code:\n${sampleCode}` : ""}

        Return ONLY a valid JSON array of objects with "input" and "expected_output" keys. 
        Example: [{"input": "5", "expected_output": "120"}, {"input": "0", "expected_output": "1"}]
        Do not include markdown formatting or explanations.
      `;

      const savedSettings = localStorage.getItem("ai_settings");
      const config = savedSettings ? JSON.parse(savedSettings) : {};
      const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ text: prompt }] }],
          config
        }),
      });

      if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) fullText += parsed.text;
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
              console.warn("Error parsing chunk:", e);
            }
          }
        }
      }

      let jsonStr = fullText;
      // Clean up markdown if present
      jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();

      const newTests = JSON.parse(jsonStr);
      if (Array.isArray(newTests)) {
        const formattedTests = newTests.map((t: any) => ({
          input: String(t.input),
          expected_output: String(t.expected_output),
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536
        }));
        setTestCases(prev => [...prev, ...formattedTests]);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      alert("Failed to generate test cases. Please try again. " + (err.message || ""));
    } finally {
      setGeneratingTests(false);
    }
  };

  const toggleStudent = (student: Student) => {
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm overflow-y-auto custom-scrollbar">
      <div className="min-h-screen">
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

              {/* 1. Basic Information (Top Row) */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 mb-6">
                  <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg text-white shadow-md">
                    <InfoIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Basic Information</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Essential details for the practical</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Practical Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={form.title}
                      onChange={handleInput}
                      placeholder="e.g., Binary Search Implementation"
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
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
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
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
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
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
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Language
                    </label>
                    <input
                      type="text"
                      name="language"
                      value={form.language}
                      onChange={handleInput}
                      placeholder="e.g., C, Python, Java"
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Description (Full Width) */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                  <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg text-white shadow-md">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Problem Description</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Detailed problem statement and requirements</p>
                  </div>
                  <div className="ml-auto px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 text-xs font-bold rounded-full border border-purple-100 dark:border-purple-800">
                    {String(form.description || "").length} chars
                  </div>
                </div>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInput}
                  placeholder="# Problem Statement\n\nWrite a program that...\n\n## Input Format\n...\n\n## Output Format\n..."
                  className="w-full min-h-[300px] px-5 py-4 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-y text-gray-900 dark:text-white font-mono text-sm leading-relaxed"
                />
              </div>

              {/* 3. Bottom Section: Test Cases & Reference Code */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Test Cases */}
                <div className="glass-card rounded-xl p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg text-white shadow-md">
                        <TestIcon />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Test Cases</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Auto-grading criteria</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={generateTestCases}
                        disabled={generatingTests}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition border border-purple-200 dark:border-purple-800"
                        title="Generate with AI"
                      >
                        {generatingTests ? <LoadingSpinner /> : <Sparkles className="w-3.5 h-3.5" />}
                        AI Generate
                      </button>
                      <button
                        onClick={addTestCase}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition border border-emerald-200 dark:border-emerald-800"
                      >
                        <PlusIcon />
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                    {testCases.length === 0 && (
                      <div className="text-center py-10 text-gray-400 dark:text-gray-500 italic">
                        No test cases added yet. Use AI or add manually.
                      </div>
                    )}
                    {testCases.map((tc, i) => (
                      <div key={i} className="bg-white/40 dark:bg-gray-900/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                              {i + 1}
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Test Case</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!tc.is_hidden}
                                onChange={(e) => handleTestCaseChange(i, "is_hidden", e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              Hidden
                            </label>
                            <button
                              onClick={() => removeTestCase(i)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-500 mb-1">Input</label>
                            <textarea
                              value={tc.input}
                              onChange={(e) => handleTestCaseChange(i, "input", e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-500 mb-1">Output</label>
                            <textarea
                              value={tc.expected_output}
                              onChange={(e) => handleTestCaseChange(i, "expected_output", e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reference Code */}
                <div className="glass-card rounded-xl p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg text-white shadow-md">
                        <CodeIcon />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Reference Code</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">For AI context (Optional)</p>
                      </div>
                    </div>

                    <select
                      value={sampleLanguage}
                      onChange={(e) => setSampleLanguage(e.target.value)}
                      className="px-3 py-1.5 bg-white/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="c">C</option>
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                    </select>
                  </div>

                  <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col">
                    <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <InfoIcon size={12} />
                      <span>This code helps AI generate better test cases.</span>
                    </div>
                    <div className="flex-1 relative">
                      <div className="absolute inset-0 overflow-auto">
                        <CodeMirror
                          value={sampleCode}
                          onChange={setSampleCode}
                          height="100%"
                          theme={theme === "dark" ? oneDark : undefined}
                          extensions={[getLanguageExtension()]}
                          className="h-full text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
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

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>

                <button
                  onClick={assign}
                  disabled={saving || selectedStudents.length === 0}
                  className={cx(
                    "inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all",
                    (saving || selectedStudents.length === 0) ? "bg-gray-300 text-gray-700 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  )}
                >
                  {saving ? <LoadingSpinner /> : `Assign (${selectedStudents.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

