"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { SupabaseClient } from "@supabase/supabase-js";
import { Check as CheckIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Practical, Subject, TestCase, Level, Student } from "../types";
import BasicDetailsForm from "./BasicDetailsForm";
import LevelManager from "./LevelManager";
import SingleLevelTestCases from "./SingleLevelTestCases";
import AssignStudentsStep from "./AssignStudentsStep";

interface PracticalFormProps {
  practical: Practical | null;
  subjects: Subject[];
  supabase: SupabaseClient;
  sampleCode?: string;
  setSampleCode: (code: string) => void;
  sampleLanguage?: string;
  setSampleLanguage: (lang: string) => void;
  onClose: () => void;
  onSaved: () => void;
  isOpen?: boolean;
  defaultSubjectId?: number | string | null;
  onSaveStep1?: (id: number) => void;
  singleStep?: boolean; // If true, skip assignment step and save directly
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
  defaultSubjectId,
  onSaveStep1,
  singleStep = false,
}: PracticalFormProps) {
  // Level type for multi-level practicals - now using shared type

  const defaultLevels: Level[] = [
    {
      id: 0,
      practical_id: 0,
      created_at: "",
      updated_at: "",
      level: "easy",
      title: "Easy",
      description: "",
      max_marks: 5,
      testCases: [
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ],
    },
    {
      id: 0,
      practical_id: 0,
      created_at: "",
      updated_at: "",
      level: "medium",
      title: "Medium",
      description: "",
      max_marks: 10,
      testCases: [
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ],
    },
    {
      id: 0,
      practical_id: 0,
      created_at: "",
      updated_at: "",
      level: "hard",
      title: "Hard",
      description: "",
      max_marks: 15,
      testCases: [
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ],
    },
  ];

  const [form, setForm] = useState<Practical>({
    id: 0,
    title: "",
    subject_id: subjects[0]?.id ?? 0,
    description: "",
    language: "",
    deadline: new Date().toISOString().slice(0, 16),
    max_marks: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    submitted: false,
  });

  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 0,
      practical_id: null,
      level_id: null,
      created_at: "",
      input: "",
      expected_output: "",
      is_hidden: false,
      time_limit_ms: 2000,
      memory_limit_kb: 65536,
    },
  ]);

  // Multi-level support
  const [levels, setLevels] = useState<Level[]>(defaultLevels);
  const [activeLevel, setActiveLevel] = useState<"easy" | "medium" | "hard">(
    "easy",
  );
  const [enableLevels, setEnableLevels] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>(
    form.deadline || "",
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    query: "",
    semester: "",
    batch: "",
  });

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  // set initial state when practical prop changes
  // set initial state when practical prop changes
  useEffect(() => {
    if (practical) {
      const deadline = practical.deadline
        ? (practical.deadline as string).slice(0, 16)
        : "";
      setForm({
        ...practical,
        deadline,
      });
      setAssignmentDeadline(deadline);
      setStep(1); // Reset to step 1 when opening/editing a practical

      const loadData = async () => {
        try {
          // load test cases for existing practical
          const { data: testData } = await supabase
            .from("test_cases")
            .select("*")
            .eq("practical_id", practical.id);
          if (testData && testData.length > 0) {
            setTestCases(testData as TestCase[]);
          }

          // load already assigned students for existing practical
          const { data: studentData, error: studentError } = await supabase
            .from("student_practicals")
            .select("student_id")
            .eq("practical_id", practical.id);

          if (!studentError && studentData && studentData.length > 0) {
            const assignedIds = studentData.map(
              (sp: { student_id: string }) => sp.student_id,
            );
            // Store the IDs temporarily - we'll match with students when they load
            (
              window as unknown as { __assignedStudentIds: string[] }
            ).__assignedStudentIds = assignedIds;
          }
        } catch (e) {
          console.error("Failed to fetch practical data:", e);
        }
      };

      loadData();
    } else {
      // reset for new practical
      setForm((prev) => ({
        ...prev,
        id: 0,
        title: "",
        description: "",
        language: "",
        deadline: new Date().toISOString().slice(0, 16),
        max_marks: 100,
        subject_id: defaultSubjectId
          ? Number(defaultSubjectId)
          : (subjects[0]?.id ?? prev.subject_id),
      }));
      setTestCases([
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ]);
      setAssignmentDeadline(new Date().toISOString().slice(0, 16));
      setSelectedStudents([]); // Clear selected students for new practical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practical, subjects, defaultSubjectId]);

  // fetch students (with student_details) for assignment
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select(
            `
            uid,
            name,
            email,
            role,
            roll_no,
            semester,
            batch
          `,
          )
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

        const mapped = (data as any[]).map((s) => ({
          uid: s.uid,
          name: s.name,
          email: s.email,
          roll_no: s.roll_no || "",
          semester: s.semester || "",
          batch: s.batch || "",
          role: "student" as const,
          profile_pic: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active_session_id: null,
          session_updated_at: null,
          department: s.department || null,
        }));
        setStudents(mapped);

        // Check if there are pre-assigned students to select
        const assignedIds = (
          window as unknown as { __assignedStudentIds: string[] }
        ).__assignedStudentIds;
        if (assignedIds && assignedIds.length > 0) {
          const preSelected = mapped.filter((s: Student) =>
            assignedIds.includes(s.uid),
          );
          if (preSelected.length > 0) {
            setSelectedStudents(preSelected);
          }
          delete (window as unknown as { __assignedStudentIds?: string[] })
            .__assignedStudentIds; // Clean up
        }
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Failed to load students.");
      }
    };

    fetchStudents();
  }, [supabase, practical]);

  // ---------- handlers ----------
  const handleInput = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement;
    setForm((prev) => ({
      ...prev,
      [name]: name === "max_marks" ? Number(value) : value,
    }));
  };

  const handleTestCaseChange = (
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => {
    setTestCases((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        (copy[index] as any)[field] = value;
      }
      return copy;
    });
  };

  const addTestCase = () =>
    setTestCases((prev) => [
      ...prev,
      {
        id: 0,
        practical_id: null,
        level_id: null,
        created_at: "",
        input: "",
        expected_output: "",
        is_hidden: false,
        time_limit_ms: 2000,
        memory_limit_kb: 65536,
      },
    ]);
  const removeTestCase = (index: number) =>
    setTestCases((prev) => prev.filter((_, i) => i !== index));

  // Level management helpers
  const updateLevelField = (
    level: "easy" | "medium" | "hard",
    field: string,
    value: string | number | boolean,
  ) => {
    setLevels((prev) =>
      prev.map((l) => (l.level === level ? { ...l, [field]: value } : l)),
    );
  };

  const addLevelTestCase = (level: "easy" | "medium" | "hard") => {
    setLevels((prev) =>
      prev.map((l) =>
        l.level === level
          ? {
              ...l,
              testCases: [
                ...l.testCases,
                {
                  id: 0,
                  practical_id: null,
                  level_id: null,
                  created_at: "",
                  input: "",
                  expected_output: "",
                  is_hidden: false,
                  time_limit_ms: 2000,
                  memory_limit_kb: 65536,
                },
              ],
            }
          : l,
      ),
    );
  };

  const removeLevelTestCase = (
    level: "easy" | "medium" | "hard",
    index: number,
  ) => {
    setLevels((prev) =>
      prev.map((l) =>
        l.level === level
          ? { ...l, testCases: l.testCases.filter((_, i) => i !== index) }
          : l,
      ),
    );
  };

  const updateLevelTestCase = (
    level: "easy" | "medium" | "hard",
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => {
    setLevels((prev) =>
      prev.map((l) => {
        if (l.level !== level) return l;
        const newTestCases = [...l.testCases];
        (newTestCases[index] as any)[field] = value;
        return { ...l, testCases: newTestCases };
      }),
    );
  };

  const getCurrentLevel = () => levels.find((l) => l.level === activeLevel)!;

  const generateTestCases = async () => {
    // Determine source description based on mode
    const sourceDescription = enableLevels
      ? getCurrentLevel().description
      : form.description;

    if (!sourceDescription || sourceDescription.length < 10) {
      alert("Please enter a detailed description first.");
      return;
    }

    setGeneratingTests(true);
    try {
      const prompt = `
        Generate 3-5 diverse test cases (input and expected output) for a programming problem with this description:
        "${sourceDescription}"
        
        ${sampleCode ? `Reference Code:\n${sampleCode}` : ""}

        Return ONLY a valid JSON array of objects with "input" and "expected_output" keys. 
        Example: [{"input": "5", "expected_output": "120"}, {"input": "0", "expected_output": "1"}]
        Do not include markdown formatting or explanations.
      `;

      const savedSettings = localStorage.getItem("ai_settings");
      const config = savedSettings ? JSON.parse(savedSettings) : {};
      const apiUrl =
        process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ text: prompt }] }],
          config,
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
      jsonStr = jsonStr
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const newTests = JSON.parse(jsonStr);
      if (Array.isArray(newTests)) {
        const formattedTests = newTests.map((t: any) => ({
          input: String(t.input),
          expected_output: String(t.expected_output),
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
        }));

        if (enableLevels) {
          // Add to current level test cases
          setLevels((prev) =>
            prev.map((l) =>
              l.level === activeLevel
                ? { ...l, testCases: [...l.testCases, ...formattedTests] }
                : l,
            ),
          );
        } else {
          // Add to global test cases
          setTestCases((prev) => [...prev, ...formattedTests]);
        }
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      alert(
        "Failed to generate test cases. Please try again. " +
          (err.message || ""),
      );
    } finally {
      setGeneratingTests(false);
    }
  };

  const getLanguageExtension = useCallback(
    () =>
      String(sampleLanguage || "").toLowerCase() === "python"
        ? python()
        : cpp(),
    [sampleLanguage],
  );

  // Save practical (create/update)
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let practicalId = Number(form.id) || 0;
      const payload = {
        title: form.title,
        subject_id: form.subject_id,
        description: enableLevels ? "" : form.description, // Use level descriptions when levels enabled
        language: form.language,
        deadline: form.deadline,
        max_marks: enableLevels
          ? levels.reduce((sum, l) => sum + l.max_marks, 0)
          : (form.max_marks ?? 100),
      };

      if (practicalId && practicalId > 0) {
        const { data, error } = await supabase
          .from("practicals")
          .update(payload)
          .eq("id", practicalId)
          .select()
          .single();
        if (error) throw error;
        practicalId = data.id;
        // delete old test cases and levels then re-insert below
        await supabase
          .from("test_cases")
          .delete()
          .eq("practical_id", practicalId);
        await supabase
          .from("practical_levels")
          .delete()
          .eq("practical_id", practicalId);
      } else {
        const { data, error } = await supabase
          .from("practicals")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        practicalId = data.id;
      }

      if (enableLevels) {
        // Save levels with their test cases
        for (const level of levels) {
          // Insert level
          const { data: levelData, error: levelErr } = await supabase
            .from("practical_levels")
            .insert({
              practical_id: practicalId,
              level: level.level,
              title: level.title,
              description: level.description,
              max_marks: level.max_marks,
            })
            .select()
            .single();

          if (levelErr) throw levelErr;

          // Insert test cases for this level
          if (levelData && level.testCases.length > 0) {
            const tcData = level.testCases.map((tc) => ({
              practical_id: practicalId,
              level_id: levelData.id,
              input: tc.input,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden || false,
              time_limit_ms: Number(tc.time_limit_ms) || 2000,
              memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
            }));
            const { error: tcErr } = await supabase
              .from("test_cases")
              .insert(tcData);
            if (tcErr) throw tcErr;
          }
        }
      } else {
        // Original single-level test cases
        if (practicalId && testCases.length > 0) {
          const insertData = testCases.map((tc) => ({
            practical_id: practicalId,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden || false,
            time_limit_ms: Number(tc.time_limit_ms) || 2000,
            memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
          }));
          const { error: tcErr } = await supabase
            .from("test_cases")
            .insert(insertData);
          if (tcErr) throw tcErr;
        }
      }

      // update local form id
      setForm((prev) => ({ ...prev, id: practicalId }));

      if (onSaveStep1) {
        onSaveStep1(practicalId);
      }

      return true; // Return success - let caller decide what to do next
    } catch (err: any) {
      console.error("Error saving practical:", err);
      alert("Failed to save practical: " + (err?.message || String(err)));
      return false; // Return failure
    } finally {
      setSaving(false);
    }
  }, [form, testCases, levels, enableLevels, supabase]);

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
          student_ids: selectedStudents.map((s) => s.uid),
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
      if (
        (isMac && e.metaKey && e.key === "s") ||
        (!isMac && e.ctrlKey && e.key === "s")
      ) {
        e.preventDefault();
        if (!saving) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, handleSave]);

  // ---------------------- Render ----------------------
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm overflow-y-auto custom-scrollbar"
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="min-h-screen"
          >
            {/* Sticky top bar */}
            <div className="sticky top-0 z-40 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
              <div className="w-full mx-auto px-4 xl:px-12 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cx(
                      "w-9 h-9 rounded-full flex items-center justify-center font-bold transition-all",
                      step === 1
                        ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700",
                    )}
                  >
                    {step === 1 ? "1" : <CheckIcon />}
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {step === 1 ? "Practical Details" : "Assign Practical"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {step === 1
                        ? "Fill details & test cases"
                        : "Select students & assign"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (step === 1) {
                        const success = await handleSave();
                        if (success) {
                          if (singleStep) {
                            // Single step mode: save and close
                            onSaved();
                          } else {
                            // Multi-step mode: go to assignment step
                            setStep(2);
                          }
                        }
                      } else {
                        await assign();
                      }
                    }}
                    disabled={saving || loading}
                    className={cx(
                      "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                      saving || loading
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-wait"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30",
                    )}
                  >
                    {saving || loading ? <LoadingSpinner /> : null}
                    {saving
                      ? "Saving..."
                      : loading
                        ? "Assigning..."
                        : step === 1
                          ? singleStep
                            ? "Save Practical"
                            : "Save & Next →"
                          : "Assign to Students"}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Main content container */}
            <div className="w-full mx-auto px-4 xl:px-12 py-6">
              {/* Progress indicator - only show if not single step */}
              {!singleStep && (
                <div className="mb-6">
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={cx(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                          step === 1
                            ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg"
                            : "bg-emerald-600 text-white",
                        )}
                      >
                        {step === 1 ? "1" : <CheckIcon />}
                      </div>
                      <span
                        className={cx(
                          "font-semibold",
                          step === 1
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        Practical Details
                      </span>
                    </div>

                    <div
                      className={cx(
                        "h-1 w-16 rounded-full",
                        step === 2
                          ? "bg-gradient-to-r from-blue-600 to-purple-600"
                          : "bg-gray-200 dark:bg-gray-700",
                      )}
                    />

                    <div className="flex items-center gap-2">
                      <div
                        className={cx(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                          step === 2
                            ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400",
                        )}
                      >
                        2
                      </div>
                      <span
                        className={cx(
                          "font-semibold",
                          step === 2
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-500 dark:text-gray-400",
                        )}
                      >
                        Assign to Students
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------- STEP TRANSITIONS ---------- */}
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-6"
                  >
                    {/* 1. Basic Information */}
                    <BasicDetailsForm
                      form={form}
                      subjects={subjects}
                      handleInput={handleInput}
                      defaultSubjectId={defaultSubjectId}
                      enableLevels={enableLevels}
                      setEnableLevels={setEnableLevels}
                      levels={levels}
                    />

                    {/* Level Management (Tabs & Content) */}
                    {enableLevels && (
                      <LevelManager
                        levels={levels}
                        activeLevel={activeLevel}
                        setActiveLevel={setActiveLevel}
                        updateLevelField={updateLevelField}
                        addLevelTestCase={addLevelTestCase}
                        removeLevelTestCase={removeLevelTestCase}
                        updateLevelTestCase={updateLevelTestCase}
                        generateTestCases={generateTestCases}
                        generatingTests={generatingTests}
                        sampleCode={sampleCode}
                        setSampleCode={setSampleCode}
                        sampleLanguage={sampleLanguage || "c"}
                      />
                    )}

                    {/* Single Level Test Cases & Description */}
                    {!enableLevels && (
                      <SingleLevelTestCases
                        form={form}
                        handleInput={handleInput}
                        sampleCode={sampleCode}
                        setSampleCode={setSampleCode}
                        sampleLanguage={sampleLanguage}
                        setSampleLanguage={setSampleLanguage}
                        getLanguageExtension={getLanguageExtension}
                        testCases={testCases}
                        handleTestCaseChange={handleTestCaseChange}
                        addTestCase={addTestCase}
                        removeTestCase={removeTestCase}
                        generateTestCases={generateTestCases}
                        generatingTests={generatingTests}
                      />
                    )}
                  </motion.div>
                ) : (
                  <AssignStudentsStep
                    students={students}
                    selectedStudents={selectedStudents}
                    setSelectedStudents={setSelectedStudents}
                    filters={filters}
                    setFilters={setFilters}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
