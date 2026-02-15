"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { SupabaseClient } from "@supabase/supabase-js";
import { Check as CheckIcon, Loader2, Plus, FileText, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Practical, Subject, TestCase, Level, Student } from "../types";
import BasicDetailsForm from "./BasicDetailsForm";
import LevelManager from "./LevelManager";
import SingleLevelTestCases from "./SingleLevelTestCases";
// AssignStudentsStep import removed (step 2 removed)

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
  initialDrafts?: any[];
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
  initialDrafts,
}: PracticalFormProps) {
  // Level type for multi-level practicals - now using shared type

  const defaultLevels: Level[] = [
    {
      id: 0,
      practical_id: 0,
      created_at: "",
      updated_at: "",
      level: "Task 1",
      title: "Task 1",
      description: "",
      max_marks: 8,
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
      level: "Task 2",
      title: "Task 2",
      description: "",
      max_marks: 2,
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
    max_marks: 10,
    practical_number: undefined,
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
  const [activeLevel, setActiveLevel] = useState<"Task 1" | "Task 2">(
    "Task 1",
  );
  const [enableLevels, setEnableLevels] = useState(false);




  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>(
    new Date().toISOString().slice(0, 16),
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
  const [savedPracticals, setSavedPracticals] = useState<{ id: number }[]>([]);

  // ---------------------- Multi-Draft State ----------------------
  interface DraftPractical {
    id: string; // local draft ID
    form: Practical;
    testCases: TestCase[];
    levels: Level[];
    enableLevels: boolean;
    sampleCode?: string;
    sampleLanguage?: string;
  }

  const createEmptyDraft = (): DraftPractical => ({
    id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    form: {
      id: 0,
      title: "",
      subject_id: defaultSubjectId ? Number(defaultSubjectId) : (subjects[0]?.id ?? 0),
      description: "",
      language: "",
      max_marks: 10,
      practical_number: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted: false,
    },
    testCases: [{
      id: 0,
      practical_id: null,
      level_id: null,
      created_at: "",
      input: "",
      expected_output: "",
      is_hidden: false,
      time_limit_ms: 2000,
      memory_limit_kb: 65536,
    }],
    levels: JSON.parse(JSON.stringify(defaultLevels)),
    enableLevels: false,
    sampleCode: "",
    sampleLanguage: "c",
  });

  const [draftPracticals, setDraftPracticals] = useState<DraftPractical[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Initialize with one draft if creating new practicals (not editing)
      if (!practical) {
        if (initialDrafts && initialDrafts.length > 0) {
          // Map imported drafts to DraftPractical format
          const mappedDrafts = initialDrafts.map((d, idx) => {
            const isMultilevel = d.enableLevels || false;

            // Map imported levels to form levels structure
            // We use defaultLevels as base and merge imported data
            const mappedLevels = JSON.parse(JSON.stringify(defaultLevels)).map((defaultLevel: Level, levelIdx: number) => {
              if (!d.levels || d.levels.length === 0) return defaultLevel;

              // Map by index: 0 -> easy, 1 -> hard
              // If we have more than 2 levels, they are ignored for now as the system only supports 2 fixed levels.
              // If imported has only 1 level, it goes to "easy".
              const importedLevel = d.levels[levelIdx];

              if (!importedLevel) return defaultLevel;

              return {
                ...defaultLevel,
                title: importedLevel.title || defaultLevel.title,
                description: importedLevel.description || defaultLevel.description,
                max_marks: Number(importedLevel.max_marks) || defaultLevel.max_marks, // Ensure number
                testCases: importedLevel.testCases?.map((tc: any) => ({
                  id: 0,
                  practical_id: null,
                  level_id: null,
                  created_at: "",
                  input: tc.input || "",
                  expected_output: tc.expected_output || "",
                  is_hidden: false,
                  time_limit_ms: 2000,
                  memory_limit_kb: 65536,
                })) || [],
                reference_code: importedLevel.reference_code || ""
              };
            });


            return {
              id: `imported-${Date.now()}-${idx}`,
              form: {
                id: 0,
                title: d.title || "Untitled Practical",
                subject_id: defaultSubjectId ? Number(defaultSubjectId) : (subjects[0]?.id ?? 0),
                description: d.description || "",
                language: d.language || "c", // Map language
                max_marks: Number(d.max_marks) || 10,
                practical_number: d.practical_number,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                submitted: false,
              },
              testCases: d.testCases?.map((tc: any) => ({
                id: 0,
                practical_id: null,
                level_id: null,
                created_at: "",
                input: tc.input || "",
                expected_output: tc.expected_output || "",
                is_hidden: false,
                time_limit_ms: 2000,
                memory_limit_kb: 65536,
              })) || [],
              levels: mappedLevels,
              enableLevels: isMultilevel,
              sampleCode: d.reference_code || "", // Map reference code
              sampleLanguage: d.language || "c",
            };
          });
          setDraftPracticals(mappedDrafts);
          setActiveDraftIndex(0);

          // Initial Load of the first draft
          if (mappedDrafts.length > 0) {
            const first = mappedDrafts[0];
            setForm(first.form);
            setTestCases(first.testCases);
            setLevels(first.levels);
            setEnableLevels(first.enableLevels);
            if (first.sampleCode !== undefined) setSampleCode(first.sampleCode);
            if (first.sampleLanguage !== undefined) setSampleLanguage(first.sampleLanguage);
          }
        } else {
          const initialDraft = createEmptyDraft();
          setDraftPracticals([initialDraft]);
          setActiveDraftIndex(0);
        }
      }
    }
  }, [isOpen, practical, initialDrafts, defaultSubjectId, subjects, setSampleCode, setSampleLanguage]);

  // set initial state when practical prop changes
  // set initial state when practical prop changes
  useEffect(() => {
    if (practical) {
      setForm({
        ...practical,
      });
      setAssignmentDeadline(new Date().toISOString().slice(0, 16));

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

          // load levels for existing practical
          const { data: levelsData } = await supabase
            .from("practical_levels")
            .select("*")
            .eq("practical_id", practical.id)
            .order("id", { ascending: true });

          if (levelsData && levelsData.length > 0) {
            setEnableLevels(true);

            // load reference codes too
            const { data: refsData } = await supabase
              .from("reference_codes")
              .select("*")
              .eq("practical_id", practical.id);

            // Match with test cases and reference codes
            const levelsWithTests = levelsData.map((l: any) => {
              const levelRef = refsData?.find(r => r.practical_id === practical.id); // For now shared
              return {
                ...l,
                reference_code: levelRef?.code || "",
                testCases: (testData || []).filter((tc: any) => tc.level_id === l.id) as TestCase[],
              };
            });
            setLevels(levelsWithTests);

            if (refsData && refsData.length > 0) {
              setSampleCode(refsData[0].code || "");
              setSampleLanguage(refsData[0].language || "c");
            }
          } else {
            setEnableLevels(false);
            // Even if no levels, load reference code for single level
            const { data: refsData } = await supabase
              .from("reference_codes")
              .select("*")
              .eq("practical_id", practical.id)
              .order("created_at", { ascending: false });

            if (refsData && refsData.length > 0) {
              setSampleCode(refsData[0].code || "");
              setSampleLanguage(refsData[0].language || "c");
            }
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
        max_marks: 10,
        practical_number: undefined,
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

  // fetch students (with student_details) for assignment - filtered by selected subject's batches
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // 1. Get current faculty user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          setStudents([]);
          return;
        }

        // 2. Get batches assigned to the SELECTED SUBJECT for this faculty via junction table
        const selectedSubjectId = form.subject_id;
        const { data: subjectBatches } = await supabase
          .from("subject_faculty_batches")
          .select("batch")
          .eq("faculty_id", currentUser.id)
          .eq("subject_id", selectedSubjectId);

        const assignedBatches = [...new Set((subjectBatches || []).map(fb => fb.batch))];
        console.log("[Debug] Assigned Batches for subject:", selectedSubjectId, assignedBatches);
        setAvailableBatches(assignedBatches);
        const hasAllBatch = assignedBatches.includes("All");

        // 3. Fetch students - filter by batch if not "All"
        let query = supabase
          .from("users")
          .select(`uid, name, email, role, roll_no, semester, batch, department`)
          .eq("role", "student");

        // If subject has specific batches (not "All"), filter students by those batches
        if (!hasAllBatch && assignedBatches.length > 0) {
          query = query.in("batch", assignedBatches);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Failed to fetch students:", error);
          setError("Failed to load students.");
          setStudents([]);
          return;
        }

        console.log("[Debug] Fetched students total:", data?.length);

        if (!data) {
          console.log("[Debug] No data returned from users query");
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
  }, [supabase, practical, form.subject_id]);

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
      [name]:
        name === "max_marks" || name === "practical_number"
          ? Number(value)
          : value,
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
    level: "Task 1" | "Task 2",
    field: string,
    value: string | number | boolean,
  ) => {
    setLevels((prev) =>
      prev.map((l) => (l.level === level ? { ...l, [field]: value } : l)),
    );
  };

  const addLevelTestCase = (level: "Task 1" | "Task 2") => {
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
    level: "Task 1" | "Task 2",
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
    level: "Task 1" | "Task 2",
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
      const prompt = `You are an expert test case generator. Analyze the following problem and code, then generate 3-5 diverse test cases.

## Problem Description:
${sourceDescription}

${sampleCode ? `## Reference Code:
\`\`\`
${sampleCode}
\`\`\`

IMPORTANT: Study the reference code carefully to understand:
1. What input format it expects (stdin format, data types, multiple inputs, etc.)
2. What the code actually does with the input (the algorithm/logic)
3. What output format it produces (stdout format)
` : ""}

## Your Task:
Generate test cases that match EXACTLY what this specific code/problem expects.
- Ensure inputs match the expected stdin format of the code
- Ensure expected outputs match what the code would actually produce
- Include edge cases (empty input, single element, boundary values, etc.)
- Each test case should test different scenarios

Return ONLY a valid JSON array:
[{"input": "your input here", "expected_output": "expected output here"}, ...]

Do not include markdown formatting, explanations, or any text outside the JSON array.`;

      const savedSettings = localStorage.getItem("ai_settings");
      const config = savedSettings ? JSON.parse(savedSettings) : {};
      const apiUrl =
        process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
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

      // Extract JSON array from response (AI might add extra text)
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No valid JSON array found in AI response");
      }
      jsonStr = jsonMatch[0];

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
          // Get existing inputs for this level
          const existingInputs = new Set(
            getCurrentLevel().testCases.map((tc) => tc.input.trim())
          );
          // Filter out duplicates
          const uniqueTests = formattedTests.filter(
            (tc) => !existingInputs.has(tc.input.trim())
          );
          // Add to current level test cases
          setLevels((prev) =>
            prev.map((l) =>
              l.level === activeLevel
                ? { ...l, testCases: [...l.testCases, ...uniqueTests] }
                : l,
            ),
          );
        } else {
          // Get existing inputs
          const existingInputs = new Set(
            testCases.map((tc) => tc.input.trim())
          );
          // Filter out duplicates
          const uniqueTests = formattedTests.filter(
            (tc) => !existingInputs.has(tc.input.trim())
          );
          // Add to global test cases
          setTestCases((prev) => [...prev, ...uniqueTests]);
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
    () => {
      const lang = String(sampleLanguage || "").toLowerCase();
      if (lang === "python") return python();
      if (lang === "java") return cpp(); // Use C++ mode for Java
      return cpp();
    },
    [sampleLanguage],
  );

  // Validate form data
  const validateForm = useCallback(() => {
    if (!form.practical_number) {
      alert("Please enter a Practical Number");
      return false;
    }
    if (!form.title.trim()) {
      alert("Please enter a Practical Title");
      return false;
    }

    if (!form.subject_id) {
      alert("Please select a Subject");
      return false;
    }

    if (enableLevels) {
      if (levels.length === 0) {
        alert("Please add at least one Level");
        return false;
      }
      for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        if (!lvl.title?.trim()) {
          alert(`Level ${i + 1} must have a title`);
          return false;
        }
        if (!lvl.description?.trim()) {
          alert(`Level ${i + 1} must have a description`);
          return false;
        }
        if (lvl.max_marks <= 0) {
          alert(`Level ${i + 1} must have max marks greater than 0`);
          return false;
        }
        // Enforce at least one test case per level for strictness
        if (lvl.testCases.length === 0) {
          alert(`Level ${i + 1} must have at least one test case`);
          return false;
        }
      }
    } else {
      if (!form.description?.trim()) {
        alert("Please enter a Description");
        return false;
      }
      if ((form.max_marks ?? 0) <= 0) {
        alert("Max Marks must be greater than 0");
        return false;
      }
      // Strict: Require at least one test case
      if (testCases.length === 0) {
        alert("Please add at least one test case");
        return false;
      }
    }

    return true;
  }, [form, enableLevels, levels, testCases]);

  const saveReferenceCode = async (pId: number, code: string, lang: string) => {
    if (!pId || !code) return;
    console.log(`[SaveRef] Saving code for practical ${pId} (lang: ${lang})`);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        console.warn("[SaveRef] No user ID found, skipping reference code save");
        return;
      }

      // Check for existing reference code for this practical + language
      const { data: existing, error: fetchErr } = await supabase
        .from("reference_codes")
        .select("id")
        .eq("practical_id", pId)
        .eq("language", lang)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const payload = {
        practical_id: pId,
        code,
        language: lang,
        author: userId,
        is_primary: true,
        version: 1,
        updated_at: new Date().toISOString(),
      };

      let resultError;
      if (existing) {
        const { error } = await supabase
          .from("reference_codes")
          .update(payload)
          .eq("id", existing.id);
        resultError = error;
      } else {
        const { error } = await supabase
          .from("reference_codes")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });
        resultError = error;
      }

      if (resultError) throw resultError;
      console.log(`[SaveRef] Successfully saved code for practical ${pId}`);
    } catch (err) {
      console.error("Error saving reference code:", err);
      // Do NOT re-throw, just log. We don't want to fail the whole practical because of this.
    }
  };

  // Save practical (create/update)
  const handleSave = useCallback(async () => {
    if (!validateForm()) return false;

    setSaving(true);
    try {
      // Check for duplicate practical number in the same subject
      if (form.subject_id && form.practical_number) {
        let query = supabase
          .from("practicals")
          .select("id")
          .eq("subject_id", form.subject_id)
          .eq("practical_number", form.practical_number);

        const practicalId = Number(form.id) || 0;
        if (practicalId > 0) {
          query = query.neq("id", practicalId);
        }

        const { data: existing, error: checkError } = await query;

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
          alert(`Practical Number ${form.practical_number} already exists for this subject.`);
          setSaving(false);
          return false;
        }
      }

      let practicalId = Number(form.id) || 0;
      const payload = {
        title: form.title,
        subject_id: form.subject_id,
        description: enableLevels ? "" : form.description, // Use level descriptions when levels enabled
        language: form.language,
        max_marks: enableLevels
          ? levels.reduce((sum, l) => sum + l.max_marks, 0)
          : (form.max_marks ?? 10),
        practical_number: form.practical_number,
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

          // Save reference code for this level if present
          if (level.reference_code) {
            await saveReferenceCode(practicalId, level.reference_code, form.language || "c");
          }

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

        // Save reference code for single level
        if (sampleCode) {
          await saveReferenceCode(practicalId, sampleCode, sampleLanguage);
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
  }, [form, testCases, levels, enableLevels, sampleCode, sampleLanguage, supabase, validateForm, onSaveStep1]);

  // Save ALL drafts (for bulk import mode)
  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    let successCount = 0;
    let failCount = 0;
    const savedData: { id: number }[] = [];

    try {
      // Save each draft sequentially
      for (const draft of draftPracticals) {
        try {
          // Build payload from the draft's stored data
          const draftEnableLevels = draft.enableLevels;
          const draftLevels = draft.levels;
          const draftTestCases = draft.testCases;
          const draftForm = draft.form;

          // Validate this draft
          if (!draftForm.title?.trim()) {
            console.warn(`Skipping draft without title: ${draft.id}`);
            failCount++;
            continue;
          }
          if (!draftForm.subject_id) {
            console.warn(`Skipping draft without subject: ${draft.id}`);
            failCount++;
            continue;
          }

          // Check for duplicate practical number
          if (draftForm.subject_id && draftForm.practical_number) {
            const { data: existing } = await supabase
              .from("practicals")
              .select("id")
              .eq("subject_id", draftForm.subject_id)
              .eq("practical_number", draftForm.practical_number);

            if (existing && existing.length > 0) {
              console.warn(`Skipping draft with duplicate practical_number: ${draftForm.practical_number}`);
              failCount++;
              continue;
            }
          }

          // Build payload
          const payload = {
            title: draftForm.title,
            subject_id: draftForm.subject_id,
            description: draftEnableLevels ? "" : draftForm.description,
            language: draftForm.language,
            max_marks: draftEnableLevels
              ? draftLevels.reduce((sum, l) => sum + l.max_marks, 0)
              : (draftForm.max_marks ?? 10),
            practical_number: draftForm.practical_number || undefined,
          };

          // Insert practical
          const { data: newPractical, error: insertErr } = await supabase
            .from("practicals")
            .insert(payload)
            .select()
            .single();

          if (insertErr) throw insertErr;
          const practicalId = newPractical.id;
          savedData.push({
            id: practicalId,
          });

          if (draftEnableLevels) {
            // Save levels with their test cases
            for (const level of draftLevels) {
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

              // Save reference code for this level if present
              if (level.reference_code) {
                try {
                  await saveReferenceCode(practicalId, level.reference_code, draftForm.language || "c");
                } catch (refErr) {
                  console.error("Failed to save reference code for level:", refErr);
                }
              }

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
            // Single-level test cases
            if (draftTestCases.length > 0) {
              const insertData = draftTestCases.map((tc) => ({
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

            // Save reference code for single level
            if (draft.sampleCode) {
              await saveReferenceCode(practicalId, draft.sampleCode, draft.sampleLanguage || draftForm.language || "c");
            }
          }

          successCount++;
        } catch (draftErr) {
          console.error(`Error saving draft ${draft.id}:`, draftErr);
          failCount++;
        }
      }

      if (successCount > 0) {
        alert(`Successfully saved ${successCount} practicals. ${failCount > 0 ? `${failCount} failed.` : ""}`);
      } else {
        alert(`Failed to save any practicals. ${failCount} errors.`);
      }

      return savedData;
    } finally {
      setSaving(false);
    }
  }, [draftPracticals, supabase]);

  // Assign practical to selected students
  const assign = async (specificItems?: { id: number }[]) => {
    // Determine which items to assign
    const itemsToAssign = specificItems && specificItems.length > 0
      ? specificItems
      : savedPracticals.length > 0
        ? savedPracticals
        : (form.id ? [{ id: Number(form.id) }] : []);

    if (itemsToAssign.length === 0) {
      alert("Save the practical(s) before assigning.");
      return;
    }

    if (selectedStudents.length === 0) {
      alert("Select at least one student to assign.");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Assign each practical sequentially
      for (const item of itemsToAssign) {
        // Use assignmentDeadline state (which user might have edited in step 2)
        const deadlineToUse = assignmentDeadline || new Date().toISOString();

        try {
          const response = await fetch("/api/admin/practicals/assign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              practical_id: item.id,
              student_ids: selectedStudents.map((s) => s.uid),
              assigned_deadline: deadlineToUse,
              notes,
            }),
          });

          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            console.error(`Failed to assign practical ${item.id}:`, result.error);
            failCount++;
          }
        } catch (err) {
          console.error(`Error assigning practical ${item.id}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        alert(`Assigned ${successCount} practicals successfully. ${failCount > 0 ? `${failCount} failed.` : ""}`);
        onSaved();
      } else {
        alert("Failed to assign practicals.");
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

  // ---------------------- Draft Management Functions ----------------------
  // Update current draft state before switching or performing other actions
  const syncCurrentDraftState = useCallback(() => {
    if (draftPracticals.length === 0 || practical) return; // Skip if editing existing or no drafts
    setDraftPracticals(prev => {
      const copy = [...prev];
      if (copy[activeDraftIndex]) {
        copy[activeDraftIndex] = {
          ...copy[activeDraftIndex],
          form: { ...form },
          testCases: [...testCases],
          levels: JSON.parse(JSON.stringify(levels)),
          enableLevels,
          sampleCode, // Save current sample code
          sampleLanguage, // Save current language
        };
      }
      return copy;
    });
  }, [activeDraftIndex, form, testCases, levels, enableLevels, sampleCode, sampleLanguage, draftPracticals.length, practical]);

  // Add a new draft
  const addDraft = useCallback(() => {
    // First save current draft state
    syncCurrentDraftState();
    const newDraft = createEmptyDraft();
    setDraftPracticals(prev => [...prev, newDraft]);
    // Switch to the new draft
    const newIndex = draftPracticals.length;
    setActiveDraftIndex(newIndex);
    // Load the new draft into form
    setForm(newDraft.form);
    setTestCases(newDraft.testCases);
    setLevels(newDraft.levels);
    setEnableLevels(newDraft.enableLevels);
  }, [syncCurrentDraftState, draftPracticals.length]);

  // Remove a draft
  const removeDraft = useCallback((index: number) => {
    if (draftPracticals.length <= 1) {
      alert("You must have at least one practical.");
      return;
    }
    setDraftPracticals(prev => prev.filter((_, i) => i !== index));
    // Adjust active index if needed
    if (index <= activeDraftIndex) {
      const newIndex = Math.max(0, activeDraftIndex - 1);
      setActiveDraftIndex(newIndex);
      // Load the new active draft
      const newActiveDraft = draftPracticals[newIndex === activeDraftIndex ? newIndex : index === 0 ? 0 : newIndex];
      if (newActiveDraft) {
        setForm(newActiveDraft.form);
        setTestCases(newActiveDraft.testCases);
        setLevels(newActiveDraft.levels);
        setEnableLevels(newActiveDraft.enableLevels);
      }
    }
  }, [draftPracticals, activeDraftIndex]);

  // Switch to a different draft
  const switchToDraft = useCallback((index: number) => {
    if (index === activeDraftIndex) return;
    // Save current draft state first
    syncCurrentDraftState();
    // Load the selected draft
    const draft = draftPracticals[index];
    if (draft) {
      setActiveDraftIndex(index);
      setForm(draft.form);
      setTestCases(draft.testCases);
      setLevels(draft.levels);
      setEnableLevels(draft.enableLevels);
      if (draft.sampleCode !== undefined) setSampleCode(draft.sampleCode);
      if (draft.sampleLanguage !== undefined) setSampleLanguage(draft.sampleLanguage);
    }
  }, [activeDraftIndex, draftPracticals, syncCurrentDraftState]);

  // Save all drafts at once
  const saveAllDrafts = async () => {
    // First sync current state
    syncCurrentDraftState();

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    // Get the latest drafts state
    const draftsToSave = [...draftPracticals];
    // Update with current form if it's the active draft
    if (draftsToSave[activeDraftIndex]) {
      draftsToSave[activeDraftIndex] = {
        ...draftsToSave[activeDraftIndex],
        form: { ...form },
        testCases: [...testCases],
        levels: JSON.parse(JSON.stringify(levels)),
        enableLevels,
        sampleCode,
        sampleLanguage,
      };
    }

    for (const draft of draftsToSave) {
      try {
        const payload = {
          title: draft.form.title,
          subject_id: draft.form.subject_id,
          description: draft.enableLevels ? "" : draft.form.description,
          language: draft.form.language,
          max_marks: draft.enableLevels
            ? draft.levels.reduce((sum, l) => sum + l.max_marks, 0)
            : (draft.form.max_marks ?? 10),
        };

        const { data, error } = await supabase
          .from("practicals")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        const practicalId = data.id;

        if (draft.enableLevels) {
          for (const level of draft.levels) {
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

            // Save reference code for this level if present
            if (level.reference_code) {
              await saveReferenceCode(practicalId, level.reference_code, draft.form.language || "c");
            }

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
              const { error: tcErr } = await supabase.from("test_cases").insert(tcData);
              if (tcErr) throw tcErr;
            }
          }
        } else {
          if (draft.testCases.length > 0) {
            const insertData = draft.testCases.map((tc) => ({
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
        }

        // Save reference code if available in draft
        if (draft.sampleCode) {
          await saveReferenceCode(practicalId, draft.sampleCode, draft.sampleLanguage || draft.form.language || "c");
        }

        successCount++;
      } catch (err: any) {
        console.error(`Error saving draft "${draft.form.title}":`, err);
        // Alert the first error to help debugging
        if (errorCount === 0) {
          alert("Save Failed: " + (err?.message || JSON.stringify(err)));
        }
        errorCount++;
      }
    }

    setSaving(false);

    if (errorCount === 0) {
      alert(`Successfully created ${successCount} practical(s)!`);
      onSaved();
    } else {
      alert(`Created ${successCount} practical(s), but ${errorCount} failed.`);
    }
  };

  // Check if we're in multi-draft mode (creating new, not editing)
  const isMultiDraftMode = !practical && draftPracticals.length > 0;

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
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow"
                  >
                    1
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Practical Details
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Fill details & test cases
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
                      if (isMultiDraftMode) {
                        const savedData = await handleSaveAll();
                        if (savedData.length > 0) {
                          onSaved();
                        }
                      } else {
                        const success = await handleSave();
                        if (success) {
                          onSaved();
                        }
                      }
                    }}
                    disabled={saving}
                    className={cx(
                      "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                      saving
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-wait"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/30",
                    )}
                  >
                    {saving ? <LoadingSpinner /> : null}
                    {saving ? "Saving..." : "Save Practical"}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Main content container with optional sidebar */}
            <div className={cx(
              "w-full mx-auto py-6 flex",
              isMultiDraftMode && !sidebarCollapsed ? "pl-0" : "px-4 xl:px-12"
            )}>
              {/* Sidebar for multi-draft mode */}
              {isMultiDraftMode && (
                <motion.div
                  initial={{ width: sidebarCollapsed ? 48 : 280 }}
                  animate={{ width: sidebarCollapsed ? 48 : 280 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm min-h-[calc(100vh-120px)] sticky top-[60px] self-start"
                >
                  {sidebarCollapsed ? (
                    <div className="p-2 flex flex-col items-center gap-2">
                      <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        title="Expand sidebar"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="w-8 h-px bg-gray-200 dark:bg-gray-700" />
                      <button
                        onClick={addDraft}
                        className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md hover:shadow-lg transition-all"
                        title="Add practical"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <div className="flex flex-col gap-1 mt-2">
                        {draftPracticals.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => switchToDraft(idx)}
                            className={cx(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                              idx === activeDraftIndex
                                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 h-full flex flex-col">
                      {/* Sidebar Header */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                          Practicals ({draftPracticals.length})
                        </h3>
                        <button
                          onClick={() => setSidebarCollapsed(true)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          title="Collapse sidebar"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Add New Button */}
                      <button
                        onClick={addDraft}
                        className="w-full group flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300 mb-6"
                      >
                        <div className="p-1 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                        Add New Practical
                      </button>

                      {/* Draft List */}
                      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {draftPracticals.map((draft, idx) => {
                          // Use live form state for active draft, otherwise use draft state
                          const isActiveDraft = idx === activeDraftIndex;
                          const currentTitle = isActiveDraft ? form.title : draft.form.title;
                          const currentTestCases = isActiveDraft ? testCases : draft.testCases;
                          const currentPracticalNumber = isActiveDraft ? form.practical_number : draft.form.practical_number;

                          const hasTitle = currentTitle.trim() !== "";
                          const hasTestCases = currentTestCases.some(tc => tc.input.trim() !== "" || tc.expected_output.trim() !== "");
                          const displayTitle = hasTitle ? currentTitle : `Practical ${idx + 1}`;
                          const subjectName = subjects.find(s => s.id === (isActiveDraft ? form.subject_id : draft.form.subject_id))?.subject_name || "No subject";

                          // Calculate completion percentage
                          const fields = [hasTitle, hasTestCases];
                          const completedFields = fields.filter(Boolean).length;
                          const completionPercent = Math.round((completedFields / fields.length) * 100);
                          const isComplete = completionPercent === 100;

                          // SVG circle properties for progress ring
                          const radius = 10;
                          const circumference = 2 * Math.PI * radius;
                          const strokeDashoffset = circumference - (completionPercent / 100) * circumference;

                          return (
                            <div
                              key={draft.id}
                              onClick={() => switchToDraft(idx)}
                              className={cx(
                                "group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border",
                                idx === activeDraftIndex
                                  ? "bg-white dark:bg-gray-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                                  : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {/* Progress Ring */}
                                <div className="relative shrink-0">
                                  <svg width="28" height="28" className="transform -rotate-90">
                                    <circle
                                      cx="14"
                                      cy="14"
                                      r={radius}
                                      fill="none"
                                      stroke={idx === activeDraftIndex ? "rgba(99, 102, 241, 0.2)" : "rgba(156, 163, 175, 0.3)"}
                                      strokeWidth="3"
                                    />
                                    <circle
                                      cx="14"
                                      cy="14"
                                      r={radius}
                                      fill="none"
                                      stroke={isComplete ? "#10b981" : idx === activeDraftIndex ? "#6366f1" : "#9ca3af"}
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeDasharray={circumference}
                                      strokeDashoffset={strokeDashoffset}
                                      className="transition-all duration-500"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    {isComplete ? (
                                      <CheckIcon className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <FileText className={cx(
                                        "w-3 h-3",
                                        idx === activeDraftIndex ? "text-indigo-500" : "text-gray-400"
                                      )} />
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={cx(
                                    "flex flex-col gap-0.5 min-w-0 font-medium transition-colors",
                                    idx === activeDraftIndex ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                                  )}>
                                    <div className={cx(
                                      "text-[10px] uppercase tracking-wider font-bold mb-0.5",
                                      idx === activeDraftIndex
                                        ? "text-indigo-600 dark:text-indigo-400"
                                        : "text-gray-500 dark:text-gray-400"
                                    )}>
                                      Practical {currentPracticalNumber ?? idx + 1}
                                    </div>
                                    <div className={cx(
                                      "truncate text-sm font-semibold",
                                      idx === activeDraftIndex
                                        ? "text-gray-900 dark:text-white"
                                        : "text-gray-700 dark:text-gray-300"
                                    )}>
                                      {hasTitle ? currentTitle : "Untitled Practical"}
                                    </div>
                                  </div>

                                </div>
                                {draftPracticals.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDraft(idx);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                                    title="Remove practical"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Main Form Area */}
              <div className={cx(
                "flex-1",
                isMultiDraftMode ? "px-4 xl:px-8" : ""
              )}>


                {/* ---------- FORM CONTENT ---------- */}
                <div className="space-y-6">
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
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div >
      )
      }
    </AnimatePresence >
  );
}
