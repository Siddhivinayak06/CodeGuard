"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";

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
  semester: string;
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

  const [step, setStep] = useState<1 | 2>(1);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [assignmentDeadline, setAssignmentDeadline] = useState(form.deadline);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    query: "",        // combined search by name or roll
    semester: "",     // auto-set from subject
  });

  const { theme } = useTheme();
  const supabaseClient = useMemo(() => createClient(), []);

  // ---------------------- Effects ----------------------
  useEffect(() => {
    if (practical) {
      setForm({ ...practical, deadline: practical.deadline.slice(0, 16) });
      supabase.from("test_cases").select("*").eq("practical_id", practical.id).then(({ data }) => {
        if (data && data.length > 0) setTestCases(data);
      });
      setAssignmentDeadline(practical.deadline.slice(0, 16));
    }
  }, [practical]);

  useEffect(() => {
    // Fetch students with roll_no and semester
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabaseClient
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

        if (error) throw error;
        if (data) {
          const studentsWithDetails = data.map((s: any) => ({
            uid: s.uid,
            name: s.name,
            email: s.email,
            roll: s.student_details?.roll_no || "",
            semester: s.student_details?.semester || "",
          }));
          setStudents(studentsWithDetails);
        }
      } catch (err: any) {
        console.error(err);
        setError("Failed to load students.");
      }
    };

    fetchStudents();
  }, [supabaseClient]);

  // ---------------------- Handlers ----------------------
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (step === 1 && (!form.title || !form.subject_id || !form.deadline)) {
      return alert("Please fill all required fields in Practical Details.");
    }

    // Set semester filter from selected subject
    const selectedSubject = subjects.find(s => s.id === form.subject_id);
    setFilters(prev => ({ ...prev, semester: selectedSubject?.semester || "" }));

    setStep(2);
  };

  const handleBack = () => setStep(1);

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const addTestCase = () =>
    setTestCases([...testCases, { input: "", expected_output: "", is_hidden: false, time_limit_ms: 2000, memory_limit_kb: 65536 }]);

  const removeTestCase = (index: number) => setTestCases(testCases.filter((_, i) => i !== index));

  const getLanguageExtension = () => (sampleLanguage?.toLowerCase() === "python" ? python() : cpp());

  const toggleStudent = (student: any) => {
    setSelectedStudents(prev =>
      prev.find(s => s.uid === student.uid)
        ? prev.filter(s => s.uid !== student.uid)
        : [...prev, student]
    );
  };

  const assign = async () => {
    if (selectedStudents.length === 0) return;

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
        alert(result.message || "Practical assigned successfully!");
        onSaved();
      } else {
        alert(result.error || "Failed to assign practical.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to assign practical.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let practicalId = form.id;
      const practicalPayload = {
        title: form.title,
        subject_id: form.subject_id,
        description: form.description,
        language: form.language,
        deadline: form.deadline,
        max_marks: form.max_marks
      };

      if (practicalId && practicalId > 0) {
        const { data, error } = await supabase.from("practicals").update(practicalPayload).eq("id", practicalId).select().single();
        if (error) throw error;
        practicalId = data.id;
        const { error: delError } = await supabase.from("test_cases").delete().eq("practical_id", practicalId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase.from("practicals").insert(practicalPayload).select().single();
        if (error) throw error;
        practicalId = data.id;
      }

      if (practicalId && testCases.length > 0) {
        const tcsToInsert = testCases.map(tc => ({
          practical_id: practicalId,
          input: tc.input,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden || false,
          time_limit_ms: Number(tc.time_limit_ms) || 2000,
          memory_limit_kb: Number(tc.memory_limit_kb) || 65536
        }));
        const { error: tcError } = await supabase.from("test_cases").insert(tcsToInsert);
        if (tcError) throw tcError;
      }

      onSaved();
    } catch (err: any) {
      console.error("Error saving practical:", err);
      alert("Failed to save practical. " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------- Filtered Students ----------------------
  const filteredStudents = students.filter((s) => {
    const q = filters.query?.toLowerCase() || "";
    const name = s.name?.toLowerCase() || "";
    const roll = s.roll?.toLowerCase() || "";
    return name.includes(q) || roll.includes(q);
  });

  // ---------------------- Render ----------------------
  return (
    <div className="flex flex-col gap-3 p-3 md:p-3">

      {/* ---------- STEP 1: Practical Details ---------- */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-3 flex flex-col gap-3">
          {/* Practical Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-4 col-span-1 max-h-[600px] overflow-y-auto">
              <div className="flex flex-col">
                <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Practical Title *</label>
                <input type="text" name="title" value={form.title} onChange={handleInput} className="border px-3 py-2 rounded text-sm dark:bg-gray-800 dark:text-white" />
              </div>

              <div className="flex flex-col">
                <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Subject *</label>
                <select name="subject_id" value={form.subject_id} onChange={handleInput} className="border px-3 py-2 rounded text-sm dark:bg-gray-800 dark:text-white">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Deadline *</label>
                <input type="datetime-local" name="deadline" value={form.deadline} onChange={handleInput} className="border px-3 py-2 rounded text-sm dark:bg-gray-800 dark:text-white" />
              </div>

              <div className="flex flex-col">
                <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Max Marks *</label>
                <input type="number" name="max_marks" value={form.max_marks} onChange={handleInput} className="border px-3 py-2 rounded text-sm dark:bg-gray-800 dark:text-white" />
              </div>

              {/* Test Cases */}
              <div className="flex flex-col">
                <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Test Cases</label>
                <div className="flex flex-col gap-2 mt-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-[400px] overflow-y-auto">
                  {testCases.map((tc, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">
                      <div className="flex-1 flex flex-col">
                        <label className="text-gray-500 dark:text-gray-300 text-xs">Input</label>
                        <input type="text" value={tc.input} onChange={(e) => handleTestCaseChange(index, "input", e.target.value)} className="border px-2 py-1 rounded text-sm dark:bg-gray-800 dark:text-white" />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <label className="text-gray-500 dark:text-gray-300 text-xs">Expected Output</label>
                        <input type="text" value={tc.expected_output} onChange={(e) => handleTestCaseChange(index, "expected_output", e.target.value)} className="border px-2 py-1 rounded text-sm dark:bg-gray-800 dark:text-white" />
                      </div>
                      <button onClick={() => removeTestCase(index)} className="text-red-600 hover:text-red-800 font-bold text-xl md:mt-0 mt-2">×</button>
                    </div>
                  ))}
                  <button onClick={addTestCase} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium w-max">+ Add Test Case</button>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4 col-span-2 max-h-[600px] overflow-y-auto">
              {/* Description */}
              <div className="flex flex-col">
                <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Description / Question Details</label>
                <textarea name="description" value={form.description} onChange={handleInput} rows={12} className="border px-3 py-2 rounded text-sm dark:bg-gray-800 dark:text-white w-full resize-none" />
              </div>

              {/* Reference Code */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-gray-600 dark:text-gray-400 text-sm font-bold">Reference / Sample Code</label>
                  <select value={sampleLanguage} onChange={(e) => setSampleLanguage(e.target.value)} className="border px-3 py-1 rounded text-sm w-36 dark:bg-gray-800 dark:text-white">
                    <option value="c">C</option>
                    <option value="python">Python</option>
                  </select>
                </div>
                <CodeMirror value={sampleCode} onChange={setSampleCode} height="260px" theme={theme === "dark" ? oneDark : undefined} extensions={[getLanguageExtension()]} className="rounded-lg border overflow-hidden mt-2" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={async () => { await handleSave(); handleNext(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium" disabled={saving}>
              {saving ? "Saving..." : "Save & Next"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 2: Assign Practical ---------- */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 flex flex-col gap-6 text-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-2xl text-gray-900 dark:text-gray-50">Assign Practical to Students</h3>
            <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                {selectedStudents.length} Selected
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={filters.query}
              onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
            />
          </div>

          {/* Student List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-gray-700 dark:text-gray-200">
                Student List
              </label>
              {filteredStudents.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedStudents.length === filteredStudents.length) {
                      setSelectedStudents([]);
                    } else {
                      setSelectedStudents([...filteredStudents]);
                    }
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {selectedStudents.length === filteredStudents.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900/50">
              {error ? (
                <div className="p-4 text-center">
                  <svg className="w-12 h-12 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No students found matching your search</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.map((s) => (
                    <div
                      key={s.uid}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all hover:bg-white dark:hover:bg-gray-800 ${selectedStudents.some(st => st.uid === s.uid)
                          ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                          : ""
                        }`}
                      onClick={() => toggleStudent(s)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedStudents.some(st => st.uid === s.uid)
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 dark:border-gray-600"
                          }`}>
                          {selectedStudents.some(st => st.uid === s.uid) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{s.roll}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                              Sem {s.semester}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-col md:flex-row justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={assign}
              disabled={loading || selectedStudents.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Assigning...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Assign Practical
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
